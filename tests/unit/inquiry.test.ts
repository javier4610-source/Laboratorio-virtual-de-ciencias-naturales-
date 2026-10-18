import { describe, expect, it } from 'vitest';
import {
  analyze, BUDGET, causalReflection, collect, creekTurbidity, critiqueDesign, designLevels, levelStats, noisyValue, noiseSigma,
  pearson, riverOxygen, SYSTEMS, soilTemperature, tCritical95, type Design, type Sample,
} from '../../src/models/inquiry';
import { seededRandom } from '../../src/models/math';

const base: Design = { system: 'rio', levels: 3, min: 0, max: 10, replicates: 2, confound: 'sin-control', seed: 123 };
const good: Design = { system: 'rio', levels: 5, min: -2, max: 20, replicates: 4, confound: 'constante', seed: 123 };
const kinds = (d: Design) => critiqueDesign(d, collect(d)).map((c) => c.kind);
const mk = (pts: [number, number][]): Sample[] => pts.map(([x, y], i) => ({ order: i + 1, levelIndex: 0, replicate: 1, x, confound: 0, trueY: y, y }));

describe('reto de indagación (11.º): datos sintéticos reproducibles', () => {
  it('la misma semilla y el mismo diseño producen exactamente los mismos datos', () => {
    expect(collect(base)).toEqual(collect({ ...base }));
    for (const system of ['rio', 'suelo', 'lluvia'] as const) {
      const d: Design = { system, levels: 4, min: SYSTEMS[system].x.range[0], max: SYSTEMS[system].x.range[1], replicates: 3, confound: 'aleatorizado', seed: 77 };
      expect(collect(d)).toEqual(collect(d));
    }
    // Otra semilla cambia las lecturas (no los niveles).
    const a = collect(base), b = collect({ ...base, seed: 124 });
    expect(a.map((s) => s.x)).toEqual(b.map((s) => s.x));
    expect(a.map((s) => s.y)).not.toEqual(b.map((s) => s.y));
  });

  it('valores de referencia de la semilla 123 (diseño inicial): regresión de reproducibilidad', () => {
    const s = collect(base);
    expect(s.map((x) => x.y)).toEqual([6.88, 6.83, 5.7, 5.87, 5.47, 5.54]);
    expect(s.map((x) => x.confound)).toEqual([25.5, 26.1, 26.6, 27.2, 27.7, 28.3]);
  });

  it('niveles equiespaciados, redondeados al paso, y validación del presupuesto y de los rangos', () => {
    expect(designLevels({ system: 'rio', levels: 3, min: 0, max: 10 })).toEqual([0, 5, 10]);
    expect(designLevels({ system: 'suelo', levels: 4, min: 0, max: 90 })).toEqual([0, 30, 60, 90]);
    expect(designLevels({ system: 'lluvia', levels: 4, min: 0, max: 50 })).toEqual([0, 15, 35, 50]); // 16,7 → 15 y 33,3 → 35 (paso 5 mm)
    expect(() => collect({ ...base, levels: 7, replicates: 3 })).toThrow(RangeError); // 21 > 20
    expect(collect({ ...base, levels: 5, replicates: 4 })).toHaveLength(BUDGET);
    expect(() => collect({ ...base, min: 10, max: 10 })).toThrow(RangeError);
    expect(() => collect({ ...base, max: 40 })).toThrow(RangeError);
    expect(() => collect({ ...base, seed: 0 })).toThrow(RangeError);
    expect(() => collect({ ...base, seed: 12.5 })).toThrow(RangeError);
    expect(() => collect({ ...base, replicates: 7 })).toThrow(RangeError);
  });

  it('el ruido tiene la desviación típica declarada (20 000 muestras, ±3 %) y media nula', () => {
    for (const sys of [SYSTEMS.rio, SYSTEMS.suelo]) {
      const rng = seededRandom(2024);
      const truth = 25;
      const xs = Array.from({ length: 20000 }, () => noisyValue(truth, sys.noise, rng));
      const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
      const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1));
      expect(Math.abs(mean - truth)).toBeLessThan(0.03 * sys.noise.sigma + 4 * sys.noise.sigma / Math.sqrt(xs.length));
      expect(sd / sys.noise.sigma).toBeGreaterThan(0.97);
      expect(sd / sys.noise.sigma).toBeLessThan(1.03);
    }
    // Quebrada: σ = √(1² + (0,08·100)²) = 8,062 UNT con turbidez verdadera de 100 UNT.
    const sigma = noiseSigma(SYSTEMS.lluvia.noise, 100);
    expect(sigma).toBeCloseTo(Math.sqrt(1 + 64), 6);
    const rng = seededRandom(99);
    const ys = Array.from({ length: 20000 }, () => noisyValue(100, SYSTEMS.lluvia.noise, rng));
    const m = ys.reduce((a, b) => a + b, 0) / ys.length;
    const sd = Math.sqrt(ys.reduce((a, b) => a + (b - m) ** 2, 0) / (ys.length - 1));
    expect(sd / sigma).toBeGreaterThan(0.97);
    expect(sd / sigma).toBeLessThan(1.03);
  });

  it('estadística por nivel calculada a mano: media, DE (n − 1) y error estándar', () => {
    // Nivel x = 2: 4, 6, 8 → media 6; DE = √((4 + 0 + 4)/2) = 2; EE = 2/√3 = 1,1547.
    const st = levelStats(mk([[2, 4], [2, 6], [2, 8], [5, 10], [5, 12]]));
    expect(st.map((l) => l.x)).toEqual([2, 5]);
    expect(st[0].mean).toBeCloseTo(6, 12);
    expect(st[0].sd).toBeCloseTo(2, 12);
    expect(st[0].sem).toBeCloseTo(1.154700538, 8);
    // Nivel x = 5: 10, 12 → media 11; DE = √2 = 1,4142; EE = 1.
    expect(st[1].sd).toBeCloseTo(Math.SQRT2, 12);
    expect(st[1].sem).toBeCloseTo(1, 12);
  });

  it('ajuste lineal con incertidumbre calculado a mano', () => {
    // Puntos (0, 1), (1, 3), (2, 4), (3, 8): Σx = 6, Σy = 16, Σx² = 14, Σxy = 35, n = 4.
    // m = (4·35 − 6·16)/(4·14 − 36) = 44/20 = 2,2; b = (16 − 2,2·6)/4 = 0,7.
    // Residuos: 0,3; 0,1; −1,1; 0,7 → SSres = 1,8; s² = 0,9; EE(m) = √(0,9·4/20) = 0,42426; EE(b) = √(0,9·14/20) = 0,79373.
    const a = analyze(mk([[0, 1], [1, 3], [2, 4], [3, 8]]));
    expect(a.slope).toBeCloseTo(2.2, 10);
    expect(a.intercept).toBeCloseTo(0.7, 10);
    expect(a.slopeSe).toBeCloseTo(0.424264, 5);
    expect(a.interceptSe).toBeCloseTo(0.793725, 5);
    expect(a.slopeCi95).toBeCloseTo(4.303 * 0.424264, 4); // t(2 g. l.) = 4,303
    // Σy² = 90: r = 44/√(20·(4·90 − 256)) = 44/√2080 = 0,964764
    expect(a.r).toBeCloseTo(0.964764, 5);
    expect(pearson([1, 2, 3], [5, 5, 5])).toBeNaN();
    expect(tCritical95(10)).toBe(2.228);
    expect(tCritical95(100)).toBe(1.96);
  });

  it('la crítica del diseño se activa con pocas réplicas, rango estrecho, confusión sin controlar y sin referencia', () => {
    const k = kinds(base);
    expect(k).toContain('replicas');
    expect(critiqueDesign(base, collect(base)).find((c) => c.kind === 'replicas')!.severity).toBe('warn');
    expect(k).toContain('rango');
    expect(k).toContain('confusion');
    expect(critiqueDesign(base, collect(base)).find((c) => c.kind === 'confusion')!.severity).toBe('bad');
    expect(k).toContain('referencia');
    expect(k).toContain('presupuesto'); // 6 de 20 muestras
    // Una réplica: crítica grave.
    const one: Design = { ...good, replicates: 1 };
    expect(critiqueDesign(one, collect(one)).find((c) => c.kind === 'replicas')!.severity).toBe('bad');
    // Dos niveles.
    expect(kinds({ ...good, levels: 2 })).toContain('niveles');
    // El texto cita los valores del diseño (no es un mensaje fijo).
    expect(critiqueDesign(base, collect(base)).find((c) => c.kind === 'rango')!.text).toContain('31 %');
  });

  it('un buen diseño no activa las críticas principales; aleatorizar rompe la relación confusión–x', () => {
    const k = kinds(good);
    for (const bad of ['replicas', 'niveles', 'rango', 'referencia', 'presupuesto'] as const) {
      const item = critiqueDesign(good, collect(good)).find((c) => c.kind === bad);
      expect(item === undefined || item.severity === 'ok', bad).toBe(true);
    }
    expect(critiqueDesign(good, collect(good)).find((c) => c.kind === 'confusion')!.severity).toBe('ok');
    expect(k).not.toContain('pendiente');
    const unc = analyze(collect({ ...good, confound: 'sin-control' }));
    const rnd = analyze(collect({ ...good, confound: 'aleatorizado' }));
    expect(Math.abs(unc.confoundR)).toBeGreaterThan(0.9);
    expect(Math.abs(rnd.confoundR)).toBeLessThan(0.5);
  });

  it('modelos: el oxígeno baja aguas abajo con un mínimo cerca de 20 km, la sombra enfría el suelo y la lluvia enturbia', () => {
    expect(riverOxygen(-2, 26)).toBeGreaterThan(riverOxygen(0, 26));
    const prof = Array.from({ length: 61 }, (_, i) => ({ x: i * 0.5, od: riverOxygen(i * 0.5, 26) }));
    const min = prof.reduce((a, b) => (b.od < a.od ? b : a));
    expect(min.x).toBeGreaterThan(17);
    expect(min.x).toBeLessThan(23);
    expect(riverOxygen(5, 29)).toBeLessThan(riverOxygen(5, 25)); // agua caliente: menos saturación
    // Suelo a las 11:00: 24 + 0,8·4 + 10·sen(5π/12) = 27,2 + 9,659 = 36,859 °C a pleno sol.
    expect(soilTemperature(0, 11)).toBeCloseTo(36.859, 3);
    expect(soilTemperature(90, 11)).toBeLessThan(soilTemperature(0, 11));
    // Quebrada: 6 + 2·50·e^(−4/10) = 73,032 UNT.
    expect(creekTurbidity(50, 4)).toBeCloseTo(73.032, 3);
    expect(creekTurbidity(0, 4)).toBe(6);
  });

  it('la confusión sin controlar puede invertir el signo del efecto (suelo medido de 7:00 a 13:00)', () => {
    const d: Design = { system: 'suelo', levels: 5, min: 0, max: 90, replicates: 4, confound: 'constante', seed: 123 };
    const ctrl = analyze(collect(d));
    const unc = analyze(collect({ ...d, confound: 'sin-control' }));
    expect(ctrl.slope).toBeLessThan(0);
    expect(ctrl.slope + 2 * ctrl.slopeSe).toBeLessThan(0);
    expect(unc.slope).toBeGreaterThan(0);
    // La reflexión menciona la causalidad con lenguaje probabilístico.
    const txt = causalReflection({ ...d, confound: 'sin-control' }, unc).join(' ');
    expect(txt).toMatch(/experimental/);
    expect(causalReflection(base, analyze(collect(base))).join(' ')).toMatch(/no demuestra causalidad/);
  });
});
