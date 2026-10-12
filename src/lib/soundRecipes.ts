/**
 * Recetas de síntesis de los sonidos del laboratorio (Web Audio API, sin archivos de audio).
 *
 * Cada receta programa nodos a partir del instante `t` y devuelve su duración aproximada en segundos.
 * Los timbres buscan realismo con pocos recursos: parciales inarmónicos para vidrio y metal,
 * ruido filtrado para líquidos, aire y fricción, «chirridos» ascendentes para burbujas (resonancia
 * de Minnaert) y trenes de pulsos filtrados para crujidos (deslizamiento intermitente).
 */
import { envelopePoints, type EnvelopeSpec } from './soundMath';

export interface Kit {
  ctx: AudioContext;
  /** Entrada de la voz (ganancia y paneo propios), conectada al bus con reverberación. */
  out: AudioNode;
  white: AudioBuffer;
  brown: AudioBuffer;
  crackle: AudioBuffer;
}

export interface RecipeOptions {
  /** 0 a 1: escala la fuerza del golpe, el caudal, la velocidad… */
  intensity?: number;
  /** Duración deseada para sonidos sostenidos de una sola vez (vertido, efervescencia). */
  duration?: number;
  /** Frecuencia base alternativa (pitidos). */
  freq?: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);

export function applyEnvelope(param: AudioParam, t0: number, spec: EnvelopeSpec): number {
  const pts = envelopePoints(spec);
  param.cancelScheduledValues(t0);
  for (const p of pts) {
    const at = t0 + p.t;
    if (p.curve === 'set') param.setValueAtTime(p.v, at);
    else if (p.curve === 'lin') param.linearRampToValueAtTime(p.v, at);
    else param.exponentialRampToValueAtTime(Math.max(p.v, 1e-4), at);
  }
  return pts[pts.length - 1].t;
}

interface FilterSpec { type: BiquadFilterType; freq: number; Q?: number; freqEnd?: number; sweep?: number; gain?: number }

function makeFilter(k: Kit, t: number, f: FilterSpec): BiquadFilterNode {
  const node = k.ctx.createBiquadFilter();
  node.type = f.type;
  node.frequency.setValueAtTime(f.freq, t);
  if (f.freqEnd) node.frequency.exponentialRampToValueAtTime(f.freqEnd, t + (f.sweep ?? 0.2));
  if (f.Q !== undefined) node.Q.value = f.Q;
  if (f.gain !== undefined) node.gain.value = f.gain;
  return node;
}

interface ToneSpec { freq: number; type?: OscillatorType; freqEnd?: number; glide?: number; env: EnvelopeSpec; gain: number; detune?: number; dest?: AudioNode; filter?: FilterSpec }

export function tone(k: Kit, t: number, s: ToneSpec): number {
  const osc = k.ctx.createOscillator();
  osc.type = s.type ?? 'sine';
  osc.frequency.setValueAtTime(s.freq, t);
  if (s.freqEnd) osc.frequency.exponentialRampToValueAtTime(s.freqEnd, t + (s.glide ?? 0.1));
  if (s.detune) osc.detune.value = s.detune;
  const g = k.ctx.createGain();
  const dur = applyEnvelope(g.gain, t, { ...s.env, peak: s.gain });
  let head: AudioNode = osc;
  if (s.filter) { const f = makeFilter(k, t, s.filter); head.connect(f); head = f; }
  head.connect(g).connect(s.dest ?? k.out);
  osc.start(t);
  osc.stop(t + dur + 0.05);
  osc.onended = () => { try { g.disconnect(); } catch { /* ya desconectado */ } };
  return dur;
}

interface NoiseSpec { buffer?: 'white' | 'brown' | 'crackle'; filters?: FilterSpec[]; env: EnvelopeSpec; gain: number; rate?: number; dest?: AudioNode }

export function noise(k: Kit, t: number, s: NoiseSpec): number {
  const src = k.ctx.createBufferSource();
  const buf = s.buffer === 'brown' ? k.brown : s.buffer === 'crackle' ? k.crackle : k.white;
  src.buffer = buf;
  src.loop = true;
  if (s.rate) src.playbackRate.value = s.rate;
  const g = k.ctx.createGain();
  const dur = applyEnvelope(g.gain, t, { ...s.env, peak: s.gain });
  let head: AudioNode = src;
  for (const f of s.filters ?? []) { const node = makeFilter(k, t, f); head.connect(node); head = node; }
  head.connect(g).connect(s.dest ?? k.out);
  src.start(t, rand(0, buf.duration * 0.9));
  src.stop(t + dur + 0.05);
  src.onended = () => { try { g.disconnect(); } catch { /* ya desconectado */ } };
  return dur;
}

