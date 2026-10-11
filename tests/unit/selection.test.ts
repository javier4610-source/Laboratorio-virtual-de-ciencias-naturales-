import { describe, expect, it } from 'vitest';
import {
  analyticSelection, backgroundValue, beetleSample, beetlePositions, discretize, histogram, normalQuantile,
  selectionStep, simulateSelection, survival, CONTRAST_WIDTH, INITIAL_MEAN,
} from '../../src/models/selection';

const base = { backgroundId: 'volcanico', predation: 60, heritability: 0.5, variation: 0.15, generations: 30 };

describe('selección natural con cambios ambientales (9.º)', () => {
  it('supervivencia: 1 si el color coincide con el fondo y 1 − p si contrasta mucho', () => {
    expect(survival(0.5, 0.5, 0.6)).toBe(1);
    expect(survival(0, 1, 0.6)).toBeCloseTo(0.4, 2); // diferencia máxima de color: casi 1 − p
    expect(survival(0, 0.8, 0.6)).toBeCloseTo(1 - 0.6 * (1 - Math.exp(-0.64 / (2 * 0.09))), 12);
    // A una distancia w: 1 − p·(1 − e^(−1/2))
    expect(survival(0.5 + CONTRAST_WIDTH, 0.5, 0.6)).toBeCloseTo(1 - 0.6 * (1 - Math.exp(-0.5)), 12);
    expect(survival(0.1, 0.8, 0)).toBe(1);
  });

  it('la distribución discretizada tiene 201 clases, suma 1 y conserva media y desviación', () => {
    const { z, f } = discretize(0.3, 0.1);
    expect(z.length).toBe(201);
    const sum = f.reduce((a, b) => a + b, 0);
    const mean = z.reduce((a, zi, i) => a + zi * f[i], 0);
    const sd = Math.sqrt(z.reduce((a, zi, i) => a + (zi - mean) ** 2 * f[i], 0));
    expect(sum).toBeCloseTo(1, 12);
    expect(mean).toBeCloseTo(0.3, 10);
    expect(sd).toBeCloseTo(0.1, 3);
  });

  it('una generación calculada a mano: S = 0,01076, s̄ = 86,60 % y R = h²·S exacto', () => {
    // z̄ = 0,3; σ = 0,1; B = 0,5; p = 0,6; w = 0,30.
    // A = w/√(w²+σ²)·exp(−(z̄−B)²/(2(w²+σ²))) = 0,94868·e^(−0,2) = 0,77670
    // s̄ = 1 − p + p·A = 0,86602;  S = p·A·σ²·(B − z̄)/((w²+σ²)·s̄) = 0,01076
    const st = selectionStep(0.3, 0.1, 0.5, 0.6, 0.5);
    expect(st.survival).toBeCloseTo(0.8660, 4);
    expect(st.S).toBeCloseTo(0.01076, 5);
    expect(st.R).toBe(0.5 * st.S);
    expect(st.meanAfter).toBeCloseTo(0.3 + 0.5 * 0.01076, 5);
    const an = analyticSelection(0.3, 0.1, 0.5, 0.6);
    expect(st.S).toBeCloseTo(an.S, 7);
    expect(st.survival).toBeCloseTo(an.survival, 6);
  });

  it('con heredabilidad 0 no hay evolución aunque haya selección', () => {
    const r = simulateSelection({ ...base, heritability: 0 });
    expect(r.change).toBe(0);
    expect(r.finalMean).toBe(INITIAL_MEAN);
    expect(r.lastS!).toBeGreaterThan(0.01); // las aves sí seleccionan
    expect(r.lastR).toBe(0);
  });

  it('sin depredación no hay selección ni cambio, y todos sobreviven', () => {
    const r = simulateSelection({ ...base, predation: 0 });
    expect(Math.abs(r.change)).toBeLessThan(1e-12);
    expect(Math.abs(r.lastS!)).toBeLessThan(1e-12);
    expect(r.lastSurvivalPercent).toBe(100);
  });

  it('la media se acerca al fondo y se estabiliza cuando z̄ ≈ B', () => {
    const r = simulateSelection({ ...base, generations: 200 });
    const means = r.history.map((h) => h.mean);
    for (let i = 1; i < means.length; i++) expect(means[i]).toBeGreaterThanOrEqual(means[i - 1] - 1e-12); // nunca retrocede
    expect(Math.max(...means)).toBeLessThanOrEqual(0.8 + 1e-9); // no se pasa del fondo
    expect(r.finalMean).toBeCloseTo(0.8, 3);
    expect(r.history[40].mean).toBeLessThan(0.75); // se acerca cada vez más despacio
    expect(Math.abs(r.lastR!)).toBeLessThan(1e-4); // estabilizada
    // Con la población camuflada, la supervivencia media es mucho mayor que al inicio.
    expect(r.lastSurvivalPercent!).toBeGreaterThan(r.history[1].survival! * 100 + 20);
  });

  it('la supervivencia media es mayor cuando la población coincide con el fondo', () => {
    const match = selectionStep(0.5, 0.1, 0.5, 0.6, 0.5);
    const mismatch = selectionStep(0.2, 0.1, 0.5, 0.6, 0.5);
    expect(match.survival).toBeGreaterThan(mismatch.survival);
    expect(Math.abs(match.S)).toBeLessThan(1e-12); // en equilibrio no hay selección direccional
  });

  it('más variación (σ) produce un cambio más rápido', () => {
    const changes = [0.05, 0.1, 0.15, 0.2].map((variation) => simulateSelection({ ...base, backgroundId: 'hojarasca', variation, generations: 10 }).change);
    for (let i = 1; i < changes.length; i++) expect(changes[i]).toBeGreaterThan(changes[i - 1]);
  });

  it('más heredabilidad y más depredación producen más cambio', () => {
    const byH = [0.25, 0.5, 1].map((heritability) => simulateSelection({ ...base, heritability, generations: 10 }).change);
    expect(byH[1]).toBeGreaterThan(byH[0]);
    expect(byH[2]).toBeGreaterThan(byH[1]);
    const byP = [20, 50, 90].map((predation) => simulateSelection({ ...base, predation, generations: 10 }).change);
    expect(byP[1]).toBeGreaterThan(byP[0]);
    expect(byP[2]).toBeGreaterThan(byP[1]);
  });

  it('simetría: con el fondo por debajo de la media, el cambio es igual y de signo opuesto', () => {
    const up = selectionStep(0.3, 0.12, 0.5, 0.6, 0.7);
    const down = selectionStep(0.7, 0.12, 0.5, 0.6, 0.7);
    expect(down.S).toBeCloseTo(-up.S, 12);
    expect(down.survival).toBeCloseTo(up.survival, 12);
    const light = simulateSelection({ ...base, backgroundId: 'corteza', initialMean: 0.4, generations: 15 });
    const dark = simulateSelection({ ...base, backgroundId: 'volcanico', initialMean: 0.6, generations: 15 });
    expect(light.change).toBeLessThan(0);
    expect(light.change).toBeCloseTo(-dark.change, 10);
  });

  it('cambio ambiental por hollín: el fondo se oscurece y la población lo sigue con retraso', () => {
    expect(backgroundValue('hollin', 0)).toBe(0.2);
    expect(backgroundValue('hollin', 10)).toBeCloseTo(0.5, 12);
    expect(backgroundValue('hollin', 50)).toBe(0.8);
    const r = simulateSelection({ ...base, backgroundId: 'hollin', variation: 0.15, generations: 60 });
    expect(r.history[2].mean).toBeLessThan(INITIAL_MEAN); // al principio el fondo claro favorece a los claros
    expect(r.history[20].mean).toBeLessThan(r.history[20].background); // retraso evolutivo
    expect(r.finalMean).toBeGreaterThan(0.75);
    });

  it('suelo volcánico: cambio claramente visible en 10–20 generaciones', () => {
    // σ = 0,10 y 50 % de depredación: de 0,300 a 0,356 (10 gen.) y 0,415 (20 gen.).
    const r20 = simulateSelection({ ...base, predation: 50, variation: 0.1, generations: 20 });
    expect(r20.history[10].mean).toBeGreaterThan(0.35);
    expect(r20.finalMeanReading).toBe(0.415);
    // Valor de referencia de la interfaz: valores iniciales (suelo volcánico, 60 %, h² 0,5, σ 0,15) y 10 generaciones.
    const ui = simulateSelection({ backgroundId: 'volcanico', predation: 60, heritability: 0.5, variation: 0.15, generations: 10 });
    expect(ui.finalMeanReading).toBe(0.457);
    expect(ui.changeReading).toBe(0.157);
    expect(ui.lastSurvivalPercent).toBe(70.3);
  });

  it('muestra de escarabajos, histograma y cuantiles', () => {
    expect(normalQuantile(0.5)).toBeCloseTo(0, 9);
    expect(normalQuantile(0.975)).toBeCloseTo(1.959964, 5);
    expect(normalQuantile(0.01)).toBeCloseTo(-2.326348, 5);
    const sample = beetleSample(0.5, 0.1, 40);
    expect(sample.length).toBe(40);
    expect(sample.reduce((a, b) => a + b, 0) / 40).toBeCloseTo(0.5, 10);
    expect(beetleSample(0.05, 0.2).every((z) => z >= 0 && z <= 1)).toBe(true);
    expect(histogram(0.3, 0.15).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 12);
    expect(beetlePositions()).toEqual(beetlePositions()); // reproducible
  });

  it('valida los rangos de entrada', () => {
    expect(() => simulateSelection({ ...base, predation: 95 })).toThrow(RangeError);
    expect(() => simulateSelection({ ...base, heritability: 1.2 })).toThrow(RangeError);
    expect(() => simulateSelection({ ...base, variation: 0.01 })).toThrow(RangeError);
    expect(() => simulateSelection({ ...base, generations: 2.5 })).toThrow(RangeError);
    expect(() => simulateSelection({ ...base, backgroundId: 'marte' })).toThrow();
  });
});
