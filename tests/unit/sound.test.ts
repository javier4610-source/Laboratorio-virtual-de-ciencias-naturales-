import { describe, expect, it } from 'vitest';
import {
  createRateLimiter, DEFAULT_SOUND_SETTINGS, envelopeDuration, envelopePoints, envelopeValueAt, impactIntensity,
  loadSoundSettings, playSound, saveSoundSettings, setSoundEnabled, setSoundVolume, soundEngine, SOUND_KEY, startLoop, volumeToGain,
} from '../../src/lib/sound';
import { ENV_FLOOR } from '../../src/lib/soundMath';
import { LOOPS, makeBuffers, makeRoomImpulse, RECIPES, type Kit } from '../../src/lib/soundRecipes';

describe('envolventes', () => {
  it('sube linealmente al pico y cae de forma exponencial hasta el silencio', () => {
    const pts = envelopePoints({ attack: 0.01, decay: 0.2, peak: 0.5 });
    expect(pts[0]).toEqual({ t: 0, v: ENV_FLOOR, curve: 'set' });
    expect(pts[1]).toMatchObject({ t: 0.01, v: 0.5, curve: 'lin' });
    expect(pts.at(-1)).toMatchObject({ v: ENV_FLOOR, curve: 'exp' });
    expect(envelopeDuration({ attack: 0.01, decay: 0.2 })).toBeCloseTo(0.21, 10);
    // A mitad del ataque, la mitad del pico (rampa lineal desde casi cero).
    expect(envelopeValueAt(pts, 0.005)).toBeCloseTo((ENV_FLOOR + 0.5) / 2, 6);
    // A mitad de la caída exponencial: media geométrica entre el pico y el piso.
    expect(envelopeValueAt(pts, 0.11)).toBeCloseTo(Math.sqrt(0.5 * ENV_FLOOR), 6);
  });
  it('incluye retención y sostenido cuando se piden', () => {
    const e = { attack: 0.02, hold: 0.05, decay: 0.1, sustain: 0.5, sustainTime: 0.3, release: 0.2 };
    const pts = envelopePoints(e);
    expect(pts.map((p) => p.curve)).toEqual(['set', 'lin', 'lin', 'exp', 'lin', 'exp']);
    expect(envelopeDuration(e)).toBeCloseTo(0.02 + 0.05 + 0.1 + 0.3 + 0.2, 10);
    expect(envelopeValueAt(pts, 0.3)).toBeCloseTo(0.5, 6);
    // Los tiempos nunca retroceden y ningún valor es negativo ni cero (requisito de las rampas exponenciales).
    for (let i = 1; i < pts.length; i++) expect(pts[i].t).toBeGreaterThanOrEqual(pts[i - 1].t);
    expect(pts.every((p) => p.v > 0)).toBe(true);
  });
  it('tolera parámetros degenerados', () => {
    const pts = envelopePoints({ attack: 0, decay: 0, peak: 0, sustain: 3 });
    expect(pts.every((p) => Number.isFinite(p.t) && p.v > 0)).toBe(true);
    expect(envelopeDuration({ attack: 0, decay: 0 })).toBeGreaterThan(0);
  });
});

describe('limitador de repeticiones', () => {
  it('bloquea repeticiones dentro de la ventana y las permite después', () => {
    const rl = createRateLimiter(50);
    expect(rl.allow('clic', 0)).toBe(true);
    expect(rl.allow('clic', 30)).toBe(false);
    expect(rl.allow('clic', 49)).toBe(false);
    expect(rl.allow('clic', 50)).toBe(true);
    expect(rl.allow('otro', 51)).toBe(true);
  });
  it('acepta intervalos por clave y se puede reiniciar', () => {
    const rl = createRateLimiter(10, { confirm: 300 });
    expect(rl.allow('confirm', 0)).toBe(true);
    expect(rl.allow('confirm', 200)).toBe(false);
    expect(rl.allow('tick', 0)).toBe(true);
    expect(rl.allow('tick', 15)).toBe(true);
    rl.reset();
    expect(rl.allow('confirm', 201)).toBe(true);
  });
});

function memoryStorage() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, raw: m };
}

