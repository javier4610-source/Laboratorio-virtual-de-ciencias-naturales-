import { describe, expect, it } from 'vitest';
import {
  bohrEnergy, closestApproachFm, maxEnergyForCoulomb, countScintillations, countsUntil, FOILS, foilById, GEIGER_MARSDEN_GOLD, H_IONIZATION_EV, impactForAngle,
  minDistance, NIST_BALMER_AIR, numberDensity, poisson, rutherfordAngle, rutherfordRate, rutherfordSetup, rutherfordTrajectory,
  sampleDeflections, thomsonMeanSquare, thomsonRate, thomsonSingleAngle, transition, wavelengthColor,
} from '../../src/models/atomicModels';
import { seededRandom } from '../../src/models/math';
import DATA from '../../src/data/quimica/tabla-periodica-pubchem.json';

const deg = (r: number) => (r * 180) / Math.PI;

describe('experimento de Rutherford: datos y cinemática', () => {
  it('las láminas usan Z, masa y densidad de la tabla de PubChem', () => {
    for (const f of FOILS) {
      const e = (DATA as { elementos: { simbolo: string; z: number; masa: number; densidad: number }[] }).elementos.find((x) => x.simbolo === f.sym)!;
      expect(f.Z).toBe(e.z);
      expect(f.molarMass).toBe(e.masa);
      expect(f.density).toBe(e.densidad);
    }
  });
  it('distancia de máximo acercamiento del oro con alfas de 5 MeV ≈ 45,5 fm', () => {
    expect(closestApproachFm(79, 5)).toBeCloseTo((1.439964 * 158) / 5, 10);
    expect(closestApproachFm(79, 5)).toBeCloseTo(45.5, 1);
  });
  it('tan(θ/2) = d/(2b): b = d/2 da 90° y b → 0 da 180°', () => {
    expect(deg(rutherfordAngle(0.5, 1))).toBeCloseTo(90, 10);
    expect(deg(rutherfordAngle(1e-9, 1))).toBeCloseTo(180, 4);
    expect(impactForAngle(rutherfordAngle(2.7, 1), 1)).toBeCloseTo(2.7, 10);
    expect(minDistance(Math.PI, 1)).toBeCloseTo(1, 12); // choque de frente: r_min = d
  });
  it('la trayectoria hiperbólica llega con parámetro b, sale con el ángulo θ y conserva la energía', () => {
    const d = 1, b = 0.8;
    const pts = rutherfordTrajectory(b, d, 400, 4000);
    const first = pts[0], last = pts[pts.length - 1];
    expect(first.x).toBeLessThan(-100);
    expect(first.y).toBeCloseTo(b, 2);
    const theta = rutherfordAngle(b, d);
    expect(Math.atan2(last.y, last.x)).toBeCloseTo(theta, 2);
    // Conservación de la energía: E = ½mv² + k/r, con v de la ley de las áreas (L = m·v∞·b) — en unidades donde ½mv∞² = 1
    // y k = d: v² = 1 − d/r. El momento angular b·v∞ = r²·φ̇ se cumple si r_min satisface b² = r_min² − d·r_min.
    const rmin = Math.min(...pts.map((p) => Math.hypot(p.x, p.y)));
    expect(rmin).toBeCloseTo(minDistance(theta, d), 2);
    expect(b * b).toBeCloseTo(rmin * rmin - d * rmin, 2);
  });
});

