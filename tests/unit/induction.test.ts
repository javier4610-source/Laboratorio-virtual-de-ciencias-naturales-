import { describe, expect, it } from 'vitest';
import {
  COIL, EARTH_BH, FARADAY_PATH, GENERATOR, IND_LIMITS, LAMP, MAGNETS, MU0, SOLENOID, coilLinkage, dipoleAxialField, dipoleField,
  dipoleLoopFlux, dipoleLoopFluxNumeric, ellipticKE, emfFromTrajectory, generatorEmfAt, idealSolenoidField, inductionModelSpec,
  loopField, sampleSeries, simulateFaraday, simulateGenerator, simulateTransformer, solenoidAxisField, solenoidField,
  synchronousRpm, teslameterReading, trapezoid,
} from '../../src/models/induction';

describe('campo magnético de un imán (dipolo) y de un solenoide', () => {
  it('dipolo: B axial = μ₀·m/(2π·r³), el doble del ecuatorial, y decae como 1/r³', () => {
    const m = 1.2;
    const axial = dipoleField(m, 0.1, 0);
    expect(axial.bx).toBeCloseTo(2.4e-4, 12); // 1e-7·2·1,2/0,001
    expect(axial.by).toBeCloseTo(0, 15);
    expect(axial.b).toBeCloseTo(dipoleAxialField(m, 0.1), 15);
    const eq = dipoleField(m, 0, 0.1);
    expect(eq.bx).toBeCloseTo(-1.2e-4, 12); // en el plano ecuatorial apunta opuesto a m
    expect(axial.b / eq.b).toBeCloseTo(2, 10);
    expect(dipoleField(m, 0.2, 0).b / axial.b).toBeCloseTo(1 / 8, 10);
    // Las líneas de campo son tangentes a r = C·sen²θ: dy/dx del campo = pendiente de la curva.
    const th = 1.0, C = 0.12, r = C * Math.sin(th) ** 2;
    const x = r * Math.cos(th), y = r * Math.sin(th);
    const f = dipoleField(m, x, y);
    const dr = 2 * C * Math.sin(th) * Math.cos(th);
    const dx = dr * Math.cos(th) - r * Math.sin(th), dy = dr * Math.sin(th) + r * Math.cos(th);
    expect(Math.abs(f.bx * dy - f.by * dx) / (f.b * Math.hypot(dx, dy))).toBeLessThan(1e-9);
    // Invertir el imán invierte el campo
    expect(dipoleField(-m, 0.05, 0.03).bx).toBeCloseTo(-dipoleField(m, 0.05, 0.03).bx, 15);
    expect(() => dipoleField(m, 0, 0)).toThrow(RangeError);
  });

  it('integrales elípticas: valores de referencia K(0) = E(0) = π/2 y K(0,5), E(0,5)', () => {
    expect(ellipticKE(0).K).toBeCloseTo(Math.PI / 2, 12);
    expect(ellipticKE(0).E).toBeCloseTo(Math.PI / 2, 12);
    expect(ellipticKE(0.5).K).toBeCloseTo(1.8540746773, 9);
    expect(ellipticKE(0.5).E).toBeCloseTo(1.3506438810, 9);
  });

  it('espira: en su centro B = μ₀·I/(2a) y en el eje B = μ₀·I·a²/[2(a² + z²)^{3/2}]', () => {
    const a = 0.05, I = 3;
    expect(loopField(a, I, 0, 0).bz).toBeCloseTo((MU0 * I) / (2 * a), 12);
    expect(loopField(a, I, 0.04, 0).bz).toBeCloseTo((MU0 * I * a * a) / (2 * (a * a + 0.04 ** 2) ** 1.5), 12);
    expect(loopField(a, I, 0.04, 0.02).brho).toBeGreaterThan(0); // las líneas se abren al salir de la espira
    expect(loopField(a, I, 0.04, -0.02).brho).toBeCloseTo(-loopField(a, I, 0.04, 0.02).brho, 14);
  });

  it('solenoide: caso a mano (400 vueltas en 20 cm, 2,0 A): μ₀·n·I = 5,027 mT; finito en el centro 4,929 mT', () => {
    expect(idealSolenoidField(2000, 2)).toBeCloseTo(5.0265e-3, 7);
    expect(solenoidAxisField(2, 400, 0)).toBeCloseTo(4.9289e-3, 7);
    // La suma de espiras coincide con la fórmula del eje y el campo es casi uniforme dentro.
    expect(solenoidField(2, 400, 0, 0).bx).toBeCloseTo(solenoidAxisField(2, 400, 0), 7);
    expect(solenoidField(2, 400, 0, 0.01).bx / solenoidField(2, 400, 0, 0).bx).toBeCloseTo(1, 2);
    expect(solenoidField(2, 400, 0.05, 0).bx / solenoidAxisField(2, 400, 0.05)).toBeCloseTo(1, 3); // 60 espiras: error < 0,1 %
    // En el extremo cae a casi la mitad; afuera es mucho más débil.
    expect(solenoidAxisField(2, 400, SOLENOID.length / 2) / solenoidAxisField(2, 400, 0)).toBeCloseTo(0.5 / 0.98058 * 0.99504, 3);
    expect(solenoidField(2, 400, 0, 0.05).b).toBeLessThan(0.02 * solenoidField(2, 400, 0, 0).b);
    // Solenoide muy largo (L/a = 50): se acerca al ideal μ₀·n·I.
    expect(solenoidField(1, 1000, 0, 0, 1, 0.02).bx / idealSolenoidField(1000, 1)).toBeCloseTo(1, 2); // espiras cada 1,7 cm: error < 0,5 %
    expect(solenoidAxisField(1, 1000, 0, 1, 0.02) / idealSolenoidField(1000, 1)).toBeCloseTo(0.5 / Math.hypot(0.5, 0.02), 12);
    // B proporcional a I y a n
    expect(solenoidField(3, 400, 0, 0).bx / solenoidField(1.5, 400, 0, 0).bx).toBeCloseTo(2, 12);
    expect(solenoidField(2, 800, 0, 0).bx / solenoidField(2, 400, 0, 0).bx).toBeCloseTo(2, 12);
    expect(teslameterReading(solenoidField(2, 400, 0, 0).bx)).toBe(4.93);
    expect(EARTH_BH).toBeLessThan(1e-4);
  });
});

