import { assertInRange, roundToResolution } from './math';
import type { ModelSpec } from './types';

/**
 * Estructura 3D de proteínas: lector de archivos PDBx/mmCIF y PDB, conteos, distancias y confianza de las predicciones
 * (programa v2, sección 10.4; grado 11.º).
 *
 * Las coordenadas NO se inventan: vienen de archivos reales del PDB (estructuras experimentales) o de AlphaFold DB
 * (predicciones computacionales), incluidos sin modificar en src/data/proteinas/ o descargados en vivo. Este modelo:
 *   1. Lee la tabla _atom_site (mmCIF) o los registros ATOM/HETATM (PDB) con límites de tamaño y validación de campos.
 *   2. Agrupa átomos en residuos y cadenas con las mismas convenciones que Biopython (Bio.PDB): primer modelo,
 *      cadena = auth_asym_id, número = auth_seq_id, posiciones alternativas contadas una vez (la de mayor ocupación).
 *   3. Toma la estructura secundaria del propio archivo (_struct_conf, _struct_sheet_range o HELIX/SHEET); no la calcula.
 *   4. Calcula distancias d = |r_B − r_A| y clasifica la confianza pLDDT (columna B de los modelos de AlphaFold).
 * Funciones puras y deterministas (sin React ni navegador) para probarlas con Vitest y compararlas con Biopython.
 */

/* ------------------------------------------------------------------ tipos */

export type ResidueKind = 'estandar' | 'hetero' | 'agua';
export type SecondaryKind = 'helice' | 'hebra' | 'otra';

export interface PAtom {
  index: number;
  /** Número de serie del archivo (_atom_site.id o columnas 7–11 del PDB). */
  serial: number;
  name: string;
  element: string;
  altloc: string;
  x: number; y: number; z: number;
  occupancy: number;
  /** Columna B: factor de desplazamiento atómico (Å²) en estructuras experimentales; pLDDT en modelos de AlphaFold. */
  b: number;
  /** Índice del residuo al que pertenece. */
  residue: number;
}

export interface PResidue {
  index: number;
  chain: string;
  resSeq: number;
  iCode: string;
  resName: string;
  /** Igual que Biopython: estándar = registro ATOM; hetero = HETATM que no es agua; agua = HETATM HOH/WAT. */
  kind: ResidueKind;
  /** Pertenece a la cadena polimérica (label_seq_id distinto de «.» en mmCIF; registro ATOM o residuo modificado en PDB). */
  polymer: boolean;
  atoms: number[];
  /** Índice del átomo Cα o null. */
  ca: number | null;
  ss: SecondaryKind;
}

export interface PChain {
  id: string;
  residues: number[];
  standard: number;
  hetero: number;
  water: number;
  polymer: number;
  atoms: number;
  heteroNames: string[];
}

export interface SsRange { kind: SecondaryKind; type: string; chain: string; start: number; end: number }

export interface ProteinStructure {
  format: 'mmcif' | 'pdb';
  /** Identificador declarado en el archivo (_entry.id o HEADER); no verificado si el archivo es local. */
  id: string | null;
  title: string | null;
  method: string | null;
  resolution: number | null;
  depositDate: string | null;
  /** El archivo se declara como modelo predicho (categorías ma_ de ModelCIF o título de AlphaFold). */
  declaresPrediction: boolean;
  /** pLDDT global declarado en el archivo (_ma_qa_metric_global), si existe. */
  globalPlddt: number | null;
  license: string | null;
  atoms: PAtom[];
  residues: PResidue[];
  chains: PChain[];
  ss: { fromFile: boolean; ranges: SsRange[]; helixRows: number; strandRows: number; otherRows: number; sheetRows: number };
  /** Registros de átomos del primer modelo (incluye las posiciones alternativas por separado). */
  atomRecords: number;
  models: number;
}

/** Error de lectura con un mensaje comprensible para el estudiante. */
export class StructureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StructureError';
  }
}

/** Límites de seguridad del lector (un archivo mayor se rechaza sin procesarlo). */
export const STRUCTURE_LIMITS = {
  /** Caracteres del texto (≈ 16 MB). */
  maxChars: 16_000_000,
  /** Átomos del primer modelo. */
  maxAtoms: 200_000,
  /** Valor absoluto máximo de una coordenada (el formato PDB admite hasta 9999,999 Å). */
  maxCoord: 10_000,
  /** Archivo local: tamaño máximo en bytes. */
  maxFileBytes: 16_000_000,
} as const;

/** Resolución con que el laboratorio informa distancias (Å) y pLDDT. */
export const RESOLUTION = { distance: 0.001, plddt: 0.01 } as const;

/* ------------------------------------------------------------------ utilidades */

const WATER = new Set(['HOH', 'WAT']);
const ELEMENT_FIX = (e: string) => (e.length <= 1 ? e.toUpperCase() : e[0].toUpperCase() + e.slice(1).toLowerCase());

function num(text: string | undefined, field: string, line: number): number {
  const v = Number(text);
  if (text === undefined || text === '' || text === '?' || text === '.' || !Number.isFinite(v)) {
    throw new StructureError(`Valor no numérico en ${field} (registro ${line}).`);
  }
  return v;
}

function cleanUnknown(v: string | undefined): string | null {
  if (v === undefined) return null;
  const t = v.trim();
  return t === '' || t === '?' || t === '.' ? null : t;
}

/* ------------------------------------------------------------------ lector CIF (tokenizador mínimo) */

interface CifToken { v: string; q: boolean }

/** Separa el texto CIF en fichas: valores sin comillas, entre comillas simples o dobles, y campos de texto con «;». */
export function tokenizeCif(text: string): CifToken[] {
  const out: CifToken[] = [];
  const lines = text.split(/\r?\n/);
  for (let li = 0; li < lines.length; li++) {
    const line = lines[li];
    if (line.startsWith(';')) {
      const buf = [line.slice(1)];
      li++;
      while (li < lines.length && !lines[li].startsWith(';')) { buf.push(lines[li]); li++; }
      if (li >= lines.length) throw new StructureError('Campo de texto «;» sin cerrar en el archivo mmCIF.');
      out.push({ v: buf.join('\n').trim(), q: true });
      continue;
    }
    let i = 0;
    const n = line.length;
    while (i < n) {
      const c = line[i];
      if (c === ' ' || c === '\t') { i++; continue; }
      if (c === '#') break;
      if (c === "'" || c === '"') {
        let j = i + 1;
        while (j < n && !(line[j] === c && (j + 1 === n || line[j + 1] === ' ' || line[j + 1] === '\t'))) j++;
        if (j >= n) throw new StructureError(`Comillas sin cerrar en la línea ${li + 1} del archivo mmCIF.`);
        out.push({ v: line.slice(i + 1, j), q: true });
        i = j + 1;
        continue;
      }
      let j = i;
      while (j < n && line[j] !== ' ' && line[j] !== '\t') j++;
      out.push({ v: line.slice(i, j), q: false });
      i = j;
    }
  }
  return out;
}

