import { describe as group, expect, it } from 'vitest';
import {
  combinedSigma, describe, gaussian, hashSeed, measureValue, propagate, readingSeed, resolutionUncertainty, standardUncertainty,
} from '../../src/lib/measurement';
import { buildAnalysis, groupTrials, measuredColumns } from '../../src/lib/analysis';
import { INSTRUMENTS, instrument } from '../../src/labs/instruments';
import { DATASETS } from '../../src/labs/datasets';
import { emptySession, loadSession } from '../../src/lib/session';
import type { Dataset, Trial } from '../../src/core/types';

group('ruido reproducible', () => {
  it('la semilla depende de la práctica, la clave y la repetición', () => {
    expect(hashSeed('densidad', 'masa', 1)).toBe(hashSeed('densidad', 'masa', 1));
    expect(readingSeed('densidad', 'masa', 1)).not.toBe(readingSeed('densidad', 'masa', 2));
    expect(readingSeed('densidad', 'masa', 1)).not.toBe(readingSeed('densidad', 'probeta', 1));
    expect(readingSeed('densidad', 'masa', 1)).not.toBe(readingSeed('newton', 'masa', 1));
  });
  it('la normal estándar tiene media ≈ 0 y desviación ≈ 1', () => {
    const zs = Array.from({ length: 4000 }, (_, i) => gaussian(hashSeed('prueba', i)));
    const s = describe(zs);
    expect(Math.abs(s.mean)).toBeLessThan(0.06);
    expect(Math.abs(s.sd - 1)).toBeLessThan(0.05);
    expect(zs.every(Number.isFinite)).toBe(true);
  });
  it('combina σ absoluta y relativa en cuadratura', () => {
    expect(combinedSigma(100, { sigma: 0.3, relSigma: 0.004 })).toBeCloseTo(0.5, 10);
    expect(combinedSigma(5, {})).toBe(0);
  });
});

group('lectura de un instrumento', () => {
  const balanza = { resolution: 0.1, sigma: 0.08 };
  it('en modo ideal solo cuantiza (no depende de la semilla)', () => {
    expect(measureValue(21.6, { ...balanza, mode: 'ideal', seed: 1 })).toBe(21.6);
    expect(measureValue(21.63, { ...balanza, mode: 'ideal', seed: 99 })).toBe(21.6);
    expect(measureValue(0.70711, { resolution: 0.001, mode: 'ideal', seed: 3 })).toBe(0.707);
  });
  it('en modo ideal con idealResolution 0 conserva la precisión del modelo', () => {
    expect(measureValue(28.7612345, { resolution: 1, sigma: 0.7, idealResolution: 0, mode: 'ideal', seed: 1 })).toBe(28.7612345);
  });
  it('en modo real es reproducible para la misma semilla y cambia al repetir', () => {
    const read = (rep: number) => measureValue(21.6, { ...balanza, mode: 'real', seed: readingSeed('densidad', 'masa', rep) });
    expect(read(1)).toBe(read(1));
    const values = Array.from({ length: 20 }, (_, i) => read(i));
    expect(new Set(values).size).toBeGreaterThan(1);
    // Las lecturas quedan en la retícula de la resolución.
    for (const v of values) expect(Math.abs(v * 10 - Math.round(v * 10))).toBeLessThan(1e-9);
  });
  it('la dispersión de muchas lecturas reales se acerca a la σ declarada', () => {
    const values = Array.from({ length: 3000 }, (_, i) => measureValue(50, { resolution: 0.01, sigma: 0.5, mode: 'real', seed: hashSeed('x', i) }));
    const s = describe(values);
    expect(Math.abs(s.mean - 50)).toBeLessThan(0.05);
    expect(s.sd).toBeGreaterThan(0.45);
    expect(s.sd).toBeLessThan(0.55);
  });
  it('nonNegative impide lecturas negativas cerca de cero', () => {
    const values = Array.from({ length: 200 }, (_, i) => measureValue(0, { resolution: 0.1, sigma: 0.1, nonNegative: true, mode: 'real', seed: i }));
    expect(Math.min(...values)).toBe(0);
    expect(values.some((v) => Object.is(v, -0))).toBe(false);
  });
});

