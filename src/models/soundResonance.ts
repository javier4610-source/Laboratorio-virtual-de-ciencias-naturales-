import { assertInRange, clamp, roundToResolution } from './math';
import { soundSpeedAir } from './waves';
import type { ModelSpec } from './types';

/**
 * Sonido y resonancia (grado 8.º).
 *
 *   Rapidez del sonido en aire seco:     v = 331,3·√(1 + T/273,15) m/s
 *   Longitud de onda:                    λ = v/f
 *   Tubo cerrado en un extremo:          L_n + e = (2n − 1)·λ/4,  e ≈ 0,6·r  (corrección del extremo abierto)
 *   Tubo abierto en los dos extremos:    L_n + 2e = n·λ/2
 *   Resonancias sucesivas (ambos tubos): L_{n+1} − L_n = λ/2   → la corrección e se cancela
 *   Respuesta del tubo con pérdidas:     R = 1/√(cos²(k·L_ef) + senh²δ)   (cerrado; sen² en el abierto)
 *   Nivel sonoro de una fuente puntual:  I = P/(4π·d²),  L = 10·log₁₀(I/I₀),  I₀ = 10⁻¹² W/m²
 *
 * Todas las longitudes del tubo se expresan en centímetros (como las lee el estudiante en la regla);
 * las de onda, en metros.
 */

export const SOUND_LIMITS = {
  temperature: [0, 40] as [number, number], // °C
  closedLength: [2, 95] as [number, number], // cm de columna de aire (tubo de 100 cm con agua)
  openLength: [20, 100] as [number, number], // cm (tubo telescópico abierto)
  generatorFrequency: [100, 1000] as [number, number], // Hz
  distance: [0.25, 4] as [number, number], // m
};

/** Juego escolar de diapasones de la escala «científica» (Do = 256 Hz, entonación justa). */
export interface ForkInfo { f: number; name: string }
export const FORKS: ForkInfo[] = [
  { f: 256, name: 'Do₄ científico' },
  { f: 320, name: 'Mi₄ (5/4 de 256)' },
  { f: 384, name: 'Sol₄ (3/2 de 256)' },
  { f: 426.7, name: 'La₄ (5/3 de 256)' },
  { f: 512, name: 'Do₅ (una octava sobre 256)' },
];

/** Diámetros internos de los tubos disponibles (cm). */
export const TUBE_DIAMETERS = [2.5, 3.5, 5] as const;
/** Corrección del extremo abierto sin pestaña: e ≈ 0,6·r (Levine y Schwinger, 1948: 0,6133·r). */
export const END_CORRECTION_FACTOR = 0.6;
/** Coeficiente de atenuación en las paredes (Kirchhoff): α ≈ 2,9·10⁻⁵·√f / r  (α en 1/m, r en m). */
export const WALL_LOSS = 2.9e-5;
/** Pérdidas adicionales por recorrido (superficie del agua o unión del tubo telescópico y presencia de la fuente en la boca). */
export const EXTRA_LOSS = 0.008;
/** Acoplamiento entre la onda estacionaria del tubo y el micrófono de la boca (adimensional). */
export const MIC_COUPLING = 0.3;
/** Amplitud del sonido directo de la fuente en el micrófono, sin tubo (mV de pico). */
export const DIRECT_MV = { diapason: 12, generador: 20 } as const;
/** Umbral de intensidad audible de referencia (W/m²). */
export const I0 = 1e-12;
/** Ruido de fondo de un salón en silencio (dB). */
export const BACKGROUND_DB = 35;
/** Sensibilidad del micrófono con su amplificador (mV de salida por Pa de presión). */
export const MIC_SENSITIVITY = 500;
/** Potencias acústicas del parlante (W). */
export const SPEAKER_POWERS = [
  { id: 'baja', name: 'Baja (0,01 mW)', watts: 1e-5 },
  { id: 'media', name: 'Media (0,1 mW)', watts: 1e-4 },
  { id: 'alta', name: 'Alta (1 mW)', watts: 1e-3 },
] as const;
export type SpeakerPowerId = (typeof SPEAKER_POWERS)[number]['id'];

/** Tiempo de decaimiento (1/e) de la amplitud del diapasón en la simulación (s). */
export const FORK_TAU = 2.5;
/**
 * Parciales del diapasón: [razón de frecuencia, amplitud relativa, tiempo de decaimiento (s)].
 * El primer modo de flexión superior de una barra en voladizo está a 6,267·f (sonido metálico del golpe);
 * el armónico 2f es pequeño (asimetría de la vibración).
 */
