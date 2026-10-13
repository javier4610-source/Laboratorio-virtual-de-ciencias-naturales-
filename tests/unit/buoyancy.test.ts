import { describe, expect, it } from 'vitest';
import {
  BUOYANCY_INSTRUMENTS, G, HYDROMETER, OBJECTS, VESSEL_AREA_CM2, analyzeReadings, balanceReading, brineDensity, buoyancyModelSpec,
  buoyantForce, dynamometerReading, findObject, floatDepth, floatingFraction, hydrometerReading, hydrometerScale, hydrometerStemDepth,
  liquidDensity, liquidVolume, meanDensity, objectHeight, outerVolume, saltMassFraction, simulateBuoyancy, spoonsToFloat, submergedVolume,
  weightN, type BuoyInput,
} from '../../src/models/buoyancy';
import { findLiquid } from '../../src/models/pressure';

const base: BuoyInput = { objectId: 'aluminio', liquid: 'dulce', spoons: 0, descent: 0, setup: 'rebose' };
const V_CYL = Math.PI * 1.5 ** 2 * 6;

describe('empuje E = ρ·g·V_sum', () => {
  it('valores calculados a mano para el cilindro de aluminio en agua dulce', () => {
    expect(V_CYL).toBeCloseTo(42.4115, 4);
    expect(buoyantForce(997, V_CYL)).toBeCloseTo(997 * 9.78 * V_CYL * 1e-6, 12); // ≈ 0,4135 N
    expect(buoyantForce(997, V_CYL)).toBeCloseTo(0.41354, 4);
    const r = simulateBuoyancy({ ...base, descent: 8 });
    expect(r.weight).toBeCloseTo((2.7 * V_CYL * 9.78) / 1000, 10); // ≈ 1,1199 N
    expect(r.apparent).toBeCloseTo(r.weight - 0.41354, 4);
    expect(r.submerged).toBe(true);
    expect(dynamometerReading(r.weight)).toBe(1.1);
    expect(dynamometerReading(r.apparent)).toBe(0.7);
    expect(balanceReading(r.balanceMass)).toBe(42.3);
    expect(() => buoyantForce(0, 10)).toThrow(RangeError);
    expect(() => buoyantForce(997, -1)).toThrow(RangeError);
  });

  it('el peso aparente baja en proporción al volumen sumergido y es constante una vez sumergido', () => {
    const w = simulateBuoyancy(base).weight;
    expect(simulateBuoyancy(base).apparent).toBeCloseTo(w, 12); // en el aire
    const a2 = simulateBuoyancy({ ...base, descent: 2 }).apparent, a4 = simulateBuoyancy({ ...base, descent: 4 }).apparent;
    expect(w - a4).toBeCloseTo(2 * (w - a2), 10);
    const a6 = simulateBuoyancy({ ...base, descent: 6 }).apparent, a10 = simulateBuoyancy({ ...base, descent: 10 }).apparent;
    expect(a10).toBeCloseTo(a6, 12);
    expect(a4).toBeGreaterThan(a6);
  });

  it('cilindros de igual volumen reciben el mismo empuje aunque pesen distinto', () => {
    const E = ['aluminio', 'hierro', 'plastico'].map((id) => simulateBuoyancy({ ...base, objectId: id, descent: 9 }));
    expect(E[1].buoyancy).toBeCloseTo(E[0].buoyancy, 12);
    expect(E[2].buoyancy).toBeCloseTo(E[0].buoyancy, 12);
    expect(E[1].weight).toBeGreaterThan(E[0].weight);
    expect(E[1].overload).toBe(false); // el hierro (≈ 3,26 N) cabe en el dinamómetro de 5 N
  });

  it('conservación: el peso del líquido desalojado es igual al empuje (en los dos montajes)', () => {
    for (const setup of ['rebose', 'balanza'] as const) {
      for (const o of OBJECTS) {
        const r = simulateBuoyancy({ ...base, objectId: o.id, descent: 5, setup });
        expect(weightN(r.balanceMass)).toBeCloseTo(r.buoyancy, 9);
        expect(r.weight - r.apparent).toBeCloseTo(r.buoyancy, 9);
      }
    }
    const { buoyancy, displacedWeight } = analyzeReadings(1.1, 0.7, 42.3);
    expect(buoyancy).toBeCloseTo(0.4, 12);
    expect(displacedWeight).toBeCloseTo(0.0423 * G, 12);
  });
});

