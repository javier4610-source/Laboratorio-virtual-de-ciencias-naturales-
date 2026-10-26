import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildCompound, checkFormula, checkName, el, ELEMENTS, enumerateCompounds, findByFormula, hillFormula, makeChallenges, neutralCounts, oxoacid,
  REFERENCE_CASES, type Compound, type Spec,
} from '../../src/models/inorganicNomenclature';

/**
 * Validación del motor de nomenclatura con datos reales:
 *  - tests/fixtures/quimica/nomenclatura-casos.json: los compuestos de referencia (149 hasta la v2.4.0; ampliados en la
 *    v2.5.0 con los de los elementos nuevos del taller) con los nombres en español esperados (IUPAC 2005 en
 *    su traducción española para sistemática y Stock; tradicional de uso escolar) y consultas en inglés.
 *  - tests/fixtures/quimica/nomenclatura-pubchem.json: CID, fórmula y sinónimos REALES de PubChem descargados por
 *    scripts/validacion/nomenclatura_pubchem.mjs (fecha en el archivo).
 * Por cada caso se toma el primer CID cuya fórmula coincide con la del motor (o es múltiplo, p. ej. P₄O₁₀ ↔ P₂O₅) y se
 * comprueba que los nombres en inglés que genera el motor (Stock, tradicional, estequiométrico o común) están entre los
 * sinónimos de ese CID.
 */
interface Caso { spec: Spec; queries: string[]; es: { sistematica: string; stock: string | null; tradicional: string | null } }
interface Res { query: string; cid: number | null; formula?: string; synonyms?: string[] }
const casos: Caso[] = JSON.parse(readFileSync(new URL('../fixtures/quimica/nomenclatura-casos.json', import.meta.url), 'utf8'));
const pubchem: { fecha: string; resultados: Record<string, Res> } = JSON.parse(readFileSync(new URL('../fixtures/quimica/nomenclatura-pubchem.json', import.meta.url), 'utf8'));

/** Quita el «(ZnO)» final que traen algunos sinónimos («Zinc oxide (ZnO)»), sin tocar los números romanos. */
const stripFormula = (s: string) => s.replace(/\s*\(([A-Z][A-Za-z0-9]*)\)$/, (m, x: string) => (/^[IVX]+$/.test(x) ? m : ''));
const normEn = (s: string) => stripFormula(s).toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/sulph/g, 'sulf').replace(/aluminium/g, 'aluminum')
  .replace(/\s*\(\s*/g, '(').replace(/\s*\)\s*/g, ') ').replace(/\s+/g, ' ').trim().replace(/aoxide/g, 'oxide').replace(/ooxide/g, 'oxide');
const parseHill = (f: string) => {
  const out: Record<string, number> = {};
  for (const m of f.replace(/[+-]$/, '').matchAll(/([A-Z][a-z]?)(\d*)/g)) out[m[1]] = (out[m[1]] ?? 0) + (m[2] ? Number(m[2]) : 1);
  return out;
};
/** La fórmula de PubChem es igual o un múltiplo entero (fórmula molecular vs. empírica) de la del motor. */
function formulaMatch(c: Compound, pubFormula: string): 'igual' | 'multiplo' | null {
  if (hillFormula(c.composition) === pubFormula) return 'igual';
  const p = parseHill(pubFormula);
  const keys = Object.keys(c.composition);
  if (Object.keys(p).length !== keys.length || keys.some((k) => !p[k])) return null;
  const k = p[keys[0]] / c.composition[keys[0]];
  return Number.isInteger(k) && k > 1 && keys.every((x) => p[x] === k * c.composition[x]) ? 'multiplo' : null;
}