export const FORK_PARTIALS: [number, number, number][] = [
  [1, 1, FORK_TAU],
  [2, 0.04, FORK_TAU / 3],
  [6.267, 0.18, 0.12],
];

export type TubeType = 'cerrado' | 'abierto';
export type SourceId = 'diapason' | 'generador';

/* ------------------------------------------------------------------ rapidez y longitud de onda */

/** Rapidez del sonido en aire seco (m/s), modelo de gas ideal: v = 331,3·√(1 + T/273,15). */
export function speedOfSound(tempC: number): number {
  assertInRange('La temperatura del aire', tempC, -40, 60);
  return 331.3 * Math.sqrt(1 + tempC / 273.15);
}

/** Diferencia con la aproximación lineal usada en la práctica de ondas (331,3 + 0,606·T). */
export function linearApproxError(tempC: number): number {
  return soundSpeedAir(tempC) - speedOfSound(tempC);
}

/** Longitud de onda en el aire (m). */
export function wavelength(f: number, tempC: number): number {
  assertInRange('La frecuencia', f, 20, 20000);
  return speedOfSound(tempC) / f;
}

/** Corrección de extremo (cm) para un tubo de diámetro interno dado (cm). */
export function endCorrection(diameterCm: number): number {
  assertInRange('El diámetro del tubo', diameterCm, 0.5, 10);
  return END_CORRECTION_FACTOR * (diameterCm / 2);
}

const openEnds = (type: TubeType) => (type === 'cerrado' ? 1 : 2);

/** Longitud acústica efectiva (cm): la longitud física más una corrección por cada extremo abierto. */
export function effectiveLength(lengthCm: number, diameterCm: number, type: TubeType): number {
  return lengthCm + openEnds(type) * endCorrection(diameterCm);
}

/** Longitudes físicas de resonancia (cm) dentro del intervalo [minCm, maxCm]. */
export function resonanceLengths(f: number, tempC: number, diameterCm: number, type: TubeType, minCm = 0, maxCm = 100): number[] {
  const lam = wavelength(f, tempC) * 100;
  const corr = openEnds(type) * endCorrection(diameterCm);
  const out: number[] = [];
  for (let n = 1; n < 200; n++) {
    const L = (type === 'cerrado' ? ((2 * n - 1) * lam) / 4 : (n * lam) / 2) - corr;
    if (L > maxCm) break;
    if (L >= minCm) out.push(L);
  }
  return out;
}

/* ------------------------------------------------------------------ respuesta del tubo con pérdidas */

export interface TubeInput { f: number; tempC: number; lengthCm: number; diameterCm: number; type: TubeType; source: SourceId }

export interface TubeResponse {
  /** Número de onda (rad/m). */
  k: number;
  /** k·L_ef (rad). */
  phase: number;
  /** Pérdida total por recorrido (adimensional). */
  delta: number;
  /** Factor de refuerzo de la onda estacionaria (≈ 1 lejos de la resonancia; ≈ 1/senh δ en ella). */
  response: number;
  /** Amplitud de pico de la señal del micrófono (mV). */
  micMv: number;
  /** Refuerzo respecto al sonido directo (dB). */
  gainDb: number;
}

/** Pérdida por recorrido: radiación en cada boca, viscosidad y conducción en las paredes, y pérdidas adicionales. */
export function tubeLoss(f: number, tempC: number, lengthEffCm: number, diameterCm: number, type: TubeType): number {
  const a = diameterCm / 200; // radio en m
  const k = (2 * Math.PI * f) / speedOfSound(tempC);
  const radiation = (openEnds(type) * (k * a) ** 2) / 4;
  const walls = ((WALL_LOSS * Math.sqrt(f)) / a) * (lengthEffCm / 100);
  return radiation + walls + EXTRA_LOSS;
}

