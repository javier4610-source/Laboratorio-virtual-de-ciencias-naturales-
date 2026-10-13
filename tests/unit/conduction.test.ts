import { describe, expect, it } from 'vitest';
import {
  AMBIENT_T, ROD_AREA, RODS, SKIN, TACK_SLOTS_CM, WAX_MELT_T, bareLossCoefficient, contactTemperature, diffusivity, effusivity,
  explicitStableDt, finParameter, finParams, findRod, fourierFromProbes, fourierHeatFlow, lossCoefficient, rodProblem, simulateConduction,
  skinContact, slabHeatFlux, solveRod, steadyBaseHeatFlow, steadyTemperature, tackSummary, temperatureAt, thermocoupleReading, type RodProblem,
} from '../../src/models/conduction';

/** erfc con la aproximación 7.1.26 de Abramowitz y Stegun (error < 1,5·10⁻⁷). */
function erfc(x: number): number {
  const t = 1 / (1 + 0.3275911 * x);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  return poly * Math.exp(-x * x);
}

const copper = rodProblem({ rod: 'cobre', cover: 'aire', bathT: 90 });

describe('propiedades térmicas y relaciones básicas', () => {
  it('difusividad α = k/(ρc) y efusividad e = √(kρc) con valores de tabla', () => {
    expect(diffusivity(findRod('cobre')) * 1e6).toBeCloseTo(116.6, 1); // 401/(8933·385)
    expect(diffusivity(findRod('inox')) * 1e6).toBeCloseTo(3.954, 3);
    expect(diffusivity(findRod('madera')) * 1e6).toBeCloseTo(0.3552, 3);
    expect(effusivity(findRod('cobre'))).toBeCloseTo(Math.sqrt(401 * 8933 * 385), 6);
    expect(effusivity(findRod('cobre'))).toBeGreaterThan(37000);
    // Orden de α: el cobre es el más rápido y la madera la más lenta.
    const alphas = RODS.map((r) => diffusivity(r));
    expect([...alphas].sort((a, b) => b - a)).toEqual(alphas);
    expect(() => diffusivity({ k: 0, rho: 1, c: 1 })).toThrow(RangeError);
  });

  it('ley de Fourier y pared plana calculadas a mano', () => {
    // Cobre, A = π·(4 mm)² = 5,0265·10⁻⁵ m², dT/dx = −100 K/m → q = 401·5,0265·10⁻⁵·100 = 2,0156 W.
    expect(ROD_AREA).toBeCloseTo(5.0265e-5, 8);
    expect(fourierHeatFlow(401, ROD_AREA, -100)).toBeCloseTo(2.0156, 4);
    expect(fourierHeatFlow(401, ROD_AREA, 0)).toBe(0);
    // Pared de 2 cm con 32 °C de diferencia: icopor 64 W/m², aire quieto 42,08 W/m², vidrio 2240 W/m².
    expect(slabHeatFlux(0.04, 0.02, 32)).toBeCloseTo(64, 9);
    expect(slabHeatFlux(0.0263, 0.02, 32)).toBeCloseTo(42.08, 9);
    expect(slabHeatFlux(1.4, 0.02, 32)).toBeCloseTo(2240, 9);
    // Estudiante: termopares a 5 cm (82,2 °C) y 15 cm (71,5 °C) en cobre → −1,07 °C/cm y q ≈ 2,157 W.
    const f = fourierFromProbes(401, 5, 82.2, 15, 71.5)!;
    expect(f.gradient).toBeCloseTo(-1.07, 9);
    expect(f.q).toBeCloseTo(401 * ROD_AREA * 107, 9);
    expect(fourierFromProbes(401, 5, 80, 5.2, 79)).toBeNull();
  });

  it('coeficiente de pérdidas: convección + radiación; la funda de icopor lo reduce', () => {
    expect(bareLossCoefficient(0)).toBeCloseTo(9.5, 12);
    expect(bareLossCoefficient(1)).toBeCloseTo(9.5 + 4 * 5.670374419e-8 * 315.15 ** 3, 9);
    const r1 = 0.004, r2 = 0.014, hOut = bareLossCoefficient(0.9);
    expect(lossCoefficient(findRod('cobre'), 'icopor')).toBeCloseTo(1 / ((r1 * Math.log(r2 / r1)) / 0.04 + r1 / (r2 * hOut)), 9);
    for (const r of RODS) expect(lossCoefficient(r, 'icopor')).toBeLessThan(lossCoefficient(r, 'aire'));
    expect(finParameter(10, 401, 0.008)).toBeCloseTo(Math.sqrt(40 / (401 * 0.008)), 12);
  });
});