describe('geometría del volumen sumergido', () => {
  it('casquete esférico, elipsoide y prismas coinciden con las fórmulas y con el volumen total', () => {
    const ball = findObject('bola');
    expect(submergedVolume(ball, objectHeight(ball))).toBeCloseTo(50 / 1.6, 9);
    expect(submergedVolume(ball, ball.dims.r)).toBeCloseTo(50 / 1.6 / 2, 9); // media esfera
    const egg = findObject('huevo');
    expect(outerVolume(egg)).toBeCloseTo(60 / 1.07, 9);
    expect(submergedVolume(egg, egg.dims.c)).toBeCloseTo(60 / 1.07 / 2, 9);
    // Integración numérica del elipsoide hasta d = 2 cm.
    let num = 0; const n = 20000;
    for (let i = 0; i < n; i++) { const z = ((i + 0.5) / n) * 2; num += Math.PI * egg.dims.a ** 2 * (1 - ((z - egg.dims.c) / egg.dims.c) ** 2) * (2 / n); }
    expect(submergedVolume(egg, 2)).toBeCloseTo(num, 5);
    expect(submergedVolume(findObject('madera'), 2)).toBeCloseTo(50, 12);
    expect(submergedVolume(findObject('aluminio'), -1)).toBe(0);
  });
});

describe('flotación', () => {
  it('el bloque de pino se hunde la fracción ρ_obj/ρ_líq y el dinamómetro marca 0', () => {
    const wood = findObject('madera');
    expect(floatDepth(wood, 997)).toBeCloseTo((6 * 0.5) / 0.997, 9); // ≈ 3,01 cm
    expect(floatingFraction(0.5, 0.997)).toBeCloseTo(0.5015, 4);
    const r = simulateBuoyancy({ ...base, objectId: 'madera', descent: 8 });
    expect(r.floating).toBe(true);
    expect(r.apparent).toBe(0);
    expect(r.fraction).toBeCloseTo(0.5 / 0.997, 9);
    expect(r.buoyancy).toBeCloseTo(r.weight, 12);
    // Antes de alcanzar la línea de flotación el hilo sigue tenso.
    expect(simulateBuoyancy({ ...base, objectId: 'madera', descent: 2 }).floating).toBe(false);
    // En alcohol (menos denso) se hunde más.
    expect(floatDepth(wood, 785)!).toBeGreaterThan(floatDepth(wood, 997)!);
  });

  it('la plastilina en bola se hunde y en forma de barco flota', () => {
    expect(floatDepth(findObject('bola'), 997)).toBeNull();
    const boat = findObject('barco');
    expect(meanDensity(boat)).toBeCloseTo(50 / 120, 12);
    expect(floatDepth(boat, 997)).toBeCloseTo(50 / 0.997 / 40, 9); // ≈ 1,25 cm
    expect(simulateBuoyancy({ ...base, objectId: 'bola', descent: 10 }).floating).toBe(false);
    expect(simulateBuoyancy({ ...base, objectId: 'barco', descent: 10 }).floating).toBe(true);
  });

  it('cera: flota en agua y en aceite (casi toda sumergida), se hunde en alcohol', () => {
    const wax = findObject('cera');
    expect(floatDepth(wax, liquidDensity('dulce'))).not.toBeNull();
    expect(floatDepth(wax, liquidDensity('aceite'))! / 6).toBeCloseTo(0.9 / 0.918, 9);
    expect(floatDepth(wax, liquidDensity('alcohol'))).toBeNull();
  });
});

