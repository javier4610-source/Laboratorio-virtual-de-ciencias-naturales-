/**
 * «optica» (lote 3D-5): el láser, la superficie entre los dos medios y los tres rayos en 3D. Funciones PURAS con el MISMO
 * resultado del modelo (src/models/optics.ts → refract): ángulo de reflexión = incidencia, ángulo de refracción de Snell
 * (o reflexión total interna), y fracciones de Fresnel reflejada y transmitida (grosor y opacidad de cada haz, como en el
 * banco). Lo que enseña el 3D: el rayo incidente, la normal, el reflejado y el refractado están en UN mismo plano (el
 * plano de incidencia), perpendicular a la superficie. Los ángulos solo se rotulan después de «Medir con el
 * transportador» (igual que el banco), con las lecturas del transportador.
 */
import { fmt } from '../../lib/format';
import type { SceneItem, Vec3 } from '../../three/scene';
import { arcPoints } from './common';

/** Color y opacidad de cada medio (los del banco, como «#rrggbb» + opacidad). */
export const MEDIUM_LOOK: Record<string, { color: `#${string}`; opacity: number }> = {
  aire: { color: '#c8e1f0', opacity: 0.06 },
  agua: { color: '#4696dc', opacity: 0.26 },
  aceite: { color: '#e8c33a', opacity: 0.3 },
  vidrio: { color: '#96d2c8', opacity: 0.32 },
  diamante: { color: '#d2dcf0', opacity: 0.5 },
  misterio: { color: '#aa8cd2', opacity: 0.3 },
};
export const BEAM_LEN = 3.4;
const LASER_D = 3.2;
const rad = (d: number) => (d * Math.PI) / 180;

/** Radio dibujado de un haz con la fracción `k` de la luz (0–1): el grosor sigue a Fresnel, como en el banco. */
export const beamRadius = (k: number) => 0.02 + 0.06 * Math.max(0, Math.min(1, k));

export interface OpticsSceneInput {
  m1: string; m2: string;
  name1: string; name2: string;
  n1: number; n2: number;
  angle: number;
  /** Ángulo de refracción del modelo (null = reflexión total interna). */
  refraction: number | null;
  reflectance: number;
  transmittance: number;
  measured: boolean;
  /** Lecturas del transportador (las del banco). */
  readReflection: number;
  readRefraction: number | null;
}

/** Direcciones (unitarias) de los tres rayos en el plano de incidencia xy (y hacia arriba = medio 1). */
export function rayDirections(angle: number, refraction: number | null): { incident: Vec3; reflected: Vec3; refracted: Vec3 | null } {
  const a = rad(angle);
  return {
    incident: [Math.sin(a), -Math.cos(a), 0],
    reflected: [Math.sin(a), Math.cos(a), 0],
    refracted: refraction === null ? null : [Math.sin(rad(refraction)), -Math.cos(rad(refraction)), 0],
  };
}

