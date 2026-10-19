import { describe, expect, it } from 'vitest';
import {
  AIR_DENSITY, CART, FLAG_WIDTH, GATE_DISTANCE, GRAVITY_PRESETS, KP_INSTRUMENTS, KP_LIMITS, SPRINGS, cartMass, cartStateAt, dropStateAt,
  elasticPE, fallSpeed, fallSpeedAt, fallTime, fromGateReadings, gateSpeed, gateTime, gravitationalPE, idealReading, kineticEnergy,
  kineticPotentialModelSpec, significantDigits, simulateCart, simulateDrop, simulateSpring, speedFromKE, springLaunchSpeed, springStateAt, trackRun,
} from '../../src/models/kineticPotential';
import { roundToResolution } from '../../src/models/math';

describe('energía cinética y potencial: fórmulas básicas (8.º)', () => {
  it('caso de referencia del programa (sección 9.1): 1 kg a 10 m con g = 9,81 m/s²', () => {
    expect(gravitationalPE(1, 9.81, 10)).toBeCloseTo(98.1, 12);
    // v = √(2·9,81·10) = √196,2 = 14,00714… (calculado a mano: 14,007² = 196,196; 14,0072² = 196,2016)
    expect(fallSpeed(9.81, 10)).toBeCloseTo(14.00714, 5);
    expect(Number(fallSpeed(9.81, 10).toFixed(3))).toBe(14.007);
    expect(Number(fallSpeed(9.81, 10).toFixed(1))).toBe(14.0);
    expect(kineticEnergy(1, fallSpeed(9.81, 10))).toBeCloseTo(98.1, 10);
  });

  it('Ec = ½·m·v² con valores calculados a mano', () => {
    expect(kineticEnergy(0.5, 0.5)).toBeCloseTo(0.0625, 15);
    expect(kineticEnergy(2, 3)).toBeCloseTo(9, 15);
    expect(kineticEnergy(0.2, 2)).toBeCloseTo(0.4, 15);
    expect(kineticEnergy(1, -3)).toBeCloseTo(4.5, 15); // depende de la rapidez, no del sentido
  });

  it('doble rapidez → cuatro veces la Ec; triple → nueve veces; doble masa → doble Ec', () => {
    for (const m of [0.2, 0.5, 1]) {
      for (const v of [0.1, 0.37, 1, 1.9]) {
        const e = kineticEnergy(m, v);
        expect(kineticEnergy(m, 2 * v) / e).toBeCloseTo(4, 12);
        expect(kineticEnergy(m, 3 * v) / e).toBeCloseTo(9, 12);
        expect(kineticEnergy(2 * m, v) / e).toBeCloseTo(2, 12);
        // Linealización: Ec/v² = m/2 (pendiente de la recta Ec–v²)
        expect(e / (v * v)).toBeCloseTo(m / 2, 12);
      }
    }
  });

  it('Ep = m·g·h es proporcional a m, a g y a h, y cambia con el nivel de referencia', () => {
    expect(gravitationalPE(2, 9.81, 3)).toBeCloseTo(58.86, 12);
    expect(gravitationalPE(1, 1.62, 10)).toBeCloseTo(16.2, 12);
    expect(gravitationalPE(1, 3.71, 10)).toBeCloseTo(37.1, 12);
    expect(gravitationalPE(1, 9.81, 4) / gravitationalPE(1, 9.81, 2)).toBeCloseTo(2, 12);
    expect(gravitationalPE(1, 9.81, -0.5)).toBeCloseTo(-4.905, 12);
  });

  it('Ep elástica = ½·k·x² y la energía se transfiere toda al carrito sin rozamiento', () => {
    expect(elasticPE(50, 0.05)).toBeCloseTo(0.0625, 15);
    expect(elasticPE(100, 0.1)).toBeCloseTo(0.5, 15);
    expect(elasticPE(50, 0.1) / elasticPE(50, 0.05)).toBeCloseTo(4, 12); // doble compresión → cuatro veces
    // ½·k·x² = ½·m·v²  →  v = x·√(k/m): 0,05·√(50/0,5) = 0,5 m/s
    expect(springLaunchSpeed(50, 0.05, 0.5)).toBeCloseTo(0.5, 15);
    for (const s of SPRINGS) for (const x of [0.01, 0.04, 0.1]) for (const m of [0.2, 0.6, 1]) {
      expect(kineticEnergy(m, springLaunchSpeed(s.k, x, m))).toBeCloseTo(elasticPE(s.k, x), 12);
    }
  });

  it('rapidez desde la energía, fotopuerta y validación de errores', () => {
    expect(speedFromKE(2, 9)).toBeCloseTo(3, 15);
    expect(gateTime(0.05, 0.5)).toBeCloseTo(0.1, 15);
    expect(gateTime(FLAG_WIDTH, 2)).toBeCloseTo(0.025, 15);
    expect(gateSpeed(0.05, 0.1)).toBeCloseTo(0.5, 15);
    expect(() => kineticEnergy(0, 1)).toThrow(RangeError);
    expect(() => kineticEnergy(1, NaN)).toThrow(RangeError);
    expect(() => gravitationalPE(1, 0, 1)).toThrow(RangeError);
    expect(() => elasticPE(-1, 0.1)).toThrow(RangeError);
    expect(() => speedFromKE(1, -1)).toThrow(RangeError);
    expect(() => fallSpeed(9.81, -1)).toThrow(RangeError);
    expect(() => gateTime(0.05, 0)).toThrow(RangeError);
    expect(() => gateSpeed(0.05, -1)).toThrow(RangeError);
    expect(() => springLaunchSpeed(50, -0.01, 0.5)).toThrow(RangeError);
  });

  it('masa del carrito con pesas de 100 g', () => {
    expect(cartMass(0)).toBe(0.2);
    expect(cartMass(3)).toBe(0.5);
    expect(cartMass(CART.maxSlots)).toBe(1);
    expect(() => cartMass(9)).toThrow(RangeError);
    expect(() => cartMass(1.5)).toThrow(RangeError);
  });
});