export function tubeResponse(input: TubeInput): TubeResponse {
  const { f, tempC, lengthCm, diameterCm, type, source } = input;
  assertInRange('La frecuencia', f, 20, 20000);
  assertInRange('La temperatura del aire', tempC, ...SOUND_LIMITS.temperature);
  const lim = type === 'cerrado' ? SOUND_LIMITS.closedLength : SOUND_LIMITS.openLength;
  assertInRange('La longitud de la columna de aire', lengthCm, lim[0], lim[1]);
  const Leff = effectiveLength(lengthCm, diameterCm, type);
  const k = (2 * Math.PI * f) / speedOfSound(tempC);
  const phase = k * (Leff / 100);
  const delta = tubeLoss(f, tempC, Leff, diameterCm, type);
  const osc = type === 'cerrado' ? Math.cos(phase) : Math.sin(phase);
  const response = 1 / Math.sqrt(osc * osc + Math.sinh(delta) ** 2);
  const factor = Math.sqrt(1 + (MIC_COUPLING * response) ** 2);
  return { k, phase, delta, response, micMv: DIRECT_MV[source] * factor, gainDb: 20 * Math.log10(factor) };
}

export interface ResonanceInfo { n: number; lengthCm: number; delta: number; Q: number; widthCm: number; peakMv: number }

/**
 * Resonancias del tubo con su factor de calidad Q = k·L_ef/(2δ) y el ancho del pico a media potencia
 * medido en longitud de la columna, ΔL = 2δ/k.
 */
export function resonances(f: number, tempC: number, diameterCm: number, type: TubeType, source: SourceId = 'diapason'): ResonanceInfo[] {
  const lim = type === 'cerrado' ? SOUND_LIMITS.closedLength : SOUND_LIMITS.openLength;
  return resonanceLengths(f, tempC, diameterCm, type, lim[0], lim[1]).map((L, i) => {
    const r = tubeResponse({ f, tempC, lengthCm: L, diameterCm, type, source });
    return { n: type === 'cerrado' ? 2 * i + 1 : i + 1, lengthCm: L, delta: r.delta, Q: r.phase / (2 * r.delta), widthCm: ((2 * r.delta) / r.k) * 100, peakMv: r.micMv };
  });
}

export interface ResonanceAnalysis { deltaLcm: number; lambdaM: number; speed: number; endCorrectionCm: number; speedNaive: number }

/**
 * Análisis del estudiante con dos resonancias sucesivas: λ = 2·(L₂ − L₁), v = λ·f, y la corrección de extremo
 * que se deduce (cerrado: e = λ/4 − L₁; abierto: e = (λ/2 − L₁)/2). `speedNaive` es la rapidez que se obtendría
 * ignorando la corrección (4·L₁·f en el tubo cerrado, 2·L₁·f en el abierto).
 */
export function analyzeResonances(L1cm: number, L2cm: number, f: number, type: TubeType): ResonanceAnalysis {
  if (!(L2cm > L1cm)) throw new RangeError('La segunda resonancia debe ser más larga que la primera.');
  assertInRange('La frecuencia', f, 20, 20000);
  const deltaLcm = L2cm - L1cm;
  const lambdaM = (2 * deltaLcm) / 100;
  const lamCm = lambdaM * 100;
  const endCorrectionCm = type === 'cerrado' ? lamCm / 4 - L1cm : (lamCm / 2 - L1cm) / 2;
  const speedNaive = ((type === 'cerrado' ? 4 : 2) * L1cm * f) / 100;
  return { deltaLcm, lambdaM, speed: lambdaM * f, endCorrectionCm, speedNaive };
}

/* ------------------------------------------------------------------ osciloscopio */

export const SCOPE = {
  divX: 10,
  divY: 8,
  /** Tiempo por división (ms). */
  timePerDiv: [0.1, 0.2, 0.5, 1, 2, 5],
  /** Sensibilidad vertical (mV por división). */
  voltsPerDiv: [2, 5, 10, 20, 50, 100],
  /** Resolución de lectura con los cursores: una subdivisión de la retícula (div). */
  cursorDiv: 0.2,
};

export interface ScopeView {
  periodMs: number;
  /** Periodos completos que caben en la pantalla. */
  periodsOnScreen: number;
  /** Periodos que abarcan los cursores (máximo 10). */
  n: number;
  /** Duración de esos n periodos (ms). */
  spanMs: number;
  timeRes: number;
  voltRes: number;
  /** El pico de la señal sale de la pantalla (± 4 div). */
  clipped: boolean;
  /** La señal ocupa menos de media división: lectura poco precisa. */
  small: boolean;
}