describe('conteos de Rutherford frente a Thomson', () => {
  const s = rutherfordSetup({ foilId: 'oro', energyMeV: 5, thicknessUm: 0.4 });
  it('N·sen⁴(θ/2) es constante en el modelo de Rutherford', () => {
    const c = [30, 60, 90, 150].map((t) => rutherfordRate(s, t) * Math.sin((t * Math.PI) / 360) ** 4);
    for (const v of c) expect(v / c[0]).toBeCloseTo(1, 12);
  });
  it('los datos de Geiger y Marsden (1913) cumplen N·sen⁴(θ/2) ≈ constante (±25 % de la media)', () => {
    const prod = GEIGER_MARSDEN_GOLD.map((g) => g.counts * Math.sin((g.theta * Math.PI) / 360) ** 4);
    const mean = prod.reduce((a, b) => a + b, 0) / prod.length;
    for (const p of prod) expect(Math.abs(p / mean - 1)).toBeLessThan(0.25);
    // y en cambio N varía en un factor de 4000 entre 15° y 150°
    expect(GEIGER_MARSDEN_GOLD.at(-1)!.counts / GEIGER_MARSDEN_GOLD[0].counts).toBeGreaterThan(3000);
  });
  it('N ∝ Z² y ∝ 1/E²', () => {
    const ag = rutherfordSetup({ foilId: 'plata', energyMeV: 5, thicknessUm: 0.4 });
    // A igual número de átomos por área el cociente sería (79/47)²; aquí cambia también n·t (otra densidad).
    const ratio = rutherfordRate(s, 60) / rutherfordRate(ag, 60);
    expect(ratio).toBeCloseTo(((79 / 47) ** 2 * numberDensity(foilById('oro'))) / numberDensity(foilById('plata')), 9);
    const s10 = rutherfordSetup({ foilId: 'oro', energyMeV: 7.5, thicknessUm: 0.4 });
    expect(rutherfordRate(s, 60) / rutherfordRate(s10, 60)).toBeCloseTo(2.25, 9);
  });
  it('Thomson: desviación máxima de un átomo ≈ 1,02·d/R y dispersión total menor de 1°', () => {
    expect(s.thomsonSingleMax / (s.d_m / s.R_atom)).toBeGreaterThan(1.0);
    expect(s.thomsonSingleMax / (s.d_m / s.R_atom)).toBeLessThan(1.05);
    expect(thomsonSingleAngle(2 * s.R_atom, s.d_m, s.R_atom)).toBe(0);
    expect(deg(s.thomsonRms)).toBeLessThan(1);
    expect(deg(s.thomsonRms)).toBeGreaterThan(0.1);
    // ⟨θ₁²⟩ por Monte Carlo coincide con la integral (±3 %)
    const rand = seededRandom(7);
    let acc = 0; const N = 40000;
    for (let i = 0; i < N; i++) acc += thomsonSingleAngle(s.R_atom * Math.sqrt(rand()), s.d_m, s.R_atom) ** 2;
    expect(acc / N / thomsonMeanSquare(s.d_m, s.R_atom)).toBeCloseTo(1, 1);
  });
  it('a 90° Thomson predice prácticamente cero centelleos y Rutherford decenas por minuto', () => {
    const th = thomsonRate(s, 90);
    expect(th.rate).toBe(0);
    expect(th.log10).toBeLessThan(-1000);
    expect(rutherfordRate(s, 90) * 60).toBeGreaterThan(10);
    expect(1 / s.fractionBack).toBeGreaterThan(1000); // menos de 1 de cada mil rebota más de 90°
  });
  it('el conteo es una muestra de Poisson reproducible con la semilla', () => {
    const a = countScintillations(s, 60, 60, 11), b = countScintillations(s, 60, 60, 11);
    expect(a.counts).toBe(b.counts);
    expect(Math.abs(a.counts - a.expected)).toBeLessThan(5 * Math.sqrt(a.expected));
    expect(countsUntil(a, 0)).toBe(0);
    expect(countsUntil(a, 60)).toBe(a.counts);
    const rand = seededRandom(3);
    const xs = Array.from({ length: 4000 }, () => poisson(4, rand));
    const mean = xs.reduce((p, q) => p + q, 0) / xs.length;
    expect(mean).toBeCloseTo(4, 0);
  });
  it('avisa cuando la alfa llega a tocar el núcleo (aluminio a 9 MeV) y no con el oro a 5 MeV', () => {
    expect(s.warnings).toHaveLength(0);
    expect(rutherfordSetup({ foilId: 'aluminio', energyMeV: 9, thicknessUm: 1 }).warnings[0]).toMatch(/fuerza nuclear/);
    // La corrección propuesta (energía máxima) hace desaparecer el aviso
    const emax = maxEnergyForCoulomb(foilById('aluminio'));
    expect(rutherfordSetup({ foilId: 'aluminio', energyMeV: emax, thicknessUm: 1 }).warnings).toHaveLength(0);
    expect(rutherfordSetup({ foilId: 'aluminio', energyMeV: emax + 0.5, thicknessUm: 1 }).warnings).toHaveLength(1);
    expect(maxEnergyForCoulomb(foilById('oro'))).toBeGreaterThan(9);
  });
  it('la muestra para el dibujo 3D tiene desviaciones grandes ∝ 1/sen⁴ y el resto casi recto', () => {
    const d = sampleDeflections(s, 400, 5, 10, 2000);
    expect(d.filter((x) => x.large).every((x) => deg(x.theta) >= 10 - 1e-9)).toBe(true);
    expect(d.filter((x) => !x.large).every((x) => deg(x.theta) < 5)).toBe(true);
  });
});

describe('átomo de Bohr', () => {
  it('niveles Eₙ = −13,598 eV/n² (energía de ionización del H de PubChem/NIST)', () => {
    const h = (DATA as { elementos: { z: number; ionizacion: number }[] }).elementos[0];
    expect(H_IONIZATION_EV).toBe(h.ionizacion);
    expect(bohrEnergy(1)).toBeCloseTo(-13.598, 10);
    expect(bohrEnergy(2)).toBeCloseTo(-3.3995, 4);
  });
  it('serie de Balmer a menos de 0,05 nm del NIST (aire)', () => {
    for (const [n, nist] of Object.entries(NIST_BALMER_AIR)) {
      const t = transition(Number(n), 2);
      expect(Math.abs(t.lambdaAirNm - nist), `n = ${n}`).toBeLessThan(0.05);
      expect(t.region).toBe('visible');
    }
    expect(transition(2, 1).region).toBe('ultravioleta');
    expect(transition(4, 3).region).toBe('infrarrojo');
    expect(transition(3, 2).colorName).toBe('rojo');
    expect(() => transition(2, 3)).toThrow(RangeError);
  });
  it('el color de dibujo de Hα es rojo y el de Hβ, azul verdoso', () => {
    expect(wavelengthColor(656.3)).toMatch(/^#ff0000|^#ff/);
    const hb = wavelengthColor(486.1);
    expect(parseInt(hb.slice(5, 7), 16)).toBeGreaterThan(parseInt(hb.slice(1, 3), 16));
  });
});
