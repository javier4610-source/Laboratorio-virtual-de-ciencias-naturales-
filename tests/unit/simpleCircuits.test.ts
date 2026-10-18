import { describe, expect, it } from 'vitest';
import {
  LAMP_R_COLD, SC, filamentTemperature, lampArrangement, lampPowerAt, lampResistanceAt, meterReading, simpleCircuitModelSpec, solveLinear,
  solveSimpleCircuit as solve, type NetPart,
} from '../../src/models/simpleCircuits';

const cable = (id: string, a: string, b: string): NetPart => ({ id, kind: 'cable', a, b });
const cell = (id: string, neg: string, pos: string): NetPart => ({ id, kind: 'pila', a: neg, b: pos });
const lamp = (id: string, a: string, b: string): NetPart => ({ id, kind: 'bombillo', a, b });
const sw = (id: string, a: string, b: string, closed: boolean): NetPart => ({ id, kind: 'interruptor', a, b, closed });
const twoCells = [cell('P1', 'n', 'm'), cell('P2', 'm', 'p')];

/** Suma de corrientes que salen de cada borne (ley de nodos). */
function kclResiduals(parts: NetPart[], r: ReturnType<typeof solve>): number[] {
  const sum = new Map<string, number>();
  for (const p of parts) {
    const i = r.parts[p.id].current; // de a hacia b a través de la pieza
    sum.set(p.a, (sum.get(p.a) ?? 0) + i);
    sum.set(p.b, (sum.get(p.b) ?? 0) - i);
  }
  return [...sum.values()];
}

describe('solucionador lineal (eliminación gaussiana con pivoteo)', () => {
  it('resuelve un sistema 3 × 3 calculado a mano y detecta matrices singulares', () => {
    const x = solveLinear([[0, 2, 1], [1, 1, 1], [2, 1, 0]], [7, 6, 4]);
    expect(x).not.toBeNull();
    expect(x![0]).toBeCloseTo(1, 12); expect(x![1]).toBeCloseTo(2, 12); expect(x![2]).toBeCloseTo(3, 12);
    expect(solveLinear([[1, 2], [2, 4]], [1, 2])).toBeNull();
  });
});

describe('análisis nodal modificado: circuitos óhmicos', () => {
  it('una pila y un resistor de 100 Ω cumplen la ley de Ohm con la resistencia interna y la de los cables', () => {
    const parts = [cell('P1', 'n', 'p'), { id: 'R1', kind: 'resistor', a: 'p', b: 'x' } as NetPart, cable('C1', 'x', 'n')];
    const r = solve(parts);
    const I = 1.5 / (100 + SC.cell.r + SC.wireR);
    expect(r.status).toBe('cerrado');
    expect(r.parts.R1.current).toBeCloseTo(I, 9);
    expect(r.parts.P1.current).toBeCloseTo(I, 9);
    expect(r.parts.P1.terminalVoltage).toBeCloseTo(1.5 - I * SC.cell.r, 9);
    // Ley de mallas: la fem se reparte entre r, el resistor y el cable
    expect(I * SC.cell.r + r.parts.R1.voltage + r.parts.C1.voltage).toBeCloseTo(1.5, 9);
    for (const s of kclResiduals(parts, r)) expect(Math.abs(s)).toBeLessThan(1e-9);
  });

  it('cortocircuito: un cable entre los bornes de la pila da I = ε/(r + R_cable) ≈ 7,14 A y la pila se calienta', () => {
    const r = solve([cell('P1', 'n', 'p'), cable('C1', 'p', 'n')]);
    expect(r.status).toBe('corto');
    expect(r.short).toBe(true);
    expect(r.parts.P1.current).toBeCloseTo(1.5 / 0.21, 9);
    expect(r.parts.P1.heating).toBeCloseTo((1.5 / 0.21) ** 2 * 0.2, 6); // ≈ 10,2 W dentro de la pila
    expect(r.warnings[0]).toMatch(/Cortocircuito/);
  });

  it('el amperímetro en paralelo con la pila también produce un cortocircuito y se advierte', () => {
    const r = solve([cell('P1', 'n', 'p'), { id: 'M', kind: 'multimetro', mode: 'A', a: 'p', b: 'n' }]);
    expect(r.status).toBe('corto');
    expect(r.meter!.value).toBeCloseTo(1.5 / 0.3, 6);
    expect(r.warnings.some((w) => /amperímetro siempre va en serie/.test(w))).toBe(true);
  });

  it('circuito abierto: con el interruptor abierto no hay corriente y el voltímetro sobre el interruptor lee la fem', () => {
    const parts: NetPart[] = [...twoCells, sw('S1', 'p', 's', false), lamp('B1', 's', 'y'), cable('C1', 'y', 'n'),
      { id: 'M', kind: 'multimetro', mode: 'V', a: 'p', b: 's' }];
    const r = solve(parts);
    expect(r.status).toBe('abierto');
    expect(Math.abs(r.parts.B1.current)).toBeLessThan(1e-6);
    expect(r.parts.B1.on).toBe(false);
    expect(meterReading(r.meter!)).toBe(3);
    expect(r.warnings.some((w) => /abierto/.test(w))).toBe(true);
    // Sin pilas no hay nada que calcular
    expect(solve([lamp('B1', 'a', 'b')]).status).toBe('sin-pila');
    expect(solve([]).status).toBe('vacio');
  });
});