describe('solución estacionaria exacta de la aleta', () => {
  it('conserva la energía: el calor que entra por la base sale por la superficie lateral y la punta', () => {
    for (const id of ['cobre', 'inox', 'vidrio'] as const) {
      const p = finParams(rodProblem({ rod: id, cover: 'aire', bathT: 90 }));
      // Simpson sobre θ(x) con 2000 intervalos.
      const n = 2000, h = p.L / n;
      let s = 0;
      for (let i = 0; i <= n; i++) s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * (steadyTemperature(p, i * h) - p.Tamb);
      const lateral = p.U * Math.PI * p.D * (s * h) / 3;
      const tip = p.Utip * (Math.PI * p.D * p.D / 4) * (steadyTemperature(p, p.L) - p.Tamb);
      expect((lateral + tip) / steadyBaseHeatFlow(p)).toBeCloseTo(1, 6);
    }
  });

  it('casos límite: θ(0) = θ_b; sin pérdidas el perfil es uniforme; aleta larga ≈ e^(−mx)', () => {
    const p = finParams(copper);
    expect(steadyTemperature(p, 0)).toBeCloseTo(90, 12);
    const lossless = { ...p, U: 0, Utip: 0 };
    expect(steadyTemperature(lossless, 0.2)).toBeCloseTo(90, 12);
    expect(steadyBaseHeatFlow(lossless)).toBe(0);
    // Madera: m ≈ 178 1/m, mL ≈ 53 → aleta infinitamente larga.
    const w = finParams(rodProblem({ rod: 'madera', cover: 'aire', bathT: 90 }));
    const m = finParameter(w.U, w.k);
    expect((steadyTemperature(w, 0.01) - AMBIENT_T) / 62).toBeCloseTo(Math.exp(-m * 0.01), 6);
  });
});

