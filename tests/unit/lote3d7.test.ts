import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { ArrowItem, BoxItem, ParticlesItem, RodItem, SceneItem, SphereItem } from '../../src/three/scene';
import { odColor, OD_STOPS } from '../../src/labs/lote3d7/common';
import { ecosystemScene, flowRadius, type EcoSceneInput } from '../../src/labs/lote3d7/ecosystem3d';
import { foodWebScene, levelTotals, nodeRadius, pyramidSide, R_BASE } from '../../src/labs/lote3d7/foodweb3d';
import { decompositionScene, piecesFor } from '../../src/labs/lote3d7/decomposition3d';
import { fenceY, kmX, profileAt, waterScene } from '../../src/labs/lote3d7/water3d';
import { netGrowth, populationScene, Y_LEN } from '../../src/labs/lote3d7/population3d';
import { axisScale, inquiryScene, X_LEN } from '../../src/labs/lote3d7/inquiry3d';
import { COL_CAP, COL_PER_FLUX, columnHeight, ENERGY_Z, fluxRadius, mapPoint, metabolismScene, RULER_STEP } from '../../src/labs/lote3d7/metabolism3d';
import { matchChains, residueClasses, sequenceScene } from '../../src/labs/lote3d7/sequences3d';
import { tempColor } from '../../src/labs/lote3d6/common';
import { countOf, simulateEcosystem, stateAt } from '../../src/models/ecosystem';
import { BASE_EQUILIBRIUM, FOODWEB_DEFAULTS, LINKS, SPECIES, simulateFoodWeb, type SpeciesId } from '../../src/models/foodweb';
import { simulateDecomposition } from '../../src/models/decomposition';
import { oxygenProfile, simulateRiver } from '../../src/models/waterQuality';
import { simulatePopulation } from '../../src/models/population';
import { analyze, collect, SYSTEMS, type Design } from '../../src/models/inquiry';
import { MAP_EDGES, MAP_ENERGY, REFERENCE_CONDITION, runFba } from '../../src/models/metabolism';
import { align, comparisonPresets, findExample } from '../../src/models/sequences';
import { parseStructure } from '../../src/models/protein';

const byId = <T extends SceneItem = SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T | undefined;
const nPoints = (items: SceneItem[], id: string) => (byId<ParticlesItem>(items, id)?.points.length ?? 0);

describe('escala fija del oxígeno disuelto', () => {
  it('paradas exactas y extremos', () => {
    for (const [v, c] of OD_STOPS) expect(odColor(v)).toBe(c);
    expect(odColor(-1)).toBe(OD_STOPS[0][1]);
    expect(odColor(12)).toBe(OD_STOPS[4][1]);
  });
});