export function opticsScene(inp: OpticsSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const dir = rayDirections(inp.angle, inp.refraction);
  const from: Vec3 = [-dir.incident[0] * LASER_D, -dir.incident[1] * LASER_D, 0];
  const l1 = MEDIUM_LOOK[inp.m1] ?? MEDIUM_LOOK.aire, l2 = MEDIUM_LOOK[inp.m2] ?? MEDIUM_LOOK.aire;
  const items: SceneItem[] = [
    { id: 'medio-1', kind: 'box', center: [0, 1.9, 0], size: [8, 3.8, 5], color: l1.color, opacity: l1.opacity },
    { id: 'medio-2', kind: 'box', center: [0, -1.9, 0], size: [8, 3.8, 5], color: l2.color, opacity: Math.max(0.08, l2.opacity), edges: true },
    { id: 'superficie', kind: 'plane', center: [0, 0, 0], size: [8, 5], color: 'line-strong', opacity: 0.22 },
    // Rótulos de los medios en la esquina delantera (lejos de los rayos).
    { id: 'rotulo-1', kind: 'sphere', center: [-3.8, 0.3, 2.4], radius: 0.05, color: 'ink-2', label: inp.name1 },
    { id: 'rotulo-2', kind: 'sphere', center: [-3.8, -0.9, 2.4], radius: 0.05, color: 'ink-2', label: inp.name2 },
    { id: 'normal', kind: 'rod', from: [0, -3.6, 0], to: [0, 2.4, 0], radius: 0.018, color: 'ink-2' },
    { id: 'normal-arriba', kind: 'rod', from: [0, 2.4, 0], to: [0, 3.6, 0], radius: 0.018, color: 'ink-2', label: 'Normal' },
    { id: 'plano', kind: 'box', center: [0, 0, 0], size: [7.4, 7.2, 0.01], color: 'accent', opacity: 0.08, label: 'Plano de incidencia' },
    { id: 'laser', kind: 'rod', from: [from[0] - dir.incident[0] * 1.3, from[1] - dir.incident[1] * 1.3, 0], to: from, radius: 0.17, color: '#8d989c', label: 'Láser' },
    { id: 'incidente', kind: 'rod', from, to: [0, 0, 0], radius: beamRadius(1), color: '#e53935' },
    { id: 'punto', kind: 'sphere', center: [0, 0, 0], radius: 0.09, color: '#ff8a80' },
  ];
  if (inp.reflectance >= 0.002) {
    items.push({ id: 'reflejado', kind: 'rod', from: [0, 0, 0], to: [dir.reflected[0] * BEAM_LEN, dir.reflected[1] * BEAM_LEN, 0], radius: beamRadius(inp.reflectance), color: '#e53935', opacity: 0.35 + 0.65 * inp.reflectance, label: inp.refraction === null ? 'Reflexión total' : 'Reflejado' });
  }
  if (dir.refracted && inp.transmittance >= 0.002) {
    items.push({ id: 'refractado', kind: 'rod', from: [0, 0, 0], to: [dir.refracted[0] * BEAM_LEN, dir.refracted[1] * BEAM_LEN, 0], radius: beamRadius(inp.transmittance), color: '#e53935', opacity: 0.35 + 0.65 * inp.transmittance, label: 'Refractado' });
  }
  if (inp.measured) {
    const up: Vec3 = [0, 1, 0], down: Vec3 = [0, -1, 0], left: Vec3 = [-1, 0, 0], right: Vec3 = [1, 0, 0];
    items.push({ id: 'arco-1', kind: 'particles', points: arcPoints([0, 0, 0], 1.6, up, left, rad(inp.angle), 0, 14), radius: 0.035, color: 'fis', label: `θ₁ = ${fmt(inp.angle, 1)}°` });
    items.push({ id: 'arco-r', kind: 'particles', points: arcPoints([0, 0, 0], 0.9, up, right, rad(inp.angle), 0, 14), radius: 0.035, color: 'fis', label: `θᵣ = ${fmt(inp.readReflection, 1)}°` });
    if (inp.refraction !== null && inp.readRefraction !== null) {
      items.push({ id: 'arco-2', kind: 'particles', points: arcPoints([0, 0, 0], 1.1, down, right, rad(inp.refraction), 0, 14), radius: 0.035, color: 'data', label: `θ₂ = ${fmt(inp.readRefraction, 1)}°` });
    }
  }
  const nText = (id: string, n: number) => (id === 'misterio' ? '' : ` (n = ${fmt(n, 3)})`);
  const pct = (k: number) => `${fmt(k * 100, 1)} %`;
  const what = inp.refraction === null
    ? `Reflexión total interna: toda la luz vuelve al ${inp.name1.toLowerCase()} y no sale luz al segundo medio.`
    : `Se refleja el ${pct(inp.reflectance)} de la luz y pasa el ${pct(inp.transmittance)} al ${inp.name2.toLowerCase()}; el grosor de cada haz es proporcional a su fracción.`;
  const angles = !inp.measured
    ? 'Los ángulos aún no se han medido: pulsa «Medir con el transportador».'
    : `Transportador: reflexión ${fmt(inp.readReflection, 1)}°${inp.readRefraction === null ? '' : `, refracción ${fmt(inp.readRefraction, 1)}° (${inp.n2 > inp.n1 ? 'se acerca a la normal' : inp.n2 < inp.n1 ? 'se aleja de la normal' : 'no se desvía'})`}.`;
  const description = `Láser en 3D que pasa de ${inp.name1.toLowerCase()}${nText(inp.m1, inp.n1)} a ${inp.name2.toLowerCase()}${nText(inp.m2, inp.n2)} con ${fmt(inp.angle, 1)}° de incidencia, medidos desde la normal. `
    + `El rayo incidente, la normal, el rayo reflejado y el refractado están en el mismo plano (el plano de incidencia, sombreado), perpendicular a la superficie: gira la vista para comprobarlo. ${what} ${angles}`;
  return { items, extent: 4.4, target: [0, 0, 0], description };
}