describe('bombillo de filamento (resistencia que depende de la temperatura)', () => {
  it('a 2,5 V disipa 0,75 W a 2700 K; en frío su resistencia es unas 14 veces menor', () => {
    expect(lampPowerAt(2.5)).toBeCloseTo(0.75, 10);
    expect(lampResistanceAt(2.5)).toBeCloseTo(2.5 / 0.3, 8);
    expect(filamentTemperature(0.75)).toBeCloseTo(2700, 8);
    expect(LAMP_R_COLD).toBeCloseTo((2.5 / 0.3) * (300 / 2700) ** 1.2, 12);
    expect(lampResistanceAt(0.001)).toBeCloseTo(LAMP_R_COLD, 12);
    // No es óhmico: duplicar el voltaje no duplica la corriente
    const i1 = lampPowerAt(1.25) / 1.25, i2 = lampPowerAt(2.5) / 2.5;
    expect(i2 / i1).toBeGreaterThan(1.3);
    expect(i2 / i1).toBeLessThan(2);
  });

  it('con una pila, la solución es autoconsistente: V = ε − I·(r + cables) e I = P(V)/V', () => {
    const r = solve([cell('P1', 'n', 'p'), lamp('B1', 'p', 'x'), cable('C1', 'x', 'n')]);
    const b = r.parts.B1;
    expect(r.converged).toBe(true);
    expect(b.voltage).toBeCloseTo(1.5 - b.current * (SC.cell.r + SC.wireR), 9);
    expect(b.current).toBeCloseTo(lampPowerAt(b.voltage) / b.voltage, 9);
    expect(b.brightness).toBeGreaterThan(0.3);
    expect(b.brightness).toBeLessThan(0.6);
  });

  it('serie contra paralelo: misma corriente en serie (menos brillo); mismo voltaje en paralelo (más brillo)', () => {
    const serie: NetPart[] = [...twoCells, lamp('B1', 'p', 'y'), lamp('B2', 'y', 'z'), cable('C1', 'z', 'n')];
    const paralelo: NetPart[] = [...twoCells, lamp('B1', 'p', 'z'), lamp('B2', 'p', 'z'), cable('C1', 'z', 'n')];
    const s = solve(serie), p = solve(paralelo);
    expect(s.parts.B1.current).toBeCloseTo(s.parts.B2.current, 9);
    expect(p.parts.B1.voltage).toBeCloseTo(p.parts.B2.voltage, 9);
    expect(p.parts.B1.brightness).toBeGreaterThan(2 * s.parts.B1.brightness);
    expect(p.parts.P1.current).toBeCloseTo(p.parts.B1.current + p.parts.B2.current, 9);
    for (const x of kclResiduals(paralelo, p)) expect(Math.abs(x)).toBeLessThan(1e-9);
    // Quitar un bombillo: en serie se apagan todos; en paralelo el otro sigue encendido
    const s1 = solve(serie.filter((q) => q.id !== 'B2'));
    expect(s1.status).toBe('abierto');
    expect(s1.parts.B1.on).toBe(false);
    const p1 = solve(paralelo.filter((q) => q.id !== 'B2'));
    expect(p1.parts.B1.on).toBe(true);
    expect(p1.parts.B1.brightness).toBeGreaterThan(p.parts.B1.brightness); // la pila se exige menos: cae menos voltaje en r
    // Reconocimiento de la conexión (los cables unen bornes en un mismo nodo)
    expect(lampArrangement(serie)).toBe('serie');
    expect(lampArrangement(paralelo)).toBe('paralelo');
    expect(lampArrangement([...twoCells, lamp('B1', 'p', 'z'), lamp('B2', 'q', 'w'), cable('C2', 'p', 'q'), cable('C3', 'z', 'w'), cable('C1', 'w', 'n')])).toBe('paralelo');
    expect(lampArrangement([...twoCells, lamp('B1', 'p', 'y'), lamp('B2', 'y', 'z'), lamp('B3', 'y', 'z'), cable('C1', 'z', 'n')])).toBe('mixta');
    expect(lampArrangement(twoCells)).toBe('sin bombillos');
  });

  it('dos pilas en paralelo dan el mismo voltaje que una, pero cada una entrega la mitad de la corriente', () => {
    const r = solve([cell('P1', 'n', 'p'), cell('P2', 'n', 'p'), lamp('B1', 'p', 'x'), cable('C1', 'x', 'n')]);
    const one = solve([cell('P1', 'n', 'p'), lamp('B1', 'p', 'x'), cable('C1', 'x', 'n')]);
    expect(r.parts.P1.current).toBeCloseTo(r.parts.P2.current, 9);
    expect(r.parts.P1.current + r.parts.P2.current).toBeCloseTo(r.parts.B1.current, 9);
    expect(r.parts.B1.voltage).toBeGreaterThan(one.parts.B1.voltage);
    expect(r.parts.B1.voltage).toBeLessThan(1.5);
  });
});