describe('ecosistema: el frasco con el estado del modelo y el balance del día', () => {
  const input = { lightHours: 12, dimmer: 60, distance: 30, plants: 3, snails: 4, fish: 1, food: 'poco' as const, decomposers: true };
  const sim = simulateEcosystem(input);
  const base = (day: number, started: boolean, done: boolean): EcoSceneInput => {
    const vis = started ? stateAt(sim, day, 'amanecer') : sim.days[0].dawn;
    return { vis, plants: 3, snails: 4, fish: 1, decomposers: true, par: sim.par, distance: 30, lit: false, flakes: 2, started, done, day, clock: `Día ${day} · 06:00`,
      gpp: sim.days[day].gpp, respiration: sim.days[day].respiration, decomposition: sim.days[day].decomposition,
      readings: { od: 6.1, ph: 7, indicator: 'verde', snails: countOf(vis.snails), fish: countOf(vis.fish), elodea: 7 }, readLabel: 'Amanecer (6:00)' };
  };
  it('antes de simular no hay flechas de O₂ ni de CO₂', () => {
    const s = ecosystemScene(base(0, false, false));
    expect(byId(s.items, 'o2')).toBeUndefined();
    expect(byId(s.items, 'co2')).toBeUndefined();
    expect(s.description).toContain('Aún no corre la simulación');
  });
  it('organismos = estado del modelo; flechas ∝ √ del balance del día; números solo al medir', () => {
    const during = ecosystemScene(base(7, true, false));
    const v = stateAt(sim, 7, 'amanecer');
    expect(during.counts.snails).toBe(Math.min(30, countOf(v.snails)));
    expect(during.counts.fish).toBe(countOf(v.fish));
    expect(nPoints(during.items, 'caracoles')).toBe(during.counts.snails);
    expect(during.counts.specks).toBe(Math.min(80, Math.round(v.detritus / 4)));
    expect(byId<ArrowItem>(during.items, 'o2')!.radius).toBeCloseTo(flowRadius(sim.days[7].gpp), 12);
    expect(byId<ArrowItem>(during.items, 'co2')!.radius).toBeCloseTo(flowRadius(sim.days[7].respiration - sim.days[7].decomposition), 12);
    expect(byId<ArrowItem>(during.items, 'co2-desc')!.radius).toBeCloseTo(flowRadius(sim.days[7].decomposition), 12);
    // Mientras corre, el rótulo no da el valor (el banco lo muestra al terminar).
    expect(byId(during.items, 'o2')!.label).not.toMatch(/mg\/L/);
    const done = ecosystemScene(base(7, true, true));
    expect(byId(done.items, 'o2')!.label).toContain(`${sim.days[7].gpp.toFixed(1).replace('.', ',')} mg/L`);
    expect(done.description).toContain('Lecturas: oxígeno 6,1 mg/L');
    expect(flowRadius(40)).toBe(flowRadius(100));
  });
  it('sin descomponedores no hay flecha de CO₂ del lodo y la luz solo con la lámpara encendida', () => {
    const s = ecosystemScene({ ...base(3, true, false), decomposers: false, lit: true });
    expect(byId(s.items, 'co2-desc')).toBeUndefined();
    expect(byId(s.items, 'luz')).toBeDefined();
    expect(byId(ecosystemScene(base(3, true, false)).items, 'luz')).toBeUndefined();
  });
});

describe('redes: volumen ∝ biomasa, enlaces del modelo, pirámide y cascada', () => {
  const res = simulateFoodWeb({ ...FOODWEB_DEFAULTS });
  const at = (r: typeof res, i: number) => Object.fromEntries(SPECIES.map((s) => [s.id, r.series[s.id][i]])) as Record<SpeciesId, number>;
  const last = res.times.length - 1;
  it('radio³ ∝ biomasa relativa y un enlace por cada presa–depredador', () => {
    const b = at(res, last);
    const s = foodWebScene({ biomass: b, benchBiomass: b, removed: null, year: res.times[last], started: true });
    for (const sp of SPECIES) {
      const r = byId<SphereItem>(s.items, `sp-${sp.id}`)!.radius;
      expect(r).toBeCloseTo(Math.max(0.25, nodeRadius(b[sp.id], sp.id)), 12);
    }
    expect(nodeRadius(BASE_EQUILIBRIUM.pastos * 2, 'pastos') ** 3 / R_BASE ** 3).toBeCloseTo(2, 12);
    expect(s.items.filter((i) => i.id.startsWith('enlace-')).length).toBe(LINKS.length);
    const lv = levelTotals(b);
    expect(byId<BoxItem>(s.items, 'piso-productor')!.size[0]).toBeCloseTo(pyramidSide(lv.productor), 12);
    expect(pyramidSide(lv.productor)).toBeGreaterThan(pyramidSide(lv.tope));
  });
  it('sin gavilanes: corrida del mismo modelo y cascada frente al banco', () => {
    const run = simulateFoodWeb({ ...FOODWEB_DEFAULTS, initial: { gavilanes: 0 } });
    const s = foodWebScene({ biomass: at(run, last), benchBiomass: at(res, last), removed: 'gavilanes', year: 30, started: true });
    const ratio = (id: SpeciesId) => s.changes.find((c) => c.id === id)!.ratio;
    expect(ratio('ratones')).toBeCloseTo(run.series.ratones[last] / res.series.ratones[last], 12);
    expect(byId(s.items, 'sp-gavilanes')!.color).toBe('line-strong');
    const col = byId(s.items, 'sp-ratones')!.color;
    expect(col).toBe(ratio('ratones') > 1.05 ? 'ok' : ratio('ratones') < 0.95 ? 'bad' : 'ink-3');
    expect(s.description).toContain('sin gavilanes desde el inicio');
  });
});

