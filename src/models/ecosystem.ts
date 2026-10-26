/**
 * Ecosistema cerrado en un frasco (mesocosmos de agua dulce): productores (elodea y microalgas), consumidores
 * (caracoles y guppys) y descomponedores (bacterias y hongos del sedimento).
 *
 * Modelo de compartimentos integrado con pasos de 15 minutos durante 31 días. Variables de estado:
 *   O₂ y CO₂ disueltos (mg/L), nutrientes disueltos (mg/L de nitrógeno), biomasa de elodea (g de masa fresca),
 *   microalgas (mg de masa seca por litro), caracoles y peces (individuos, como números reales que se redondean
 *   al contarlos) y detritos (mg de materia orgánica muerta en el sedimento).
 *
 * Procesos:
 *  - Fotosíntesis bruta: P = Pmax·B·f(luz)·f(CO₂)·f(nutrientes), con funciones de saturación de tipo Monod.
 *    Luz: lámpara con atenuador y ley del inverso del cuadrado, sombreado por la propia biomasa.
 *  - Respiración aerobia de todos los organismos: consume O₂ y libera CO₂ (cociente respiratorio 1:
 *    44/32 = 1,375 mg de CO₂ por mg de O₂). Se frena cuando falta oxígeno: f(O₂) = O₂/(O₂ + 0,3).
 *  - Crecimiento de los productores = rendimiento × (fotosíntesis − respiración), limitado por el nitrógeno disponible.
 *  - Consumidores: los caracoles comen microalgas, el perifiton de la elodea y el alimento sobrante; los peces
 *    comen el alimento en hojuelas y algo de microalgas. Caracoles: crecimiento logístico dS/dt = r·S·(1 − S/K),
 *    con capacidad de carga K = alimento disponible por día / ración diaria de un caracol. Peces: no se
 *    reproducen en 30 días y mueren lentamente si no les alcanza el alimento. Ambos mueren si el O₂ baja
 *    de un umbral (2,5 mg/L para los peces y 1,5 mg/L para los caracoles).
 *  - Descomponedores: mineralizan los detritos (hojas viejas, heces, alimento sobrante y organismos muertos)
 *    a una tasa de primer orden; consumen O₂, liberan CO₂ y devuelven el nitrógeno al agua. Sin oxígeno
 *    siguen trabajando más despacio (anaerobiosis) y solo liberan CO₂. Sin descomponedores, los detritos
 *    se acumulan y el nitrógeno no regresa.
 *  - pH: sistema carbonato con alcalinidad fija (0,5 mmol/L): pH = 6,35 + log₁₀([HCO₃⁻]/[CO₂]).
 *    El azul de bromotimol vira de amarillo (pH ≤ 6,0) a verde (≈ 7) y a azul (pH ≥ 7,6).
 *
 * Funciones puras y deterministas (sin React) para poder probarlas con Vitest.
 */
import type { ModelSpec } from './types';
import { assertInRange, clamp, roundToResolution } from './math';
import { classifyWarnings, num, type ModelCondition } from './conditions';

/* ------------------------------------------------------------------ constantes */

export const JAR_VOLUME_L = 3;
export const TEMP_C = 26;
/** Saturación de O₂ en agua dulce a 26 °C y 1 atm (tablas de solubilidad, ≈ 8,1 mg/L). */
export const O2_SAT = 8.1;
/** Por encima de este valor (≈ 150 % de saturación) el O₂ sale como burbujas y se pierde del agua. */
export const O2_BUBBLE = 12;
export const O2_INITIAL = 7.8;
/** Alcalinidad (bicarbonato) del agua, mmol/L; se supone constante. */
export const ALKALINITY = 0.5;
export const PKA1 = 6.35;
/** mg de CO₂ por mg de O₂ (cociente respiratorio y fotosintético igual a 1). */
export const CO2_PER_O2 = 44 / 32;
export const PH_INITIAL = 7.0;
export const NUTRIENT_INITIAL = 0.6;
export const ALGAE_INITIAL = 0.3;
export const DETRITUS_INITIAL = 20;
/** Masa fresca de una ramita de elodea, g. */
export const SPRIG_G = 2.5;
/** Fracción seca de la elodea: 1 g de masa fresca ≈ 80 mg de masa seca. */
export const ELODEA_DRY_MG_PER_G = 80;
/** Lámpara LED: PAR (µmol de fotones/(m²·s)) al 100 % y a 25 cm. */
export const LAMP_PAR_REF = 400;
export const LAMP_REF_CM = 25;
/** Umbrales de O₂ para los consumidores (mg/L). */
export const O2_CRIT_FISH = 2.5;
export const O2_CRIT_SNAIL = 1.5;
/** Raciones diarias (mg de alimento seco por individuo y por día). */
export const RATION_SNAIL = 2;
export const RATION_FISH = 4;
/** Masa orgánica seca de un cadáver que pasa a detritos, mg. */
export const BODY_SNAIL = 10;
export const BODY_FISH = 25;
/** Días que se pueden simular. */
export const MAX_DAY = 30;
/** Pasos de integración por hora. */
const STEPS_PER_HOUR = 4;

