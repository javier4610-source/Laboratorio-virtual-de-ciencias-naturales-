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
 *       /compound/fastformula/<Hill>/property/MolecularFormula,Title,Charge/JSON → CID más bajo con la misma fórmula y
 *       carga 0 (se guarda el título de PubChem para que se vea qué registro es).
 *    Si nada coincide, el compuesto queda como «fórmula formal» (cid: null).
 * 3. Guarda src/data/quimica/compuestos-pubchem.json con la fecha, la fuente, el método y cada resultado.
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
  stdin: { contents: "export * from './src/models/compoundForge.ts'; export { hillFormula } from './src/models/inorganicNomenclature.ts';", resolveDir: root, loader: 'ts' },
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
  if (!hit) {
    const r = await get(`${REST}/compound/fastformula/${hill}/property/MolecularFormula,Title,Charge/JSON`);
    const list = (r.status === 200 ? props(r.text) : []).filter((x) => x.MolecularFormula === hill && (x.Charge ?? 0) === 0).sort((p, q) => p.CID - q.CID);
    if (list.length) hit = { cid: list[0].CID, titulo: list[0].Title, formulaPubChem: list[0].MolecularFormula, via: 'formula', consulta: hill, relacion: 'igual' };
  }
  out[c.key] = { formula: c.formula, hill, ...(hit ?? { cid: null, consultas: [...names, hill] }) };
  console.log(`${String(i).padStart(4)}/${compounds.length} ${c.key.padEnd(26)} ${hill.padEnd(12)} ${hit ? `CID ${hit.cid} (${hit.via}: ${hit.consulta})` : 'sin registro → fórmula formal'}`);
}

const registrados = Object.values(out).filter((x) => x.cid !== null).length;
const data = {
  fuente: 'PubChem PUG REST (https://pubchem.ncbi.nlm.nih.gov/rest/pug)',
  fecha: new Date().toISOString().slice(0, 10),
  script: 'scripts/validacion/compuestos_pubchem.mjs',
  metodo: 'Nombre en inglés generado por el motor → CID con la misma fórmula de Hill (o múltiplo entero); si no hay, fórmula exacta (fastformula, carga 0) → CID más bajo. Sin coincidencia: fórmula formal.',
  combinaciones: results.length,
  total: compounds.length,
  registrados,
  formales: compounds.length - registrados,
  compuestos: Object.fromEntries(Object.entries(out).sort(([p], [q]) => p.localeCompare(q))),
};
writeFileSync(join(root, 'src/data/quimica/compuestos-pubchem.json'), `${JSON.stringify(data, null, 1)}\n`);
console.log(`\n${registrados} registrados en PubChem · ${data.formales} fórmulas formales (de ${compounds.length}).`);