export function scopeView(f: number, vpkMv: number, timePerDivMs: number, voltsPerDivMv: number): ScopeView {
  assertInRange('La frecuencia', f, 20, 20000);
  if (!(timePerDivMs > 0) || !(voltsPerDivMv > 0)) throw new RangeError('Las escalas del osciloscopio deben ser positivas.');
  const periodMs = 1000 / f;
  const periodsOnScreen = (SCOPE.divX * timePerDivMs) / periodMs;
  const n = Math.min(10, Math.floor(periodsOnScreen + 1e-9));
  return {
    periodMs, periodsOnScreen, n, spanMs: n * periodMs,
    timeRes: SCOPE.cursorDiv * timePerDivMs, voltRes: SCOPE.cursorDiv * voltsPerDivMv,
    clipped: vpkMv > (SCOPE.divY / 2) * voltsPerDivMv, small: vpkMv < 0.5 * voltsPerDivMv,
  };
}

/** Lectura ideal con los cursores: duración de n periodos y amplitud, redondeadas a una subdivisión. */
export function scopeReading(f: number, vpkMv: number, timePerDivMs: number, voltsPerDivMv: number): { periodMs: number | null; freqHz: number | null; ampMv: number | null } {
  const v = scopeView(f, vpkMv, timePerDivMs, voltsPerDivMv);
  const periodMs = v.n >= 1 ? roundToResolution(v.spanMs, v.timeRes) / v.n : null;
  return {
    periodMs,
    freqHz: periodMs ? 1000 / periodMs : null,
    ampMv: v.clipped ? null : roundToResolution(vpkMv, v.voltRes),
  };
}

/* ------------------------------------------------------------------ intensidad y nivel sonoro */

/** Intensidad (W/m²) de una fuente puntual en campo libre: I = P/(4π·d²). */
export function intensityAt(powerW: number, distanceM: number): number {
  if (!(powerW > 0)) throw new RangeError('La potencia debe ser positiva.');
  assertInRange('La distancia', distanceM, 0.01, 1000);
  return powerW / (4 * Math.PI * distanceM ** 2);
}

/** Nivel de intensidad (dB) a partir de la intensidad. */
export const intensityToLevel = (I: number) => 10 * Math.log10(I / I0);
/** Intensidad (W/m²) a partir del nivel (dB). */
export const levelToIntensity = (L: number) => I0 * 10 ** (L / 10);

/** Nivel sonoro (dB) que marca el sonómetro: el del parlante sumado en energía con el ruido de fondo. */
export function soundLevel(powerW: number, distanceM: number, backgroundDb = BACKGROUND_DB): number {
  const I = intensityAt(powerW, distanceM) + levelToIntensity(backgroundDb);
  return intensityToLevel(I);
}

/** Impedancia característica del aire ρ·c (Pa·s/m) a la temperatura dada y 1 atm. */
export function airImpedance(tempC: number): number {
  const rho = 101325 / (287.05 * (tempC + 273.15));
  return rho * speedOfSound(tempC);
}

/** Amplitud de pico (mV) del micrófono frente al parlante: p_rms = √(I·ρc), V = S·√2·p_rms. */
export function freeFieldMicMv(powerW: number, distanceM: number, tempC: number): number {
  const pRms = Math.sqrt(intensityAt(powerW, distanceM) * airImpedance(tempC));
  return MIC_SENSITIVITY * Math.SQRT2 * pRms;
}

/* ------------------------------------------------------------------ altura (tono) */

const NOTE_NAMES = ['Do', 'Do♯', 'Re', 'Re♯', 'Mi', 'Fa', 'Fa♯', 'Sol', 'Sol♯', 'La', 'La♯', 'Si'];
const SUBSCRIPT = ['₀', '₁', '₂', '₃', '₄', '₅', '₆', '₇', '₈', '₉'];

/** Nota temperada más cercana (La₄ = 440 Hz) y desviación en cents (1/100 de semitono). */
export function nearestNote(f: number): { midi: number; name: string; cents: number } {
  assertInRange('La frecuencia', f, 20, 20000);
  const exact = 69 + 12 * Math.log2(f / 440);
  const midi = Math.round(exact);
  const octave = Math.floor(midi / 12) - 1;
  return { midi, name: `${NOTE_NAMES[midi % 12]}${SUBSCRIPT[octave] ?? octave}`, cents: (exact - midi) * 100 };
}

/** Octavas por encima de una frecuencia de referencia: log₂(f/f_ref). Duplicar f sube una octava. */
export function octavesAbove(f: number, ref = 256): number {
  return Math.log2(f / ref);
}

/* ------------------------------------------------------------------ envolvente del diapasón y nivel de reproducción */

/** Amplitud relativa del diapasón t segundos después del golpe (decaimiento exponencial). */
export function forkEnvelope(t: number, tau = FORK_TAU): number {
  return t <= 0 ? 1 : Math.exp(-t / tau);
}