export const ECO_LIMITS = {
  lightHours: [0, 24] as [number, number],
  dimmer: [0, 100] as [number, number],
  distance: [15, 60] as [number, number],
  plants: [0, 6] as [number, number],
  snails: [0, 10] as [number, number],
  fish: [0, 4] as [number, number],
  day: [0, MAX_DAY] as [number, number],
};

export type FoodLevel = 'ninguno' | 'poco' | 'normal' | 'exceso';
export interface FoodInfo { id: FoodLevel; name: string; mgPerDay: number }
export const FOODS: FoodInfo[] = [
  { id: 'ninguno', name: 'Sin alimento', mgPerDay: 0 },
  { id: 'poco', name: 'Poco (una pizca cada día)', mgPerDay: 4 },
  { id: 'normal', name: 'Normal (lo que comen en 2 minutos)', mgPerDay: 8 },
  { id: 'exceso', name: 'Exceso (una cucharadita cada día)', mgPerDay: 40 },
];
export const findFood = (id: FoodLevel): FoodInfo => FOODS.find((f) => f.id === id) ?? FOODS[2];

/** Resoluciones de los instrumentos. */
export const OD_RES = 0.1;
export const PH_CHART_RES = 0.2;
export const PH_CHART_RANGE: [number, number] = [5.8, 8.0];
export const BIOMASS_RES = 0.5;

/** Instrumentos (respaldo para useMeasure si la práctica no está en INSTRUMENTS). */
export const ECO_INSTRUMENTS = [
  { id: 'oximetro', name: 'Oxímetro con sonda polarográfica (0 a 20 mg/L)', quantity: 'Oxígeno disuelto', unit: 'mg/L', resolution: OD_RES, sigma: 0.15, nonNegative: true, note: 'Calibración en aire saturado, temperatura del agua y consumo de O₂ de la propia sonda si el agua no se mueve.' },
  { id: 'carta', name: 'Carta de color del azul de bromotimol (cada 0,2 de pH)', quantity: 'pH de la muestra', unit: '—', resolution: PH_CHART_RES, sigma: 0.15, note: 'Comparar colores a simple vista: la luz del salón y la turbidez verde de las algas cambian el tono percibido.' },
  { id: 'conteo', name: 'Conteo a simple vista a través del vidrio', quantity: 'Caracoles', unit: 'individuos', resolution: 1, sigma: 0.5, nonNegative: true, note: 'Los caracoles pequeños se esconden entre las hojas y en el sedimento; los recién nacidos miden menos de 1 mm.' },
  { id: 'biomasa', name: 'Biomasa de elodea estimada por la longitud de las ramitas', quantity: 'Biomasa fresca de elodea', unit: 'g', resolution: BIOMASS_RES, sigma: 0.3, nonNegative: true, note: 'Se mide la longitud total con una regla a través del vidrio y se convierte con 0,25 g por cada centímetro de ramita.' },
];

/* ------------------------------------------------------------------ funciones elementales */

/** Luz fotosintética (PAR) que llega a la pared del frasco, µmol/(m²·s): atenuador lineal e inverso del cuadrado. */
export function lightAtJar(dimmerPct: number, distanceCm: number): number {
  assertInRange('Intensidad de la lámpara', dimmerPct, ECO_LIMITS.dimmer[0], ECO_LIMITS.dimmer[1]);
  assertInRange('Distancia de la lámpara', distanceCm, ECO_LIMITS.distance[0], ECO_LIMITS.distance[1]);
  return LAMP_PAR_REF * (dimmerPct / 100) * (LAMP_REF_CM / distanceCm) ** 2;
}

/** pH del agua según el CO₂ libre (mg/L) con alcalinidad fija: pH = pKa₁ + log₁₀(HCO₃⁻/CO₂). */
export function phFromCO2(co2MgL: number, alkalinity = ALKALINITY): number {
  if (!(co2MgL > 0)) throw new RangeError('El CO₂ disuelto debe ser positivo.');
  return clamp(PKA1 + Math.log10((alkalinity * 44) / co2MgL), 4.5, 9.5);
}

/** CO₂ libre (mg/L) que corresponde a un pH (inversa de phFromCO2). */
export function co2FromPh(pH: number, alkalinity = ALKALINITY): number {
  assertInRange('pH', pH, 4.5, 9.5);
  return (alkalinity * 44) / 10 ** (pH - PKA1);
}