/** Burbuja: seno con subida exponencial de frecuencia (la burbuja se acerca a la superficie). */
export function bubble(k: Kit, t: number, gain = 0.18, f0 = rand(350, 1300)): number {
  return tone(k, t, { freq: f0, freqEnd: f0 * rand(1.35, 1.9), glide: rand(0.03, 0.07), gain, env: { attack: 0.002, decay: rand(0.04, 0.09) } });
}

/** Parciales inarmónicos (vidrio, metal) con un pequeño batimiento en el segundo modo. */
function struck(k: Kit, t: number, f0: number, modes: [number, number, number][], gain: number): number {
  let end = 0;
  modes.forEach(([ratio, amp, decay], i) => {
    end = Math.max(end, tone(k, t, { freq: f0 * ratio, gain: gain * amp, env: { attack: 0.0015, decay } }));
    if (i === 1) tone(k, t, { freq: f0 * ratio + rand(2, 5), gain: gain * amp * 0.6, env: { attack: 0.0015, decay: decay * 0.9 } });
  });
  return end;
}

/** Crujido: tren de pulsos (diente de sierra a pocas decenas de Hz) a través de formantes resonantes. */
function creakVoice(k: Kit, t: number, rate0: number, rate1: number, dur: number, formants: [number, number, number][], gain: number): number {
  const osc = k.ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(rate0, t);
  const steps = 6;
  for (let i = 1; i <= steps; i++) osc.frequency.linearRampToValueAtTime(rate0 + (rate1 - rate0) * (i / steps) * rand(0.7, 1.3), t + (dur * i) / steps);
  const g = k.ctx.createGain();
  applyEnvelope(g.gain, t, { attack: 0.04, decay: 0.08, sustain: 0.8, sustainTime: Math.max(0, dur - 0.16), release: 0.08, peak: gain });
  for (const [f, Q, a] of formants) {
    const bp = makeFilter(k, t, { type: 'bandpass', freq: f, Q });
    const ga = k.ctx.createGain();
    ga.gain.value = a;
    osc.connect(bp).connect(ga).connect(g);
  }
  g.connect(k.out);
  osc.start(t);
  osc.stop(t + dur + 0.1);
  osc.onended = () => { try { g.disconnect(); } catch { /* ya desconectado */ } };
  return dur + 0.1;
}

function piezo(k: Kit, t: number, freq: number, len: number, gain = 0.07): number {
  tone(k, t, { freq: freq * 3, gain: gain * 0.12, env: { attack: 0.002, hold: len, decay: 0.01 } });
  return tone(k, t, { freq, gain, env: { attack: 0.002, hold: len, decay: 0.012 } });
}

type Recipe = (k: Kit, t: number, o: RecipeOptions) => number;

