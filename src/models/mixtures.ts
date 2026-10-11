import { assertInRange } from './math';
import type { ModelSpec } from './types';

/** Número con coma decimal (es-CO) para la bitácora. */
const n = (x: number, d: number) => x.toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const joinY = (xs: string[]) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} y ${xs[xs.length - 1]}` : xs[0] ?? '');

/**
 * Separación de mezclas (grado 6.º).
 * Cada componente tiene propiedades que determinan qué método lo separa:
 *   magnético → imantación; insoluble y más denso que el agua → filtración o decantación;
 *   flota → se retira con colador/decantación; inmiscible y menos denso (aceite) → embudo de decantación;
 *   soluble → queda en el filtrado y se recupera por evaporación.
 */

export type ComponentId = 'hierro' | 'arena' | 'sal' | 'aserrin' | 'aceite';
export type MethodId = 'iman' | 'decantacion' | 'filtracion' | 'evaporacion' | 'agua';

export interface ComponentInfo { id: ComponentId; name: string; magnetic: boolean; soluble: boolean; liquid: boolean; floats: boolean; color: string; }

export const COMPONENTS: ComponentInfo[] = [
  { id: 'hierro', name: 'Limaduras de hierro', magnetic: true, soluble: false, liquid: false, floats: false, color: '#5b6068' },
  { id: 'arena', name: 'Arena', magnetic: false, soluble: false, liquid: false, floats: false, color: '#d9b26f' },
  { id: 'sal', name: 'Sal de cocina', magnetic: false, soluble: true, liquid: false, floats: false, color: '#f4f4f4' },
  { id: 'aserrin', name: 'Aserrín', magnetic: false, soluble: false, liquid: false, floats: true, color: '#b07a45' },
  { id: 'aceite', name: 'Aceite de cocina', magnetic: false, soluble: false, liquid: true, floats: true, color: '#e8c33a' },
];

export const METHODS: { id: MethodId; name: string; description: string }[] = [
  { id: 'agua', name: 'Agregar agua y agitar', description: 'Disuelve los sólidos solubles; los insolubles quedan suspendidos o se depositan.' },
  { id: 'iman', name: 'Imantación', description: 'Un imán atrae los materiales magnéticos.' },
  { id: 'decantacion', name: 'Decantación (embudo)', description: 'Separa líquidos que no se mezclan, o retira lo que flota tras dejar reposar.' },
  { id: 'filtracion', name: 'Filtración', description: 'El papel filtro retiene los sólidos que no se disuelven; el líquido y lo disuelto pasan.' },
  { id: 'evaporacion', name: 'Evaporación', description: 'Al calentar, el agua se evapora y deja los sólidos disueltos.' },
];

export const MIXTURE_LIMITS = { mass: [0, 20] as [number, number], water: [50, 300] as [number, number], power: [100, 1000] as [number, number] };

/** Fracción de la solución que queda retenida en el papel filtro húmedo (pérdida). */
export const FILTER_RETENTION = 0.03;
/** Fracción del aceite que queda adherida al embudo y pasa con el agua al decantar. */
export const DECANT_LOSS = 0.02;
export const HEATING_EFFICIENCY = 0.6;
export const WATER_C = 4.18; // J/(g·°C)
export const WATER_L = 2257; // J/g calor latente de vaporización

export type Masses = Record<ComponentId, number>;
const zero = (): Masses => ({ hierro: 0, arena: 0, sal: 0, aserrin: 0, aceite: 0 });

/** Estado del recipiente principal y de lo que se ha separado. */
export interface MixtureState {
  vessel: Masses; // componentes que siguen en la mezcla
  water: number; // g de agua en la mezcla
  dissolved: boolean; // ¿se agregó agua? (la sal está disuelta)
  separated: { method: MethodId; label: string; masses: Masses; water: number }[];
  log: string[];
  minutes: number; // tiempo total de trabajo
}

export function initialState(m: Masses): MixtureState {
  for (const c of COMPONENTS) assertInRange(`La masa de ${c.name.toLowerCase()}`, m[c.id], ...MIXTURE_LIMITS.mass);
  return { vessel: { ...m }, water: 0, dissolved: false, separated: [], log: [], minutes: 0 };
}

const sum = (m: Masses) => Object.values(m).reduce((a, b) => a + b, 0);

export interface MethodOptions { water?: number; power?: number; }

/** Aplica un método al recipiente. Devuelve un nuevo estado (no modifica el anterior). */
export function applyMethod(state: MixtureState, method: MethodId, opts: MethodOptions = {}): MixtureState {
  const s: MixtureState = { ...state, vessel: { ...state.vessel }, separated: [...state.separated], log: [...state.log] };
  const v = s.vessel;
  switch (method) {
    case 'agua': {
      const w = opts.water ?? 100;
      assertInRange('El agua agregada', w, ...MIXTURE_LIMITS.water);
      s.water += w;
      s.dissolved = true;
      s.minutes += 2;
      // Solubilidad de la sal ≈ 36 g/100 g de agua: con estas cantidades siempre se disuelve.
      s.log.push(`Se agregaron ${w} g de agua: ${v.sal > 0 ? 'la sal se disolvió; ' : ''}${v.aserrin > 0 || v.aceite > 0 ? `${joinY([v.aserrin > 0 ? 'el aserrín' : '', v.aceite > 0 ? 'el aceite' : ''].filter(Boolean))} ${v.aserrin > 0 && v.aceite > 0 ? 'flotan' : 'flota'}; ` : ''}${v.arena > 0 || v.hierro > 0 ? `${joinY([v.arena > 0 ? 'la arena' : '', v.hierro > 0 ? 'el hierro' : ''].filter(Boolean))} ${v.arena > 0 && v.hierro > 0 ? 'se van' : 'se va'} al fondo.` : ''}`.trim());
      break;
    }
    case 'iman': {
      const got = { ...zero(), hierro: v.hierro };
      if (v.hierro > 0) {
        v.hierro = 0;
        s.separated.push({ method, label: 'Lo que atrajo el imán', masses: got, water: 0 });
        s.log.push(`El imán atrajo ${n(got.hierro, 1)} g de limaduras de hierro.`);
      } else s.log.push('El imán no atrajo nada: no quedan materiales magnéticos.');
      s.minutes += 2;
      break;
    }
    case 'decantacion': {
      if (v.aceite > 0 && s.water > 0) {
        const oil = v.aceite * (1 - DECANT_LOSS);
        s.separated.push({ method, label: 'Capa superior separada (aceite)', masses: { ...zero(), aceite: oil }, water: 0 });
        v.aceite -= oil;
        s.log.push(`En el embudo de decantación se separó la capa de aceite (${n(oil, 1)} g). Una pequeña parte queda en las paredes.`);
      } else if (v.aserrin > 0 && s.water > 0) {
        s.separated.push({ method, label: 'Lo que flotaba (aserrín)', masses: { ...zero(), aserrin: v.aserrin }, water: 0 });
        s.log.push(`Se retiró el aserrín que flotaba (${n(v.aserrin, 1)} g).`);
        v.aserrin = 0;
      } else if (s.water === 0) {
        s.log.push('Sin agua no hay capas que separar: primero agrega agua.');
      } else s.log.push('No hay capas para decantar.');
      s.minutes += 10;
      break;
    }
    case 'filtracion': {
      if (s.water === 0) { s.log.push('No se puede filtrar una mezcla seca: primero agrega agua.'); break; }
      const solids = { ...zero(), arena: v.arena, aserrin: v.aserrin, hierro: v.hierro };
      // El papel retiene los sólidos insolubles y un poco de la solución (con su sal).
      const retainedWater = s.water * FILTER_RETENTION;
      const retainedSalt = v.sal * FILTER_RETENTION;
      solids.sal = retainedSalt;
      s.separated.push({ method, label: 'Residuo en el papel filtro', masses: solids, water: retainedWater });
      v.arena = 0; v.aserrin = 0; v.hierro = 0; v.sal -= retainedSalt;
      s.water -= retainedWater;
      if (v.aceite > 0) s.log.push('Atención: el aceite atraviesa el papel filtro junto con el agua; la filtración no lo separa.');
      s.log.push(`El papel filtro retuvo ${n(solids.arena + solids.aserrin + solids.hierro, 1)} g de sólidos insolubles. El filtrado contiene el agua y lo disuelto.`);
      s.minutes += 15;
      break;
    }
    case 'evaporacion': {
      const P = opts.power ?? 500;
      assertInRange('La potencia del mechero', P, ...MIXTURE_LIMITS.power);
      if (s.water === 0) { s.log.push('No hay agua que evaporar.'); break; }
      const energy = s.water * (WATER_C * 80 + WATER_L); // de 20 °C a 100 °C y vaporización
      const minutes = energy / (P * HEATING_EFFICIENCY) / 60;
      const residue = { ...v };
      s.separated.push({ method, label: 'Residuo sólido tras evaporar', masses: residue, water: 0 });
      s.vessel = zero();
      s.log.push(`Se evaporaron ${n(s.water, 0)} g de agua en ${n(minutes, 1)} min con ${P} W. Quedó un residuo de ${n(sum(residue), 1)} g.`);
      s.water = 0;
      s.minutes += minutes;
      break;
    }
  }
  return s;
}

/** Recuperación y pureza de un componente en la fracción separada donde más abunda. */
export function evaluate(state: MixtureState, initial: Masses) {
  return COMPONENTS.filter((c) => initial[c.id] > 0).map((c) => {
    let best: { label: string; mass: number; purity: number } | null = null;
    for (const f of state.separated) {
      const m = f.masses[c.id];
      if (m <= 0) continue;
      const total = sum(f.masses);
      const purity = total > 0 ? (m / total) * 100 : 0;
      if (!best || m > best.mass) best = { label: f.label, mass: m, purity };
    }
    return {
      component: c,
      recovered: best?.mass ?? 0,
      recoveryPercent: best ? (best.mass / initial[c.id]) * 100 : 0,
      purity: best?.purity ?? 0,
      where: best?.label ?? 'sin separar',
    };
  });
}

export function evaporationMinutes(waterG: number, powerW: number): number {
  return (waterG * (WATER_C * 80 + WATER_L)) / (powerW * HEATING_EFFICIENCY) / 60;
}

export const mixturesModelSpec: ModelSpec = {
  name: 'Separación de mezclas por propiedades físicas',
  inputs: [
    { symbol: 'm_i', name: 'Masa de cada componente (hierro, arena, sal, aserrín, aceite)', unit: 'g', range: MIXTURE_LIMITS.mass, initial: 5 },
    { symbol: 'm_agua', name: 'Agua agregada', unit: 'g', range: MIXTURE_LIMITS.water, initial: 100 },
    { symbol: 'P', name: 'Potencia del mechero', unit: 'W', range: MIXTURE_LIMITS.power, initial: 500 },
    { symbol: 'orden', name: 'Orden de los métodos aplicados', unit: '—' },
  ],
  outputs: [
    { symbol: 'recuperación', name: 'Masa recuperada de cada componente / masa inicial', unit: '%' },
    { symbol: 'pureza', name: 'Fracción del componente en la parte donde se recuperó', unit: '%' },
    { symbol: 't', name: 'Tiempo de evaporación', unit: 'min' },
  ],
  equations: [
    'Imantación: separa los componentes magnéticos.',
    'Filtración: retiene sólidos insolubles; pierde el 3 % de la solución en el papel húmedo.',
    'Decantación: separa líquidos inmiscibles (pierde el 2 % del aceite) o retira lo que flota.',
    'Evaporación: E = m_agua·(c·ΔT + L), con c = 4,18 J/(g·°C), ΔT = 80 °C, L = 2257 J/g; t = E/(η·P), η = 0,6.',
    'Pureza = masa del componente en la fracción / masa total de la fracción × 100.',
  ],
  initialConditions: ['5 g de cada sólido y 5 g de aceite; mechero de 500 W.'],
  assumptions: [
    'La sal se disuelve completamente (su solubilidad, ≈ 36 g/100 g de agua, no se supera con estas cantidades).',
    'El aserrín flota y el hierro y la arena se hunden por completo.',
    'Las pérdidas en el papel filtro y en el embudo son porcentajes fijos.',
  ],
  limits: [
    'No se modelan la humedad residual de los sólidos, el tiempo de secado ni la evaporación parcial.',
    'La rapidez de evaporación depende también del área del recipiente y de la ventilación (no incluidas).',
  ],
  testCases: [
    'Imán → filtración → evaporación recupera hierro, arena y sal con alta pureza.',
    'Evaporar antes de filtrar deja la sal mezclada con la arena (baja pureza).',
    'Filtrar no separa el aceite; el embudo de decantación sí.',
    'Se conserva la masa total (recuperada + perdida = inicial).',
    'Duplicar la potencia reduce a la mitad el tiempo de evaporación.',
  ],
};
