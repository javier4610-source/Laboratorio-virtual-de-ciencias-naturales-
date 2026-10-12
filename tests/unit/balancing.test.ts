import { describe, expect, it } from 'vitest';
import {
  allSpecies, ATOMIC_MASS, checkEquation, countSides, CPK, elementsOf, equationText, gcd, gcdAll, hintFor, LAYOUTS,
  molarMass, nullspace, parseFormula, prettyFormula, reactionById, REACTIONS, sideMasses, solveBalance, tiltAngle,
} from '../../src/models/balancing';

const ones = (id: string) => allSpecies(reactionById(id)).map(() => 1);

describe('analizador de fórmulas', () => {
  it('cuenta átomos con subíndices, paréntesis, corchetes e hidratos', () => {
    expect(parseFormula('H2O')).toEqual({ H: 2, O: 1 });
    expect(parseFormula('Ca(OH)2')).toEqual({ Ca: 1, O: 2, H: 2 });
    expect(parseFormula('Ca3(PO4)2')).toEqual({ Ca: 3, P: 2, O: 8 });
    expect(parseFormula('K4[Fe(CN)6]')).toEqual({ K: 4, Fe: 1, C: 6, N: 6 });
    expect(parseFormula('CuSO4·5H2O')).toEqual({ Cu: 1, S: 1, O: 9, H: 10 });
    expect(parseFormula('CuSO4*5H2O')).toEqual(parseFormula('CuSO4·5H2O'));
    expect(parseFormula('CH3COOH')).toEqual({ C: 2, H: 4, O: 2 });
    expect(parseFormula('C₆H₁₂O₆')).toEqual({ C: 6, H: 12, O: 6 });
  });

  it('rechaza fórmulas inválidas con mensajes en español', () => {
    expect(() => parseFormula('Xy2')).toThrow(/Elemento desconocido/);
    expect(() => parseFormula('Ca(OH2')).toThrow(/Paréntesis/);
    expect(() => parseFormula('CaOH)2')).toThrow(/Paréntesis/);
    expect(() => parseFormula('K4[Fe(CN)6)')).toThrow(/Paréntesis/);
    expect(() => parseFormula('')).toThrow(/vacía/);
    expect(() => parseFormula('h2o')).toThrow(/Carácter no válido/);
    expect(() => parseFormula('H0')).toThrow(/cero/);
  });

  it('calcula masas molares y da formato con subíndices', () => {
    expect(molarMass('H2O')).toBeCloseTo(18.015, 3);
    expect(molarMass('C6H12O6')).toBeCloseTo(180.156, 3);
    expect(molarMass('Ca3(PO4)2')).toBeCloseTo(3 * 40.078 + 2 * 30.974 + 8 * 15.999, 6);
    expect(molarMass('CuSO4·5H2O')).toBeCloseTo(249.68, 1);
    expect(prettyFormula('Ca3(PO4)2')).toBe('Ca₃(PO₄)₂');
  });
});

describe('conteo de átomos por lado', () => {
  it('síntesis del agua con coeficientes 1: sobra un oxígeno en los reactivos', () => {
    const r = reactionById('agua');
    expect(elementsOf(r)).toEqual(['H', 'O']);
    expect(countSides(r, [1, 1, 1])).toEqual([
      { element: 'H', left: 2, right: 2, diff: 0 },
      { element: 'O', left: 2, right: 1, diff: -1 },
    ]);
    expect(countSides(r, [2, 1, 2]).every((x) => x.diff === 0)).toBe(true);
  });

  it('cuenta los átomos de paréntesis multiplicados por el coeficiente', () => {
    const r = reactionById('fosfato');
    const rows = Object.fromEntries(countSides(r, [3, 2, 1, 6]).map((x) => [x.element, x]));
    expect(rows.Ca).toMatchObject({ left: 3, right: 3 });
    expect(rows.O).toMatchObject({ left: 3 * 2 + 2 * 4, right: 8 + 6 });
    expect(rows.H).toMatchObject({ left: 6 + 6, right: 12 });
    expect(rows.P).toMatchObject({ left: 2, right: 2 });
  });

  it('valida que los coeficientes sean enteros entre 1 y 12', () => {
    const r = reactionById('agua');
    expect(() => countSides(r, [0, 1, 1])).toThrow(RangeError);
    expect(() => countSides(r, [13, 1, 1])).toThrow(RangeError);
    expect(() => countSides(r, [1.5, 1, 1])).toThrow(/entero/);
    expect(() => countSides(r, [1, 1])).toThrow(/3 coeficientes/);
  });
});