export const RECIPES = {
  /** Vidrio que choca (vaso, probeta, tubo de ensayo). */
  glassClink: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    noise(k, t, { filters: [{ type: 'highpass', freq: 5000 }], gain: 0.2 * i, env: { attack: 0.0008, decay: 0.006 } });
    return struck(k, t, rand(1550, 1850), [[1, 1, 0.55], [2.78, 0.5, 0.35], [5.18, 0.26, 0.2], [8.3, 0.12, 0.1]], 0.22 * i);
  },
  /** Pesas o piezas metálicas que chocan. */
  clank: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    noise(k, t, { filters: [{ type: 'lowpass', freq: 1600 }], gain: 0.35 * i, env: { attack: 0.001, decay: 0.03 } });
    tone(k, t, { freq: 130, freqEnd: 90, glide: 0.06, gain: 0.2 * i, env: { attack: 0.001, decay: 0.07 } });
    return struck(k, t, rand(360, 440), [[1, 1, 0.32], [2.76, 0.6, 0.24], [5.4, 0.35, 0.14], [8.93, 0.18, 0.08]], 0.16 * i);
  },
  /** Gota que cae en agua (bureta, gotero). */
  drop: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    noise(k, t, { filters: [{ type: 'highpass', freq: 3000 }], gain: 0.05 * i, env: { attack: 0.0008, decay: 0.004 } });
    const f = rand(480, 700);
    return tone(k, t, { freq: f, freqEnd: f * rand(2, 2.5), glide: 0.035, gain: 0.32 * i, env: { attack: 0.002, decay: 0.08 } });
  },
  /** Goteo de la bureta o del gotero: varias gotas a lo largo de `duration`. */
  drips: (k, t, o) => {
    const d = o.duration ?? 0.6;
    const n = Math.max(1, Math.round(d * 7));
    for (let j = 0; j < n; j++) RECIPES.drop(k, t + (j * d) / n + rand(0, 0.03), { intensity: (o.intensity ?? 0.6) * rand(0.7, 1) });
    return d + 0.1;
  },
  /** Una burbuja suelta. */
  bubble: (k, t, o) => bubble(k, t, 0.2 * (o.intensity ?? 0.7)),
  /** Chapoteo: objeto que entra al agua. */
  splash: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    noise(k, t, { filters: [{ type: 'lowpass', freq: 5000, freqEnd: 700, sweep: 0.25 }, { type: 'highpass', freq: 250 }], gain: 0.45 * i, env: { attack: 0.004, decay: 0.3 } });
    tone(k, t, { freq: 190, freqEnd: 90, glide: 0.08, gain: 0.3 * i, env: { attack: 0.002, decay: 0.1 } });
    const n = Math.round(3 + 4 * i);
    for (let b = 0; b < n; b++) bubble(k, t + rand(0.05, 0.45), 0.12 * i);
    return 0.55;
  },
  /** Vertido de líquido: el tono del recipiente sube a medida que se llena. */
  pour: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    const d = o.duration ?? 1.1;
    const env = { attack: 0.08, decay: 0.1, sustain: 0.85, sustainTime: Math.max(0.1, d - 0.3), release: 0.2 };
    noise(k, t, { filters: [{ type: 'bandpass', freq: 520, Q: 1.4, freqEnd: 1500, sweep: d }], gain: 0.4 * i, env });
    noise(k, t, { buffer: 'brown', filters: [{ type: 'lowpass', freq: 420 }], gain: 0.35 * i, env });
    const n = Math.round(d * 10 * (0.5 + i));
    for (let b = 0; b < n; b++) bubble(k, t + rand(0.05, d), 0.08 * i);
    return d + 0.2;
  },
  /** Agitar o remolinear un recipiente. */
  swirl: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    const src = k.ctx.createBufferSource();
    src.buffer = k.white; src.loop = true;
    const bp = k.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 2.2;
    bp.frequency.setValueCurveAtTime(new Float32Array([500, 1150, 620, 1050, 480]), t, 0.9);
    const g = k.ctx.createGain();
    applyEnvelope(g.gain, t, { attack: 0.12, decay: 0.1, sustain: 0.8, sustainTime: 0.5, release: 0.2, peak: 0.3 * i });
    src.connect(bp).connect(g).connect(k.out);
    src.start(t, rand(0, 1)); src.stop(t + 1.05);
    for (let b = 0; b < 3; b++) bubble(k, t + rand(0.1, 0.8), 0.07 * i);
    return 1;
  },
  /** Efervescencia: chisporroteo agudo de burbujas que revientan. */
  fizz: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    const d = o.duration ?? 1.6;
    noise(k, t, { buffer: 'crackle', filters: [{ type: 'highpass', freq: 2200 }, { type: 'peaking', freq: 5200, Q: 1, gain: 4 }], gain: 0.55 * i, env: { attack: 0.03, decay: 0.25, sustain: 0.7, sustainTime: Math.max(0.1, d - 0.6), release: 0.35 } });
    noise(k, t, { filters: [{ type: 'highpass', freq: 6500 }], gain: 0.04 * i, env: { attack: 0.05, decay: d } });
    return d;
  },
  /** Botón de membrana de balanza o equipo con pantalla LCD. */
  click: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    tone(k, t, { freq: 1800, gain: 0.08 * i, env: { attack: 0.0008, decay: 0.02 } });
    return noise(k, t, { filters: [{ type: 'bandpass', freq: 3500, Q: 2 }], gain: 0.6 * i, env: { attack: 0.0005, decay: 0.012 } });
  },
  /** Pitido de equipo electrónico (piezoeléctrico). */
  beep: (k, t, o) => piezo(k, t, o.freq ?? 2730, 0.07),
  /** Tarar la balanza: clic del botón y pitido corto. */
  tare: (k, t) => {
    RECIPES.click(k, t, { intensity: 0.6 });
    return 0.06 + piezo(k, t + 0.06, 2730, 0.09);
  },
  /** Fotopuerta o cronómetro: pitido breve. */
  photogate: (k, t, o) => piezo(k, t, o.freq ?? 2000, 0.035, 0.06),
  /** Tic seco de la fotopuerta del péndulo (cada paso). */
  tick: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    tone(k, t, { freq: o.freq ?? 1250, gain: 0.07 * i, env: { attack: 0.0008, decay: 0.012 } });
    return noise(k, t, { filters: [{ type: 'highpass', freq: 3000 }], gain: 0.15 * i, env: { attack: 0.0005, decay: 0.004 } });
  },
  /** Interruptor de palanca: dos contactos y un golpe grave del mecanismo. */
  switch: (k, t, o) => {
    const i = o.intensity ?? 0.8;
    noise(k, t, { filters: [{ type: 'highpass', freq: 2500 }], gain: 0.5 * i, env: { attack: 0.0005, decay: 0.006 } });
    noise(k, t + 0.012, { filters: [{ type: 'bandpass', freq: 1200, Q: 1.5 }], gain: 0.3 * i, env: { attack: 0.0005, decay: 0.012 } });
    return tone(k, t, { freq: 150, freqEnd: 80, glide: 0.03, gain: 0.22 * i, env: { attack: 0.001, decay: 0.035 } });
  },
  /** Silbido de aire breve (soplador, émbolo que sale). */
  whoosh: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    const src = k.ctx.createBufferSource();
    src.buffer = k.white; src.loop = true;
    const bp = k.ctx.createBiquadFilter();
    bp.type = 'bandpass'; bp.Q.value = 1.1;
    bp.frequency.setValueCurveAtTime(new Float32Array([300, 900, 1600, 900, 350]), t, 0.5);
    const g = k.ctx.createGain();
    applyEnvelope(g.gain, t, { attack: 0.15, decay: 0.35, peak: 0.3 * i });
    src.connect(bp).connect(g).connect(k.out);
    src.start(t, rand(0, 1)); src.stop(t + 0.55);
    return 0.55;
  },
  /** Choque de deslizadores en el riel de aire; el brillo y la fuerza crecen con la rapidez. */
  clack: (k, t, o) => {
    const i = Math.max(0.15, o.intensity ?? 0.7);
    noise(k, t, { filters: [{ type: 'bandpass', freq: 1500 + 2000 * i, Q: 3 }], gain: 0.9 * i, env: { attack: 0.0005, decay: 0.02 + 0.02 * i } });
    tone(k, t, { freq: 1100, gain: 0.12 * i, env: { attack: 0.0008, decay: 0.05 } });
    tone(k, t, { freq: 2650, gain: 0.07 * i, env: { attack: 0.0008, decay: 0.03 } });
    return tone(k, t, { freq: 320, gain: 0.15 * i, env: { attack: 0.0008, decay: 0.03 } });
  },
  /** Disparo del lanzador de resorte. */
  thunk: (k, t, o) => {
    const i = o.intensity ?? 0.8;
    noise(k, t, { filters: [{ type: 'lowpass', freq: 900 }], gain: 0.5 * i, env: { attack: 0.001, decay: 0.05 } });
    tone(k, t, { freq: 640, gain: 0.05 * i, env: { attack: 0.001, decay: 0.15 } });
    return tone(k, t, { freq: 115, freqEnd: 45, glide: 0.12, gain: 0.55 * i, env: { attack: 0.001, decay: 0.18 } });
  },
  /** Proyectil o carrito que golpea el suelo o el tope. */
  thud: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    noise(k, t, { buffer: 'brown', filters: [{ type: 'lowpass', freq: 420 }], gain: 0.7 * i, env: { attack: 0.001, decay: 0.12 } });
    noise(k, t, { filters: [{ type: 'highpass', freq: 2500 }], gain: 0.06 * i, env: { attack: 0.001, decay: 0.05 } });
    return tone(k, t, { freq: 80, freqEnd: 48, glide: 0.08, gain: 0.4 * i, env: { attack: 0.001, decay: 0.1 } });
  },
  /** Resorte o dinamómetro que se estira. */
  creak: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    return creakVoice(k, t, 32, 55, 0.32, [[1100, 9, 1], [2300, 12, 0.5]], 0.7 * i);
  },
  /** Cuerda que roza la polea. */
  ropeCreak: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    noise(k, t, { filters: [{ type: 'bandpass', freq: 3000, Q: 1 }], gain: 0.04 * i, env: { attack: 0.05, decay: 0.4 } });
    return creakVoice(k, t, 20, 30, 0.5, [[520, 7, 1], [1300, 10, 0.45]], 0.7 * i);
  },
  /** Émbolo de jeringa: chirrido de goma con vibrato y algo de fricción. */
  squeak: (k, t, o) => {
    const i = o.intensity ?? 0.7;
    const osc = k.ctx.createOscillator();
    osc.type = 'triangle';
    const f = 1150 + 350 * i;
    osc.frequency.setValueAtTime(f, t);
    osc.frequency.linearRampToValueAtTime(f * 1.15, t + 0.2);
    const lfo = k.ctx.createOscillator();
    lfo.frequency.value = 22;
    const depth = k.ctx.createGain(); depth.gain.value = 35;
    lfo.connect(depth).connect(osc.frequency);
    const bp = makeFilter(k, t, { type: 'bandpass', freq: 1450, Q: 3 });
    const g = k.ctx.createGain();
    applyEnvelope(g.gain, t, { attack: 0.03, decay: 0.05, sustain: 0.8, sustainTime: 0.12, release: 0.05, peak: 0.12 });
    osc.connect(bp).connect(g).connect(k.out);
    osc.start(t); lfo.start(t); osc.stop(t + 0.3); lfo.stop(t + 0.3);
    osc.onended = () => { try { g.disconnect(); depth.disconnect(); } catch { /* ya desconectado */ } };
    noise(k, t, { filters: [{ type: 'bandpass', freq: 2500, Q: 1 }], gain: 0.05 * i, env: { attack: 0.03, decay: 0.25 } });
    return 0.3;
  },
  /** Perilla de enfoque del microscopio (detentes del engranaje). */
  knob: (k, t, o) => {
    const i = o.intensity ?? 0.6;
    tone(k, t, { freq: 2400, gain: 0.04 * i, env: { attack: 0.0005, decay: 0.012 } });
    return noise(k, t, { filters: [{ type: 'highpass', freq: 3500 }], gain: 0.25 * i, env: { attack: 0.0004, decay: 0.004 } });
  },
  /** Confirmación suave al guardar un ensayo. */
  confirm: (k, t) => {
    tone(k, t, { freq: 659.25, gain: 0.09, env: { attack: 0.008, decay: 0.2 } });
    tone(k, t + 0.08, { freq: 987.77, type: 'triangle', gain: 0.06, env: { attack: 0.008, decay: 0.28 } });
    return tone(k, t + 0.08, { freq: 987.77, gain: 0.05, env: { attack: 0.008, decay: 0.3 } });
  },
  /** Error o acción no válida: tono grave y breve, sin alarma. */
  error: (k, t) => tone(k, t, { freq: 220, freqEnd: 185, glide: 0.18, type: 'triangle', gain: 0.12, env: { attack: 0.012, hold: 0.06, decay: 0.18 }, filter: { type: 'lowpass', freq: 900 } }),
} satisfies Record<string, Recipe>;