/** Diccionario «_categoria.item» → lista de valores del primer bloque de datos (como Bio.PDB.MMCIF2Dict). */
export function cifDictionary(text: string): Map<string, string[]> {
  const tokens = tokenizeCif(text);
  const dict = new Map<string, string[]>();
  let i = 0;
  let blocks = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (!t.q && /^data_/i.test(t.v)) { blocks++; if (blocks > 1) break; i++; continue; }
    if (!t.q && /^loop_$/i.test(t.v)) {
      i++;
      const names: string[] = [];
      while (i < tokens.length && !tokens[i].q && tokens[i].v.startsWith('_')) { names.push(tokens[i].v); i++; }
      if (names.length === 0) throw new StructureError('Bloque loop_ sin nombres de columnas.');
      const cols: string[][] = names.map(() => []);
      let k = 0;
      while (i < tokens.length) {
        const u = tokens[i];
        if (!u.q && (u.v.startsWith('_') || /^loop_$/i.test(u.v) || /^data_/i.test(u.v) || /^(save_|global_|stop_)/i.test(u.v))) break;
        cols[k % names.length].push(u.v);
        k++; i++;
      }
      if (k % names.length !== 0) throw new StructureError(`La tabla ${names[0].split('.')[0]} tiene un número de valores que no es múltiplo de sus ${names.length} columnas.`);
      names.forEach((nm, c) => dict.set(nm, cols[c]));
      continue;
    }
    if (!t.q && t.v.startsWith('_')) {
      const val = tokens[i + 1];
      if (!val) throw new StructureError(`El campo ${t.v} no tiene valor.`);
      dict.set(t.v, [val.v]);
      i += 2;
      continue;
    }
    i++;
  }
  if (blocks === 0) throw new StructureError('El archivo no tiene un bloque «data_»: no parece mmCIF.');
  return dict;
}

/* ------------------------------------------------------------------ armado común */

interface RawAtom {
  group: 'ATOM' | 'HETATM'; serial: number; name: string; element: string; altloc: string; resName: string; chain: string;
  resSeq: number; iCode: string; x: number; y: number; z: number; occupancy: number; b: number; polymer: boolean;
}

function build(raw: RawAtom[]): { atoms: PAtom[]; residues: PResidue[]; chains: PChain[] } {
  const atoms: PAtom[] = [];
  const residues: PResidue[] = [];
  const chains: PChain[] = [];
  const chainIdx = new Map<string, number>();
  const resIdx = new Map<string, number>();
  const atomIdx = new Map<string, { index: number; occ: number }>();
  for (const r of raw) {
    const het = r.group === 'HETATM' ? (WATER.has(r.resName) ? 'W' : `H_${r.resName}`) : ' ';
    const rkey = `${r.chain}|${het}|${r.resSeq}|${r.iCode}`;
    let ri = resIdx.get(rkey);
    if (ri === undefined) {
      let ci = chainIdx.get(r.chain);
      if (ci === undefined) {
        ci = chains.length;
        chainIdx.set(r.chain, ci);
        chains.push({ id: r.chain, residues: [], standard: 0, hetero: 0, water: 0, polymer: 0, atoms: 0, heteroNames: [] });
      }
      ri = residues.length;
      resIdx.set(rkey, ri);
      const kind: ResidueKind = het === ' ' ? 'estandar' : het === 'W' ? 'agua' : 'hetero';
      residues.push({ index: ri, chain: r.chain, resSeq: r.resSeq, iCode: r.iCode, resName: r.resName, kind, polymer: r.polymer, atoms: [], ca: null, ss: 'otra' });
      const ch = chains[ci];
      ch.residues.push(ri);
      if (kind === 'estandar') ch.standard++; else if (kind === 'agua') ch.water++; else { ch.hetero++; if (!ch.heteroNames.includes(r.resName)) ch.heteroNames.push(r.resName); }
      if (r.polymer) ch.polymer++;
    }
    const akey = `${rkey}|${r.name}`;
    const prev = atomIdx.get(akey);
    if (prev) {
      // Posición alternativa (o átomo repetido): se queda la de mayor ocupación; si empatan, la primera (como Biopython).
      if (r.altloc && r.occupancy > prev.occ) {
        const a = atoms[prev.index];
        a.x = r.x; a.y = r.y; a.z = r.z; a.b = r.b; a.occupancy = r.occupancy; a.altloc = r.altloc; a.serial = r.serial;
        prev.occ = r.occupancy;
      }
      continue;
    }
    const index = atoms.length;
    atoms.push({ index, serial: r.serial, name: r.name, element: r.element, altloc: r.altloc, x: r.x, y: r.y, z: r.z, occupancy: r.occupancy, b: r.b, residue: ri });
    atomIdx.set(akey, { index, occ: r.occupancy });
    const res = residues[ri];
    res.atoms.push(index);
    if (r.name === 'CA' && r.element !== 'Ca') res.ca = index;
    chains[chainIdx.get(r.chain)!].atoms++;
  }
  for (const c of chains) c.heteroNames.sort();
  return { atoms, residues, chains };
}

function applySecondary(residues: PResidue[], ranges: SsRange[]) {
  for (const rg of ranges) {
    if (rg.kind === 'otra') continue;
    for (const r of residues) {
      if (r.chain === rg.chain && r.polymer && r.resSeq >= rg.start && r.resSeq <= rg.end) {
        // Una hélice no se sobrescribe con una hebra (no deberían solaparse en el archivo).
        if (r.ss === 'otra' || rg.kind === 'helice') r.ss = rg.kind;
      }
    }
  }
}

function checkCoord(v: number, line: number) {
  if (Math.abs(v) > STRUCTURE_LIMITS.maxCoord) throw new StructureError(`Coordenada fuera de rango (|${v}| > ${STRUCTURE_LIMITS.maxCoord} Å) en el registro ${line}.`);
}

function guardText(text: string) {
  if (typeof text !== 'string' || text.trim() === '') throw new StructureError('El archivo está vacío.');
  if (text.length > STRUCTURE_LIMITS.maxChars) throw new StructureError(`El archivo supera el límite de ${STRUCTURE_LIMITS.maxChars.toLocaleString('es-CO')} caracteres.`);
  if (text.includes('\u0000')) throw new StructureError('El archivo contiene datos binarios: usa un archivo de texto PDB o mmCIF (no BinaryCIF ni comprimido).');
}

/* ------------------------------------------------------------------ mmCIF */

