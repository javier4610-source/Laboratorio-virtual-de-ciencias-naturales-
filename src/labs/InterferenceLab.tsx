import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AIRY_ZEROS, CALIPER_RES, GRATINGS, INTERFERENCE_INSTRUMENTS, INTERFERENCE_LIMITS, SCREEN_RULER_RES, SOURCES, analyzeCursors, apertureFor,
  findGrating, findSource, intensity, interferenceConditions, lightFrequency, screenColor, sensorIntensity, sinThetaOnScreen, srgbEncode,
  thinFilmColor, thinFilmConstructive, wavelengthToHex, type Aperture, type ElementKind, type LightSource, type SourceId,
} from '../models/interference';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { INSTRUMENTS } from './instruments';
import { resolutionText } from '../components/Experiment';
import { ContactShadow, Lcd } from './kit';
import { ManipHint, ManipScene, Plunger } from './manipulate';

/* ------------------------------------------------------------------ instrumentos */

type InstrumentId = 'calibrador' | 'regla' | 'riel' | 'sensor';
/** Ficha del instrumento: la de src/labs/instruments.ts si ya está integrada; si no, la del modelo (respaldo). */
const spec = (id: InstrumentId) => INSTRUMENTS.interferencia?.find((i) => i.id === id) ?? INTERFERENCE_INSTRUMENTS.find((i) => i.id === id)!;

/* ------------------------------------------------------------------ vistas de la pantalla */

type ViewId = 'detalle' | 'media' | 'amplia';
const VIEWS: Record<ViewId, { half: number; step: number; minor: number; label: number; name: string }> = {
  detalle: { half: 15, step: CALIPER_RES, minor: 1, label: 5, name: '±15 mm' },
  media: { half: 60, step: CALIPER_RES, minor: 5, label: 20, name: '±60 mm' },
  amplia: { half: INTERFERENCE_LIMITS.screenHalfWidth, step: SCREEN_RULER_RES, minor: 20, label: 100, name: '±400 mm' },
};

const KIND_NAMES: Record<ElementKind, string> = { simple: 'Rendija simple', doble: 'Doble rendija', red: 'Red de difracción', circular: 'Agujero circular' };
/** Qué marcan los cursores en cada diapositiva. */
const CURSOR_TARGET: Record<ElementKind, string> = {
  simple: 'el m-ésimo mínimo (franja oscura) a cada lado del centro',
  doble: 'el m-ésimo máximo (franja brillante) a cada lado del centro',
  red: 'el orden m (mancha brillante) a cada lado del centro',
  circular: 'el m-ésimo anillo oscuro (diámetro del anillo)',
};
const DIM_SYMBOL: Record<ElementKind, string> = { simple: 'a', doble: 'd', red: 'd', circular: 'D' };

/* ------------------------------------------------------------------ imagen del patrón (canvas → PNG) */

const IW = 720, IH = 180;

/** Dibuja el patrón de la pantalla con la física del modelo. Devuelve un data URL (o null sin canvas). */
function renderPattern(ap: Aperture, source: LightSource, L_cm: number, half: number, exposure: number): string | null {
  if (typeof document === 'undefined') return null;
  const cv = document.createElement('canvas');
  cv.width = IW; cv.height = IH;
  const ctx = cv.getContext('2d');
  if (!ctx) return null;
  const img = ctx.createImageData(IW, IH);
  const L = L_cm * 10;
  const mmPx = (2 * half) / IW;
  const amb = 0.012;
  const tone = (c: number) => Math.round(255 * srgbEncode(amb + (1 - amb) * (1 - Math.exp(-exposure * c))));
  const put = (i: number, rgb: [number, number, number], k: number) => {
    img.data[i] = tone(rgb[0] * k); img.data[i + 1] = tone(rgb[1] * k); img.data[i + 2] = tone(rgb[2] * k); img.data[i + 3] = 255;
  };
  if (ap.kind === 'circular') {
    const step = mmPx / 2;
    const rMax = Math.hypot(half, (half * IH) / IW) + 2 * mmPx;
    const table: [number, number, number][] = [];
    for (let r = 0; r <= rMax; r += step) table.push(screenColor(ap, source, sinThetaOnScreen(r, L)).rgb);
    for (let row = 0; row < IH; row++) {
      const y = (row + 0.5 - IH / 2) * mmPx;
      for (let col = 0; col < IW; col++) {
        const x = (col + 0.5 - IW / 2) * mmPx;
        put(4 * (row * IW + col), table[Math.min(table.length - 1, Math.round(Math.hypot(x, y) / step))], 1);
      }
    }
  } else {
    // Perfil horizontal con submuestreo: en las redes se toma el valor máximo dentro del píxel para que los
    // máximos principales (muy estrechos) no desaparezcan entre dos columnas.
    const sub = 5;
    const cols: [number, number, number][] = [];
    for (let col = 0; col < IW; col++) {
      let best: [number, number, number] = [0, 0, 0], bestLum = -1;
      const sum: [number, number, number] = [0, 0, 0];
      for (let s = 0; s < sub; s++) {
        const y = -half + (col + (s + 0.5) / sub) * mmPx;
        const c = screenColor(ap, source, sinThetaOnScreen(y, L));
        sum[0] += c.rgb[0] / sub; sum[1] += c.rgb[1] / sub; sum[2] += c.rgb[2] / sub;
        if (c.lum > bestLum) { bestLum = c.lum; best = c.rgb; }
      }
      cols.push(ap.kind === 'red' ? best : sum);
    }
    // Altura del haz en la pantalla: láser ≈ 1,5 mm; la rendija de la lámpara deja una franja más alta.
    const sigmaPx = Math.max(3, (source.wavelength === null ? 2.5 : 0.75) / mmPx);
    for (let row = 0; row < IH; row++) {
      const t = (row + 0.5 - IH / 2) / sigmaPx;
      const env = Math.exp(-0.5 * t * t);
      for (let col = 0; col < IW; col++) put(4 * (row * IW + col), cols[col], env);
    }
  }
  ctx.putImageData(img, 0, 0);
  try { return cv.toDataURL('image/png'); } catch { return null; }
}

/* ------------------------------------------------------------------ geometría del banco (vista superior) */