describe('LED, motor, zumbador y materiales', () => {
  it('el LED tiene polaridad: ≈ 10,4 mA con 100 Ω y dos pilas; al revés no conduce', () => {
    const fwd: NetPart[] = [...twoCells, { id: 'R1', kind: 'resistor', a: 'p', b: 'x' }, { id: 'LED1', kind: 'led', a: 'x', b: 'y' }, cable('C1', 'y', 'n')];
    const r = solve(fwd);
    const I = (3 - 1.8) / (100 + 15 + 0.4 + 0.01);
    expect(r.parts.LED1.current).toBeCloseTo(I, 9);
    expect(r.parts.LED1.on).toBe(true);
    const rev = solve(fwd.map((p) => (p.id === 'LED1' ? { ...p, a: 'y', b: 'x' } : p)));
    expect(Math.abs(rev.parts.LED1.current)).toBeLessThan(1e-9);
    expect(rev.parts.LED1.on).toBe(false);
    expect(rev.status).toBe('abierto');
    expect(rev.warnings.some((w) => /al revés/.test(w))).toBe(true);
    // Una sola pila (1,5 V) no alcanza el umbral de 1,8 V del LED rojo
    const one = solve([cell('P1', 'n', 'p'), { id: 'LED1', kind: 'led', a: 'p', b: 'n' }]);
    expect(one.parts.LED1.on).toBe(false);
    // Sin resistor, dos pilas lo sobrecargan
    const bare = solve([...twoCells, { id: 'LED1', kind: 'led', a: 'p', b: 'n' }]);
    expect(bare.parts.LED1.current).toBeGreaterThan(SC.led.iMax);
    expect(bare.warnings.some((w) => /resistor en serie/.test(w))).toBe(true);
  });

  it('el motor gira más rápido con más voltaje y cambia de sentido al invertir la polaridad', () => {
    const one = solve([cell('P1', 'n', 'p'), { id: 'M1', kind: 'motor', a: 'p', b: 'n' }]);
    const two = solve([...twoCells, { id: 'M1', kind: 'motor', a: 'p', b: 'n' }]);
    const rev = solve([...twoCells, { id: 'M1', kind: 'motor', a: 'n', b: 'p' }]);
    expect(one.parts.M1.rpm!).toBeGreaterThan(3000);
    expect(two.parts.M1.rpm! / one.parts.M1.rpm!).toBeGreaterThan(1.8);
    expect(two.parts.M1.rpm! / one.parts.M1.rpm!).toBeLessThan(2.2);
    expect(rev.parts.M1.rpm!).toBeCloseTo(-two.parts.M1.rpm!, 6);
    // Balance de energía del motor: V·I = I²·Rₐ + potencia mecánica (k·ω·I)
    const m = two.parts.M1, w = (m.rpm! * 2 * Math.PI) / 60;
    expect(m.voltage * m.current).toBeCloseTo(m.current ** 2 * SC.motor.rA + SC.motor.k * w * m.current, 9);
  });

  it('el zumbador suena con la polaridad correcta y calla al revés', () => {
    expect(solve([...twoCells, { id: 'Z1', kind: 'zumbador', a: 'p', b: 'n' }]).parts.Z1.on).toBe(true);
    expect(solve([...twoCells, { id: 'Z1', kind: 'zumbador', a: 'n', b: 'p' }]).parts.Z1.on).toBe(false);
  });

  it('conductores y aislantes: el clip, la moneda y el grafito encienden el bombillo; el borrador y el plástico no', () => {
    const brillo = (kind: NetPart['kind']) => solve([...twoCells, lamp('B1', 'p', 'x'), { id: 'X1', kind, a: 'x', b: 'y' }, cable('C1', 'y', 'n')]).parts.B1;
    expect(brillo('clip').on).toBe(true);
    expect(brillo('moneda').on).toBe(true);
    expect(brillo('grafito').on).toBe(true);
    expect(brillo('grafito').brightness).toBeLessThan(brillo('clip').brightness); // el grafito conduce, pero peor
    expect(brillo('borrador').on).toBe(false);
    expect(brillo('plastico').current).toBeLessThan(1e-9);
  });

  it('el voltímetro casi no perturba el circuito y el amperímetro en serie lee la corriente del bombillo', () => {
    const base: NetPart[] = [...twoCells, lamp('B1', 'p', 'y'), lamp('B2', 'y', 'z'), cable('C1', 'z', 'n')];
    const sinMedidor = solve(base);
    const conV = solve([...base, { id: 'M', kind: 'multimetro', mode: 'V', a: 'p', b: 'y' }]);
    expect(conV.meter!.value).toBeCloseTo(sinMedidor.parts.B1.voltage, 5);
    const conA = solve([...twoCells, { id: 'M', kind: 'multimetro', mode: 'A', a: 'p', b: 'x' }, lamp('B1', 'x', 'y'), lamp('B2', 'y', 'z'), cable('C1', 'z', 'n')]);
    expect(conA.meter!.value).toBeCloseTo(conA.parts.B1.current, 9);
    expect(conA.meter!.connected).toBe(true);
    expect(conA.meter!.value).toBeLessThan(sinMedidor.parts.B1.current); // la resistencia del amperímetro (0,1 Ω) resta un poco
  });
});