describe(`motor de nomenclatura · nombres en español de referencia (${REFERENCE_CASES} compuestos)`, () => {
  it('reproduce exactamente los nombres sistemático, Stock y tradicional esperados', () => {
    const errors: string[] = [];
    for (const k of casos) {
      const c = buildCompound(k.spec);
      if (c.names.sistematica !== k.es.sistematica) errors.push(`${c.formula} sistemática: «${c.names.sistematica}» ≠ «${k.es.sistematica}»`);
      if (c.names.stock !== k.es.stock) errors.push(`${c.formula} Stock: «${c.names.stock}» ≠ «${k.es.stock}»`);
      if (c.names.tradicional !== k.es.tradicional) errors.push(`${c.formula} tradicional: «${c.names.tradicional}» ≠ «${k.es.tradicional}»`);
    }
    expect(errors, errors.join('\n')).toEqual([]);
    expect(casos.length).toBe(REFERENCE_CASES);
    // Los 149 casos de la v2.4.0 siguen siendo los primeros del archivo (no se cambió ninguno).
    expect(casos[0].spec).toEqual({ kind: 'oxido', el: 'Fe', ox: 3 });
  });

  it('los casos nuevos cubren los elementos que se habilitaron en la v2.5.0', () => {
    const NEW = ['Rb', 'Cs', 'Be', 'Sr', 'Sc', 'Y', 'La', 'Ce', 'Nd', 'Eu', 'Ti', 'Zr', 'V', 'Nb', 'Ta', 'Mo', 'W', 'Re', 'Ru', 'Rh', 'Ir', 'Pd', 'Pt', 'Cd', 'Ga', 'In', 'Tl', 'Ge', 'Sb', 'Bi', 'As', 'Se', 'Te'];
    const covered = new Set(casos.flatMap((k) => Object.keys(buildCompound(k.spec).composition)));
    expect(NEW.filter((x) => !covered.has(x))).toEqual([]);
  });
});