/** Color del azul de bromotimol (hex) para un pH: amarillo ≤ 6,0; verde ≈ 6,9; azul ≥ 7,6. */
export function bromothymolColor(pH: number): string {
  const stops: [number, [number, number, number]][] = [
    [6.0, [226, 192, 40]], [6.45, [176, 190, 52]], [6.9, [72, 152, 72]], [7.3, [38, 128, 136]], [7.6, [42, 92, 176]], [8.2, [32, 66, 150]],
  ];
  if (pH <= stops[0][0]) return toHex(stops[0][1]);
  for (let i = 1; i < stops.length; i++) {
    if (pH <= stops[i][0]) {
      const [p0, c0] = stops[i - 1], [p1, c1] = stops[i];
      const f = (pH - p0) / (p1 - p0);
      return toHex([0, 1, 2].map((k) => c0[k] + (c1[k] - c0[k]) * f) as [number, number, number]);
    }
  }
  return toHex(stops[stops.length - 1][1]);
}
function toHex(c: [number, number, number]): string {
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;
}

/** Nombre del color del indicador. */
export function bromothymolName(pH: number): string {
  if (pH < 6.2) return 'amarillo';
  if (pH < 6.6) return 'amarillo verdoso';
  if (pH < 7.2) return 'verde';
  if (pH < 7.6) return 'verde azulado';
  return 'azul';
}

/** Lectura del pH con la carta de color: se limita a la carta (5,8 a 8,0) y se redondea a 0,2. */
export function phChartReading(pH: number): number {
  return roundToResolution(clamp(pH, PH_CHART_RANGE[0], PH_CHART_RANGE[1]), PH_CHART_RES);
}

/** Lectura del oxímetro (mg/L con 0,1 de resolución). */
export function odReading(o2: number): number {
  return roundToResolution(Math.max(0, o2), OD_RES);
}

/** Saturación de oxígeno, %. */
export const o2Saturation = (o2: number) => (100 * o2) / O2_SAT;

/** Aspecto del agua según la concentración de microalgas (mg/L de masa seca). */
export function waterLook(algae: number): string {
  if (algae < 1.5) return 'transparente';
  if (algae < 4) return 'ligeramente verde';
  if (algae < 10) return 'verde (proliferación de algas)';
  return 'verde opaca (sopa de algas)';
}

/* ------------------------------------------------------------------ simulación */

export interface EcoInput {
  /** Horas de luz por día (la lámpara se enciende a las 6:00). */
  lightHours: number;
  /** Atenuador de la lámpara, %. */
  dimmer: number;
  /** Distancia de la lámpara a la pared del frasco, cm. */
  distance: number;
  /** Ramitas de elodea al cerrar el frasco. */
  plants: number;
  snails: number;
  fish: number;
  food: FoodLevel;
  decomposers: boolean;
}

export const ECO_DEFAULT: EcoInput = { lightHours: 12, dimmer: 60, distance: 30, plants: 3, snails: 4, fish: 1, food: 'poco', decomposers: true };

/** Estado del frasco en un instante. */
export interface EcoState {
  o2: number; co2: number; pH: number;
  /** Nitrógeno disuelto (nutrientes), mg/L. */
  nutrients: number;
  /** Elodea, g de masa fresca. */
  elodea: number;
  /** Microalgas, mg de masa seca por litro. */
  algae: number;
  snails: number; fish: number;
  /** Detritos (materia orgánica muerta), mg de masa seca. */
  detritus: number;
}

/** Resumen de un día: estados a las 6:00 (amanecer) y a las 18:00, y balances del día. */
export interface EcoDay {
  day: number;
  dawn: EcoState;
  dusk: EcoState;
  /** Mínimo de O₂ del día (mg/L). */
  o2Min: number;
  /** Fotosíntesis bruta y respiración de toda la comunidad durante el día, mg de O₂ por litro. */
  gpp: number;
  respiration: number;
  /** Respiración de los descomponedores (parte de respiration), mg de O₂ por litro. */
  decomposition: number;
  /** Capacidad de carga de caracoles con el alimento disponible ese día (individuos). */
  snailK: number;
  /** O₂ perdido como burbujas, mg. */
  bubbles: number;
}

export interface EcoResult {
  input: EcoInput;
  par: number;
  foodMg: number;
  /** Días 0 a 30 (el día d empieza a las 6:00 del día d). */
  days: EcoDay[];
  /** Primer día en que no queda ningún pez o ningún caracol (null si sobreviven). */
  fishGoneDay: number | null;
  snailsGoneDay: number | null;
  /** Primer día cuyo amanecer tiene O₂ por debajo del umbral de los peces. */
  hypoxiaDay: number | null;
  warnings: string[];
}

export type ReadTime = 'amanecer' | 'tarde';
export const READ_TIME_LABEL: Record<ReadTime, string> = { amanecer: 'Amanecer (6:00)', tarde: 'Tarde (18:00)' };