describe('solucionador algebraico (espacio nulo exacto)', () => {
  it('encuentra la respuesta única de las 12 reacciones', () => {
    expect(REACTIONS).toHaveLength(12);
    for (const r of REACTIONS) {
      const s = solveBalance(r);
      expect(s.nullity, r.id).toBe(1);
      expect(s.unique, r.id).toBe(true);
      expect(s.coefficients, r.id).toEqual(r.answer);
      expect(checkEquation(r, r.answer).status, r.id).toBe('balanceada');
    }
  });

  it('el espacio nulo de una matriz conocida es correcto y entero', () => {
    // 2a = 2c (H); 2b = c (O) → (2, 1, 2)
    expect(nullspace([[2, 0, -2], [0, 2, -1]])).toEqual([[2, 1, 2]]);
    // dos ecuaciones independientes en 4 incógnitas → dimensión 2
    expect(nullspace([[1, -1, 0, 0], [0, 0, 1, -1]])).toHaveLength(2);
  });

  it('escribe el sistema de ecuaciones por elemento', () => {
    expect(solveBalance(reactionById('agua')).equations).toEqual(['H: 2a = 2c', 'O: 2b = c']);
  });
});

describe('menores enteros (mcd)', () => {
  it('mcd y verificación de la forma mínima', () => {
    expect(gcd(12, 18)).toBe(6);
    expect(gcdAll([4, 2, 4])).toBe(2);
    expect(gcdAll([2, 1, 2])).toBe(1);
    const r = reactionById('agua');
    const doubled = checkEquation(r, [4, 2, 4]);
    expect(doubled.balanced).toBe(true);
    expect(doubled.minimal).toBe(false);
    expect(doubled.status).toBe('no minima');
    expect(doubled.multiple).toBe(2);
    for (const x of REACTIONS) expect(gcdAll(x.answer), x.id).toBe(1);
  });
});

describe('conservación de la masa (Lavoisier)', () => {
  it('en toda ecuación balanceada la masa de reactivos es igual a la de productos', () => {
    for (const r of REACTIONS) {
      const m = sideMasses(r, r.answer);
      expect(m.products, r.id).toBeCloseTo(m.reactants, 9);
      const k3 = sideMasses(r, r.answer.map((c) => c * 2));
      expect(k3.reactants, r.id).toBeCloseTo(2 * m.reactants, 9);
    }
  });

  it('caso a mano: 2 H₂ + O₂ → 2 H₂O pesa 36,03 g por lado; con coeficientes 1 falta un O (15,999 g)', () => {
    const r = reactionById('agua');
    const ok = checkEquation(r, [2, 1, 2]);
    expect(ok.massReactants).toBe(36.03);
    expect(ok.massProducts).toBe(36.03);
    expect(ok.massDifference).toBe(0);
    const bad = checkEquation(r, [1, 1, 1]);
    expect(bad.mass.difference).toBeCloseTo(-ATOMIC_MASS.O, 9);
    expect(bad.massDifference).toBe(-16);
    expect(bad.imbalance).toBe(1);
    expect(bad.atomsLeft).toBe(4);
    expect(bad.atomsRight).toBe(3);
  });

  it('la balanza se inclina hacia el lado más pesado y se nivela al balancear', () => {
    expect(tiltAngle(34.014, 18.015, false)).toBeLessThan(-2);
    expect(tiltAngle(18, 34, false)).toBeGreaterThan(2);
    expect(tiltAngle(36.03, 36.03, true)).toBe(0);
    expect(Math.abs(tiltAngle(372.1, 373.1, false))).toBe(2); // diferencia diminuta: mínimo visible
    expect(Math.abs(tiltAngle(1, 1000, false))).toBeLessThanOrEqual(14);
  });
});

describe('pistas, texto y dibujos', () => {
  it('la pista señala el elemento más desbalanceado y el lado al que le faltan átomos', () => {
    const h = hintFor(reactionById('agua'), [1, 1, 1]);
    expect(h.element).toBe('O');
    expect(h.text).toMatch(/Faltan 1 en los productos/);
    expect(h.text).toMatch(/H₂O/);
    const p = hintFor(reactionById('propano'), ones('propano'));
    expect(p.element).toBe('H'); // H: 8 frente a 2 (diferencia 6)
    expect(hintFor(reactionById('agua'), [4, 2, 4]).text).toMatch(/dividir entre 2/);
    expect(hintFor(reactionById('agua'), [2, 1, 2]).element).toBeNull();
  });

  it('escribe la ecuación omitiendo el coeficiente 1', () => {
    expect(equationText(reactionById('agua'), [2, 1, 2])).toBe('2 H₂ + O₂ → 2 H₂O');
    expect(equationText(reactionById('fosfato'), [3, 2, 1, 6])).toBe('3 Ca(OH)₂ + 2 H₃PO₄ → Ca₃(PO₄)₂ + 6 H₂O');
  });

  it('cada modelo de esferas y varillas tiene exactamente los átomos de su fórmula y color CPK', () => {
    for (const r of REACTIONS) {
      for (const s of allSpecies(r)) {
        const l = LAYOUTS[s.formula];
        expect(l, s.formula).toBeDefined();
        const count: Record<string, number> = {};
        for (const [el] of l.atoms) { count[el] = (count[el] ?? 0) + 1; expect(CPK[el], el).toBeDefined(); }
        expect(count, s.formula).toEqual(parseFormula(s.formula));
        for (const [i, j] of l.bonds) expect(i !== j && i < l.atoms.length && j < l.atoms.length, s.formula).toBe(true);
      }
    }
  });
});
