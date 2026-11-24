/**
 * «agua» (lote 3D-7): el tramo de río aguas abajo del vertimiento, en 3D. Funciones PURAS con el MISMO resultado del
 * modelo (src/models/waterQuality.ts → simulateRiver y oxygenProfile, Streeter–Phelps) y la misma fase del banco:
 *   - el río va del km −2 al km 30 (0,8 unidades de la escena por km); el vertimiento está en el km 0 y el punto de
 *     muestreo, en la distancia elegida;
 *   - cuando el banco ya midió (y muestra la curva de oxígeno), cada tramo de 0,5 km se colorea con el oxígeno disuelto
 *     del perfil del modelo en ese punto (escala FIJA: 0 mg/L rojo oscuro, 2 rojo, 4 naranja, 6 amarillo verdoso, 8 o más
 *     azul) y, sobre la orilla de atrás, la curva de Streeter–Phelps se levanta como una cerca cuya altura es el oxígeno
 *     (1 mg/L = 0,55 unidades) junto a la línea de referencia de 4 mg/L; se marca el punto crítico del modelo;
 *   - en el punto de muestreo, una bandeja con una cuenta por cada familia de macroinvertebrados que encontró el
 *     BMWP/Col del modelo, coloreada por su puntaje (7 a 10 sensibles, 4 a 6 intermedias, 1 a 3 tolerantes).
 * Antes de medir el río tiene un solo color (sin datos) y no hay curva, como el banco. Dibujo: forma del cauce, orillas,
 * la pluma del vertimiento (se desvanece como en el banco, e^(−km/9)) y las formas.
 */
import { fmt } from '../../lib/format';
import { RANGES, type Family, type WaterResult } from '../../models/waterQuality';
import type { SceneItem, Vec3 } from '../../three/scene';
import { polyRods } from '../lote3d5/common';
import { odColor, OD_SCALE_TEXT } from './common';

export const KM_UNIT = 0.8;
export const OD_UNIT = 0.55;
const KM0 = RANGES.distance[0], KM1 = RANGES.distance[1];
const RIVER_W = 3.6;
const FENCE_Z = -RIVER_W / 2 - 1.2;
export const kmX = (km: number) => km * KM_UNIT;
/** Altura de la cerca de oxígeno para una concentración (mg/L). */
export const fenceY = (od: number) => 0.1 + Math.max(0, od) * OD_UNIT;
export const familyColor = (f: Family) => (f.score >= 7 ? 'ok' : f.score >= 4 ? 'warn' : 'bad') as 'ok' | 'warn' | 'bad';

/** Oxígeno del perfil en el km dado (interpolación lineal entre los puntos del perfil del modelo). */
export function profileAt(profile: readonly { x: number; od: number }[], km: number): number {
  if (!profile.length) return NaN;
  if (km <= profile[0].x) return profile[0].od;
  for (let i = 1; i < profile.length; i++) {
    if (km <= profile[i].x) {
      const a = profile[i - 1], b = profile[i];
      return a.od + ((b.od - a.od) * (km - a.x)) / (b.x - a.x || 1);
    }
  }
  return profile[profile.length - 1].od;
}

export interface WaterSceneInput {
  res: WaterResult;
  profile: readonly { x: number; od: number }[];
  distance: number;
  dischargeFlow: number;
  sourceId: string;
  measured: boolean;
  sampling: boolean;
  /** Lectura de oxígeno de la sonda del banco (solo con measured). */
  odReading: number;
}

/**
 * Encuadre en pantallas angostas (≤ 600 px). De frente, los 32 km del río solo caben a lo ancho de un lienzo casi
 * cuadrado si se ven diminutos. Aquí la cámara mira el río en diagonal desde aguas arriba: el vertimiento, el muestreo
 * cercano y el punto crítico quedan en primer plano y el resto del tramo se aleja en perspectiva, sin salir del cuadro
 * (no se oculta ningún tramo ni dato: una prueba unitaria, tests/unit/encuadreAngosto.test.ts, lo verifica en las
 * condiciones extremas; con + se acerca).
 */
export const NARROW_FRAME = { extent: 7.8, target: [6, 0.5, 0] as Vec3, orbit: { yaw: -1, pitch: 0.5 } };