export function parseMmcif(text: string): ProteinStructure {
  guardText(text);
  const d = cifDictionary(text);
  const col = (name: string) => d.get(`_atom_site.${name}`);
  const x = col('Cartn_x'), y = col('Cartn_y'), z = col('Cartn_z');
  if (!x || !y || !z) throw new StructureError('El archivo mmCIF no tiene la tabla _atom_site con coordenadas cartesianas.');
  const n = x.length;
  const group = col('group_PDB'), serial = col('id'), sym = col('type_symbol');
  // Como Bio.PDB.MMCIFParser: nombre del átomo y del residuo «label_», cadena y número «auth_».
  const atomName = col('label_atom_id') ?? col('auth_atom_id');
  const resName = col('label_comp_id') ?? col('auth_comp_id');
  const chain = col('auth_asym_id') ?? col('label_asym_id');
  const seq = col('auth_seq_id') ?? col('label_seq_id');
  const labelSeq = col('label_seq_id');
  const ins = col('pdbx_PDB_ins_code'), alt = col('label_alt_id'), occ = col('occupancy'), bcol = col('B_iso_or_equiv'), model = col('pdbx_PDB_model_num');
  if (!atomName || !resName || !chain || !seq) throw new StructureError('A la tabla _atom_site le faltan columnas de átomo, residuo, cadena o número.');
  const firstModel = model?.[0];
  const models = model ? new Set(model).size : 1;
  const raw: RawAtom[] = [];
  for (let i = 0; i < n; i++) {
    if (model && model[i] !== firstModel) continue;
    if (raw.length >= STRUCTURE_LIMITS.maxAtoms) throw new StructureError(`El primer modelo tiene más de ${STRUCTURE_LIMITS.maxAtoms.toLocaleString('es-CO')} átomos: es demasiado grande para este laboratorio.`);
    const g = (group?.[i] ?? 'ATOM').toUpperCase();
    if (g !== 'ATOM' && g !== 'HETATM') throw new StructureError(`Tipo de registro desconocido «${g}» en _atom_site (fila ${i + 1}).`);
    const rx = num(x[i], 'Cartn_x', i + 1), ry = num(y[i], 'Cartn_y', i + 1), rz = num(z[i], 'Cartn_z', i + 1);
    checkCoord(rx, i + 1); checkCoord(ry, i + 1); checkCoord(rz, i + 1);
    const rs = Number(seq[i]);
    const name = atomName[i].replace(/^"|"$/g, '');
    const el = cleanUnknown(sym?.[i]) ?? name.replace(/[^A-Za-z]/g, '').slice(0, 1);
    raw.push({
      group: g as 'ATOM' | 'HETATM', serial: Number(serial?.[i] ?? i + 1), name, element: ELEMENT_FIX(el), altloc: cleanUnknown(alt?.[i]) ?? '',
      resName: resName[i], chain: chain[i], resSeq: Number.isFinite(rs) ? rs : 0, iCode: cleanUnknown(ins?.[i]) ?? '',
      x: rx, y: ry, z: rz, occupancy: occ && cleanUnknown(occ[i]) ? Number(occ[i]) : 1, b: bcol && cleanUnknown(bcol[i]) ? Number(bcol[i]) : 0,
      polymer: labelSeq ? cleanUnknown(labelSeq[i]) !== null : g === 'ATOM',
    });
  }
  if (raw.length === 0) throw new StructureError('El archivo no tiene átomos.');
  const { atoms, residues, chains } = build(raw);
  // Estructura secundaria del archivo.
  const ranges: SsRange[] = [];
  const confType = d.get('_struct_conf.conf_type_id') ?? [];
  const cChain = d.get('_struct_conf.beg_auth_asym_id') ?? d.get('_struct_conf.beg_label_asym_id') ?? [];
  const cBeg = d.get('_struct_conf.beg_auth_seq_id') ?? d.get('_struct_conf.beg_label_seq_id') ?? [];
  const cEnd = d.get('_struct_conf.end_auth_seq_id') ?? d.get('_struct_conf.end_label_seq_id') ?? [];
  let helixRows = 0, strandRows = 0, otherRows = 0;
  confType.forEach((t, i) => {
    const kind: SecondaryKind = t.startsWith('HELX') ? 'helice' : t.startsWith('STRN') ? 'hebra' : 'otra';
    if (kind === 'helice') helixRows++; else if (kind === 'hebra') strandRows++; else otherRows++;
    ranges.push({ kind, type: t, chain: cChain[i], start: Number(cBeg[i]), end: Number(cEnd[i]) });
  });
  const sChain = d.get('_struct_sheet_range.beg_auth_asym_id') ?? d.get('_struct_sheet_range.beg_label_asym_id') ?? [];
  const sBeg = d.get('_struct_sheet_range.beg_auth_seq_id') ?? d.get('_struct_sheet_range.beg_label_seq_id') ?? [];
  const sEnd = d.get('_struct_sheet_range.end_auth_seq_id') ?? d.get('_struct_sheet_range.end_label_seq_id') ?? [];
  sChain.forEach((c, i) => ranges.push({ kind: 'hebra', type: 'SHEET', chain: c, start: Number(sBeg[i]), end: Number(sEnd[i]) }));
  applySecondary(residues, ranges);
  const res = cleanUnknown(d.get('_refine.ls_d_res_high')?.[0]) ?? cleanUnknown(d.get('_reflns.d_resolution_high')?.[0]) ?? cleanUnknown(d.get('_em_3d_reconstruction.resolution')?.[0]);
  const declaresPrediction = d.has('_ma_qa_metric_global.metric_value') || d.has('_ma_model_list.model_type');
  const gp = cleanUnknown(d.get('_ma_qa_metric_global.metric_value')?.[0]);
  return {
    format: 'mmcif',
    id: cleanUnknown(d.get('_entry.id')?.[0]),
    title: cleanUnknown(d.get('_struct.title')?.[0]) ?? cleanUnknown(d.get('_ma_model_list.model_group_name')?.[0]),
    method: cleanUnknown(d.get('_exptl.method')?.[0]) ?? (declaresPrediction ? cleanUnknown(d.get('_ma_model_list.model_type')?.[0]) : null),
    resolution: res !== null && Number.isFinite(Number(res)) ? Number(res) : null,
    depositDate: cleanUnknown(d.get('_pdbx_database_status.recvd_initial_deposition_date')?.[0]),
    declaresPrediction,
    globalPlddt: gp !== null && Number.isFinite(Number(gp)) ? Number(gp) : null,
    license: cleanUnknown(d.get('_pdbx_data_usage.details')?.[0]) ?? null,
    atoms, residues, chains,
    ss: { fromFile: ranges.length > 0, ranges, helixRows, strandRows, otherRows, sheetRows: sChain.length },
    atomRecords: raw.length,
    models,
  };
}