describe('agua con sal y huevo', () => {
  it('la densidad del agua salada crece con la sal y reproduce la tabla del CRC', () => {
    expect(liquidDensity('dulce')).toBe(findLiquid('dulce').rho);
    expect(liquidDensity('aceite')).toBe(918);
    expect(liquidDensity('alcohol')).toBe(785);
    expect(saltMassFraction(120)).toBeCloseTo(120 / 1117, 12);
    let prev = 0;
    for (let n = 0; n <= 30; n++) { const r = liquidDensity('salada', n); expect(r).toBeGreaterThan(prev); prev = r; }
    // 3 cucharadas (30 g en 1 L, ≈ 2,9 %) ≈ agua de mar.
    expect(liquidDensity('salada', 3)).toBeGreaterThan(1015);
    expect(liquidDensity('salada', 3)).toBeLessThan(1025);
    // 10 % en masa: 1,0707 g/cm³ escalado a 997.
    expect(brineDensity(997 / 9)).toBeCloseTo((1.0707 / 0.9982) * 997, 6);
    expect(liquidVolume('salada', 10)).toBeGreaterThan(1000);
    expect(() => brineDensity(-1)).toThrow(RangeError);
  });

  it('el huevo se hunde en agua dulce y de mar y flota desde 12 cucharadas', () => {
    expect(spoonsToFloat('huevo')).toBe(12);
    expect(simulateBuoyancy({ ...base, objectId: 'huevo', liquid: 'salada', spoons: 11, descent: 10 }).floating).toBe(false);
    expect(simulateBuoyancy({ ...base, objectId: 'huevo', liquid: 'salada', spoons: 12, descent: 10 }).floating).toBe(true);
    expect(spoonsToFloat('plastico')).toBeNull(); // el acrílico (1,18) no flota ni con 30 cucharadas
    expect(spoonsToFloat('madera')).toBe(0);
  });
});

describe('vaso sobre la balanza y densímetro', () => {
  it('el nivel sube V_sum/A y la base queda más honda que el descenso', () => {
    const r = simulateBuoyancy({ ...base, setup: 'balanza', descent: 3 });
    expect(r.levelRise).toBeCloseTo(r.vSub / VESSEL_AREA_CM2, 12);
    expect(r.depth).toBeCloseTo(3 + r.levelRise, 9);
    expect(r.depth).toBeGreaterThan(3);
    expect(simulateBuoyancy({ ...base, setup: 'rebose', descent: 3 }).depth).toBe(3);
  });

  it('el densímetro lee la densidad del líquido y su escala se aprieta hacia arriba', () => {
    expect(hydrometerStemDepth(HYDROMETER.rhoMax)).toBeCloseTo(0, 9);
    expect(hydrometerStemDepth(HYDROMETER.rhoMin)).toBeCloseTo(HYDROMETER.stemLength, 9);
    for (const rho of [0.785, 0.918, 0.997, 1.07]) expect(hydrometerScale(hydrometerStemDepth(rho))).toBeCloseTo(rho, 12);
    expect(hydrometerStemDepth(0.785)).toBeGreaterThan(hydrometerStemDepth(0.997)); // en alcohol se hunde más
    const gap = (a: number, b: number) => hydrometerStemDepth(a) - hydrometerStemDepth(b);
    expect(gap(0.8, 0.9)).toBeGreaterThan(gap(1.0, 1.1));
    expect(hydrometerReading(0.997)).toBe(0.998);
    expect(() => hydrometerStemDepth(1.3)).toThrow(RangeError);
  });

  it('rechaza entradas fuera de rango y tiene ficha completa', () => {
    expect(() => simulateBuoyancy({ ...base, descent: -0.1 })).toThrow(RangeError);
    expect(() => simulateBuoyancy({ ...base, descent: 10.5 })).toThrow(RangeError);
    expect(() => simulateBuoyancy({ ...base, spoons: 31 })).toThrow(RangeError);
    expect(() => simulateBuoyancy({ ...base, objectId: 'oro' })).toThrow();
    expect(dynamometerReading(-0.01)).toBe(0);
    expect(BUOYANCY_INSTRUMENTS.map((i) => i.id)).toEqual(['dinamometro', 'balanza', 'densimetro']);
    expect(buoyancyModelSpec.testCases.length).toBeGreaterThanOrEqual(8);
    for (const v of buoyancyModelSpec.inputs) if (v.range) expect(v.range[0]).toBeLessThan(v.range[1]);
  });
});