export function waterScene(inp: WaterSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3; orbit: { yaw: number; pitch: number } }; description: string; segments: { km: number; od: number }[] } {
  const { res } = inp;
  const items: SceneItem[] = [
    { id: 'orillas', kind: 'plane', center: [kmX((KM0 + KM1) / 2), -0.05, -0.6], size: [kmX(KM1 - KM0) + 3, 11], color: '#a9cf8c' },
  ];
  // Cauce en tramos de 0,5 km: con color del oxígeno del modelo cuando ya se midió.
  const segments: { km: number; od: number }[] = [];
  for (let km = KM0; km < KM1 - 1e-9; km += 0.5) {
    const mid = km + 0.25;
    const od = profileAt(inp.profile, mid);
    segments.push({ km: mid, od });
    items.push({ id: `rio-${km.toFixed(1)}`, kind: 'box', center: [kmX(mid), 0.05, 0], size: [kmX(0.5) + 0.01, 0.12, RIVER_W], color: inp.measured ? odColor(od) : '#5f9fcf',
      ...(km === KM0 ? { label: inp.measured ? `Río coloreado por el oxígeno disuelto del modelo (${OD_SCALE_TEXT})` : 'Río (el color del oxígeno aparece al medir)', tag: '' } : {}) });
  }
  items.push({ id: 'corriente', kind: 'arrow', from: [kmX(KM0) - 0.2, 0.5, RIVER_W / 2 + 0.9], vector: [3.2, 0, 0], radius: 0.1, color: 'ink-2', label: 'Sentido de la corriente', tag: '' });
  // Vertimiento en el km 0: tubo desde la orilla y pluma que se diluye aguas abajo (dibujo, como el banco).
  if (inp.dischargeFlow > 0) {
    items.push({ id: 'tubo', kind: 'rod', from: [0, 0.5, RIVER_W / 2 + 2.2], to: [0, 0.3, RIVER_W / 2 - 0.2], radius: 0.28, color: '#7d8a8e', label: `Vertimiento: ${fmt(inp.dischargeFlow, 0)} L/s (${res.source.name.toLowerCase()})`, tag: 'Vertimiento' });
    const plumeColor = inp.sourceId === 'domestico' ? '#6b5a3a' : inp.sourceId === 'bananera' ? '#9b7a4c' : '#7d8a74';
    const strength = Math.min(0.75, 0.15 + res.wasteFraction * 3);
    const pts: Vec3[] = [];
    for (let km = 0; km < 12; km += 0.25) {
      const n = Math.round(6 * strength * Math.exp(-km / 9) * 2);
      for (let k = 0; k < n; k++) pts.push([kmX(km) + 0.1 * k, 0.16, RIVER_W / 2 - 0.3 - (0.25 + 0.6 * km / 12) * (k + 1) * 0.35]);
    }
    if (pts.length) items.push({ id: 'pluma', kind: 'particles', points: pts, radius: 0.09, color: plumeColor as `#${string}`, opacity: 0.8, label: 'Pluma del vertimiento (dibujo)', tag: '' });
  }
  // Punto de muestreo.
  const sx = kmX(inp.distance);
  items.push(
    { id: 'estaca', kind: 'rod', from: [sx, 0, RIVER_W / 2 + 0.4], to: [sx, 2.4, RIVER_W / 2 + 0.4], radius: 0.06, color: 'ink' },
    { id: 'bandera', kind: 'box', center: [sx + 0.35, 2.2, RIVER_W / 2 + 0.4], size: [0.7, 0.4, 0.04], color: '#ffd54f',
      label: `Punto de muestreo: ${fmt(Math.abs(inp.distance), 1)} km ${inp.distance < 0 ? 'aguas arriba' : 'aguas abajo'}${inp.measured ? ` · O₂ ${fmt(inp.odReading, 2)} mg/L` : ''}`, tag: inp.measured ? `Muestra: ${fmt(inp.odReading, 1)} mg/L` : 'Muestreo' },
  );
  if (inp.measured) {
    // Cerca de oxígeno (curva de Streeter–Phelps del modelo) y referencia de 4 mg/L.
    const pts = inp.profile.map((p) => [kmX(p.x), fenceY(p.od), FENCE_Z] as Vec3);
    items.push(...polyRods('curva', pts, 0.07, 'series-1'));
    items.push({ id: 'curva-rot', kind: 'sphere', center: pts[pts.length - 1], radius: 0.08, color: 'series-1', label: 'Oxígeno disuelto a lo largo del tramo (modelo de Streeter–Phelps)', tag: 'O₂ del tramo' });
    items.push({ id: 'ref4', kind: 'rod', from: [kmX(KM0), fenceY(4), FENCE_Z], to: [kmX(KM1), fenceY(4), FENCE_Z], radius: 0.035, color: 'warn', label: 'Referencia para la fauna: 4 mg/L', tag: '4 mg/L' });
    items.push({ id: 'cerca-base', kind: 'rod', from: [kmX(KM0), 0.1, FENCE_Z], to: [kmX(KM1), 0.1, FENCE_Z], radius: 0.03, color: 'ink-3' });
    const xcVisible = inp.dischargeFlow > 0 && res.tc > 0 && res.xc <= KM1;
    if (xcVisible) {
      items.push({ id: 'critico', kind: 'arrow', from: [kmX(res.xc), fenceY(res.odMin) + 1.4, FENCE_Z], vector: [0, -1.2, 0], radius: 0.09, color: 'bad',
        label: `Punto crítico: ${fmt(res.xc, 1)} km, oxígeno mínimo ${fmt(res.odMin, 2)} mg/L`, tag: 'Punto crítico' });
    }
    // Bandeja con una cuenta por familia encontrada.
    const fam = res.bmwp.families;
    items.push({ id: 'bandeja', kind: 'box', center: [sx, 0.12, RIVER_W / 2 + 1.6], size: [2.4, 0.1, 1.2], color: '#f4f7f8', edges: true,
      label: `Macroinvertebrados: ${res.bmwp.n} familias, BMWP/Col ${res.bmwp.score} (clase ${res.bmwp.cls.roman}, ${res.bmwp.cls.quality.toLowerCase()})`, tag: `${res.bmwp.n} familias` });
    (['ok', 'warn', 'bad'] as const).forEach((c) => {
      const pts = fam.map((f, i) => ({ f, i })).filter(({ f }) => familyColor(f) === c).map(({ i }) => [sx - 1 + 0.3 * (i % 7), 0.28, RIVER_W / 2 + 1.25 + 0.3 * Math.floor(i / 7)] as Vec3);
      if (pts.length) items.push({ id: `familias-${c}`, kind: 'particles', points: pts, radius: 0.11, color: c, label: c === 'ok' ? 'Familias sensibles (puntaje 7 a 10)' : c === 'warn' ? 'Familias intermedias (4 a 6)' : 'Familias tolerantes (1 a 3)', tag: '' });
    });
  }
  const where = `${fmt(Math.abs(inp.distance), 1)} km ${inp.distance < 0 ? 'aguas arriba' : 'aguas abajo'}`;
  let description = `Tramo del ${res.river.short} en 3D, del km −2 al km 30, con ${inp.dischargeFlow > 0 ? `un vertimiento de ${fmt(inp.dischargeFlow, 0)} L/s (${res.source.name.toLowerCase()}) en el km 0` : 'el vertimiento cerrado'}; punto de muestreo a ${where}. `;
  if (!inp.measured) {
    description += inp.sampling ? 'Se está tomando la muestra.' : 'Aún no hay medición: el río tiene un solo color. Pulsa «Tomar muestra y medir» para ver el oxígeno del tramo.';
  } else {
    const lowest = segments.reduce((a, b) => (b.od < a.od ? b : a), segments[0]);
    const under4 = segments.filter((s) => s.od < 4).length * 0.5;
    description += `El color del río sigue el oxígeno disuelto del modelo de Streeter–Phelps (${OD_SCALE_TEXT}) y la cerca de la orilla de atrás lo levanta: el tramo más pobre está cerca del km ${fmt(lowest.km, 1)} con ${fmt(lowest.od, 1)} mg/L`
      + `${under4 > 0 ? `; ${fmt(under4, 1)} km del tramo quedan por debajo de 4 mg/L` : '; en ningún punto baja de 4 mg/L'}. `
      + `${inp.dischargeFlow > 0 && res.tc > 0 && res.xc <= KM1 ? `Punto crítico a ${fmt(res.xc, 1)} km (mínimo ${fmt(res.odMin, 2)} mg/L). ` : ''}`
      + `La sonda marca ${fmt(inp.odReading, 2)} mg/L en el punto de muestreo y la bandeja tiene ${res.bmwp.n} familias de macroinvertebrados (BMWP/Col ${res.bmwp.score}, clase ${res.bmwp.cls.roman}).`;
  }
  return { items, extent: 8, target: [kmX(14), 1, -0.5], narrow: NARROW_FRAME, description, segments };
}