/* ------------------------------------------------------------------ PDB (formato de columnas fijas) */

const MONTHS: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12' };

export function parsePdb(text: string): ProteinStructure {
  guardText(text);
  const lines = text.split(/\r?\n/);
  const raw: RawAtom[] = [];
  const ranges: SsRange[] = [];
  let models = 0, inFirst = true, id: string | null = null, depositDate: string | null = null, method: string | null = null, resolution: number | null = null;
  let helixRows = 0, sheetRows = 0;
  const title: string[] = [];
  let modres = new Set<string>();
  for (let li = 0; li < lines.length; li++) {
    const L = lines[li];
    const rec = L.slice(0, 6).trim();
    if (rec === 'MODEL') { models++; if (models > 1) inFirst = false; continue; }
    if (rec === 'ENDMDL') { inFirst = false; continue; }
    if (rec === 'HEADER') {
      const dd = /^(\d{2})-([A-Z]{3})-(\d{2})$/.exec(L.slice(50, 59).trim());
      if (dd && MONTHS[dd[2]]) { const yy = Number(dd[3]); depositDate = `${yy > 50 ? 19 : 20}${dd[3]}-${MONTHS[dd[2]]}-${dd[1]}`; }
      id = cleanUnknown(L.slice(62, 66));
      continue;
    }
    if (rec === 'TITLE') { title.push(L.slice(10, 80).trim()); continue; }
    if (rec === 'EXPDTA') { method = L.slice(10, 79).trim() || null; continue; }
    if (rec === 'REMARK' && L.slice(7, 10).trim() === '2') {
      const m = /RESOLUTION\.\s+([\d.]+)\s+ANGSTROMS/.exec(L);
      if (m) resolution = Number(m[1]);
      continue;
    }
    if (rec === 'MODRES') { modres = new Set([...modres, `${L.slice(16, 17)}|${L.slice(12, 15).trim()}|${Number(L.slice(18, 22))}`]); continue; }
    if (rec === 'HELIX') {
      helixRows++;
      ranges.push({ kind: 'helice', type: 'HELIX', chain: L.slice(19, 20), start: Number(L.slice(21, 25)), end: Number(L.slice(33, 37)) });
      continue;
    }
    if (rec === 'SHEET') {
      sheetRows++;
      ranges.push({ kind: 'hebra', type: 'SHEET', chain: L.slice(21, 22), start: Number(L.slice(22, 26)), end: Number(L.slice(33, 37)) });
      continue;
    }
    if (rec !== 'ATOM' && rec !== 'HETATM') continue;
    if (!inFirst) continue;
    if (raw.length >= STRUCTURE_LIMITS.maxAtoms) throw new StructureError(`El primer modelo tiene más de ${STRUCTURE_LIMITS.maxAtoms.toLocaleString('es-CO')} átomos: es demasiado grande para este laboratorio.`);
    if (L.length < 54) throw new StructureError(`El registro ${rec} de la línea ${li + 1} es demasiado corto (faltan coordenadas).`);
    const rx = num(L.slice(30, 38).trim(), 'x', li + 1), ry = num(L.slice(38, 46).trim(), 'y', li + 1), rz = num(L.slice(46, 54).trim(), 'z', li + 1);
    checkCoord(rx, li + 1); checkCoord(ry, li + 1); checkCoord(rz, li + 1);
    const nameField = L.slice(12, 16);
    const name = nameField.trim();
    let el = L.slice(76, 78).trim();
    if (!el) el = nameField[0] === ' ' || /\d/.test(nameField[0]) ? nameField.slice(1, 2) : nameField.slice(0, 2).trim();
    const resName = L.slice(17, 20).trim();
    const chain = L.slice(21, 22).trim() || ' ';
    const resSeq = Number(L.slice(22, 26));
    if (!Number.isFinite(resSeq)) throw new StructureError(`Número de residuo no válido en la línea ${li + 1}.`);
    const occT = L.slice(54, 60).trim(), bT = L.slice(60, 66).trim();
    raw.push({
      group: rec, serial: Number(L.slice(6, 11)) || raw.length + 1, name, element: ELEMENT_FIX(el.replace(/[^A-Za-z]/g, '') || 'X'),
      altloc: L.slice(16, 17).trim(), resName, chain, resSeq, iCode: L.slice(26, 27).trim(),
      x: rx, y: ry, z: rz, occupancy: occT ? Number(occT) : 1, b: bT ? Number(bT) : 0,
      polymer: rec === 'ATOM' || modres.has(`${chain}|${resName}|${resSeq}`),
    });
  }
  if (raw.length === 0) throw new StructureError('El archivo no tiene registros ATOM ni HETATM.');
  const { atoms, residues, chains } = build(raw);
  applySecondary(residues, ranges);
  const t = title.join(' ').replace(/\s+/g, ' ').trim() || null;
  return {
    format: 'pdb', id, title: t, method, resolution, depositDate,
    declaresPrediction: !!t && /ALPHAFOLD|PREDICTION|PREDICTED MODEL/i.test(t),
    globalPlddt: null, license: null, atoms, residues, chains,
    ss: { fromFile: ranges.length > 0, ranges, helixRows, strandRows: 0, otherRows: 0, sheetRows },
    atomRecords: raw.length, models: Math.max(1, models),
  };
}

/** Detecta el formato por el contenido (no por la extensión) y lee el archivo. */
export function detectFormat(text: string): 'mmcif' | 'pdb' {
  const head = text.slice(0, 200_000);
  if (/^data_/m.test(head) && /^_atom_site\./m.test(text)) return 'mmcif';
  if (/^(ATOM  |HETATM)/m.test(text)) return 'pdb';
  if (/^data_/m.test(head)) throw new StructureError('El archivo mmCIF no tiene la tabla _atom_site (coordenadas de átomos).');
  throw new StructureError('No se reconoce el formato: el archivo no parece PDB ni mmCIF.');
}

export function parseStructure(text: string): ProteinStructure {
  guardText(text);
  return detectFormat(text) === 'mmcif' ? parseMmcif(text) : parsePdb(text);
}

/* ------------------------------------------------------------------ consultas y mediciones */

export function findAtom(s: ProteinStructure, chain: string, resSeq: number, atom: string, iCode = ''): PAtom | null {
  for (const r of s.residues) {
    if (r.chain === chain && r.resSeq === resSeq && r.iCode === iCode) {
      for (const ai of r.atoms) if (s.atoms[ai].name === atom) return s.atoms[ai];
    }
  }
  return null;
}