describe('motor de nomenclatura · validación contra PubChem', () => {
  const rows = casos.map((k) => {
    const c = buildCompound(k.spec);
    const hit = k.queries.map((q) => pubchem.resultados[q]).find((r) => r?.cid && r.formula && formulaMatch(c, r.formula));
    const syn = new Set((hit?.synonyms ?? []).map(normEn));
    const sys = { stock: c.en.stock, tradicional: c.en.tradicional, sistematica: c.en.sistematica, comun: c.en.comun ?? null };
    const found = Object.fromEntries(Object.entries(sys).map(([s, n]) => [s, n ? syn.has(normEn(n)) : null])) as Record<string, boolean | null>;
    // Nombres en español: algunos registros de PubChem traen sinónimos en español (sin tildes).
    const es = [c.names.sistematica, c.names.stock, c.names.tradicional, c.names.comun].filter(Boolean).some((n) => syn.has(normEn(n!)));
    return { c, hit, found, es, match: hit ? formulaMatch(c, hit.formula!) : null };
  });

  it('casi todos los compuestos de referencia tienen CID con la misma fórmula (o múltiplo) y en todos ellos algún nombre del motor está entre los sinónimos', () => {
    const matched = rows.filter((r) => r.hit);
    const noName = matched.filter((r) => !Object.values(r.found).some((v) => v === true));
    const count = (s: string) => [matched.filter((r) => r.found[s] === true).length, matched.filter((r) => r.found[s] !== null).length];
    const [st, stN] = count('stock'), [tr, trN] = count('tradicional'), [si, siN] = count('sistematica'), [co, coN] = count('comun');
    console.log(`[nomenclatura] PubChem ${pubchem.fecha}: ${matched.length}/${rows.length} con fórmula coincidente (${matched.filter((r) => r.match === 'multiplo').length} como múltiplo); `
      + `nombres en inglés hallados entre los sinónimos — Stock ${st}/${stN}, tradicional ${tr}/${trN}, estequiométrico ${si}/${siN}, común ${co}/${coN}; `
      + `algún nombre en español (sin tildes) ${matched.filter((r) => r.es).length}/${matched.length}; sin coincidencia de nombre: ${noName.map((r) => r.c.formula).join(', ') || 'ninguno'}.`);
    expect(matched.length).toBeGreaterThanOrEqual(Math.floor(0.95 * rows.length));
    expect(noName.map((r) => `${r.c.formula} (CID ${r.hit!.cid})`)).toEqual([]);
  });

  it('casos difíciles: los dos estados de Fe, Cu, Sn, Pb y Hg, Hg₂Cl₂ y los ácidos de Cl, Br, I, S, N, P, C, Mn y Cr tienen CID con su fórmula exacta y su nombre', () => {
    const hard: Spec[] = [
      { kind: 'oxido', el: 'Fe', ox: 2 }, { kind: 'oxido', el: 'Fe', ox: 3 }, { kind: 'oxido', el: 'Cu', ox: 1 }, { kind: 'oxido', el: 'Cu', ox: 2 },
      { kind: 'oxido', el: 'Sn', ox: 2 }, { kind: 'oxido', el: 'Sn', ox: 4 }, { kind: 'oxido', el: 'Pb', ox: 2 }, { kind: 'oxido', el: 'Pb', ox: 4 },
      { kind: 'oxido', el: 'Hg', ox: 1 }, { kind: 'oxido', el: 'Hg', ox: 2 },
      { kind: 'sal-binaria', cation: { el: 'Hg', ox: 1 }, anion: 'Cl' }, { kind: 'sal-binaria', cation: { el: 'Hg', ox: 2 }, anion: 'Cl' },
      { kind: 'oxacido', el: 'Cl', ox: 1 }, { kind: 'oxacido', el: 'Cl', ox: 3 }, { kind: 'oxacido', el: 'Cl', ox: 5 }, { kind: 'oxacido', el: 'Cl', ox: 7 },
      { kind: 'oxacido', el: 'Br', ox: 1 }, { kind: 'oxacido', el: 'I', ox: 5 }, { kind: 'oxacido', el: 'S', ox: 4 }, { kind: 'oxacido', el: 'S', ox: 6 },
      { kind: 'oxacido', el: 'N', ox: 3 }, { kind: 'oxacido', el: 'N', ox: 5 }, { kind: 'oxacido', el: 'P', ox: 3 }, { kind: 'oxacido', el: 'P', ox: 5 },
      { kind: 'oxacido', el: 'C', ox: 4 }, { kind: 'oxacido', el: 'Mn', ox: 7 }, { kind: 'oxacido', el: 'Cr', ox: 6 }, { kind: 'oxacido', el: 'Cr', ox: 6, form: 'di' },
      { kind: 'peroxido', el: 'H' }, { kind: 'peroxido', el: 'Na' }, { kind: 'hidruro', el: 'Ca' }, { kind: 'hidruro', el: 'Na' },
      // v2.5.0: estados de Ti, Ce, Tl, Pt y Ge; ácidos de As, Se, Mo, W y Re; sales de Sr, Cd, Sb y Bi.
      { kind: 'oxido', el: 'Ti', ox: 4 }, { kind: 'oxido', el: 'Ce', ox: 4 }, { kind: 'oxido', el: 'Tl', ox: 1 }, { kind: 'oxido', el: 'Ge', ox: 4 },
      { kind: 'sal-binaria', cation: { el: 'Pt', ox: 2 }, anion: 'Cl' }, { kind: 'sal-binaria', cation: { el: 'Pt', ox: 4 }, anion: 'Cl' },
      { kind: 'oxacido', el: 'As', ox: 5 }, { kind: 'oxacido', el: 'Se', ox: 6 }, { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'Mo', ox: 6 } },
      { kind: 'oxisal', cation: { el: 'K', ox: 1 }, acid: { el: 'Re', ox: 7 } }, { kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'W', ox: 6 } },
      { kind: 'oxisal', cation: { el: 'Sr', ox: 2 }, acid: { el: 'C', ox: 4 } }, { kind: 'sal-binaria', cation: { el: 'Cd', ox: 2 }, anion: 'S' },
      { kind: 'sal-binaria', cation: { el: 'Sb', ox: 3 }, anion: 'Cl' }, { kind: 'sal-binaria', cation: { el: 'Bi', ox: 3 }, anion: 'Cl' },
    ];
    const bad: string[] = [];
    for (const spec of hard) {
      const r = rows.find((x) => x.c.key === buildCompound(spec).key);
      if (!r?.hit || r.match !== 'igual' || !Object.values(r.found).some((v) => v === true)) bad.push(buildCompound(spec).formula);
    }
    expect(bad).toEqual([]);
    // Los dos estados de un mismo metal llevan a CID distintos.
    const cid = (s: Spec) => rows.find((x) => x.c.key === buildCompound(s).key)!.hit!.cid;
    expect(cid({ kind: 'oxido', el: 'Fe', ox: 2 })).not.toBe(cid({ kind: 'oxido', el: 'Fe', ox: 3 }));
    expect(cid({ kind: 'sal-binaria', cation: { el: 'Hg', ox: 1 }, anion: 'Cl' })).not.toBe(cid({ kind: 'sal-binaria', cation: { el: 'Hg', ox: 2 }, anion: 'Cl' }));
    expect(cid({ kind: 'sal-binaria', cation: { el: 'Pt', ox: 2 }, anion: 'Cl' })).not.toBe(cid({ kind: 'sal-binaria', cation: { el: 'Pt', ox: 4 }, anion: 'Cl' }));
  });
});

