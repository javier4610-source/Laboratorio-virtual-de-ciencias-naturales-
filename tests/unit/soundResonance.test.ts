import { describe, expect, it } from 'vitest';
import {
  FORK_PARTIALS, FORKS, SCOPE, SOUND_INSTRUMENTS, analyzeResonances, effectiveLength, endCorrection, forkEnvelope, freeFieldMicMv,
  intensityAt, intensityToLevel, levelToIntensity, linearApproxError, nearestNote, octavesAbove, playbackLevel, resonanceLengths,
  resonances, rulerReading, scopeReading, scopeView, soundLevel, soundModelSpec, speedOfSound, tubeResponse, wavelength, type TubeInput,
} from '../../src/models/soundResonance';

const base: TubeInput = { f: 512, tempC: 28, lengthCm: 10, diameterCm: 3.5, type: 'cerrado', source: 'diapason' };

describe('rapidez del sonido v = 331,3·√(1 + T/273,15)', () => {
  it('valores calculados a mano', () => {
    expect(speedOfSound(0)).toBeCloseTo(331.3, 10);
    expect(speedOfSound(28)).toBeCloseTo(331.3 * Math.sqrt(301.15 / 273.15), 10);
    expect(speedOfSound(28)).toBeCloseTo(347.866, 2); // Apartadó
    expect(speedOfSound(20)).toBeCloseTo(343.2, 1);
    expect(wavelength(512, 28)).toBeCloseTo(0.67943, 4);
  });

  it('crece con la temperatura y coincide con la aproximación lineal de la práctica de ondas a menos de 1 m/s', () => {
    for (let T = 0; T < 40; T += 5) expect(speedOfSound(T + 5)).toBeGreaterThan(speedOfSound(T));
    for (let T = 0; T <= 40; T += 1) expect(Math.abs(linearApproxError(T))).toBeLessThan(1);
    // v ∝ √(temperatura absoluta)
    expect(speedOfSound(40) / speedOfSound(10)).toBeCloseTo(Math.sqrt(313.15 / 283.15), 12);
    expect(() => speedOfSound(80)).toThrow(RangeError);
    expect(() => wavelength(10, 20)).toThrow(RangeError);
  });
});