export function distance(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

/** Distancia entre dos átomos de la estructura, redondeada a 0,001 Å. */
export function measureDistance(s: ProteinStructure, i: number, j: number): number {
  assertInRange('Átomo A', i, 0, s.atoms.length - 1);
  assertInRange('Átomo B', j, 0, s.atoms.length - 1);
  if (!Number.isInteger(i) || !Number.isInteger(j)) throw new RangeError('Los átomos se eligen por su número entero.');
  if (i === j) throw new RangeError('Elige dos átomos distintos: la distancia de un átomo a sí mismo es cero.');
  return roundToResolution(distance(s.atoms[i], s.atoms[j]), RESOLUTION.distance);
}

export type PairKind = 'mismo residuo' | 'misma cadena' | 'cadenas distintas' | 'con heterogrupo o agua';

/** Tipo de par y separación en la secuencia (según la numeración del archivo; null si no aplica). */
export function pairInfo(s: ProteinStructure, i: number, j: number): { kind: PairKind; separation: number | null } {
  const ra = s.residues[s.atoms[i].residue], rb = s.residues[s.atoms[j].residue];
  if (!ra.polymer || !rb.polymer) return { kind: 'con heterogrupo o agua', separation: null };
  if (ra.index === rb.index) return { kind: 'mismo residuo', separation: 0 };
  if (ra.chain !== rb.chain) return { kind: 'cadenas distintas', separation: null };
  return { kind: 'misma cadena', separation: Math.abs(ra.resSeq - rb.resSeq) };
}

/** Centroide de los Cα de los residuos estándar (registros ATOM) del primer modelo. */
export function caCentroid(s: ProteinStructure): { x: number; y: number; z: number; n: number } {
  let x = 0, y = 0, z = 0, n = 0;
  for (const r of s.residues) {
    if (r.kind !== 'estandar' || r.ca === null) continue;
    const a = s.atoms[r.ca];
    x += a.x; y += a.y; z += a.z; n++;
  }
  if (n === 0) throw new StructureError('La estructura no tiene átomos Cα de aminoácidos.');
  return { x: x / n, y: y / n, z: z / n, n };
}

/** Distancia del Cα de un residuo al centroide de los Cα (Å, 0,001 Å); null si el residuo no tiene Cα. */
export function distanceToCentroid(s: ProteinStructure, residue: number, centroid = caCentroid(s)): number | null {
  const r = s.residues[residue];
  if (!r || r.ca === null) return null;
  return roundToResolution(distance(s.atoms[r.ca], centroid), RESOLUTION.distance);
}

/** Fracción de residuos del polímero en hélice, hebra u otra conformación según el archivo. */
export function secondaryFractions(s: ProteinStructure, chain?: string): { helice: number; hebra: number; otra: number; n: number } {
  const rs = s.residues.filter((r) => r.polymer && (!chain || r.chain === chain));
  const n = rs.length || 1;
  const h = rs.filter((r) => r.ss === 'helice').length, e = rs.filter((r) => r.ss === 'hebra').length;
  return { helice: h / n, hebra: e / n, otra: (rs.length - h - e) / n, n: rs.length };
}

/** Heterogrupos (no agua), con indicación de si están dentro del polímero (residuos modificados como MSE o el cromóforo CRO). */
export function ligands(s: ProteinStructure): { residue: number; chain: string; resName: string; resSeq: number; atoms: number; inPolymer: boolean }[] {
  return s.residues.filter((r) => r.kind === 'hetero').map((r) => ({ residue: r.index, chain: r.chain, resName: r.resName, resSeq: r.resSeq, atoms: r.atoms.length, inPolymer: r.polymer }));
}

/** Traza de Cα por cadena (residuos del polímero), cortada donde dos Cα consecutivos están a más de 4,2 Å (residuos faltantes). */
export function caTrace(s: ProteinStructure): { chain: string; segments: number[][] }[] {
  return s.chains.map((c) => {
    const segs: number[][] = [];
    let cur: number[] = [];
    let prev: PAtom | null = null;
    for (const ri of c.residues) {
      const r = s.residues[ri];
      if (!r.polymer || r.ca === null) continue;
      const a = s.atoms[r.ca];
      if (prev && distance(prev, a) > 4.2) { if (cur.length) segs.push(cur); cur = []; }
      cur.push(r.ca);
      prev = a;
    }
    if (cur.length) segs.push(cur);
    return { chain: c.id, segments: segs };
  }).filter((t) => t.segments.length > 0);
}

/* ------------------------------------------------------------------ confianza pLDDT (AlphaFold) */

export type PlddtBand = 'muyAlta' | 'alta' | 'baja' | 'muyBaja';

/**
 * Bandas de AlphaFold DB. Los bordes se comprobaron con las categorías del archivo oficial de confianza de AF-Q04671-F1
 * (2026-10-18): pLDDT = 90,00 es «muy alta» y 70,00 es «alta». Colores: los de la leyenda de AlphaFold DB.
 */
export const PLDDT_BANDS: { band: PlddtBand; label: string; range: string; min: number; color: string; meaning: string }[] = [
  { band: 'muyAlta', label: 'Muy alta', range: 'pLDDT ≥ 90', min: 90, color: '#0053D6', meaning: 'posición de la cadena principal y de muchas cadenas laterales probablemente bien predicha' },
  { band: 'alta', label: 'Alta', range: '70 ≤ pLDDT < 90', min: 70, color: '#65CBF3', meaning: 'cadena principal probablemente bien predicha' },
  { band: 'baja', label: 'Baja', range: '50 ≤ pLDDT < 70', min: 50, color: '#FFDB13', meaning: 'poca confianza: interpretar con cautela' },
  { band: 'muyBaja', label: 'Muy baja', range: 'pLDDT < 50', min: -Infinity, color: '#FF7D45', meaning: 'puede ser una región desordenada o que no se predijo; no interpretar su forma' },
];

export function plddtBand(p: number): PlddtBand {
  assertInRange('pLDDT', p, 0, 100);
  return p >= 90 ? 'muyAlta' : p >= 70 ? 'alta' : p >= 50 ? 'baja' : 'muyBaja';
}

/** pLDDT por residuo (columna B del Cα), media y fracción de residuos en cada banda. */
export function plddtSummary(s: ProteinStructure): { values: { residue: number; plddt: number; band: PlddtBand }[]; mean: number; counts: Record<PlddtBand, number>; fractions: Record<PlddtBand, number> } {
  const values = s.residues.filter((r) => r.kind === 'estandar' && r.ca !== null).map((r) => {
    const p = s.atoms[r.ca!].b;
    return { residue: r.index, plddt: p, band: plddtBand(p) };
  });
  if (values.length === 0) throw new StructureError('No hay átomos Cα con valores de confianza.');
  const counts: Record<PlddtBand, number> = { muyAlta: 0, alta: 0, baja: 0, muyBaja: 0 };
  for (const v of values) counts[v.band]++;
  const n = values.length;
  const fr = (k: PlddtBand) => Math.round((counts[k] / n) * 1000) / 1000;
  return { values, mean: values.reduce((t, v) => t + v.plddt, 0) / n, counts, fractions: { muyAlta: fr('muyAlta'), alta: fr('alta'), baja: fr('baja'), muyBaja: fr('muyBaja') } };
}

/* ------------------------------------------------------------------ propiedades de los aminoácidos */

export type AaClass = 'no polar' | 'polar sin carga' | 'ácido (carga negativa)' | 'básico (carga positiva)';

/** Índice de hidropatía de Kyte y Doolittle (1982). Positivo = hidrofóbico. Carga de la cadena lateral a pH ≈ 7 (aproximada). */
export const AMINO_ACIDS: Record<string, { name: string; one: string; cls: AaClass; charge: number; hydropathy: number }> = {
  ALA: { name: 'Alanina', one: 'A', cls: 'no polar', charge: 0, hydropathy: 1.8 },
  ARG: { name: 'Arginina', one: 'R', cls: 'básico (carga positiva)', charge: 1, hydropathy: -4.5 },
  ASN: { name: 'Asparagina', one: 'N', cls: 'polar sin carga', charge: 0, hydropathy: -3.5 },
  ASP: { name: 'Ácido aspártico', one: 'D', cls: 'ácido (carga negativa)', charge: -1, hydropathy: -3.5 },
  CYS: { name: 'Cisteína', one: 'C', cls: 'polar sin carga', charge: 0, hydropathy: 2.5 },
  GLN: { name: 'Glutamina', one: 'Q', cls: 'polar sin carga', charge: 0, hydropathy: -3.5 },
  GLU: { name: 'Ácido glutámico', one: 'E', cls: 'ácido (carga negativa)', charge: -1, hydropathy: -3.5 },
  GLY: { name: 'Glicina', one: 'G', cls: 'no polar', charge: 0, hydropathy: -0.4 },
  HIS: { name: 'Histidina', one: 'H', cls: 'básico (carga positiva)', charge: 0, hydropathy: -3.2 },
  ILE: { name: 'Isoleucina', one: 'I', cls: 'no polar', charge: 0, hydropathy: 4.5 },
  LEU: { name: 'Leucina', one: 'L', cls: 'no polar', charge: 0, hydropathy: 3.8 },
  LYS: { name: 'Lisina', one: 'K', cls: 'básico (carga positiva)', charge: 1, hydropathy: -3.9 },
  MET: { name: 'Metionina', one: 'M', cls: 'no polar', charge: 0, hydropathy: 1.9 },
  PHE: { name: 'Fenilalanina', one: 'F', cls: 'no polar', charge: 0, hydropathy: 2.8 },
  PRO: { name: 'Prolina', one: 'P', cls: 'no polar', charge: 0, hydropathy: -1.6 },
  SER: { name: 'Serina', one: 'S', cls: 'polar sin carga', charge: 0, hydropathy: -0.8 },
  THR: { name: 'Treonina', one: 'T', cls: 'polar sin carga', charge: 0, hydropathy: -0.7 },
  TRP: { name: 'Triptófano', one: 'W', cls: 'no polar', charge: 0, hydropathy: -0.9 },
  TYR: { name: 'Tirosina', one: 'Y', cls: 'polar sin carga', charge: 0, hydropathy: -1.3 },
  VAL: { name: 'Valina', one: 'V', cls: 'no polar', charge: 0, hydropathy: 4.2 },
};

/** Heterogrupos frecuentes del conjunto curado (códigos del diccionario de componentes químicos del PDB). */
export const HETERO_NAMES: Record<string, string> = {
  HOH: 'agua', HEM: 'grupo hemo (protoporfirina IX con hierro)', PO4: 'ion fosfato', CRO: 'cromóforo de la GFP (según el archivo, reemplaza a los residuos 65–67 de la cadena)',
  MSE: 'selenometionina (metionina con selenio, residuo modificado)',
};

export const AA_CLASSES: AaClass[] = ['no polar', 'polar sin carga', 'ácido (carga negativa)', 'básico (carga positiva)'];

/** Nota sobre la histidina: su cadena lateral (pKa ≈ 6) está en buena parte sin carga a pH 7; se clasifica como básica. */
export const HIS_NOTE = 'La histidina se clasifica como básica, pero a pH 7 su cadena lateral está en buena parte sin carga (pKa cercano a 6).';

/* ------------------------------------------------------------------ servicios: validación pura de consultas y respuestas */

/** Valida un código PDB de 4 caracteres (p. ej. «4HHB»). Lanza RangeError con un mensaje claro si no es válido. */
export function parsePdbId(input: string): string {
  const t = input.trim().toUpperCase();
  if (t === '') throw new RangeError('Escribe un código PDB de 4 caracteres (p. ej. 4HHB).');
  if (!/^[1-9][A-Z0-9]{3}$/.test(t)) throw new RangeError('Un código PDB tiene 4 caracteres: un dígito del 1 al 9 y tres letras o dígitos (p. ej. 1DP0).');
  return t;
}

/** Valida una accesión de UniProtKB (formato oficial de 6 o 10 caracteres, p. ej. P69905 o A0A024R161). */
export function parseUniProt(input: string): string {
  const t = input.trim().toUpperCase();
  if (t === '') throw new RangeError('Escribe una accesión de UniProt (p. ej. P09848).');
  if (!/^([OPQ][0-9][A-Z0-9]{3}[0-9]|[A-NR-Z][0-9]([A-Z][A-Z0-9]{2}[0-9]){1,2})$/.test(t)) throw new RangeError('Esa no es una accesión de UniProt válida (6 o 10 caracteres, p. ej. P09848 o Q04671).');
  return t;
}

export const rcsbFileUrl = (id: string) => `https://files.rcsb.org/download/${parsePdbId(id)}.cif`;
export const rcsbEntryUrl = (id: string) => `https://data.rcsb.org/rest/v1/core/entry/${parsePdbId(id)}`;
export const rcsbEntityUrl = (id: string, entity: string) => `https://data.rcsb.org/rest/v1/core/polymer_entity/${parsePdbId(id)}/${encodeURIComponent(entity)}`;
export const rcsbPageUrl = (id: string) => `https://www.rcsb.org/structure/${parsePdbId(id)}`;
export const alphafoldApiUrl = (acc: string) => `https://alphafold.ebi.ac.uk/api/prediction/${parseUniProt(acc)}`;
export const alphafoldPageUrl = (acc: string) => `https://alphafold.ebi.ac.uk/entry/${parseUniProt(acc)}`;

const AF_FILES = 'https://alphafold.ebi.ac.uk/files/';

export interface RcsbEntryMeta {
  id: string; title: string | null; method: string | null; resolution: number | null; depositDate: string | null; releaseDate: string | null;
  revisionDate: string | null; atomCount: number | null; entityIds: string[]; ligands: string[];
}

/** Extrae y valida los metadatos de la respuesta de data.rcsb.org/rest/v1/core/entry/<ID>. */
export function parseRcsbEntry(json: unknown, expectedId: string): RcsbEntryMeta {
  const o = json as Record<string, any>;
  if (!o || typeof o !== 'object') throw new StructureError('Respuesta de RCSB PDB no válida.');
  const id = String(o.rcsb_id ?? o.entry?.id ?? '').toUpperCase();
  if (id !== expectedId.toUpperCase()) throw new StructureError(`RCSB PDB respondió con la entrada «${id || '—'}» y no con ${expectedId}.`);
  const day = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null);
  const res = o.rcsb_entry_info?.resolution_combined?.[0];
  const atoms = o.rcsb_entry_info?.deposited_atom_count;
  return {
    id,
    title: typeof o.struct?.title === 'string' ? o.struct.title : null,
    method: typeof o.exptl?.[0]?.method === 'string' ? o.exptl[0].method : null,
    resolution: typeof res === 'number' && Number.isFinite(res) ? res : null,
    depositDate: day(o.rcsb_accession_info?.deposit_date),
    releaseDate: day(o.rcsb_accession_info?.initial_release_date),
    revisionDate: day(o.rcsb_accession_info?.revision_date),
    atomCount: typeof atoms === 'number' && Number.isFinite(atoms) ? atoms : null,
    entityIds: Array.isArray(o.rcsb_entry_container_identifiers?.polymer_entity_ids) ? o.rcsb_entry_container_identifiers.polymer_entity_ids.map(String).slice(0, 12) : [],
    ligands: Array.isArray(o.rcsb_entry_info?.nonpolymer_bound_components) ? o.rcsb_entry_info.nonpolymer_bound_components.map(String) : [],
  };
}

