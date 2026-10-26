import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gcdAll } from '../../src/models/balancing';
import {
  chargeParts, challengeMet, ENGINE_SYMBOLS, enumerateForgeInputs, enumerateForgeResults, EXCLUDED_REASON, forge, FORGE_CHALLENGES, forgeCompounds, KNOWN_STATES, RARE_STATES, ROUTES, STATE_CHOICES,
  type ForgeError, type ForgeInput, type ForgeOk,
} from '../../src/models/compoundForge';
import { REGISTRY_META, registryEntries, registryStatus, registryText } from '../../src/models/compoundForgeRegistry';
import { canonName, otherStructure } from '../../src/models/pubchemNameMatch';
import { buildCompound, hillFormula, parseFormula, specKey, type Spec } from '../../src/models/inorganicNomenclature';
import { PT_ELEMENTS } from '../../src/models/periodicTable';
import { forgeReaction3D, staticView } from '../../src/labs/compoundForge3d';

/**
 * Taller de formación de compuestos: neutralidad de cargas, balanceo, nombres iguales a los casos de referencia,
 * rechazo explicado de combinaciones inválidas y coherencia con el archivo real de PubChem
 * (src/data/quimica/compuestos-pubchem.json, scripts/validacion/compuestos_pubchem.mjs).
 */
const ok = (i: ForgeInput): ForgeOk => { const r = forge(i); if (!r.ok) throw new Error(`${JSON.stringify(i)} → ${r.title}: ${r.message}`); return r; };
const bad = (i: ForgeInput): ForgeError => { const r = forge(i); if (r.ok) throw new Error(`${JSON.stringify(i)} debía rechazarse y dio ${r.product.formula}`); return r; };
const results = enumerateForgeResults();
const compounds = forgeCompounds(results);

describe('taller · recorrido del docente (Ca, S y sulfato de calcio)', () => {
  it('Ca + O₂ → CaO; CaO + H₂O → Ca(OH)₂; S(+6) + O₂ → SO₃; SO₃ + H₂O → H₂SO₄; H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2 H₂O', () => {
    const cao = ok({ route: 'metal-o2', a: 'Ca', oxA: 2 });
    expect([cao.equation, cao.product.formula, cao.product.names.stock, cao.product.fn]).toEqual(['2 Ca + O₂ → 2 CaO', 'CaO', 'óxido de calcio', 'oxido-basico']);
    const caoh2 = ok({ route: 'oxido-agua', a: 'Ca', oxA: 2 });
    expect([caoh2.equation, caoh2.product.formulaPretty, caoh2.product.names.stock]).toEqual(['CaO + H₂O → Ca(OH)₂', 'Ca(OH)₂', 'hidróxido de calcio']);
    const so3 = ok({ route: 'nometal-o2', a: 'S', oxA: 6 });
    expect([so3.equation, so3.product.names.sistematica, so3.product.fn, so3.pathway]).toEqual(['2 S + 3 O₂ → 2 SO₃', 'trióxido de azufre', 'oxido-acido', 'condiciones']);
    const h2so4 = ok({ route: 'anhidrido-agua', a: 'S', oxA: 6 });
    expect([h2so4.equation, h2so4.product.names.tradicional, h2so4.product.names.sistematica]).toEqual(['SO₃ + H₂O → H₂SO₄', 'ácido sulfúrico', 'dihidrogeno(tetraoxidosulfato)']);
    const caso4 = ok({ route: 'neutralizacion', a: 'Ca', oxA: 2, b: 'S', oxB: 6 });
    expect([caso4.equation, caso4.product.formula, caso4.product.names.stock, caso4.product.fn, caso4.byproduct?.formula]).toEqual(['H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2 H₂O', 'CaSO4', 'sulfato de calcio', 'oxisal', 'H2O']);
  });

  it('otras rutas: peróxido, hidruro, hidrácido, sal binaria, sal ácida y oxácidos de Mn y Cr', () => {
    expect(ok({ route: 'peroxido', a: 'Na', oxA: 1 }).equation).toBe('2 Na + O₂ → Na₂O₂');
    expect(ok({ route: 'metal-h2', a: 'Ca', oxA: 2 }).equation).toBe('Ca + H₂ → CaH₂');
    expect(ok({ route: 'h2-nometal', a: 'Cl', oxA: -1 }).equation).toBe('H₂ + Cl₂ → 2 HCl');
    expect(ok({ route: 'h2-nometal', a: 'S', oxA: -2 }).product.names.tradicional).toBe('ácido sulfhídrico');
    expect(ok({ route: 'h2-nometal', a: 'N', oxA: -3 }).equation).toBe('3 H₂ + N₂ → 2 NH₃');
    expect(ok({ route: 'metal-nometal', a: 'Fe', oxA: 3, b: 'Cl', oxB: -1 }).equation).toBe('2 Fe + 3 Cl₂ → 2 FeCl₃');
    expect(ok({ route: 'metal-nometal', a: 'Hg', oxA: 1, b: 'Cl', oxB: -1 }).equation).toBe('2 Hg + Cl₂ → Hg₂Cl₂');
    const bic = ok({ route: 'neutralizacion', a: 'Na', oxA: 1, b: 'C', oxB: 4, hLeft: 1 });
    expect([bic.equation, bic.product.names.stock, bic.product.fn]).toEqual(['H₂CO₃ + NaOH → NaHCO₃ + H₂O', 'hidrogenocarbonato de sodio', 'sal-acida']);
    expect(ok({ route: 'neutralizacion', a: 'Ca', oxA: 2, b: 'P', oxB: 5 }).equation).toBe('2 H₃PO₄ + 3 Ca(OH)₂ → Ca₃(PO₄)₂ + 6 H₂O');
    expect(ok({ route: 'neutralizacion', a: 'Ca', oxA: 2, b: 'N', oxB: 5 }).product.names.stock).toBe('nitrato de calcio');
    expect(ok({ route: 'anhidrido-agua', a: 'Mn', oxA: 7 }).equation).toBe('Mn₂O₇ + H₂O → 2 HMnO₄');
    expect(ok({ route: 'anhidrido-agua', a: 'Cr', oxA: 6 }).product.names.tradicional).toBe('ácido crómico');
    expect(ok({ route: 'anhidrido-agua', a: 'P', oxA: 5 }).equation).toBe('P₂O₅ + 3 H₂O → 2 H₃PO₄');
    expect(ok({ route: 'anhidrido-agua', a: 'P', oxA: 5, form: 'di' }).equation).toBe('P₂O₅ + 2 H₂O → H₄P₂O₇');
    expect(ok({ route: 'anhidrido-agua', a: 'S', oxA: 6, form: 'di' }).equation).toBe('2 SO₃ + H₂O → H₂S₂O₇');
    // Óxido no aislado: aparece como fórmula formal y la ruta se rotula «formal».
    const hbro3 = ok({ route: 'anhidrido-agua', a: 'Br', oxA: 5 });
    expect([hbro3.equation, hbro3.reactants[0].role, hbro3.pathway]).toEqual(['Br₂O₅ + H₂O → 2 HBrO₃', 'formal', 'formal']);
  });
});