export type SoundName = keyof typeof RECIPES;

/* ------------------------------------------------------------------ */
/* Sonidos continuos                                                   */
/* ------------------------------------------------------------------ */

export interface LoopVoice {
  /** Ganancia de salida del bucle (la controla el motor para entrar y salir suavemente). */
  out: GainNode;
  /** Ajusta la intensidad (0 a 1) mientras suena. */
  set: (intensity: number) => void;
  /** Detiene fuentes y temporizadores en el instante indicado. */
  stop: (at: number) => void;
}

type LoopRecipe = (k: Kit, intensity: number) => LoopVoice;

function loopNoise(k: Kit, buffer: AudioBuffer, filters: FilterSpec[], dest: AudioNode, gain: number) {
  const src = k.ctx.createBufferSource();
  src.buffer = buffer; src.loop = true;
  const g = k.ctx.createGain(); g.gain.value = gain;
  let head: AudioNode = src;
  for (const f of filters) { const node = makeFilter(k, k.ctx.currentTime, f); head.connect(node); head = node; }
  head.connect(g).connect(dest);
  src.start(k.ctx.currentTime, rand(0, buffer.duration * 0.9));
  return { src, g };
}

function loopOsc(k: Kit, type: OscillatorType, freq: number, dest: AudioNode, gain: number, filter?: FilterSpec) {
  const osc = k.ctx.createOscillator();
  osc.type = type; osc.frequency.value = freq;
  const g = k.ctx.createGain(); g.gain.value = gain;
  let head: AudioNode = osc;
  if (filter) { const f = makeFilter(k, k.ctx.currentTime, filter); head.connect(f); head = f; }
  head.connect(g).connect(dest);
  osc.start();
  return { osc, g };
}

