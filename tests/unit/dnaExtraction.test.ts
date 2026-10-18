import { describe, expect, it } from 'vitest';
import {
  BASES, DNA_EXTRACTION_INSTRUMENTS, EXTRACTION_LIMITS, FRUITS, appearanceOf, baseCounts, chargaff, checkDuplex, complementBase,
  complementStrand, detergentFactor, dnaExtractionModelSpec, ethanolFactor, gcPercent, hydrogenBonds, mashFactor, normalizeSequence,
  reverseComplement, saltFactor, simulateExtraction, wallaceTm, yieldReading, type Base, type ExtractionInput,
} from '../../src/models/dnaExtraction';

const base: ExtractionInput = { fruit: 'fresa', salt: 1.5, detergent: 10, ethanolT: 4, mash: 2 };
const seq = (s: string) => s.split('') as Base[];

describe('extracción de ADN: modelo semicuantitativo de factores', () => {
  it('factores calculados a mano', () => {
    expect(detergentFactor(10)).toBeCloseTo(0.05 + (0.95 * 10) / 12, 12); // ≈ 0,8417
    expect(detergentFactor(0)).toBeCloseTo(0.05, 12);
    expect(saltFactor(1.5)).toBeCloseTo(0.775, 12);
    expect(saltFactor(0)).toBeCloseTo(0.1, 12);
    expect(ethanolFactor(10)).toBeCloseTo(0.35 + 0.65 / 2, 12); // 0,675 en el centro de la transición
    expect(mashFactor(0, 0.5)).toBe(0);
    expect(mashFactor(2, 0.5)).toBeCloseTo((1 - Math.exp(-4)) * Math.exp(-0.2), 12);
  });

  it('índice de las condiciones iniciales (fresa, 1,5 g de sal, 10 mL de detergente, 4 °C, 2 min) = 43 u.a.', () => {
    const r = simulateExtraction(base);
    const expected = 100 * 1 * (0.05 + 9.5 / 12) * (1 - Math.exp(-4)) * Math.exp(-0.2) * 0.775 * (0.35 + 0.65 / (1 + Math.exp(-1)));
    expect(r.yieldIndex).toBeCloseTo(expected, 10);
    expect(yieldReading(r.yieldIndex)).toBe(43);
    expect(r.appearance).toBe('Hebras blancas que se enrollan en la varilla');
    expect(r.limiting).toBe('sal');
  });

  it('más sal, más detergente y alcohol más frío nunca disminuyen el índice (monotonía)', () => {
    let prev = -1;
    for (let s = 0; s <= 5; s += 0.5) { const y = simulateExtraction({ ...base, salt: s }).yieldIndex; expect(y).toBeGreaterThan(prev); prev = y; }
    prev = -1;
    for (let d = 0; d <= 20; d += 1) { const y = simulateExtraction({ ...base, detergent: d }).yieldIndex; expect(y).toBeGreaterThan(prev); prev = y; }
    prev = Infinity;
    for (let t = -18; t <= 30; t += 2) { const y = simulateExtraction({ ...base, ethanolT: t }).yieldIndex; expect(y).toBeLessThan(prev); prev = y; }
  });

  it('el machacado tiene un máximo: poco no rompe los tejidos, demasiado fragmenta el ADN', () => {
    const ys = [0, 0.5, 1, 1.5, 2, 3, 5].map((t) => simulateExtraction({ ...base, mash: t }).yieldIndex);
    expect(ys[0]).toBe(0);
    const iMax = ys.indexOf(Math.max(...ys));
    expect(iMax).toBeGreaterThan(0);
    expect(iMax).toBeLessThan(ys.length - 1);
    expect(ys[6]).toBeLessThan(ys[iMax]);
    // La cebolla (tejido firme, τ mayor) necesita machacarse más tiempo que la fresa para llegar a su máximo.
    const best = (fruit: ExtractionInput['fruit']) => {
      let bt = 0, by = -1;
      for (let t = 0; t <= 5; t += 0.5) { const y = simulateExtraction({ ...base, fruit, mash: t }).yieldIndex; if (y > by) { by = y; bt = t; } }
      return bt;
    };
    expect(best('cebolla')).toBeGreaterThan(best('fresa'));
  });

  it('casos límite: sin sal o con alcohol tibio el precipitado se vuelve difícil de enrollar; índice entre 0 y 100', () => {
    expect(yieldReading(simulateExtraction({ ...base, salt: 0 }).yieldIndex)).toBe(6);
    expect(yieldReading(simulateExtraction({ ...base, ethanolT: 25 }).yieldIndex)).toBe(21);
    expect(yieldReading(simulateExtraction({ ...base, salt: 0, ethanolT: 25 }).yieldIndex)).toBe(3);
    expect(simulateExtraction({ ...base, salt: 0, ethanolT: 25 }).appearance).toBe('Casi no se observa precipitado');
    for (const f of FRUITS) {
      for (const [s, d, t, m] of [[0, 0, 30, 0], [5, 20, -18, 1.5], [2, 5, 4, 5]]) {
        const y = simulateExtraction({ fruit: f.id, salt: s, detergent: d, ethanolT: t, mash: m }).yieldIndex;
        expect(y).toBeGreaterThanOrEqual(0);
        expect(y).toBeLessThanOrEqual(100);
      }
    }
    expect(appearanceOf(4.9)).toBe('Casi no se observa precipitado');
    expect(appearanceOf(50)).toBe('Ovillo abundante de hebras blancas');
    expect(simulateExtraction({ ...base, mash: 0 }).warnings.length).toBeGreaterThan(0);
  });

  it('las entradas fuera de rango se rechazan', () => {
    expect(() => simulateExtraction({ ...base, salt: -1 })).toThrow(RangeError);
    expect(() => simulateExtraction({ ...base, detergent: 25 })).toThrow(RangeError);
    expect(() => simulateExtraction({ ...base, ethanolT: 40 })).toThrow(RangeError);
    expect(() => simulateExtraction({ ...base, mash: 6 })).toThrow(RangeError);
    expect(() => simulateExtraction({ ...base, salt: Number.NaN })).toThrow(RangeError);
    expect(() => simulateExtraction({ ...base, fruit: 'mango' as never })).toThrow();
    expect(EXTRACTION_LIMITS.ethanolT).toEqual([-18, 30]);
  });
});