const monod = (x: number, k: number) => (x > 0 ? x / (x + k) : 0);

/** Valida las entradas (lanza RangeError). */
export function validateEco(i: EcoInput): void {
  assertInRange('Horas de luz', i.lightHours, ECO_LIMITS.lightHours[0], ECO_LIMITS.lightHours[1]);
  assertInRange('Ramitas de elodea', i.plants, ECO_LIMITS.plants[0], ECO_LIMITS.plants[1]);
  assertInRange('Caracoles', i.snails, ECO_LIMITS.snails[0], ECO_LIMITS.snails[1]);
  assertInRange('Peces', i.fish, ECO_LIMITS.fish[0], ECO_LIMITS.fish[1]);
  lightAtJar(i.dimmer, i.distance);
  if (!FOODS.some((f) => f.id === i.food)) throw new RangeError('Nivel de alimento desconocido.');
}

/** Parámetros del modelo (valores ilustrativos de orden de magnitud realista; ver supuestos). */
export const ECO_PARAMS = {
  /** Fotosíntesis máxima de la elodea, mg O₂ por g de masa fresca y por hora. */
  pmaxElodea: 0.8,
  /** Fotosíntesis máxima de las microalgas, mg O₂ por mg de masa seca y por hora. */
  pmaxAlgae: 0.25,
  /** Constantes de semisaturación de luz, µmol/(m²·s). */
  kLightElodea: 150, kLightAlgae: 100,
  /** CO₂ libre de semisaturación, mg/L. */
  kCO2: 1,
  /** Nitrógeno de semisaturación, mg/L (la elodea enraizada toma parte de sus nutrientes del sedimento). */
  kNElodea: 0.05, kNAlgae: 0.1, rootedFloor: 0.3,
  /** Respiración, mg O₂ por hora: por g de elodea, por mg de algas, por caracol (≈ 0,1 g) y por guppy (≈ 0,25 g). */
  respElodea: 0.03, respAlgae: 0.02, respSnail: 0.03, respFish: 0.08,
  /** O₂ de semisaturación de la respiración, mg/L. */
  kO2: 0.3,
  /** Rendimientos: g de elodea fresca y mg de algas secas por mg de O₂ producido neto. */
  yieldElodea: 0.94 / 80, yieldAlgae: 0.94,
  /** Nitrógeno en la biomasa: mg N por g de elodea fresca (2,5 % de la masa seca), por mg de algas secas y por mg de detritos (valor medio). */
  nElodea: 2, nAlgae: 0.07, nDetritus: 0.05,
  /** Pérdidas por senescencia, por día. */
  senescenceElodea: 0.01, senescenceAlgae: 0.1,
  /** Mineralización de detritos por los descomponedores, por día; O₂ por mg de detrito; fracción anaerobia. */
  decay: 0.15, o2PerDetritus: 1.1, anaerobic: 0.3,
  /** Crecimiento máximo de los caracoles, por día; muerte máxima por hambre, por día. */
  rSnail: 0.08, starveSnail: 0.15, starveFish: 0.05,
  /** Muerte por hipoxia (por hora) cuando el O₂ es 0. */
  hypoxiaDeath: 0.15,
  /** Fracción de lo comido que sale como heces (pasa a detritos). */
  feces: 0.4,
  /** Fracción de las algas y del perifiton de la elodea que los consumidores pueden comer por día. */
  grazeAlgae: 0.5, grazeElodea: 0.02, fishAlgae: 0.2,
};