const BW = 760, BH = 300;
const RAIL_X0 = 40, PX_CM = 3, RAIL_CM = 230, RAIL_Y = 150;
const SLIDE_CM = 20;
const xOfCm = (cm: number) => RAIL_X0 + cm * PX_CM;
const SLIDE_X = xOfCm(SLIDE_CM);
const SCREEN_HALF_PX = (INTERFERENCE_LIMITS.screenHalfWidth / 10) * PX_CM;
const WHITE_LINES = [420, 460, 500, 540, 580, 620, 660, 700];

/** Rayo desde la diapositiva con ángulo θ (sen θ dado) hasta la pantalla o hasta el borde del dibujo. */
function rayEnd(sinT: number, L_cm: number) {
  const dx = L_cm * PX_CM;
  const tan = sinT / Math.sqrt(1 - sinT * sinT);
  const dy = dx * tan;
  if (Math.abs(dy) <= SCREEN_HALF_PX) return { x: SLIDE_X + dx, y: RAIL_Y + dy, hits: true };
  const lim = RAIL_Y - 12;
  return { x: SLIDE_X + lim / Math.abs(tan), y: RAIL_Y + Math.sign(dy) * lim, hits: false };
}

/* ------------------------------------------------------------------ piezas locales */

function BenchDefs() {
  return (
    <defs>
      <linearGradient id="itf-rail" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#eef2f3" /><stop offset="0.35" stopColor="#c7d0d4" /><stop offset="0.5" stopColor="#9aa6ab" />
        <stop offset="0.65" stopColor="#c7d0d4" /><stop offset="1" stopColor="#e3e8ea" />
      </linearGradient>
      <linearGradient id="itf-screen" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#d9dcd6" /><stop offset="0.45" stopColor="#fbfbf7" /><stop offset="1" stopColor="#c9ccc6" />
      </linearGradient>
      <radialGradient id="itf-glow" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#fff" stopOpacity="0.9" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
      </radialGradient>
      <clipPath id="itf-clip"><rect x="0" y="0" width={BW} height={BH} /></clipPath>
    </defs>
  );
}

/** Láser de laboratorio visto desde arriba, sobre su carro. */
function LaserTop({ on, color }: { on: boolean; color: string }) {
  const x = xOfCm(1), w = xOfCm(15) - x;
  return (
    <g>
      <rect x={x - 2} y={RAIL_Y - 20} width={w + 4} height={40} rx={4} fill="url(#kit-metal)" stroke="#7d898e" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
      <rect x={x} y={RAIL_Y - 13} width={w} height={26} rx={5} fill="url(#kit-body-dark)" stroke="#11181a" strokeWidth="0.8" />
      <rect x={x + 4} y={RAIL_Y - 11} width={w - 12} height={4} rx={2} fill="#fff" opacity="0.1" />
      <path d={`M${x + 8} ${RAIL_Y + 7} l5 -9 l5 9 z`} fill="#f5c400" stroke="#1a1a1a" strokeWidth="0.6" />
      <text x={x + 13} y={RAIL_Y + 6} textAnchor="middle" style={{ fontSize: 6, fontWeight: 700, fill: '#1a1a1a' }}>!</text>
      <circle cx={x + 26} cy={RAIL_Y + 3} r={2.6} fill={on ? '#5dff8a' : '#2b3a33'} stroke="#0b0f0d" strokeWidth="0.5" />
      <rect x={x + w} y={RAIL_Y - 6} width={6} height={12} rx={1.5} fill="url(#kit-metal-h)" stroke="#5d6b70" strokeWidth="0.6" />
      {on && <circle cx={x + w + 6} cy={RAIL_Y} r={5} fill={color} opacity="0.55" />}
    </g>
  );
}

/* ------------------------------------------------------------------ laboratorio */

type Pt = { x: number; y: number };