describe('ley de Faraday–Lenz: imán que entra o sale de una bobina', () => {
  it('flujo de un dipolo por una espira: fórmula cerrada = integración numérica de B sobre el disco', () => {
    for (const z of [0.01, 0.03, 0.08, -0.05]) {
      const exact = dipoleLoopFlux(1.2, 0.02, z);
      expect(dipoleLoopFluxNumeric(1.2, 0.02, z, 2000) / exact).toBeCloseTo(1, 6);
    }
    expect(dipoleLoopFlux(1.2, 0.02, 0)).toBeCloseTo((MU0 * 1.2) / (2 * 0.02), 15);
    // Flujo enlazado: proporcional a N, máximo en el centro y simétrico
    expect(coilLinkage(1.2, 400, -0.05) / coilLinkage(1.2, 200, -0.05)).toBeCloseTo(2, 12);
    expect(coilLinkage(1.2, 200, 0)).toBeGreaterThan(coilLinkage(1.2, 200, -0.01));
    expect(coilLinkage(1.2, 200, 0.03)).toBeCloseTo(coilLinkage(1.2, 200, -0.03), 14);
  });

  it('el área ∫ε dt = −N·ΔΦ̄ no depende de la rapidez; el pico sí crece con ella', () => {
    const base = { magnet: 'ferrita' as const, pole: 'N' as const, turns: 200, motion: 'introducir' as const };
    const runs = [0.2, 0.5, 1.0].map((speed) => simulateFaraday({ ...base, speed }));
    const dL = -(coilLinkage(1.2, 200, FARADAY_PATH.inside) - coilLinkage(1.2, 200, FARADAY_PATH.outside));
    for (const r of runs) {
      expect(r.area).toBeCloseTo(dL, 9);
      expect(r.minusDeltaLinkage).toBeCloseTo(dL, 12);
    }
    expect(runs[0].area * 1000).toBeCloseTo(-5.324, 3); // mV·s
    expect(Math.abs(runs[1].peak)).toBeGreaterThan(Math.abs(runs[0].peak));
    expect(Math.abs(runs[2].peak)).toBeGreaterThan(Math.abs(runs[1].peak));
    // A velocidad constante, ε = −(dΛ/dx)·v: el pico es proporcional a la rapidez.
    expect(runs[2].peak / runs[1].peak).toBeCloseTo(2, 2);
    expect(runs[1].peak * 1000).toBeCloseTo(-86.0, 1);
    // La corrida dura más si el imán va más despacio
    expect(runs[0].moveTime).toBeCloseTo(1, 12);
  });

  it('más vueltas → fem proporcional a N; invertir polo o sentido invierte el signo (Lenz)', () => {
    const r200 = simulateFaraday({ magnet: 'ferrita', pole: 'N', turns: 200, speed: 0.5, motion: 'introducir' });
    const r400 = simulateFaraday({ magnet: 'ferrita', pole: 'N', turns: 400, speed: 0.5, motion: 'introducir' });
    expect(r400.peak / r200.peak).toBeCloseTo(2, 10);
    const s = simulateFaraday({ magnet: 'ferrita', pole: 'S', turns: 200, speed: 0.5, motion: 'introducir' });
    expect(s.peak).toBeCloseTo(-r200.peak, 12);
    expect(s.area).toBeCloseTo(-r200.area, 12);
    const out = simulateFaraday({ magnet: 'ferrita', pole: 'N', turns: 200, speed: 0.5, motion: 'sacar' });
    expect(out.peak).toBeCloseTo(-r200.peak, 9);
    expect(out.area).toBeCloseTo(-r200.area, 9);
    // Neodimio: momento 3 veces mayor → fem 3 veces mayor
    const nd = simulateFaraday({ magnet: 'neodimio', pole: 'N', turns: 200, speed: 0.5, motion: 'introducir' });
    expect(nd.peak / r200.peak).toBeCloseTo(MAGNETS.neodimio.moment / MAGNETS.ferrita.moment, 10);
    // En reposo no hay fem
    expect(r200.emf[0]).toBe(0);
    expect(r200.emf[r200.emf.length - 1]).toBe(0);
  });

  it('trayectoria arbitraria (arrastre): ∫ε dt = −ΔΛ aunque la rapidez cambie', () => {
    const t: number[] = [], x: number[] = [];
    for (let i = 0; i <= 400; i++) { t.push(i * 0.0025); x.push(-0.15 + 0.15 * Math.sin((Math.PI / 2) * (i / 400)) ** 2); }
    const { linkage, emf } = emfFromTrajectory(t, x, 1.2, 300);
    expect(trapezoid(t, emf)).toBeCloseTo(-(linkage[400] - linkage[0]), 4);
    expect(sampleSeries([0, 1, 2], [0, 10, 20], 1.5)).toBe(15);
    expect(sampleSeries([0, 1, 2], [0, 10, 20], 5)).toBe(20);
  });

  it('valida los rangos de entrada', () => {
    expect(() => simulateFaraday({ magnet: 'ferrita', pole: 'N', turns: 10, speed: 0.5, motion: 'introducir' })).toThrow(RangeError);
    expect(() => simulateFaraday({ magnet: 'ferrita', pole: 'N', turns: 200, speed: 3, motion: 'introducir' })).toThrow(RangeError);
    expect(() => simulateGenerator({ turns: 100, field: 2, rpm: 600 })).toThrow(RangeError);
    expect(() => simulateTransformer({ n1: 0, n2: 20, v1: 120, source: 'ca', load: 12 })).toThrow(RangeError);
    expect(() => idealSolenoidField(Number.NaN, 1)).toThrow(RangeError);
  });
});