/** Simula 30 días (y medio) del frasco cerrado. Determinista. */
export function simulateEcosystem(input: EcoInput): EcoResult {
  validateEco(input);
  const P = ECO_PARAMS;
  const V = JAR_VOLUME_L;
  const par = lightAtJar(input.dimmer, input.distance);
  const foodMg = findFood(input.food).mgPerDay;
  const s: EcoState = {
    o2: O2_INITIAL, co2: co2FromPh(PH_INITIAL), pH: PH_INITIAL, nutrients: NUTRIENT_INITIAL,
    elodea: input.plants * SPRIG_G, algae: ALGAE_INITIAL, snails: input.snails, fish: input.fish, detritus: DETRITUS_INITIAL,
  };
  const snap = (): EcoState => ({ ...s, pH: phFromCO2(s.co2) });
  const days: EcoDay[] = [];
  const dt = 1 / STEPS_PER_HOUR; // h
  const dd = dt / 24; // día
  let fishGoneDay: number | null = input.fish > 0 ? null : 0;
  let snailsGoneDay: number | null = input.snails > 0 ? null : 0;
  let hypoxiaDay: number | null = null;

  for (let day = 0; day <= MAX_DAY; day++) {
    const dawn = snap();
    let dusk = dawn, o2Min = s.o2, gpp = 0, resp = 0, dec = 0, bubbles = 0, kSum = 0;
    for (let h = 0; h < 24; h++) {
      if (h === 12) dusk = snap();
      const lit = h < input.lightHours;
      for (let k = 0; k < STEPS_PER_HOUR; k++) {
        /* luz dentro del frasco: sombreado por la elodea y por las algas */
        const iIn = lit ? par / (1 + s.elodea / 30 + s.algae / 4) : 0;
        const fC = monod(s.co2, P.kCO2);
        const nRatioE = monod(s.nutrients, P.kNElodea), nRatioA = monod(s.nutrients, P.kNAlgae);
        const fO = monod(s.o2, P.kO2);
        const algaeMass = s.algae * V;
        /* fotosíntesis y respiración (mg O₂ por hora en todo el frasco) */
        const gE = P.pmaxElodea * s.elodea * monod(iIn, P.kLightElodea) * fC * (P.rootedFloor + (1 - P.rootedFloor) * nRatioE);
        const gA = P.pmaxAlgae * algaeMass * monod(iIn, P.kLightAlgae) * fC * nRatioA;
        const rE = P.respElodea * s.elodea * fO, rA = P.respAlgae * algaeMass * fO;
        const rS = P.respSnail * s.snails * fO, rF = P.respFish * s.fish * fO;
        /* descomposición (mg de detrito por hora) */
        const kd = input.decomposers ? (P.decay / 24) * s.detritus : 0;
        const aerobic = kd * fO, anaerobic = kd * (1 - fO) * P.anaerobic;
        const rD = P.o2PerDetritus * aerobic;
        const respTot = rE + rA + rS + rF + rD;
        /* gases */
        let o2 = s.o2 + ((gE + gA - respTot) * dt) / V;
        let co2 = s.co2 + (CO2_PER_O2 * (respTot - gE - gA) * dt) / V + (CO2_PER_O2 * P.o2PerDetritus * anaerobic * dt) / V;
        if (o2 > O2_BUBBLE) { bubbles += (o2 - O2_BUBBLE) * V; o2 = O2_BUBBLE; }
        o2 = Math.max(0, o2);
        co2 = Math.max(0.05, co2);
        gpp += ((gE + gA) * dt) / V;
        resp += (respTot * dt) / V;
        dec += (rD * dt) / V;

        /* productores: crecimiento limitado por el nitrógeno del agua */
        let dE = P.yieldElodea * (gE - rE) * dt;
        let dA = P.yieldAlgae * (gA - rA) * dt; // mg en el frasco
        let nAvail = s.nutrients * V;
        if (dE > 0) { const need = P.nElodea * dE * (1 - P.rootedFloor); if (need > nAvail * 0.5) dE *= (nAvail * 0.5) / need; nAvail -= P.nElodea * dE * (1 - P.rootedFloor); }
        if (dA > 0) { const need = P.nAlgae * dA; if (need > nAvail) dA *= nAvail / need; nAvail -= P.nAlgae * Math.max(0, dA); }
        const senE = P.senescenceElodea * s.elodea * dd, senA = P.senescenceAlgae * algaeMass * dd;

        /* consumidores: alimento disponible por día (mg de masa seca) */
        const flakesFish = Math.min(foodMg, RATION_FISH * s.fish);
        const algaeFish = Math.min(P.fishAlgae * algaeMass, RATION_FISH * s.fish - flakesFish);
        const fishPhi = s.fish > 0 ? (flakesFish + algaeFish) / (RATION_FISH * s.fish) : 1;
        const leftover = foodMg - flakesFish;
        const supplyS = P.grazeAlgae * algaeMass + P.grazeElodea * s.elodea * ELODEA_DRY_MG_PER_G + leftover;
        const snailK = supplyS / RATION_SNAIL;
        kSum += snailK * dt / 24;
        const eatenS = Math.min(RATION_SNAIL * s.snails, supplyS);
        const share = supplyS > 0 ? eatenS / supplyS : 0;
        const eatenAlgae = share * P.grazeAlgae * algaeMass + algaeFish;
        const eatenElodeaG = (share * P.grazeElodea * s.elodea * ELODEA_DRY_MG_PER_G) / ELODEA_DRY_MG_PER_G;
        const uneaten = leftover * (1 - share);
        // caracoles: logístico con K = alimento / ración; muerte por hambre limitada
        let gS = s.snails >= 0.5 ? P.rSnail * s.snails * (1 - s.snails / Math.max(snailK, 1e-6)) : 0;
        gS = Math.max(gS, -P.starveSnail * s.snails);
        let deadS = Math.max(0, -gS) * dd;
        const bornS = Math.max(0, gS) * dd;
        let deadF = P.starveFish * (1 - Math.min(1, fishPhi)) * s.fish * dd;
        // hipoxia
        if (s.o2 < O2_CRIT_SNAIL) deadS += P.hypoxiaDeath * (1 - s.o2 / O2_CRIT_SNAIL) * s.snails * dt;
        if (s.o2 < O2_CRIT_FISH) deadF += P.hypoxiaDeath * (1 - s.o2 / O2_CRIT_FISH) * s.fish * dt;
        deadS = Math.min(deadS, s.snails); deadF = Math.min(deadF, s.fish);

        /* detritos y nutrientes */
        const mineral = aerobic * dt + anaerobic * dt;
        const toDetritus = senE * ELODEA_DRY_MG_PER_G + senA + P.feces * (eatenS + flakesFish + algaeFish) * dd + uneaten * dd
          + deadS * BODY_SNAIL + deadF * BODY_FISH;

        s.o2 = o2;
        s.co2 = co2;
        s.elodea = Math.max(0, s.elodea + dE - senE - eatenElodeaG * dd);
        s.algae = Math.max(0, (algaeMass + dA - senA - eatenAlgae * dd) / V);
        s.nutrients = Math.max(0, nAvail / V + (P.nDetritus * mineral) / V);
        s.detritus = Math.max(0, s.detritus - mineral + toDetritus);
        s.snails = Math.max(0, s.snails + bornS - deadS);
        s.fish = Math.max(0, s.fish - deadF);
        if (s.snails < 0.5) s.snails = 0;
        if (s.fish < 0.5) s.fish = 0;
        o2Min = Math.min(o2Min, s.o2);
      }
    }
    if (fishGoneDay === null && s.fish === 0) fishGoneDay = day + 1;
    if (snailsGoneDay === null && s.snails === 0) snailsGoneDay = day + 1;
    if (hypoxiaDay === null && dawn.o2 < O2_CRIT_FISH) hypoxiaDay = day;
    days.push({ day, dawn, dusk, o2Min, gpp, respiration: resp, decomposition: dec, snailK: kSum, bubbles });
  }

  const warnings: string[] = [];
  if (input.lightHours === 0 || par === 0) warnings.push('Oscuridad: sin luz no hay fotosíntesis; todos los organismos solo respiran y el oxígeno se agota.');
  if (input.plants === 0) warnings.push('Sin elodea: solo producen oxígeno las pocas microalgas del agua.');
  const k0 = days[0].snailK;
  if (input.snails > k0 * 1.2 || days[0].respiration > days[0].gpp * 1.25) warnings.push('Sobrepoblación: hay más consumidores de los que el alimento y el oxígeno del frasco pueden sostener.');
  if (!input.decomposers) warnings.push('Sin descomponedores: los restos se acumulan en el fondo y los nutrientes no regresan al agua.');
  if (input.food === 'exceso') warnings.push('Exceso de alimento: lo que sobra se descompone y gasta oxígeno; los nutrientes liberados alimentan a las algas.');
  return { input, par, foodMg, days, fishGoneDay, snailsGoneDay, hypoxiaDay, warnings };
}

