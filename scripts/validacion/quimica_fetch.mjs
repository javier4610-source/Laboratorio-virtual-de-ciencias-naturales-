#!/usr/bin/env node
/**
 * Descarga reproducible de la biblioteca de moléculas 3D del kit de química (src/chem).
 *
 * Para cada entrada de LISTA:
 *   1) nombre (inglés) → CID:  PUG REST /compound/name/<nombre>/cids/TXT  (se toma el primer CID; NO se inventan CID)
 *   2) propiedades:            /compound/cid/<CID>/property/MolecularFormula,SMILES,IUPACName,Title/CSV
 *      y se verifica que la fórmula de Hill coincide con la esperada (si no, el script se detiene).
 *   3) confórmero 3D:          /compound/cid/<CID>/SDF?record_type=3d  (texto SIN MODIFICAR y su SHA-256)
 * Las especies sin confórmero 3D (respuesta 404) se registran en MISSING_3D en lugar de dibujarse a mano.
 * Salida: src/data/quimica/molecules3d.ts (generado; no editar a mano).
 *
 * Uso: node scripts/validacion/quimica_fetch.mjs            (respeta ≤ 5 solicitudes/s, política de PubChem)
 * Para añadir moléculas: agrega una línea a LISTA y vuelve a ejecutar.
 */
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';

const REST = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
// [id, nombre en español, nombre de búsqueda en inglés, fórmula de Hill esperada, categoría]
const LISTA = [
  ['agua', 'Agua', 'water', 'H2O', 'inorganica'],
  ['oxigeno', 'Oxígeno (dioxígeno)', 'oxygen', 'O2', 'inorganica'],
  ['hidrogeno', 'Hidrógeno (dihidrógeno)', 'hydrogen', 'H2', 'inorganica'],
  ['nitrogeno', 'Nitrógeno (dinitrógeno)', 'nitrogen', 'N2', 'inorganica'],
  ['cloro', 'Cloro (dicloro)', 'chlorine', 'Cl2', 'inorganica'],
  ['hcl', 'Cloruro de hidrógeno', 'hydrogen chloride', 'ClH', 'inorganica'],
  ['hf', 'Fluoruro de hidrógeno', 'hydrogen fluoride', 'FH', 'inorganica'],
  ['hbr', 'Bromuro de hidrógeno', 'hydrogen bromide', 'BrH', 'inorganica'],
  ['hi', 'Yoduro de hidrógeno', 'hydrogen iodide', 'HI', 'inorganica'],
  ['h2s', 'Sulfuro de hidrógeno', 'hydrogen sulfide', 'H2S', 'inorganica'],
  ['amoniaco', 'Amoníaco (azano)', 'ammonia', 'H3N', 'inorganica'],
  ['co', 'Monóxido de carbono', 'carbon monoxide', 'CO', 'inorganica'],
  ['co2', 'Dióxido de carbono', 'carbon dioxide', 'CO2', 'inorganica'],
  ['so2', 'Dióxido de azufre', 'sulfur dioxide', 'O2S', 'inorganica'],
  ['so3', 'Trióxido de azufre', 'sulfur trioxide', 'O3S', 'inorganica'],
  ['no', 'Monóxido de nitrógeno', 'nitric oxide', 'NO', 'inorganica'],
  ['no2', 'Dióxido de nitrógeno', 'nitrogen dioxide', 'NO2', 'inorganica'],
  ['n2o', 'Óxido de dinitrógeno', 'nitrous oxide', 'N2O', 'inorganica'],
  ['n2o3', 'Trióxido de dinitrógeno', 'dinitrogen trioxide', 'N2O3', 'inorganica'],
  ['n2o5', 'Pentaóxido de dinitrógeno', 'dinitrogen pentoxide', 'N2O5', 'inorganica'],
  ['h2o2', 'Peróxido de hidrógeno', 'hydrogen peroxide', 'H2O2', 'inorganica'],
  ['hno3', 'Ácido nítrico', 'nitric acid', 'HNO3', 'inorganica'],
  ['hno2', 'Ácido nitroso', 'nitrous acid', 'HNO2', 'inorganica'],
  ['h2so4', 'Ácido sulfúrico', 'sulfuric acid', 'H2O4S', 'inorganica'],
  ['h2so3', 'Ácido sulfuroso', 'sulfurous acid', 'H2O3S', 'inorganica'],
  ['h3po4', 'Ácido fosfórico', 'phosphoric acid', 'H3O4P', 'inorganica'],
  ['h2co3', 'Ácido carbónico', 'carbonic acid', 'CH2O3', 'inorganica'],
  ['hclo', 'Ácido hipocloroso', 'hypochlorous acid', 'ClHO', 'inorganica'],
  ['hclo2', 'Ácido cloroso', 'chlorous acid', 'ClHO2', 'inorganica'],
  ['hclo3', 'Ácido clórico', 'chloric acid', 'ClHO3', 'inorganica'],
  ['hclo4', 'Ácido perclórico', 'perchloric acid', 'ClHO4', 'inorganica'],
  ['cl2o', 'Óxido de dicloro', 'dichlorine monoxide', 'Cl2O', 'inorganica'],
  ['cl2o7', 'Heptaóxido de dicloro', 'dichlorine heptoxide', 'Cl2O7', 'inorganica'],
  ['p4o10', 'Decaóxido de tetrafósforo', 'tetraphosphorus decaoxide', 'O10P4', 'inorganica'],
  ['p4o6', 'Hexaóxido de tetrafósforo', 'tetraphosphorus hexaoxide', 'O6P4', 'inorganica'],
  ['metano', 'Metano', 'methane', 'CH4', 'organica'],
  ['etano', 'Etano', 'ethane', 'C2H6', 'organica'],
  ['propano', 'Propano', 'propane', 'C3H8', 'organica'],
  ['butano', 'Butano', 'butane', 'C4H10', 'organica'],
  ['eteno', 'Eteno (etileno)', 'ethylene', 'C2H4', 'organica'],
  ['etino', 'Etino (acetileno)', 'acetylene', 'C2H2', 'organica'],
  ['benceno', 'Benceno', 'benzene', 'C6H6', 'organica'],
  ['metanol', 'Metanol', 'methanol', 'CH4O', 'organica'],
  ['etanol', 'Etanol', 'ethanol', 'C2H6O', 'organica'],
  ['glucosa', 'Glucosa (D-glucosa)', 'D-glucose', 'C6H12O6', 'organica'],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function get(url) {
  const wait = Math.max(0, last + 250 - Date.now());
  if (wait) await sleep(wait);
  last = Date.now();
  for (let i = 0; i < 3; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': 'laboratorio-virtual-ciencias (scripts/validacion/quimica_fetch.mjs)' } });
    if (res.status === 503 || res.status === 429) { await sleep(2000 * (i + 1)); continue; }
    return { status: res.status, text: await res.text() };
  }
  throw new Error(`PubChem no respondió: ${url}`);
}
function parseCsvLine(line) {
  const out = []; let cur = ''; let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ',') { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur); return out;
}

