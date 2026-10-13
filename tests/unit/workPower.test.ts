import { describe, expect, it } from 'vitest';
import {
  BLOCK, DYNAMOMETER_MAX, G, MOTOR_MAX_SPEED, RAMP, STEP_HEIGHT, SURFACES, WORK_LIMITS, angleFromSupport, averagePower, blockMass,
  humanPower, idealAdvantage, rampEffort, rampEfficiency, rampFromReadings, simulateRamp, simulateStairs, supportHeight,
  workPowerModelSpec, type RampInput, type SurfaceId,
} from '../../src/models/workPower';

const base: RampInput = { angleDeg: 30, mass: 0.5, surface: 'madera', drive: 'mano', handSpeed: 0.2, motorPower: 1.5 };

describe('plano inclinado: fuerza, trabajo y eficiencia (9.º)', () => {
  it('caso inicial calculado a mano: 0,5 kg a 30° sobre madera, jalado a 0,20 m/s', () => {
    const r = simulateRamp(base);
    expect(r.weight).toBeCloseTo(4.9, 12);
    expect(r.F).toBeCloseTo(4.9 * (0.5 + 0.3 * Math.sqrt(3) / 2), 12); // 3,7231 N
    expect(r.F).toBeCloseTo(3.7231, 4);
    expect(r.h).toBeCloseTo(0.3, 12);
    expect(r.workIn).toBeCloseTo(2.23384, 4);
    expect(r.workLift).toBeCloseTo(1.47, 12);
    expect(r.efficiency).toBeCloseTo(0.658, 3);
    expect(r.vmIdeal).toBeCloseTo(2, 12);
    expect(r.time).toBeCloseTo(3, 12);
    expect(r.power).toBeCloseTo(r.F * 0.2, 12);
    // Lecturas ideales de los instrumentos
    expect(r.weightReading).toBe(4.9);
    expect(r.effortReading).toBe(3.7);
    expect(r.distanceReading).toBe(60);
    expect(r.heightReading).toBe(30);
    expect(r.timeReading).toBe(3);
    // Lo que calcula el estudiante con esas lecturas
    const s = rampFromReadings({ weight: 4.9, effort: 3.7, dCm: 60, hCm: 30, t: 3 });
    expect(s.workIn).toBeCloseTo(2.22, 12);
    expect(s.workLift).toBeCloseTo(1.47, 12);
    expect(s.efficiency).toBeCloseTo(0.6622, 4);
    expect(s.power).toBeCloseTo(0.74, 12);
    expect(s.vm).toBeCloseTo(4.9 / 3.7, 12);
  });

  it('conserva la energía: F·d = m·g·h + Q en muchas combinaciones', () => {
    for (const s of SURFACES) {
      for (const a of [5, 12, 20, 33, 45]) {
        for (const m of [0.3, 0.6, 1.0]) {
          const r = simulateRamp({ ...base, surface: s.id, angleDeg: a, mass: m });
          expect(r.workIn, `${s.id} ${a} ${m}`).toBeCloseTo(r.workLift + r.heat, 12);
          expect(r.heat).toBeCloseTo(s.mu * m * G * Math.cos((a * Math.PI) / 180) * RAMP.travel, 12);
          expect(r.efficiency).toBeCloseTo(rampEfficiency(a, s.mu), 12);
          expect(r.efficiency).toBeCloseTo(r.vm / r.vmIdeal, 12); // η = VM/VM_ideal
          expect(r.efficiency).toBeLessThan(1);
        }
      }
    }
  });

  it('sin rozamiento la rampa es ideal: η = 1, VM = d/h y F = m·g·h/d', () => {
    expect(rampEfficiency(25, 0)).toBeCloseTo(1, 12);
    const F = rampEffort(0.8, 25, 0);
    expect(F).toBeCloseTo(0.8 * G * Math.sin((25 * Math.PI) / 180), 12);
    expect((0.8 * G) / F).toBeCloseTo(idealAdvantage(25), 12);
    // Las ruedas se acercan al caso ideal mucho más que la lija
    const ruedas = simulateRamp({ ...base, surface: 'ruedas' }), lija = simulateRamp({ ...base, surface: 'lija' });
    expect(ruedas.efficiency).toBeGreaterThan(0.95);
    expect(lija.efficiency).toBeLessThan(0.5);
  });

  it('la fuerza crece con el ángulo y con μ; la ventaja mecánica ideal baja con el ángulo', () => {
    let prevF = 0, prevVm = Infinity;
    for (let a = WORK_LIMITS.angle[0]; a <= WORK_LIMITS.angle[1]; a += 5) {
      const r = simulateRamp({ ...base, angleDeg: a });
      expect(r.F).toBeGreaterThan(prevF);
      expect(r.vmIdeal).toBeLessThan(prevVm);
      prevF = r.F; prevVm = r.vmIdeal;
    }
    const order: SurfaceId[] = ['ruedas', 'teflon', 'madera', 'lija'];
    const forces = order.map((s) => simulateRamp({ ...base, surface: s }).F);
    for (let i = 1; i < forces.length; i++) expect(forces[i]).toBeGreaterThan(forces[i - 1]);
  });

  it('la eficiencia sube con el ángulo, baja con μ y no depende de la masa; F y W son proporcionales a la masa', () => {
    expect(rampEfficiency(40, 0.3)).toBeGreaterThan(rampEfficiency(10, 0.3));
    expect(rampEfficiency(30, 0.6)).toBeLessThan(rampEfficiency(30, 0.06));
    const a = simulateRamp({ ...base, mass: 0.4 }), b = simulateRamp({ ...base, mass: 0.8 });
    expect(b.efficiency).toBeCloseTo(a.efficiency, 12);
    expect(b.F / a.F).toBeCloseTo(2, 12);
    expect(b.workIn / a.workIn).toBeCloseTo(2, 12);
  });

  it('el trabajo para subir la carga derecho (m·g·h) no depende del camino; la rampa reparte la fuerza en más distancia', () => {
    const r = simulateRamp({ ...base, surface: 'ruedas', angleDeg: 20 });
    expect(r.workLift).toBeCloseTo(0.5 * G * RAMP.travel * Math.sin((20 * Math.PI) / 180), 12);
    expect(r.F).toBeLessThan(r.weight); // ahorra fuerza…
    expect(r.workIn).toBeGreaterThan(r.workLift); // …pero no trabajo
  });
});