/** Nivel relativo de reproducción (0 a 1) proporcional a la amplitud del micrófono; 200 mV = nivel máximo. */
export function playbackLevel(micMv: number, fullScaleMv = 200): number {
  return clamp(micMv / fullScaleMv, 0, 1);
}

/* ------------------------------------------------------------------ instrumentos */

export const RULER_RES = 0.1; // cm
export const METER_RES = 0.1; // dB
export const TAPE_RES = 0.01; // m

export const rulerReading = (lengthCm: number) => roundToResolution(lengthCm, RULER_RES);
export const meterReading = (levelDb: number) => roundToResolution(levelDb, METER_RES);

/** Instrumentos (respaldo si la ficha de la práctica no está integrada en src/labs/instruments.ts). */
export const SOUND_INSTRUMENTS = [
  { id: 'regla', name: 'Cinta métrica junto al tubo (1 mm)', quantity: 'Longitud de la columna de aire', unit: 'cm', resolution: RULER_RES, sigma: 0.15, note: 'El menisco del agua (o el borde del tubo deslizante) y la boca del tubo no están a la altura del ojo: paralaje. Además, el pico de sonido es ancho y cuesta decidir dónde es máximo.' },
  { id: 'osciloscopio', name: 'Osciloscopio con cursores (retícula de 10 × 8 div)', quantity: 'Lectura de tiempo y de voltaje en la pantalla', unit: 'div', resolution: SCOPE.cursorDiv, sigma: 0.1, note: 'El grosor del trazo y la ubicación de los cursores: la incertidumbre en ms o en mV depende de la escala elegida (tiempo/div y volts/div).' },
  { id: 'sonometro', name: 'Sonómetro digital (ponderación Z, 30 a 130 dB)', quantity: 'Nivel sonoro', unit: 'dB', resolution: METER_RES, sigma: 0.4, note: 'Reflexiones en las paredes y la mesa, ruido del salón y orientación del micrófono.' },
  { id: 'cinta', name: 'Cinta métrica sobre la mesa', quantity: 'Distancia al parlante', unit: 'm', resolution: TAPE_RES, sigma: 0.005, note: 'Ubicar el centro del parlante y la rejilla del micrófono del sonómetro.' },
];

