/**
 * «ecosistema» (lote 3D-7): el frasco cerrado en 3D, en centímetros. Funciones PURAS con el MISMO resultado del modelo
 * (src/models/ecosystem.ts → simulateEcosystem) y el MISMO instante del banco:
 *   - lo que hay en el frasco (ramitas de elodea y su tamaño, caracoles y guppys vivos o muertos, restos en el sedimento,
 *     color del agua por las microalgas) sale del estado del modelo que dibuja el banco en ese momento (amanecer o tarde
 *     del día que va pasando), con las mismas reglas de dibujo del banco;
 *   - la lámpara está encendida o apagada como en el banco; la flecha de luz es ∝ √(luz en el vidrio del modelo);
 *   - las flechas de O₂ y CO₂ resumen el día que se muestra: O₂ producido por la fotosíntesis bruta del modelo, CO₂ de la
 *     respiración de plantas y animales (respiración total menos la de los descomponedores) y CO₂ de los descomponedores
 *     del sedimento; su grosor es ∝ √(mg/L del día) con una escala FIJA (10 mg/L ≈ 0,47 cm de radio).
 * Los números (oxígeno, indicador, conteos y balances del día) solo aparecen en el texto cuando el banco ya midió, como
 * las lecturas del banco. Dibujo: formas, lugar de cada organismo, largo de las flechas y la lámpara.
 */
import { fmt } from '../../lib/format';
import { countOf, SPRIG_G, type EcoState } from '../../models/ecosystem';
import type { SceneItem, Vec3 } from '../../three/scene';
import { mixHex } from '../lote3d5/common';
import { hash01 } from '../lote3d6/common';
import { fatArrow, sqrtRadius } from './common';

export const JAR_R = 7;
export const SED_TOP = 2.4;
export const WATER_TOP = 18;
const JAR_TOP = 20.5;
/** Centímetros de la escena por centímetro de distancia real de la lámpara (dibujo). */
export const LAMP_K = 0.25;
/** Escala FIJA del grosor de las flechas de O₂ y CO₂: radio = 0,12 + 0,35·√(v / 10 mg/L), con tope en 40 mg/L. */
export const flowRadius = (mgL: number) => sqrtRadius(mgL, 10, 0.12, 0.35, 40);
/** Escala FIJA del grosor de la flecha de luz: radio = 0,1 + 0,4·√(PAR / 400), con tope en 1200 µmol/(m²·s). */
export const lightRadius = (par: number) => sqrtRadius(par, 400, 0.1, 0.4, 1200);

export interface EcoSceneInput {
  /** Estado del modelo que dibuja el banco en este instante. */
  vis: EcoState;
  plants: number;
  snails: number;
  fish: number;
  decomposers: boolean;
  /** Luz en el vidrio con la lámpara encendida (µmol/(m²·s)), distancia (cm) y si la lámpara alumbra ahora. */
  par: number;
  distance: number;
  lit: boolean;
  /** Copos de alimento que flotan (los del banco). */
  flakes: number;
  /** ¿Ya empezó la simulación? ¿Ya se midió? */
  started: boolean;
  done: boolean;
  /** Día que se muestra y su reloj («Día 3 · 18:00»), y balances del modelo de ese día (mg/L). */
  day: number;
  clock: string;
  gpp: number;
  respiration: number;
  decomposition: number;
  /** Lecturas del banco (solo se usan con done). */
  readings: { od: number; ph: number; indicator: string; snails: number; fish: number; elodea: number };
  readLabel: string;
}

/** Altura de una ramita (cm), con la misma regla del banco (125 px por ramita de SPRIG_G gramos, en 272 px de agua). */
export function sprigHeight(perSprig: number): number {
  const px = Math.max(30, Math.min(255, 125 * Math.sqrt(perSprig / SPRIG_G) * (perSprig / SPRIG_G > 1 ? 1.15 : 1)));
  return (px / 272) * (WATER_TOP - SED_TOP);
}

