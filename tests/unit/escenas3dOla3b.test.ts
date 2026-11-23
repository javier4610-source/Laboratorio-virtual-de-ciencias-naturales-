import { describe, expect, it } from 'vitest';
import { H_MAX, heightOf, N_PARTICLES, pistonScene } from '../../src/labs/thermodynamics3d';
import { ottoCycle, stateAlong } from '../../src/models/thermodynamics';
import { dopplerScene, sceneScale } from '../../src/labs/doppler3d';
import { fmt } from '../../src/lib/format';
import type { ArrowItem, BoxItem, ParticlesItem, RodItem, SceneItem, SphereItem } from '../../src/three/scene';

const byId = <T extends SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T;

describe('cilindro con émbolo 3D (termodinámica)', () => {
  const c = ottoCycle(8, 1800);
  const Vmax = 1e-3;
  it('la altura del gas es proporcional al volumen y el émbolo está encima', () => {
    expect(heightOf(Vmax, Vmax)).toBe(H_MAX);
    expect(heightOf(Vmax / 8, Vmax) / heightOf(Vmax, Vmax)).toBeCloseTo(1 / 8, 12);
    const at = stateAlong(c.legs, 0.25);
    const sc = pistonScene({ s: at.s, Vmax, dQsign: 0, dWsign: 0, t: 0, stageLabel: 'x' });
    expect(sc.h).toBeCloseTo(H_MAX / 8, 9);
    expect(byId<BoxItem>(sc.items, 'embolo').center[1]).toBeCloseTo(0.3 + sc.h + 0.08, 12);
    expect(byId<ParticlesItem>(sc.items, 'particulas').points).toHaveLength(N_PARTICLES);
    for (const p of byId<ParticlesItem>(sc.items, 'particulas').points) expect(p[1]).toBeLessThan(0.3 + sc.h + 0.2);
  });
  it('las flechas siguen la etapa: compresión (W < 0, sin calor), chispa (Q entra) y escape (Q sale)', () => {
    const comp = stateAlong(c.legs, 0.1);
    const a = pistonScene({ s: comp.s, Vmax, dQsign: comp.dQsign, dWsign: comp.dWsign, t: 1, stageLabel: 'compresión' });
    expect(byId<ArrowItem>(a.items, 'trabajo').vector[1]).toBeLessThan(0);
    expect(byId(a.items, 'calor')).toBeUndefined();
    const heat = stateAlong(c.legs, 0.3);
    const b = pistonScene({ s: heat.s, Vmax, dQsign: heat.dQsign, dWsign: heat.dWsign, t: 2, stageLabel: 'chispa' });
    expect(byId<ArrowItem>(b.items, 'calor').tag).toBe('Q entra');
    expect(byId(b.items, 'trabajo')).toBeUndefined();
    const out = stateAlong(c.legs, 0.9);
    const d = pistonScene({ s: out.s, Vmax, dQsign: out.dQsign, dWsign: out.dWsign, t: 3, stageLabel: 'escape' });
    expect(byId<ArrowItem>(d.items, 'calor').tag).toBe('Q sale');
    expect(d.description).toContain('Cede calor a la fuente fría');
  });
});

describe('frentes de onda 3D (efecto Doppler)', () => {
  const sphere = (sc: ReturnType<typeof dopplerScene>, id: string) => byId<SphereItem>(sc.items, id);
  it('cada frente es una esfera centrada donde se emitió, con radio proporcional a su edad', () => {
    const sc = dopplerScene({ M: 0.5, t: 4, observerX: 2, showCone: false, label: 'x' });
    expect(sc.fronts).toHaveLength(5);
    const k = sceneScale(0.5);
    expect(sphere(sc, 'frente-4').radius).toBeCloseTo(4 * k, 12);
    expect(sphere(sc, 'frente-1').radius).toBeCloseTo(1 * k, 12);
    // La fuente está delante del centro de todos sus frentes.
    expect(sphere(sc, 'fuente').center[0]).toBeGreaterThan(sphere(sc, 'frente-1').center[0]);
    // Razón de separaciones delante/detrás = (1 − M)/(1 + M).
    expect(sc.description).toContain(`la razón ${fmt((1 - 0.5) / (1 + 0.5), 3)}`);
  });
  it('supersónico: aparece el cono con sen θ = 1/M y las tangentes tocan el frente más antiguo', () => {
    const M = 2;
    const sc = dopplerScene({ M, t: 6, observerX: 0, showCone: true, label: 'avión' });
    const rod = byId<RodItem>(sc.items, 'cono-arriba');
    const dx = rod.to[0] - rod.from[0], dy = rod.to[1] - rod.from[1];
    expect(Math.atan2(dy, -dx)).toBeCloseTo(Math.asin(1 / M), 9);
    const oldest = sc.fronts[sc.fronts.length - 1];
    const k = sceneScale(M);
    // Distancia del extremo de la tangente al centro del frente más antiguo = su radio.
    expect(Math.hypot(rod.to[0] - oldest.center * k, rod.to[1])).toBeCloseTo(oldest.radius * k, 9);
    expect(byId(dopplerScene({ M: 0.8, t: 6, observerX: 0, showCone: true, label: 'x' }).items, 'cono-arriba')).toBeUndefined();
  });
});