describe('solución numérica (Crank–Nicolson y explícito)', () => {
  it('tras muchas constantes de tiempo converge al perfil estacionario exacto y al flujo q_f', () => {
    for (const id of ['cobre', 'hierro', 'inox'] as const) {
      const prob = rodProblem({ rod: id, cover: 'aire', bathT: 90 });
      const sol = solveRod(prob, { duration: 9000, dt: 5, snapEvery: 9000 });
      const last = sol.profiles[sol.profiles.length - 1];
      const p = finParams(prob);
      for (let i = 0; i <= sol.nodes; i += 6) expect(Math.abs(last[i] - steadyTemperature(p, i * sol.dx)), `${id} x=${i}`).toBeLessThan(0.05);
      // Flujo discreto en la base: conducción hacia el nodo 1 + pérdidas de la media celda de la base.
      const qBase = (prob.k * ROD_AREA * (last[0] - last[1])) / sol.dx + prob.U * Math.PI * prob.D * (sol.dx / 2) * (last[0] - AMBIENT_T);
      expect(qBase / steadyBaseHeatFlow(p)).toBeCloseTo(1, 2);
    }
  });

  it('sin pérdidas y a tiempos cortos coincide con el medio semiinfinito θ/θ_b = erfc(x/(2√(αt)))', () => {
    const prob: RodProblem = { ...copper, U: 0, Utip: 0 };
    const alpha = prob.k / (prob.rho * prob.c);
    const sol = solveRod(prob, { nodes: 300, dt: 0.05, duration: 20, snapEvery: 20 });
    for (const x of [0.01, 0.02, 0.04, 0.06]) {
      const exact = erfc(x / (2 * Math.sqrt(alpha * 20)));
      expect(Math.abs((temperatureAt(sol, x, 20) - AMBIENT_T) / 62 - exact), `x=${x}`).toBeLessThan(2e-3);
    }
  });

  it('criterio de estabilidad del explícito: coincide con Crank–Nicolson si se cumple y diverge si se excede', () => {
    const dtMax = explicitStableDt(copper, 60);
    // Para el cobre con Δx = 5 mm el límite es ≈ 0,1 s (2α/Δx² ≈ 9,3 1/s).
    expect(dtMax).toBeGreaterThan(0.09);
    expect(dtMax).toBeLessThan(0.11);
    const ok = solveRod(copper, { scheme: 'explicito', dt: 0.9 * dtMax, duration: 120, snapEvery: 120 });
    const cn = solveRod(copper, { dt: 0.25, duration: 120, snapEvery: 120 });
    expect(ok.stable).toBe(true);
    for (const x of [0.03, 0.1, 0.2]) expect(Math.abs(temperatureAt(ok, x, 120) - temperatureAt(cn, x, 120))).toBeLessThan(0.05);
    const bad = solveRod(copper, { scheme: 'explicito', dt: 1.5 * dtMax, duration: 120, snapEvery: 120 });
    expect(bad.stable).toBe(false);
    const worst = Math.max(...Array.from(bad.profiles[bad.profiles.length - 1]).map((v) => Math.abs(v)));
    expect(worst > 1e6 || !Number.isFinite(worst)).toBe(true);
    // Crank–Nicolson con Δt = 5 s (25 veces el límite explícito) sigue acotado entre T_amb y T_baño.
    const big = solveRod(copper, { dt: 5, duration: 600, snapEvery: 600 });
    for (const v of big.profiles[1]) { expect(v).toBeGreaterThanOrEqual(AMBIENT_T - 1e-6); expect(v).toBeLessThanOrEqual(90 + 1e-6); }
  });

  it('la malla es suficientemente fina: refinar Δx y Δt cambia menos de 0,05 °C', () => {
    const a = solveRod(copper, { duration: 600, snapEvery: 600 });
    const b = solveRod(copper, { nodes: 240, dt: 0.25, duration: 600, snapEvery: 600 });
    for (const x of [0.05, 0.15, 0.25]) expect(Math.abs(temperatureAt(a, x, 600) - temperatureAt(b, x, 600))).toBeLessThan(0.05);
    expect(Math.abs((a.tackFall[3] ?? 0) - (b.tackFall[3] ?? 0))).toBeLessThan(1);
  });

  it('es lineal en la diferencia de temperatura con el salón (θ escala con T_baño − T_amb)', () => {
    const s90 = simulateConduction({ rod: 'laton', cover: 'aire', bathT: 90 });
    const s60 = simulateConduction({ rod: 'laton', cover: 'aire', bathT: 60 });
    for (const x of [0.05, 0.15]) {
      const scaled = AMBIENT_T + ((60 - AMBIENT_T) / (90 - AMBIENT_T)) * (temperatureAt(s90.solution, x, 900) - AMBIENT_T);
      expect(temperatureAt(s60.solution, x, 900)).toBeCloseTo(scaled, 9);
    }
  });
});

