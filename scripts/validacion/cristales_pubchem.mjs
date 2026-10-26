#!/usr/bin/env node
/**
 * Densidades publicadas (y datos cristalográficos de texto, si los hay) de los sólidos del kit de redes cristalinas
 * (src/chem/crystal.ts), tomadas de PubChem PUG View con su fuente original. Datos reales; no se inventan valores.
 *
 * Para cada cristal:
 *   1) nombre (inglés) → CID: /rest/pug/compound/name/<nombre>/property/MolecularFormula,Title/JSON; se toma el primer CID
 *      cuya fórmula de Hill es la esperada (si no hay, el script se detiene);
 *   2) /rest/pug_view/data/compound/<CID>/JSON?heading=Density  y  ?heading=Other+Experimental+Properties:
 *      se guardan TODOS los textos de densidad con la fuente que los deposita (HSDB, PAC del DOE, ICSC…) y la referencia
 *      bibliográfica que cita (p. ej., «CRC Handbook of Chemistry and Physics, 86.ª ed., p. 4-96»);
 *   3) se elige el valor con la regla declarada en SELECCION (texto o fuente que debe coincidir, en orden de preferencia)
 *      y se guarda como «elegido». La prueba tests/unit/crystals.test.ts comprueba que la densidad publicada de cada
 *      cristal del kit es exactamente ese valor.
 * Salida: src/data/quimica/cristales-pubchem.json (generado; no editar a mano).
 *
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/validacion/cristales_pubchem.mjs   (≤ 4 solicitudes/s, política de PubChem)
 */
import { writeFileSync } from 'node:fs';

const REST = 'https://pubchem.ncbi.nlm.nih.gov/rest';
/**
 * [id del cristal, nombre de búsqueda, fórmula de Hill, reglas de elección en orden: { texto?, fuente?, referencia? }
 * (expresiones regulares que deben coincidir con el texto del valor, el nombre de la fuente o la referencia citada)].
 */
const SELECCION = [
  ['nacl', 'sodium chloride', 'ClNa', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['kcl', 'potassium chloride', 'ClK', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['mgo', 'magnesium oxide', 'MgO', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['cao', 'calcium oxide', 'CaO', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['caf2', 'calcium fluoride', 'CaF2', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['cscl', 'cesium chloride', 'ClCs', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['li2o', 'lithium oxide', 'Li2O', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['na2o', 'sodium oxide', 'Na2O', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['k2o', 'potassium oxide', 'K2O', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }, { fuente: /ICSC|Chemical Safety Cards/ }]],
  ['bao', 'barium oxide', 'BaO', [{ referencia: /CRC Handbook/i }, { fuente: /PAC/ }]],
  ['zns', 'zinc sulfide', 'SZn', [{ texto: /sphalerite/i, referencia: /CRC Handbook/i }]],
  ['tio2', 'titanium dioxide', 'O2Ti', [{ texto: /^\s*4\.\d+\s*$/, referencia: /CRC Handbook/i }]],
  ['al2o3', 'aluminum oxide', 'Al2O3', [{ texto: /^\s*\d\.\d+ @/, fuente: /PAC/ }]], // el texto del CRC en HSDB es el de la alúmina gamma: se usa el de la base PAC (α-Al₂O₃, la forma estable)
  ['sio2', 'silicon dioxide', 'O2Si', [{ texto: /alpha-Quartz/i }]],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let last = 0;
async function getJson(url) {
  const wait = Math.max(0, last + 260 - Date.now());
  if (wait) await sleep(wait);
  last = Date.now();
  for (let i = 0; i < 5; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'laboratorio-virtual-ciencias (scripts/validacion/cristales_pubchem.mjs)' } });
      if (res.status === 503 || res.status === 429 || res.status === 500) { await sleep(2500 * (i + 1)); continue; }
      if (res.status === 404) return null;
      return await res.json();
    } catch (e) { await sleep(2000 * (i + 1)); if (i === 4) throw e; }
  }
  return null;
}

/** Textos de una sección de PUG View con la fuente y la referencia bibliográfica. */
function entries(view) {
  if (!view?.Record) return [];
  const refs = new Map((view.Record.Reference ?? []).map((r) => [r.ReferenceNumber, r]));
  const out = [];
  const walk = (s) => {
    for (const x of s.Section ?? []) walk(x);
    for (const i of s.Information ?? []) {
      const v = i.Value ?? {};
      const texto = (v.StringWithMarkup ?? []).map((m) => m.String).join(' ') || (v.Number ? `${v.Number.join(', ')}${v.Unit ? ` ${v.Unit}` : ''}` : '');
      if (!texto) continue;
      const r = refs.get(i.ReferenceNumber) ?? {};
      out.push({ texto, fuente: r.SourceName ?? '', registro: r.Name ?? '', referencia: (i.Reference ?? []).join(' ') });
    }
  };
  walk(view.Record);
  return out;
}

const fecha = new Date().toISOString().slice(0, 10);
const out = {};
for (const [id, query, hill, rules] of SELECCION) {
  const p = await getJson(`${REST}/pug/compound/name/${encodeURIComponent(query)}/property/MolecularFormula,Title/JSON`);
  const hit = (p?.PropertyTable?.Properties ?? []).find((x) => x.MolecularFormula === hill);
  if (!hit) throw new Error(`${id}: ningún CID con la fórmula ${hill} para «${query}»`);
  const dens = entries(await getJson(`${REST}/pug_view/data/compound/${hit.CID}/JSON?heading=Density`));
  const other = entries(await getJson(`${REST}/pug_view/data/compound/${hit.CID}/JSON?heading=Other+Experimental+Properties`))
    .filter((e) => /X-RAY CRYSTALLOGRAPHIC|lattice|unit cell|space group/i.test(e.texto));
  let elegido = null;
  for (const rule of rules) {
    const e = dens.find((d) => (!rule.texto || rule.texto.test(d.texto)) && (!rule.fuente || rule.fuente.test(d.fuente)) && (!rule.referencia || rule.referencia.test(d.referencia)));
    if (e) {
      const m = /(\d+\.\d+|\d+)/.exec(rule.texto && /sphalerite/i.test(e.texto) ? e.texto.slice(0, e.texto.search(/sphalerite/i)) : e.texto);
      elegido = { ...e, valor: Number(m[1]), regla: Object.fromEntries(Object.entries(rule).map(([k, v]) => [k, String(v)])) };
      break;
    }
  }
  out[id] = { consulta: query, cid: hit.CID, titulo: hit.Title, formula: hill, elegido, densidades: dens, cristalografia: other };
  console.log(`${id.padEnd(6)} CID ${hit.CID} ${hill.padEnd(6)} ${dens.length} densidades · elegida: ${elegido ? `${elegido.valor} (${elegido.fuente}; ${elegido.referencia.slice(0, 70)})` : 'NINGUNA'}`);
}

const data = {
  fuente: 'PubChem PUG View (https://pubchem.ncbi.nlm.nih.gov/rest/pug_view), secciones «Density» y «Other Experimental Properties»',
  fecha,
  script: 'scripts/validacion/cristales_pubchem.mjs',
  metodo: 'Nombre → CID con la fórmula de Hill esperada; se guardan todas las densidades con su fuente y referencia, y se elige una con la regla declarada (referencia al CRC Handbook; si no hay, la base PAC del DOE; si no, las ICSC).',
  cristales: out,
};
writeFileSync(new URL('../../src/data/quimica/cristales-pubchem.json', import.meta.url), `${JSON.stringify(data, null, 1)}\n`);
console.log('\n→ src/data/quimica/cristales-pubchem.json');
