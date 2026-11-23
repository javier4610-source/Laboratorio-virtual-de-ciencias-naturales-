import { describe, expect, it } from 'vitest';
import { H_MAX, heightOf, N_PARTICLES, pistonScene } from '../../src/labs/thermodynamics3d';
import { ottoCycle, stateAlong } from '../../src/models/thermodynamics';
import { dopplerScene, sceneScale } from '../../src/labs/doppler3d';
import { fmt } from '../../src/lib/format';
import { digestionScene, N_PER_NUTRIENT, PATH, pHColor } from '../../src/labs/digestion3d';
import { DEFAULT_MEAL, digestMeal } from '../../src/models/digestion';
import { gelScene, helixScene, K_GEL, N_BP, Z0 } from '../../src/labs/pcr3d';
import { migration } from '../../src/models/pcr';
import { antibodyScene, GRID, MAX_ANTIBODIES, populationScene, splitCounts } from '../../src/labs/immunity3d';
import { simulateSIR } from '../../src/models/immunity';
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

describe('tubo digestivo 3D (digestión)', () => {
  const r = digestMeal(DEFAULT_MEAL);
  it('los órganos tienen el color de su pH', () => {
    const sc = digestionScene(r, 0);
    expect(pHColor(2)).toBe('bad');
    expect(pHColor(6)).toBe('warn');
    expect(pHColor(6.8)).toBe('ok');
    expect(pHColor(7.4)).toBe('info');
    expect(byId(sc.items, 'estomago').color).toBe('bad');
    expect(byId(sc.items, 'boca').color).toBe('ok');
    expect(byId(sc.items, 'delgado-0').color).toBe('info');
    // Con antiácido el estómago queda ligeramente ácido.
    expect(byId(digestionScene(digestMeal({ ...DEFAULT_MEAL, situation: 'antiacido' }), 0).items, 'estomago').color).toBe('warn');
  });
  it('el bolo avanza por los tramos y sus partículas son proporcionales a lo que queda sin digerir', () => {
    const n = (sc: ReturnType<typeof digestionScene>, id: string) => byId<ParticlesItem>(sc.items, id)?.points.length ?? 0;
    const start = digestionScene(r, 0);
    expect(n(start, 'bolo-almidon')).toBe(N_PER_NUTRIENT);
    const mid = digestionScene(r, 100); // estómago mezclado
    expect(mid.at.index).toBe(2);
    expect(n(mid, 'bolo-almidon')).toBe(Math.round(N_PER_NUTRIENT * mid.at.remaining.almidon));
    const end = digestionScene(r, r.totalMinutes);
    expect(end.at.index).toBe(5);
    expect(n(end, 'bolo-grasa')).toBe(Math.round(N_PER_NUTRIENT * r.segments[5].remaining.grasa));
    const c = byId<ParticlesItem>(mid.items, 'bolo-proteina').points[0];
    const [a, b] = PATH[2];
    expect(Math.abs(c[1] - (a[1] + (b[1] - a[1]) * mid.at.within))).toBeLessThan(0.2);
  });
});

describe('PCR y gel 3D', () => {
  const base = { extension: 0, primersBind: true, cycle: 1, copies: 1000 };
  it('la hélice: unida con peldaños, separada en la desnaturalización, con cebadores en el alineamiento y copia en la extensión', () => {
    const nat = helixScene({ ...base, phase: 'nativo' });
    expect(nat.items.filter((i) => i.id.startsWith('par-'))).toHaveLength(N_BP);
    const den = helixScene({ ...base, phase: 'desnaturalizacion' });
    expect(den.items.some((i) => i.id.startsWith('par-'))).toBe(false);
    expect(byId(den.items, 'cebador-directo')).toBeUndefined();
    const ali = helixScene({ ...base, phase: 'alineamiento' });
    expect(byId<ParticlesItem>(ali.items, 'cebador-directo').points).toHaveLength(4);
    expect(byId(ali.items, 'copia-abajo')).toBeUndefined();
    const ext = helixScene({ ...base, phase: 'extension', extension: 1 });
    expect(byId<ParticlesItem>(ext.items, 'copia-abajo').points).toHaveLength(N_BP - 4);
    expect(byId(helixScene({ ...base, phase: 'alineamiento', primersBind: false }).items, 'cebador-directo')).toBeUndefined();
  });
  it('gel: cada banda baja la distancia del modelo por el avance; el producto queda entre las bandas del marcador', () => {
    const g = gelScene({ product: 350, extraBand: null, progress: 1, productBrightness: 1 });
    const band = (lane: string, bp: number) => g.bands.find((b) => b.lane === lane && b.bp === bp)!;
    expect(band('producto', 350).z).toBeCloseTo(Z0 + migration(350) * K_GEL, 12);
    expect(band('producto', 350).z).toBeGreaterThan(band('marcador', 400).z);
    expect(band('producto', 350).z).toBeLessThan(band('marcador', 300).z);
    const half = gelScene({ product: 350, extraBand: null, progress: 0.5, productBrightness: 1 });
    expect(half.bands.find((b) => b.lane === 'producto')!.z - Z0).toBeCloseTo((band('producto', 350).z - Z0) / 2, 12);
    expect(gelScene({ product: 350, extraBand: null, progress: 0, productBrightness: 1 }).bands).toHaveLength(0);
    expect(g.bands.filter((b) => b.lane === 'control')).toHaveLength(0);
  });
});

describe('población y anticuerpos 3D (sistema inmune)', () => {
  it('las esferas de cada grupo siguen las proporciones del SIR y suman 400', () => {
    const c = splitCounts({ S: 5000, I: 1000, R: 2500, V: 1500 });
    expect(c).toEqual({ S: 200, I: 40, R: 100, V: 60 });
    const odd = splitCounts({ S: 1, I: 1, R: 1, V: 0 });
    expect(odd.S + odd.I + odd.R + odd.V).toBe(GRID * GRID);
    const run = simulateSIR({ R0: 15, infectiousDays: 8, coverage: 0.8, efficacy: 0.97, N: 10000, I0: 5, days: 200 });
    const p = run.points[30];
    const sc = populationScene({ ...p });
    const n = (id: string) => byId<ParticlesItem>(sc.items, id)?.points.length ?? 0;
    expect(n('grupo-V') + n('grupo-R') + n('grupo-I') + n('grupo-S')).toBe(400);
    expect(n('grupo-V')).toBe(sc.counts.V);
    expect(Math.abs(n('grupo-V') - (p.V / 10000) * 400)).toBeLessThanOrEqual(1);
  });
  it('el número de anticuerpos crece con el título', () => {
    expect(antibodyScene(0, 0).n).toBe(0);
    expect(antibodyScene(1, 12).n).toBeLessThan(antibodyScene(20, 36).n);
    expect(antibodyScene(20, 36).n).toBe(MAX_ANTIBODIES);
    expect(antibodyScene(20, 36).items.filter((i) => i.id.endsWith('-tallo'))).toHaveLength(MAX_ANTIBODIES);
  });
});
