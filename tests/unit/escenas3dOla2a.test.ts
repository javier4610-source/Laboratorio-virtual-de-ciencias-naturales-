import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { statesScene, thermoHeight } from '../../src/labs/states3d';
import { changeReaction, physicalScene } from '../../src/labs/cambios3d';
import { curveScene, diskScene, S } from '../../src/labs/circular3d';
import { benchScene, eyeScene, X, Y } from '../../src/labs/lenses3d';
import { currentScene, magnetLines, magnetScene, twoMagnetsScene } from '../../src/labs/magnet3d';
import { heatingCurve, stateAtQ } from '../../src/models/statesOfMatter';
import { PROCESSES } from '../../src/models/chemicalChanges';
import { diskAt, ucm } from '../../src/models/circularMotion';
import { bench } from '../../src/models/lenses';
import { findMagnet, poles } from '../../src/models/magnetism';
import { buildReactionScene, bondChanges, checkBalanced, hillFormulaOf, speciesFromSdf, PUBCHEM_GEOMETRY_LABEL } from '../../src/chem';
import { ACETATE_SDF, ACETATE_SDF_SHA256, ACETIC_SDF, ACETIC_SDF_SHA256 } from '../../src/data/quimica/acetico-pubchem';
import type { ArrowItem, EllipsoidItem, ParticlesItem, RodItem, SceneItem } from '../../src/three/scene';

const byId = <T extends SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T;
const dot = (a: readonly number[], b: readonly number[]) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

describe('partículas de agua 3D (estados de la materia)', () => {
  const c = heatingCurve({ mass: 200, power: 500, t0: -20, tEnd: 110, place: 'apartado' });
  it('en la meseta de fusión la mitad sigue en la red y el termómetro marca 0 °C', () => {
    const mid = stateAtQ(c, (c.segments[1].q0 + c.segments[1].q1) / 2);
    const sc = statesScene({ state: mid, tBoil: c.tBoil, phase: 0 });
    const red = byId<ParticlesItem>(sc.items, 'p-red'), liq = byId<ParticlesItem>(sc.items, 'p-liquido');
    expect(red.points.length + liq.points.length).toBe(27);
    expect(red.points.length).toBe(14);
    const col = byId<RodItem>(sc.items, 'termo-columna');
    expect(col.to[1] - col.from[1]).toBeCloseTo(thermoHeight(0), 12);
    expect(sc.description).toContain('Meseta');
  });
  it('vapor: todas las partículas vuelan dentro de la caja; en pausa (misma fase) la escena no cambia', () => {
    const v = stateAtQ(c, c.qTotal);
    const a = statesScene({ state: v, tBoil: c.tBoil, phase: 2.5 });
    expect(byId<ParticlesItem>(a.items, 'p-gas').points).toHaveLength(27);
    expect(statesScene({ state: v, tBoil: c.tBoil, phase: 2.5 })).toEqual(a);
    expect(statesScene({ state: v, tBoil: c.tBoil, phase: 3 }).items).not.toEqual(a.items);
  });
});

describe('cambios químicos 3D', () => {
  it('los SDF del ácido acético y del acetato son los descargados de PubChem', () => {
    expect(createHash('sha256').update(ACETIC_SDF).digest('hex')).toBe(ACETIC_SDF_SHA256);
    expect(createHash('sha256').update(ACETATE_SDF).digest('hex')).toBe(ACETATE_SDF_SHA256);
    const meta = { id: 'x', name: 'x', label: 'x', geometry: 'pubchem' as const, geometryLabel: PUBCHEM_GEOMETRY_LABEL, method: 'x' };
    expect(hillFormulaOf(speciesFromSdf(ACETIC_SDF, meta).atoms)).toBe('C2H4O2');
    const ac = speciesFromSdf(ACETATE_SDF, meta);
    expect(hillFormulaOf(ac.atoms)).toBe('C2H3O2');
    expect(ac.charge).toBe(-1);
  });
  it('cada cambio químico tiene una reacción 3D balanceada que rompe y forma enlaces; los físicos no', () => {
    for (const p of PROCESSES) {
      const def = changeReaction(p.id);
      if (p.kind === 'fisico') { expect(def, p.id).toBeNull(); continue; }
      expect(checkBalanced(def!).balanced, p.id).toBe(true);
      const ch = bondChanges(buildReactionScene(def!));
      // el precipitado es un intercambio de iones: los iones cambian de pareja sin romper enlaces covalentes
      if (p.id === 'precipitado') expect(ch.broken + ch.formed).toBe(0);
      else expect(ch.broken + ch.formed, p.id).toBeGreaterThan(0);
    }
  });
  it('cambio físico: las moléculas se trasladan sin deformarse y se separan con el avance', () => {
    const a = physicalScene('disolver-azucar', 0), b = physicalScene('disolver-azucar', 1);
    expect(a.atoms).toHaveLength(4 * 45);
    expect(a.bonds).toEqual(b.bonds);
    const d = (s: typeof a, i: number, j: number) => Math.hypot(s.atoms[i].x - s.atoms[j].x, s.atoms[i].y - s.atoms[j].y, s.atoms[i].z - s.atoms[j].z);
    expect(d(b, 0, 1)).toBeCloseTo(d(a, 0, 1), 9); // dentro de una molécula
    expect(d(b, 0, 45)).toBeGreaterThan(d(a, 0, 45)); // entre moléculas
    expect(a.description).toContain('se rompen 0 enlaces');
    expect(physicalScene('hervir-agua', 0.5).labels[0].text).toContain('50 %');
  });
});