describe('ajustes de sonido', () => {
  it('usa los valores por defecto (activado, volumen moderado) sin almacenamiento', () => {
    expect(loadSoundSettings(null)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(DEFAULT_SOUND_SETTINGS.enabled).toBe(true);
    expect(DEFAULT_SOUND_SETTINGS.volume).toBeGreaterThan(0.3);
    expect(DEFAULT_SOUND_SETTINGS.volume).toBeLessThan(0.8);
    expect(saveSoundSettings({ enabled: false, volume: 0.2 }, null)).toBe(false);
  });
  it('guarda y recupera el estado, acotando el volumen', () => {
    const st = memoryStorage();
    expect(saveSoundSettings({ enabled: false, volume: 1.7 }, st)).toBe(true);
    expect(JSON.parse(st.raw.get(SOUND_KEY)!)).toEqual({ enabled: false, volume: 1 });
    expect(loadSoundSettings(st)).toEqual({ enabled: false, volume: 1 });
  });
  it('ignora datos corruptos o un almacenamiento que lanza errores', () => {
    const st = memoryStorage();
    st.setItem(SOUND_KEY, '{no es json');
    expect(loadSoundSettings(st)).toEqual(DEFAULT_SOUND_SETTINGS);
    st.setItem(SOUND_KEY, JSON.stringify({ enabled: 'sí', volume: 'mucho' }));
    expect(loadSoundSettings(st)).toEqual(DEFAULT_SOUND_SETTINGS);
    const broken = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('lleno'); } };
    expect(loadSoundSettings(broken)).toEqual(DEFAULT_SOUND_SETTINGS);
    expect(saveSoundSettings({ enabled: true, volume: 0.5 }, broken)).toBe(false);
  });
});

describe('escalas', () => {
  it('volumen con curva perceptual', () => {
    expect(volumeToGain(0)).toBe(0);
    expect(volumeToGain(1)).toBe(1);
    expect(volumeToGain(0.5)).toBeCloseTo(0.25);
    expect(volumeToGain(-3)).toBe(0);
    expect(volumeToGain(Number.NaN)).toBeCloseTo(DEFAULT_SOUND_SETTINGS.volume ** 2);
  });
  it('intensidad del golpe según la rapidez de impacto', () => {
    expect(impactIntensity(0, 1)).toBe(0);
    expect(impactIntensity(0.25, 1)).toBeCloseTo(0.5);
    expect(impactIntensity(-0.25, 1)).toBeCloseTo(0.5);
    expect(impactIntensity(9, 1)).toBe(1);
    expect(impactIntensity(1, 0)).toBe(0);
    expect(impactIntensity(Number.NaN, 1)).toBe(0);
  });
});

describe('sin Web Audio API (pruebas, navegadores antiguos)', () => {
  it('todo es una operación vacía que nunca lanza errores', () => {
    const e = soundEngine();
    expect(e.getState().supported).toBe(false);
    expect(() => playSound('glassClink')).not.toThrow();
    expect(() => playSound('clack', { intensity: 2, pan: -4 })).not.toThrow();
    const h = startLoop('hum');
    expect(() => { h.set(0.5); h.stop(); h.stop(); }).not.toThrow();
    expect(e.unlock()).toBe(false);
  });
  it('el interruptor y el volumen cambian el estado y avisan a los suscriptores', () => {
    const e = soundEngine();
    let calls = 0;
    const off = e.subscribe(() => { calls++; });
    setSoundEnabled(false);
    expect(e.getState().enabled).toBe(false);
    setSoundVolume(3);
    expect(e.getState().volume).toBe(1);
    setSoundEnabled(true);
    expect(e.getState().enabled).toBe(true);
    off();
    expect(calls).toBe(3);
  });
});

/* ------------------------------------------------------------------ */
/* Contexto de audio simulado: valida que cada receta programe nodos   */
/* de forma legal (p. ej., rampas exponenciales hacia valores > 0).    */
/* ------------------------------------------------------------------ */

class FakeParam {
  value: number;
  events: string[] = [];
  constructor(v = 0) { this.value = v; }
  setValueAtTime(v: number, t: number) { this.check(t); this.value = v; this.events.push('set'); return this; }
  linearRampToValueAtTime(v: number, t: number) { this.check(t); this.value = v; return this; }
  exponentialRampToValueAtTime(v: number, t: number) {
    this.check(t);
    if (!(v > 0)) throw new RangeError(`rampa exponencial hacia ${v}`);
    this.value = v; return this;
  }
  setTargetAtTime(v: number, t: number, tc: number) { this.check(t); if (!(tc > 0)) throw new RangeError('constante de tiempo'); this.value = v; return this; }
  setValueCurveAtTime(curve: Float32Array, t: number, d: number) { this.check(t); if (curve.length < 2 || !(d > 0)) throw new RangeError('curva'); return this; }
  cancelScheduledValues(t: number) { this.check(t); return this; }
  private check(t: number) { if (!Number.isFinite(t) || t < 0) throw new RangeError(`tiempo ${t}`); }
}