describe('estación 1: carrito en el riel de aire', () => {
  it('sin rozamiento: Δt = L/v y la Ec no cambia hasta la fotopuerta', () => {
    const r = simulateCart({ mass: 0.5, launchSpeed: 0.5 });
    expect(r.run.reachesGate).toBe(true);
    expect(r.run.dtGate).toBeCloseTo(0.1, 14); // 5 cm a 0,5 m/s = 100 ms
    expect(r.run.tGate).toBeCloseTo(1.2, 14); // 0,60 m a 0,5 m/s
    expect(r.ek0).toBeCloseTo(0.0625, 15);
    expect(r.ekGate).toBeCloseTo(0.0625, 14);
    expect(r.heatGate).toBe(0);
  });

  it('con rozamiento: v² = v₀² − 2μgd, calor = μ·m·g·d y Ec + calor se conserva', () => {
    const r = simulateCart({ mass: 0.5, launchSpeed: 1, mu: 0.02 });
    const g = 9.81, a = 0.02 * g;
    expect(r.run.vGate).toBeCloseTo(Math.sqrt(1 - 2 * a * 0.6), 12); // 0,98816…
    expect(r.heatGate).toBeCloseTo(0.02 * 0.5 * g * 0.6, 12); // 0,05886 J
    expect(r.ekGate! + r.heatGate).toBeCloseTo(r.ek0, 12);
    // Δt exacto con desaceleración: entre x = 0,575 m y 0,625 m
    const t = (d: number) => (1 - Math.sqrt(1 - 2 * a * d)) / a;
    expect(r.run.dtGate).toBeCloseTo(t(0.625) - t(0.575), 12);
    for (const tt of [0, 0.2, 0.4, 0.6]) {
      const s = cartStateAt(r, tt);
      expect(s.ek + s.heat).toBeCloseTo(r.ek0, 12);
      expect(s.heat).toBeCloseTo(0.02 * 0.5 * g * s.x, 12);
    }
  });

  it('si el rozamiento lo frena antes, no llega a la fotopuerta', () => {
    const r = simulateCart({ mass: 0.5, launchSpeed: 0.2, mu: 0.05 });
    // distancia de frenado v₀²/(2μg) = 0,04/(0,981) = 0,0408 m < 0,6 m
    expect(r.run.reachesGate).toBe(false);
    expect(r.run.stopDistance).toBeCloseTo(0.04 / (2 * 0.05 * 9.81), 12);
    expect(r.ekGate).toBeNull();
    expect(cartStateAt(r, 100).v).toBe(0);
    expect(cartStateAt(r, 100).heat).toBeCloseTo(r.ek0, 12);
  });

  it('rechaza entradas fuera de rango', () => {
    expect(() => simulateCart({ mass: 0.1, launchSpeed: 1 })).toThrow(RangeError);
    expect(() => simulateCart({ mass: 0.5, launchSpeed: 3 })).toThrow(RangeError);
    expect(() => simulateCart({ mass: 0.5, launchSpeed: 1, mu: 0.2 })).toThrow(RangeError);
  });

  it('trackRun sin rozamiento coincide con L/v', () => {
    const r = trackRun(0.8, 0, 9.81);
    expect(r.dtGate).toBeCloseTo(FLAG_WIDTH / 0.8, 14);
    expect(r.vGate).toBe(0.8);
  });
});

