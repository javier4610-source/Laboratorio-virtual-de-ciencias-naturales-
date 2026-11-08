import { describe, expect, it } from 'vitest';
import type { ArrowItem, BoxItem, EllipsoidItem, ParticlesItem, RodItem, SceneItem } from '../../src/three/scene';
import { arcPoints, mixHex, polyRods, rgbHex } from '../../src/labs/lote3d5/common';
import { crestPositions, ropePoints, ropeScene, Y_PER_CM } from '../../src/labs/lote3d5/rope3d';
import { airColumn, drawnAmplitude, nodesAndAntinodes, soundScene, standingShape } from '../../src/labs/lote3d5/sound3d';
import { beamRadius, opticsScene, rayDirections } from '../../src/labs/lote3d5/optics3d';
import { brightFringes, interferenceScene, screenProfile, SCREEN_HALF } from '../../src/labs/lote3d5/interference3d';
import { jetPoints, jetsScene, layers, P_ARROW, probeScene } from '../../src/labs/lote3d5/pressure3d';
import { buoyancyScene, CUP_R, N_ARROW, surfaceHeights } from '../../src/labs/lote3d5/buoyancy3d';
import { CYL_AREA, densityScene, equalMassSide, ROW_MASS, waterHeight } from '../../src/labs/lote3d5/density3d';
import { displacement, findRope, ropeWave } from '../../src/models/waves';
import { endCorrection, resonanceLengths, tubeResponse } from '../../src/models/soundResonance';
import { findMedium, refract } from '../../src/models/optics';
import { apertureFor, findSource, fringeSpacingSmallAngle } from '../../src/models/interference';
import { CV_ORIFICE, G, HOLE_HEIGHTS, findLiquid, hydrostaticGauge, jet, simulateProbe } from '../../src/models/pressure';
import { findObject, hydrometerStemDepth, liquidVolume, simulateBuoyancy, type BuoyLiquidId } from '../../src/models/buoyancy';
import { MATERIALS, findSample, simulateDensity } from '../../src/models/density';

const byId = <T extends SceneItem = SceneItem>(items: SceneItem[], id: string) => items.find((i) => i.id === id) as T | undefined;

describe('piezas comunes', () => {
  it('colores, varillas y arcos', () => {
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(rgbHex([1, 0, 0.5])).toBe('#ff0080');
    expect(polyRods('a', [[0, 0, 0], [1, 0, 0], [1, 0, 0], [2, 0, 0]], 0.1, 'ink')).toHaveLength(2);
    const arc = arcPoints([0, 0, 0], 2, [1, 0, 0], [0, 1, 0], 0, Math.PI / 2, 4);
    expect(arc[0][0]).toBeCloseTo(2, 12);
    expect(arc[4][1]).toBeCloseTo(2, 12);
  });
});

describe('ondas: la cuerda es la del modelo en el mismo instante', () => {
  const res = ropeWave({ ropeId: 'media', tension: 20, frequency: 2, amplitude: 4 });
  const input = { ropeId: 'media', ropeName: findRope('media').name, tension: 20, frequency: 2, amplitude: 4, wavelength: res.wavelength, speed: res.speed, t: 0.37, markA: 1, markB: 6, revealed: false };
  it('y(x, t) del modelo, ampliado ×20; crestas separadas λ', () => {
    const pts = ropePoints(4, res.wavelength, 2, 0.37);
    for (const p of pts) expect(p[1]).toBeCloseTo(displacement(p[0], 0.37, 4, res.wavelength, 2) * Y_PER_CM, 12);
    const crests = crestPositions(res.wavelength, 2, 0.37);
    expect(crests.length).toBeGreaterThanOrEqual(2);
    for (const x of crests) expect(displacement(x, 0.37, 4, res.wavelength, 2)).toBeCloseTo(4, 9);
    for (let i = 1; i < crests.length; i++) expect(crests[i] - crests[i - 1]).toBeCloseTo(res.wavelength, 9);
  });
  it('el punto marcado sube y baja en x = 3 m; λ oculta hasta medir', () => {
    const s = ropeScene(input);
    const p = byId(s.items, 'punto')!;
    expect(p.kind === 'sphere' && p.center[0]).toBe(3);
    expect(s.markY).toBeCloseTo(displacement(3, 0.37, 4, res.wavelength, 2) * Y_PER_CM, 12);
    expect(s.description).toContain('queda oculta');
    expect(s.description).not.toContain('La longitud de onda del modelo');
    expect(res.wavelength).toBeCloseTo(5, 12);
    expect(ropeScene({ ...input, revealed: true }).description).toContain('La longitud de onda del modelo es 5,00 m');
  });
});