describe('taller · elementos habilitados en la v2.5.0', () => {
  it('pedidos del docente y de la guía: Ba + O₂ → BaO; Sn(IV) + O₂ → SnO₂ «óxido estánnico»; HIO₄; KMnO₄; Zn(OH)₂', () => {
    expect(ok({ route: 'metal-o2', a: 'Ba', oxA: 2 }).equation).toBe('2 Ba + O₂ → 2 BaO');
    const sno2 = ok({ route: 'metal-o2', a: 'Sn', oxA: 4 });
    expect([sno2.equation, sno2.product.names.tradicional, sno2.product.names.stock]).toEqual(['Sn + O₂ → SnO₂', 'óxido estánnico', 'óxido de estaño(IV)']);
    const hio4 = ok({ route: 'anhidrido-agua', a: 'I', oxA: 7 });
    expect([hio4.product.formula, hio4.product.names.tradicional, hio4.equation]).toEqual(['HIO4', 'ácido peryódico', 'I₂O₇ + H₂O → 2 HIO₄']);
    expect(ok({ route: 'neutralizacion', a: 'K', oxA: 1, b: 'Mn', oxB: 7 }).equation).toBe('HMnO₄ + KOH → KMnO₄ + H₂O');
    expect(ok({ route: 'oxido-agua', a: 'Zn', oxA: 2 }).equation).toBe('ZnO + H₂O → Zn(OH)₂');
  });

  it('metales nuevos: grupos 1 y 2, transición, bloque p y lantánidos', () => {
    expect(ok({ route: 'metal-o2', a: 'Sr', oxA: 2 }).equation).toBe('2 Sr + O₂ → 2 SrO');
    expect(ok({ route: 'peroxido', a: 'Sr', oxA: 2 }).product.formula).toBe('SrO2');
    expect(ok({ route: 'oxido-agua', a: 'Cs', oxA: 1 }).equation).toBe('Cs₂O + H₂O → 2 CsOH');
    const tio2 = ok({ route: 'metal-o2', a: 'Ti', oxA: 4 });
    expect([tio2.equation, tio2.product.names.stock, tio2.product.names.tradicional, tio2.product.fn, tio2.pathway]).toEqual(['Ti + O₂ → TiO₂', 'óxido de titanio(IV)', 'óxido titánico', 'oxido-anfotero', 'directa']);
    const v2o5 = ok({ route: 'metal-o2', a: 'V', oxA: 5 });
    expect([v2o5.equation, v2o5.product.fn]).toEqual(['4 V + 5 O₂ → 2 V₂O₅', 'oxido-acido']);
    expect(ok({ route: 'neutralizacion', a: 'Na', oxA: 1, b: 'Mo', oxB: 6 }).equation).toBe('H₂MoO₄ + 2 NaOH → Na₂MoO₄ + 2 H₂O');
    expect(ok({ route: 'neutralizacion', a: 'Ca', oxA: 2, b: 'W', oxB: 6 }).product.names.stock).toBe('wolframato de calcio');
    expect(ok({ route: 'neutralizacion', a: 'K', oxA: 1, b: 'Re', oxB: 7 }).product.formula).toBe('KReO4');
    expect(ok({ route: 'neutralizacion', a: 'Na', oxA: 1, b: 'V', oxB: 5, form: 'meta' }).product.names.stock).toBe('metavanadato de sodio');
    expect(ok({ route: 'metal-nometal', a: 'Cd', oxA: 2, b: 'S', oxB: -2 }).equation).toBe('Cd + S → CdS');
    expect(ok({ route: 'metal-nometal', a: 'Cd', oxA: 2, b: 'Te', oxB: -2 }).product.names.stock).toBe('telururo de cadmio');
    expect(ok({ route: 'metal-nometal', a: 'Pt', oxA: 4, b: 'Cl', oxB: -1 }).product.names.tradicional).toBe('cloruro platínico');
    expect(ok({ route: 'neutralizacion', a: 'Bi', oxA: 3, b: 'N', oxB: 5 }).equation).toBe('3 HNO₃ + Bi(OH)₃ → Bi(NO₃)₃ + 3 H₂O');
    expect(ok({ route: 'neutralizacion', a: 'Ce', oxA: 4, b: 'S', oxB: 6 }).product.names.tradicional).toBe('sulfato cérico');
    expect(ok({ route: 'metal-o2', a: 'Nd', oxA: 3 }).equation).toBe('4 Nd + 3 O₂ → 2 Nd₂O₃');
    expect(ok({ route: 'neutralizacion', a: 'Tl', oxA: 1, b: 'S', oxB: 6 }).product.notes.join(' ')).toMatch(/talio son muy tóxicos/);
    expect(ok({ route: 'metal-o2', a: 'Po', oxA: 4 }).product.notes.join(' ')).toMatch(/radiactivo/);
  });

  it('no metales y metaloides nuevos: As, Se y Te (óxidos, oxácidos, hidrácidos, sales) y su vía de obtención', () => {
    expect(ok({ route: 'nometal-o2', a: 'As', oxA: 3 }).pathway).toBe('directa');
    expect(ok({ route: 'anhidrido-agua', a: 'As', oxA: 5 }).equation).toBe('As₂O₅ + 3 H₂O → 2 H₃AsO₄');
    expect(ok({ route: 'anhidrido-agua', a: 'Se', oxA: 6 }).product.names.tradicional).toBe('ácido selénico');
    expect(ok({ route: 'h2-nometal', a: 'Se', oxA: -2 }).equation).toBe('H₂ + Se → H₂Se');
    expect(ok({ route: 'h2-nometal', a: 'As', oxA: -3 }).product.names.sistematica).toBe('arsano');
    expect(ok({ route: 'neutralizacion', a: 'Na', oxA: 1, b: 'Se', oxB: 4 }).product.names.stock).toBe('selenito de sodio');
    expect(ok({ route: 'neutralizacion', a: 'Zn', oxA: 2, b: 'Se', oxB: -2 }).equation).toBe('H₂Se + Zn(OH)₂ → ZnSe + 2 H₂O');
    const te = ok({ route: 'anhidrido-agua', a: 'Te', oxA: 6 });
    expect(te.product.notes.join(' ')).toMatch(/H₆TeO₆/);
  });
});