describe('descomposición: trozos ∝ masa del modelo y lectura solo al pesar', () => {
  const res = simulateDecomposition({ materialId: 'banano', weeks: 4, temperature: 25, moisture: 55, aerated: true, chopped: false });
  const inp = { res, materialId: 'banano', weeks: 4, temperature: 25, moisture: 55, aerated: true, chopped: false };
  it('enterrada: balanza en 0,0 g y sin trozos', () => {
    const s = decompositionScene({ ...inp, move: 0, outOfPile: false, measured: false });
    expect(s.pieces).toBe(0);
    expect(byId(s.items, 'plato')!.label).toContain('0,0 g');
    expect(byId(s.items, 'bulbo')!.color).toBe(tempColor(res.observations.pileTemperature));
  });
  it('pesada: un trozo por gramo que queda y la lectura de la balanza', () => {
    const moving = decompositionScene({ ...inp, move: 0.5, outOfPile: true, measured: false });
    expect(byId(moving.items, 'plato')!.label).toContain('- - -');
    const s = decompositionScene({ ...inp, move: 1, outOfPile: true, measured: true });
    expect(s.pieces).toBe(piecesFor(res.trueMass));
    expect(nPoints(s.items, 'trozos')).toBe(Math.round(res.trueMass));
    expect(byId(s.items, 'plato')!.label).toContain(`${res.massReading.toFixed(1).replace('.', ',')} g`);
  });
});

describe('agua: oxígeno del perfil de Streeter–Phelps solo después de medir', () => {
  const w = { river: 'apartado' as const, source: 'domestico' as const, riverFlow: 3, dischargeFlow: 300, riverTemp: 27 };
  const res = simulateRiver({ ...w, distance: 5 });
  const profile = oxygenProfile(w, 129);
  const inp = { res, profile, distance: 5, dischargeFlow: 300, sourceId: 'domestico', sampling: false, odReading: 5.31 };
  it('antes de medir: río de un color y sin cerca', () => {
    const s = waterScene({ ...inp, measured: false });
    expect(new Set(s.items.filter((i) => i.id.startsWith('rio-')).map((i) => i.color)).size).toBe(1);
    expect(byId(s.items, 'ref4')).toBeUndefined();
    expect(byId(s.items, 'bandeja')).toBeUndefined();
  });
  it('medido: color por tramo = O₂ del perfil; cerca a su altura; familias del BMWP', () => {
    const s = waterScene({ ...inp, measured: true });
    for (const seg of s.segments) {
      const it = byId(s.items, `rio-${(seg.km - 0.25).toFixed(1)}`)!;
      expect(it.color).toBe(odColor(profileAt(profile, seg.km)));
    }
    const curve = s.items.filter((i) => i.id.startsWith('curva-') && i.kind === 'rod') as RodItem[];
    expect(curve[0].from[1]).toBeCloseTo(fenceY(profile[0].od), 12);
    expect(curve[0].from[0]).toBeCloseTo(kmX(profile[0].x), 12);
    expect(nPoints(s.items, 'familias-ok') + nPoints(s.items, 'familias-warn') + nPoints(s.items, 'familias-bad')).toBe(res.bmwp.n);
    expect(byId<ArrowItem>(s.items, 'critico')!.from[0]).toBeCloseTo(kmX(res.xc), 12);
    expect(profileAt(profile, profile[10].x)).toBeCloseTo(profile[10].od, 12);
  });
});