describe('sonido: la onda estacionaria del tubo es la del banco', () => {
  const f = 512, temp = 28, D = 3.5;
  it('cerrado: nodo de desplazamiento en el agua y vientre en la boca efectiva cuando hay resonancia', () => {
    const L = resonanceLengths(f, temp, D, 'cerrado', 5, 100)[1];
    const r = tubeResponse({ f, tempC: temp, lengthCm: L, diameterCm: D, type: 'cerrado', source: 'generador' });
    const e = endCorrection(D);
    const [y0, y1] = airColumn('cerrado', L);
    expect(standingShape('cerrado', y0, L, r.k, e).s).toBeCloseTo(0, 12);
    expect(Math.abs(standingShape('cerrado', y0, L, r.k, e).p)).toBeCloseTo(1, 12);
    expect(Math.abs(standingShape('cerrado', y1 + e, L, r.k, e).s)).toBeCloseTo(1, 6);
    const nv = nodesAndAntinodes('cerrado', L, r.k, e);
    expect(nv.nodes[0]).toBeCloseTo(y0, 9);
    // Nodos separados λ/2.
    expect(nv.nodes[1] - nv.nodes[0]).toBeCloseTo((Math.PI / r.k) * 100, 9);
    for (const y of nv.nodes) expect(standingShape('cerrado', y, L, r.k, e).s).toBeCloseTo(0, 9);
    for (const y of nv.antinodes) expect(Math.abs(standingShape('cerrado', y, L, r.k, e).s)).toBeCloseTo(1, 9);
    // En resonancia el refuerzo llega al tope: amplitud dibujada 100 % con el generador.
    expect(drawnAmplitude(r.response, 1)).toBe(1);
  });
  it('abierto: vientres cerca de las dos bocas; sin sonido el aire está quieto', () => {
    const L = resonanceLengths(f, temp, D, 'abierto', 20, 100)[0];
    const r = tubeResponse({ f, tempC: temp, lengthCm: L, diameterCm: D, type: 'abierto', source: 'generador' });
    const e = endCorrection(D);
    expect(Math.abs(standingShape('abierto', L + e, L, r.k, e).s)).toBeCloseTo(1, 12);
    expect(Math.abs(standingShape('abierto', -e, L, r.k, e).s)).toBeCloseTo(1, 6);
    const silent = soundScene({ type: 'abierto', lengthCm: L, diameterCm: D, k: r.k, endCm: e, response: r.response, env: 0, f, tempC: temp, source: 'generador', t: 0 });
    expect(silent.amp).toBe(0);
    for (const l of silent.layers) expect(Math.abs(l.dy)).toBe(0);
    expect(silent.description).toContain('en silencio');
    const on = soundScene({ type: 'abierto', lengthCm: L, diameterCm: D, k: r.k, endCm: e, response: r.response, env: 1, f, tempC: temp, source: 'generador', t: 0 });
    expect(Math.max(...on.layers.map((l) => Math.abs(l.dy)))).toBeGreaterThan(1.2);
    expect(on.items.some((i) => i.id === 'nodo-0')).toBe(true);
  });
});

