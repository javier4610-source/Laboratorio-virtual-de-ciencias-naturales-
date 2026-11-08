/**
 * Ciclo del carbono en 3D (kit src/three). Funciones PURAS con los MISMOS datos y el MISMO modelo de cajas del
 * laboratorio (src/models/carbon.ts): un paisaje con la atmósfera arriba, las plantas y el suelo a la izquierda, el
 * yacimiento fósil bajo tierra y el océano (superficial y profundo) a la derecha. Cada reservorio es un cubo cuyo
 * VOLUMEN es proporcional al carbono que contiene (lado ∝ ∛PgC; para los reservorios con rango se usa el punto medio)
 * y la atmósfera crece con el año del escenario. Las flechas son los flujos: el ÁREA de su sección es proporcional al
 * flujo (radio ∝ √(PgC/año)); en verde los naturales brutos (que se compensan) y en rojo los causados por las personas
 * y los sumideros que los absorben. Las posiciones son un esquema, no un mapa.
 */
import { fmt } from '../lib/format';
import { A_1750, atmosphereRate, findReservoir, fossilAt, GROSS, ppmOf, type CarbonRun, type Scenario } from '../models/carbon';
import type { SceneItem, Vec3 } from '../three/scene';

export const K_SIDE = 1.8 / Math.cbrt(37100); // unidades por ∛PgC
export const K_FLUX_R = 0.012; // radio = K·√(PgC/año)
export const side = (pgc: number) => K_SIDE * Math.cbrt(pgc);
export const fluxRadius = (f: number) => K_FLUX_R * Math.sqrt(Math.max(0, f));

const POS = {
  atmosfera: [0, 2.3, 0] as Vec3,
  vegetacion: [-2.2, 0.5, 0] as Vec3,
  suelos: [-2.2, -0.75, 0] as Vec3,
  fosiles: [-0.5, -1.3, 0] as Vec3,
  'oceano-superficie': [1.9, -0.05, 0] as Vec3,
  'oceano-profundo': [1.9, -1.45, 0] as Vec3,
};