export default function InterferenceLab({ api }: LabProps) {
  const [sourceId, setSourceId] = useState<SourceId>('rojo');
  const [on, setOn] = useState(false);
  const [kind, setKind] = useState<ElementKind>('doble');
  const [aUm, setAUm] = useState(50);
  const [dUm, setDUm] = useState(250);
  const [DUm, setDDUm] = useState(100);
  const [gratingId, setGratingId] = useState('r600');
  const [L, setL] = useState(100);
  const [view, setView] = useState<ViewId>('detalle');
  const [exposure, setExposure] = useState(8);
  const [cursorA, setCursorA] = useState(-5);
  const [cursorB, setCursorB] = useState(5);
  const [order, setOrder] = useState(2);
  const [calRead, setCalRead] = useState(false);
  const [sensorY, setSensorY] = useState(0);
  const [trace, setTrace] = useState<Pt[]>([]);
  const [scanning, setScanning] = useState(false);
  const [savedMsg, setSavedMsg] = useState('');
  const [film, setFilm] = useState(300);

  const source = findSource(sourceId);
  const V = VIEWS[view];
  const ap = useMemo(() => apertureFor({ kind, a_um: aUm, d_um: dUm, D_um: DUm, gratingId }), [kind, aUm, dUm, DUm, gratingId]);
  const grating = findGrating(gratingId);
  const hiddenDim = kind === 'red' && !!grating.hidden;
  const knownDim = kind === 'simple' ? aUm : kind === 'doble' ? dUm : kind === 'circular' ? DUm : hiddenDim ? null : 1000 / grating.linesPerMm;
  const lambdaKnown = source.hidden ? null : source.wavelength;
  const maxOrder = kind === 'circular' ? 3 : 10;

  // Cualquier cambio del montaje invalida la lectura del calibrador y el registro del sensor.
  const config = `${sourceId}|${kind}|${aUm}|${dUm}|${DUm}|${gratingId}|${L}`;
  useEffect(() => { setCalRead(false); setTrace([]); setSavedMsg(''); }, [config]);
  useEffect(() => { setCalRead(false); }, [cursorA, cursorB, order, view]);
  useEffect(() => { if (order > maxOrder) setOrder(maxOrder); }, [order, maxOrder]);

  /* ---------------- lecturas de los instrumentos */
  const { measure, remeasure, real } = useMeasure();
  const scaleId: InstrumentId = view === 'amplia' ? 'regla' : 'calibrador';
  const Lread = measure(L, { ...spec('riel'), key: 'riel' });
  const readA = measure(cursorA, { ...spec(scaleId), key: 'cursorA' });
  const readB = measure(cursorB, { ...spec(scaleId), key: 'cursorB' });
  const analysis = useMemo(() => {
    try {
      return analyzeCursors({ kind, dim_um: knownDim, lambda_nm: lambdaKnown, L_cm: Lread, yA_mm: readA, yB_mm: readB, m: Math.min(order, maxOrder) });
    } catch { return null; }
  }, [kind, knownDim, lambdaKnown, Lread, readA, readB, order, maxOrder]);
  const sensorTrue = useMemo(() => (on ? sensorIntensity(ap, source, L, sensorY) : 0), [on, ap, source, L, sensorY]);
  const sensorRead = Math.max(0, measure(sensorTrue, { ...spec('sensor'), key: `sensor:${sensorY}` }));

  /* ---------------- registro del sensor (data logger) */
  const logPoint = useCallback((y: number, I: number) => {
    setTrace((t) => [...t.filter((p) => p.x !== y), { x: y, y: I }].sort((p, q) => p.x - q.x));
  }, []);
  useEffect(() => { if (on && !scanning) logPoint(sensorY, sensorRead); }, [on, scanning, sensorY, sensorRead, logPoint]);

  const raf = useRef<number | null>(null);
  useEffect(() => () => { if (raf.current !== null) cancelAnimationFrame(raf.current); }, []);
  const scan = () => {
    if (!on || scanning) return;
    const n = 120;
    const pts = Array.from({ length: n + 1 }, (_, i) => Number((-V.half + (2 * V.half * i) / n).toFixed(3)));
    const read = (y: number) => {
      const I = sensorIntensity(ap, source, L, y);
      return Math.max(0, measure(I, { ...spec('sensor'), key: `sensor:${y}` }));
    };
    setSavedMsg('');
    if (prefersReducedMotion()) {
      setTrace(pts.map((y) => ({ x: y, y: read(y) })));
      setSensorY(pts[n]);
      playSound('beep', { freq: 2400 });
      return;
    }
    setScanning(true);
    setTrace([]);
    const dur = 3500;
    const start = performance.now();
    let done = 0;
    const tick = (now: number) => {
      const k = Math.min(n, Math.floor((Math.max(0, now - start) / dur) * n));
      const batch: Pt[] = [];
      for (; done <= k; done++) batch.push({ x: pts[done], y: read(pts[done]) });
      if (batch.length) setTrace((t) => [...t, ...batch]);
      setSensorY(pts[Math.min(k, n)]);
      if (k < n) raf.current = requestAnimationFrame(tick);
      else { raf.current = null; setScanning(false); playSound('beep', { freq: 2400 }); }
    };
    raf.current = requestAnimationFrame(tick);
  };

  /* ---------------- imagen del patrón */
  const patternUrl = useMemo(() => (on ? renderPattern(ap, source, L, V.half, exposure) : null), [on, ap, source, L, V.half, exposure]);

  /* ---------------- acciones */
  const toggle = () => { setOn((v) => !v); playSound('switch'); };
  const changeSource = (id: string) => { if (id !== sourceId) { setSourceId(id as SourceId); playSound('clack', { intensity: 0.4 }); } };
  const changeKind = (k: ElementKind) => {
    if (k === kind) return;
    setKind(k);
    if (k === 'red' && view !== 'amplia') setView('amplia');
    if (k !== 'red' && view === 'amplia') setView('detalle');
    playSound('clack', { intensity: 0.6 });
  };
  const changeGrating = (id: string) => { if (id !== gratingId) { setGratingId(id); playSound('clack', { intensity: 0.5 }); } };
  const changeView = (v: ViewId) => {
    const h = VIEWS[v].half, st = VIEWS[v].step;
    const q = (x: number) => Number((Math.round(Math.max(-h, Math.min(h, x)) / st) * st).toFixed(2));
    setView(v); setCursorA(q(cursorA)); setCursorB(q(cursorB)); setSensorY(q(sensorY));
  };
  const changeD = (v: number) => { setDUm(v); if (aUm >= v) setAUm(Math.max(INTERFERENCE_LIMITS.slitWidth[0], v - 10)); };
  const readCaliper = () => { remeasure('cursorA', 'cursorB', 'riel'); setCalRead(true); playSound('click'); };

  const record = () => {
    if (!analysis) return;
    api.addTrial('franjas', {
      fuente: source.name, elemento: kind === 'red' ? grating.name : KIND_NAMES[kind],
      lambda: lambdaKnown,
      a: kind === 'simple' || kind === 'doble' ? aUm : null,
      d: kind === 'doble' ? dUm : kind === 'red' && !hiddenDim ? Number((1000 / grating.linesPerMm).toFixed(4)) : null,
      D: kind === 'circular' ? DUm : null,
      L: Lread, m: Math.min(order, maxOrder),
      dy: Number(analysis.dy.toFixed(3)), y: Number(analysis.y.toFixed(4)),
      seno: Number(analysis.sinTheta.toFixed(6)), theta: Number(analysis.thetaDeg.toFixed(4)),
      lambdaCalc: analysis.lambdaCalc === null ? null : Number(analysis.lambdaCalc.toFixed(2)),
      dimCalc: analysis.dimCalc === null ? null : Number(analysis.dimCalc.toFixed(4)),
    });
    playSound('confirm');
  };
  const saveTrace = () => {
    for (const p of trace) {
      api.addTrial('perfil', { fuente: source.name, elemento: kind === 'red' ? grating.name : KIND_NAMES[kind], L: Lread, posicion: p.x, intensidad: p.y });
    }
    setSavedMsg(`Se guardaron ${trace.length} puntos del sensor en la tabla «Perfil de intensidad».`);
  };

  /* ---------------- modo avanzado */
  usePublishModel(() => {
    const r = calRead ? analysis : null;
    const sym = DIM_SYMBOL[kind];
    return {
      vars: {
        lam: { sym: '\\lambda', name: 'Longitud de onda calculada', value: r?.lambdaCalc ?? null, unit: 'nm', decimals: 1 },
        dim: { sym, name: kind === 'simple' ? 'Ancho de la rendija' : kind === 'circular' ? 'Diámetro del agujero' : 'Periodo (separación entre rendijas)', value: knownDim, unit: 'µm', decimals: kind === 'red' ? 3 : 0 },
        s: { sym: '\\sin\\theta', name: 'Seno del ángulo de difracción', value: r?.sinTheta ?? null, decimals: 5 },
        y: { sym: 'y', name: 'Posición del orden marcado (Δy/2)', value: r?.y ?? null, unit: 'mm', decimals: 3 },
        Lm: { sym: 'L', name: 'Distancia diapositiva–pantalla', value: Lread * 10, unit: 'mm', decimals: 0 },
        k: { sym: 'k', name: kind === 'circular' ? 'Coeficiente del anillo de Airy' : 'Orden m', value: r?.k ?? null, decimals: kind === 'circular' ? 3 : 0 },
      },
      equations: [
        { title: 'Ángulo exacto en una pantalla plana', lhs: 's', expr: '\\frac{[y]}{\\sqrt{[y]^{2} + [Lm]^{2}}}' },
        { title: kind === 'simple' ? 'Mínimos de una rendija' : kind === 'circular' ? 'Anillos oscuros de Airy' : 'Máximos de interferencia', lhs: 'lam', expr: '\\frac{[dim] \\cdot [s]}{[k]}', note: `${sym}·sen θ = k·λ; λ en nm = 1000 × ${sym} (µm) × sen θ / k.` },
      ],
      note: calRead ? undefined : 'Coloca los cursores y pulsa «Leer el calibrador» para ver los valores.',
    };
  }, [calRead, analysis, kind, knownDim, Lread]);

  /* ---------------- avisos */
  const warnings = interferenceConditions({ ap, wavelength: source.wavelength, L, dUm, aUm });

  /* ---------------- dibujo */
  const color = source.wavelength === null ? '#fff6dc' : wavelengthToHex(source.wavelength);
  const screenX = xOfCm(SLIDE_CM + L);
  const rays = useMemo(() => {
    if (!on) return [] as { x: number; y: number; hits: boolean; c: string; o: number; w: number }[];
    const out: { x: number; y: number; hits: boolean; c: string; o: number; w: number }[] = [];
    const lines = source.wavelength === null ? WHITE_LINES : [source.wavelength];
    if (kind === 'red') {
      for (const l of lines) {
        const lam = l * 1e-9;
        const mMax = Math.floor((ap.d / lam) * (1 - 1e-12));
        for (let m = -mMax; m <= mMax; m++) {
          if (m === 0) continue;
          const s = (m * lam) / ap.d;
          const e = rayEnd(s, L);
          out.push({ ...e, c: wavelengthToHex(l), o: Math.min(1, 0.25 + Math.sqrt(intensity(ap, s, lam)) * 0.9), w: source.wavelength === null ? 1.4 : 2 });
        }
      }
    }
    return out;
  }, [on, kind, ap, source, L]);
  /** Abertura angular del lóbulo central (para el abanico de luz en la vista superior). */
  const lobeSin = kind === 'red' ? 0 : Math.min(0.9, (kind === 'circular' ? AIRY_ZEROS[0] : 1) * ((source.wavelength ?? 650) * 1e-9) / (kind === 'circular' ? ap.D : ap.a));
  const fan = on && kind !== 'red' ? rayEnd(lobeSin, L) : null;

  // Vista frontal de la pantalla
  const FX0 = 20, FY0 = 14;
  const fx = (y_mm: number) => FX0 + ((y_mm + V.half) / (2 * V.half)) * IW;
  const ticks = useMemo(() => {
    const out: { v: number; major: boolean }[] = [];
    const n = Math.round(V.half / V.minor);
    for (let i = -n; i <= n; i++) { const v = i * V.minor; out.push({ v, major: Math.abs(v % V.label) < 1e-9 }); }
    return out;
  }, [V]);

  const describePattern = (): string => {
    if (!on) return 'La fuente de luz está apagada: la pantalla está oscura.';
    const col = source.wavelength === null ? 'luz blanca' : `luz ${source.id === 'desconocido' ? 'del láser desconocido' : source.id}`;
    const base = {
      simple: `Rendija simple con ${col}: una franja central brillante, el doble de ancha que las demás, y franjas laterales mucho más débiles separadas por zonas oscuras.`,
      doble: `Doble rendija con ${col}: muchas franjas brillantes equidistantes separadas por franjas oscuras, cuyo brillo sigue la envolvente de una sola rendija.`,
      red: `Red de difracción con ${col}: una mancha central y manchas brillantes muy nítidas y separadas a cada lado (órdenes)${source.wavelength === null ? '; cada orden es un pequeño arcoíris con el violeta más cerca del centro' : ''}.`,
      circular: `Agujero circular con ${col}: un disco central brillante (disco de Airy) rodeado de anillos concéntricos tenues.`,
    }[kind];
    return `${base} La vista abarca ${V.name} alrededor del centro. Usa el sensor de luz para leer la intensidad en cada posición.`;
  };

  const filmColor = useMemo(() => thinFilmColor(film), [film]);
  const filmStrip = useMemo(() => Array.from({ length: 61 }, (_, i) => thinFilmColor(i * 20)), []);
  const filmPeaks = thinFilmConstructive(film);

  const dimLabel = kind === 'simple' ? 'a calculado' : kind === 'circular' ? 'D calculado' : 'd calculado';
  const canMeasure = on && !scanning;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" tabIndex={0} role="region" aria-label="Banco óptico visto desde arriba (se desplaza en pantallas angostas)">
          <ManipScene viewBox={`0 0 ${BW} ${BH}`} label="Pantalla movible del banco óptico" scene={
            <svg viewBox={`0 0 ${BW} ${BH}`} role="img" aria-labelledby="itf-t itf-d">
              <title id="itf-t">Banco óptico visto desde arriba</title>
              <desc id="itf-d">{`Riel con escala de 0 a ${RAIL_CM} cm. ${source.name} ${on ? 'encendido' : 'apagado'}; ${kind === 'red' ? grating.name.toLowerCase() : KIND_NAMES[kind].toLowerCase()} en la marca de ${SLIDE_CM} cm; pantalla blanca de 80 cm de ancho a ${fmt(L, 0)} cm de la diapositiva.` +
                (on && kind === 'red' ? ` Salen ${rays.length} haces difractados además del central; ${rays.filter((r) => r.hits).length} llegan a la pantalla.` : '')}</desc>
              <BenchDefs />
              <rect x="0" y="0" width={BW} height={BH} rx="10" fill="var(--bench-top, #c9d3d1)" />
              <rect x="0" y="0" width={BW} height={BH} rx="10" fill="url(#kit-bench-grain)" />
              <rect x="0" y="0" width={BW} height={BH} rx="10" fill="url(#kit-bench-sheen)" />
              {/* Riel con escala en centímetros */}
              <rect x={RAIL_X0 - 8} y={RAIL_Y - 12} width={RAIL_CM * PX_CM + 16} height={24} rx={3} fill="url(#itf-rail)" stroke="#7d898e" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
              <rect x={RAIL_X0 - 8} y={RAIL_Y - 1.5} width={RAIL_CM * PX_CM + 16} height={3} fill="#6f7b80" opacity="0.5" />
              <rect x={RAIL_X0 - 4} y={RAIL_Y + 13} width={RAIL_CM * PX_CM + 8} height={20} rx={2} fill="#f6f3e6" stroke="#b8b29a" strokeWidth="0.6" />
              {Array.from({ length: RAIL_CM + 1 }, (_, i) => (
                <line key={i} x1={xOfCm(i)} x2={xOfCm(i)} y1={RAIL_Y + 13} y2={RAIL_Y + 13 + (i % 10 === 0 ? 9 : i % 5 === 0 ? 6 : 3.5)} stroke="#2c2c2c" strokeWidth={i % 10 === 0 ? 0.9 : 0.5} />
              ))}
              {Array.from({ length: RAIL_CM / 20 + 1 }, (_, i) => (
                <text key={i} x={xOfCm(i * 20)} y={RAIL_Y + 31} textAnchor="middle" style={{ fontSize: 8, fill: '#2c2c2c', fontFamily: 'var(--font-data)' }}>{i * 20}</text>
              ))}
              <text x={xOfCm(RAIL_CM) + 2} y={RAIL_Y + 31} textAnchor="end" style={{ fontSize: 8, fill: '#2c2c2c' }}>cm</text>
              {/* Haz del láser hasta la diapositiva */}
              {on && <line x1={xOfCm(15) + 6} y1={RAIL_Y} x2={SLIDE_X} y2={RAIL_Y} stroke="#000" strokeOpacity="0.3" strokeWidth="4.2" />}
              {on && <line x1={xOfCm(15) + 6} y1={RAIL_Y} x2={SLIDE_X} y2={RAIL_Y} stroke={color} strokeWidth="2.4" strokeLinecap="round" />}
              {/* Haces difractados */}
              <g clipPath="url(#itf-clip)">
                {fan && (
                  <path d={`M${SLIDE_X} ${RAIL_Y} L${fan.x} ${RAIL_Y - (fan.y - RAIL_Y)} L${fan.x} ${fan.y} Z`} fill={color} opacity="0.28" />
                )}
                {on && <line x1={SLIDE_X} y1={RAIL_Y} x2={screenX} y2={RAIL_Y} stroke="#000" strokeOpacity="0.3" strokeWidth="4" />}
                {on && <line x1={SLIDE_X} y1={RAIL_Y} x2={screenX} y2={RAIL_Y} stroke={color} strokeWidth="2.2" opacity="0.95" />}
                {rays.map((r, i) => <line key={`s${i}`} x1={SLIDE_X} y1={RAIL_Y} x2={r.x} y2={r.y} stroke="#000" strokeOpacity={0.22 * r.o} strokeWidth={r.w + 1.6} />)}
                {rays.map((r, i) => <line key={i} x1={SLIDE_X} y1={RAIL_Y} x2={r.x} y2={r.y} stroke={r.c} strokeWidth={r.w} opacity={r.o} />)}
              </g>
              <LaserTop on={on} color={color} />
              <text x={(xOfCm(1) + xOfCm(15)) / 2} y={RAIL_Y - 26} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>{source.wavelength === null ? 'Lámpara' : 'Láser'}</text>
              {/* Portadiapositivas */}
              <rect x={SLIDE_X - 7} y={RAIL_Y - 16} width={14} height={32} rx={2} fill="url(#kit-metal)" stroke="#7d898e" strokeWidth="0.7" filter="url(#kit-shadow-soft)" />
              <rect x={SLIDE_X - 2} y={RAIL_Y - 34} width={4} height={68} rx={1} fill="#e8e2cf" stroke="#8c8573" strokeWidth="0.6" />
              <rect x={SLIDE_X - 0.6} y={RAIL_Y - 4} width={1.2} height={8} fill="#1b1b1b" />
              <text x={SLIDE_X} y={RAIL_Y - 40} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>Diapositiva</text>
              {/* Pantalla */}
              <ContactShadow x={screenX - 10} y={RAIL_Y + 12} w={20} h={6} />
              <rect x={screenX - 9} y={RAIL_Y - 14} width={18} height={28} rx={2} fill="url(#kit-metal)" stroke="#7d898e" strokeWidth="0.7" />
              <rect x={screenX - 2.5} y={RAIL_Y - SCREEN_HALF_PX} width={5} height={2 * SCREEN_HALF_PX} rx={1.5} fill="url(#itf-screen)" stroke="#8b8f86" strokeWidth="0.7" filter="url(#kit-shadow-soft)" />
              {on && <circle cx={screenX - 3} cy={RAIL_Y} r={5} fill={color} opacity="0.7" />}
              {rays.filter((r) => r.hits).map((r, i) => <circle key={i} cx={screenX - 3} cy={r.y} r={3} fill={r.c} opacity={r.o} />)}
              <text x={screenX + 6} y={RAIL_Y - SCREEN_HALF_PX + 10} style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>Pantalla</text>
              {/* Cota L */}
              <g aria-hidden="true">
                <line x1={SLIDE_X} x2={screenX - 3} y1={RAIL_Y + 52} y2={RAIL_Y + 52} stroke="var(--ink-2)" strokeWidth="0.8" />
                <line x1={SLIDE_X} x2={SLIDE_X} y1={RAIL_Y + 44} y2={RAIL_Y + 58} stroke="var(--ink-2)" strokeWidth="0.8" />
                <line x1={screenX - 3} x2={screenX - 3} y1={RAIL_Y + 44} y2={RAIL_Y + 58} stroke="var(--ink-2)" strokeWidth="0.8" />
                <text x={(SLIDE_X + screenX) / 2} y={RAIL_Y + 66} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)', fontStyle: 'italic' }}>L</text>
              </g>
              <text x={BW - 12} y={BH - 10} textAnchor="end" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>Vista superior · escala horizontal y vertical: 3 px por cm</text>
            </svg>}>
            <Plunger label="Pantalla sobre el riel (distancia L)" value={L} min={INTERFERENCE_LIMITS.distance[0]} max={INTERFERENCE_LIMITS.distance[1]} step={1} pageStep={10}
              unit="cm" decimals={0} from={{ x: xOfCm(SLIDE_CM + INTERFERENCE_LIMITS.distance[0]), y: RAIL_Y }} to={{ x: xOfCm(SLIDE_CM + INTERFERENCE_LIMITS.distance[1]), y: RAIL_Y }}
              onChange={setL} onDragChange={(d) => { if (!d) playSound('thunk', { intensity: 0.3 }); }} />
          </ManipScene>
        </div>

        <div className="bench" tabIndex={0} role="region" aria-label="Vista de frente de la pantalla con el calibrador y el sensor de luz">
          <ManipScene viewBox="0 0 760 300" label="Cursores del calibrador y sensor de luz" scene={
            <svg viewBox="0 0 760 300" role="img" aria-labelledby="itf-pt itf-pd">
              <title id="itf-pt">Vista de frente de la pantalla</title>
              <desc id="itf-pd">{`${describePattern()} Cursores del ${scaleId === 'regla' ? 'la regla' : 'calibrador'} en ${fmt(cursorA, 2)} mm y ${fmt(cursorB, 2)} mm; sensor de luz en ${fmt(sensorY, 2)} mm.`}</desc>
              <rect x={FX0 - 8} y={FY0 - 6} width={IW + 16} height={IH + 12} rx={4} fill="url(#kit-body)" stroke="var(--line)" filter="url(#kit-shadow)" />
              <rect x={FX0} y={FY0} width={IW} height={IH} fill="#0b0c0e" />
              {patternUrl && <image href={patternUrl} x={FX0} y={FY0} width={IW} height={IH} preserveAspectRatio="none" />}
              {!on && <text x={FX0 + IW / 2} y={FY0 + IH / 2 + 4} textAnchor="middle" style={{ fontSize: 13, fill: '#9aa3a6' }}>Fuente apagada: pulsa «Encender la fuente de luz»</text>}
              {/* Líneas de los cursores */}
              {[cursorA, cursorB].map((c, i) => (
                <g key={i}>
                  <line x1={fx(c)} x2={fx(c)} y1={FY0} y2={FY0 + IH + 22} stroke="#ffd54a" strokeWidth="1" strokeDasharray="4 3" />
                  <text x={fx(c)} y={FY0 + 11} textAnchor="middle" style={{ fontSize: 10, fontWeight: 700, fill: '#ffd54a' }}>{i === 0 ? 'A' : 'B'}</text>
                </g>
              ))}
              {/* Sensor de luz */}
              <g>
                <line x1={fx(sensorY)} x2={fx(sensorY)} y1={FY0 - 6} y2={FY0 + IH / 2 - 16} stroke="#1d2427" strokeWidth="2" />
                <rect x={fx(sensorY) - 9} y={FY0 + IH / 2 - 16} width={18} height={32} rx={3} fill="url(#kit-body-dark)" stroke="#0b0f0d" strokeWidth="0.8" opacity="0.92" />
                <rect x={fx(sensorY) - 1.2} y={FY0 + IH / 2 - 9} width={2.4} height={18} fill="#9ad7ff" opacity="0.85" />
              </g>
              {/* Calibrador / regla bajo la pantalla */}
              <rect x={FX0 - 6} y={FY0 + IH + 8} width={IW + 12} height={26} rx={3} fill={scaleId === 'regla' ? 'url(#kit-wood)' : 'url(#kit-metal)'} stroke="#7d898e" strokeWidth="0.7" />
              {ticks.map((t) => (
                <line key={t.v} x1={fx(t.v)} x2={fx(t.v)} y1={FY0 + IH + 8} y2={FY0 + IH + 8 + (t.major ? 10 : 5)} stroke="#222" strokeWidth={t.major ? 0.9 : 0.5} />
              ))}
              {ticks.filter((t) => t.major).map((t) => (
                <text key={t.v} x={fx(t.v)} y={FY0 + IH + 29} textAnchor="middle" style={{ fontSize: 9, fill: '#222', fontFamily: 'var(--font-data)' }}>{fmt(t.v, 0)}</text>
              ))}
              {[cursorA, cursorB].map((c, i) => (
                <path key={i} d={`M${fx(c) - 6} ${FY0 + IH + 34} L${fx(c)} ${FY0 + IH + 22} L${fx(c) + 6} ${FY0 + IH + 34} Z`} fill="#c62828" stroke="#7f1414" strokeWidth="0.6" />
              ))}
              <text x={FX0} y={FY0 + IH + 50} style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>{scaleId === 'regla' ? 'Regla de la pantalla en mm (resolución 1 mm)' : 'Calibrador en mm (resolución 0,05 mm)'} · 0 = centro del patrón</text>
              {/* Registrador de datos del sensor */}
              <g filter="url(#kit-shadow-soft)">
                <rect x={556} y={252} width={186} height={42} rx={6} fill="url(#kit-body)" stroke="var(--line)" />
              </g>
              <Lcd x={562} y={258} w={124} h={30} text={on ? fmt(sensorRead, 1) : '0,0'} unit="%" />
              <text x={692} y={270} style={{ fontSize: 8.5, fill: '#33403f', fontWeight: 700 }}>SENSOR</text>
              <text x={692} y={282} style={{ fontSize: 8.5, fill: '#33403f' }}>DE LUZ</text>
            </svg>}>
            <Plunger label="Cursor A (arrastrar sobre la pantalla)" value={cursorA} min={-V.half} max={V.half} step={V.step} pageStep={view === 'amplia' ? 10 : 1}
              unit="mm" decimals={2} from={{ x: fx(-V.half), y: FY0 + IH + 28 }} to={{ x: fx(V.half), y: FY0 + IH + 28 }} size={30} onChange={setCursorA} />
            <Plunger label="Cursor B (arrastrar sobre la pantalla)" value={cursorB} min={-V.half} max={V.half} step={V.step} pageStep={view === 'amplia' ? 10 : 1}
              unit="mm" decimals={2} from={{ x: fx(-V.half), y: FY0 + IH + 28 }} to={{ x: fx(V.half), y: FY0 + IH + 28 }} size={30} onChange={setCursorB} />
            <Plunger label="Sensor de luz (arrastrar sobre la pantalla)" value={sensorY} min={-V.half} max={V.half} step={V.step} pageStep={view === 'amplia' ? 10 : 1}
              unit="mm" decimals={2} from={{ x: fx(-V.half), y: FY0 + IH / 2 }} to={{ x: fx(V.half), y: FY0 + IH / 2 }} size={30} onChange={setSensorY} disabled={scanning} />
          </ManipScene>
        </div>
        <ManipHint>Arrastra la pantalla por el riel, y los cursores A y B y el sensor sobre la pantalla; o enfócalos con Tab y usa las flechas (RePág/AvPág para pasos grandes).</ManipHint>

        <Readout items={[
          { k: 'Distancia L (escala del riel)', v: `${fmt(Lread, 1)} cm`, data: true, resolution: resolutionText(spec('riel').resolution, 'cm') },
          { k: 'Longitud de onda de la fuente', v: source.wavelength === null ? '400 a 700 nm (blanca)' : source.hidden ? 'desconocida' : `${fmt(source.wavelength, 0)} nm` },
          { k: 'Posición del sensor', v: `${fmt(sensorY, 2)} mm` },
          { k: 'Intensidad en el sensor', v: on ? `${fmt(sensorRead, 1)} %` : 'fuente apagada', data: true, resolution: resolutionText(spec('sensor').resolution, '%') },
        ]} />
        <Readout items={[
          { k: 'Separación entre cursores Δy', v: calRead && analysis ? `${fmt(analysis.dy, view === 'amplia' ? 0 : 2)} mm` : '—', data: true, resolution: resolutionText(spec(scaleId).resolution, 'mm') },
          { k: 'y = Δy/2', v: calRead && analysis ? `${fmt(analysis.y, 3)} mm` : '—' },
          { k: 'sen θ = y/√(y² + L²)', v: calRead && analysis ? fmt(analysis.sinTheta, 5) : '—' },
          { k: 'Ángulo θ', v: calRead && analysis ? `${fmt(analysis.thetaDeg, 3)}°` : '—' },
          { k: 'λ calculada', v: calRead && analysis ? (analysis.lambdaCalc === null ? '— (periodo desconocido)' : `${fmt(analysis.lambdaCalc, 1)} nm`) : '—', data: true },
          { k: dimLabel, v: calRead && analysis ? (analysis.dimCalc === null ? '— (λ desconocida)' : kind === 'red' ? `${fmt(analysis.dimCalc, 3)} µm (${fmt(1000 / analysis.dimCalc, 0)} líneas/mm)` : `${fmt(analysis.dimCalc, 1)} µm`) : '—', data: true },
        ]} />
        <Warnings list={warnings} />

        <div className="card stack-sm">
          <Chart title="Registro del sensor de luz: intensidad contra posición" xLabel="Posición en la pantalla y (mm)" yLabel="Intensidad relativa (%)" xUnit="mm" yUnit="%" height={220}
            exportName="perfil-intensidad" xDomain={[-V.half, V.half]} yDomain={[0, 100]} errorNote="Cada punto es el promedio de la intensidad sobre la ventana de 0,2 mm del sensor."
            emptyText="Enciende la fuente y mueve el sensor de luz sobre la pantalla (o usa «Barrido automático del sensor»): cada posición agrega un punto."
            series={[{ label: `${source.wavelength === null || source.hidden ? source.name : `${fmt(source.wavelength, 0)} nm`} · ${kind === 'red' ? grating.name : KIND_NAMES[kind]} · L = ${fmt(L, 0)} cm`, color: 'var(--series-1)', kind: 'line', points: trace }]} />
          <div className="btn-row">
            <button type="button" className="btn" onClick={scan} disabled={!canMeasure}>Barrido automático del sensor</button>
            <button type="button" className="btn" onClick={saveTrace} disabled={scanning || trace.length === 0}>Guardar el barrido en la tabla</button>
            <button type="button" className="btn ghost" onClick={() => { setTrace([]); setSavedMsg(''); }} disabled={scanning || trace.length === 0}>Borrar el registro</button>
          </div>
          {savedMsg && <p className="small" role="status">{savedMsg}</p>}
        </div>

        <details className="card">
          <summary>Bonus: colores de una pompa de jabón (película delgada)</summary>
          <div className="stack-sm">
            <Slider label="Espesor de la película de jabón" value={film} min={INTERFERENCE_LIMITS.film[0]} max={INTERFERENCE_LIMITS.film[1]} step={10} unit="nm" decimals={0} onChange={setFilm} />
            <svg viewBox="0 0 520 130" role="img" aria-labelledby="itf-ft itf-fd" style={{ width: '100%', maxWidth: 520 }}>
              <title id="itf-ft">Colores de interferencia de una película de jabón</title>
              <desc id="itf-fd">{`Franja vertical de una película que se adelgaza hacia arriba (0 a 1200 nm) y muestra del color reflejado con ${fmt(film, 0)} nm de espesor.`}</desc>
              <defs>
                <linearGradient id="itf-film" x1="0" x2="1" y1="0" y2="0">
                  {filmStrip.map((c, i) => <stop key={i} offset={i / 60} stopColor={c} />)}
                </linearGradient>
              </defs>
              <rect x="10" y="20" width="360" height="40" rx="6" fill="url(#itf-film)" stroke="var(--line)" />
              <line x1={10 + (film / 1200) * 360} x2={10 + (film / 1200) * 360} y1="14" y2="66" stroke="var(--ink)" strokeWidth="1.5" />
              {[0, 300, 600, 900, 1200].map((t) => <text key={t} x={10 + (t / 1200) * 360} y="80" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{fmt(t, 0)} nm</text>)}
              <text x="10" y="104" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Espesor de la película (arriba de la pompa es más delgada)</text>
              <circle cx="450" cy="60" r="44" fill={filmColor} stroke="var(--line)" />
              <ellipse cx="434" cy="42" rx="12" ry="7" fill="#fff" opacity="0.35" />
            </svg>
            <p className="small">{film === 0 || filmPeaks.length === 0
              ? 'Con una película muy delgada (≲ 30 nm) las dos reflexiones se cancelan para todos los colores: la pompa se ve negra justo antes de reventar.'
              : `Colores reforzados (2·n·t = (m + ½)·λ, n = 1,33): ${filmPeaks.map((l) => `${fmt(l, 0)} nm`).join(', ')}.`}</p>
          </div>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Fuente de luz</h3>
          <Select label="Fuente de luz" value={sourceId} onChange={changeSource} options={SOURCES.map((s) => ({ value: s.id, label: s.name }))} />
          <button type="button" className={`btn${on ? '' : ' primary'}`} aria-pressed={on} onClick={toggle}>{on ? 'Apagar la fuente de luz' : 'Encender la fuente de luz'}</button>
          <Notice kind="warn">Seguridad: nunca mires el haz de un láser ni su reflejo en superficies brillantes (un CD, un reloj, un espejo), ni lo apuntes a otras personas. En el colegio usa solo punteros de clase 2 (menos de 1 mW) y trabaja con la pantalla a la altura de la mesa.</Notice>
        </div>
        <div className="card stack">
          <h3>Diapositiva</h3>
          <Segmented<ElementKind> label="Tipo de diapositiva" value={kind} onChange={changeKind}
            options={(['simple', 'doble', 'red', 'circular'] as ElementKind[]).map((k) => ({ value: k, label: KIND_NAMES[k] }))} />
          {kind === 'doble' && <Slider label="Separación entre rendijas d" value={dUm} min={INTERFERENCE_LIMITS.slitSeparation[0]} max={INTERFERENCE_LIMITS.slitSeparation[1]} step={10} unit="µm" decimals={0} onChange={changeD} />}
          {(kind === 'simple' || kind === 'doble') && (
            <Slider label="Ancho de la rendija a" value={aUm} min={INTERFERENCE_LIMITS.slitWidth[0]} max={kind === 'doble' ? Math.min(INTERFERENCE_LIMITS.slitWidth[1], dUm - 10) : INTERFERENCE_LIMITS.slitWidth[1]} step={5} unit="µm" decimals={0} onChange={setAUm} />
          )}
          {kind === 'red' && <Select label="Red de difracción" value={gratingId} onChange={changeGrating} options={GRATINGS.map((g) => ({ value: g.id, label: g.name }))} />}
          {kind === 'circular' && <Slider label="Diámetro del agujero D" value={DUm} min={INTERFERENCE_LIMITS.aperture[0]} max={INTERFERENCE_LIMITS.aperture[1]} step={10} unit="µm" decimals={0} onChange={setDDUm} />}
        </div>
        <div className="card stack">
          <h3>Pantalla y calibrador</h3>
          <Slider label="Distancia rendija–pantalla L" value={L} min={INTERFERENCE_LIMITS.distance[0]} max={INTERFERENCE_LIMITS.distance[1]} step={1} unit="cm" decimals={0} onChange={setL} />
          <Segmented<ViewId> label="Escala de la vista de la pantalla" value={view} onChange={changeView}
            options={(['detalle', 'media', 'amplia'] as ViewId[]).map((v) => ({ value: v, label: VIEWS[v].name }))} />
          <Slider label="Exposición de la pantalla" value={exposure} min={1} max={60} step={1} decimals={0} onChange={setExposure}
            hint="Solo cambia el brillo de la imagen (como la exposición de una cámara) para ver los máximos débiles; no cambia las lecturas del sensor." />
          <Slider label="Cursor A del calibrador" value={cursorA} min={-V.half} max={V.half} step={V.step} unit="mm" decimals={2} onChange={setCursorA} />
          <Slider label="Cursor B del calibrador" value={cursorB} min={-V.half} max={V.half} step={V.step} unit="mm" decimals={2} onChange={setCursorB} />
          <Slider label="Orden m marcado por los cursores" value={Math.min(order, maxOrder)} min={1} max={maxOrder} step={1} decimals={0} onChange={setOrder}
            hint={`Coloca los cursores sobre ${CURSOR_TARGET[kind]}.`} />
          <button type="button" className="btn primary" onClick={readCaliper} disabled={!canMeasure}>Leer el calibrador</button>
          <RecordButton onRecord={record} disabled={!calRead || !analysis} />
          {!calRead && <p className="small muted">Enciende la fuente, ubica los cursores y pulsa «Leer el calibrador» para poder guardar el ensayo.</p>}
        </div>
        <div className="card stack">
          <h3>Sensor de luz</h3>
          <Slider label="Posición del sensor de luz" value={sensorY} min={-V.half} max={V.half} step={V.step} unit="mm" decimals={2} onChange={(v) => { if (!scanning) setSensorY(v); }} />
          {on && source.wavelength !== null && <p className="small muted">Frecuencia de esta luz: f = c/λ ≈ {source.hidden ? '? (determina λ primero)' : `${fmt(lightFrequency(source.wavelength) / 1e12, 0)} THz`}.</p>}
        </div>
        <Notice>{real
          ? 'Instrumento real: los cursores, la escala del riel y el sensor tienen error aleatorio (ficha de incertidumbre). Pulsa de nuevo «Leer el calibrador» para repetir la lectura.'
          : 'Modelo de Fraunhofer (campo lejano) con luz monocromática y rendijas de bordes perfectos. Las posiciones usan la geometría exacta y = L·tan θ; el brillo de la imagen está comprimido para ver los máximos débiles.'}</Notice>
      </div>
    </div>
  );
}