/** Estado en un día y una hora de lectura. */
export function stateAt(r: EcoResult, day: number, time: ReadTime): EcoState {
  assertInRange('Día', day, 0, MAX_DAY);
  const d = r.days[Math.round(day)];
  return time === 'amanecer' ? d.dawn : d.dusk;
}

/** Conteo de individuos (sin instrumento: redondeo al entero). */
export const countOf = (n: number) => Math.max(0, Math.round(n));

/** Biomasa total de productores en masa seca, mg (elodea + microalgas). */
export const producerDryMass = (s: EcoState) => s.elodea * ELODEA_DRY_MG_PER_G + s.algae * JAR_VOLUME_L;

/** Nitrógeno total del frasco, mg (agua + elodea + algas + detritos + animales como detritos potenciales). */
export function totalNitrogen(s: EcoState): number {
  const P = ECO_PARAMS;
  return s.nutrients * JAR_VOLUME_L + s.elodea * P.nElodea + s.algae * JAR_VOLUME_L * P.nAlgae + s.detritus * P.nDetritus;
}

/* ------------------------------------------------------------------ ficha del modelo */

export const ecosystemModelSpec: ModelSpec = {
  name: 'Mesocosmos cerrado de agua dulce: fotosíntesis y respiración (O₂, CO₂, pH), crecimiento de productores limitado por luz y nutrientes, consumidores con capacidad de carga y descomponedores que reciclan nutrientes',
  inputs: [
    { symbol: 'L', name: 'Horas de luz por día (la lámpara se enciende a las 6:00)', unit: 'h', range: ECO_LIMITS.lightHours, initial: 12 },
    { symbol: 'a', name: 'Intensidad de la lámpara (atenuador)', unit: '%', range: ECO_LIMITS.dimmer, initial: 60 },
    { symbol: 'd', name: 'Distancia de la lámpara al frasco', unit: 'cm', range: ECO_LIMITS.distance, initial: 30 },
    { symbol: 'n_E', name: 'Ramitas de elodea (2,5 g cada una)', unit: '—', range: ECO_LIMITS.plants, initial: 3 },
    { symbol: 'S₀', name: 'Caracoles al cerrar el frasco', unit: '—', range: ECO_LIMITS.snails, initial: 4 },
    { symbol: 'F₀', name: 'Peces (guppys) al cerrar el frasco', unit: '—', range: ECO_LIMITS.fish, initial: 1 },
    { symbol: 'A', name: 'Alimento en hojuelas por día: ninguno 0, poco 4, normal 8, exceso 40 mg', unit: 'mg/día', initial: 'poco (4 mg/día)' },
    { symbol: 'desc', name: 'Descomponedores en el sedimento (sí: sedimento de ciénaga; no: arena lavada y hervida)', unit: '—', initial: 'sí' },
    { symbol: 't', name: 'Día y hora de la medición (amanecer 6:00 o tarde 18:00)', unit: 'día', range: ECO_LIMITS.day, initial: 7 },
  ],
  outputs: [
    { symbol: 'O₂', name: 'Oxígeno disuelto (oxímetro, 0,1 mg/L)', unit: 'mg/L' },
    { symbol: 'pH', name: 'pH leído con la carta de color del azul de bromotimol (cada 0,2)', unit: '—' },
    { symbol: 'S, F', name: 'Caracoles y peces contados', unit: 'individuos' },
    { symbol: 'B_E', name: 'Biomasa fresca de elodea (estimada por la longitud de las ramitas)', unit: 'g' },
    { symbol: 'K', name: 'Capacidad de carga de caracoles con el alimento disponible', unit: 'individuos' },
    { symbol: 'P, R', name: 'Fotosíntesis bruta y respiración de la comunidad en un día', unit: 'mg O₂/L' },
  ],
  equations: [
    'Luz en el frasco: I = 400·(a/100)·(25/d)² µmol/(m²·s), atenuada por el sombreado I/(1 + B_E/30 + algas/4)',
    'Fotosíntesis: P = Pmax·B·I/(I + K_I)·CO₂/(CO₂ + 1)·f(N);  Respiración: R = r·B·O₂/(O₂ + 0,3)',
    'dO₂/dt = (P − R_productores − R_consumidores − R_descomponedores)/V;  dCO₂/dt = −1,375·dO₂/dt (cociente respiratorio 1)',
    'Crecimiento de productores: dB/dt = Y·(P − R) limitado por el nitrógeno disuelto; senescencia → detritos',
    'Caracoles: dS/dt = r·S·(1 − S/K), K = alimento disponible por día / 2 mg;  peces: mueren despacio si les falta alimento',
    'Hipoxia: mortalidad 0,15·(1 − O₂/O₂crít) por hora, con O₂crít = 2,5 mg/L (peces) y 1,5 mg/L (caracoles)',
    'Descomponedores: detritos mineralizados = 0,15·D por día; consumen 1,1 mg O₂ por mg y devuelven 0,05 mg de N por mg',
    'pH = 6,35 + log₁₀(22/CO₂) (alcalinidad 0,5 mmol/L);  azul de bromotimol: amarillo ≤ 6,0 · verde ≈ 6,9 · azul ≥ 7,6',
  ],
  initialConditions: [
    'Frasco de vidrio de 4 L con 3 L de agua de la llave sin cloro a 26 °C, sellado a las 6:00 del día 0, con muy poco aire bajo la tapa.',
    'O₂ = 7,8 mg/L (≈ 96 % de saturación); pH 7,0 (CO₂ ≈ 4,9 mg/L); nitrógeno disuelto 0,6 mg/L; microalgas 0,3 mg/L.',
    'Sedimento con 20 mg de materia orgánica; 3 ramitas de elodea (7,5 g), 4 caracoles y 1 guppy; alimento poco (4 mg/día).',
    'Lámpara LED a 30 cm con el atenuador al 60 % (≈ 167 µmol/(m²·s)) durante 12 h al día.',
  ],
  assumptions: [
    'Frasco sellado y casi lleno: no hay intercambio de gases con el aire; el O₂ por encima de ≈ 150 % de saturación forma burbujas que se pierden.',
    'Temperatura constante de 26 °C (salón de Urabá); agua bien mezclada (concentraciones iguales en todo el frasco).',
    'Fotosíntesis y respiración con cociente 1 (6 CO₂ + 6 H₂O → C₆H₁₂O₆ + 6 O₂): por cada mg de O₂ producido se consumen 1,375 mg de CO₂.',
    'Alcalinidad constante (0,5 mmol/L): el pH depende solo del CO₂ libre. El indicador está en una muestra pequeña extraída con jeringa por el tapón, así que no afecta a los organismos.',
    'Parámetros fisiológicos ilustrativos con orden de magnitud realista (elodea: 0,8 mg O₂/(g·h) a plena luz; guppy: 0,08 mg O₂/h; caracol pequeño: 0,03 mg O₂/h).',
    'Los animales excretan sus desechos como heces que pasan a los detritos; todo el nitrógeno regresa al agua a través de los descomponedores (se desprecia la excreción directa de amonio).',
    'Los guppys no se reproducen en 30 días (la gestación dura ≈ 4 semanas); los caracoles (hermafroditas) sí, si les alcanza el alimento.',
  ],
  limits: [
    'Es un modelo de compartimentos con poblaciones continuas: los individuos se obtienen redondeando; no hay azar (en un frasco real dos réplicas pueden terminar distinto).',
    'No incluye amonio tóxico, nitrificación, fósforo, temperatura variable, enfermedades ni el comportamiento de los animales (los caracoles pulmonados salen a respirar aire si hay cámara de aire).',
    'El sedimento real tiene muchos más microorganismos y procesos (fermentación, sulfatorreducción con olor a huevo podrido): aquí se resumen en una sola tasa de descomposición.',
    'Las microalgas, el perifiton y la elodea se describen con pocos parámetros; los valores sirven para comparar tendencias, no para predecir un frasco concreto.',
    'Un frasco sellado tan pequeño es un sistema frágil: en la naturaleza, el manglar y la ciénaga intercambian agua, aire y organismos con su entorno.',
  ],
  testCases: [
    'Luz: 400·0,6·(25/30)² = 166,7 µmol/(m²·s); al duplicar la distancia la luz se reduce a la cuarta parte; con el atenuador en 0 no hay luz.',
    'pH 7,0 ↔ CO₂ = 22/10^0,65 ≈ 4,92 mg/L; más CO₂ baja el pH; el indicador es amarillo a pH 6,0, verde a 6,9 y azul a 7,6.',
    'Oscuridad (0 h de luz): no hay fotosíntesis, el O₂ cae a casi 0 en pocos días, el CO₂ sube, el pH baja y mueren el pez y los caracoles.',
    'Más horas de luz dan más O₂ y más biomasa de elodea; más consumidores dan menos O₂ al amanecer.',
    'Durante el día (luz) el O₂ sube y el pH aumenta; durante la noche ocurre lo contrario (ciclo diario).',
    'Sobrepoblación (10 caracoles y 4 peces): los caracoles superan la capacidad de carga y su número disminuye hacia K.',
    'Sin descomponedores: los detritos se acumulan, los nutrientes disueltos bajan y la elodea crece menos que con descomponedores.',
    'Exceso de alimento: la descomposición del alimento sobrante agota el O₂ y las algas proliferan.',
    'El carbono y el oxígeno se conservan: O₂ + CO₂/1,375 no cambia mientras no haya burbujas ni descomposición anaerobia.',
    'Las entradas fuera de rango se rechazan.',
  ],
};

