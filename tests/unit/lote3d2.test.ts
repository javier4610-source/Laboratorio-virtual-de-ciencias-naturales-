import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { SceneItem, Vec3 } from '../../src/three/scene';
import { BDNA, helixScene, helixSteps, hBondsOf, pairFromId, pairInfo, PITCH, TWIST_DEG } from '../../src/labs/lote3d2/helix';
import { cellRadii, channelDirections, osmosisScene, radiusAlong, SOLUTE_DOTS_PER_OSM, waterPosition } from '../../src/labs/lote3d2/osmosis3d';
import { chromosomeLayout, mitosisScene, POLE_X, stageProgress } from '../../src/labs/lote3d2/mitosis3d';
import { fiberCount, MAX_FIBERS, precipitateSize, tubeScene } from '../../src/labs/lote3d2/extraction3d';
import { DOMINANT_COLOR, mendelScene, RECESSIVE_COLOR } from '../../src/labs/lote3d2/mendel3d';
import { ARROW_MAX, bubblePositions, MAX_GROSS, MAX_LIGHT, photoScene } from '../../src/labs/lote3d2/photo3d';
import { GAS_SPHERES, gasSpheres, partFromId, partInfo, respirationScene } from '../../src/labs/lote3d2/respiration3d';
import { CIN0, naclOsmolarity, simulateOsmosis } from '../../src/models/osmosis';
import { cycleState, ONION_2N, TISSUES } from '../../src/models/mitosis';
import { complement } from '../../src/models/dna';
import { hydrogenBonds } from '../../src/models/dnaExtraction';
import { findOrganism, punnettGametes } from '../../src/models/mendel';
import { grossRate, irradiance, simulatePhotosynthesis } from '../../src/models/photosynthesis';
import { atpBreakdown, GLUCOSE_COUNTS, respirometerModel } from '../../src/models/respiration';

const byId = (items: SceneItem[], id: string) => items.find((i) => i.id === id);
const dist = (a: Vec3, b: Vec3) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const ids = (items: SceneItem[]) => items.map((i) => i.id);

describe('hélice de ADN-B (geometría con parámetros estándar)', () => {
  it('10,5 pares por vuelta, 3,4 Å por par y fosfatos a 10 Å del eje', () => {
    expect(TWIST_DEG).toBeCloseTo(360 / 10.5, 10);
    expect(PITCH).toBeCloseTo(35.7, 10);
    const s = helixSteps(22);
    for (let i = 1; i < s.length; i++) {
      expect(s[i].y - s[i - 1].y).toBeCloseTo(3.4, 10);
      expect(s[i].angle1 - s[i - 1].angle1).toBeCloseTo(TWIST_DEG, 10);
    }
    for (const st of s) {
      expect(Math.hypot(st.p1[0], st.p1[2])).toBeCloseTo(BDNA.phosphateRadius, 10);
      expect(Math.hypot(st.p2[0], st.p2[2])).toBeCloseTo(BDNA.phosphateRadius, 10);
      expect(st.angle2 - st.angle1).toBeCloseTo(BDNA.minorGrooveDeg, 9);
    }
    // Dos vueltas completas = 21 pares: el fosfato vuelve a la misma posición angular.
    expect(s[21].p1[0]).toBeCloseTo(s[0].p1[0], 9);
    expect(s[21].p1[2]).toBeCloseTo(s[0].p1[2], 9);
    // Centrada en el origen.
    expect(s[0].y + s[21].y).toBeCloseTo(0, 10);
  });

  it('las bases y los puentes de hidrógeno son los de la secuencia (A–T 2, G–C 3)', () => {
    const seq = 'ATGGCCTTAG';
    const h = helixScene({ id: 'x', strand1: seq, strand2: [...complement(seq)], name1: 'a', name2: 'b', showPairing: true });
    const expected = [...seq].reduce((n, b) => n + (b === 'A' || b === 'T' ? 2 : 3), 0);
    expect(h.hBonds).toBe(expected);
    const pts = byId(h.items, 'x-hb');
    expect(pts?.kind === 'particles' && pts.points.length).toBe(expected);
    expect(h.status.every((s) => s === 'correcto')).toBe(true);
    expect(byId(h.items, 'x-b0-1')?.color).toBe('series-1'); // A
    expect(byId(h.items, 'x-b0-2')?.color).toBe('series-6'); // T enfrente
    for (const [a, b] of [['A', 'T'], ['G', 'C'], ['T', 'A'], ['C', 'G'], ['A', 'G'], ['C', 'T']] as const) expect(hBondsOf(a, b)).toBe(hydrogenBonds(a, b));
    expect(h.description).toContain(`${expected} puentes de hidrógeno`);
    expect(h.description).toContain('10 pares de bases');
  });

  it('pares no complementarios, espacios vacíos, orientación y límite de pares', () => {
    const h = helixScene({ id: 'y', strand1: 'ATGC', strand2: ['T', 'C', null, 'G'], name1: 'molde', name2: 'nueva', orientation: 'paralela', showPairing: true });
    expect(h.status).toEqual(['correcto', 'error', 'vacio', 'correcto']);
    expect(h.hBonds).toBe(2 + 3);
    expect(byId(h.items, 'y-mal')).toBeTruthy();
    expect(byId(h.items, 'y-b2-2')).toBeUndefined();
    expect(byId(h.items, 'y-e2b')?.label).toBe('3′ nueva'); // paralela: 3′ arriba como la molde
    const anti = helixScene({ id: 'z', strand1: 'ATGC', strand2: ['T', 'A', 'C', 'G'], name1: 'molde', name2: 'nueva' });
    expect(byId(anti.items, 'z-e2b')?.label).toBe('5′ nueva');
    expect(byId(anti.items, 'z-hb')).toBeUndefined(); // sin showPairing no se adelantan los puentes
    const long = helixScene({ id: 'l', strand1: 'A'.repeat(60), strand2: [...'T'.repeat(60)], name1: 'a', name2: 'b' });
    expect(long.n).toBe(24);
    expect(long.description).toContain('los primeros 24 de 60');
    expect(pairFromId('l', 'l-b7-2')).toBe(7);
    expect(pairFromId('l', 'l-c1-3')).toBeNull();
    expect(pairInfo('GA', ['C', 'T'], 0)).toContain('3 puentes');
  });
});