describe('potencia: con la mano y con el torno', () => {
  it('P = W/t = F·v; el mismo trabajo más rápido exige más potencia', () => {
    const slow = simulateRamp({ ...base, handSpeed: 0.1 }), fast = simulateRamp({ ...base, handSpeed: 0.4 });
    expect(slow.workIn).toBeCloseTo(fast.workIn, 12);
    expect(fast.power / slow.power).toBeCloseTo(4, 12);
    expect(fast.power).toBeCloseTo(averagePower(fast.workIn, fast.time), 12);
    expect(() => averagePower(1, 0)).toThrow(RangeError);
  });

  it('el torno sube el bloque a v = P_t/F y su caja de engranajes no pasa de 0,50 m/s', () => {
    const r = simulateRamp({ ...base, drive: 'torno', motorPower: 1.5 });
    expect(r.speed).toBeCloseTo(1.5 / r.F, 12);
    expect(r.power).toBeCloseTo(1.5, 12);
    expect(r.motorLimited).toBe(false);
    const light = simulateRamp({ ...base, drive: 'torno', motorPower: 3, surface: 'ruedas', angleDeg: 5, mass: 0.3 });
    expect(light.speed).toBe(MOTOR_MAX_SPEED);
    expect(light.motorLimited).toBe(true);
    expect(light.power).toBeLessThan(3);
    // Más potencia: menos tiempo para el mismo trabajo
    const p1 = simulateRamp({ ...base, drive: 'torno', motorPower: 0.6 }), p2 = simulateRamp({ ...base, drive: 'torno', motorPower: 1.2 });
    expect(p1.time / p2.time).toBeCloseTo(2, 12);
  });
});