describe('taller · rechazos con explicación pedagógica', () => {
  const cases: [ForgeInput, ForgeError['code'], RegExp][] = [
    [{ route: 'metal-o2', a: 'He', oxA: 2 }, 'gas-noble', /capa de valencia completa/],
    [{ route: 'neutralizacion', a: 'Ar', oxA: 1, b: 'S', oxB: 6 }, 'gas-noble', /gas noble/],
    [{ route: 'nometal-o2', a: 'Xe', oxA: 6 }, 'gas-noble', /xenón/],
    [{ route: 'metal-o2', a: 'Ca', oxA: 3 }, 'estado-inexistente', /no presenta el número de oxidación \+3/],
    [{ route: 'metal-o2', a: 'Na', oxA: 2 }, 'estado-inexistente', /un solo electrón de valencia/],
    [{ route: 'metal-o2', a: 'Fe', oxA: 6 }, 'estado-raro', /ferratos/],
    [{ route: 'anhidrido-agua', a: 'Fe', oxA: 3 }, 'metal-sin-oxacido', /Cr\(\+6\)/],
    [{ route: 'anhidrido-agua', a: 'Cr', oxA: 3 }, 'metal-sin-oxacido', /anfótero/],
    [{ route: 'anhidrido-agua', a: 'C', oxA: 2 }, 'oxido-neutro', /óxido neutro/],
    [{ route: 'anhidrido-agua', a: 'N', oxA: 4 }, 'oxido-neutro', /dismuta/],
    [{ route: 'metal-nometal', a: 'Fe', oxA: 3, b: 'Cu', oxB: 2 }, 'dos-metales', /aleación/],
    [{ route: 'neutralizacion', a: 'Na', oxA: 1, b: 'Fe', oxB: 3 }, 'dos-metales', /aleación/],
    [{ route: 'metal-nometal', a: 'C', oxA: 4, b: 'Cl', oxB: -1 }, 'dos-no-metales', /compuesto molecular/],
    [{ route: 'metal-o2', a: 'S', oxA: 4 }, 'no-es-metal', /no metal/],
    [{ route: 'nometal-o2', a: 'Na', oxA: 1 }, 'no-es-no-metal', /metal/],
    [{ route: 'oxido-agua', a: 'S', oxA: 6 }, 'no-es-metal', /oxácido/],
    [{ route: 'metal-h2', a: 'Fe', oxA: 2 }, 'papel', /intersticiales/],
    [{ route: 'peroxido', a: 'Fe', oxA: 2 }, 'papel', /grupos 1 y 2/],
    [{ route: 'metal-o2', a: 'U', oxA: 4 }, 'fuera-del-taller', /UO₂/],
    [{ route: 'metal-o2', a: 'Tc', oxA: 7 }, 'fuera-del-taller', /pertecnetato/],
    [{ route: 'metal-o2', a: 'Pm', oxA: 3 }, 'fuera-del-taller', /sintético y radiactivo/],
    [{ route: 'metal-o2', a: 'Fr', oxA: 1 }, 'fuera-del-taller', /22 minutos/],
    [{ route: 'metal-o2', a: 'Ra', oxA: 2 }, 'fuera-del-taller', /bario/],
    [{ route: 'h2-nometal', a: 'At', oxA: -1 }, 'fuera-del-taller', /astato/],
    [{ route: 'metal-o2', a: 'Am', oxA: 3 }, 'fuera-del-taller', /actínido sintético/],
    [{ route: 'metal-o2', a: 'Ti', oxA: 5 }, 'estado-inexistente', /grupos 4 a 7/],
    [{ route: 'metal-o2', a: 'Ti', oxA: 2 }, 'estado-raro', /TiCl₂/],
    [{ route: 'metal-o2', a: 'Ga', oxA: 2 }, 'estado-inexistente', /tres electrones de valencia/],
    [{ route: 'peroxido', a: 'Be', oxA: 2 }, 'papel', /berilio/],
    [{ route: 'metal-h2', a: 'Be', oxA: 2 }, 'papel', /BeH₂/],
    [{ route: 'oxido-agua', a: 'Ge', oxA: 4 }, 'motor', /hidróxido definido/],
    [{ route: 'neutralizacion', a: 'Hf', oxA: 4, b: 'S', oxB: 6 }, 'motor', /no forma oxisales sencillas/],
    [{ route: 'oxido-agua', a: 'Mo', oxA: 6 }, 'papel', /ácido molíbdico/],
    [{ route: 'anhidrido-agua', a: 'Fe', oxA: 2 }, 'metal-sin-oxacido', /Mo\(\+6\) → H₂MoO₄/],
    [{ route: 'metal-o2', a: 'Og', oxA: 2 }, 'gas-noble', /sintético/],
    [{ route: 'metal-o2', a: 'Fl', oxA: 2 }, 'fuera-del-taller', /superpesado/],
    [{ route: 'nometal-o2', a: 'F', oxA: -1 }, 'papel', /OF₂/],
    [{ route: 'nometal-o2', a: 'F', oxA: 2 }, 'estado-inexistente', /siempre tiene −1/],
    [{ route: 'h2-nometal', a: 'Cl', oxA: 1 }, 'papel', /−1/],
    [{ route: 'metal-nometal', a: 'Na', oxA: 1, b: 'N', oxB: -3 }, 'papel', /nitruros/],
    [{ route: 'metal-nometal', a: 'Ga', oxA: 3, b: 'As', oxB: -3 }, 'papel', /GaAs/],
    [{ route: 'neutralizacion', a: 'Mn', oxA: 2, b: 'Mn', oxB: 7 }, 'papel', /a la vez el catión/],
    [{ route: 'metal-o2', a: null, oxA: null }, 'sin-elemento', /Elige/],
  ];
  it.each(cases)('%j → %s', (input, code, re) => {
    const r = bad(input);
    expect(r.code).toBe(code);
    expect(`${r.title} ${r.message}`).toMatch(re);
    expect(r.message.length).toBeGreaterThan(40);
  });

  it('77 elementos habilitados; los 41 que no (gases nobles, Fr, Ra, Tc, Pm, At, actínidos y superpesados) explican por qué', () => {
    expect(ENGINE_SYMBOLS.length).toBe(77);
    const off = PT_ELEMENTS.filter((e) => !KNOWN_STATES[e.sym]);
    expect(off.length).toBe(41);
    for (const e of off) {
      const ok = e.category === 'gas-noble' || e.z >= 104 || e.category === 'actinido' || EXCLUDED_REASON[e.sym];
      expect(ok, e.sym).toBeTruthy();
    }
    expect(Object.keys(KNOWN_STATES).sort()).toEqual([...ENGINE_SYMBOLS].sort());
    for (const [sym, r] of Object.entries(RARE_STATES)) for (const x of r.states) expect(KNOWN_STATES[sym].includes(x), `${sym} ${x}`).toBe(false);
  });

  it('todos los gases nobles y los elementos fuera del taller se rechazan con explicación en todas las rutas', () => {
    for (const e of PT_ELEMENTS) {
      if (KNOWN_STATES[e.sym]) continue;
      for (const route of ROUTES) {
        const r = forge({ route: route.id, a: e.sym, oxA: 2, b: 'Cl', oxB: -1 });
        expect(r.ok, `${e.sym} ${route.id}`).toBe(false);
        expect((r as ForgeError).code).toBe(e.category === 'gas-noble' ? 'gas-noble' : 'fuera-del-taller');
      }
    }
  });
});

