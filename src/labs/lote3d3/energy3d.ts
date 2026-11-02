/**
 * «energia» (lote 3D-3): la pista con colinas (montaña rusa) en 3D, la esfera en el mismo punto del modelo y barras 3D de
 * Ep, Ec y energía disipada siempre visibles. Funciones PURAS a partir de la MISMA corrida (src/models/energy.ts →
 * simulateTrack, trackHeight): la pista se dibuja con trackHeight(x, h₀, h_c) en metros reales y la esfera y las barras
 * usan el punto del modelo que muestra el banco. Escala FIJA por corrida: la energía total m·g·h₀ mide 1,2 m de barra.
 * La esfera se dibuja más grande (radio 0,1 m) para que se vea; su centro va sobre la pista.
 */
import { fmt } from '../../lib/format';
import { TRACK_X, trackHeight, type EnergyPoint } from '../../models/energy';
import type { SceneItem, Vec3 } from '../../three/scene';
import { energyBars } from './mech3d';

export const BAR_MAX = 1.2;
const BALL_R = 0.1;
const SEGMENTS = 48;

export interface EnergySceneInput {
  h0: number;
  hc: number;
  point: EnergyPoint;
  total: number;
  passesHill: boolean;
  stopX: number | null;
  done: boolean;
  mass: number;
  rolling: boolean;
}

/** Puntos del eje de la pista (x, altura) a lo largo de toda la pista. */
export function trackPoints(h0: number, hc: number, n = SEGMENTS): Vec3[] {
  return Array.from({ length: n + 1 }, (_, i) => { const x = (TRACK_X * i) / n; return [x, trackHeight(x, h0, hc), 0] as Vec3; });
}

export function energyScene(inp: EnergySceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const pts = trackPoints(inp.h0, inp.hc);
  const items: SceneItem[] = [
    { id: 'piso', kind: 'plane', center: [TRACK_X / 2, -0.02, -0.35], size: [TRACK_X + 0.8, 1.6], color: 'surface-3' },
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    items.push({ id: `riel-${i}`, kind: 'rod', from: pts[i], to: pts[i + 1], radius: 0.025, color: 'series-8', ...(i === 0 ? { label: `Salida (h₀ = ${fmt(inp.h0, 2)} m)` } : {}) });
  }
  // Postes cada 0,5 m hasta el piso.
  for (let i = 0; i <= 8; i++) {
    const x = i * 0.5, h = trackHeight(x, inp.h0, inp.hc);
    if (h > 0.03) items.push({ id: `poste-${i}`, kind: 'rod', from: [x, 0, 0], to: [x, h - 0.03, 0], radius: 0.012, color: 'ink-3' });
  }
  // La esfera rueda sobre la pista: su centro va un radio por encima (sobre la normal aproximada, vertical).
  const p = inp.point;
  items.push({ id: 'esfera', kind: 'sphere', center: [p.x, p.h + BALL_R, 0], radius: BALL_R, color: 'series-8', label: `${fmt(p.v, 2)} m/s` });
  items.push({ id: 'sombra', kind: 'ellipsoid', center: [p.x, 0.001, 0], radii: [BALL_R, 0.002, BALL_R], color: 'ink', opacity: 0.25 });
  // Barras de energía detrás del tramo final (plano, h = 0), de pie sobre el piso.
  items.push(...energyBars([3.05, 0, -0.85], [
    { id: 'ep', label: 'Ep', value: p.ep, color: 'fis' },
    { id: 'ec', label: 'Ec', value: p.ek, color: 'data' },
    { id: 'ed', label: 'Disipada', value: p.ef, color: 'bad' },
  ], inp.total, { maxHeight: BAR_MAX, width: 0.2, gap: 0.22 }));

  const pct = (v: number) => (inp.total > 0 ? Math.round((100 * Math.max(0, v)) / inp.total) : 0);
  let description = `Pista con colinas en 3D: salida a ${fmt(inp.h0, 2)} m y colina de ${fmt(inp.hc, 2)} m${inp.rolling ? '; la esfera rueda' : ''}. La esfera está a ${fmt(p.x, 2)} m del inicio y a ${fmt(p.h, 2)} m de altura, con rapidez ${fmt(p.v, 2)} m/s. Barras (la altura de la columna completa es la energía total, ${fmt(inp.total, 2)} J): Ep ${fmt(p.ep, 2)} J (${pct(p.ep)} %), Ec ${fmt(p.ek, 2)} J (${pct(p.ek)} %) y disipada ${fmt(p.ef, 2)} J (${pct(p.ef)} %); suman siempre la total.`;
  if (inp.done) description += inp.passesHill ? ' La esfera superó la colina.' : ' La esfera no alcanza la cima de la colina: se detiene cuando su energía cinética se agota.';
  const top = Math.max(inp.h0, inp.hc, BAR_MAX) + 0.2;
  return { items, extent: 0.5 * Math.hypot(TRACK_X + 0.6, top) + 0.2, target: [TRACK_X / 2, top / 2 - 0.1, -0.3], description };
}
