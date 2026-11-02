import { describe, expect, it } from 'vitest';
import { orbitalPoints, orbitalScene, radialScale, shownOrbitals } from '../../src/labs/electron3d';
import { alongPath, cellScene, electrodeThickness, MASS_EXAGGERATION } from '../../src/labs/galvanic3d';
import { destinations, meiosisScene, staticPosition } from '../../src/labs/meiosis3d';
import { arcPosition, arcScene, impulseX, NODES, neuronScene } from '../../src/labs/nervous3d';
import { bloodAt, heartScene, PATH } from '../../src/labs/heart3d';
import { aufbauOccupancy, boxesFromSequence, fillingSequence, groundState, hundBoxes } from '../../src/models/electronConfiguration';
import { cell, discharge, halfCell, initialMass } from '../../src/models/electrochemicalCell';
import { chromatidsOf, meiosisGametes, type MeiosisConfig } from '../../src/models/meiosis';
import { reflexArc } from '../../src/models/nervousSystem';
import { cycleAt } from '../../src/models/circulation';
import type { BoxItem, EllipsoidItem, ParticlesItem, RodItem, SceneItem, SphereItem } from '../../src/three/scene';

const byId = <T extends SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T;

describe('orbitales 3D (configuración electrónica)', () => {
  it('cada orbital ocupado es una nube con la forma del modelo; aparecen al agregar electrones', () => {
    const o = boxesFromSequence(fillingSequence(8));
    const sc = orbitalScene({ boxes: o, view: 'todos' });
    expect(sc.shown).toEqual(['1s0', '2s0', '2p0', '2p1', '2p2']);
    const pz = byId<ParticlesItem>(sc.items, 'orb-2p1');
    // pz (mℓ = 0) se alarga en la vertical de la escena: ⟨y²⟩ > ⟨x²⟩ + ⟨z²⟩
    const yy = pz.points.reduce((a, p) => a + p[1] ** 2, 0), rest = pz.points.reduce((a, p) => a + p[0] ** 2 + p[2] ** 2, 0);
    expect(yy).toBeGreaterThan(rest);
    expect(byId<ParticlesItem>(sc.items, 'orb-2p0').label).toBe('2py ↑↓');
    expect(byId<ParticlesItem>(sc.items, 'orb-2p0').opacity).toBeGreaterThan(byId<ParticlesItem>(sc.items, 'orb-2p2').opacity!);
    expect(orbitalScene({ boxes: boxesFromSequence(fillingSequence(8), 5), view: 'todos' }).shown).toEqual(['1s0', '2s0', '2p0']);
    expect(orbitalScene({ boxes: {}, view: 'valencia' }).description).toContain('Solo el núcleo');
  });
  it('vista de valencia del hierro: 4s y 3d; compresión radial √r', () => {
    expect(shownOrbitals(hundBoxes(aufbauOccupancy(26)), 'valencia')).toEqual(['4s0', '3d0', '3d1', '3d2', '3d3', '3d4']);
    expect(shownOrbitals(hundBoxes(groundState(29)), 'subnivel')).toHaveLength(5);
    const r = orbitalPoints('1s0').map((p) => Math.hypot(...p));
    expect(Math.max(...r)).toBeLessThan(radialScale(14) + 1e-9);
    expect(orbitalPoints('1s0')).toBe(orbitalPoints('1s0'));
  });
});

describe('pila 3D', () => {
  const input = { left: 'zn', right: 'cu', cLeft: 1, cRight: 1, bridge: 'KNO3' as const, volumeML: 100, currentMA: 50, timeMin: 120 };
  it('electrones del ánodo al cátodo por el cable, cationes hacia el cátodo y grosor según la masa', () => {
    const c = cell(input), st = discharge(input, 120);
    const sc = cellScene({ input, cell: c, state: st, phase: 0.2, running: true });
    const zn = byId<BoxItem>(sc.items, 'elec-izq');
    expect(zn.size[2]).toBeCloseTo(electrodeThickness(st.massLeft, initialMass(halfCell('zn'))), 12);
    expect(zn.size[2]).toBeLessThan(byId<BoxItem>(sc.items, 'elec-der').size[2]);
    expect(electrodeThickness(1.1, 1)).toBeCloseTo(0.16 * (1 + MASS_EXAGGERATION * 0.1), 12);
    expect(byId<ParticlesItem>(sc.items, 'electrones').label).toContain('del ánodo al cátodo');
    expect(byId<ParticlesItem>(sc.items, 'cationes').label).toContain('K⁺ hacia el cátodo');
    expect(sc.description).toContain('El cinc es el ánodo');
    const idle = cellScene({ input: { ...input, currentMA: 0 }, cell: c, state: discharge({ ...input, currentMA: 0 }, 0), phase: 0, running: false });
    expect(idle.items.some((i) => i.id === 'electrones')).toBe(false);
    expect(idle.description).toContain('1,104 V');
    const open = cellScene({ input: { ...input, bridge: 'ninguno' }, cell: cell({ ...input, bridge: 'ninguno' }), state: discharge({ ...input, bridge: 'ninguno' }, 60), phase: 0, running: false });
    expect(open.items.some((i) => i.id.startsWith('puente'))).toBe(false);
  });
  it('alongPath recorre la poligonal por longitud', () => {
    const p = [[0, 0, 0], [2, 0, 0], [2, 2, 0]] as const;
    expect(alongPath(p, 0.25)).toEqual([1, 0, 0]);
    expect(alongPath(p, 0.75)).toEqual([2, 1, 0]);
  });
});

