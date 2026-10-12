/**
 * Sonidos del laboratorio, sintetizados con la Web Audio API (no hay archivos de audio).
 *
 * - El motor es un singleton que crea el AudioContext la primera vez que la persona interactúa
 *   (los navegadores bloquean el audio automático).
 * - Si la Web Audio API no existe (pruebas, navegadores antiguos) todo es una operación vacía:
 *   nunca lanza errores.
 * - Los sonidos son complementarios: todo lo que suena también se ve en pantalla (WCAG 1.4.2),
 *   los efectos son breves y los sonidos continuos solo suenan mientras la acción está visible
 *   y en curso. El botón «Sonido» del encabezado los silencia todos.
 */
import { useEffect, useRef, useSyncExternalStore } from 'react';
import { createRateLimiter, loadSoundSettings, saveSoundSettings, clampVolume, volumeToGain, type SoundSettings } from './soundMath';
import { LOOPS, RECIPES, makeBuffers, makeRoomImpulse, type Kit, type LoopName, type LoopVoice, type RecipeOptions, type SoundName } from './soundRecipes';

export { envelopePoints, envelopeValueAt, envelopeDuration, createRateLimiter, loadSoundSettings, saveSoundSettings, volumeToGain, impactIntensity, clampVolume, DEFAULT_SOUND_SETTINGS, SOUND_KEY } from './soundMath';
export type { SoundSettings, EnvelopeSpec } from './soundMath';
export type { SoundName, LoopName } from './soundRecipes';

export interface PlayOptions extends RecipeOptions {
  /** Posición estéreo (−1 izquierda, 1 derecha). */
  pan?: number;
  /** Factor de volumen de esta reproducción (0 a 1). */
  volume?: number;
  /** Retraso en segundos. */
  delay?: number;
}

export interface LoopHandle { stop: () => void; set: (intensity: number) => void }

export interface SoundState {
  /** La Web Audio API existe en este navegador. */
  supported: boolean;
  enabled: boolean;
  volume: number;
  /** El contexto de audio ya se desbloqueó con un gesto. */
  ready: boolean;
  /** La pestaña está visible. */
  visible: boolean;
}

/** Intervalos mínimos (ms) entre repeticiones del mismo sonido. */
const RATE_LIMITS: Partial<Record<SoundName, number>> = {
  knob: 28, tick: 25, click: 40, clack: 30, drop: 60, bubble: 40, clank: 120, glassClink: 80,
  confirm: 250, error: 350, pour: 400, fizz: 500, swirl: 400, whoosh: 300,
  creak: 180, ropeCreak: 250, squeak: 160, splash: 200, thunk: 150, thud: 80,
};
const MAX_VOICES = 24;
const NOOP_LOOP: LoopHandle = { stop: () => {}, set: () => {} };

type AudioCtor = typeof AudioContext;
function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

interface Graph { ctx: AudioContext; master: GainNode; bus: GainNode; buffers: ReturnType<typeof makeBuffers> }

class SoundEngine {
  private graph: Graph | null = null;
  private failed = false;
  private gestured = false;
  private settings: SoundSettings = loadSoundSettings();
  private listeners = new Set<() => void>();
  private loops = new Set<{ voice: LoopVoice; gain: GainNode; stopped: boolean }>();
  private limiter = createRateLimiter(35, RATE_LIMITS);
  private voices = 0;
  private visible = typeof document === 'undefined' ? true : document.visibilityState !== 'hidden';
  private state: SoundState;
  private installed = false;

  constructor() {
    this.state = this.computeState();
  }

  private computeState(): SoundState {
    return {
      supported: audioCtor() !== null,
      enabled: this.settings.enabled,
      volume: this.settings.volume,
      ready: !!this.graph && this.graph.ctx.state === 'running',
      visible: this.visible,
    };
  }

  private emit() {
    this.state = this.computeState();
    for (const l of this.listeners) { try { l(); } catch { /* sin acción */ } }
  }