describe('optica: rayos del modelo', () => {
  it('Snell en las direcciones dibujadas, grosor de Fresnel y ángulos solo al medir', () => {
    const r = refract('aire', 'agua', 40);
    const d = rayDirections(40, r.refraction);
    expect(r.n1 * d.incident[0]).toBeCloseTo(r.n2 * d.refracted![0], 9);
    expect(d.reflected[0]).toBeCloseTo(d.incident[0], 12);
    expect(d.reflected[1]).toBeCloseTo(-d.incident[1], 12);
    const base = { m1: 'aire', m2: 'agua', name1: 'Aire', name2: 'Agua', n1: r.n1, n2: r.n2, angle: 40, refraction: r.refraction, reflectance: r.reflectance, transmittance: r.transmittance, readReflection: 40, readRefraction: r.refraction };
    const s = opticsScene({ ...base, measured: false });
    expect(byId<RodItem>(s.items, 'reflejado')!.radius).toBeCloseTo(beamRadius(r.reflectance), 12);
    expect(byId<RodItem>(s.items, 'refractado')!.radius).toBeCloseTo(beamRadius(r.transmittance), 12);
    expect(s.items.some((i) => i.id.startsWith('arco'))).toBe(false);
    expect(s.items.every((i) => i.kind !== 'rod' || Math.abs(i.to[2]) < 1e-12 || i.id.startsWith('rotulo'))).toBe(true);
    const m = opticsScene({ ...base, measured: true });
    expect(m.items.find((i) => i.id === 'arco-2')!.label).toBe('θ₂ = 28,8°');
  });
  it('reflexión total interna: no hay rayo refractado', () => {
    const r = refract('agua', 'aire', 60);
    expect(r.refraction).toBeNull();
    const s = opticsScene({ m1: 'agua', m2: 'aire', name1: 'Agua', name2: 'Aire', n1: findMedium('agua').n, n2: 1.0003, angle: 60, refraction: null, reflectance: 1, transmittance: 0, measured: false, readReflection: 60, readRefraction: null });
    expect(byId(s.items, 'refractado')).toBeUndefined();
    expect(byId(s.items, 'reflejado')!.label).toBe('Reflexión total');
    expect(s.description).toContain('Reflexión total interna');
  });
});

describe('interferencia: el patrón de la pantalla es el del modelo', () => {
  const src = findSource('rojo');
  it('doble rendija: franjas separadas λ·L/d', () => {
    const ap = apertureFor({ kind: 'doble', a_um: 50, d_um: 250, D_um: 100, gratingId: 'r600' });
    const prof = screenProfile(ap, src, 100, 15, 300);
    const fr = brightFringes(prof).filter((y) => Math.abs(y) < 8);
    const gaps = fr.slice(1).map((y, i) => y - fr[i]);
    const mean = gaps.reduce((a, b) => a + b, 0) / gaps.length;
    const dy = fringeSpacingSmallAngle(650e-9, 1, 250e-6) * 1000; // mm
    expect(dy).toBeCloseTo(2.6, 9);
    expect(Math.abs(mean - dy)).toBeLessThan(0.1);
    // La escena dibuja la misma ventana ampliada: la franja central (y = 0) en z = 0 y el borde en z = ±SCREEN_HALF.
    const s = interferenceScene({ on: true, kind: 'doble', kindName: 'Doble rendija', source: src, ap, L_cm: 100, half_mm: 15, viewName: '±15 mm', exposure: 8, t: 0 });
    const strips = s.items.filter((i): i is BoxItem => i.kind === 'box' && i.id.startsWith('franja-'));
    expect(strips).toHaveLength(96);
    expect(Math.max(...strips.map((b) => b.center[2] + b.size[2] / 2))).toBeCloseTo(SCREEN_HALF * 1.0002, 2);
    // Doblar L dobla la separación de las franjas.
    const fr2 = brightFringes(screenProfile(ap, src, 200, 15, 300)).filter((y) => Math.abs(y) < 8);
    expect((fr2[fr2.length - 1] - fr2[0]) / (fr2.length - 1)).toBeCloseTo(2 * mean, 1);
  });
  it('apagada: sin ondas ni patrón; la pantalla está a la distancia L del riel', () => {
    const ap = apertureFor({ kind: 'simple', a_um: 50, d_um: 250, D_um: 100, gratingId: 'r600' });
    const off = interferenceScene({ on: false, kind: 'simple', kindName: 'Rendija simple', source: src, ap, L_cm: 120, half_mm: 15, viewName: '±15 mm', exposure: 8, t: 0 });
    expect(off.items.some((i) => i.id.startsWith('franja') || i.id.startsWith('crestas'))).toBe(false);
    expect(byId<BoxItem>(off.items, 'pantalla')!.center[0] - byId<BoxItem>(off.items, 'diapositiva')!.center[0]).toBeCloseTo(120 / 20 + 0.06, 9);
    const circ = apertureFor({ kind: 'circular', a_um: 50, d_um: 250, D_um: 100, gratingId: 'r600' });
    const on = interferenceScene({ on: true, kind: 'circular', kindName: 'Agujero circular', source: findSource('desconocido'), ap: circ, L_cm: 100, half_mm: 15, viewName: '±15 mm', exposure: 8, t: 1 });
    expect(on.items.filter((i): i is EllipsoidItem => i.kind === 'ellipsoid' && i.id.startsWith('anillo'))).toHaveLength(48);
    // La λ del láser desconocido no aparece.
    expect(on.description).not.toContain('635');
  });
});