/* ------------------------------------------------------------------ condiciones y correcciones */

/** Nivel y corrección de cada advertencia de `simulateEcosystem`, con los mismos umbrales del modelo. */
export function ecosystemConditions(sim: EcoResult): ModelCondition[] {
  const d0 = sim.days[0];
  // Umbral del modelo: más de 1,2·K caracoles o una respiración mayor que 1,25 veces la producción del primer día.
  const maxSnails = Math.floor(d0.snailK * 1.2 + 1e-9);
  return classifyWarnings(sim.warnings, [
    {
      match: 'Oscuridad', level: 'advertencia',
      fix: sim.input.lightHours === 0
        ? 'Sube las «Horas de luz por día» por encima de 0 h para que la elodea haga fotosíntesis.'
        : 'Sube la «Intensidad de la lámpara» por encima de 0 % para que la elodea haga fotosíntesis.',
    },
    { match: 'Sin elodea', level: 'advertencia', fix: 'Agrega al menos una ramita en «Ramitas de elodea» (o arrástrala al frasco).' },
    {
      match: 'Sobrepoblación', level: 'advertencia',
      fix: sim.input.snails > maxSnails
        ? `Baja el «Número de caracoles» a ${num(maxSnails)} o menos (lo que sostiene el alimento elegido), o agrega elodea y luz para producir más oxígeno.`
        : 'Saca guppys o caracoles, o agrega elodea y luz: la respiración del primer día debe quedar por debajo de 1,25 veces la producción de oxígeno.',
    },
    { match: 'Sin descomponedores', level: 'advertencia', fix: 'En «Descomponedores en el sedimento», elige «Sí (lodo de ciénaga)».' },
    { match: 'Exceso de alimento', level: 'advertencia', fix: `En «Alimento cada día», elige «${FOODS.find((f) => f.id === 'normal')!.name}» o menos.` },
  ]);
}
