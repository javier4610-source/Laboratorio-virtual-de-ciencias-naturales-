import { describe, expect, it } from 'vitest';
import {
  advance, createSampler, crossed, decimalsFor, gaussian, quantize, rangeStats, runToCSV, snapToSample, startAcquisition,
  type LoggerChannel, type LoggerRun,
} from '../../src/lib/logger';
import { seededRandom } from '../../src/models/math';

const lin: LoggerChannel = { id: 'x', name: 'Posición', unit: 'm', resolution: 0.01, sample: (t) => 2 * t + 1, noise: 0.05 };

describe('registrador de datos: cuantización y ruido', () => {
  it('cuantiza a la resolución del instrumento sin errores de coma flotante', () => {
    expect(quantize(1.23456, 0.01)).toBe(1.23);
    expect(quantize(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(quantize(17, 2)).toBe(18);
    expect(quantize(3.14159, 0)).toBe(3.14159);
    expect(decimalsFor(0.1)).toBe(1);
    expect(decimalsFor(0.05)).toBe(2);
    expect(decimalsFor(1)).toBe(0);
  });
  it('el ruido gaussiano con semilla tiene media ≈ 0 y desviación ≈ 1', () => {
    const g = gaussian(seededRandom(42));
    const xs = Array.from({ length: 20000 }, g);
    const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
    const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / xs.length);
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(sd).toBeGreaterThan(0.97);
    expect(sd).toBeLessThan(1.03);
  });
  it('es reproducible con la misma semilla y respeta el modo ideal', () => {
    const a = createSampler([lin], 7, false), b = createSampler([lin], 7, false);
    const ra = [0, 0.5, 1].map((t) => a.read(t)[0]);
    const rb = [0, 0.5, 1].map((t) => b.read(t)[0]);
    expect(ra).toEqual(rb);
    ra.forEach((v) => expect(Math.abs(v * 100 - Math.round(v * 100))).toBeLessThan(1e-9));
    const ideal = createSampler([lin], 7, true);
    expect(ideal.read(0.5)[0]).toBe(2);
  });
  it('satura la lectura en los límites del sensor', () => {
    const s = createSampler([{ ...lin, noise: 0, max: 3 }], 1, false);
    expect(s.read(5)[0]).toBe(3);
  });
});

describe('registrador de datos: adquisición y disparo', () => {
  const ideal = () => createSampler([{ ...lin, noise: 0 }], 1, true);
  it('adquiere a la frecuencia elegida y por tramos da lo mismo que de una vez', () => {
    const whole = advance(startAcquisition(5, 2, null), ideal(), 2);
    expect(whole.samples).toHaveLength(11);
    expect(whole.samples[10].t).toBe(2);
    expect(whole.done).toBe(true);
    const parts = startAcquisition(5, 2, null);
    const s = ideal();
    for (const t of [0.13, 0.4, 0.41, 1.7, 9]) advance(parts, s, t);
    expect(parts.samples).toEqual(whole.samples);
  });
  it('el disparo por umbral empieza a registrar al cruzar (flanco de subida y de bajada)', () => {
    expect(crossed(null, 5, { channel: 0, level: 3, edge: 'subida' })).toBe(false);
    expect(crossed(2.9, 3, { channel: 0, level: 3, edge: 'subida' })).toBe(true);
    expect(crossed(4, 2, { channel: 0, level: 3, edge: 'bajada' })).toBe(true);
    const acq = advance(startAcquisition(10, 3, { channel: 0, level: 3, edge: 'subida' }), ideal(), 3);
    expect(acq.triggerTime).toBe(1); // 2·t + 1 = 3 en t = 1 s
    expect(acq.samples[0].t).toBe(1);
    expect(acq.samples).toHaveLength(21);
  });
  it('sin cruce no registra nada', () => {
    const acq = advance(startAcquisition(10, 3, { channel: 0, level: 3, edge: 'bajada' }), ideal(), 3);
    expect(acq.triggerTime).toBeNull();
    expect(acq.samples).toHaveLength(0);
  });
});

describe('registrador de datos: estadísticas y exportación', () => {
  const samples = Array.from({ length: 11 }, (_, i) => ({ t: i, values: [3 * i - 2] }));
  it('mín, máx, media y pendiente en una selección', () => {
    const st = rangeStats(samples, 0, 2, 6)!;
    expect(st.n).toBe(5);
    expect(st.min).toBe(4);
    expect(st.max).toBe(16);
    expect(st.mean).toBe(10);
    expect(st.slope).toBeCloseTo(3, 10);
    expect(st.intercept).toBeCloseTo(-2, 10);
    expect(rangeStats(samples, 0, 6, 2)!.n).toBe(5);
    expect(rangeStats(samples, 0, 20, 30)).toBeNull();
    expect(rangeStats([samples[0]], 0)!.slope).toBeNull();
  });
  it('ajusta marcadores a la muestra más cercana', () => {
    expect(snapToSample(samples, 4.4)).toBe(4);
    expect(snapToSample([], 1)).toBeNull();
  });
  it('exporta CSV con punto y coma, coma decimal y marcadores', () => {
    const run: LoggerRun = {
      rate: 2, ideal: false, triggerTime: 0.5,
      channels: [{ id: 'v', name: 'Volumen', unit: 'mL', resolution: 0.1 }],
      samples: [{ t: 0.5, values: [1.2] }, { t: 1, values: [2.5] }],
      markers: [{ t: 1, label: 'M1' }],
    };
    const csv = runToCSV(run).split('\n');
    expect(csv).toContain('Tiempo (s);Volumen (mL);Marcador');
    expect(csv).toContain('0,5;1,2;');
    expect(csv).toContain('1,0;2,5;M1');
    expect(csv.some((l) => l.includes('Disparo en t = 0,5 s'))).toBe(true);
  });
});