describe('ósmosis: la célula sigue el modelo', () => {
  it('el volumen y el sentido del agua son los del modelo en el instante del banco', () => {
    const res = simulateOsmosis({ cellType: 'animal', naclPercent: 0.3, temperature: 25, duration: 60 });
    const p = res.series[Math.floor(res.series.length / 2)];
    const sc = osmosisScene({ cellType: 'animal', volume: p.volume, t: p.t, duration: 60, waterDirection: res.waterDirection, lysed: false, externalOsm: res.externalOsm, naclPercent: 0.3, tonicity: res.tonicity });
    const m = byId(sc.items, 'membrana');
    expect(m?.kind).toBe('ellipsoid');
    const r = cellRadii('animal', p.volume), r0 = cellRadii('animal', 1);
    // Volumen del elipsoide ∝ producto de semiejes: el cociente es V del modelo.
    expect((r[0] * r[1] * r[2]) / (r0[0] * r0[1] * r0[2])).toBeCloseTo(p.volume, 10);
    expect(sc.outsideDots).toBe(Math.round(naclOsmolarity(0.3) * SOLUTE_DOTS_PER_OSM));
    expect(sc.insideDots).toBe(Math.round(CIN0 * SOLUTE_DOTS_PER_OSM));
    expect(res.waterDirection).toBe('entra');
    expect(sc.description).toContain('el agua entra');
    expect(sc.description).toContain(`Volumen ${(p.volume * 100).toFixed(1).replace('.', ',')} %`);
  });

  it('el agua cruza la membrana en el sentido del gradiente y se detiene si el tiempo no avanza', () => {
    const dirs = channelDirections(10);
    const radii = cellRadii('animal', 1);
    for (const k of [0, 3, 7]) {
      const d = dirs[k];
      const r = radiusAlong(radii, d);
      const a = waterPosition(k, d, radii, { t: 1, duration: 60, waterDirection: 'entra' });
      const b = waterPosition(k, d, radii, { t: 2, duration: 60, waterDirection: 'entra' });
      expect(a.inward).toBe(true);
      // Hacia adentro: la distancia al centro baja con el tiempo (sin cruzar el final del recorrido).
      const ra = Math.hypot(...a.p), rb = Math.hypot(...b.p);
      if (rb < ra) expect(rb).toBeGreaterThan(0.49 * r);
      const out = waterPosition(k, d, radii, { t: 1, duration: 60, waterDirection: 'sale' });
      expect(out.inward).toBe(false);
      expect(waterPosition(k, d, radii, { t: 1, duration: 60, waterDirection: 'entra' })).toEqual(a);
    }
    const eq = dirs.map((d, k) => waterPosition(k, d, radii, { t: 0, duration: 60, waterDirection: 'sin flujo neto' }).inward);
    expect(eq.filter(Boolean).length).toBe(5);
  });

  it('la célula vegetal no crece más allá de la pared y la lisis rompe la membrana', () => {
    expect(cellRadii('vegetal', 1.08)).toEqual(cellRadii('vegetal', 1));
    expect(cellRadii('vegetal', 0.7)[0]).toBeLessThan(cellRadii('vegetal', 1)[0]);
    const lys = osmosisScene({ cellType: 'animal', volume: 1.55, t: 10, duration: 60, waterDirection: 'entra', lysed: true, externalOsm: 0, naclPercent: 0, tonicity: 'hipotónica' });
    expect(byId(lys.items, 'membrana')?.label).toContain('lisis');
    expect(byId(lys.items, 'agua')).toBeUndefined();
    expect(byId(lys.items, 'contenido')).toBeTruthy();
  });
});