class FakeNode {
  connected: unknown[] = [];
  connect<T>(n: T): T { this.connected.push(n); return n; }
  disconnect() { this.connected = []; }
}

class FakeSource extends FakeNode {
  started = 0; stopped = 0; onended: (() => void) | null = null;
  frequency = new FakeParam(440); detune = new FakeParam(0); playbackRate = new FakeParam(1);
  type = 'sine'; buffer: FakeBuffer | null = null; loop = false;
  start() { if (this.started++) throw new Error('start dos veces'); }
  stop(t?: number) { if (t !== undefined && !Number.isFinite(t)) throw new RangeError('stop'); this.stopped++; }
}

class FakeBuffer {
  data: Float32Array[];
  constructor(public numberOfChannels: number, public length: number, public sampleRate: number) {
    this.data = Array.from({ length: numberOfChannels }, () => new Float32Array(length));
  }
  get duration() { return this.length / this.sampleRate; }
  getChannelData(c: number) { return this.data[c]; }
}

function fakeContext() {
  const sources: FakeSource[] = [];
  const ctx = {
    currentTime: 1, sampleRate: 8000, state: 'running', destination: new FakeNode(),
    createOscillator: () => { const s = new FakeSource(); sources.push(s); return s; },
    createBufferSource: () => { const s = new FakeSource(); sources.push(s); return s; },
    createGain: () => Object.assign(new FakeNode(), { gain: new FakeParam(1) }),
    createBiquadFilter: () => Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(350), Q: new FakeParam(1), gain: new FakeParam(0) }),
    createStereoPanner: () => Object.assign(new FakeNode(), { pan: new FakeParam(0) }),
    createConvolver: () => Object.assign(new FakeNode(), { buffer: null }),
    createDynamicsCompressor: () => Object.assign(new FakeNode(), { threshold: new FakeParam(), knee: new FakeParam(), ratio: new FakeParam(), attack: new FakeParam(), release: new FakeParam() }),
    createBuffer: (ch: number, len: number, sr: number) => new FakeBuffer(ch, len, sr),
  };
  return { ctx: ctx as unknown as AudioContext, sources };
}

describe('recetas de síntesis', () => {
  const { ctx, sources } = fakeContext();
  const buffers = makeBuffers(ctx);
  const kit: Kit = { ctx, out: ctx.createGain(), ...buffers };

  it('los búferes de ruido son finitos y no están vacíos', () => {
    for (const b of [buffers.white, buffers.brown, buffers.crackle]) {
      const d = b.getChannelData(0);
      expect(d.every(Number.isFinite)).toBe(true);
      expect(d.some((x) => x !== 0)).toBe(true);
    }
    const ir = makeRoomImpulse(ctx);
    expect(ir.numberOfChannels).toBe(2);
    expect(ir.duration).toBeGreaterThan(0.3);
  });

  it('cada efecto se programa sin errores, con duración breve, y detiene sus fuentes', () => {
    for (const [name, recipe] of Object.entries(RECIPES)) {
      for (const intensity of [0, 0.5, 1]) {
        const before = sources.length;
        const dur = recipe(kit, 1, { intensity, duration: 1 });
        expect(dur, name).toBeGreaterThan(0);
        expect(dur, name).toBeLessThan(2.5);
        const created = sources.slice(before);
        expect(created.length, name).toBeGreaterThan(0);
        expect(created.every((s) => s.started === 1 && s.stopped >= 1), name).toBe(true);
      }
    }
  });

  it('cada sonido continuo se inicia, se ajusta y se detiene', () => {
    for (const [name, recipe] of Object.entries(LOOPS)) {
      const before = sources.length;
      const voice = recipe(kit, 0.7);
      voice.set(0.2);
      voice.stop(2);
      const created = sources.slice(before);
      expect(created.length, name).toBeGreaterThan(0);
      expect(created.every((s) => s.started === 1 && s.stopped >= 1), name).toBe(true);
    }
  });
});