  getState = (): SoundState => this.state;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  };

  /** Escucha el primer gesto de la persona para desbloquear el audio, y la visibilidad de la pestaña. */
  install() {
    if (this.installed || typeof window === 'undefined') return;
    this.installed = true;
    const onGesture = () => {
      this.gestured = true;
      if (this.settings.enabled) this.unlock();
      if (this.graph?.ctx.state === 'running' || !this.settings.enabled) {
        for (const ev of GESTURES) window.removeEventListener(ev, onGesture, true);
      }
    };
    const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const;
    for (const ev of GESTURES) window.addEventListener(ev, onGesture, true);
    document.addEventListener('visibilitychange', () => this.setVisible(document.visibilityState !== 'hidden'));
    window.addEventListener('pagehide', () => this.setVisible(false));
    window.addEventListener('pageshow', () => this.setVisible(document.visibilityState !== 'hidden'));
  }

  private setVisible(v: boolean) {
    if (v === this.visible) return;
    this.visible = v;
    if (!v) {
      this.stopAllLoops();
      try { void this.graph?.ctx.suspend().catch(() => {}); } catch { /* sin acción */ }
    } else if (this.settings.enabled) {
      this.resume();
    }
    this.emit();
  }

  private resume() {
    const ctx = this.graph?.ctx;
    if (ctx && ctx.state === 'suspended') {
      try { void ctx.resume().then(() => this.emit(), () => {}); } catch { /* sin acción */ }
    }
  }

  /** Crea (o reanuda) el contexto de audio. Solo debe llamarse durante un gesto de la persona. */
  unlock(): boolean {
    if (this.graph) { this.resume(); return true; }
    if (this.failed) return false;
    const Ctor = audioCtor();
    if (!Ctor) { this.failed = true; return false; }
    try {
      const ctx = new Ctor({ latencyHint: 'interactive' });
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -10; limiter.knee.value = 6; limiter.ratio.value = 8;
      limiter.attack.value = 0.003; limiter.release.value = 0.15;
      const master = ctx.createGain();
      master.gain.value = this.settings.enabled ? volumeToGain(this.settings.volume) : 0;
      const bus = ctx.createGain();
      const reverb = ctx.createConvolver();
      reverb.buffer = makeRoomImpulse(ctx);
      const wet = ctx.createGain(); wet.gain.value = 0.16;
      bus.connect(master);
      bus.connect(reverb).connect(wet).connect(master);
      master.connect(limiter).connect(ctx.destination);
      this.graph = { ctx, master, bus, buffers: makeBuffers(ctx) };
      ctx.onstatechange = () => this.emit();
      this.resume();
      this.emit();
      return true;
    } catch {
      this.failed = true;
      this.graph = null;
      return false;
    }
  }

  /** Contexto listo para sonar, o null. No crea el contexto si aún no hubo un gesto. */
  private context(): Graph | null {
    if (!this.settings.enabled || !this.visible) return null;
    if (!this.graph) {
      const ua = typeof navigator !== 'undefined' ? (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation : undefined;
      if (!(this.gestured || ua?.hasBeenActive)) return null;
      if (!this.unlock()) return null;
    } else this.resume();
    return this.graph;
  }

  private voiceKit(g: Graph, opts: PlayOptions): { kit: Kit; head: GainNode } {
    const { ctx } = g;
    const head = ctx.createGain();
    head.gain.value = clampVolume(opts.volume ?? 1);
    let dest: AudioNode = g.bus;
    if (opts.pan && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, opts.pan));
      p.connect(g.bus);
      dest = p;
    }
    head.connect(dest);
    return { kit: { ctx, out: head, ...g.buffers }, head };
  }

  play(name: SoundName, opts: PlayOptions = {}): void {
    try {
      const recipe = RECIPES[name];
      if (!recipe) return;
      const g = this.context();
      if (!g) return;
      const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
      if (!this.limiter.allow(name, now)) return;
      if (this.voices >= MAX_VOICES) return;
      const { kit, head } = this.voiceKit(g, opts);
      const dur = recipe(kit, g.ctx.currentTime + 0.005 + Math.max(0, opts.delay ?? 0), opts);
      this.voices++;
      setTimeout(() => {
        this.voices--;
        try { head.disconnect(); } catch { /* sin acción */ }
      }, (dur + (opts.delay ?? 0) + 0.8) * 1000);
    } catch { /* el sonido nunca debe romper la práctica */ }
  }

  startLoop(name: LoopName, opts: { intensity?: number; volume?: number; pan?: number } = {}): LoopHandle {
    try {
      const recipe = LOOPS[name];
      if (!recipe) return NOOP_LOOP;
      const g = this.context();
      if (!g) return NOOP_LOOP;
      const { kit, head } = this.voiceKit(g, opts);
      const voice = recipe(kit, Math.max(0, Math.min(1, opts.intensity ?? 1)));
      const t = g.ctx.currentTime;
      voice.out.gain.setValueAtTime(0, t);
      voice.out.gain.linearRampToValueAtTime(1, t + 0.25);
      voice.out.connect(head);
      const entry = { voice, gain: voice.out, stopped: false };
      this.loops.add(entry);
      return {
        set: (v: number) => { if (!entry.stopped) { try { voice.set(Math.max(0, Math.min(1, v))); } catch { /* sin acción */ } } },
        stop: () => this.stopLoop(entry, head),
      };
    } catch {
      return NOOP_LOOP;
    }
  }

  private stopLoop(entry: { voice: LoopVoice; gain: GainNode; stopped: boolean }, head?: GainNode) {
    if (entry.stopped) return;
    entry.stopped = true;
    this.loops.delete(entry);
    try {
      const ctx = this.graph!.ctx;
      const t = ctx.currentTime;
      entry.gain.gain.cancelScheduledValues(t);
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, t);
      entry.gain.gain.linearRampToValueAtTime(0, t + 0.15);
      entry.voice.stop(t + 0.2);
      setTimeout(() => { try { entry.gain.disconnect(); head?.disconnect(); } catch { /* sin acción */ } }, 400);
    } catch { /* sin acción */ }
  }

  stopAllLoops() {
    for (const e of [...this.loops]) this.stopLoop(e);
  }

  setEnabled(enabled: boolean) {
    this.settings = { ...this.settings, enabled };
    saveSoundSettings(this.settings);
    if (!enabled) this.stopAllLoops();
    else this.unlock();
    this.applyGain();
    this.emit();
  }

  setVolume(volume: number) {
    this.settings = { ...this.settings, volume: clampVolume(volume) };
    saveSoundSettings(this.settings);
    this.applyGain();
    this.emit();
  }

  private applyGain() {
    const g = this.graph;
    if (!g) return;
    try {
      const target = this.settings.enabled ? volumeToGain(this.settings.volume) : 0;
      g.master.gain.setTargetAtTime(target, g.ctx.currentTime, 0.03);
    } catch { /* sin acción */ }
  }
}