describe('mitosis: cromosomas por etapa', () => {
  it('la etapa y el avance salen de cycleState y de las duraciones del tejido', () => {
    for (const t of [0, 3, 10, 14.5, 16.5, 17.15, 17.45, 17.8]) expect(stageProgress(t).state).toEqual(cycleState(t, TISSUES[0]));
    expect(stageProgress(16 + 0.5).progress).toBeCloseTo(0.5, 10); // mitad de la profase (1 h)
    expect(stageProgress(17.35 + 0.1).progress).toBeCloseTo(0.5, 10); // mitad de la anafase (0,2 h)
  });

  it('número de cromátidas dibujadas = cromosomas × cromátidas por cromosoma del modelo', () => {
    for (const t of [3, 14.5, 16.5, 17.15, 17.45, 17.8]) {
      const sc = mitosisScene(t);
      expect(sc.chromatidBodies).toBe(sc.state.chromosomes * sc.state.chromatidsPerChromosome);
    }
    // En S, la segunda cromátida crece con el ADN del modelo.
    const s = chromosomeLayout('S', 0, 0.5);
    expect(s.every((c) => c.chromatids.length === 2)).toBe(true);
    const full = chromosomeLayout('G2', 0, 1)[0].chromatids;
    const half = s[0].chromatids;
    expect(dist(half[1].e1, half[1].e2)).toBeCloseTo(0.5 * dist(full[1].e1, full[1].e2), 9);
  });

  it('metafase en el plano ecuatorial; anafase hacia los polos; telofase con dos núcleos', () => {
    const meta = chromosomeLayout('metafase', 0.5, 1);
    expect(meta).toHaveLength(ONION_2N);
    for (const c of meta) {
      expect(Math.abs((c.chromatids[0].c[0] + c.chromatids[1].c[0]) / 2)).toBeLessThan(1e-9);
      for (const cd of c.chromatids) expect(cd.e1[0]).toBeCloseTo(cd.c[0], 9); // brazos en el plano de la placa
    }
    const early = chromosomeLayout('anafase', 0.1, 1), late = chromosomeLayout('anafase', 0.9, 1);
    expect(early).toHaveLength(2 * ONION_2N);
    const mean = (l: typeof early, s: number) => l.filter((c) => Math.sign(c.chromatids[0].c[0]) === s).reduce((a, c) => a + Math.abs(c.chromatids[0].c[0]), 0) / ONION_2N;
    expect(mean(late, 1)).toBeGreaterThan(mean(early, 1));
    expect(mean(late, -1)).toBeGreaterThan(mean(early, -1));
    expect(Math.max(...late.map((c) => Math.abs(c.chromatids[0].c[0])))).toBeLessThan(POLE_X);
    const telo = mitosisScene(17.8);
    expect(ids(telo.items)).toEqual(expect.arrayContaining(['nucleo-a', 'nucleo-b', 'placa-celular']));
    expect(telo.description).toContain('2 núcleos');
    const meta2 = mitosisScene(17.15);
    expect(ids(meta2.items).filter((i) => i.startsWith('fibra-')).length).toBe(2 * ONION_2N); // una fibra por cinetocoro
    expect(meta2.description).toContain('16 cromosomas, 2 cromátidas por cromosoma, 1 núcleo');
  });
});