describe('resonancias de un tubo', () => {
  it('tubo cerrado: L_n = (2n − 1)λ/4 − 0,6·r (valores a mano con 512 Hz y 28 °C)', () => {
    expect(endCorrection(3.5)).toBeCloseTo(1.05, 12);
    expect(effectiveLength(10, 3.5, 'cerrado')).toBeCloseTo(11.05, 12);
    expect(effectiveLength(10, 3.5, 'abierto')).toBeCloseTo(12.1, 12);
    const lam = wavelength(512, 28) * 100;
    const L = resonanceLengths(512, 28, 3.5, 'cerrado', 2, 95);
    expect(L).toHaveLength(3);
    expect(L[0]).toBeCloseTo(lam / 4 - 1.05, 10);
    expect(L[0]).toBeCloseTo(15.94, 2);
    expect(L[1]).toBeCloseTo(49.91, 2);
    expect(L[2]).toBeCloseTo(83.88, 2);
  });

  it('resonancias sucesivas difieren en λ/2 en tubos cerrados y abiertos (la corrección se cancela)', () => {
    for (const { f } of FORKS) {
      for (const type of ['cerrado', 'abierto'] as const) {
        for (const D of [2.5, 3.5, 5]) {
          const L = resonanceLengths(f, 28, D, type, 0, 300);
          expect(L[1] - L[0]).toBeCloseTo((wavelength(f, 28) * 100) / 2, 9);
        }
      }
    }
    // abierto: L₁ + 2e = λ/2
    const Lo = resonanceLengths(512, 28, 3.5, 'abierto', 0, 100);
    expect(Lo[0] + 2.1).toBeCloseTo((wavelength(512, 28) * 100) / 2, 9);
    // un tubo más ancho resuena con una columna un poco más corta
    expect(resonanceLengths(384, 28, 5, 'cerrado')[0]).toBeLessThan(resonanceLengths(384, 28, 2.5, 'cerrado')[0]);
  });

  it('el máximo de la amplitud del micrófono al barrer L coincide con L_n y es mucho mayor que fuera de resonancia', () => {
    const expected = resonanceLengths(512, 28, 3.5, 'cerrado', 2, 95);
    let best = { L: 0, v: 0 };
    for (let L = 2; L <= 30; L = Math.round((L + 0.01) * 100) / 100) {
      const v = tubeResponse({ ...base, lengthCm: L }).micMv;
      if (v > best.v) best = { L, v };
    }
    expect(Math.abs(best.L - expected[0])).toBeLessThan(0.05);
    const off = tubeResponse({ ...base, lengthCm: 32.9 }).micMv; // cerca de la antirresonancia (λ/2 − e)
    expect(best.v / off).toBeGreaterThan(10);
    expect(off).toBeGreaterThanOrEqual(12); // nunca menos que el sonido directo
    // tubo abierto: máximo cerca de λ/2 − 2e
    const lo = resonanceLengths(512, 28, 3.5, 'abierto', 20, 100)[0];
    const at = tubeResponse({ ...base, type: 'abierto', lengthCm: lo }).micMv;
    expect(at).toBeGreaterThan(tubeResponse({ ...base, type: 'abierto', lengthCm: lo + 1 }).micMv);
    expect(at).toBeGreaterThan(tubeResponse({ ...base, type: 'abierto', lengthCm: lo - 1 }).micMv);
  });

  it('amortiguamiento: Q finito, picos más bajos y anchos en resonancias de orden mayor', () => {
    const rs = resonances(512, 28, 3.5, 'cerrado');
    expect(rs.map((r) => r.n)).toEqual([1, 3, 5]);
    for (const r of rs) { expect(r.Q).toBeGreaterThan(10); expect(r.Q).toBeLessThan(200); }
    expect(rs[1].peakMv).toBeLessThan(rs[0].peakMv);
    expect(rs[2].widthCm).toBeGreaterThan(rs[0].widthCm);
    // ancho a media potencia: la amplitud del factor R cae a 1/√2
    const r0 = rs[0];
    const R = (L: number) => tubeResponse({ ...base, lengthCm: L }).response;
    expect(R(r0.lengthCm + r0.widthCm / 2) / R(r0.lengthCm)).toBeCloseTo(Math.SQRT1_2, 1);
  });

  it('análisis del estudiante: v = 2·(L₂ − L₁)·f recupera el modelo y 4·L₁·f lo subestima', () => {
    const [L1, L2] = resonanceLengths(512, 28, 3.5, 'cerrado');
    const a = analyzeResonances(L1, L2, 512, 'cerrado');
    expect(a.speed).toBeCloseTo(speedOfSound(28), 8);
    expect(a.endCorrectionCm).toBeCloseTo(1.05, 8);
    expect(a.speedNaive).toBeLessThan(a.speed);
    const [o1, o2] = resonanceLengths(320, 20, 5, 'abierto', 20, 120);
    const b = analyzeResonances(o1, o2, 320, 'abierto');
    expect(b.speed).toBeCloseTo(speedOfSound(20), 8);
    expect(b.endCorrectionCm).toBeCloseTo(1.5, 8);
    // con lecturas de la regla (0,1 cm) del ejemplo de la evaluación
    expect(analyzeResonances(21.6, 66.9, 384, 'cerrado').speed).toBeCloseTo(347.904, 3);
    expect(() => analyzeResonances(50, 16, 512, 'cerrado')).toThrow(RangeError);
  });

  it('valida los rangos de entrada', () => {
    expect(() => tubeResponse({ ...base, lengthCm: 1 })).toThrow(RangeError);
    expect(() => tubeResponse({ ...base, type: 'abierto', lengthCm: 10 })).toThrow(RangeError);
    expect(() => tubeResponse({ ...base, tempC: 45 })).toThrow(RangeError);
    expect(() => tubeResponse({ ...base, lengthCm: Number.NaN })).toThrow(RangeError);
    expect(() => endCorrection(0)).toThrow(RangeError);
  });
});