describe('población: superficie del crecimiento neto y captura sostenible', () => {
  const inp = { model: 'logistico' as const, n0: 20, r: 0.5, k: 1000, h: 0.3, years: 50 };
  const res = simulatePopulation(inp);
  const s = populationScene({ ...inp, res });
  it('altura = dN/dt del modelo con la escala fija', () => {
    const seg = byId<RodItem>(s.items, 'fila-0-6')!;
    const N0 = (1.3 * 1000 * 6) / 24;
    expect(seg.from[1]).toBeCloseTo(netGrowth('logistico', N0, 0.5, 1000, 0) * s.scale.gy, 12);
    expect(s.scale.gy * (0.5 * 1000) / 4).toBeCloseTo(Y_LEN, 12);
    expect(netGrowth('exponencial', 100, 0.5, 1000, 0.2)).toBeCloseTo(30, 12);
  });
  it('máximo sostenible en h ≈ r/2 con r·K/4 y la pesca del banco', () => {
    expect(s.best!.h).toBeCloseTo(0.25, 12);
    expect(s.best!.catch).toBeCloseTo(125, 9);
    expect(byId(s.items, 'captura')!.label).toContain(`${Math.round(0.3 * res.equilibrium)} por año`);
    expect(s.description).toContain('sobreexplotación');
    // La esfera final está en N final de la corrida del banco.
    expect(byId<SphereItem>(s.items, 'final')!.center[0]).toBeCloseTo(res.finalN * s.scale.nx, 12);
  });
});

describe('reto: la nube de puntos son las muestras del banco', () => {
  const d: Design = { system: 'rio', levels: 3, min: 0, max: 20, replicates: 2, confound: 'sin-control', seed: 123 };
  const samples = collect(d);
  it('solo las muestras ya mostradas, con x, confusión e y en sus ejes', () => {
    const s = inquiryScene({ sys: SYSTEMS.rio, samples, shown: 4, confound: d.confound, analysis: null, seed: 123 });
    expect(s.points.length).toBe(4);
    const sx = axisScale(samples.map((p) => p.x), X_LEN);
    expect(s.points[0][0]).toBeCloseTo(sx.at(samples[0].x), 12);
    expect(byId(s.items, 'recta')).toBeUndefined();
  });
  it('al terminar: recta del análisis del banco y correlación de la confusión', () => {
    const a = analyze(samples);
    const s = inquiryScene({ sys: SYSTEMS.rio, samples, shown: samples.length, confound: d.confound, analysis: a, seed: 123 });
    expect(byId(s.items, 'recta')!.label).toContain('pendiente');
    expect(s.description).toContain(`r = ${a.confoundR.toFixed(2).replace('.', ',')}`);
  });
});

describe('metabolismo: flechas y columnas con los flujos del FBA', () => {
  const fba = runFba(REFERENCE_CONDITION);
  it('cada reacción con flujo: flecha en su sentido, grosor de la regla del banco y altura ∝ |v|', () => {
    const s = metabolismScene({ fluxes: fba.fluxes, computed: true, disabled: [], view: 'actual', carbonLabel: 'Glucosa' });
    const on = MAP_EDGES.filter((e) => Math.abs(fba.fluxes[e.r] ?? 0) > 1e-6);
    expect(s.active.length).toBe(on.length);
    for (const e of on) {
      const v = fba.fluxes[e.r];
      const arrow = byId<ArrowItem>(s.items, `rx-${e.r}`)!;
      expect(arrow.kind).toBe('arrow');
      expect(arrow.radius).toBeCloseTo(fluxRadius(v), 12);
      expect(byId<BoxItem>(s.items, `col-${e.r}`)!.size[1]).toBeCloseTo(columnHeight(v), 12);
    }
    // PGI va de G6P a F6P (flujo positivo en la referencia).
    const pgi = byId<ArrowItem>(s.items, 'rx-PGI')!;
    expect(fba.fluxes.PGI).toBeGreaterThan(0);
    expect(Math.sign(pgi.vector[2])).toBe(Math.sign(mapPoint(200, 165)[2] - mapPoint(200, 100)[2]));
    expect(columnHeight(10)).toBeCloseTo(10 * COL_PER_FLUX, 12);
    expect(s.description).toContain('μ = 0,8739');
  });
  it('energía: grupo aparte detrás de la membrana, la MISMA escala lineal que las vías y una regla cada 10 mmol/gDW/h', () => {
    const s = metabolismScene({ fluxes: fba.fluxes, computed: true, disabled: [], view: 'actual', carbonLabel: 'Glucosa' });
    const membrana = byId<BoxItem>(s.items, 'membrana')!;
    const fondo = membrana.center[2] - membrana.size[2] / 2;
    for (const id of MAP_ENERGY) {
      const col = byId<BoxItem>(s.items, `en-${id}`)!;
      expect(col.center[2], id).toBeLessThan(fondo);
      expect(col.center[2]).toBe(ENERGY_Z);
      if (Math.abs(fba.fluxes[id]) > 1e-6) expect(col.size[1], id).toBeCloseTo(columnHeight(fba.fluxes[id]), 12);
      expect(col.label, id).toContain(id);
    }
    // La ATP sintasa supera el tope: su columna mide lo mismo que el tope de la regla y la leyenda lo dice.
    expect(Math.abs(fba.fluxes.ATPS4r)).toBeGreaterThan(COL_CAP);
    expect(byId<BoxItem>(s.items, 'en-ATPS4r')!.label).toContain('tope de 40');
    const marcas = s.items.filter((i) => i.id.startsWith('regla-')) as BoxItem[];
    expect(marcas.map((m) => +m.id.slice(6))).toEqual([10, 20, 30, 40]);
    const base = byId<BoxItem>(s.items, 'en-NADH16')!.center[1] - byId<BoxItem>(s.items, 'en-NADH16')!.size[1] / 2;
    for (const m of marcas) expect(m.center[1] - base).toBeCloseTo(+m.id.slice(6) * COL_PER_FLUX, 12);
    expect(RULER_STEP * COL_PER_FLUX).toBe(2.5);
  });
  it('sin calcular: nada lleva flujo; reacción eliminada en rojo', () => {
    expect(metabolismScene({ fluxes: null, computed: false, disabled: [], view: 'actual', carbonLabel: 'Glucosa' }).active.length).toBe(0);
    const ko = runFba({ ...REFERENCE_CONDITION, reactionKnockouts: ['PGI'] });
    const s = metabolismScene({ fluxes: ko.fluxes, computed: true, disabled: ko.disabled, view: 'actual', carbonLabel: 'Glucosa' });
    expect(byId(s.items, 'rx-PGI')!.color).toBe('bad');
  });
});