/** Extrae descripción, cadenas, organismos y UniProt de data.rcsb.org/rest/v1/core/polymer_entity/<ID>/<n>. */
export function parseRcsbEntity(json: unknown): { description: string | null; chains: string[]; uniprot: string[]; organism: string[] } {
  const o = json as Record<string, any>;
  const ids = o?.rcsb_polymer_entity_container_identifiers ?? {};
  const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  return {
    description: typeof o?.rcsb_polymer_entity?.pdbx_description === 'string' ? o.rcsb_polymer_entity.pdbx_description : null,
    chains: strs(ids.auth_asym_ids), uniprot: strs(ids.uniprot_ids),
    organism: Array.isArray(o?.rcsb_entity_source_organism) ? o.rcsb_entity_source_organism.map((x: any) => x?.scientific_name).filter((x: unknown) => typeof x === 'string') : [],
  };
}

export interface AlphaFoldRecord {
  entryId: string; uniprot: string; cifUrl: string; paeUrl: string | null; version: number | null; toolUsed: string | null;
  modelCreatedDate: string | null; globalMetricValue: number | null; description: string | null; gene: string | null; organism: string | null;
  fractions: { veryHigh: number | null; confident: number | null; low: number | null; veryLow: number | null };
}

/**
 * Elige el modelo principal (AF-<acc>-F1) de la respuesta de alphafold.ebi.ac.uk/api/prediction/<acc> y valida que las
 * URL de los archivos sean de alphafold.ebi.ac.uk/files/ (no se siguen URL de otros dominios).
 */
