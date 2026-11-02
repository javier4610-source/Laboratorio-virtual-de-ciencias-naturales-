/**
 * «extraccion-adn» (actividad de extracción): el tubo de ensayo en 3D con las capas del protocolo y las hebras de ADN
 * precipitadas en la interfase. Función PURA a partir del MISMO estado del laboratorio: la etapa del montaje, las
 * fracciones del tubo que ocupan el filtrado y el alcohol (las del banco 2D) y el índice de rendimiento del modelo
 * calculado (el tamaño del precipitado crece con √índice, igual que en el banco 2D). La forma de las fibras es dibujo.
 */
import { seededRandom } from '../../models/math';
import { fmt } from '../../lib/format';
import type { SceneItem, Vec3 } from '../../three/scene';

export type ExtractionStage = 0 | 1 | 2 | 3 | 4;

export interface TubeInput {
  stage: ExtractionStage;
  /** Índice de rendimiento del modelo (0–100 u.a.). */
  yieldIndex: number;
  /** Fracción de la altura del tubo con filtrado y con alcohol (las del banco 2D). */
  filtrate: number;
  ethanol: number;
  fruitName: string;
  ethanolT: number;
  /** Texto de la etapa (el mismo del banco 2D) y aspecto del precipitado leído (solo al terminar). */
  stageText: string;
  appearance?: string | null;
}

/** Alto y radio interior del tubo (cm, tubo de ensayo de 16 × 150 mm aproximado). */
export const TUBE_H = 12;
export const TUBE_R = 0.8;
/** Número máximo de fibras dibujadas (con índice 100). */
export const MAX_FIBERS = 28;

/** Tamaño relativo del precipitado (0–1): √(índice/100), como el banco 2D. */
export const precipitateSize = (yieldIndex: number) => Math.sqrt(Math.min(1, Math.max(0, yieldIndex / 100)));
/** Fibras dibujadas en la interfase para un índice (proporcional al tamaño; 0 si no hay precipitado). */
export const fiberCount = (yieldIndex: number) => Math.round(MAX_FIBERS * precipitateSize(yieldIndex));

export function tubeScene(inp: TubeInput): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
  const items: SceneItem[] = [];
  const H = TUBE_H, R = TUBE_R;
  // Vidrio del tubo (fondo redondo) y su boca.
  items.push({ id: 'tubo', kind: 'rod', from: [0, 0, 0], to: [0, H, 0], radius: R + 0.08, color: 'ink-3', opacity: 0.16, label: 'Tubo de ensayo' });
  items.push({ id: 'tubo-fondo', kind: 'sphere', center: [0, 0, 0], radius: R + 0.08, color: 'ink-3', opacity: 0.16 });
  const yF = inp.stage >= 2 ? inp.filtrate * H : 0;
  const yE = inp.stage >= 3 ? yF + inp.ethanol * H : yF;
  if (inp.stage >= 2) {
    items.push({ id: 'filtrado', kind: 'rod', from: [0, 0, 0], to: [0, yF, 0], radius: R, color: '#9fd0dc', opacity: 0.75, label: 'Filtrado (agua, sal, detergente y ADN disuelto)' });
    items.push({ id: 'filtrado-fondo', kind: 'sphere', center: [0, 0, 0], radius: R, color: '#9fd0dc', opacity: 0.75 });
  }
  if (inp.stage >= 3) items.push({ id: 'alcohol', kind: 'rod', from: [0, yF, 0], to: [0, yE, 0], radius: R, color: '#cfe3ef', opacity: 0.45, label: `Alcohol frío (${fmt(inp.ethanolT, 0)} °C)` });

  const size = precipitateSize(inp.yieldIndex);
  const nFib = inp.stage >= 3 ? fiberCount(inp.yieldIndex) : 0;
  // En la etapa 4 casi todo el ADN quedó enrollado en la varilla: en la interfase quedan unas pocas fibras.
  const left = inp.stage >= 4 ? Math.round(nFib * 0.2) : nFib;
  const rnd = seededRandom(7);
  for (let k = 0; k < left; k++) {
    const a = rnd() * 2 * Math.PI, r = rnd() * (R - 0.2);
    const x = r * Math.cos(a), z = r * Math.sin(a);
    const rise = (0.4 + rnd() * 1.6) * (0.4 + 0.6 * size);
    const tilt = rnd() * 2 * Math.PI, lean = 0.15 + rnd() * 0.35;
    const to: Vec3 = [Math.max(-R + 0.1, Math.min(R - 0.1, x + lean * Math.cos(tilt))), yF + rise, Math.max(-R + 0.1, Math.min(R - 0.1, z + lean * Math.sin(tilt)))];
    items.push({ id: `fibra-${k}`, kind: 'rod', from: [x, yF - 0.05, z], to, radius: 0.035, color: '#cbc4ae', ...(k === 0 ? { label: 'ADN precipitado (hebras blancas)' } : {}) });
  }
  if (inp.stage >= 4) {
    items.push({ id: 'varilla', kind: 'rod', from: [0.15, yF + 0.6, 0], to: [0.45, H + 2.5, 0], radius: 0.1, color: 'ink-3', opacity: 0.7, label: 'Varilla de vidrio' });
    if (nFib > 0) items.push({ id: 'ovillo', kind: 'ellipsoid', center: [0.2, yF + 1.1, 0], radii: [0.12 + 0.5 * size, 0.18 + 0.6 * size, 0.12 + 0.5 * size], color: '#cbc4ae', label: 'ADN enrollado' });
  }

  let description = `Tubo de ensayo en 3D (unos ${fmt(H, 0)} cm de alto). Etapa: ${inp.stageText.toLowerCase()}. `;
  if (inp.stage < 2) description += 'El tubo todavía está vacío: el extracto de la fruta se prepara en la bolsa y se filtra al tubo.';
  else if (inp.stage === 2) description += `Abajo, el filtrado de ${inp.fruitName.toLowerCase()} con el ADN disuelto ocupa ${fmt(inp.filtrate * 100, 0)} % del tubo; falta el alcohol.`;
  else {
    description += `Dos capas: el filtrado abajo (${fmt(inp.filtrate * 100, 0)} % del tubo) y el alcohol menos denso encima (${fmt(inp.ethanol * 100, 0)} %). `;
    description += nFib === 0 ? 'En la interfase casi no aparece precipitado.' : `En la interfase el ADN, poco soluble en alcohol, sube en ${nFib} hebras blancas dibujadas (más hebras = mayor índice de rendimiento del modelo).`;
    if (inp.stage >= 4) description += ' La varilla enrolló el ADN de la interfase en un ovillo.';
    if (inp.appearance) description += ` Aspecto leído: ${inp.appearance.toLowerCase()}.`;
  }
  return { items, extent: 8.5, target: [0, H / 2 + 0.8, 0], description };
}
