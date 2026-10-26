import type { FunctionId } from './inorganicNomenclature';

/**
 * Regla documentada para revisar los registros de PubChem que el Taller de formación de compuestos encontró SOLO por la
 * fórmula (scripts/validacion/compuestos_pubchem.mjs). Funciones puras: las usa el script y las prueban
 * tests/unit/pubchemNameMatch.test.ts.
 *
 * 1. Coincidencia de nombre. Para cada CID con la misma fórmula de Hill (carga 0) se comparan su título, su nombre IUPAC y
 *    sus sinónimos con los nombres que genera el motor (inglés: común, Stock, tradicional y estequiométrico; y los de
 *    español, sin tildes). Se comparan en forma CANÓNICA (canonName): minúsculas sin tildes; «sulph» → «sulf»,
 *    «aluminium» → «aluminum», «caesium» → «cesium»; sin la fórmula final entre paréntesis («(ZnO)»); sin números de
 *    oxidación ni cargas («(III)», «(2+)»); sin prefijos multiplicadores al inicio de cada palabra (mono, di, tri…, bis,
 *    tris…); signos «;» «,» «-» como espacios; y las palabras ORDENADAS. Como la fórmula ya es idéntica, quitar
 *    multiplicadores y estados no confunde compuestos distintos: «Tin(2+) dihydroxide» ≡ «tin(II) hydroxide» y
 *    «Silver;bromate» ≡ «silver bromate». Si algún nombre coincide, el registro pasa a «registrado» (vía «fórmula +
 *    sinónimo»).
 * 2. Otra estructura. Si el título o el nombre IUPAC del registro contienen una palabra de CLASE que el compuesto del
 *    motor no tiene, el registro describe otra sustancia con la misma fórmula y se DESCARTA:
 *      hidróxido («hydroxide», «hydroxy»), salvo en hidróxidos, sales básicas, oxácidos y sales ácidas;
 *      peróxido («peroxide», «peroxy», «peroxo»), salvo en peróxidos;
 *      hidrato («hydrate»), siempre (el motor da fórmulas sin agua de cristalización);
 *      hidruro («hydride», «hydrido»), salvo en hidruros.
 *    Ej.: Rb₂O → «Rubidium(1+),hydroxide»; Cl₂O₅ → «Chloroperoxyperoxy hypochlorite»; V(OH)₃ → «Hydroxy(oxo)vanadium;hydrate».
 * 3. Lo que no coincide ni se descarta queda como «fórmula registrada sin coincidencia de nombre» (CID más bajo no
 *    descartado); si todos los CID se descartan, el compuesto queda como fórmula formal y se anotan los descartes.
 */

const MULT = ['tetrakis', 'pentakis', 'hexakis', 'tris', 'bis', 'mono', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
/** Palabras que, sin el prefijo, siguen siendo palabras de nomenclatura (para no cortar «dinitrogen» → «nitrogen» mal). */
const MULT_RE = new RegExp(`^(?:${MULT.join('|')})(?=[a-z]{3,})`);

/** Forma canónica de un nombre químico (ver la regla 1). */
export function canonName(s: string): string {
  let t = s.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  t = t.replace(/\s*\(([a-z0-9()]*[0-9][a-z0-9()]*)\)\s*$/i, (m, x: string) => (/^[ivx]+$/.test(x) ? m : ''));
  t = t.replace(/sulph/g, 'sulf').replace(/aluminium/g, 'aluminum').replace(/caesium/g, 'cesium');
  t = t.replace(/\((?:[ivx]+|[0-9]*[+-]|[+-][0-9]*|0)\)/g, ' ');
  t = t.replace(/[;,\-–]/g, ' ').replace(/[()[\]]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = t.split(' ').filter(Boolean).map((w) => {
    let x = w;
    // «monoxide», «pentoxide», «heptoxide»: el prefijo con la vocal elidida.
    x = x.replace(/^(?:mon|pent|hex|hept|oct|non|dec|tetr)(?=oxide)/, '');
    for (let i = 0; i < 2; i++) x = x.replace(MULT_RE, '');
    return x;
  }).filter((w) => w && !/^\d+$/.test(w));
  return words.sort().join(' ');
}

/** Primer par (nombre del motor, nombre de PubChem) que coincide en forma canónica, o null. */
export function nameMatch(engineNames: string[], pubNames: string[]): { motor: string; pubchem: string } | null {
  const canon = new Map<string, string>();
  for (const n of engineNames) if (n) canon.set(canonName(n), n);
  for (const p of pubNames) {
    if (!p) continue;
    const hit = canon.get(canonName(p));
    if (hit) return { motor: hit, pubchem: p };
  }
  return null;
}

const CLASS_MARKERS: { re: RegExp; label: string; allowed: FunctionId[] }[] = [
  { re: /hydroxide|hydroxy/i, label: 'hidróxido', allowed: ['hidroxido', 'sal-basica', 'oxacido', 'sal-acida'] },
  { re: /peroxide|peroxy|peroxo/i, label: 'peróxido', allowed: ['peroxido'] },
  { re: /hydrate/i, label: 'hidrato', allowed: [] },
  { re: /hydride|hydrido/i, label: 'hidruro', allowed: ['hidruro-metalico', 'hidruro-no-metalico'] },
];

/** Motivo por el que el registro describe otra estructura (regla 2), o null. */
export function otherStructure(fn: FunctionId, title: string, iupac = ''): string | null {
  const text = `${title} ${iupac}`;
  for (const m of CLASS_MARKERS) {
    if (m.re.test(text) && !m.allowed.includes(fn)) return `el registro lo describe como ${m.label} («${(m.re.exec(text) ?? [''])[0]}»), y el compuesto del taller no lo es`;
  }
  return null;
}
