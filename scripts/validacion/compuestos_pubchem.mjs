#!/usr/bin/env node
/**
 * Registro en PubChem de TODOS los compuestos que puede generar el «Taller de formación de compuestos»
 * (src/models/compoundForge.ts). Datos reales; no se inventan CID.
 *
 * 1. Enumera el conjunto finito de combinaciones válidas del taller (enumerateForgeResults) y reúne los compuestos que
 *    aparecen en sus ecuaciones (productos, agua y reactivos compuestos).
 * 2. Para cada compuesto consulta PubChem PUG REST:
 *    a) por NOMBRE (nombres en inglés que genera el motor: común, Stock, tradicional y estequiométrico, en ese orden):
 *       /compound/name/<nombre>/property/MolecularFormula,Title/JSON → se acepta el primer CID cuya fórmula molecular
 *       es igual a la de Hill del compuesto o un múltiplo entero (P₄O₁₀ ↔ P₂O₅);
 *    b) si ningún nombre da un CID con esa fórmula, por FÓRMULA exacta:
 *       /compound/fastformula/<Hill>/property/MolecularFormula,Title,Charge/JSON → CID con la misma fórmula y carga 0;
 *       de los 10 de CID más bajo se descargan el nombre IUPAC (/property/IUPACName,Title) y los sinónimos
 *       (/synonyms/JSON) y se aplica la REGLA de src/models/pubchemNameMatch.ts (desde la v2.6.x):
 *         · si un título, nombre IUPAC o sinónimo coincide en forma canónica con un nombre del motor → «registrado»
 *           (via: 'formula-sinonimo', con el sinónimo y el nombre del motor que coinciden);
 *         · si el título o el nombre IUPAC indican otra clase de sustancia (hidróxido, peróxido, hidrato, hidruro que
 *           el compuesto no es) → ese CID se DESCARTA (se anota en «descartados» con el motivo);
 *         · si no, el CID más bajo no descartado queda como «fórmula registrada sin coincidencia de nombre» (via: 'formula').
 *    Si nada coincide (o todos los CID se descartan), el compuesto queda como «fórmula formal» (cid: null).
 * 3. Guarda src/data/quimica/compuestos-pubchem.json con la fecha, la fuente, el método, los totales y cada resultado.
 *
 * Uso (desde la raíz del repositorio): NODE_USE_ENV_PROXY=1 node scripts/validacion/compuestos_pubchem.mjs
 * Requiere esbuild (dependencia de Vite) para cargar el modelo TypeScript.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = fileURLToPath(new URL('../..', import.meta.url));
const outDir = mkdtempSync(join(tmpdir(), 'taller-'));
const bundle = join(outDir, 'forge.mjs');
await build({
  stdin: { contents: "export * from './src/models/compoundForge.ts'; export { hillFormula } from './src/models/inorganicNomenclature.ts'; export * from './src/models/pubchemNameMatch.ts';", resolveDir: root, loader: 'ts' },
  bundle: true, format: 'esm', platform: 'node', outfile: bundle, logLevel: 'warning',
});
const m = await import(pathToFileURL(bundle).href);
const results = m.enumerateForgeResults();
const compounds = m.forgeCompounds(results);
console.log(`${results.length} combinaciones válidas · ${compounds.length} compuestos distintos`);

const REST = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function get(url) {
  const wait = Math.max(0, last + 230 - Date.now());
  if (wait) await sleep(wait);
  last = Date.now();
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'laboratorio-virtual-ciencias (scripts/validacion/compuestos_pubchem.mjs)' } });
      if (res.status === 503 || res.status === 429 || res.status === 500) { await sleep(2500 * (i + 1)); continue; }
      return { status: res.status, text: await res.text() };
    } catch (e) { await sleep(2000 * (i + 1)); if (i === 4) throw e; }
  }
  return { status: 599, text: '' };
}
const props = (text) => { try { return JSON.parse(text).PropertyTable.Properties ?? []; } catch { return []; } };
const parseHill = (f) => { const o = {}; for (const x of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) o[x[1]] = (o[x[1]] ?? 0) + (x[2] ? Number(x[2]) : 1); return o; };
/** 'igual' si la fórmula de PubChem es la misma; 'multiplo' si es k veces la del compuesto (k entero > 1). */
function relation(comp, pubFormula) {
  if (!/^[A-Za-z0-9]+$/.test(pubFormula)) return null; // fórmulas con carga o con puntos (mezclas)
  const p = parseHill(pubFormula);
  const keys = Object.keys(comp);
  if (Object.keys(p).length !== keys.length || keys.some((k) => !p[k])) return null;
  const k = p[keys[0]] / comp[keys[0]];
  if (!Number.isInteger(k) || !keys.every((x) => p[x] === k * comp[x])) return null;
  return k === 1 ? 'igual' : 'multiplo';
}

