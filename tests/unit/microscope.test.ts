import { describe, expect, it } from 'vitest';
import {
  apparentSizeMm, checkClassification, fieldDiameterUm, focusState, observe, OBJECTIVES, SAMPLES, STRUCTURES, totalMagnification,
} from '../../src/models/microscope';

const view = (sampleId: string, stain: string, objective: number, focus?: number) =>
  observe({ sampleId, stain, objective, focus: focus ?? SAMPLES.find((s) => s.id === sampleId)!.focusPoint });
const visible = (o: ReturnType<typeof observe>, id: string) => o.structures.find((v) => v.structure.id === id)!;

describe('microscopio: aumento y campo visual (6.º)', () => {
  it('aumento total = ocular 10× × objetivo', () => {
    expect(OBJECTIVES.map(totalMagnification)).toEqual([40, 100, 400]);
  });
  it('el diámetro del campo es 18 000 µm / objetivo y disminuye al aumentar el aumento', () => {
    expect(OBJECTIVES.map(fieldDiameterUm)).toEqual([4500, 1800, 450]);
    // campo × aumento total es constante (180 000 µm·×)
    for (const o of OBJECTIVES) expect(fieldDiameterUm(o) * totalMagnification(o)).toBe(180_000);
  });
  it('tamaño aparente = tamaño real × aumento (20 µm a 400× → 8 mm)', () => {
    expect(apparentSizeMm(20, 400)).toBeCloseTo(8, 10);
    expect(apparentSizeMm(5, 40)).toBeCloseTo(0.2, 10);
  });
  it('valida las entradas', () => {
    expect(() => totalMagnification(20)).toThrow(RangeError);
    expect(() => view('cebolla', 'ninguna', 4, 120)).toThrow(RangeError);
    expect(() => view('cebolla', 'ninguna', 4, Number.NaN)).toThrow(RangeError);
    expect(() => view('sangre', 'ninguna', 4)).toThrow();
    expect(() => view('cebolla', 'safranina', 4)).toThrow();
  });
});

describe('microscopio: visibilidad de estructuras', () => {
  it('cloroplastos de la elodea (5 µm): muy pequeños a 40× totales, visibles a 100× sin tinción', () => {
    const lo = visible(view('elodea', 'ninguna', 4), 'cloroplastos');
    expect(lo.visible).toBe(false);
    expect(lo.reason).toBe('muy pequeña a este aumento');
    expect(visible(view('elodea', 'ninguna', 10), 'cloroplastos').visible).toBe(true);
  });
  it('el núcleo de la cebolla necesita lugol o azul de metileno', () => {
    const sin = visible(view('cebolla', 'ninguna', 10), 'nucleo');
    expect(sin.visible).toBe(false);
    expect(sin.reasonText).toBe('necesita tinción (lugol o azul de metileno)');
    expect(visible(view('cebolla', 'lugol', 10), 'nucleo').visible).toBe(true);
    expect(visible(view('cebolla', 'azul', 10), 'nucleo').visible).toBe(true);
  });
  it('la mucosa bucal sin teñir no se distingue; con azul de metileno se ven membrana y núcleo, nunca pared ni cloroplastos', () => {
    const sin = view('mucosa', 'ninguna', 40);
    expect(sin.cellsDistinguishable).toBe(false);
    expect(sin.visibleCount).toBe(0);
    expect(sin.count.ok).toBe(false);
    const azul = view('mucosa', 'azul', 40);
    expect(azul.visibleCount).toBe(2);
    expect(STRUCTURES.mucosa.some((s) => s.id === 'pared' || s.id === 'cloroplastos')).toBe(false);
  });
  it('el número de estructuras visibles no disminuye al aumentar el aumento (muestra enfocada)', () => {
    for (const s of SAMPLES) for (const stain of ['ninguna', 'lugol', 'azul']) {
      const counts = OBJECTIVES.map((o) => view(s.id, stain, o).visibleCount);
      expect(counts[1]).toBeGreaterThanOrEqual(counts[0]);
      expect(counts[2]).toBeGreaterThanOrEqual(counts[1]);
    }
    expect(OBJECTIVES.map((o) => view('levadura', 'ninguna', o).visibleCount)).toEqual([0, 1, 2]);
  });
});

