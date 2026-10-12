import { describe, expect, it } from 'vitest';
import {
  angleDelta, axisDragValue, clamp, clampPoint, clockAngle, keyboardValue, knobAngleToValue, knobRotateValue,
  minHitRadius, pageStepOf, projectT, quantize, snap, valueToKnobAngle, verticalDragValue, zoneAt,
} from '../../src/labs/manipulate';

describe('manipulación directa: ajuste y límites', () => {
  it('clamp y clampPoint limitan a los bordes', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(clamp(-1, 0, 3)).toBe(0);
    expect(clampPoint({ x: 700, y: -5 }, { x0: 0, y0: 0, x1: 640, y1: 256 })).toEqual({ x: 640, y: 0 });
    // los bordes pueden venir invertidos
    expect(clampPoint({ x: 10, y: 10 }, { x0: 100, y0: 100, x1: 0, y1: 0 })).toEqual({ x: 10, y: 10 });
  });

  it('snap ajusta a la rejilla sin ruido de coma flotante', () => {
    expect(snap(0.1 + 0.2, 0.1)).toBe(0.3);
    expect(snap(47, 10)).toBe(50);
    expect(snap(1.26, 0.5, 0.1)).toBe(1.1);
    expect(snap(3.3, 0)).toBe(3.3);
  });

  it('quantize cuenta la rejilla desde el mínimo y no se sale del rango', () => {
    const r = { min: 20, max: 200, step: 10 };
    expect(quantize(44, r)).toBe(40);
    expect(quantize(250, r)).toBe(200);
    expect(quantize(-3, r)).toBe(20);
    expect(quantize(2.26, { min: 1.5, max: 12, step: 0.5 })).toBe(2.5);
  });
});

describe('manipulación directa: teclado (patrón ARIA slider)', () => {
  const r = { min: 0, max: 10, step: 0.1 };
  it('flechas suben y bajan un paso', () => {
    expect(keyboardValue('ArrowRight', 2, r)).toBe(2.1);
    expect(keyboardValue('ArrowUp', 2, r)).toBe(2.1);
    expect(keyboardValue('ArrowLeft', 2, r)).toBe(1.9);
    expect(keyboardValue('ArrowDown', 0, r)).toBe(0);
  });
  it('RePág/AvPág usan una décima del rango; Inicio/Fin van a los extremos', () => {
    expect(pageStepOf(r)).toBe(1);
    expect(pageStepOf({ min: 0, max: 2, step: 1, pageStep: 1 })).toBe(1);
    expect(keyboardValue('PageUp', 2, r)).toBe(3);
    expect(keyboardValue('PageDown', 0.5, r)).toBe(0);
    expect(keyboardValue('Home', 7, r)).toBe(0);
    expect(keyboardValue('End', 7, r)).toBe(10);
  });
  it('otras teclas no las toma el control', () => {
    expect(keyboardValue('Tab', 2, r)).toBeNull();
    expect(keyboardValue('a', 2, r)).toBeNull();
  });
});

describe('manipulación directa: ejes y ángulos', () => {
  it('proyección sobre un eje y arrastre relativo del émbolo', () => {
    const a = { x: 214, y: 121 }, b = { x: 556, y: 121 };
    expect(projectT({ x: 385, y: 50 }, a, b)).toBeCloseTo(0.5);
    // mover el puntero la mitad del eje suma la mitad del rango, sin importar dónde se agarró
    const r = { min: 20, max: 200, step: 10 };
    expect(axisDragValue({ x: 300 + 171, y: 130 }, { x: 300, y: 121 }, 100, a, b, r)).toBe(190);
    expect(axisDragValue({ x: 0, y: 121 }, { x: 300, y: 121 }, 100, a, b, r)).toBe(20);
  });

  it('clockAngle mide en sentido horario desde las 12 (SVG con y hacia abajo)', () => {
    const c = { x: 0, y: 0 };
    expect(clockAngle(c, { x: 0, y: -1 })).toBeCloseTo(0);
    expect(clockAngle(c, { x: 1, y: 0 })).toBeCloseTo(90);
    expect(clockAngle(c, { x: -1, y: 0 })).toBeCloseTo(-90);
    expect(Math.abs(clockAngle(c, { x: 0, y: 1 }))).toBeCloseTo(180);
    // ángulo de un péndulo: 180 − |ángulo| da la desviación respecto a la vertical hacia abajo
    const s30 = { x: Math.sin(Math.PI / 6), y: Math.cos(Math.PI / 6) };
    expect(180 - Math.abs(clockAngle(c, s30))).toBeCloseTo(30);
  });

  it('angleDelta toma el camino más corto al cruzar ±180°', () => {
    expect(angleDelta(170, -170)).toBeCloseTo(20);
    expect(angleDelta(-170, 170)).toBeCloseTo(-20);
    expect(angleDelta(10, 40)).toBeCloseTo(30);
  });

  it('perilla: ángulo ↔ valor en un recorrido de 270°', () => {
    const r = { min: 0, max: 100, step: 1 };
    expect(valueToKnobAngle(0, r)).toBe(-135);
    expect(valueToKnobAngle(50, r)).toBe(0);
    expect(valueToKnobAngle(100, r)).toBe(135);
    expect(knobAngleToValue(0, r)).toBe(50);
    expect(knobAngleToValue(135, r)).toBe(100);
    expect(knobAngleToValue(170, r)).toBe(100); // fuera del recorrido: tope
    expect(knobAngleToValue(-170, r)).toBe(0);
  });

  it('perilla: giro relativo y arrastre vertical', () => {
    const r = { min: 1.5, max: 12, step: 0.5 };
    expect(knobRotateValue(6, 0, 27, r)).toBe(7); // 27° de 270° = 10 % del rango (1,05 V) → 7,0 V
    expect(knobRotateValue(6, 170, -170, r)).toBe(7); // cruzar el borde ±180° no salta
    expect(verticalDragValue(6, -80, r, 160)).toBe(11.5); // subir medio recorrido suma la mitad del rango
    expect(verticalDragValue(6, 500, r, 160)).toBe(1.5);
  });

  it('zonas para soltar y radio mínimo de toque', () => {
    expect(zoneAt(100, [285, 385])).toBe(0);
    expect(zoneAt(300, [285, 385])).toBe(1);
    expect(zoneAt(500, [285, 385])).toBe(2);
    expect(minHitRadius(1)).toBe(22);
    expect(minHitRadius(0.5)).toBe(44); // con la escena a la mitad de tamaño el blanco debe crecer
    expect(minHitRadius(0)).toBe(22);
  });
});