describe('osciloscopio', () => {
  it('lectura con cursores en el estado inicial (512 Hz, 0,5 ms/div, 10 mV/div)', () => {
    const v = tubeResponse(base).micMv;
    expect(v).toBeCloseTo(13.84, 2);
    const view = scopeView(512, v, 0.5, 10);
    expect(view.n).toBe(2);
    expect(view.timeRes).toBeCloseTo(0.1, 12);
    const r = scopeReading(512, v, 0.5, 10);
    expect(r.periodMs).toBeCloseTo(1.95, 12);
    expect(r.freqHz).toBeCloseTo(512.82, 2);
    expect(r.ampMv).toBe(14);
  });

  it('recorta la señal que supera 4 divisiones y mejora la resolución con escalas más finas', () => {
    const peak = resonances(512, 28, 3.5, 'cerrado')[0].peakMv;
    expect(scopeView(512, peak, 0.5, 10).clipped).toBe(true);
    expect(scopeReading(512, peak, 0.5, 10).ampMv).toBeNull();
    expect(scopeReading(512, peak, 0.5, 50).ampMv).toBe(170);
    // con 5 ms/div caben 25 periodos: los cursores abarcan 10 y el error relativo del periodo baja
    const coarse = scopeReading(512, 14, 5, 10).periodMs!;
    expect(Math.abs(coarse - 1000 / 512)).toBeLessThan(0.1);
    // con 0,1 ms/div no cabe un periodo de 256 Hz (3,9 ms)
    expect(scopeReading(256, 14, 0.1, 10).periodMs).toBeNull();
    expect(SCOPE.timePerDiv).toContain(0.5);
  });
});

describe('nivel sonoro e intensidad (ley del inverso del cuadrado)', () => {
  it('valores a mano y −6,02 dB al duplicar la distancia', () => {
    expect(intensityAt(1e-4, 1)).toBeCloseTo(1e-4 / (4 * Math.PI), 15);
    expect(intensityToLevel(1e-12)).toBeCloseTo(0, 12);
    expect(levelToIntensity(60)).toBeCloseTo(1e-6, 15);
    expect(soundLevel(1e-4, 1, -100)).toBeCloseTo(69.01, 2);
    expect(soundLevel(1e-4, 1, -100) - soundLevel(1e-4, 2, -100)).toBeCloseTo(20 * Math.log10(2), 10);
    expect(intensityAt(1e-4, 1) / intensityAt(1e-4, 2)).toBeCloseTo(4, 12);
    // con ruido de fondo de 35 dB el nivel nunca baja de 35 dB
    expect(soundLevel(1e-5, 4)).toBeGreaterThan(35);
    // la amplitud del micrófono es proporcional a 1/d
    expect(freeFieldMicMv(1e-4, 1, 28) / freeFieldMicMv(1e-4, 2, 28)).toBeCloseTo(2, 10);
    expect(freeFieldMicMv(1e-4, 1, 28)).toBeCloseTo(40.28, 1);
    expect(() => intensityAt(0, 1)).toThrow(RangeError);
  });
});

describe('altura, diapasón e instrumentos', () => {
  it('nota más cercana y octavas', () => {
    expect(nearestNote(440)).toEqual({ midi: 69, name: 'La₄', cents: 0 });
    expect(nearestNote(256).name).toBe('Do₄');
    expect(nearestNote(256).cents).toBeCloseTo(-37.6, 1);
    expect(nearestNote(512).midi - nearestNote(256).midi).toBe(12);
    expect(octavesAbove(512)).toBeCloseTo(1, 12);
    expect(octavesAbove(1024, 256)).toBeCloseTo(2, 12);
  });

  it('envolvente del diapasón, parciales y nivel de reproducción', () => {
    expect(forkEnvelope(0)).toBe(1);
    expect(forkEnvelope(2.5)).toBeCloseTo(Math.exp(-1), 12);
    expect(forkEnvelope(5)).toBeLessThan(forkEnvelope(1));
    expect(FORK_PARTIALS[2][0]).toBeCloseTo(6.267, 3);
    expect(FORK_PARTIALS.every(([, a]) => a <= 1)).toBe(true);
    expect(playbackLevel(100)).toBeCloseTo(0.5, 12);
    expect(playbackLevel(500)).toBe(1);
    expect(playbackLevel(-1)).toBe(0);
    expect(rulerReading(15.936)).toBe(15.9);
    expect(SOUND_INSTRUMENTS.map((i) => i.id)).toEqual(['regla', 'osciloscopio', 'sonometro', 'cinta']);
    expect(soundModelSpec.assumptions.length).toBeGreaterThanOrEqual(4);
  });
});