describe('validación de entradas y ficha del modelo', () => {
  it('rechaza valores fuera de rango, piezas con un solo borne y dos multímetros', () => {
    expect(() => solve([cell('P1', 'n', 'p')], { emf: 3 })).toThrow(RangeError);
    expect(() => solve([cell('P1', 'n', 'p')], { internalR: 0 })).toThrow(RangeError);
    expect(() => solve([cell('P1', 'n', 'n')])).toThrow(RangeError);
    expect(() => solve([cell('P1', 'n', 'p'), cell('P1', 'p', 'q')])).toThrow(RangeError);
    expect(() => solve([{ id: 'M', kind: 'multimetro', a: 'a', b: 'b' }, { id: 'N', kind: 'multimetro', a: 'a', b: 'c' }])).toThrow(RangeError);
    // Una pila gastada (1,2 V) se acepta y entrega menos corriente
    const nueva = solve([cell('P1', 'n', 'p'), lamp('B1', 'p', 'n')]);
    const gastada = solve([cell('P1', 'n', 'p'), lamp('B1', 'p', 'n')], { emf: 1.2, internalR: 1 });
    expect(gastada.parts.B1.current).toBeLessThan(nueva.parts.B1.current);
  });

  it('la ficha del modelo declara supuestos, límites y casos de prueba', () => {
    expect(simpleCircuitModelSpec.assumptions.length).toBeGreaterThanOrEqual(5);
    expect(simpleCircuitModelSpec.limits.length).toBeGreaterThanOrEqual(4);
    expect(simpleCircuitModelSpec.equations.some((e) => /nodal/.test(e))).toBe(true);
  });
});