const fecha = new Date().toISOString().slice(0, 10);
const found = []; const missing = [];
for (const [id, nombre, query, formula, categoria] of LISTA) {
  const c = await get(`${REST}/compound/name/${encodeURIComponent(query)}/cids/TXT`);
  if (c.status !== 200) throw new Error(`${id}: sin CID para «${query}» (${c.status})`);
  const cid = Number(c.text.trim().split(/\s+/)[0]);
  const p = await get(`${REST}/compound/cid/${cid}/property/MolecularFormula,SMILES,IUPACName,Title/CSV`);
  const [, row] = p.text.trim().split('\n');
  const [, mf, smiles, iupac, title] = parseCsvLine(row);
  if (mf !== formula) throw new Error(`${id}: la fórmula de PubChem (${mf}) no coincide con la esperada (${formula}) para el CID ${cid}`);
  const url = `${REST}/compound/cid/${cid}/SDF?record_type=3d`;
  const s = await get(url);
  if (s.status === 404) { missing.push({ id, nombre, cid, formula, smiles, iupac, title, query }); console.log(`sin 3D   ${id} CID ${cid}`); continue; }
  if (s.status !== 200) throw new Error(`${id}: SDF ${s.status}`);
  const sha256 = createHash('sha256').update(s.text).digest('hex');
  found.push({ id, nombre, nombreIupac: iupac, formula: mf, cid, smiles, title, query, categoria, url, fecha, sha256, sdf: s.text });
  console.log(`ok       ${id} CID ${cid} ${mf} ${sha256.slice(0, 12)}`);
}

const header = `/**
 * Biblioteca de confórmeros 3D de PubChem (PubChem3D) para el kit de química (src/chem).
 * GENERADO por scripts/validacion/quimica_fetch.mjs el ${fecha}; no editar a mano (vuelve a ejecutar el script).
 *   nombre → CID: ${REST}/compound/name/<nombre>/cids/TXT (primer CID); fórmula verificada con /property/MolecularFormula
 *   SDF 3D:       ${REST}/compound/cid/<CID>/SDF?record_type=3d (texto sin modificar; sha256 del texto descargado)
 */
`;
const ts = `${header}
export interface PubChemConformerRecord {
  id: string; nombre: string; nombreIupac: string; formula: string; cid: number; smiles: string; title: string;
  query: string; categoria: 'inorganica' | 'organica'; url: string; fecha: string; sha256: string; sdf: string;
}
export interface PubChemMissing3D { id: string; nombre: string; cid: number; formula: string; smiles: string; iupac: string; title: string; query: string }

export const PUBCHEM_RECORDS: PubChemConformerRecord[] = ${JSON.stringify(found, null, 1)};

/** Especies buscadas que NO tienen confórmero 3D en PubChem (respuesta 404 el ${fecha}). */
export const PUBCHEM_MISSING_3D: PubChemMissing3D[] = ${JSON.stringify(missing, null, 1)};
`;
writeFileSync(new URL('../../src/data/quimica/molecules3d.ts', import.meta.url), ts);
console.log(`\n${found.length} confórmeros, ${missing.length} sin 3D → src/data/quimica/molecules3d.ts`);