describe('montaje, escala e insumos', () => {
  it('la altura de la pinza del soporte fija el ángulo y las pesas fijan la masa', () => {
    for (const a of [5, 17, 30, 45]) expect(angleFromSupport(supportHeight(a))).toBeCloseTo(a, 10);
    expect(supportHeight(45)).toBeCloseTo(RAMP.postDistance, 12);
    expect(blockMass(0)).toBe(BLOCK.mass);
    expect(blockMass(2)).toBe(0.5);
    expect(blockMass(BLOCK.maxSlots)).toBe(1);
    expect(() => blockMass(8)).toThrow(RangeError);
    expect(() => blockMass(1.5)).toThrow(RangeError);
  });

  it('las fuerzas mayores que 10 N salen de la escala y las entradas fuera de rango se rechazan', () => {
    const r = simulateRamp({ ...base, mass: 1, angleDeg: 45, surface: 'lija' });
    expect(r.F).toBeGreaterThan(DYNAMOMETER_MAX);
    expect(r.overload).toBe(true);
    expect(r.effortReading).toBeNull();
    expect(r.weightReading).toBe(9.8);
    expect(() => simulateRamp({ ...base, angleDeg: 50 })).toThrow(RangeError);
    expect(() => simulateRamp({ ...base, mass: 0.2 })).toThrow(RangeError);
    expect(() => simulateRamp({ ...base, handSpeed: 0 })).toThrow(RangeError);
    expect(() => simulateRamp({ ...base, drive: 'torno', motorPower: 5 })).toThrow(RangeError);
    expect(() => simulateRamp({ ...base, surface: 'hielo' as SurfaceId })).toThrow();
    expect(() => rampEffort(-1, 30, 0.3)).toThrow(RangeError);
  });
});

describe('bono: potencia al subir la escalera del colegio', () => {
  it('50 kg, 18 escalones de 17 cm a 2 escalones por segundo', () => {
    const r = simulateStairs({ personMass: 50, steps: 18, pace: 2 });
    expect(r.height).toBeCloseTo(18 * STEP_HEIGHT, 12);
    expect(r.time).toBeCloseTo(9, 12);
    expect(r.work).toBeCloseTo(1499.4, 9);
    expect(r.power).toBeCloseTo(166.6, 9);
    expect(r.heightReading).toBe(306);
    expect(r.timeReading).toBe(9);
    expect(humanPower(50, 3.06, 9)).toBeCloseTo(r.power, 12);
    // Subir corriendo (el doble de ritmo) duplica la potencia, no el trabajo
    const run = simulateStairs({ personMass: 50, steps: 18, pace: 4 });
    expect(run.work).toBeCloseTo(r.work, 12);
    expect(run.power / r.power).toBeCloseTo(2, 12);
    expect(() => simulateStairs({ personMass: 50, steps: 18.5, pace: 2 })).toThrow(RangeError);
    expect(() => simulateStairs({ personMass: 20, steps: 18, pace: 2 })).toThrow(RangeError);
  });

  it('la ficha del modelo declara supuestos, límites y casos de prueba', () => {
    expect(workPowerModelSpec.assumptions.some((a) => a.includes('velocidad constante'))).toBe(true);
    expect(workPowerModelSpec.assumptions.some((a) => a.includes('9,8'))).toBe(true);
    expect(workPowerModelSpec.limits.length).toBeGreaterThanOrEqual(4);
    expect(workPowerModelSpec.testCases.length).toBeGreaterThanOrEqual(8);
    for (const i of workPowerModelSpec.inputs) if (i.range && typeof i.initial === 'number') {
      expect(i.initial).toBeGreaterThanOrEqual(i.range[0]);
      expect(i.initial).toBeLessThanOrEqual(i.range[1]);
    }
  });
});