export const soundModelSpec: ModelSpec = {
  name: 'Rapidez del sonido, resonancia en tubos, osciloscopio y nivel sonoro',
  inputs: [
    { symbol: 'f', name: 'Frecuencia de la fuente (diapasón: 256, 320, 384, 426,7 o 512 Hz; generador: 100 a 1000 Hz)', unit: 'Hz', range: SOUND_LIMITS.generatorFrequency, initial: 512 },
    { symbol: 'T', name: 'Temperatura del aire', unit: '°C', range: SOUND_LIMITS.temperature, initial: 28 },
    { symbol: 'L', name: 'Longitud de la columna de aire (cerrado: 2 a 95 cm; abierto: 20 a 100 cm)', unit: 'cm', range: [2, 100], initial: 10 },
    { symbol: 'D', name: 'Diámetro interno del tubo (2,5; 3,5 o 5,0 cm)', unit: 'cm', range: [2.5, 5], initial: 3.5 },
    { symbol: 'tiempo/div, volts/div', name: 'Escalas del osciloscopio', unit: 'ms/div, mV/div', initial: '0,5 ms/div y 10 mV/div' },
    { symbol: 'd', name: 'Distancia del sonómetro al parlante', unit: 'm', range: SOUND_LIMITS.distance, initial: 1 },
    { symbol: 'P', name: 'Potencia acústica del parlante', unit: 'W', initial: 1e-4 },
  ],
  outputs: [
    { symbol: 'v', name: 'Rapidez del sonido', unit: 'm/s' },
    { symbol: 'λ', name: 'Longitud de onda', unit: 'm' },
    { symbol: 'L_n', name: 'Longitudes de resonancia', unit: 'cm' },
    { symbol: 'Q, ΔL', name: 'Factor de calidad y ancho del pico de resonancia', unit: '—, cm' },
    { symbol: 'V_p', name: 'Amplitud de pico de la señal del micrófono', unit: 'mV' },
    { symbol: 'T', name: 'Periodo leído en el osciloscopio', unit: 'ms' },
    { symbol: 'L_I', name: 'Nivel sonoro', unit: 'dB' },
  ],
  equations: [
    'v = 331,3·√(1 + T/273,15) m/s   (≈ 347,9 m/s a 28 °C, Apartadó)',
    'λ = v/f   ·   periodo T = 1/f',
    'Tubo cerrado: L_n + e = (2n − 1)·λ/4, con e ≈ 0,6·r',
    'Tubo abierto: L_n + 2e = n·λ/2',
    'Dos resonancias sucesivas: L₂ − L₁ = λ/2  →  v = 2·(L₂ − L₁)·f (sin conocer e)',
    'Respuesta con pérdidas: R = 1/√(cos²(k·L_ef) + senh²δ), δ = (k·r)²/4 por boca + α·L_ef + 0,008, α = 2,9·10⁻⁵·√f/r',
    'Q = k·L_ef/(2δ)   ·   ancho del pico ΔL = 2δ/k',
    'Micrófono: V_p = V_directo·√(1 + (0,3·R)²)',
    'I = P/(4π·d²),  L = 10·log₁₀(I/10⁻¹² W/m²): al duplicar d, el nivel baja 6,0 dB',
    'Altura: nota más cercana con La₄ = 440 Hz; duplicar f sube una octava',
  ],
  initialConditions: ['Tubo de 100 cm cerrado por agua, diámetro interno 3,5 cm, columna de aire de 10,0 cm, diapasón de 512 Hz, aire a 28 °C (Apartadó), osciloscopio en 0,5 ms/div y 10 mV/div.'],
  assumptions: [
    'Aire seco que se comporta como gas ideal; se ignoran la humedad (en Urabá sube v unos 1 a 2 m/s) y el viento.',
    'La onda dentro del tubo es plana (el diámetro es mucho menor que λ) y la corrección del extremo abierto es e = 0,6·r (tubo sin pestaña).',
    'La superficie del agua (o el émbolo) refleja casi toda la onda; las pérdidas incluyen radiación por la boca, viscosidad y conducción de calor en las paredes y una pérdida adicional fija de 0,008 por recorrido, ajustada para que el pico se parezca al de un tubo escolar.',
    'La amplitud del micrófono es relativa: se calibra para que el sonido directo del diapasón sea de 12 mV de pico (20 mV con el parlante del generador).',
    'El parlante se trata como una fuente puntual en campo libre (sin ecos); el sonómetro suma en energía un ruido de fondo de 35 dB.',
    'El diapasón decae con un tiempo característico de 2,5 s (un diapasón real suena más tiempo); el golpe siempre tiene la misma fuerza en modo ideal.',
  ],
  limits: [
    'No se modela la radiación de la boca hacia el micrófono con detalle (direccionalidad, distancia exacta) ni el acoplamiento mecánico entre el diapasón y el tubo.',
    'Para d < 0,25 m el parlante no se comporta como fuente puntual (campo cercano); en un salón real las reflexiones hacen que el nivel baje menos de 6 dB al duplicar la distancia.',
    'El sonido que se reproduce en el computador es una ilustración a bajo volumen: su intensidad real depende de los parlantes o audífonos, así que no sirve para medir decibeles.',
    'La aproximación v = 331,3·√(1 + T/273,15) es válida para aire entre unos −40 y 60 °C; no aplica a otros gases.',
  ],
  testCases: [
    'v(0 °C) = 331,3 m/s; v(28 °C) ≈ 347,86 m/s; v crece con T y la aproximación lineal de la práctica de ondas difiere menos de 1 m/s entre 0 y 40 °C.',
    'Con 512 Hz a 28 °C y D = 3,5 cm: L₁ ≈ 15,93 cm, L₂ ≈ 49,91 cm; L₂ − L₁ = λ/2 en tubo cerrado y abierto.',
    'El máximo de la amplitud del micrófono al barrer L coincide con L_n (± 0,05 cm) y es varias veces mayor que fuera de resonancia.',
    'v = 2·(L₂ − L₁)·f recupera la rapidez del modelo; 4·L₁·f la subestima por la corrección de extremo.',
    'El osciloscopio: 512 Hz en 0,5 ms/div → 2 periodos en pantalla, T leído = 1,95 ms; la señal se recorta si V_p > 4 div.',
    'Duplicar la distancia reduce el nivel 6,02 dB (sin ruido de fondo) y la intensidad a la cuarta parte.',
    'Duplicar la frecuencia sube exactamente una octava; 440 Hz es La₄ con 0 cents.',
    'Las entradas fuera de rango lanzan RangeError.',
  ],
};