export function parseAlphaFoldPrediction(json: unknown, acc: string): AlphaFoldRecord {
  if (!Array.isArray(json) || json.length === 0) throw new StructureError('AlphaFold DB no devolvió modelos para esa accesión.');
  const want = `AF-${acc}-F1`;
  const rec = (json.find((r: any) => r?.modelEntityId === want || r?.entryId === want) ?? json.find((r: any) => r?.uniprotAccession === acc)) as Record<string, any> | undefined;
  if (!rec) throw new StructureError(`La respuesta de AlphaFold DB no trae el modelo ${want}.`);
  const cif = String(rec.cifUrl ?? '');
  if (!cif.startsWith(AF_FILES) || !cif.endsWith('.cif')) throw new StructureError('La URL del modelo de AlphaFold no es de alphafold.ebi.ac.uk/files/.');
  const pae = typeof rec.paeDocUrl === 'string' && rec.paeDocUrl.startsWith(AF_FILES) ? rec.paeDocUrl : null;
  const n = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const s = (v: unknown) => (typeof v === 'string' ? v : null);
  return {
    entryId: String(rec.modelEntityId ?? rec.entryId ?? want), uniprot: acc, cifUrl: cif, paeUrl: pae, version: n(rec.latestVersion),
    toolUsed: s(rec.toolUsed), modelCreatedDate: s(rec.modelCreatedDate)?.slice(0, 10) ?? null, globalMetricValue: n(rec.globalMetricValue),
    description: s(rec.uniprotDescription), gene: s(rec.gene), organism: s(rec.organismScientificName),
    fractions: { veryHigh: n(rec.fractionPlddtVeryHigh), confident: n(rec.fractionPlddtConfident), low: n(rec.fractionPlddtLow), veryLow: n(rec.fractionPlddtVeryLow) },
  };
}

/** Lee la matriz PAE (Å) del archivo oficial de AlphaFold DB y comprueba que sea cuadrada y finita. */
export function parsePae(json: unknown): { matrix: number[][]; max: number | null } {
  const doc = (Array.isArray(json) ? json[0] : json) as Record<string, any>;
  const m = doc?.predicted_aligned_error;
  if (!Array.isArray(m) || m.length === 0) throw new StructureError('El archivo PAE no tiene la matriz predicted_aligned_error.');
  for (const row of m) {
    if (!Array.isArray(row) || row.length !== m.length) throw new StructureError('La matriz PAE no es cuadrada.');
    for (const v of row) if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) throw new StructureError('La matriz PAE tiene valores no válidos.');
  }
  return { matrix: m, max: typeof doc.max_predicted_aligned_error === 'number' ? doc.max_predicted_aligned_error : null };
}