export function ecosystemScene(inp: EcoSceneInput): { items: SceneItem[]; extent: number; target: Vec3; narrow: { extent: number; target: Vec3 }; description: string; counts: { sprigs: number; snails: number; fish: number; deadFish: number; deadSnails: number; specks: number } } {
  const v = inp.vis;
  const sprigs = inp.plants > 0 && v.elodea > 0.3 ? inp.plants : 0;
  const perSprig = sprigs > 0 ? v.elodea / sprigs : 0;
  const health = Math.max(0, Math.min(1, (v.elodea / Math.max(0.1, inp.plants * SPRIG_G) - 0.55) / 0.45));
  const leaf = mixHex('#a39445', '#3f8f3a', health);
  const nSnails = Math.min(30, countOf(v.snails));
  const nFish = countOf(v.fish);
  const deadFish = Math.max(0, inp.fish - nFish);
  const deadSnails = Math.min(10, Math.max(0, inp.snails - nSnails));
  const specks = Math.min(80, Math.round(v.detritus / 4));
  const water = mixHex('#8fc8dc', '#4f9a2e', Math.min(0.62, v.algae / 18));

  const items: SceneItem[] = [
    { id: 'mesa', kind: 'plane', center: [-6, -0.02, 0], size: [40, 22], color: 'surface-3' },
    { id: 'frasco', kind: 'rod', from: [0, 0, 0], to: [0, JAR_TOP, 0], radius: JAR_R + 0.25, color: 'line-strong', opacity: 0.16, label: 'Frasco sellado (3 L)', tag: '' },
    { id: 'tapa', kind: 'rod', from: [0, JAR_TOP, 0], to: [0, JAR_TOP + 0.8, 0], radius: JAR_R - 0.6, color: '#9aa6ab' },
    { id: 'agua', kind: 'rod', from: [0, SED_TOP, 0], to: [0, WATER_TOP, 0], radius: JAR_R, color: water as `#${string}`, opacity: 0.32, label: v.algae > 3 ? 'Agua verdosa (microalgas)' : 'Agua', tag: '' },
    { id: 'sedimento', kind: 'rod', from: [0, 0.05, 0], to: [0, SED_TOP, 0], radius: JAR_R, color: inp.decomposers ? '#5a3d24' : '#d8c596', label: inp.decomposers ? 'Lodo de ciénaga con descomponedores' : 'Arena hervida, sin descomponedores', tag: inp.decomposers ? 'Lodo con descomponedores' : 'Arena sin descomponedores' },
  ];
  // Restos (detritos) sobre el sedimento: uno por cada 4 mg, como el banco.
  if (specks > 0) {
    const pts = Array.from({ length: specks }, (_, i) => {
      const a = 2 * Math.PI * hash01(i, 31), r = (JAR_R - 0.6) * Math.sqrt(hash01(i, 32));
      return [r * Math.cos(a), SED_TOP + 0.08, r * Math.sin(a)] as Vec3;
    });
    items.push({ id: 'detritos', kind: 'particles', points: pts, radius: 0.16, color: '#3d2a17', label: 'Restos en el sedimento (detritos)', tag: '' });
  }
  // Elodea: tallos con hojas, del tamaño que da la biomasa del modelo.
  if (sprigs > 0) {
    const h = sprigHeight(perSprig);
    const leaves: Vec3[] = [];
    for (let i = 0; i < sprigs; i++) {
      const a = 2 * Math.PI * (i / sprigs) + 0.4, r = 2.6 + 1.6 * hash01(i, 5);
      const x = r * Math.cos(a), z = r * Math.sin(a);
      const hi = h * (0.86 + ((i * 7) % 5) * 0.06);
      items.push({ id: `tallo-${i}`, kind: 'rod', from: [x, SED_TOP, z], to: [x + 0.3, SED_TOP + hi, z], radius: 0.09, color: leaf as `#${string}`, ...(i === 0 ? { label: `Elodea (${sprigs} ${sprigs === 1 ? 'ramita' : 'ramitas'})` } : {}) });
      const nl = Math.max(3, Math.round(hi / 0.8));
      for (let k = 1; k <= nl; k++) {
        const y = SED_TOP + (hi * k) / (nl + 0.5), ang = k * 2.1 + i;
        leaves.push([x + 0.3 * (k / nl) + 0.35 * Math.cos(ang), y, z + 0.35 * Math.sin(ang)]);
      }
    }
    items.push({ id: 'hojas', kind: 'particles', points: leaves, radius: 0.28, color: leaf as `#${string}` });
  }
  // Caracoles vivos: en el sedimento y en el vidrio; los muertos (conchas vacías), pálidos sobre el sedimento.
  if (nSnails > 0) {
    const pts = Array.from({ length: nSnails }, (_, i) => {
      const a = 2 * Math.PI * hash01(i, 11);
      const onGlass = i % 3 === 1;
      return (onGlass ? [(JAR_R - 0.55) * Math.cos(a), SED_TOP + 1.5 + 9 * hash01(i, 12), (JAR_R - 0.55) * Math.sin(a)] : [(JAR_R - 1.5) * Math.sqrt(hash01(i, 13)) * Math.cos(a), SED_TOP + 0.45, (JAR_R - 1.5) * Math.sqrt(hash01(i, 13)) * Math.sin(a)]) as Vec3;
    });
    items.push({ id: 'caracoles', kind: 'particles', points: pts, radius: 0.5, color: '#a8773f', label: 'Caracoles vivos', tag: 'Caracoles' });
  }
  if (deadSnails > 0) {
    const pts = Array.from({ length: deadSnails }, (_, i) => { const a = 2 * Math.PI * hash01(i, 21), r = 4.5 * Math.sqrt(hash01(i, 22)); return [r * Math.cos(a), SED_TOP + 0.35, r * Math.sin(a)] as Vec3; });
    items.push({ id: 'conchas', kind: 'particles', points: pts, radius: 0.42, color: '#e8e2d6', label: 'Conchas de caracoles muertos', tag: '' });
  }
  for (let i = 0; i < nFish; i++) {
    const a = 2 * Math.PI * (i / Math.max(1, nFish)) + 1.1, r = 3.2;
    items.push({ id: `pez-${i}`, kind: 'ellipsoid', center: [r * Math.cos(a), 11 + 2.2 * (i % 2), r * Math.sin(a)], radii: [0.95, 0.42, 0.3], color: '#ee8a3c', ...(i === 0 ? { label: 'Guppys vivos', tag: 'Guppys' } : {}) });
  }
  for (let i = 0; i < deadFish; i++) {
    const a = 2 * Math.PI * hash01(i, 41) + 0.5, r = 4 * Math.sqrt(hash01(i, 42));
    items.push({ id: `pez-muerto-${i}`, kind: 'ellipsoid', center: [r * Math.cos(a), SED_TOP + 0.25, r * Math.sin(a)], radii: [0.9, 0.18, 0.32], color: '#cfc8bb', ...(i === 0 ? { label: 'Guppys muertos', tag: '' } : {}) });
  }
  if (inp.flakes > 0) {
    const pts = Array.from({ length: inp.flakes }, (_, i) => { const a = 2 * Math.PI * hash01(i, 51), r = 5 * Math.sqrt(hash01(i, 52)); return [r * Math.cos(a), WATER_TOP - 0.1, r * Math.sin(a)] as Vec3; });
    items.push({ id: 'alimento', kind: 'particles', points: pts, radius: 0.22, color: '#d9822b', label: 'Alimento que flota', tag: '' });
  }
  // Lámpara: a la distancia del banco (escala de dibujo) a media altura del agua.
  const lx = -(JAR_R + 2 + inp.distance * LAMP_K), ly = 10;
  items.push(
    { id: 'lampara-pie', kind: 'rod', from: [lx - 1.4, 0, 0], to: [lx - 1.4, ly, 0], radius: 0.22, color: '#6d7b80' },
    { id: 'lampara', kind: 'sphere', center: [lx, ly, 0], radius: 1.3, color: inp.lit ? '#ffe27a' : '#55605f', label: inp.lit ? 'Lámpara encendida' : 'Lámpara apagada' },
  );
  if (inp.lit && inp.par > 0) {
    const len = -(JAR_R + 0.4) - (lx + 1.5);
    items.push(fatArrow('luz', [lx + 1.5, ly, 0], [len, 0, 0], lightRadius(inp.par), '#e8b400', inp.done || !inp.started ? `Luz (energía): ${fmt(inp.par, 0)} µmol/(m²·s) en el vidrio` : 'Luz (energía) que entra', 'Luz'));
  }
  // Balance del día que se muestra (solo cuando ya corre o corrió la simulación).
  const dayTxt = `día ${inp.day}`;
  if (inp.started) {
    const animals = Math.max(0, inp.respiration - inp.decomposition);
    if (inp.gpp > 1e-6) items.push(fatArrow('o2', [2.4, 6.5, 1.2], [0, 6.5, 0], flowRadius(inp.gpp), 'series-2', inp.done ? `O₂ de la fotosíntesis: ${fmt(inp.gpp, 1)} mg/L en el ${dayTxt}` : `O₂ de la fotosíntesis (${dayTxt})`, 'O₂'));
    if (animals > 1e-6) items.push(fatArrow('co2', [-2.6, 9, -1.6], [0, 5.2, 0], flowRadius(animals), 'series-1', inp.done ? `CO₂ al respirar plantas y animales (${fmt(animals, 1)} mg/L de O₂ en el ${dayTxt})` : `CO₂ al respirar plantas y animales (${dayTxt})`, 'CO₂'));
    if (inp.decomposers && inp.decomposition > 1e-6) items.push(fatArrow('co2-desc', [-1.2, SED_TOP + 0.2, 3.6], [0, 4.6, 0], flowRadius(inp.decomposition), 'series-6', inp.done ? `CO₂ de los descomponedores (${fmt(inp.decomposition, 1)} mg/L de O₂ en el ${dayTxt})` : `CO₂ de los descomponedores (${dayTxt})`, 'CO₂ desc.'));
  }

  const org = `${sprigs} ${sprigs === 1 ? 'ramita' : 'ramitas'} de elodea${health < 0.5 && sprigs > 0 ? ' amarillentas' : ''}, ${nSnails} ${nSnails === 1 ? 'caracol' : 'caracoles'} y ${nFish} ${nFish === 1 ? 'guppy' : 'guppys'} vivos${deadFish + deadSnails > 0 ? ` (restos de ${deadFish} ${deadFish === 1 ? 'guppy' : 'guppys'} y ${deadSnails} ${deadSnails === 1 ? 'concha' : 'conchas'} en el fondo)` : ''}`;
  const lamp = inp.lit ? `La lámpara está encendida a ${fmt(inp.distance, 0)} cm; la flecha de luz entra al frasco.` : `La lámpara está apagada${inp.started ? ' (de noche en el temporizador)' : ''}.`;
  const sed = inp.decomposers ? 'El fondo es lodo de ciénaga con descomponedores.' : 'El fondo es arena hervida, sin descomponedores.';
  let description: string;
  if (!inp.started) {
    description = `Frasco cerrado en 3D recién armado (día 0, 6:00) con ${org}. ${sed} ${lamp} Aún no corre la simulación: pulsa «Simular y medir» para ver pasar los días y las flechas de oxígeno y dióxido de carbono.`;
  } else if (!inp.done) {
    description = `Frasco cerrado en 3D, ${inp.clock}: hay ${org}. ${sed} ${lamp} Flechas del balance del ${dayTxt}: el O₂ que produce la fotosíntesis, el CO₂ que liberan al respirar plantas y animales${inp.decomposers ? ' y el CO₂ de los descomponedores del lodo' : ''}. Su grosor sigue el modelo; los valores aparecen al terminar la medición.`;
  } else {
    const net = inp.gpp - inp.respiration;
    description = `Frasco cerrado en 3D, lectura del ${dayTxt} (${inp.readLabel.toLowerCase()}): ${org}. ${sed} ${lamp} `
      + `Balance del ${dayTxt} según el modelo: la fotosíntesis produjo ${fmt(inp.gpp, 1)} mg/L de O₂ y la respiración de toda la comunidad gastó ${fmt(inp.respiration, 1)} mg/L${inp.decomposers ? ` (${fmt(inp.decomposition, 1)} de ellos los descomponedores)` : ''}: el frasco ${net >= 0 ? 'gana' : 'pierde'} oxígeno ese día. `
      + `Lecturas: oxígeno ${fmt(inp.readings.od, 1)} mg/L, indicador ${inp.readings.indicator} (pH ${fmt(inp.readings.ph, 1)}), ${inp.readings.snails} caracoles y ${inp.readings.fish} guppys contados.`;
  }
  return { items, extent: 12, target: [-5.5, 10, 0], narrow: { extent: 16, target: [-5.5, 10, 0] }, description, counts: { sprigs, snails: nSnails, fish: nFish, deadFish, deadSnails, specks } };
}