describe('taller · conjunto finito: neutralidad, balanceo y nombres', () => {
  it('enumera las combinaciones válidas y reúne los compuestos de todas las ecuaciones', () => {
    console.log(`[taller] ${enumerateForgeInputs().length} entradas probadas → ${results.length} combinaciones válidas → ${compounds.length} compuestos distintos`);
    // v2.4.0 (31 elementos): 1196 combinaciones y 1066 compuestos; v2.5.0 (77 elementos): 3756 y 3329;
    // v2.8.0 (rutas «NH₃ + ácido» y «No metal + no metal»):
    expect(results.length).toBe(3824);
    expect(compounds.length).toBe(3397);
    // Cada elemento habilitado aparece en algún compuesto del taller.
    const used = new Set(compounds.flatMap((c) => Object.keys(c.composition)));
    expect(ENGINE_SYMBOLS.filter((x) => !used.has(x))).toEqual([]);
  });

  it('neutralidad de cargas: en cada compuesto Σ n·q = 0 y las partes reproducen la fórmula', () => {
    for (const c of compounds) {
      const parts = chargeParts(c);
      expect(parts.reduce((s, p) => s + p.count * p.charge, 0), c.key).toBe(0);
      expect(parts.every((p) => Number.isInteger(p.count) && p.count > 0), c.key).toBe(true);
    }
  });

  it('cada ecuación está balanceada con los menores enteros (método algebraico de balancing.ts)', () => {
    for (const r of results) {
      const side = (ts: ForgeOk['reactants']) => {
        const tot: Record<string, number> = {};
        for (const t of ts) for (const [k, v] of Object.entries(parseFormula(t.formula))) tot[k] = (tot[k] ?? 0) + v * t.coef;
        return tot;
      };
      expect(side(r.products), r.equation).toEqual(side(r.reactants));
      expect(gcdAll([...r.reactants, ...r.products].map((t) => t.coef)), r.equation).toBe(1);
    }
  });

  it('los nombres coinciden con los 149 casos de referencia para todos los compuestos que el taller también forma', () => {
    const casos: { spec: Spec; es: { sistematica: string; stock: string | null; tradicional: string | null } }[] = JSON.parse(readFileSync(new URL('../fixtures/quimica/nomenclatura-casos.json', import.meta.url), 'utf8'));
    const byKey = new Map(compounds.map((c) => [c.key, c]));
    let matched = 0;
    const errors: string[] = [];
    for (const k of casos) {
      const c = byKey.get(specKey(k.spec));
      if (!c) continue;
      matched++;
      if (c.names.sistematica !== k.es.sistematica) errors.push(`${c.formula}: ${c.names.sistematica} ≠ ${k.es.sistematica}`);
      if (c.names.stock !== k.es.stock) errors.push(`${c.formula}: ${c.names.stock} ≠ ${k.es.stock}`);
      if (c.names.tradicional !== k.es.tradicional) errors.push(`${c.formula}: ${c.names.tradicional} ≠ ${k.es.tradicional}`);
    }
    console.log(`[taller] ${matched} de ${casos.length} casos de referencia los forma también el taller; diferencias de nombre: ${errors.length}`);
    expect(errors).toEqual([]);
    expect(matched).toBeGreaterThanOrEqual(250);
  });

  it('la búsqueda exhaustiva (todos los elementos × todos los estados de la interfaz) no produce compuestos fuera del conjunto enumerado', () => {
    const keys = new Set(compounds.map((c) => c.key));
    const single = ROUTES.filter((r) => r.slots === 1);
    for (const r of single) for (const e of PT_ELEMENTS) for (const oxA of STATE_CHOICES) for (const form of ['normal', 'meta', 'di'] as const) for (const hLeft of r.id === 'amoniaco-acido' ? [0, 1, 2] : [0]) {
      const out = forge({ route: r.id, a: e.sym, oxA, form, hLeft });
      if (out.ok) expect(keys.has(out.product.key), `${r.id} ${e.sym} ${oxA} ${form} H${hLeft}`).toBe(true);
    }
    // Rutas de dos casillas: un estado que el elemento no presenta se rechaza siempre (stateGate), así que basta con
    // recorrer sus estados conocidos más uno inexistente, para las dos casillas.
    const states = (x: string) => [...KNOWN_STATES[x], ...STATE_CHOICES.filter((v) => !KNOWN_STATES[x].includes(v)).slice(0, 1)];
    for (const a of Object.keys(KNOWN_STATES)) for (const oxA of states(a)) for (const b of Object.keys(KNOWN_STATES)) for (const oxB of states(b)) {
      const s = forge({ route: 'metal-nometal', a, oxA, b, oxB });
      if (s.ok) expect(keys.has(s.product.key)).toBe(true);
      const nn = forge({ route: 'nometal-nometal', a, oxA, b, oxB });
      if (nn.ok) expect(keys.has(nn.product.key), `nometal-nometal ${a}${oxA} ${b}${oxB}`).toBe(true);
      for (const hLeft of [0, 1, 2]) for (const form of ['normal', 'meta', 'di'] as const) {
        const n = forge({ route: 'neutralizacion', a, oxA, b, oxB, hLeft, form });
        if (n.ok) expect(keys.has(n.product.key), `${a}${oxA} ${b}${oxB} H${hLeft} ${form}`).toBe(true);
      }
    }
  }, 120_000);

  it('retos: cada reto se puede lograr con alguna combinación del taller', () => {
    for (const ch of FORGE_CHALLENGES) expect(results.some((r) => challengeMet(ch, r)), ch.id).toBe(true);
    expect(challengeMet(FORGE_CHALLENGES.find((c) => c.id === 'sal-cocina')!, ok({ route: 'neutralizacion', a: 'Na', oxA: 1, b: 'Cl', oxB: -1 }))).toBe(false);
  });
});