/** Resumen de la PAE: promedio de cada bloque de residuos (bloques de ⌈n / nBloques⌉), redondeado a 0,1 Å. */
export function paeBlocks(matrix: number[][], nBlocks: number): { blockSize: number; blocks: number[][] } {
  assertInRange('Número de bloques', nBlocks, 1, 200);
  const n = matrix.length;
  const size = Math.ceil(n / nBlocks);
  const k = Math.ceil(n / size);
  const blocks: number[][] = [];
  for (let bi = 0; bi < k; bi++) {
    const row: number[] = [];
    for (let bj = 0; bj < k; bj++) {
      let s = 0, c = 0;
      for (let i = bi * size; i < Math.min(n, (bi + 1) * size); i++) for (let j = bj * size; j < Math.min(n, (bj + 1) * size); j++) { s += matrix[i][j]; c++; }
      row.push(Math.round((s / c) * 10) / 10);
    }
    blocks.push(row);
  }
  return { blockSize: size, blocks };
}

/* ------------------------------------------------------------------ descripción textual */

/** Descripción de la escena para lectores de pantalla (sección 11). No revela distancias: las obtiene el estudiante al medir. */
export function describeStructure(s: ProteinStructure, name: string, origin: string): string {
  const chains = s.chains.map((c) => `cadena ${c.id}: ${c.polymer} residuos en el polímero${c.heteroNames.length ? `, heterogrupos ${c.heteroNames.join(', ')}` : ''}${c.water ? `, ${c.water} aguas` : ''}`).join('; ');
  const f = secondaryFractions(s);
  const ss = s.ss.fromFile
    ? `Según el archivo, ${Math.round(f.helice * 100)} % de los residuos está en hélice α y ${Math.round(f.hebra * 100)} % en hebras β.`
    : 'El archivo no declara la estructura secundaria.';
  return `${name} (${origin}): ${s.atoms.length} átomos en ${s.chains.length} cadena${s.chains.length === 1 ? '' : 's'} (${chains}). ${ss}`;
}

/* ------------------------------------------------------------------ ficha del modelo */

export const proteinModelSpec: ModelSpec = {
  name: 'Lectura de estructuras 3D de proteínas (PDBx/mmCIF y PDB), distancias y confianza pLDDT',
  inputs: [
    { symbol: 'estructura', name: 'Archivo de coordenadas: entrada del PDB (experimental) o modelo de AlphaFold DB (predicción)', unit: '—', initial: 'insulina humana, PDB 3I40' },
    { symbol: 'A, B', name: 'Átomos para medir una distancia (cadena, residuo y nombre del átomo)', unit: '—', initial: 'A/CYS6/SG y A/CYS11/SG' },
    { symbol: 'residuo', name: 'Residuo para analizar (propiedades, estructura secundaria, factor B o pLDDT)', unit: '—', initial: 'A/GLY1' },
    { symbol: 'archivo', name: 'Archivo local PDB o mmCIF (texto)', unit: 'MB', range: [0, STRUCTURE_LIMITS.maxFileBytes / 1e6], initial: '—' },
  ],
  outputs: [
    { symbol: 'd', name: 'Distancia entre núcleos (redondeada a 0,001 Å)', unit: 'Å' },
    { symbol: 'Δsec', name: 'Separación en la secuencia entre los residuos de A y B (numeración del archivo)', unit: 'residuos' },
    { symbol: 'r_c', name: 'Distancia del Cα de un residuo al centroide de los Cα', unit: 'Å' },
    { symbol: 'B', name: 'Factor de desplazamiento atómico (estructuras experimentales)', unit: 'Å²' },
    { symbol: 'pLDDT', name: 'Confianza local de AlphaFold (0–100) y su banda', unit: '—' },
    { symbol: 'N', name: 'Cadenas, residuos (estándar, heterogrupos, agua) y átomos del primer modelo', unit: '—' },
  ],
  equations: [
    'd = √[(x_B − x_A)² + (y_B − y_A)² + (z_B − z_A)²]',
    'r_c = |r_Cα − r̄|, con r̄ = (1/N) Σ r_Cα (Cα de los residuos estándar)',
    'Bandas pLDDT (AlphaFold DB): muy alta ≥ 90; alta 70–90; baja 50–70; muy baja < 50',
    'Fracción en hélice = residuos del polímero dentro de un intervalo HELX del archivo / residuos del polímero',
  ],
  initialConditions: ['Insulina humana (PDB 3I40, difracción de rayos X, 1,85 Å), átomos A/CYS6/SG y A/CYS11/SG.'],
  assumptions: [
    'Las coordenadas son las del archivo: medidas por un experimento (PDB) o predichas por AlphaFold; el laboratorio no las modifica ni las «mejora».',
    'Se usa solo el primer modelo; cada átomo con posiciones alternativas se cuenta una vez con la posición de mayor ocupación (la primera si empatan), como Biopython.',
    'La cadena y el número de residuo son los del autor (auth_asym_id, auth_seq_id); la estructura secundaria es la declarada en el archivo.',
    'En los modelos de AlphaFold la columna B guarda el pLDDT (igual para todos los átomos de un residuo); en las estructuras experimentales guarda el factor B.',
  ],
  limits: [
    'Una predicción no es una medición: el pLDDT estima la confianza local, no el error real, y no informa sobre la posición relativa de dominios (para eso está la PAE).',
    'AlphaFold predice una sola cadena sin ligandos, iones, modificaciones ni compañeros de complejo, y una sola conformación.',
    'Una estructura experimental de alta resolución también tiene límites: es un promedio en el cristal (o en la muestra), puede faltarle parte de la cadena y las regiones con factor B alto son móviles.',
    `El lector acepta texto PDB o mmCIF de hasta ${(STRUCTURE_LIMITS.maxChars / 1e6).toLocaleString('es-CO')} millones de caracteres y ${STRUCTURE_LIMITS.maxAtoms.toLocaleString('es-CO')} átomos en el primer modelo; no lee BinaryCIF ni archivos comprimidos.`,
  ],
  testCases: [
    'Conteos de cadenas, residuos (estándar, heterogrupos, agua) y átomos de 3I40, 2HHB, 2LZM, 1EMA y AF-Q04671-F1 iguales a los de Biopython 1.85 (tests/fixtures/biopython-proteinas.json).',
    'Distancias entre átomos elegidos (puentes disulfuro de la insulina, His proximal–hierro del hemo, extremos de cadena) iguales a las de Biopython con tolerancia de 1 × 10⁻³ Å.',
    'Fracciones de residuos por banda de pLDDT del modelo AF-Q04671-F1 iguales a las que publica la API de AlphaFold DB (0,290; 0,420; 0,086; 0,204).',
    'Bordes de las bandas: 90 → muy alta, 89,99 → alta, 70 → alta, 50 → baja, 49,99 → muy baja; fuera de 0–100 se rechaza.',
    'El lector rechaza texto vacío, binario, sin _atom_site, con comillas sin cerrar, con columnas incompletas o con coordenadas no numéricas o fuera de rango.',
    'Cada archivo incluido coincide con su SHA-256 y tamaño registrados en src/data/proteins.ts.',
  ],
};