describe('presion: capas, sonda y chorros del modelo', () => {
  it('cada capa tiene ρ·g·h del modelo y la flecha de la membrana mide la presión del modelo', () => {
    const ls = layers(997, G, 32, 4);
    expect(ls[0].gauge).toBeCloseTo(hydrostaticGauge(997, 0.3, G), 9);
    expect(ls[ls.length - 1].gauge).toBeLessThan(ls[0].gauge);
    const probe = simulateProbe({ liquid: 'glicerina', depthCm: 20, orientationDeg: 90, altitudeM: 0, atmosphere: 'estandar' });
    const s = probeScene({ liquidName: 'Glicerina', rho: probe.rho, g: G, depth: 20, orientation: 90, gauge: probe.gauge, shownRise: probe.riseMm, done: true, riseReading: Math.round(probe.riseMm) });
    const p = byId<ArrowItem>(s.items, 'p')!;
    expect(Math.hypot(...p.vector)).toBeCloseTo(probe.gauge * P_ARROW, 9);
    // De lado: empuja en horizontal (−x).
    expect(p.vector[0]).toBeLessThan(0);
    expect(Math.abs(p.vector[1])).toBeLessThan(1e-9);
    // Desnivel del manómetro a escala real (mm → cm).
    const l = byId<RodItem>(s.items, 'columna-izq')!, r = byId<RodItem>(s.items, 'columna-der')!;
    expect(r.to[1] - l.to[1]).toBeCloseTo(probe.riseMm / 10, 9);
  });
  it('los chorros llegan a la bandeja al alcance del modelo y salen horizontales', () => {
    const jets = HOLE_HEIGHTS.map((y) => jet(y, 25, CV_ORIFICE, G));
    const j = jets[1];
    const pts = jetPoints(j, 1);
    expect(pts[pts.length - 1][1]).toBeCloseTo(0, 12);
    expect(pts[pts.length - 1][0] - pts[0][0]).toBeCloseTo(j.range, 9);
    // Pendiente inicial nula (salida horizontal) y parábola: y = y₀·(1 − (x/R)²).
    expect(pts[0][1]).toBe(j.holeCm);
    const s = jetsScene({ level: 25, g: G, rho: findLiquid('dulce').rho, holes: [true, true, true, true], jets, front: 1, taped: false, done: true, ranges: jets.map((x) => x.range) });
    expect(s.items.filter((i) => i.id.startsWith('chorro-'))).toHaveLength(4);
    const taped = jetsScene({ level: 25, g: G, rho: 997, holes: [true, true, true, true], jets, front: 0, taped: true, done: false, ranges: [null, null, null, null] });
    expect(taped.items.some((i) => i.id.startsWith('chorro-'))).toBe(false);
    expect(taped.description).toContain('tapados');
  });
});

