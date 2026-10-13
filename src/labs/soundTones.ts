/**
 * Tonos de la práctica «Sonido y resonancia» (Web Audio API, sin archivos de audio).
 *
 * A diferencia de los efectos breves de src/lib/sound.ts, aquí el sonido ES el fenómeno que se estudia:
 * un diapasón golpeado (golpe de mazo de caucho + seno que decae exponencialmente con parciales leves)
 * y el tono continuo de un generador de señales. Ambos pasan por un nodo «tubo» cuya ganancia sigue la
 * amplitud del micrófono del modelo: el sonido se refuerza en la resonancia.
 *
 * Reglas de seguridad y accesibilidad:
 * - El contexto de audio se crea solo dentro de un gesto de la persona (clic o tecla en un botón).
 * - Volumen bajo: pico máximo de 0,12 × el volumen elegido en el encabezado (curva cuadrática), con limitador.
 * - Rampas de entrada y salida (sin chasquidos); todo se puede detener; se detiene al cambiar de pestaña
 *   o al desmontar el laboratorio.
 * - El osciloscopio de la escena muestra siempre la misma información: el sonido nunca es la única pista.
 * - Si la Web Audio API no existe, todo es una operación vacía y nunca lanza errores.
 */
import { volumeToGain } from '../lib/sound';
import { FORK_PARTIALS } from '../models/soundResonance';

/** Ganancia máxima de salida (≈ −18 dBFS) antes del volumen del usuario. */
export const SAFE_PEAK = 0.12;
/** Duración total del sonido del diapasón (s). */
export const FORK_RING_S = 7.5;

type AudioCtor = typeof AudioContext;
function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

export const toneSupported = () => audioCtor() !== null;

/** Nivel perceptual: comprime un poco el rango para que el sonido fuera de resonancia siga siendo audible. */
export const perceptualLevel = (level: number) => Math.pow(Math.max(0, Math.min(1, level)), 0.75);

interface Voice { nodes: AudioScheduledSourceNode[]; gains: GainNode[] }

export class ToneSynth {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private tube: GainNode | null = null;
  private direct: GainNode | null = null;
  private fork: Voice | null = null;
  private gen: { osc: OscillatorNode; gain: GainNode } | null = null;
  private failed = false;
  private volume = 0.6;
  private level = 0.1;

  /** Crea o reanuda el contexto. Llamar solo dentro de un gesto de la persona. */
  private ensure(): AudioContext | null {
    if (this.failed) return null;
    try {
      if (!this.ctx) {
        const Ctor = audioCtor();
        if (!Ctor) { this.failed = true; return null; }
        const ctx = new Ctor({ latencyHint: 'interactive' });
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = -14; limiter.knee.value = 4; limiter.ratio.value = 12;
        limiter.attack.value = 0.002; limiter.release.value = 0.2;
        const master = ctx.createGain();
        master.gain.value = SAFE_PEAK * volumeToGain(this.volume);
        const tube = ctx.createGain();
        tube.gain.value = perceptualLevel(this.level);
        const direct = ctx.createGain();
        direct.gain.value = 0.35;
        tube.connect(master);
        direct.connect(master);
        master.connect(limiter).connect(ctx.destination);
        this.ctx = ctx; this.master = master; this.tube = tube; this.direct = direct;
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
      return this.ctx;
    } catch {
      this.failed = true;
      return null;
    }
  }

  setVolume(volume: number) {
    this.volume = volume;
    try { if (this.ctx && this.master) this.master.gain.setTargetAtTime(SAFE_PEAK * volumeToGain(volume), this.ctx.currentTime, 0.05); } catch { /* sin acción */ }
  }

  /** Nivel del refuerzo del tubo (0 a 1), proporcional a la amplitud del micrófono. */
  setLevel(level: number) {
    this.level = level;
    try { if (this.ctx && this.tube) this.tube.gain.setTargetAtTime(perceptualLevel(level), this.ctx.currentTime, 0.04); } catch { /* sin acción */ }
  }

  /** Golpe del diapasón de frecuencia f. Devuelve false si no se pudo sonar. */
  strike(f: number, level: number): boolean {
    this.stopFork();
    this.setLevel(level);
    const ctx = this.ensure();
    if (!ctx || !this.tube || !this.direct) return false;
    try {
      const t = ctx.currentTime + 0.01;
      const end = t + FORK_RING_S;
      const voice: Voice = { nodes: [], gains: [] };
      // Parciales: fundamental y 2f atraviesan el tubo (se refuerzan); el modo metálico 6,27·f suena directo.
      for (const [ratio, amp, tau] of FORK_PARTIALS) {
        if (f * ratio > ctx.sampleRate / 2.2) continue;
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = f * ratio;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(amp, t + 0.004);
        g.gain.setTargetAtTime(0, t + 0.004, tau);
        g.gain.setValueAtTime(amp * Math.exp(-(FORK_RING_S - 0.25) / tau), end - 0.25);
        g.gain.linearRampToValueAtTime(0, end);
        osc.connect(g).connect(ratio < 3 ? this.tube : this.direct);
        osc.start(t);
        osc.stop(end + 0.05);
        voice.nodes.push(osc); voice.gains.push(g);
      }
      // Golpe del mazo de caucho: ruido breve filtrado (un «toc» sordo).
      const len = Math.floor(ctx.sampleRate * 0.04);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (len / 5));
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1100; bp.Q.value = 0.9;
      const gn = ctx.createGain();
      gn.gain.value = 0.5;
      src.connect(bp).connect(gn).connect(this.direct);
      src.start(t);
      voice.nodes.push(src); voice.gains.push(gn);
      this.fork = voice;
      return true;
    } catch {
      return false;
    }
  }

  private release(v: Voice) {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    for (const g of v.gains) {
      try { g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + 0.06); } catch { /* sin acción */ }
    }
    for (const n of v.nodes) { try { n.stop(t + 0.08); } catch { /* ya detenido */ } }
  }

  stopFork() {
    if (this.fork) { this.release(this.fork); this.fork = null; }
  }

  /** Enciende (o vuelve a afinar) el generador. */
  startGenerator(f: number, level: number): boolean {
    this.setLevel(level);
    if (this.gen) { this.setFrequency(f); return true; }
    const ctx = this.ensure();
    if (!ctx || !this.tube) return false;
    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = f;
      const gain = ctx.createGain();
      const t = ctx.currentTime;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.8, t + 0.08);
      osc.connect(gain).connect(this.tube);
      osc.start(t);
      this.gen = { osc, gain };
      return true;
    } catch {
      return false;
    }
  }

  setFrequency(f: number) {
    try { if (this.ctx && this.gen) this.gen.osc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.01); } catch { /* sin acción */ }
  }

  stopGenerator() {
    if (this.gen) { this.release({ nodes: [this.gen.osc], gains: [this.gen.gain] }); this.gen = null; }
  }

  stopAll() {
    this.stopFork();
    this.stopGenerator();
  }

  dispose() {
    this.stopAll();
    const ctx = this.ctx;
    this.ctx = null; this.master = null; this.tube = null; this.direct = null;
    if (ctx) setTimeout(() => { try { void ctx.close().catch(() => {}); } catch { /* sin acción */ } }, 200);
  }
}