describe('práctica: tachuelas, termopares y tacto', () => {
  it('las tachuelas caen antes en los metales de mayor difusividad; en vidrio y madera no cae ninguna', () => {
    const fall3 = RODS.map((r) => simulateConduction({ rod: r.id, cover: 'aire', bathT: 90 }).solution.tackFall[0]);
    const [cu, al, br, fe, ss, gl, wd] = fall3;
    expect(cu!).toBeLessThan(al!);
    expect(al!).toBeLessThan(br!);
    expect(br!).toBeLessThan(fe!);
    expect(fe!).toBeLessThan(ss!);
    expect(gl).toBeNull();
    expect(wd).toBeNull();
    // Escala de difusión: t ≈ x²/α da el orden de magnitud (cobre, 3 cm: ≈ 7,7 s).
    expect(cu!).toBeGreaterThan(2);
    expect(cu!).toBeLessThan(15);
    // Con un baño por debajo del punto de fusión de la cera, nada cae.
    expect(simulateConduction({ rod: 'cobre', cover: 'aire', bathT: WAX_MELT_T - 5 }).solution.tackFall.every((t) => t === null)).toBe(true);
  });

  it('las tachuelas de una varilla caen en orden, y el resumen cuenta solo las montadas', () => {
    const s = simulateConduction({ rod: 'cobre', cover: 'aire', bathT: 90 });
    const f = s.solution.tackFall as number[];
    expect(f.every((t) => t !== null)).toBe(true);
    for (let i = 1; i < f.length; i++) expect(f[i]).toBeGreaterThan(f[i - 1]);
    expect(tackSummary(s.solution.tackFall, 4)).toEqual({ fallen: 4, farthest: 12 });
    const ss = simulateConduction({ rod: 'inox', cover: 'aire', bathT: 90 });
    expect(tackSummary(ss.solution.tackFall, TACK_SLOTS_CM.length)).toEqual({ fallen: 1, farthest: 3 });
    expect(tackSummary(ss.solution.tackFall, 0)).toEqual({ fallen: 0, farthest: 0 });
  });

  it('la funda de icopor reduce las pérdidas y deja la varilla más caliente', () => {
    for (const id of ['laton', 'hierro', 'inox'] as const) {
      const bare = simulateConduction({ rod: id, cover: 'aire', bathT: 90 });
      const ins = simulateConduction({ rod: id, cover: 'icopor', bathT: 90 });
      expect(temperatureAt(ins.solution, 0.15, 1800)).toBeGreaterThan(temperatureAt(bare.solution, 0.15, 1800));
      expect(ins.qSteady).toBeLessThan(bare.qSteady);
    }
    expect(thermocoupleReading(temperatureAt(simulateConduction({ rod: 'cobre', cover: 'aire', bathT: 90 }).solution, 0.05, 1800))).toBeCloseTo(82.2, 9);
  });

  it('temperatura de contacto: a la misma temperatura, el metal se siente más frío que la madera y el icopor', () => {
    // Contacto de dos cuerpos semiinfinitos: promedio ponderado por la efusividad.
    expect(contactTemperature(1000, 33, 1000, 23)).toBeCloseTo(28, 12);
    const eSkin = effusivity(SKIN);
    expect(eSkin).toBeCloseTo(Math.sqrt(0.37 * 1100 * 3400), 9);
    const cu = skinContact('cobre', 28), wood = skinContact('madera', 28), foam = skinContact('icopor', 28), air = skinContact('aire', 28);
    expect(cu).toBeLessThan(28.3);
    expect(wood).toBeGreaterThan(31);
    expect(foam).toBeGreaterThan(32.8);
    expect(cu).toBeLessThan(wood);
    expect(wood).toBeLessThan(foam);
    expect(foam).toBeLessThan(air);
    // Al sol (60 °C) se invierte: el metal se siente más caliente que la madera.
    expect(skinContact('cobre', 60)).toBeGreaterThan(skinContact('madera', 60));
    // Si el objeto está a la temperatura de la piel, no se siente ni frío ni caliente.
    expect(skinContact('cobre', 33)).toBeCloseTo(33, 12);
  });

  it('rechaza entradas fuera de rango o desconocidas', () => {
    expect(() => simulateConduction({ rod: 'cobre', cover: 'aire', bathT: 120 })).toThrow(RangeError);
    expect(() => simulateConduction({ rod: 'cobre', cover: 'aire', bathT: 30 })).toThrow(RangeError);
    expect(() => simulateConduction({ rod: 'oro' as never, cover: 'aire', bathT: 90 })).toThrow();
    expect(() => simulateConduction({ rod: 'cobre', cover: 'vacio' as never, bathT: 90 })).toThrow();
    expect(() => skinContact('cobre', 90)).toThrow(RangeError);
    expect(() => solveRod(copper, { nodes: 2 })).toThrow(RangeError);
    expect(() => contactTemperature(0, 30, 10, 20)).toThrow(RangeError);
  });
});