describe('secuencias: marcas del alineamiento sobre la estructura', () => {
  const preset = comparisonPresets().find((p) => p.id === 'globinas')!;
  const al = align(preset.a, preset.b, preset.scoring);
  const hb = parseStructure(readFileSync(new URL('../../src/data/proteinas/2HHB.cif', import.meta.url), 'utf8'));
  it('clases por residuo coherentes con el alineamiento', () => {
    const c = residueClasses(al, preset.a.length, preset.b.length);
    expect(c.a.filter((x) => x === 'id').length).toBe(al.identities);
    expect(c.b.filter((x) => x === 'id').length).toBe(al.identities);
    expect(c.a.filter((x) => x === 'sim').length).toBe(al.similarities - al.identities);
  });
  it('2HHB: cadenas α (A, C) y β (B, D) reconocidas por su secuencia y coloreadas', () => {
    const m = matchChains(hb, preset.a, preset.b);
    expect(m.map((x) => `${x.chain}${x.which}`).sort()).toEqual(['AB', 'BA', 'CB', 'DA']);
    expect(m.find((x) => x.chain === 'B')!.offset).toBe(1); // β madura: sin la metionina inicial
    const s = sequenceScene({ al, nameA: 'P68871', nameB: 'P69905', seqA: preset.a, seqB: preset.b, structure: { id: '2HHB', s: hb }, loading: false });
    expect(s.mode).toBe('estructura');
    const total = s.counts.id + s.counts.sim + s.counts.diff + s.counts.gap + s.counts.out;
    expect(total).toBe(m.reduce((a, x) => a + x.residues.length, 0));
    expect(s.description).toContain('estructura 2HHB');
  });
  it('ADN sin estructura: escalera con las columnas del alineamiento', () => {
    const p = comparisonPresets().find((x) => x.id === 'hbb-hbd')!;
    const a2 = align(p.a, p.b, p.scoring);
    const s = sequenceScene({ al: a2, nameA: 'A', nameB: 'B', seqA: p.a, seqB: p.b, structure: null, loading: false });
    expect(s.mode).toBe('escalera');
    expect(s.counts.id).toBe(a2.identities);
    expect(s.counts.id + s.counts.sim + s.counts.diff + s.counts.gap).toBe(a2.alignedA.length);
    expect(findExample('hbb-prot')).toBeDefined();
  });
});