describe('motor de nomenclatura · reglas', () => {
  it('neutralidad de cargas: n·q₊ + m·q₋ = 0 con los menores enteros', () => {
    expect(neutralCounts(3, -2)).toEqual([2, 3]);
    expect(neutralCounts(2, -2)).toEqual([1, 1]);
    expect(neutralCounts(4, -2)).toEqual([1, 2]);
    expect(() => neutralCounts(-1, -2)).toThrow();
  });

  it('la suma de números de oxidación de cada fórmula generada es cero', () => {
    const state = (c: Compound, elx: string): number => {
      const s = c.spec as Spec & { el?: string; ox?: number; cation?: { el: string; ox?: number }; acid?: { el: string; ox: number }; anion?: string | { el: string; ox: number } };
      if (elx === 'H') return c.fn === 'hidruro-metalico' ? -1 : 1;
      if (elx === 'O') return c.fn === 'peroxido' ? -1 : -2;
      if (s.kind === 'oxido' || s.kind === 'hidroxido' || s.kind === 'oxacido') if (elx === s.el) return s.ox!;
      if (s.kind === 'peroxido' && elx === s.el) return el(elx).ox[0];
      if (s.cation && 'ox' in s.cation && elx === s.cation.el) return s.cation.ox!;
      if (s.cation?.el === 'NH4' && elx === 'N' && !(s.acid?.el === 'N')) return -3;
      if (s.acid && elx === s.acid.el) return s.acid.ox;
      if (typeof s.anion === 'object' && elx === s.anion.el) return s.anion.ox;
      return ({ F: -1, Cl: -1, Br: -1, I: -1, S: -2, Se: -2, Te: -2 } as Record<string, number>)[elx] ?? NaN;
    };
    let checked = 0;
    for (const c of enumerateCompounds()) {
      if (c.fn === 'hidruro-no-metalico' || c.fn === 'hidracido' || c.fn === 'peroxido' && c.formula === 'H2O2') continue;
      if ((c.spec as { cation?: { el: string } }).cation?.el === 'NH4' && (c.spec as { acid?: { el: string } }).acid?.el === 'N') continue;
      if (c.fn === 'hidruro-metalico') continue;
      const sp = c.spec as { cation?: { el: string }; acid?: { el: string } };
      if (sp.cation && sp.acid && sp.cation.el === sp.acid.el) continue; // p. ej. cromato de cromo(II): el mismo elemento con dos estados
      const total = Object.entries(c.composition).reduce((t, [k, n]) => t + n * state(c, k), 0);
      expect(total, `${c.formula} (${c.key})`).toBe(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(2000);
  });

  it('oxácidos y sales de los elementos nuevos (v2.5.0): orto de As y V, meta del V, Te(VI) como H₂TeO₄ con su nota', () => {
    const f = (x: string, ox: number, form: 'normal' | 'meta' = 'normal') => buildCompound({ kind: 'oxacido', el: x, ox, form }).formula;
    expect([f('As', 5), f('As', 3), f('Se', 4), f('Se', 6), f('Te', 4), f('Te', 6), f('Mo', 6), f('W', 6), f('Re', 7), f('V', 5), f('V', 5, 'meta'), f('Sb', 5)])
      .toEqual(['H3AsO4', 'H3AsO3', 'H2SeO3', 'H2SeO4', 'H2TeO3', 'H2TeO4', 'H2MoO4', 'H2WO4', 'HReO4', 'H3VO4', 'HVO3', 'H3SbO4']);
    expect(buildCompound({ kind: 'oxacido', el: 'Te', ox: 6 }).notes.join(' ')).toMatch(/H₆TeO₆/);
    const fe = (s: Spec) => buildCompound(s).formula;
    expect(fe({ kind: 'oxisal', cation: { el: 'NH4' }, acid: { el: 'V', ox: 5, form: 'meta' } })).toBe('NH4VO3');
    expect(fe({ kind: 'oxisal', cation: { el: 'Ca', ox: 2 }, acid: { el: 'W', ox: 6 } })).toBe('CaWO4');
    expect(fe({ kind: 'oxisal', cation: { el: 'Ce', ox: 4 }, acid: { el: 'S', ox: 6 } })).toBe('Ce(SO4)2');
    expect(fe({ kind: 'sal-binaria', cation: { el: 'Mo', ox: 4 }, anion: 'S' })).toBe('MoS2');
    expect(fe({ kind: 'hidracido', el: 'Se' })).toBe('H2Se');
    expect(fe({ kind: 'hidruro', el: 'As' })).toBe('AsH3');
    expect(fe({ kind: 'peroxido', el: 'Sr' })).toBe('SrO2');
  });

  it('Stock con romanos cuando el elemento tiene varios estados reales (también Os, Rh, Pd, Nb, Ta y Bi); r doble tras prefijo (dirrubidio)', () => {
    expect(buildCompound({ kind: 'oxido', el: 'Bi', ox: 3 }).names.stock).toBe('óxido de bismuto(III)');
    expect(buildCompound({ kind: 'sal-binaria', cation: { el: 'Pd', ox: 2 }, anion: 'Cl' }).names.stock).toBe('cloruro de paladio(II)');
    expect(buildCompound({ kind: 'oxido', el: 'Zr', ox: 4 }).names.stock).toBe('óxido de circonio');
    expect(buildCompound({ kind: 'oxido', el: 'Rb', ox: 1 }).names.sistematica).toBe('óxido de dirrubidio');
    expect(buildCompound({ kind: 'oxido', el: 'Re', ox: 7 }).names.sistematica).toBe('heptaóxido de dirrenio');
  });

  it('sin nombre tradicional usual se dice y se usa Stock; los estados sin hidróxido u oxisal se rechazan con explicación', () => {
    const v2o3 = buildCompound({ kind: 'oxido', el: 'V', ox: 3 });
    expect(v2o3.names.tradicional).toBeNull();
    expect(v2o3.notes.join(' ')).toMatch(/no tiene nombre tradicional/);
    expect(buildCompound({ kind: 'oxido', el: 'Ti', ox: 4 }).names.tradicional).toBe('óxido titánico');
    expect(() => buildCompound({ kind: 'hidroxido', el: 'Ti', ox: 4 })).toThrow(/TiO₂·nH₂O/);
    expect(() => buildCompound({ kind: 'oxisal', cation: { el: 'V', ox: 4 }, acid: { el: 'S', ox: 6 } })).toThrow(/vanadilo/);
    expect(() => buildCompound({ kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'Sb', ox: 5 } })).toThrow(/antimoniatos/);
    expect(buildCompound({ kind: 'sal-binaria', cation: { el: 'Tl', ox: 1 }, anion: 'Cl' }).notes.join(' ')).toMatch(/tóxicos/);
  });

  it('cada elemento del motor tiene masa atómica, radio covalente y color de dibujo', async () => {
    const { ATOMIC_MASS } = await import('../../src/models/balancing');
    const { R_SINGLE, ELEMENT_COLOR } = await import('../../src/chem/elements');
    expect(ELEMENTS.filter((e) => !ATOMIC_MASS[e.sym] || !R_SINGLE[e.sym] || !ELEMENT_COLOR[e.sym]).map((e) => e.sym)).toEqual([]);
    expect(ELEMENTS.length).toBe(77);
  });

  it('oxoácidos por hidratación del óxido: orto, meta y di (piro)', () => {
    const f = (el: string, ox: number, form: 'normal' | 'meta' | 'di' = 'normal') => { const a = oxoacid(el, ox, form); return `H${a.h}${el}${a.x}O${a.o}`; };
    expect(f('S', 6)).toBe('H2S1O4');
    expect(f('Cl', 7)).toBe('H1Cl1O4');
    expect(f('P', 5)).toBe('H3P1O4');
    expect(f('P', 5, 'meta')).toBe('H1P1O3');
    expect(f('P', 5, 'di')).toBe('H4P2O7');
    expect(f('S', 6, 'di')).toBe('H2S2O7');
    expect(f('Cr', 6, 'di')).toBe('H2Cr2O7');
    expect(f('Si', 4)).toBe('H4Si1O4');
    expect(f('B', 3)).toBe('H3B1O3');
    expect(f('Mn', 7)).toBe('H1Mn1O4');
    expect(() => oxoacid('P', 3, 'meta')).toThrow();
    expect(() => oxoacid('Fe', 3)).toThrow();
  });

  it('el peróxido y el mercurio(I) no se simplifican; H₃PO₃ es diprótico', () => {
    expect(buildCompound({ kind: 'peroxido', el: 'Ba' }).formula).toBe('BaO2');
    expect(buildCompound({ kind: 'peroxido', el: 'H' }).formula).toBe('H2O2');
    expect(buildCompound({ kind: 'sal-binaria', cation: { el: 'Hg', ox: 1 }, anion: 'Cl' }).formula).toBe('Hg2Cl2');
    expect(oxoacid('P', 3).acidicH).toBe(2);
  });

  it('clasifica la función química', () => {
    const fn = (s: Spec) => buildCompound(s).fn;
    expect(fn({ kind: 'oxido', el: 'Na', ox: 1 })).toBe('oxido-basico');
    expect(fn({ kind: 'oxido', el: 'S', ox: 6 })).toBe('oxido-acido');
    expect(fn({ kind: 'oxido', el: 'Cr', ox: 6 })).toBe('oxido-acido');
    expect(fn({ kind: 'oxido', el: 'Al', ox: 3 })).toBe('oxido-anfotero');
    expect(fn({ kind: 'oxido', el: 'C', ox: 2 })).toBe('oxido-neutro');
    expect(fn({ kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'C', ox: 4 }, hLeft: 1 })).toBe('sal-acida');
    expect(fn({ kind: 'sal-basica', cation: { el: 'Mg', ox: 2 }, anion: 'Cl' })).toBe('sal-basica');
    expect(fn({ kind: 'hidruro', el: 'N' })).toBe('hidruro-no-metalico');
  });

  it('comprueba nombres y fórmulas escritos por el estudiante con retroalimentación', () => {
    const fe = buildCompound({ kind: 'oxido', el: 'Fe', ox: 3 });
    expect(checkName(fe, 'Óxido de hierro (III)').ok).toBe(true);
    expect(checkName(fe, 'oxido ferrico')).toMatchObject({ ok: true, accentsOnly: true });
    const other = checkName(fe, 'óxido férrico', 'sistematica');
    expect(other.ok).toBe(false);
    expect(other.otherSystem).toBe('tradicional');
    expect(checkName(fe, 'óxido de hierro(II)').ok).toBe(false);
    expect(checkFormula(fe, 'Fe₂O₃').ok).toBe(true);
    expect(checkFormula(fe, 'FeO').ok).toBe(false);
    expect(checkName(buildCompound({ kind: 'oxido', el: 'N', ox: 5 }), 'pentóxido de dinitrógeno', 'sistematica').ok).toBe(true);
    expect(checkName(buildCompound({ kind: 'oxacido', el: 'N', ox: 5 }), 'trioxonitrato(V) de hidrógeno', 'sistematica').ok).toBe(true);
    expect(checkName(buildCompound({ kind: 'oxisal', cation: { el: 'Na', ox: 1 }, acid: { el: 'C', ox: 4 }, hLeft: 1 }), 'bicarbonato de sodio', 'tradicional').ok).toBe(true);
  });

  it('busca por fórmula y genera retos reproducibles', () => {
    expect(findByFormula('Fe2(SO4)3')?.names.stock).toBe('sulfato de hierro(III)');
    expect(findByFormula('NaHCO3')?.names.sistematica).toBe('hidrogenocarbonato de sodio');
    const a = makeChallenges(42, 8), b = makeChallenges(42, 8);
    expect(a.map((x) => x.prompt)).toEqual(b.map((x) => x.prompt));
    expect(new Set(a.map((x) => x.compound.key)).size).toBe(8);
  });

  it('rechaza combinaciones fuera del motor con un mensaje claro', () => {
    expect(() => buildCompound({ kind: 'hidroxido', el: 'S', ox: 6 })).toThrow(/metal/);
    expect(() => buildCompound({ kind: 'oxido', el: 'Fe', ox: 6 })).toThrow();
    expect(() => buildCompound({ kind: 'oxisal', cation: { el: 'Ni', ox: 3 }, acid: { el: 'S', ox: 6 } })).toThrow(/Ni\(III\)/);
  });
});