describe('taller · registro en PubChem (archivo precalculado con consultas reales)', () => {
  const entries = registryEntries();
  it('el archivo cubre exactamente los compuestos del taller, con fecha, fuente y totales coherentes', () => {
    expect(REGISTRY_META.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(REGISTRY_META.fuente).toMatch(/PubChem PUG REST/);
    expect(Object.keys(entries).sort()).toEqual(compounds.map((c) => c.key).sort());
    const reg = Object.values(entries).filter((e) => e.cid !== null).length;
    expect(REGISTRY_META.registrados).toBe(reg);
    expect(REGISTRY_META.formales).toBe(compounds.length - reg);
    expect(REGISTRY_META.total).toBe(compounds.length);
    const vals = Object.values(entries);
    expect(REGISTRY_META.porNombre).toBe(vals.filter((e) => e.via === 'nombre').length);
    expect(REGISTRY_META.porSinonimo).toBe(vals.filter((e) => e.via === 'formula-sinonimo').length);
    expect(REGISTRY_META.soloFormula).toBe(vals.filter((e) => e.via === 'formula').length);
    expect(REGISTRY_META.porNombre + REGISTRY_META.porSinonimo + REGISTRY_META.soloFormula).toBe(reg);
    expect(REGISTRY_META.conDescartes).toBe(vals.filter((e) => e.descartados?.length).length);
    console.log(`[taller] PubChem ${REGISTRY_META.fecha}: ${REGISTRY_META.porNombre + REGISTRY_META.porSinonimo} registrados (${REGISTRY_META.porNombre} por nombre y ${REGISTRY_META.porSinonimo} por fórmula + sinónimo), ${REGISTRY_META.soloFormula} fórmulas registradas sin coincidencia de nombre, ${compounds.length - reg} fórmulas formales de ${compounds.length}; ${REGISTRY_META.conDescartes} con registros descartados por ser otra estructura`);
  });

  it('cada CID es un entero positivo con la misma fórmula de Hill (o un múltiplo entero) y los formales no tienen CID', () => {
    const byKey = new Map(compounds.map((c) => [c.key, c]));
    for (const [key, e] of Object.entries(entries)) {
      const c = byKey.get(key)!;
      expect(e.hill, key).toBe(hillFormula(c.composition));
      if (e.cid === null) { expect(e.formulaPubChem, key).toBeUndefined(); continue; }
      expect(Number.isInteger(e.cid) && e.cid > 0, key).toBe(true);
      if (e.relacion === 'igual') expect(e.formulaPubChem, key).toBe(e.hill);
      else {
        const p = parseFormula(e.formulaPubChem!);
        const k = p[Object.keys(c.composition)[0]] / c.composition[Object.keys(c.composition)[0]];
        expect(Number.isInteger(k) && k > 1, key).toBe(true);
        for (const [el, n] of Object.entries(c.composition)) expect(p[el], key).toBe(n * k);
      }
      expect(['nombre', 'formula-sinonimo', 'formula']).toContain(e.via);
      // Regla de pubchemNameMatch.ts: el sinónimo guardado coincide en forma canónica con el nombre del motor, y ningún
      // CID aceptado por la fórmula describe otra clase de sustancia.
      if (e.via === 'formula-sinonimo') expect(canonName(e.sinonimo!), key).toBe(canonName(e.nombreMotor!));
      if (e.via !== 'nombre') expect(otherStructure(c.fn, e.titulo ?? '', e.iupac ?? ''), key).toBeNull();
    }
    for (const [key, e] of Object.entries(entries)) for (const d of e.descartados ?? []) expect(otherStructure(byKey.get(key)!.fn, d.titulo, d.iupac ?? ''), key).not.toBeNull();
  });

  it('la marca de la interfaz es coherente con el archivo («registrado (CID …)» o «fórmula formal»)', () => {
    for (const c of compounds) {
      const st = registryStatus(c.key);
      const t = registryText(c.key);
      if (st.status === 'registrado') { expect(['nombre', 'formula-sinonimo']).toContain(st.entry.via); expect(t.title).toBe(`Compuesto registrado en PubChem (CID ${st.entry.cid})`); }
      else if (st.status === 'misma-formula') { expect(st.entry.via).toBe('formula'); expect(t.title).toMatch(/^Fórmula registrada en PubChem \(CID \d+\), sin coincidencia de nombre$/); }
      else { expect(st.status).toBe('formal'); expect(t.title).toMatch(/^Fórmula formal por neutralidad de cargas: no se encontró como sustancia registrada; puede no existir o ser inestable/); }
    }
    for (const s of [{ kind: 'oxido', el: 'Ca', ox: 2 }, { kind: 'oxacido', el: 'S', ox: 6 }, { kind: 'oxisal', cation: { el: 'Ca', ox: 2 }, acid: { el: 'S', ox: 6 } }, { kind: 'hidruro', el: 'O' }, { kind: 'sal-binaria', cation: { el: 'Na', ox: 1 }, anion: 'Cl' }] as Spec[]) {
      expect(registryStatus(buildCompound(s).key).status, specKey(s)).toBe('registrado');
    }
    // CID leídos del archivo real (consulta 2026-10-25), comprobables en PubChem.
    const cid = (k: string) => registryEntries()[k].cid;
    expect([cid('oxido:Ca2'), cid('hidroxido:Ca2'), cid('oxido:S6'), cid('oxacido:S6'), cid('oxisal:Ca2-S6'), cid('hidruro:O'), cid('sal:Na1-Cl')]).toEqual([14778, 6093208, 24682, 1118, 24497, 962, 5234]);
  });
});

describe('taller · vistas 3D sin coordenadas a mano', () => {
  it('compuesto: red cristalina, confórmero de PubChem, VSEPR generada, ion poliatómico o sin geometría', () => {
    const view = (s: Spec) => staticView(buildCompound(s));
    expect(view({ kind: 'oxido', el: 'Ca', ox: 2 }).kind).toBe('cristal');
    const h2so4 = view({ kind: 'oxacido', el: 'S', ox: 6 });
    expect(h2so4.kind === 'molecula' && h2so4.species.geometry).toBe('pubchem');
    const hbro3 = view({ kind: 'oxacido', el: 'Br', ox: 5 });
    expect(hbro3.kind === 'molecula' && hbro3.species.geometry).toBe('vsepr');
    expect(view({ kind: 'oxisal', cation: { el: 'Ca', ox: 2 }, acid: { el: 'S', ox: 6 } }).kind).toBe('ionico');
    expect(view({ kind: 'oxido', el: 'Cl', ox: 5 }).kind).toBe('sin-geometria');
    // v2.8.0: el SiO₂ ya no queda «sin geometría»: se dibuja la red covalente del cuarzo α (estructura publicada).
    const si = view({ kind: 'oxido', el: 'Si', ox: 4 });
    expect(si.kind === 'cristal' && si.crystal.id).toBe('sio2');
    const p = view({ kind: 'oxido', el: 'P', ox: 5 });
    expect(p.kind === 'molecula' && p.species.label).toBe('P₄O₁₀');
  });

  it('reacción 3D con átomos conservados en el recorrido del docente; P₂O₅ se anima con la molécula real P₄O₁₀', () => {
    for (const i of [{ route: 'metal-o2', a: 'Ca', oxA: 2 }, { route: 'oxido-agua', a: 'Ca', oxA: 2 }, { route: 'nometal-o2', a: 'S', oxA: 6 }, { route: 'anhidrido-agua', a: 'S', oxA: 6 }, { route: 'neutralizacion', a: 'Ca', oxA: 2, b: 'S', oxB: 6 }] as ForgeInput[]) {
      const rx = forgeReaction3D(ok(i));
      expect('def' in rx, JSON.stringify(i)).toBe(true);
    }
    const p = forgeReaction3D(ok({ route: 'anhidrido-agua', a: 'P', oxA: 5 }));
    expect('def' in p && p.def.reactants[0].formula).toBe('P4O10');
    const cl = forgeReaction3D(ok({ route: 'anhidrido-agua', a: 'Cl', oxA: 5 }));
    expect('reason' in cl && cl.reason).toMatch(/No hay geometría fiable/);
  });

  it('ninguna combinación rompe el constructor 3D (o anima, o explica por qué no)', () => {
    let animated = 0;
    for (const r of results) {
      const rx = forgeReaction3D(r);
      if ('def' in rx) animated++; else expect(rx.reason.length).toBeGreaterThan(20);
      staticView(r.product);
    }
    console.log(`[taller] reacción 3D disponible en ${animated} de ${results.length} combinaciones`);
    expect(animated).toBeGreaterThan(100);
  });
});

describe('taller · sales de amonio (ruta «NH₃ + ácido»)', () => {
  it('cloruro, nitrato, sulfato y carbonato de amonio: ecuación, nombres y vía de obtención', () => {
    const cl = ok({ route: 'amoniaco-acido', a: 'Cl', oxA: -1 });
    expect(cl.equation).toBe('NH₃ + HCl → NH₄Cl');
    expect([cl.product.names.stock, cl.product.names.tradicional]).toEqual(['cloruro de amonio', 'cloruro amónico']);
    expect(cl.pathway).toBe('directa');
    expect(cl.pathwayNote).toMatch(/humo blanco/);
    const no3 = ok({ route: 'amoniaco-acido', a: 'N', oxA: 5 });
    expect(no3.equation).toBe('NH₃ + HNO₃ → NH₄NO₃');
    expect(no3.product.names.stock).toBe('nitrato de amonio');
    const so4 = ok({ route: 'amoniaco-acido', a: 'S', oxA: 6 });
    expect(so4.equation).toBe('2 NH₃ + H₂SO₄ → (NH₄)₂SO₄');
    expect([so4.product.names.sistematica, so4.product.names.stock]).toEqual(['sulfato de diamonio', 'sulfato de amonio']);
    const co3 = ok({ route: 'amoniaco-acido', a: 'C', oxA: 4 });
    expect(co3.equation).toBe('2 NH₃ + H₂CO₃ → (NH₄)₂CO₃');
    expect(co3.pathway).toBe('condiciones');
    expect(co3.notes.join(' ')).toMatch(/carbamato de amonio/);
    // Sales ácidas: bicarbonato de amonio y los fertilizantes DAP y MAP.
    expect(ok({ route: 'amoniaco-acido', a: 'C', oxA: 4, hLeft: 1 }).product.formula).toBe('NH4HCO3');
    expect(ok({ route: 'amoniaco-acido', a: 'P', oxA: 5, hLeft: 1 }).product.formula).toBe('(NH4)2HPO4');
    expect(ok({ route: 'amoniaco-acido', a: 'P', oxA: 5, hLeft: 2 }).product.formula).toBe('NH4H2PO4');
  });

  it('neutralidad con el NH₄⁺ (también cuando el N está en el catión y en el anión: NH₄NO₃, NH₄NO₂)', () => {
    const parts = (i: ForgeInput) => chargeParts(ok(i).product).map((p) => `${p.count}×${p.label}`).join(' ');
    expect(parts({ route: 'amoniaco-acido', a: 'N', oxA: 5 })).toBe('1×NH₄⁺ 1×NO₃⁻');
    expect(parts({ route: 'amoniaco-acido', a: 'N', oxA: 3 })).toBe('1×NH₄⁺ 1×NO₂⁻');
    expect(parts({ route: 'amoniaco-acido', a: 'S', oxA: 6 })).toBe('2×NH₄⁺ 1×SO₄²⁻');
    expect(parts({ route: 'amoniaco-acido', a: 'Cl', oxA: -1 })).toBe('1×NH₄⁺ 1×Cl⁻');
  });

  it('el NH₄⁺ se dibuja con sus cuatro enlaces N–H (biblioteca del kit) y la reacción 3D conserva los átomos', () => {
    for (const i of [{ route: 'amoniaco-acido', a: 'Cl', oxA: -1 }, { route: 'amoniaco-acido', a: 'N', oxA: 5 }, { route: 'amoniaco-acido', a: 'S', oxA: 6 }, { route: 'amoniaco-acido', a: 'C', oxA: 4 }] as ForgeInput[]) {
      const r = ok(i);
      const v = staticView(r.product);
      expect(v.kind, JSON.stringify(i)).toBe('ionico');
      if (v.kind !== 'ionico') continue;
      const nh4 = v.ions.find((x) => x.id === 'amonio')!;
      expect(nh4.atoms.map((a) => a.el).sort()).toEqual(['H', 'H', 'H', 'H', 'N']);
      expect(nh4.bonds).toHaveLength(4);
      expect(v.note).toMatch(/gira o se desordena/);
      expect('def' in forgeReaction3D(r), JSON.stringify(i)).toBe(true);
    }
    // Con un oxoanión se dibujan los dos iones poliatómicos (NH₄⁺ y NO₃⁻).
    const n = staticView(ok({ route: 'amoniaco-acido', a: 'N', oxA: 5 }).product);
    expect(n.kind === 'ionico' && n.ions.map((x) => x.label)).toEqual(['NH₄⁺', 'NO₃⁻']);
  });

  it('rechaza con explicación: metales, el propio NH₃, el oxígeno, óxidos neutros y sales ácidas de hidrácidos', () => {
    expect(bad({ route: 'amoniaco-acido', a: 'Na', oxA: 1 }).code).toBe('dos-metales');
    expect(bad({ route: 'amoniaco-acido', a: 'N', oxA: -3 }).title).toMatch(/no es un ácido/);
    expect(bad({ route: 'amoniaco-acido', a: 'O', oxA: -2 }).code).toBe('papel');
    expect(bad({ route: 'amoniaco-acido', a: 'C', oxA: 2 }).code).toBe('oxido-neutro');
    expect(bad({ route: 'amoniaco-acido', a: 'Cl', oxA: -1, hLeft: 1 }).title).toMatch(/Sal ácida/);
    // Un metal en estado alto sí forma ácido: permanganato de amonio, con su nota de inestabilidad.
    const mn = ok({ route: 'amoniaco-acido', a: 'Mn', oxA: 7 });
    expect(mn.product.formula).toBe('NH4MnO4');
    expect(mn.notes.join(' ')).toMatch(/explosiva/);
  });
});

describe('taller · compuestos binarios entre no metales (ruta «No metal + no metal»)', () => {
  it('PCl₃, PCl₅, CCl₄, CS₂, SF₆, BF₃ y NF₃: ecuación, nombres, vía y molécula VSEPR', () => {
    const cases: [ForgeInput, string, string, string][] = [
      [{ route: 'nometal-nometal', a: 'P', oxA: 3, b: 'Cl', oxB: -1 }, '2 P + 3 Cl₂ → 2 PCl₃', 'tricloruro de fósforo', 'directa'],
      [{ route: 'nometal-nometal', a: 'P', oxA: 5, b: 'Cl', oxB: -1 }, '2 P + 5 Cl₂ → 2 PCl₅', 'pentacloruro de fósforo', 'directa'],
      [{ route: 'nometal-nometal', a: 'C', oxA: 4, b: 'Cl', oxB: -1 }, 'C + 2 Cl₂ → CCl₄', 'tetracloruro de carbono', 'formal'],
      [{ route: 'nometal-nometal', a: 'C', oxA: 4, b: 'S', oxB: -2 }, 'C + 2 S → CS₂', 'disulfuro de carbono', 'condiciones'],
      [{ route: 'nometal-nometal', a: 'S', oxA: 6, b: 'F', oxB: -1 }, 'S + 3 F₂ → SF₆', 'hexafluoruro de azufre', 'directa'],
      [{ route: 'nometal-nometal', a: 'B', oxA: 3, b: 'F', oxB: -1 }, '2 B + 3 F₂ → 2 BF₃', 'trifluoruro de boro', 'directa'],
      [{ route: 'nometal-nometal', a: 'N', oxA: 3, b: 'F', oxB: -1 }, 'N₂ + 3 F₂ → 2 NF₃', 'trifluoruro de nitrógeno', 'formal'],
    ];
    for (const [i, eq, name, path] of cases) {
      const r = ok(i);
      expect([r.equation, r.product.names.sistematica, r.pathway], JSON.stringify(i)).toEqual([eq, name, path]);
      expect(r.product.fn).toBe('binario-no-metalico');
    }
    // Geometría VSEPR: número de dominios = enlaces + pares libres del átomo central.
    const shape = (i: ForgeInput) => { const v = staticView(ok(i).product); return v.kind === 'molecula' ? [v.species.geometry, v.species.atoms.length, v.species.bonds.length] : v.kind; };
    expect(shape(cases[0][0])).toEqual(['vsepr', 4, 3]); // PCl₃ piramidal (1 par libre)
    expect(shape(cases[1][0])).toEqual(['vsepr', 6, 5]); // PCl₅ bipirámide trigonal
    expect(shape(cases[4][0])).toEqual(['vsepr', 7, 6]); // SF₆ octaédrica
    const cs2 = staticView(ok(cases[3][0]).product);
    expect(cs2.kind === 'molecula' && cs2.species.bonds.map((b) => b.order)).toEqual([2, 2]); // S=C=S
  });

  it('rechaza con explicación: orden de electronegatividad, metales, oxígeno, hidrógeno y combinaciones fuera del taller', () => {
    expect(bad({ route: 'nometal-nometal', a: 'Cl', oxA: -1, b: 'P', oxB: 3 }).title).toMatch(/menos electronegativo va en la casilla 1/);
    expect(bad({ route: 'nometal-nometal', a: 'Na', oxA: 1, b: 'Cl', oxB: -1 }).code).toBe('no-es-no-metal');
    expect(bad({ route: 'nometal-nometal', a: 'C', oxA: 4, b: 'O', oxB: -2 }).hint).toMatch(/No metal \+ O₂/);
    expect(bad({ route: 'nometal-nometal', a: 'H', oxA: 1, b: 'Cl', oxB: -1 }).hint).toMatch(/H₂ \+ halógeno/);
    expect(bad({ route: 'nometal-nometal', a: 'S', oxA: 4, b: 'Cl', oxB: -1 }).message).toMatch(/S₂Cl₂/);
    expect(bad({ route: 'nometal-nometal', a: 'P', oxA: 4, b: 'Cl', oxB: -1 }).code).toBe('estado-inexistente');
    expect(bad({ route: 'nometal-nometal', a: 'P', oxA: -3, b: 'Cl', oxB: -1 }).title).toMatch(/actúa con \+3, \+5/);
    // La ruta «Metal + no metal» con dos no metales remite a la ruta nueva.
    expect(bad({ route: 'metal-nometal', a: 'C', oxA: 4, b: 'Cl', oxB: -1 }).hint).toMatch(/No metal \+ no metal/);
  });

  it('óxidos de los no metales (CO, CO₂, NO, N₂O, SO₂): siguen en «No metal + O₂», con su vía de obtención', () => {
    expect(ok({ route: 'nometal-o2', a: 'N', oxA: 1 }).pathwayNote).toMatch(/NH₄NO₃ → N₂O \+ 2 H₂O/);
    expect(ok({ route: 'nometal-o2', a: 'N', oxA: 4 }).pathway).toBe('condiciones');
    for (const [a, oxA, f] of [['C', 2, 'CO'], ['C', 4, 'CO2'], ['N', 2, 'NO'], ['N', 1, 'N2O'], ['S', 4, 'SO2']] as const) {
      const r = ok({ route: 'nometal-o2', a, oxA });
      expect(r.product.formula).toBe(f);
      expect(staticView(r.product).kind).toBe('molecula');
    }
  });
});