const smooth = (p: AudioParam, v: number, ctx: AudioContext) => p.setTargetAtTime(v, ctx.currentTime, 0.08);

export const LOOPS = {
  /** Zumbido eléctrico suave de 60 Hz (red colombiana) mientras el circuito está cerrado. */
  hum: (k, i) => {
    const out = k.ctx.createGain();
    const a = loopOsc(k, 'sawtooth', 60, out, 0.03 * i, { type: 'lowpass', freq: 320, Q: 0.7 });
    const b = loopOsc(k, 'sine', 120, out, 0.02 * i);
    return {
      out,
      set: (v) => { smooth(a.g.gain, 0.03 * v, k.ctx); smooth(b.g.gain, 0.02 * v, k.ctx); },
      stop: (at) => { a.osc.stop(at); b.osc.stop(at); },
    };
  },
  /** Mechero Bunsen: rugido grave con parpadeo y siseo del gas. */
  burner: (k, i) => {
    const out = k.ctx.createGain();
    const roar = loopNoise(k, k.brown, [{ type: 'lowpass', freq: 220 }], out, 0.3 * i);
    const hiss = loopNoise(k, k.white, [{ type: 'bandpass', freq: 2400, Q: 0.6 }], out, 0.035 * i);
    const lfo = k.ctx.createOscillator(); lfo.frequency.value = 5.3;
    const depth = k.ctx.createGain(); depth.gain.value = 0.06 * i;
    lfo.connect(depth).connect(roar.g.gain); lfo.start();
    return {
      out,
      set: (v) => { smooth(roar.g.gain, 0.3 * v, k.ctx); smooth(hiss.g.gain, 0.035 * v, k.ctx); smooth(depth.gain, 0.06 * v, k.ctx); },
      stop: (at) => { roar.src.stop(at); hiss.src.stop(at); lfo.stop(at); },
    };
  },
  /** Plancha caliente: siseo tenue con chasquidos ocasionales del agua que se evapora. */
  hotplate: (k, i) => {
    const out = k.ctx.createGain();
    const hiss = loopNoise(k, k.white, [{ type: 'highpass', freq: 3000 }], out, 0.025 * i);
    const sizzle = loopNoise(k, k.crackle, [{ type: 'highpass', freq: 2500 }], out, 0.12 * i);
    return {
      out,
      set: (v) => { smooth(hiss.g.gain, 0.025 * v, k.ctx); smooth(sizzle.g.gain, 0.12 * v, k.ctx); },
      stop: (at) => { hiss.src.stop(at); sizzle.src.stop(at); },
    };
  },
  /** Soplador del riel de aire: flujo de aire y zumbido del motor. */
  blower: (k, i) => {
    const out = k.ctx.createGain();
    const air = loopNoise(k, k.white, [{ type: 'bandpass', freq: 520, Q: 0.6 }], out, 0.13 * i);
    const hiss = loopNoise(k, k.white, [{ type: 'highpass', freq: 3200 }], out, 0.025 * i);
    const motor = loopOsc(k, 'sawtooth', 60, out, 0.012 * i, { type: 'lowpass', freq: 420 });
    motor.osc.frequency.setTargetAtTime(140, k.ctx.currentTime, 0.25);
    return {
      out,
      set: (v) => { smooth(air.g.gain, 0.13 * v, k.ctx); smooth(hiss.g.gain, 0.025 * v, k.ctx); smooth(motor.g.gain, 0.012 * v, k.ctx); },
      stop: (at) => { air.src.stop(at); hiss.src.stop(at); motor.osc.stop(at); },
    };
  },
  /** Burbujeo continuo (gas que atraviesa un líquido, ebullición). */
  bubbling: (k, i) => {
    const out = k.ctx.createGain();
    const gurgle = loopNoise(k, k.brown, [{ type: 'lowpass', freq: 320 }], out, 0.12 * i);
    // Las burbujas pasan por la ganancia del bucle para que se apaguen junto con él.
    const sub: Kit = { ...k, out };
    let level = i;
    const timer = setInterval(() => {
      const now = k.ctx.currentTime;
      const n = Math.round(rand(0, 2.6) * (0.3 + level));
      for (let b = 0; b < n; b++) bubble(sub, now + rand(0.01, 0.1), 0.1 * level, rand(300, 1100));
    }, 100);
    return {
      out,
      set: (v) => { level = v; smooth(gurgle.g.gain, 0.12 * v, k.ctx); },
      stop: (at) => { clearInterval(timer); gurgle.src.stop(at); },
    };
  },
  /** Efervescencia sostenida. */
  fizzing: (k, i) => {
    const out = k.ctx.createGain();
    const c = loopNoise(k, k.crackle, [{ type: 'highpass', freq: 2200 }, { type: 'peaking', freq: 5200, Q: 1, gain: 4 }], out, 0.45 * i);
    return { out, set: (v) => smooth(c.g.gain, 0.45 * v, k.ctx), stop: (at) => c.src.stop(at) };
  },
  /** Rodadura de un carrito: retumbo grave que crece con la rapidez. */
  rolling: (k, i) => {
    const out = k.ctx.createGain();
    const r = loopNoise(k, k.brown, [{ type: 'lowpass', freq: 260 }], out, 0.35 * i);
    const grit = loopNoise(k, k.crackle, [{ type: 'bandpass', freq: 1800, Q: 1 }], out, 0.05 * i);
    return {
      out,
      set: (v) => { smooth(r.g.gain, 0.35 * v, k.ctx); smooth(grit.g.gain, 0.05 * v, k.ctx); },
      stop: (at) => { r.src.stop(at); grit.src.stop(at); },
    };
  },
} satisfies Record<string, LoopRecipe>;