describe('generador de CA y transformador', () => {
  it('generador: ε₀ = N·B·A·ω (100 vueltas, 0,20 T, 20 cm², 600 rpm → 2,513 V a 10 Hz)', () => {
    const g = simulateGenerator({ turns: 100, field: 0.2, rpm: 600 });
    expect(GENERATOR.area).toBeCloseTo(0.002, 12);
    expect(g.omega).toBeCloseTo(20 * Math.PI, 12);
    expect(g.frequency).toBe(10);
    expect(g.peak).toBeCloseTo(2.51327, 5);
    expect(g.rms).toBeCloseTo(g.peak / Math.SQRT2, 12);
    expect(generatorEmfAt(g, g.period / 4)).toBeCloseTo(g.peak, 10);
    expect(generatorEmfAt(g, g.period / 2)).toBeCloseTo(0, 10);
    // Proporcional a la rapidez de giro, a N y a B
    expect(simulateGenerator({ turns: 100, field: 0.2, rpm: 1200 }).peak / g.peak).toBeCloseTo(2, 12);
    expect(simulateGenerator({ turns: 200, field: 0.2, rpm: 600 }).peak / g.peak).toBeCloseTo(2, 12);
    expect(simulateGenerator({ turns: 100, field: 0.4, rpm: 600 }).peak / g.peak).toBeCloseTo(2, 12);
    // Bombillo de 2,5 V: con 1,78 V eficaces brilla a la mitad de su potencia nominal; quieto, apagado.
    expect(g.lampPower).toBeCloseTo(g.rms ** 2 / LAMP.R, 12);
    expect(simulateGenerator({ turns: 100, field: 0.2, rpm: 0 }).brightness).toBe(0);
    // Red colombiana: 60 Hz con dos polos a 3 600 rpm; con 40 polos, 180 rpm.
    expect(synchronousRpm(60, 2)).toBe(3600);
    expect(synchronousRpm(60, 40)).toBe(180);
  });

  it('transformador ideal: V₂ = V₁·N₂/N₁, potencia conservada, y nada con CC', () => {
    const t = simulateTransformer({ n1: 400, n2: 20, v1: 120, source: 'ca', load: 12 });
    expect(t.v2).toBeCloseTo(6, 12);
    expect(t.i2).toBeCloseTo(0.5, 12);
    expect(t.i1).toBeCloseTo(0.025, 12);
    expect(t.p1).toBeCloseTo(t.p2, 12);
    expect(t.kind).toBe('reductor');
    const up = simulateTransformer({ n1: 100, n2: 2000, v1: 120, source: 'ca', load: 1000 });
    expect(up.v2).toBeCloseTo(2400, 9);
    expect(up.kind).toBe('elevador');
    expect(simulateTransformer({ n1: 200, n2: 200, v1: 120, source: 'ca', load: 100 }).kind).toBe('aislador');
    const dc = simulateTransformer({ n1: 400, n2: 20, v1: 12, source: 'cc', load: 12 });
    expect(dc.v2).toBe(0);
    expect(dc.i1).toBe(0);
  });

  it('la ficha del modelo declara entradas con rango, supuestos, límites y casos de prueba', () => {
    expect(inductionModelSpec.inputs.length).toBeGreaterThanOrEqual(6);
    expect(inductionModelSpec.assumptions.length).toBeGreaterThanOrEqual(4);
    expect(inductionModelSpec.limits.length).toBeGreaterThanOrEqual(4);
    expect(inductionModelSpec.testCases.length).toBeGreaterThanOrEqual(5);
    expect(IND_LIMITS.turns[0]).toBeLessThan(IND_LIMITS.turns[1]);
    expect(COIL.radius).toBe(0.02);
  });
});