export interface CarbonSceneInput { run: CarbonRun; s: Scenario; year: number; mode: 'natural' | 'humano' }
export function carbonScene({ run, s, year, mode }: CarbonSceneInput): { items: SceneItem[]; extent: number; target: Vec3; description: string; atm: number } {
  const p = run.points.find((q) => q.year === Math.round(year)) ?? run.points[0];
  const items: SceneItem[] = [
    { id: 'suelo-plano', kind: 'plane', center: [-1.2, 0.0, 0], size: [3.4, 2.2], color: 'amb', opacity: 0.25 },
    { id: 'mar-plano', kind: 'plane', center: [1.9, 0.27, 0], size: [2.6, 2.2], color: 'series-5', opacity: 0.25 },
  ];
  const box = (id: keyof typeof POS, pgc: number, color: SceneItem['color'], label: string, tag: string, opacity = 0.85) =>
    items.push({ id, kind: 'box', center: POS[id], size: [side(pgc), side(pgc), side(pgc)], color, opacity, edges: true, label, tag });
  const A = mode === 'natural' ? A_1750 : p.A;
  box('atmosfera', A, 'info', mode === 'natural' ? `atmósfera en 1750: ${fmt(A, 0)} PgC (278 ppm)` : `atmósfera en ${p.year}: ${fmt(A, 0)} PgC (${fmt(p.ppm, 0)} ppm)`, 'atmósfera', 0.35);
  const R = (id: string) => findReservoir(id);
  box('vegetacion', R('vegetacion').mid, 'bio', `plantas: ${fmt(R('vegetacion').low, 0)}–${fmt(R('vegetacion').high, 0)} PgC`, 'plantas');
  box('suelos', R('suelos').mid, 'series-6', `suelos: ${fmt(R('suelos').low, 0)}–${fmt(R('suelos').high, 0)} PgC`, 'suelos');
  box('fosiles', R('fosiles').mid, 'ink-2', `combustibles fósiles: ≈ ${fmt(R('fosiles').low, 0)}–${fmt(R('fosiles').high, 0)} PgC`, 'fósiles');
  box('oceano-superficie', R('oceano-superficie').mid, 'series-5', `océano superficial: ≈ ${fmt(900, 0)} PgC`, 'océano');
  box('oceano-profundo', R('oceano-profundo').mid, 'series-2', `océano profundo: ≈ ${fmt(37100, 0)} PgC`, 'océano profundo', 0.6);

  const top = (id: keyof typeof POS, d = 1): Vec3 => [POS[id][0], POS[id][1] + (d * side(id === 'atmosfera' ? A : R(id).mid)) / 2, POS[id][2]];
  const bottomAtm = POS.atmosfera[1] - side(A) / 2;
  const arrow = (id: string, from: Vec3, to: Vec3, f: number, color: SceneItem['color'], label: string, tag: string) => {
    if (f <= 0.01) return;
    items.push({ id, kind: 'arrow', from, vector: [to[0] - from[0], to[1] - from[1], to[2] - from[2]], radius: fluxRadius(f), color, opacity: 0.9, label: `${label}: ${fmt(f, 1)} PgC/año`, tag });
  };
  if (mode === 'natural') {
    const v = top('vegetacion');
    arrow('fotosintesis', [-1.0, bottomAtm - 0.05, 0.35], [v[0] + 0.2, v[1] + 0.1, 0.35], GROSS.photosynthesis, 'ok', 'fotosíntesis (≈)', 'fotosíntesis');
    arrow('respiracion', [v[0] - 0.25, v[1] + 0.1, -0.35], [-1.1, bottomAtm - 0.05, -0.35], GROSS.respiration, 'series-3', 'respiración y descomposición (≈)', 'respiración');
    const o = top('oceano-superficie');
    arrow('oceano-entra', [1.0, bottomAtm - 0.05, 0.35], [o[0] - 0.15, o[1] + 0.1, 0.35], GROSS.oceanIn, 'ok', 'el océano absorbe (≈)', 'entra al mar');
    arrow('oceano-sale', [o[0] + 0.25, o[1] + 0.1, -0.35], [1.2, bottomAtm - 0.05, -0.35], GROSS.oceanOut, 'series-3', 'el océano libera (≈)', 'sale del mar');
  } else {
    const r = atmosphereRate(p.A, s, p.year);
    const f = top('fosiles');
    arrow('emision-fosil', [f[0], f[1] + 0.05, 0], [-0.25, bottomAtm - 0.05, 0], fossilAt(s, p.year), 'data', 'quema de combustibles fósiles', 'fósiles → aire');
    const v = top('vegetacion');
    arrow('deforestacion', [v[0] + 0.1, v[1] + 0.1, -0.3], [-0.9, bottomAtm - 0.05, -0.3], s.landUse, 'data', 'deforestación y cambio de uso del suelo', 'deforestación');
    arrow('sumidero-tierra', [-0.75, bottomAtm - 0.05, 0.35], [v[0] + 0.25, v[1] + 0.1, 0.35], r.land + s.reforest, 'ok', 'sumidero de las plantas y el suelo (más reforestación)', 'sumidero tierra');
    const o = top('oceano-superficie');
    arrow('sumidero-oceano', [0.9, bottomAtm - 0.05, 0], [o[0], o[1] + 0.1, 0], r.ocean, 'ok', 'sumidero del océano', 'sumidero océano');
  }
  const r = atmosphereRate(p.A, s, p.year);
  const description = mode === 'natural'
    ? `Ciclo natural antes de 1750: la fotosíntesis saca del aire ≈ ${GROSS.photosynthesis} PgC por año y la respiración y la descomposición lo devuelven; el océano absorbe y libera ≈ ${GROSS.oceanIn} PgC por año. Los flujos se compensan y la atmósfera (${fmt(A, 0)} PgC) casi no cambia. El océano profundo, ≈ 37 100 PgC, es el reservorio más grande: su cubo es el mayor.`
    : `Año ${p.year}: la atmósfera tiene ${fmt(p.A, 0)} PgC (${fmt(ppmOf(p.A), 0)} ppm). Entran ${fmt(r.emit, 1)} PgC por año de combustibles fósiles y deforestación; el océano absorbe ${fmt(r.ocean, 1)} y las plantas y el suelo ${fmt(r.land + s.reforest, 1)}. El aire ${r.net >= 0 ? 'gana' : 'pierde'} ${fmt(Math.abs(r.net), 1)} PgC por año.`;
  return { items, extent: 3.1, target: [0, 0, 0], description, atm: A };
}