const nameCache = new Map();
const out = {};
let i = 0;
for (const c of compounds) {
  i++;
  const hill = m.hillFormula(c.composition);
  const names = [...new Set([c.en.comun, c.en.stock, c.en.tradicional, c.en.sistematica].filter(Boolean))];
  let hit = null;
  for (const n of names) {
    if (!nameCache.has(n)) {
      const r = await get(`${REST}/compound/name/${encodeURIComponent(n)}/property/MolecularFormula,Title/JSON`);
      nameCache.set(n, r.status === 200 ? props(r.text) : []);
    }
    const p = nameCache.get(n).find((x) => relation(c.composition, x.MolecularFormula));
    if (p) { hit = { cid: p.CID, titulo: p.Title, formulaPubChem: p.MolecularFormula, via: 'nombre', consulta: n, relacion: relation(c.composition, p.MolecularFormula) }; break; }
  }
  let descartados = [];
  if (!hit) {
    const r = await get(`${REST}/compound/fastformula/${hill}/property/MolecularFormula,Title,Charge/JSON`);
    const list = (r.status === 200 ? props(r.text) : []).filter((x) => x.MolecularFormula === hill && (x.Charge ?? 0) === 0).sort((p, q) => p.CID - q.CID).slice(0, 10);
    if (list.length) {
      const ids = list.map((x) => x.CID).join(',');
      const iupac = new Map(props((await get(`${REST}/compound/cid/${ids}/property/IUPACName,Title/JSON`)).text).map((x) => [x.CID, x]));
      let syn = new Map();
      try { syn = new Map((JSON.parse((await get(`${REST}/compound/cid/${ids}/synonyms/JSON`)).text).InformationList.Information ?? []).map((x) => [x.CID, x.Synonym ?? []])); } catch { /* sin sinónimos */ }
      const engineNames = [...names, c.names.sistematica, c.names.stock, c.names.tradicional, c.names.comun].filter(Boolean);
      const cands = list.map((x) => ({ cid: x.CID, titulo: x.Title, iupac: iupac.get(x.CID)?.IUPACName ?? '', sinonimos: syn.get(x.CID) ?? [] }));
      for (const k of cands) {
        const mt = m.nameMatch(engineNames, [k.titulo, k.iupac, ...k.sinonimos]);
        if (mt && !m.otherStructure(c.fn, k.titulo, k.iupac)) { hit = { cid: k.cid, titulo: k.titulo, formulaPubChem: hill, via: 'formula-sinonimo', consulta: hill, relacion: 'igual', sinonimo: mt.pubchem, nombreMotor: mt.motor }; break; }
      }
      if (!hit) {
        for (const k of cands) {
          const why = m.otherStructure(c.fn, k.titulo, k.iupac);
          if (why) { descartados.push({ cid: k.cid, titulo: k.titulo, iupac: k.iupac, motivo: why }); continue; }
          hit = { cid: k.cid, titulo: k.titulo, iupac: k.iupac, formulaPubChem: hill, via: 'formula', consulta: hill, relacion: 'igual' };
          break;
        }
        // Solo se guardan los descartes anteriores al CID elegido (los que explican por qué no se tomó el más bajo).
      }
    }
  }
  out[c.key] = { formula: c.formula, hill, ...(hit ?? { cid: null, consultas: [...names, hill] }), ...(descartados.length ? { descartados } : {}) };
  console.log(`${String(i).padStart(4)}/${compounds.length} ${c.key.padEnd(26)} ${hill.padEnd(12)} ${hit ? `CID ${hit.cid} (${hit.via}: ${hit.sinonimo ?? hit.consulta})` : 'sin registro → fórmula formal'}${descartados.length ? ` · ${descartados.length} descartados` : ''}`);
}

const vals = Object.values(out);
const registrados = vals.filter((x) => x.cid !== null).length;
const data = {
  fuente: 'PubChem PUG REST (https://pubchem.ncbi.nlm.nih.gov/rest/pug)',
  fecha: new Date().toISOString().slice(0, 10),
  script: 'scripts/validacion/compuestos_pubchem.mjs',
  metodo: 'Nombre en inglés generado por el motor → CID con la misma fórmula de Hill (o múltiplo entero); si no hay, fórmula exacta (fastformula, carga 0) y regla de src/models/pubchemNameMatch.ts sobre los 10 CID más bajos: nombre IUPAC, título o sinónimo que coincide en forma canónica con un nombre del motor → registrado; título o nombre IUPAC de otra clase (hidróxido, peróxido, hidrato, hidruro) → descartado; si no, CID más bajo no descartado como «fórmula registrada sin coincidencia de nombre». Sin coincidencia: fórmula formal.',
  combinaciones: results.length,
  total: compounds.length,
  registrados,
  porNombre: vals.filter((x) => x.via === 'nombre').length,
  porSinonimo: vals.filter((x) => x.via === 'formula-sinonimo').length,
  soloFormula: vals.filter((x) => x.via === 'formula').length,
  formales: compounds.length - registrados,
  conDescartes: vals.filter((x) => x.descartados?.length).length,
  compuestos: Object.fromEntries(Object.entries(out).sort(([p], [q]) => p.localeCompare(q))),
};
writeFileSync(join(root, 'src/data/quimica/compuestos-pubchem.json'), `${JSON.stringify(data, null, 1)}\n`);
console.log(`\n${registrados} con CID en PubChem (${data.porNombre} por nombre, ${data.porSinonimo} por fórmula + sinónimo, ${data.soloFormula} solo por fórmula) · ${data.formales} fórmulas formales · ${data.conDescartes} con registros descartados por ser otra estructura (de ${compounds.length}).`);