group('estadística de mediciones repetidas', () => {
  it('n, media, DE muestral y EE', () => {
    const s = describe([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s.n).toBe(8);
    expect(s.mean).toBe(5);
    expect(s.sd).toBeCloseTo(Math.sqrt(32 / 7), 12);
    expect(s.sem).toBeCloseTo(Math.sqrt(32 / 7) / Math.sqrt(8), 12);
  });
  it('con un solo valor no hay dispersión; sin valores, todo es NaN', () => {
    const one = describe([3.2]);
    expect(one.mean).toBe(3.2);
    expect(Number.isNaN(one.sd)).toBe(true);
    expect(describe([]).n).toBe(0);
  });
  it('incertidumbre típica: EE (tipo A) y resolución/√12 (tipo B) en cuadratura', () => {
    expect(resolutionUncertainty(0.1)).toBeCloseTo(0.0288675, 6);
    const s = describe([21.5, 21.6, 21.7]);
    expect(standardUncertainty(s, 0.1)).toBeCloseTo(Math.hypot(s.sem, 0.1 / Math.sqrt(12)), 12);
    expect(standardUncertainty(describe([21.6]), 0.1)).toBeCloseTo(0.1 / Math.sqrt(12), 12);
  });
});

group('propagación de incertidumbre', () => {
  it('cociente: densidad = m/V', () => {
    const r = propagate('divide', { value: 21.6, u: 0.1 }, { value: 8.0, u: 0.2 });
    expect(r.value).toBeCloseTo(2.7, 12);
    expect(r.rel).toBeCloseTo(Math.hypot(0.1 / 21.6, 0.2 / 8), 12);
    expect(r.u).toBeCloseTo(2.7 * r.rel, 12);
  });
  it('producto: las incertidumbres relativas también se suman en cuadratura', () => {
    const r = propagate('multiply', { value: 2, u: 0.02 }, { value: 3, u: 0.06 });
    expect(r.value).toBe(6);
    expect(r.u).toBeCloseTo(6 * Math.hypot(0.01, 0.02), 12);
  });
  it('dividir entre cero no produce una incertidumbre engañosa', () => {
    expect(Number.isNaN(propagate('divide', { value: 1, u: 0.1 }, { value: 0, u: 0.1 }).u)).toBe(true);
  });
});

group('cuaderno: agrupación de ensayos repetidos', () => {
  const ds = DATASETS.densidad[0];
  const trial = (id: string, values: Trial['values']): Trial => ({ id, datasetId: ds.id, createdAt: 0, values });
  const base = { material: 'Aluminio', lado: 2, vi: 50, flota: 'no' };
  const trials = [
    trial('a', { ...base, vgeo: 8, masa: 21.6, vf: 58, vdesp: 8, densidad: 2.7 }),
    trial('b', { ...base, vgeo: 8, masa: 21.7, vf: 58.5, vdesp: 8.5, densidad: 2.5529 }),
    trial('c', { ...base, lado: 3, vgeo: 27, masa: 72.9, vf: 77, vdesp: 27, densidad: 2.7 }),
    trial('d', { ...base, vgeo: 8, masa: 21.5, vf: 57.5, vdesp: 7.5, densidad: 2.8667 }),
  ];
  it('agrupa por las columnas de entrada y calcula la estadística de cada columna medida', () => {
    const groups = groupTrials(ds, trials);
    expect(groups).toHaveLength(2);
    expect(groups[0].trials.map((t) => t.id)).toEqual(['a', 'b', 'd']);
    expect(groups[0].label).toBe('Aluminio · Arista 2,0 cm · V inicial 50,0 mL');
    expect(groups[0].stats.masa.n).toBe(3);
    expect(groups[0].stats.masa.mean).toBeCloseTo(21.6, 12);
    expect(groups[0].stats.masa.sd).toBeCloseTo(0.1, 12);
    expect(groups[1].stats.masa.n).toBe(1);
    expect(measuredColumns(ds).map((c) => c.key)).toEqual(['vgeo', 'masa', 'vf', 'vdesp', 'densidad']);
  });
  it('sin columnas de entrada, todos los ensayos forman un solo grupo', () => {
    const plain: Dataset = { id: 'p', label: 'P', defaultX: 'x', defaultY: 'y', columns: [{ key: 'x', label: 'x', numeric: true }, { key: 'y', label: 'y', numeric: true }] };
    const g = groupTrials(plain, [{ id: '1', datasetId: 'p', createdAt: 0, values: { x: 1, y: 2 } }, { id: '2', datasetId: 'p', createdAt: 0, values: { x: 3, y: 4 } }]);
    expect(g).toHaveLength(1);
    expect(g[0].label).toBe('Todos los ensayos');
  });
  it('grafica promedios con barras de ±1 DE o ±EE', () => {
    const sd = buildAnalysis(ds, trials, { x: 'vdesp', y: 'masa', group: '', avg: 'sd' });
    expect(sd.ax.avg).toBe('sd');
    expect(sd.series).toHaveLength(1);
    const [p1, p2] = sd.series[0].points;
    expect(p1.x).toBeCloseTo(8, 12);
    expect(p1.y).toBeCloseTo(21.6, 12);
    expect(p1.ey).toBeCloseTo(0.1, 12);
    expect(p1.ex).toBeCloseTo(0.5, 12);
    expect(p1.label).toContain('n = 3');
    // Un grupo con un solo ensayo usa ± media resolución.
    expect(p2.ey).toBeCloseTo(0.05, 12);
    const sem = buildAnalysis(ds, trials, { x: 'vdesp', y: 'masa', group: '', avg: 'sem' });
    expect(sem.series[0].points[0].ey).toBeCloseTo(0.1 / Math.sqrt(3), 12);
    // Por defecto se grafica cada ensayo.
    expect(buildAnalysis(ds, trials, { x: 'vdesp', y: 'masa', group: '' }).series[0].points).toHaveLength(4);
  });
});

group('fichas de instrumentos y sesión', () => {
  it('cada laboratorio adoptado declara resolución y σ positivas', () => {
    for (const id of ['densidad', 'newton', 'optica', 'gases', 'circuitos', 'conductores']) {
      expect(INSTRUMENTS[id]?.length, id).toBeGreaterThan(0);
      for (const i of INSTRUMENTS[id]) {
        expect(i.resolution).toBeGreaterThan(0);
        expect((i.sigma ?? 0) + (i.relSigma ?? 0)).toBeGreaterThan(0);
        expect(i.note.length).toBeGreaterThan(10);
      }
    }
    expect(instrument('densidad', 'balanza').resolution).toBe(0.1);
    expect(() => instrument('densidad', 'nada')).toThrow();
  });
  it('el modo de medición por defecto es ideal y las sesiones antiguas siguen cargando', () => {
    expect(emptySession('densidad').measurement).toBeUndefined();
    expect(loadSession('inexistente').measurement).toBeUndefined();
  });
});