describe('meiosis 3D', () => {
  const cfg: MeiosisConfig = { pairs: 2, crossover: 0.5, orientation: [true, false], nondisjunction: 'ninguna' };
  it('cada cromátida llega al gameto del modelo y conserva los colores del entrecruzamiento', () => {
    const dest = destinations(cfg);
    const gam = meiosisGametes(cfg);
    for (const c of chromatidsOf(cfg, true)) {
      const [x] = staticPosition(c, 'telofase2', cfg, dest);
      const g = gam.findIndex((q) => q.chromatids.some((k) => k.pair === c.pair && k.homolog === c.homolog && k.sister === c.sister));
      expect(x < 0).toBe(g < 2);
      expect(x < -2.75 || (x > 0 && x < 2.75)).toBe(g % 2 === 0);
    }
    const last = meiosisScene({ cfg, stage: 9, progress: 1 });
    expect(last.items.filter((i) => i.id.startsWith('gameto-'))).toHaveLength(4);
    expect(byId<EllipsoidItem>(last.items, 'gameto-1').label).toContain('recombinante');
    // la cromátida materna 1 del par 1 tiene dos segmentos (materno y paterno)
    expect(byId<RodItem>(last.items, 'cr-0m1-1').color).toBe('series-2');
  });
  it('quiasma solo en la profase I y la metafase I; la anafase interpola', () => {
    expect(meiosisScene({ cfg, stage: 2, progress: 1 }).items.some((i) => i.id === 'quiasma')).toBe(true);
    expect(meiosisScene({ cfg, stage: 5, progress: 1 }).items.some((i) => i.id === 'quiasma')).toBe(false);
    const mid = byId<SphereItem>(meiosisScene({ cfg, stage: 4, progress: 0.5 }).items, 'cen-0m0').center[0];
    const a = byId<SphereItem>(meiosisScene({ cfg, stage: 3, progress: 1 }).items, 'cen-0m0').center[0];
    const b = byId<SphereItem>(meiosisScene({ cfg, stage: 5, progress: 1 }).items, 'cen-0m0').center[0];
    expect(mid).toBeCloseTo((a + b) / 2, 12);
    expect(meiosisScene({ cfg, stage: 0, progress: 1 }).items.filter((i) => i.id.startsWith('cen-'))).toHaveLength(4);
  });
});

describe('neurona y arco reflejo 3D', () => {
  it('saltatoria en la fibra mielínica y continua en la amielínica', () => {
    expect(NODES).toContain(impulseX(0.5, true));
    expect(impulseX(0.5, false)).toBeCloseTo(-3.5 + 0.5 * 7.8, 12);
    const sc = neuronScene({ fiberId: 'aa', progress: 0.5, active: true, fired: true });
    expect(sc.items.filter((i) => i.id.startsWith('mielina-')).length).toBeGreaterThan(4);
    expect(neuronScene({ fiberId: 'c', progress: 0.5, active: true, fired: true }).items.some((i) => i.id.startsWith('mielina-'))).toBe(false);
    expect(neuronScene({ fiberId: 'aa', progress: 0.5, active: true, fired: false }).items.some((i) => i.id === 'impulso')).toBe(false);
  });
  it('en el arco reflejo cada tramo dura lo que calcula el modelo', () => {
    const r = reflexArc(0.8, 'c');
    expect(arcPosition((r.afferentMs - 1) / r.totalMs, 0.8, 'c').part).toBe('sensitiva');
    expect(arcPosition((r.afferentMs + 1) / r.totalMs, 0.8, 'c').part).toBe('medula');
    expect(arcPosition(0.999, 0.8, 'c').part).toBe('motora');
    expect(arcScene({ pathM: 0.8, sensory: 'ad', progress: 0.3, active: true }).description).toContain('66,3 ms');
  });
});

describe('corazón 3D', () => {
  it('las válvulas y las cavidades siguen la fase del ciclo', () => {
    const sis = heartScene({ hr: 72, beatPhase: 0.2, flowPhase: 0, co: 5 });
    expect(byId<BoxItem>(sis.items, 'tricuspide').label).toContain('cerrada');
    expect(byId<BoxItem>(sis.items, 'aortica').label).toContain('abierta');
    const dia = heartScene({ hr: 72, beatPhase: 0.6, flowPhase: 0, co: 5 });
    expect(byId<BoxItem>(dia.items, 'mitral').label).toContain('abierta');
    expect(byId<EllipsoidItem>(sis.items, 'ven-izq').radii[1]).toBeCloseTo(1.1 * cycleAt(0.2, 72).ventricle, 12);
    expect(byId<EllipsoidItem>(sis.items, 'ven-izq').radii[1]).toBeLessThan(byId<EllipsoidItem>(dia.items, 'ven-izq').radii[1]);
  });
  it('la sangre se oxigena en los pulmones y se desoxigena en el cuerpo', () => {
    expect(PATH[0].oxy).toBe(false);
    expect(bloodAt(5.5 / (PATH.length - 1)).oxy).toBe(true);
    expect(bloodAt(13.5 / (PATH.length - 1)).oxy).toBe(false);
    const sc = heartScene({ hr: 72, beatPhase: 0, flowPhase: 0.1, co: 5 });
    const n = byId<ParticlesItem>(sc.items, 'sangre-oxigenada').points.length + byId<ParticlesItem>(sc.items, 'sangre-desoxigenada').points.length;
    expect(n).toBe(28);
  });
});