describe('estación 2: caída desde la torre', () => {
  it('caso de referencia: 1 kg a 10 m en la Tierra (lecturas ideales)', () => {
    const r = simulateDrop({ mass: 1, height: 10, place: 'tierra' });
    expect(r.g).toBe(9.81);
    expect(r.ep0).toBeCloseTo(98.1, 12);
    expect(r.liftForce).toBeCloseTo(9.81, 12);
    expect(r.liftWork).toBeCloseTo(98.1, 12);
    expect(r.vGate).toBeCloseTo(14.007141, 6);
    expect(r.ekGate).toBeCloseTo(98.1, 10);
    expect(r.heatGate).toBeCloseTo(0, 10);
    // Δt = √(2·10,025/9,81) − √(2·9,975/9,81) = 1,4296177 − 1,4260481 = 3,5696 ms
    expect(r.dtGate * 1000).toBeCloseTo(3.56961, 4);
    expect(idealReading(r.dtGate * 1000, 'fotopuerta')).toBe(3.57);
    expect(idealReading(r.liftForce, 'fuerza')).toBe(9.81);
    // Lo que calcula el estudiante: v = 5 cm / 3,57 ms = 14,0056 m/s → 14,0 (3 cifras); Ec = 98,08 J → 98,1 J
    const s = fromGateReadings(1000, 3.57);
    expect(s.v).toBeCloseTo(14.0056, 4);
    expect(Number(s.ek.toPrecision(3))).toBe(98.1);
    expect(significantDigits(3.57, 0.01)).toBe(3);
    expect(significantDigits(25, 0.01)).toBe(4);
    expect(significantDigits(142.86, 0.01)).toBe(5);
  });

  it('la rapidez de caída no depende de la masa (sin aire) y L/Δt ≈ √(2gh) (sesgo ≈ (L/4h)²/2)', () => {
    for (const place of ['tierra', 'luna', 'marte'] as const) {
      for (const h of [0.2, 0.5, 1, 3, 10]) {
        const a = simulateDrop({ mass: 0.1, height: h, place });
        const b = simulateDrop({ mass: 2, height: h, place });
        expect(a.vGate).toBeCloseTo(b.vGate, 12);
        expect(a.dtGate).toBeCloseTo(b.dtGate, 12);
        expect(a.vGate).toBeCloseTo(Math.sqrt(2 * GRAVITY_PRESETS[place] * h), 12);
        const bias = Math.abs(FLAG_WIDTH / a.dtGate / a.vGate - 1);
        expect(bias).toBeLessThan(2e-3);
        expect(bias).toBeCloseTo((FLAG_WIDTH / (4 * h)) ** 2 / 2, 4); // aproximación de primer orden
        if (h >= 1) expect(bias).toBeLessThan(1e-4);
        // Ep proporcional a la masa: 20 veces más masa, 20 veces más Ep
        expect(b.ep0 / a.ep0).toBeCloseTo(20, 12);
      }
    }
  });

  it('Luna y Marte: la misma altura da menos Ep y menos rapidez', () => {
    const luna = simulateDrop({ mass: 1, height: 10, place: 'luna' });
    const marte = simulateDrop({ mass: 1, height: 10, place: 'marte' });
    expect(luna.ep0).toBeCloseTo(16.2, 12);
    expect(luna.vGate).toBeCloseTo(Math.sqrt(32.4), 12); // 5,692 m/s
    expect(marte.ep0).toBeCloseTo(37.1, 12);
    expect(marte.vGate).toBeCloseTo(Math.sqrt(74.2), 12); // 8,614 m/s
  });

  it('conservación sin aire: Ep + Ec es constante durante la caída', () => {
    const r = simulateDrop({ mass: 0.75, height: 6, place: 'tierra' });
    for (const t of [0, 0.3, 0.7, r.tGate]) {
      const s = dropStateAt(r, t);
      expect(s.ep + s.ek).toBeCloseTo(r.ep0, 10);
      expect(s.heat).toBeCloseTo(0, 10);
    }
    expect(dropStateAt(r, r.tGate).y).toBeCloseTo(0, 10);
  });

  it('con aire: v² = v_t²(1 − e^(−2gh/v_t²)) y Ep = Ec + E_disipada en todo instante', () => {
    const r = simulateDrop({ mass: 0.5, height: 10, place: 'tierra', drag: 0.01 });
    const vt2 = (0.5 * 9.81) / 0.01; // 490,5 m²/s²
    expect(r.vTerminal).toBeCloseTo(Math.sqrt(vt2), 12);
    expect(r.vGate).toBeCloseTo(Math.sqrt(vt2 * (1 - Math.exp((-2 * 9.81 * 10) / vt2))), 10); // 12,87 m/s
    expect(r.vGate).toBeLessThan(fallSpeed(9.81, 10));
    expect(r.heatGate).toBeGreaterThan(0);
    expect(r.ekGate + r.heatGate).toBeCloseTo(r.ep0, 10);
    for (const t of [0.2, 0.6, 1, r.tGate]) {
      const s = dropStateAt(r, t);
      expect(s.ep + s.ek + s.heat).toBeCloseTo(r.ep0, 10);
      expect(s.heat).toBeGreaterThanOrEqual(-1e-9);
    }
    // y(t) y t(y) son inversas
    expect(dropStateAt(r, r.tGate).y).toBeCloseTo(0, 8);
    // Integración numérica independiente (RK4 con paso pequeño) de m·dv/dt = m·g − c·v²
    let y = 0, v = 0; const dt = 1e-4, m = 0.5, c = 0.01, g = 9.81;
    const f = (vv: number) => g - (c / m) * vv * vv;
    while (y < 10) {
      const k1 = f(v), k2 = f(v + 0.5 * dt * k1), k3 = f(v + 0.5 * dt * k2), k4 = f(v + dt * k3);
      const vn = v + (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
      y += 0.5 * (v + vn) * dt; v = vn;
    }
    expect(v).toBeCloseTo(r.vGate, 2);
  });

  it('con aire el objeto más pesado llega algo más rápido; en la Luna no hay aire', () => {
    const light = simulateDrop({ mass: 0.1, height: 10, place: 'tierra', drag: 0.01 });
    const heavy = simulateDrop({ mass: 2, height: 10, place: 'tierra', drag: 0.01 });
    expect(heavy.vGate).toBeGreaterThan(light.vGate);
    const moon = simulateDrop({ mass: 0.1, height: 10, place: 'luna', drag: 0.02 });
    expect(AIR_DENSITY.luna).toBe(0);
    expect(moon.c).toBe(0);
    expect(moon.heatGate).toBeCloseTo(0, 12);
    const mars = simulateDrop({ mass: 0.1, height: 10, place: 'marte', drag: 0.012 });
    expect(mars.c).toBeCloseTo(0.0002, 12);
  });

  it('fórmulas de tiempo con c muy pequeño tienden a la caída libre (estabilidad numérica)', () => {
    for (const c of [1e-14, 1e-12, 1e-10]) {
      expect(fallTime(9.81, 10, c, 1)).toBeCloseTo(Math.sqrt(20 / 9.81), 5);
      expect(fallSpeedAt(9.81, 10, c, 1)).toBeCloseTo(Math.sqrt(196.2), 4);
    }
    expect(fallTime(9.81, 0)).toBe(0);
  });

  it('rechaza entradas fuera de rango', () => {
    expect(() => simulateDrop({ mass: 1, height: 0.1, place: 'tierra' })).toThrow(RangeError);
    expect(() => simulateDrop({ mass: 1, height: 11, place: 'tierra' })).toThrow(RangeError);
    expect(() => simulateDrop({ mass: 3, height: 2, place: 'tierra' })).toThrow(RangeError);
    expect(() => simulateDrop({ mass: 1, height: 2, place: 'jupiter' as 'tierra' })).toThrow();
    expect(() => simulateDrop({ mass: 1, height: 2, place: 'tierra', drag: 0.1 })).toThrow(RangeError);
  });
});

describe('estación 3: lanzador de resorte', () => {
  it('sin rozamiento: ½·k·x² = ½·m·v² en la fotopuerta', () => {
    const r = simulateSpring({ mass: 0.5, k: 50, compression: 0.05 });
    expect(r.epElastic).toBeCloseTo(0.0625, 15);
    expect(r.holdForce).toBeCloseTo(2.5, 15);
    expect(r.epElastic).toBeCloseTo(0.5 * r.holdForce * r.x, 15); // ½·F·x
    expect(r.vSep).toBeCloseTo(0.5, 14);
    expect(r.run!.dtGate).toBeCloseTo(0.1, 12);
    expect(r.ekGate).toBeCloseTo(r.epElastic, 14);
    expect(r.tSep).toBeCloseTo(Math.PI / 2 / 10, 14); // cuarto de periodo, ω = 10 rad/s
  });

  it('Ec en la fotopuerta es proporcional a x² (pendiente k/2) y no depende de la masa', () => {
    for (const s of SPRINGS) {
      for (const x of [0.01, 0.03, 0.08]) {
        const a = simulateSpring({ mass: 0.2, k: s.k, compression: x });
        const b = simulateSpring({ mass: 1, k: s.k, compression: x });
        expect(a.ekGate! / (x * x)).toBeCloseTo(s.k / 2, 10);
        expect(b.ekGate).toBeCloseTo(a.ekGate!, 12);
        expect(b.vSep! / a.vSep!).toBeCloseTo(Math.sqrt(0.2), 12);
      }
    }
  });

  it('con rozamiento: Ec = ½kx² − μ·m·g·(x + s) y el balance se cumple en todo instante', () => {
    const r = simulateSpring({ mass: 0.5, k: 50, compression: 0.08, mu: 0.03 });
    const g = 9.81;
    expect(r.separates).toBe(true);
    expect(r.ekGate).toBeCloseTo(0.5 * 50 * 0.0064 - 0.03 * 0.5 * g * (0.08 + GATE_DISTANCE), 12);
    expect(r.heatGate).toBeCloseTo(0.03 * 0.5 * g * 0.68, 12);
    expect(r.ekGate! + r.heatGate!).toBeCloseTo(r.epElastic, 12);
    // Rapidez de separación con la fórmula del movimiento armónico desplazado: v² = (k x² − 2 μ m g x)/m
    expect(r.vSep! ** 2).toBeCloseTo((50 * 0.0064 - 2 * 0.03 * 0.5 * g * 0.08) / 0.5, 12);
    const end = springStateAt(r, r.tSep!);
    expect(end.q).toBeCloseTo(0, 12);
    expect(end.v).toBeCloseTo(r.vSep!, 12);
    for (const t of [0, 0.05, r.tSep! / 2, r.tSep! + 0.4, r.tSep! + 1]) {
      const s = springStateAt(r, t);
      expect(s.ep + s.ek + s.heat).toBeCloseTo(r.epElastic, 12);
      // calor = μ·m·g·(distancia recorrida desde la compresión)
      const travelled = s.q + (t <= r.tSep! ? 0.08 : 0.08);
      expect(s.heat).toBeCloseTo(0.03 * 0.5 * g * travelled, 10);
    }
  });

  it('si ½·k·x ≤ μ·m·g el carrito no se separa del resorte', () => {
    // 0,5·25·0,02 = 0,25 N ≤ 0,05·1·9,81 = 0,49 N
    const r = simulateSpring({ mass: 1, k: 25, compression: 0.02, mu: 0.05 });
    expect(r.separates).toBe(false);
    expect(r.vSep).toBeNull();
    expect(r.ekGate).toBeNull();
    const s = springStateAt(r, 10);
    expect(s.v).toBeCloseTo(0, 10);
    expect(s.ep + s.ek + s.heat).toBeCloseTo(r.epElastic, 12);
  });

  it('rechaza entradas fuera de rango', () => {
    expect(() => simulateSpring({ mass: 0.5, k: 50, compression: 0.2 })).toThrow(RangeError);
    expect(() => simulateSpring({ mass: 0.5, k: 5, compression: 0.05 })).toThrow(RangeError);
    expect(() => simulateSpring({ mass: 0.5, k: 50, compression: 0 })).toThrow(RangeError);
  });
});

describe('lecturas, instrumentos y ficha del modelo', () => {
  it('lecturas ideales con la resolución de cada instrumento', () => {
    expect(idealReading(100.0049, 'fotopuerta')).toBe(100);
    expect(idealReading(9.8149, 'fuerza')).toBe(9.81);
    expect(idealReading(10.0004, 'cinta')).toBe(10);
    expect(idealReading(499.96, 'balanza')).toBe(500);
    expect(KP_INSTRUMENTS.fotopuerta.unit).toBe('ms');
    expect(roundToResolution(5.04, KP_INSTRUMENTS.regla.resolution)).toBe(5);
  });

  it('fromGateReadings: 500 g y 100,00 ms → 0,5 m/s y 0,0625 J', () => {
    const s = fromGateReadings(500, 100);
    expect(s.v).toBeCloseTo(0.5, 15);
    expect(s.v2).toBeCloseTo(0.25, 15);
    expect(s.ek).toBeCloseTo(0.0625, 15);
    expect(() => fromGateReadings(500, 0)).toThrow(RangeError);
  });

  it('la ficha declara ecuaciones, unidades, supuestos, límites, casos y el caso de referencia', () => {
    const s = kineticPotentialModelSpec;
    expect(s.equations.length).toBeGreaterThanOrEqual(6);
    expect(s.equations.some((e) => e.includes('½·m·v²'))).toBe(true);
    expect(s.equations.some((e) => e.includes('½·k·x²'))).toBe(true);
    expect(s.inputs.every((i) => i.unit.length > 0)).toBe(true);
    expect(s.outputs.every((o) => o.unit.length > 0)).toBe(true);
    expect(s.assumptions.length).toBeGreaterThanOrEqual(5);
    expect(s.limits.length).toBeGreaterThanOrEqual(3);
    expect(s.testCases.join(' ')).toContain('98,1 J');
    expect(s.initialConditions.join(' ')).toContain('14,007 m/s');
    const h = s.inputs.find((i) => i.symbol === 'h')!;
    expect(h.range).toEqual(KP_LIMITS.height);
    expect(KP_LIMITS.height[1]).toBeGreaterThanOrEqual(10); // el caso de referencia cabe en la interfaz
  });
});