let engine: SoundEngine | null = null;
/** Motor único, creado bajo demanda. */
export function soundEngine(): SoundEngine {
  if (!engine) engine = new SoundEngine();
  return engine;
}

/** Reproduce un efecto breve. Nunca lanza errores; no hace nada si el sonido está apagado. */
export function playSound(name: SoundName, opts?: PlayOptions): void {
  soundEngine().play(name, opts);
}

/** Inicia un sonido continuo. Hay que detenerlo con `stop()` (o usar `useSoundLoop`). */
export function startLoop(name: LoopName, opts?: { intensity?: number; volume?: number; pan?: number }): LoopHandle {
  return soundEngine().startLoop(name, opts);
}

export function setSoundEnabled(enabled: boolean) { soundEngine().setEnabled(enabled); }
export function setSoundVolume(volume: number) { soundEngine().setVolume(volume); }
/** Prepara el desbloqueo del audio con el primer gesto. Se llama una vez al iniciar la aplicación. */
export function installSound() { soundEngine().install(); }

const SERVER_STATE: SoundState = { supported: false, enabled: false, volume: 0, ready: false, visible: true };

/** Estado del sonido y acciones para los componentes. */
export function useLabSound() {
  const e = soundEngine();
  const state = useSyncExternalStore(e.subscribe, e.getState, () => SERVER_STATE);
  return {
    ...state,
    play: playSound,
    startLoop,
    setEnabled: setSoundEnabled,
    setVolume: setSoundVolume,
    toggle: () => setSoundEnabled(!state.enabled),
  };
}

/**
 * Sonido continuo ligado a una acción visible: suena mientras `active` sea verdadero, la pestaña esté
 * visible y el sonido esté activado; se detiene al desmontar el componente.
 */
export function useSoundLoop(name: LoopName, active: boolean, intensity = 1) {
  const { enabled, visible, ready } = useLabSound();
  const handle = useRef<LoopHandle | null>(null);
  const level = useRef(intensity);
  level.current = intensity;
  useEffect(() => {
    if (!active || !enabled || !visible) return;
    const h = startLoop(name, { intensity: level.current });
    handle.current = h;
    return () => { h.stop(); handle.current = null; };
  }, [name, active, enabled, visible, ready]);
  useEffect(() => { handle.current?.set(intensity); }, [intensity]);
}
