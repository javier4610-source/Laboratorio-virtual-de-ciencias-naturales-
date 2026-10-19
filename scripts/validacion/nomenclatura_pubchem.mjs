#!/usr/bin/env node
/**
 * Validación del motor de nomenclatura inorgánica contra PubChem (datos reales; no se inventan CID).
 *
 * Lee tests/fixtures/quimica/nomenclatura-casos.json (149 compuestos con su especificación para el motor, los
 * nombres en español esperados y una o más consultas en inglés) y, para CADA consulta:
 *   1) nombre → CID:   PUG REST /compound/name/<consulta>/cids/TXT (primer CID)
 *   2) fórmula:        /compound/cid/<CID>/property/MolecularFormula/TXT
 *   3) sinónimos:      /compound/cid/<CID>/synonyms/JSON (nombres IUPAC, Stock, tradicionales y comerciales)
 * y guarda todo en tests/fixtures/quimica/nomenclatura-pubchem.json con la fecha. La prueba
 * tests/unit/inorganicNomenclature.test.ts elige, por cada caso, el primer CID cuya fórmula coincide con la del motor
 * y comprueba que los nombres en inglés que genera el motor aparecen entre los sinónimos.
 *
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/validacion/nomenclatura_pubchem.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs';

const REST = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
const casos = JSON.parse(readFileSync(new URL('../../tests/fixtures/quimica/nomenclatura-casos.json', import.meta.url), 'utf8'));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function get(url) {
  const wait = Math.max(0, last + 220 - Date.now());
  if (wait) await sleep(wait);
  last = Date.now();
  for (let i = 0; i < 4; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'laboratorio-virtual-ciencias (scripts/validacion/nomenclatura_pubchem.mjs)' } });
      if (res.status === 503 || res.status === 429) { await sleep(2000 * (i + 1)); continue; }
      return { status: res.status, text: await res.text() };
    } catch (e) { await sleep(1500 * (i + 1)); if (i === 3) throw e; }
  }
  return { status: 599, text: '' };
}

const results = {};
let n = 0;
for (const c of casos) {
  for (const q of c.queries) {
    if (results[q]) continue;
    const r = await get(`${REST}/compound/name/${encodeURIComponent(q)}/cids/TXT`);
    if (r.status !== 200) { results[q] = { query: q, cid: null, status: r.status }; console.log(`sin CID  ${q} (${r.status})`); continue; }
    const cid = Number(r.text.trim().split(/\s+/)[0]);
    const f = await get(`${REST}/compound/cid/${cid}/property/MolecularFormula/TXT`);
    const s = await get(`${REST}/compound/cid/${cid}/synonyms/JSON`);
    let syn = [];
    try { syn = JSON.parse(s.text).InformationList.Information[0].Synonym ?? []; } catch { /* sin sinónimos */ }
    // Se conservan los sinónimos con forma de nombre (sin números de registro largos) para que el archivo sea manejable.
    syn = syn.filter((x) => x.length <= 90 && !/^\d{2,7}-\d\d-\d$/.test(x) && !/^[A-Z0-9]{10}$/.test(x)).slice(0, 400);
    results[q] = { query: q, cid, formula: f.text.trim(), synonyms: syn };
    n++;
    console.log(`ok       ${q} → CID ${cid} ${f.text.trim()} (${syn.length} sinónimos)`);
  }
}
const out = { fuente: 'PubChem PUG REST (https://pubchem.ncbi.nlm.nih.gov/rest/pug)', fecha: new Date().toISOString().slice(0, 10), script: 'scripts/validacion/nomenclatura_pubchem.mjs', resultados: results };
writeFileSync(new URL('../../tests/fixtures/quimica/nomenclatura-pubchem.json', import.meta.url), JSON.stringify(out, null, 1));
console.log(`\n${n} consultas con CID de ${Object.keys(results).length}`);