describe('complementariedad de bases', () => {
  it('complementaria, complementaria inversa e involución', () => {
    const t = normalizeSequence("5'-gattacagga-3'");
    expect(t.join('')).toBe('GATTACAGGA');
    expect(complementStrand(t).join('')).toBe('CTAATGTCCT'); // escrita 3'→5' bajo la molde
    expect(reverseComplement(t).join('')).toBe('TCCTGTAATC'); // la misma hebra leída 5'→3'
    expect(reverseComplement(reverseComplement(t)).join('')).toBe('GATTACAGGA');
    for (const b of BASES) expect(complementBase(complementBase(b))).toBe(b);
    expect(() => normalizeSequence('GATU')).toThrow(RangeError);
    expect(() => normalizeSequence('GAT')).toThrow(RangeError);
    expect(() => normalizeSequence('A'.repeat(21))).toThrow(RangeError);
  });

  it('puentes de hidrógeno: A–T 2, G–C 3, errores 0', () => {
    expect(hydrogenBonds('A', 'T')).toBe(2);
    expect(hydrogenBonds('T', 'A')).toBe(2);
    expect(hydrogenBonds('G', 'C')).toBe(3);
    expect(hydrogenBonds('C', 'G')).toBe(3);
    expect(hydrogenBonds('A', 'C')).toBe(0);
    expect(hydrogenBonds('G', 'G')).toBe(0);
    const t = seq('GATTACAGGA');
    const ok = checkDuplex(t, complementStrand(t), 'antiparalela');
    expect(ok.hBonds).toBe(6 * 2 + 4 * 3); // 24
  });

  it('regla de Wallace calculada a mano y su límite de validez (< 14 nt)', () => {
    expect(wallaceTm(seq('GATTACAGGA'))).toEqual({ tm: 2 * 6 + 4 * 4, valid: true }); // 28 °C
    expect(wallaceTm(seq('GCCGTAGCGGCA'))).toEqual({ tm: 2 * 3 + 4 * 9, valid: true }); // 42 °C
    expect(wallaceTm(seq('TTAGATATCAAT'))).toEqual({ tm: 2 * 10 + 4 * 2, valid: true }); // 28 °C
    expect(wallaceTm(seq('AAAAAAAAAAAAA')).valid).toBe(true); // 13 nt
    const long = wallaceTm(seq('ATGGCTAGCTTACGGA')); // 16 nt
    expect(long.tm).toBe(2 * 8 + 4 * 8);
    expect(long.valid).toBe(false);
    // A igual longitud, cambiar un par A–T por un G–C sube la Tm 2 °C.
    expect(wallaceTm(seq('GATTACAGGG')).tm - wallaceTm(seq('GATTACAGGA')).tm).toBe(2);
    expect(gcPercent(seq('GATTACAGGA'))).toBeCloseTo(40, 12);
    expect(gcPercent(seq('GCCGTAGCGGCA'))).toBeCloseTo(75, 12);
  });

  it('Chargaff: A = T y G = C en cualquier doble hebra; no en una sola hebra', () => {
    for (const s of ['GATTACAGGA', 'GCCGTAGCGGCA', 'TTAGATATCAAT', 'ATGGCTAGCTTACGGA', 'AAAAGGG']) {
      const t = seq(s);
      const c = chargaff(t, complementStrand(t));
      expect(c.counts.A).toBe(c.counts.T);
      expect(c.counts.G).toBe(c.counts.C);
      expect(c.purinePyrimidine).toBe(1);
      expect(c.counts.A + c.counts.T + c.counts.G + c.counts.C).toBe(2 * t.length); // se conservan las bases
    }
    const c = chargaff(seq('GATTACAGGA'), complementStrand(seq('GATTACAGGA')));
    expect(c.ratioAT).toBe(1);
    expect(c.ratioGC).toBe(1);
    expect(c.singleAT).toBe(2); // A = 4, T = 2 en la molde sola
    expect(c.singleGC).toBe(3); // G = 3, C = 1
    expect(baseCounts(seq('GATTACAGGA'))).toEqual({ A: 4, T: 2, G: 3, C: 1 });
    expect(() => chargaff(seq('GATT'), seq('CTA'))).toThrow(RangeError);
  });

  it('verificación de la doble hebra: errores, espacios vacíos y antiparalelismo', () => {
    const t = seq('GATTACAGGA');
    const full = complementStrand(t);
    const ok = checkDuplex(t, full, 'antiparalela');
    expect(ok.valid).toBe(true);
    expect(ok.correct).toBe(10);
    expect(ok.tm).toBe(28);
    expect(ok.tmInRange).toBe(true);
    expect(ok.newStrand53).toBe('TCCTGTAATC');
    // Paralela: las bases encajan, pero la orientación no es la de una doble hélice → no válida, sin Tm.
    const par = checkDuplex(t, full, 'paralela');
    expect(par.valid).toBe(false);
    expect(par.tm).toBeNull();
    expect(par.newStrand53).toBe('CTAATGTCCT');
    // Un error de apareamiento (G frente a G) y un espacio vacío.
    const bad: (Base | null)[] = [...full];
    bad[0] = 'G'; bad[9] = null;
    const r = checkDuplex(t, bad, 'antiparalela');
    expect(r.mismatches).toBe(1);
    expect(r.empty).toBe(1);
    expect(r.correct).toBe(8);
    expect(r.hBonds).toBe(24 - 3 - 2);
    expect(r.valid).toBe(false);
    expect(r.chargaff).toBeNull();
    expect(r.status[0]).toBe('error');
    expect(r.status[9]).toBe('vacio');
    expect(() => checkDuplex(t, full.slice(0, 5), 'antiparalela')).toThrow(RangeError);
  });
});

describe('ficha del modelo', () => {
  it('declara entradas con rango, supuestos, límites y el instrumento de respaldo', () => {
    expect(dnaExtractionModelSpec.inputs.length).toBeGreaterThanOrEqual(5);
    expect(dnaExtractionModelSpec.assumptions.some((a) => /supuestos didácticos/.test(a))).toBe(true);
    expect(dnaExtractionModelSpec.limits.some((l) => /14 nucleótidos/.test(l))).toBe(true);
    expect(DNA_EXTRACTION_INSTRUMENTS[0].resolution).toBe(1);
  });
});