describe('extracción de ADN: el tubo sigue el protocolo', () => {
  const base = { yieldIndex: 64, filtrate: 0.42, ethanol: 0.36, fruitName: 'Fresa', ethanolT: 4, stageText: 'x' };
  it('capas por etapa y precipitado ∝ √índice', () => {
    expect(ids(tubeScene({ ...base, stage: 0 }).items)).not.toContain('filtrado');
    expect(ids(tubeScene({ ...base, stage: 2 }).items)).toContain('filtrado');
    expect(ids(tubeScene({ ...base, stage: 2 }).items)).not.toContain('alcohol');
    const s3 = tubeScene({ ...base, stage: 3 });
    expect(ids(s3.items)).toContain('alcohol');
    expect(precipitateSize(64)).toBeCloseTo(0.8, 12);
    expect(fiberCount(64)).toBe(Math.round(MAX_FIBERS * 0.8));
    expect(ids(s3.items).filter((i) => i.startsWith('fibra-'))).toHaveLength(fiberCount(64));
    expect(fiberCount(0)).toBe(0);
    const s4 = tubeScene({ ...base, stage: 4, appearance: 'Ovillo abundante de hebras blancas' });
    expect(ids(s4.items)).toEqual(expect.arrayContaining(['varilla', 'ovillo']));
    expect(s4.description).toContain('ovillo abundante');
    // La interfase está a la altura del filtrado del banco 2D.
    const alc = byId(s3.items, 'alcohol');
    expect(alc?.kind === 'rod' && alc.from[1]).toBeCloseTo(0.42 * 12, 10);
  });
});

describe('Mendel: homólogos y gametos del cuadro de Punnett', () => {
  it('un par de homólogos por gen y los gametos del modelo', () => {
    const genes = findOrganism('guisante').genes.slice(0, 2);
    const sc = mendelScene(['Yy', 'Rr'], ['yy', 'Rr'], genes);
    expect(sc.gametes1).toEqual(punnettGametes(['Yy', 'Rr']));
    expect(sc.gametes2).toEqual(punnettGametes(['yy', 'Rr']));
    expect(ids(sc.items).filter((i) => /^p1-g\d-h\d$/.test(i))).toHaveLength(4);
    expect(ids(sc.items).filter((i) => /^p1-gam\d$/.test(i))).toHaveLength(4);
    // El color del locus dice si el alelo es dominante.
    expect(byId(sc.items, 'p2-g0-h0-locus')?.color).toBe(RECESSIVE_COLOR);
    expect(byId(sc.items, 'p1-g0-h0-locus')?.color).toBe(DOMINANT_COLOR);
    expect(byId(sc.items, 'p1-gam0')?.label).toBe('YR');
    expect(sc.description).toContain('4 tipos de gametos');
    expect(sc.description).toContain('segregación independiente');
    const mono = mendelScene(['YY'], ['yy'], genes.slice(0, 1));
    expect(mono.description).toContain('un solo tipo de gameto');
  });
});

