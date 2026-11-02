#!/usr/bin/env node
/**
 * Propiedades periódicas reales para la práctica «tabla-periodica» (y la diferencia de electronegatividad de
 * «enlace-quimico»), tomadas de la tabla periódica de PubChem:
 *   https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON
 * PubChem reúne allí datos de otras fuentes: masas atómicas de la IUPAC/CIAAW, energías de ionización del NIST
 * (Atomic Spectra Database), electronegatividad de Pauling y radio atómico de van der Waals (pm). No se inventa ni se
 * completa ningún valor: lo que PubChem deja vacío queda como null.
 *
 * Además consulta en PUG View (sección «Melting Point» y «Solubility») las propiedades de las cinco sustancias de la
 * estación de propiedades de «enlace-quimico» y guarda TODOS los textos con su fuente; la elección del valor usado está
 * en src/models/chemicalBonding.ts (SUBSTANCES) y la prueba tests/unit/chemicalBonding.test.ts comprueba que ese valor
 * aparece, tal cual, entre los textos guardados.
 *
 * Salida: src/data/quimica/tabla-periodica-pubchem.json (generado; no editar a mano).
 * Uso: NODE_USE_ENV_PROXY=1 node scripts/validacion/tabla_periodica_pubchem.mjs   (≤ 4 solicitudes/s, política de PubChem)
 */
import { writeFileSync } from 'node:fs';

const UA = { 'User-Agent': 'laboratorio-virtual-ciencias (scripts/validacion/tabla_periodica_pubchem.mjs)' };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function getJson(url) {
  for (let i = 0; i < 5; i++) {
    await sleep(300);
    try {
      const res = await fetch(url, { headers: UA });
      if (res.status === 503 || res.status === 429 || res.status === 500) { await sleep(2500 * (i + 1)); continue; }
      if (!res.ok) throw new Error(`${res.status} ${url}`);
      return await res.json();
    } catch (e) { if (i === 4) throw e; await sleep(2000 * (i + 1)); }
  }
  throw new Error(`Sin respuesta: ${url}`);
}

const num = (s) => (s === '' || s === undefined || s === null ? null : Number(s));
const table = await getJson('https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON');
const cols = table.Table.Columns.Column;
const idx = (name) => { const i = cols.indexOf(name); if (i < 0) throw new Error(`Falta la columna ${name}`); return i; };
const elementos = table.Table.Row.map(({ Cell: c }) => ({
  z: Number(c[idx('AtomicNumber')]),
  simbolo: c[idx('Symbol')],
  masa: num(c[idx('AtomicMass')]),
  configuracion: c[idx('ElectronConfiguration')],
  electronegatividad: num(c[idx('Electronegativity')]),
  radioVdW: num(c[idx('AtomicRadius')]),
  ionizacion: num(c[idx('IonizationEnergy')]),
  afinidad: num(c[idx('ElectronAffinity')]),
  fusionK: num(c[idx('MeltingPoint')]),
  densidad: num(c[idx('Density')]),
  estado: c[idx('StandardState')],
  bloque: c[idx('GroupBlock')],
}));
if (elementos.length !== 118 || elementos.some((e, i) => e.z !== i + 1)) throw new Error('La tabla de PubChem no trae los 118 elementos en orden.');

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
      out.push({ texto, fuente: r.SourceName ?? '', referencia: (i.Reference ?? []).join(' ') });
    }
  };
  walk(view.Record);
  return out;
}
/** [id, CID, nombre en PubChem]. La parafina comercial es una mezcla sin CID: se usa el n-eicosano (C₂₀H₄₂) como modelo. */
const SUSTANCIAS = [['nacl', 5234, 'Sodium Chloride'], ['sacarosa', 5988, 'Sucrose'], ['cobre', 23978, 'Copper'], ['cuarzo', 24261, 'Silica'], ['parafina', 8222, 'Eicosane']];
const sustancias = {};
for (const [id, cid, titulo] of SUSTANCIAS) {
  const fusion = entries(await getJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=Melting+Point`));
  const solubilidad = entries(await getJson(`https://pubchem.ncbi.nlm.nih.gov/rest/pug_view/data/compound/${cid}/JSON?heading=Solubility`));
  sustancias[id] = { cid, titulo, fusion, solubilidad };
}

const fecha = new Date().toISOString().slice(0, 10);
writeFileSync('src/data/quimica/tabla-periodica-pubchem.json', `${JSON.stringify({
  fuente: 'PubChem, tabla periódica (https://pubchem.ncbi.nlm.nih.gov/rest/pug/periodictable/JSON) y PUG View («Melting Point», «Solubility»)',
  fecha,
  script: 'scripts/validacion/tabla_periodica_pubchem.mjs',
  unidades: { masa: 'u (g/mol)', electronegatividad: 'escala de Pauling', radioVdW: 'pm (radio de van der Waals)', ionizacion: 'eV (primera energía de ionización)', afinidad: 'eV', fusionK: 'K', densidad: 'g/cm³ (sólidos y líquidos; g/L en los gases)' },
  elementos,
  sustancias,
}, null, 1)}\n`);
console.log(`tabla-periodica-pubchem.json: ${elementos.length} elementos, ${Object.keys(sustancias).length} sustancias (${fecha})`);
