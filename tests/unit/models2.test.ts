import { describe, expect, it } from 'vitest';
import { countPhases, cycleState, estimatedDuration, expectedFractions, findTissue, generateField, mitoticIndex, ONION_2N } from '../../src/models/mitosis';
import { displacement, ropeSpeed, ropeWave, soundSpeedAir, soundWave } from '../../src/models/waves';
import { irradiance, simulatePhotosynthesis, type PhotoInput } from '../../src/models/photosynthesis';
import { dilutedPH, mixturePH, solvePH, titrate, titrationCurve } from '../../src/models/acidbase';
import { afterSelection, hardyWeinberg, simulatePopGen, type PopGenInput } from '../../src/models/popgen';

describe('mitosis (7.º)', () => {
  const mer = findTissue('meristemo');
  it('fracciones esperadas proporcionales a la duración de cada fase', () => {
    const f = expectedFractions(mer);
    expect(Object.values(f).reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(1 - f.interfase).toBeCloseTo(2 / 18, 6); // índice mitótico esperado ≈ 11 %
    expect(f.profase).toBeGreaterThan(f.anafase);
  });
  it('la zona de elongación divide mucho menos', () => {
    expect(1 - expectedFractions(findTissue('elongacion')).interfase).toBeLessThan(0.02);
  });
  it('la colchicina acumula metafase y vacía anafase', () => {
    const f0 = expectedFractions(mer, 0), f3 = expectedFractions(mer, 3);
    expect(f3.metafase).toBeGreaterThan(5 * f0.metafase);
    expect(f3.anafase).toBe(0);
  });
  it('con más células el índice observado se acerca al esperado; la semilla reproduce el campo', () => {
    const big = generateField(mer, 400, 3);
    expect(mitoticIndex(countPhases(big))).toBeGreaterThan(7);
    expect(mitoticIndex(countPhases(big))).toBeLessThan(16);
    expect(generateField(mer, 50, 9)).toEqual(generateField(mer, 50, 9));
    const c = countPhases(big);
    expect(estimatedDuration(c, 'interfase', 18)).toBeGreaterThan(14);
  });
  it('contenido de ADN y número de cromosomas a lo largo del ciclo', () => {
    expect(cycleState(1).dnaC).toBe(2);
    expect(cycleState(10).dnaC).toBeGreaterThan(2);
    expect(cycleState(14).dnaC).toBe(4);
    expect(cycleState(14).chromatidsPerChromosome).toBe(2);
    expect(cycleState(16 + 1 + 0.35 + 0.1).chromosomes).toBe(2 * ONION_2N); // anafase
    expect(cycleState(18.5).dnaC).toBe(2); // ciclo siguiente: cada célula hija vuelve a 2C
  });
});

describe('ondas (8.º)', () => {
  it('v = λ·f y la frecuencia no cambia la rapidez', () => {
    const a = ropeWave({ ropeId: 'media', tension: 20, frequency: 2, amplitude: 4 });
    const b = ropeWave({ ropeId: 'media', tension: 20, frequency: 4, amplitude: 4 });
    expect(a.speed).toBeCloseTo(10, 10);
    expect(a.wavelength * 2).toBeCloseTo(a.speed, 10);
    expect(b.speed).toBeCloseTo(a.speed, 10);
    expect(b.wavelength).toBeCloseTo(a.wavelength / 2, 10);
    expect(a.period).toBeCloseTo(0.5, 10);
  });
  it('cuadruplicar la tensión duplica la rapidez; la energía crece con A²', () => {
    expect(ropeSpeed(80, 0.2) / ropeSpeed(20, 0.2)).toBeCloseTo(2, 10);
    const e1 = ropeWave({ ropeId: 'media', tension: 20, frequency: 2, amplitude: 2 }).relativeEnergy;
    const e2 = ropeWave({ ropeId: 'media', tension: 20, frequency: 2, amplitude: 4 }).relativeEnergy;
    expect(e2 / e1).toBeCloseTo(4, 10);
  });
  it('sonido en el aire', () => {
    expect(soundSpeedAir(20)).toBeCloseTo(343.4, 1);
    const s = soundWave({ frequency: 440, temperature: 20 });
    expect(s.wavelength).toBeCloseTo(0.78, 2);
    expect(soundWave({ frequency: 25000, temperature: 20 }).range).toBe('ultrasonido');
  });
  it('la función de onda se repite cada λ y cada T', () => {
    const y0 = displacement(0.3, 0.1, 4, 5, 2);
    expect(displacement(0.3 + 5, 0.1, 4, 5, 2)).toBeCloseTo(y0, 10);
    expect(displacement(0.3, 0.1 + 0.5, 4, 5, 2)).toBeCloseTo(y0, 10);
  });
});

describe('fotosíntesis (10.º)', () => {
  const base: PhotoInput = { distance: 20, bicarbonate: 1, temperature: 25, color: 'blanca', lampOn: true };
  it('ley del inverso del cuadrado', () => {
    expect(irradiance(10) / irradiance(20)).toBeCloseTo(4, 10);
  });
  it('aumenta con la luz y se satura; en oscuridad solo hay respiración', () => {
    const rates = [100, 60, 40, 20, 10, 5].map((d) => simulatePhotosynthesis({ ...base, distance: d }).net);
    for (let i = 1; i < rates.length; i++) expect(rates[i]).toBeGreaterThan(rates[i - 1]);
    // rendimientos decrecientes: la ganancia por unidad de irradiancia cae con luz intensa
    const I = [100, 60, 40, 20, 10, 5].map(irradiance);
    expect((rates[5] - rates[4]) / (I[5] - I[4])).toBeLessThan(0.2 * (rates[2] - rates[1]) / (I[2] - I[1]));
    const dark = simulatePhotosynthesis({ ...base, lampOn: false });
    expect(dark.net).toBeLessThan(0);
    expect(dark.bubblesPerMin).toBe(0);
  });
  it('factor limitante: el CO₂ importa mucho con luz intensa y poco con luz débil', () => {
    const gain = (d: number) => simulatePhotosynthesis({ ...base, distance: d, bicarbonate: 5 }).net - simulatePhotosynthesis({ ...base, distance: d, bicarbonate: 0 }).net;
    expect(gain(8)).toBeGreaterThan(3 * gain(90));
    expect(simulatePhotosynthesis({ ...base, distance: 90 }).limiting).toBe('luz');
  });
  it('temperatura óptima entre 25 y 35 °C y punto de compensación positivo', () => {
    let best = 0, bestT = 0;
    for (let T = 5; T <= 45; T += 1) { const n = simulatePhotosynthesis({ ...base, distance: 10, bicarbonate: 3, temperature: T }).net; if (n > best) { best = n; bestT = T; } }
    expect(bestT).toBeGreaterThanOrEqual(25);
    expect(bestT).toBeLessThanOrEqual(35);
    const r = simulatePhotosynthesis(base);
    expect(r.compensationIrradiance!).toBeGreaterThan(0);
    expect(r.compensationIrradiance!).toBeLessThan(r.irradiance);
  });
  it('la luz verde produce menos que la roja a la misma distancia', () => {
    expect(simulatePhotosynthesis({ ...base, color: 'verde' }).net).toBeLessThan(simulatePhotosynthesis({ ...base, color: 'roja' }).net);
  });
});

describe('ácidos, bases y pH (11.º)', () => {
  it('ácido fuerte y dilución', () => {
    expect(solvePH(0.1, 0, null)).toBeCloseTo(1, 3);
    expect(dilutedPH('hcl', 0.1, 10)).toBeCloseTo(2, 3);
    expect(dilutedPH('hcl', 1e-8, 1)).toBeCloseTo(6.98, 2);
    expect(dilutedPH('hcl', 1e-3, 1e6)).toBeLessThan(7);
  });
  it('ácido débil: ácido acético 0,1 M', () => {
    expect(solvePH(0.1, 0, 1.8e-5)).toBeCloseTo(2.88, 2);
  });
  it('titulación fuerte-fuerte: pH 7 en la equivalencia y salto brusco', () => {
    const r = titrate({ acidId: 'hcl', acidConc: 0.1, acidVolume: 25, baseConc: 0.1, baseVolume: 25 });
    expect(r.equivalenceVolume).toBeCloseTo(25, 10);
    expect(r.pH).toBeCloseTo(7, 3);
    expect(r.state).toBe('punto de equivalencia');
    expect(mixturePH('hcl', 0.1, 25, 0.1, 24.9)).toBeLessThan(4.5);
    expect(mixturePH('hcl', 0.1, 25, 0.1, 25.1)).toBeGreaterThan(9.5);
  });
  it('titulación de ácido débil: pH = pKa en la semiequivalencia y > 7 en la equivalencia', () => {
    const r = titrate({ acidId: 'acetico', acidConc: 0.1, acidVolume: 25, baseConc: 0.1, baseVolume: 0 });
    expect(r.halfEquivalencePH!).toBeCloseTo(4.74, 1);
    expect(r.equivalencePH).toBeGreaterThan(8.5);
    expect(r.equivalencePH).toBeLessThan(9);
  });
  it('la curva de titulación es creciente', () => {
    const c = titrationCurve({ acidId: 'acetico', acidConc: 0.1, acidVolume: 25, baseConc: 0.1 }, 50);
    for (let i = 1; i < c.length; i++) expect(c[i].pH).toBeGreaterThanOrEqual(c[i - 1].pH - 1e-9);
  });
});

describe('genética de poblaciones (11.º)', () => {
  const neutral: PopGenInput = { p0: 0.3, n: 100, generations: 50, fitness: { AA: 1, Aa: 1, aa: 1 }, mutationAtoa: 0, migration: 0, migrantP: 0.5, drift: false, replicates: 1, seed: 1 };
  it('Hardy-Weinberg: sin fuerzas, p no cambia', () => {
    const hw = hardyWeinberg(0.3);
    expect(hw.AA + hw.Aa + hw.aa).toBeCloseTo(1, 12);
    expect(hw.Aa).toBeCloseTo(0.42, 12);
    expect(simulatePopGen(neutral).finalP[0]).toBeCloseTo(0.3, 12);
  });
  it('selección contra el recesivo: q baja cada vez más lento', () => {
    const r = simulatePopGen({ ...neutral, p0: 0.5, generations: 100, fitness: { AA: 1, Aa: 1, aa: 0 } });
    const q = r.series.map((s) => 1 - s.p[0]);
    expect(q[100]).toBeLessThan(0.02);
    expect(q[0] - q[10]).toBeGreaterThan(q[90] - q[100]);
    expect(1 / q[100]).toBeCloseTo(1 / 0.5 + 100, 6); // resultado analítico para recesivo letal: 1/q_t = 1/q_0 + t
  });
  it('ventaja del heterocigoto: equilibrio estable p* = t/(s+t)', () => {
    const w = { AA: 0.8, Aa: 1, aa: 0.2 }; // s = 0,2; t = 0,8 → p* = 0,8
    const up = simulatePopGen({ ...neutral, p0: 0.1, generations: 300, fitness: w });
    const down = simulatePopGen({ ...neutral, p0: 0.95, generations: 300, fitness: w });
    expect(up.equilibriumP).toBeCloseTo(0.8, 10);
    expect(up.finalP[0]).toBeCloseTo(0.8, 3);
    expect(down.finalP[0]).toBeCloseTo(0.8, 3);
    expect(afterSelection(0.8, w)).toBeCloseTo(0.8, 12);
  });
  it('deriva: las poblaciones pequeñas pierden variación más rápido (estadística sobre 8 réplicas × 10 semillas)', () => {
    let hSmall = 0, hBig = 0;
    for (let seed = 1; seed <= 10; seed++) {
      hSmall += simulatePopGen({ ...neutral, p0: 0.5, n: 10, generations: 100, drift: true, replicates: 8, seed }).heterozygosityFinal;
      hBig += simulatePopGen({ ...neutral, p0: 0.5, n: 1000, generations: 100, drift: true, replicates: 8, seed }).heterozygosityFinal;
    }
    expect(hSmall).toBeLessThan(hBig / 3);
  });
  it('mutación y migración desplazan la frecuencia; la semilla es reproducible', () => {
    expect(simulatePopGen({ ...neutral, p0: 0.9, mutationAtoa: 0.01, generations: 100 }).finalP[0]).toBeLessThan(0.9 * 0.99 ** 99);
    expect(simulatePopGen({ ...neutral, p0: 0.1, migration: 0.1, migrantP: 0.9, generations: 100 }).finalP[0]).toBeCloseTo(0.9, 3);
    const a = simulatePopGen({ ...neutral, drift: true, replicates: 3, seed: 5 });
    const b = simulatePopGen({ ...neutral, drift: true, replicates: 3, seed: 5 });
    expect(a.finalP).toEqual(b.finalP);
  });
});