describe('fotosíntesis: flechas con las tasas del modelo', () => {
  it('escalas fijas calculadas con el modelo y flechas proporcionales', () => {
    expect(MAX_LIGHT).toBeCloseTo(irradiance(5), 10);
    expect(MAX_GROSS).toBeGreaterThanOrEqual(grossRate(MAX_LIGHT, 0.05 + (5 / 84.007) * 1000, 25));
    const res = simulatePhotosynthesis({ distance: 20, bicarbonate: 1, temperature: 25, color: 'blanca', lampOn: true });
    const sc = photoScene({ res, lampOn: true, color: 'blanca', phase: 0, counted: false });
    expect(sc.arrows.co2).toBeCloseTo((res.gross / MAX_GROSS) * ARROW_MAX, 9);
    expect(sc.arrows.o2).toBeCloseTo((res.net / MAX_GROSS) * ARROW_MAX, 9);
    expect(sc.arrows.light).toBeCloseTo((res.effectiveLight / MAX_LIGHT) * ARROW_MAX, 9);
    expect(sc.description).not.toContain('µmol O₂'); // sin contar no se dicen los valores del modelo
    expect(photoScene({ res, lampOn: true, color: 'blanca', phase: 0, counted: true }).description).toContain('µmol O₂/g·h');
  });

  it('lámpara apagada: sin luz, O₂ hacia adentro y sin burbujas', () => {
    const res = simulatePhotosynthesis({ distance: 20, bicarbonate: 1, temperature: 25, color: 'blanca', lampOn: false });
    const sc = photoScene({ res, lampOn: false, color: 'blanca', phase: 0.3, counted: false });
    expect(byId(sc.items, 'luz')).toBeUndefined();
    expect(byId(sc.items, 'burbujas')).toBeUndefined();
    const o2 = byId(sc.items, 'o2');
    expect(o2?.kind === 'arrow' && o2.vector[1]).toBeLessThan(0);
    expect(o2?.label).toContain('respiración');
  });

  it('las burbujas usan la fase del banco 2D', () => {
    expect(bubblePositions(0.25, 10)).toHaveLength(6);
    expect(bubblePositions(0.25, 0)).toHaveLength(0);
    bubblePositions(1.25, 10).forEach((p, i) => p.forEach((x, k) => expect(x).toBeCloseTo(bubblePositions(0.25, 10)[i][k], 9)));
  });
});

describe('respiración: mitocondria sincronizada con el respirómetro', () => {
  const base = { sample: 'maiz' as const, temperature: 25, mass: 3, minutes: 20 };
  it('esferas de O₂ y CO₂ según el modelo y el avance', () => {
    const m = respirometerModel({ ...base, atmosphere: 'aire' });
    expect(gasSpheres(m.vO2, m.vCO2, 0)).toEqual({ o2: 0, co2: 0 });
    const end = gasSpheres(m.vO2, m.vCO2, 1);
    expect(Math.max(end.o2, end.co2)).toBe(GAS_SPHERES);
    expect(end.co2 / end.o2).toBeCloseTo(m.vCO2 / m.vO2, 1);
    const n2 = respirometerModel({ ...base, atmosphere: 'n2' });
    const sc = respirationScene({ atmosphere: 'n2', alive: true, substrate: 'carbohidrato', sampleName: 'Maíz', vO2: n2.vO2, vCO2: n2.vCO2, progress: 1, accounting: 'moderna', shuttle: 'malato', selected: null });
    expect(byId(sc.items, 'o2')).toBeUndefined();
    expect(byId(sc.items, 'co2')?.label).toContain('fermentación');
    expect(sc.description).toContain('anoxia');
  });

  it('balance de ATP por etapa = tabla de la práctica', () => {
    const b = atpBreakdown(GLUCOSE_COUNTS, 'malato', 'moderna');
    const info = partInfo('cadena', { accounting: 'moderna', shuttle: 'malato', substrate: 'carbohidrato', atmosphere: 'aire' });
    expect(info).toContain(`${b.total.toFixed(1).replace('.', ',')} ATP por glucosa`);
    expect(partInfo('glucolisis', { accounting: 'clasica', shuttle: 'glicerol', substrate: 'carbohidrato', atmosphere: 'aire' })).toContain(`rinden ${atpBreakdown(GLUCOSE_COUNTS, 'glicerol', 'clasica').fromNadhCyto.toFixed(1).replace('.', ',')} ATP`);
    expect(partFromId('cadena-3')).toBe('cadena');
    expect(partFromId('krebs')).toBe('krebs');
    expect(partFromId('o2')).toBeNull();
  });
});

describe('carga diferida', () => {
  it('cada práctica carga su vista 3D con import() y no importa el motor ni la vista directamente', () => {
    const labs: [string, string][] = [['OsmosisLab', 'OsmosisView3D'], ['MitosisLab', 'MitosisView3D'], ['DnaLab', 'DnaView3D'], ['DnaExtractionLab', 'ExtraccionView3D'], ['DnaExtractionLab', 'ComplementoView3D'], ['MendelLab', 'MendelView3D'], ['PhotoLab', 'FotosintesisView3D'], ['RespirationLab', 'RespiracionView3D']];
    for (const [lab, v] of labs) {
      const src = readFileSync(`src/labs/${lab}.tsx`, 'utf8');
      expect(src).toContain(`lazy(() => import('./lote3d2/${v}'))`);
      expect(src).not.toMatch(/from '\.\.\/three'|from '\.\/lote3d2\//);
    }
  });
});