describe('flotacion: el objeto donde lo pone el modelo', () => {
  const run = (objectId: string, liquid: BuoyLiquidId, descent: number, setup: 'rebose' | 'balanza', done = false) => {
    const m = simulateBuoyancy({ objectId, liquid, spoons: 0, descent, setup });
    return { m, s: buoyancyScene({ obj: findObject(objectId), liquidName: 'Agua dulce', liquidColor: '#5aa9de', liquidOpacity: 0.42, rhoLiq: m.rhoLiq, setup, volume: liquidVolume(liquid, 0), descent, depth: m.depth, vSub: m.vSub, fraction: m.fraction, weight: m.weight, buoyancy: m.buoyancy, apparent: m.apparent, floating: m.floating, submerged: m.submerged, levelRise: m.levelRise, stemDepth: hydrometerStemDepth(m.rhoLiq / 1000), done }) };
  };
  it('la madera flota: línea de flotación en la superficie, E = P y sin tensión', () => {
    const { m, s } = run('madera', 'dulce', 6, 'rebose');
    expect(m.floating).toBe(true);
    expect(s.surface - s.base).toBeCloseTo(m.depth, 12);
    expect(byId<BoxItem>(s.items, 'flotacion')!.center[1]).toBeCloseTo(s.surface, 12);
    const P = byId<ArrowItem>(s.items, 'P')!, E = byId<ArrowItem>(s.items, 'E')!;
    expect(E.vector[1]).toBeCloseTo(-P.vector[1], 12);
    expect(byId(s.items, 'T')).toBeUndefined();
    // Colector: el volumen sumergido del modelo.
    const cup = byId<RodItem>(s.items, 'desalojado')!;
    expect((cup.to[1] - cup.from[1]) * Math.PI * CUP_R ** 2).toBeCloseTo(m.vSub, 9);
  });
  it('el hierro cuelga sumergido: T = P − E del modelo; en el vaso sobre la balanza sube el nivel', () => {
    const { m, s } = run('hierro', 'dulce', 8, 'balanza');
    expect(m.submerged).toBe(true);
    const T = byId<ArrowItem>(s.items, 'T')!;
    expect(T.vector[1]).toBeCloseTo((m.weight - m.buoyancy) * N_ARROW, 9);
    expect(s.surface).toBeCloseTo(surfaceHeights('balanza', liquidVolume('dulce', 0), m.levelRise).now, 12);
    expect(s.surface).toBeGreaterThan(surfaceHeights('balanza', liquidVolume('dulce', 0), 0).initial);
    expect(byId(s.items, 'flotacion')).toBeUndefined();
  });
});

describe('densidad: probeta a escala y cubos de igual masa', () => {
  it('el agua sube el volumen sumergido; el corcho flota con la fracción del modelo', () => {
    expect(waterHeight(CYL_AREA)).toBeCloseTo(1, 12);
    const r = simulateDensity({ materialId: 'corcho', side: 3, initialWater: 50, pushUnder: false });
    const s = densityScene({ material: findSample('corcho'), side: 3, station: 2, weighed: true, massReading: r.massReading, level: r.finalWaterReading!, overflow: false, floats: r.floats, pushUnder: false, submergedFraction: r.submergedFraction, initialWater: 50 });
    expect(s.water - s.cubeBottom).toBeCloseTo(3 * r.submergedFraction, 12);
    const sunk = densityScene({ material: findSample('aluminio'), side: 2, station: 2, weighed: true, massReading: 21.6, level: 58, overflow: false, floats: false, pushUnder: false, submergedFraction: 1, initialWater: 50 });
    const before = densityScene({ material: findSample('aluminio'), side: 2, station: 1, weighed: true, massReading: 21.6, level: 50, overflow: false, floats: false, pushUnder: false, submergedFraction: 1, initialWater: 50 });
    expect(sunk.water - before.water).toBeCloseTo(waterHeight(8), 9);
    expect(sunk.description).toContain('el agua subió de 50,0 a 58,0 mL');
  });
  it('cada cubo de la fila tiene 50 g: arista³·ρ = 50 g', () => {
    const s = densityScene({ material: findSample('hierro'), side: 2, station: 0, weighed: false, massReading: null, level: 50, overflow: false, floats: false, pushUnder: false, submergedFraction: 1, initialWater: 50 });
    for (const m of MATERIALS) {
      const b = byId<BoxItem>(s.items, `fila-${m.id}`)!;
      expect(b.size[0] ** 3 * m.density).toBeCloseTo(ROW_MASS, 9);
      expect(b.size[0]).toBeCloseTo(equalMassSide(ROW_MASS, m.density), 12);
    }
    expect(s.description).toContain('sobre la mesa');
    const particles = s.items.filter((i): i is ParticlesItem => i.kind === 'particles');
    expect(particles).toHaveLength(0);
  });
});