describe('microscopio: enfoque', () => {
  it('la profundidad de campo disminuye con el objetivo (parafocal)', () => {
    // foco en 50, cebolla enfoca en 42: diferencia de 8 divisiones
    expect(focusState('cebolla', 4, 50).inFocus).toBe(true);
    expect(focusState('cebolla', 10, 50).inFocus).toBe(true);
    expect(focusState('cebolla', 40, 50).inFocus).toBe(false);
    expect(focusState('cebolla', 40, 45).inFocus).toBe(true);
    expect(focusState('cebolla', 40, 46).inFocus).toBe(false);
    expect(focusState('cebolla', 40, 50).direction).toBe('bajar');
    expect(focusState('cebolla', 40, 42).blurPx).toBe(0);
  });
  it('fuera de foco no se ve nada ni se puede contar', () => {
    const o = view('cebolla', 'lugol', 40, 60);
    expect(o.visibleCount).toBe(0);
    expect(o.structures.every((v) => v.reason === 'fuera de foco')).toBe(true);
    expect(o.focus.blurPx).toBeGreaterThan(1);
    expect(o.count.ok).toBe(false);
  });
});

describe('microscopio: conteo y tamaño estimado', () => {
  it('cebolla: 18 células a 4× (250 µm exactos); 2 células a 40× (225 µm, 10 % de error)', () => {
    const lo = view('cebolla', 'ninguna', 4, 50).count;
    expect(lo).toEqual({ ok: true, count: 18, estimatedSizeUm: 250, relativeErrorPct: 0 });
    const hi = view('cebolla', 'ninguna', 40).count;
    if (!hi.ok) throw new Error('debería poder contarse');
    expect(hi.count).toBe(2); // 450/250 = 1,8 → 2
    expect(hi.estimatedSizeUm).toBe(225);
    expect(hi.relativeErrorPct).toBeCloseTo(10, 10);
  });
  it('mucosa con azul: el conteo se redondea a media célula', () => {
    const counts = OBJECTIVES.map((o) => view('mucosa', 'azul', o).count);
    expect(counts.map((c) => (c.ok ? c.count : null))).toEqual([82, 32.5, 8]); // 81,8 · 32,7 · 8,18
    if (counts[2].ok) expect(counts[2].estimatedSizeUm).toBeCloseTo(56.25, 10);
  });
  it('levadura: solo se puede contar con el objetivo de 40×', () => {
    expect(view('levadura', 'ninguna', 4).count.ok).toBe(false); // muy pequeña
    const mid = view('levadura', 'ninguna', 10);
    expect(mid.cellsDistinguishable).toBe(true);
    expect(mid.cellsAcrossExact).toBe(300);
    expect(mid.count.ok).toBe(false); // más de 100
    expect(view('levadura', 'ninguna', 40).count).toEqual({ ok: true, count: 75, estimatedSizeUm: 6, relativeErrorPct: 0 });
  });
  it('el número de células contadas disminuye al aumentar el aumento (campo × aumento constante)', () => {
    const c = OBJECTIVES.map((o) => view('elodea', 'ninguna', o).count).map((r) => (r.ok ? r.count : NaN));
    expect(c).toEqual([75, 30, 7.5]);
  });
});

describe('microscopio: clasificación', () => {
  it('reconoce el reino correcto y explica el error', () => {
    expect(checkClassification('cebolla', 'vegetal').correct).toBe(true);
    expect(checkClassification('mucosa', 'animal').correct).toBe(true);
    expect(checkClassification('levadura', 'hongo').correct).toBe(true);
    const wrong = checkClassification('cebolla', 'animal');
    expect(wrong.correct).toBe(false);
    expect(wrong.feedback).toMatch(/pared celular/);
    expect(checkClassification('elodea', '').correct).toBe(false);
  });
});