export type LoopName = keyof typeof LOOPS;

/* ------------------------------------------------------------------ */
/* Búferes de ruido y respuesta de impulso (se generan una vez)        */
/* ------------------------------------------------------------------ */

export function makeBuffers(ctx: AudioContext) {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 2);
  const white = ctx.createBuffer(1, len, sr);
  const brown = ctx.createBuffer(1, len, sr);
  const crackle = ctx.createBuffer(1, len, sr);
  const w = white.getChannelData(0), b = brown.getChannelData(0), c = crackle.getChannelData(0);
  let last = 0;
  for (let n = 0; n < len; n++) {
    const x = Math.random() * 2 - 1;
    w[n] = x;
    last = (last + 0.02 * x) / 1.02;
    b[n] = last * 3.5;
  }
  // Chisporroteo: impulsos dispersos de amplitud aleatoria con un decaimiento muy corto.
  for (let n = 0; n < len; n++) {
    if (Math.random() < 0.0035) {
      const amp = (Math.random() * 2 - 1) * (0.3 + Math.random() * 0.7);
      for (let j = 0; j < 24 && n + j < len; j++) c[n + j] += amp * Math.exp(-j / 4) * (j % 2 ? -1 : 1);
    }
  }
  return { white, brown, crackle };
}

/** Respuesta de impulso de un aula pequeña: reflexiones tempranas y cola de ~0,5 s. */
export function makeRoomImpulse(ctx: AudioContext): AudioBuffer {
  const sr = ctx.sampleRate;
  const len = Math.floor(sr * 0.55);
  const ir = ctx.createBuffer(2, len, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = ir.getChannelData(ch);
    for (let n = 0; n < len; n++) d[n] = (Math.random() * 2 - 1) * Math.exp(-n / (sr * 0.11));
    for (const ms of [7, 13, 19, 29, 37]) {
      const at = Math.floor(((ms + ch * 2) / 1000) * sr);
      if (at < len) d[at] += 0.5 * Math.exp(-ms / 40);
    }
  }
  return ir;
}
