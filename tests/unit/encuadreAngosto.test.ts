import { describe, expect, it } from 'vitest';
import { projectPerspective, type SceneItem, type Vec3 } from '../../src/three/scene';
import { NARROW_FRAME, waterScene } from '../../src/labs/lote3d7/water3d';
import { antibodyScene, MAX_ANTIBODIES, populationScene } from '../../src/labs/immunity3d';
import { oxygenProfile, RANGES, simulateRiver } from '../../src/models/waterQuality';

/**
 * Encuadres de pantallas angostas (pulido tras el 3D completo): la cámara se acerca, pero ningún dato sale del lienzo.
 * El lienzo de una vista 3D a 390 px mide ≈ 316 × 284 px (Scene3D: alto = 0,9 × ancho); con la misma proporción, lo que
 * cabe aquí cabe en cualquier teléfono.
 */
const W = 316, H = 284;

/** Puntos que deben verse: esquinas de las cajas, extremos de varillas y flechas, centros y partículas. */
function keyPoints(it: SceneItem): Vec3[] {
  switch (it.kind) {
    case 'box': {
      const [cx, cy, cz] = it.center, [sx, sy, sz] = it.size;
      const out: Vec3[] = [];
      for (const a of [-1, 1]) for (const b of [-1, 1]) for (const c of [-1, 1]) out.push([cx + (a * sx) / 2, cy + (b * sy) / 2, cz + (c * sz) / 2]);
      return out;
    }
    case 'rod': return [it.from, it.to];
    case 'arrow': return [it.from, [it.from[0] + it.vector[0], it.from[1] + it.vector[1], it.from[2] + it.vector[2]]];
    case 'sphere': return [it.center];
    case 'particles': return [...it.points];
    default: return [];
  }
}

function outside(items: readonly SceneItem[], frame: { extent: number; target: Vec3; orbit: { yaw: number; pitch: number } }, skip: (id: string) => boolean) {
  const bad: string[] = [];
  for (const it of items) {
    if (skip(it.id)) continue;
    for (const p of keyPoints(it)) {
      const q = projectPerspective(p, { ...frame.orbit, zoom: 1 }, frame.target, frame.extent, W, H);
      if (!(q.x >= 0 && q.x <= W && q.y >= 0 && q.y <= H)) { bad.push(it.id); break; }
    }
  }
  return bad;
}

describe('encuadre angosto (≤ 600 px): más cerca y sin datos fuera del lienzo', () => {
  it('agua: los 32 km del río, la cerca de oxígeno, el punto crítico y el muestreo caben en todas las condiciones extremas', () => {
    for (const river of ['apartado', 'leon']) for (const source of ['domestico', 'bananera']) for (const riverFlow of [0.5, 3, 30]) for (const distance of [-2, 5, 30]) {
      const p = { river, source, riverFlow, dischargeFlow: 1000, riverTemp: 32 };
      const res = simulateRiver({ ...p, distance } as never);
      const profile = oxygenProfile(p as never, 129);
      const s = waterScene({ res, profile, distance, dischargeFlow: 1000, sourceId: source, measured: true, sampling: false, odReading: res.site.od });
      expect(s.narrow).toBe(NARROW_FRAME);
      // Las orillas (pasto de dibujo) pueden recortarse; todo lo demás no.
      expect(outside(s.items, s.narrow, (id) => id === 'orillas'), `${river}/${source}/${riverFlow}/${distance} km`).toEqual([]);
    }
    expect(RANGES.distance).toEqual([-2, 30]);
    // Más cerca que antes (13,5 con la vista de frente).
    expect(NARROW_FRAME.extent).toBeLessThan(13.5 * 0.6);
  });

  it('sistema inmune: las 400 personas y el anticuerpo más lejano caben, con la cámara más cerca que en la vista ancha', () => {
    const pob = populationScene({ S: 4000, I: 2000, R: 2000, V: 2000, day: 30 });
    expect(outside(pob.items, pob.narrow, (id) => id === 'suelo')).toEqual([]);
    expect(pob.narrow.extent).toBeLessThan(pob.extent);
    const ac = antibodyScene(20, 36);
    expect(ac.n).toBe(MAX_ANTIBODIES);
    expect(outside(ac.items, ac.narrow, () => false)).toEqual([]);
    expect(ac.narrow.extent).toBeLessThan(ac.extent);
  });
});