describe('movimiento circular 3D', () => {
  const input = { radius: 0.5, massG: 200, period: 1 };
  it('el disco está donde dice el modelo, v es tangente y a apunta al eje', () => {
    const sc = diskScene({ input, t: 0.3, cutAt: null });
    const st = diskAt(input, 0.3);
    const disk = byId<EllipsoidItem>(sc.items, 'disco');
    expect(disk.center[0]).toBeCloseTo(st.pos[0] * S, 12);
    expect(disk.center[2]).toBeCloseTo(-st.pos[1] * S, 12);
    const v = byId<ArrowItem>(sc.items, 'velocidad'), a = byId<ArrowItem>(sc.items, 'aceleracion');
    const radial = [disk.center[0], 0, disk.center[2]];
    expect(dot(v.vector, radial)).toBeCloseTo(0, 9);
    expect(dot(a.vector, radial)).toBeLessThan(0);
    expect(v.label).toContain('3,14 m/s');
    expect(byId<ArrowItem>(sc.items, 'tension').label).toContain(`${ucm(input).force.toFixed(2).replace('.', ',')} N`);
  });
  it('al cortar la cuerda: sin tensión ni aceleración, sigue la tangente; encuadre fijo', () => {
    const before = diskScene({ input, t: 0.3, cutAt: null });
    const sc = diskScene({ input, t: 0.8, cutAt: 0.3 });
    expect(byId(sc.items, 'tension')).toBeUndefined();
    expect(byId(sc.items, 'aceleracion')).toBeUndefined();
    expect(byId<ParticlesItem>(sc.items, 'tangente').label).toContain('tangente');
    expect(sc.extent).toBe(before.extent);
    expect(sc.description).toContain('TANGENTE');
    expect(curveScene({ radius: 50, surface: 'mojado', speedKmh: 60, massKg: 1000 }, 0.5).description).toContain('derrapa');
  });
});

describe('lentes 3D', () => {
  const input = { lens: 'c10', objectX: 10, lensX: 40, screenX: 55, objectH: 3 };
  it('los tres rayos llegan a la punta de la imagen nítida en la pantalla', () => {
    const sc = benchScene(input);
    const b = bench(input);
    for (const k of [0, 1, 2]) {
      const last = sc.items.filter((i) => i.id.startsWith(`rayo${k}-`) && !i.id.endsWith('virtual')).pop() as RodItem;
      expect(last.to[0]).toBeCloseTo(input.screenX * X - 6, 9);
      expect(last.to[1]).toBeCloseTo(b.hi * 0.85 * Y, 9);
    }
    expect(byId<ArrowItem>(sc.items, 'imagen').label).toContain('nítida');
  });
  it('lupa: imagen virtual; pantalla mal puesta: mancha; ojo miope corregido', () => {
    expect(byId(benchScene({ ...input, objectX: 35 }).items, 'imagen-virtual')).toBeDefined();
    expect(byId<ParticlesItem>(benchScene({ ...input, screenX: 80 }).items, 'mancha').label).toContain('borrosa');
    expect(eyeScene('miopia', Infinity, 0).description).toContain('DELANTE');
    expect(eyeScene('miopia', Infinity, -2).description).toContain('SOBRE la retina');
  });
});

describe('magnetismo 3D', () => {
  const m = findMagnet('ferrita');
  it('las líneas salen del N, llegan al S y algunas pasan por encima de la mesa', () => {
    const lines = magnetLines(m, 0);
    const { N, S: Sp } = poles({ magnet: m, center: [0, 0, 0], angle: 0 });
    for (const l of lines) expect(Math.hypot(l[0][0] - N[0], l[0][1] - N[1], l[0][2] - N[2])).toBeLessThan(0.005);
    expect(lines.some((l) => { const e = l[l.length - 1]; return Math.hypot(e[0] - Sp[0], e[1] - Sp[1], e[2] - Sp[2]) < 1e-9; })).toBe(true);
    expect(lines.some((l) => l.some((p) => p[2] > 0.01))).toBe(true);
    expect(magnetLines(m, 0)).toBe(lines);
  });
  it('la brújula del estudiante apunta según el modelo; dos imanes y la corriente', () => {
    const sc = magnetScene({ placed: { magnet: m, center: [0, 0, 0], angle: 0 }, compass: [0.1, 0], showLines: false });
    const b = byId<ArrowItem>(sc.items, 'brujula');
    expect(b.vector[0]).toBeGreaterThan(0.5); // apunta al este, lejos del N
    expect(sc.items.some((i) => i.id.startsWith('l0-'))).toBe(false);
    expect(twoMagnetsScene(m, 2, 'NN').description).toContain('se repelen');
    expect(twoMagnetsScene(m, 2, 'NS').description).toContain('se atraen');
    const cs = currentScene({ source: 'cable', turns: 50, current: 1, distanceCm: 2 });
    expect(cs.description).toContain('20,3°');
    expect(byId<ArrowItem>(cs.items, 'brujula').vector[0]).toBeLessThan(0); // gira al oeste bajo un cable con corriente al norte
  });
});
