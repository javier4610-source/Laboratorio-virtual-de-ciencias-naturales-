import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import {
  BASE_EQUILIBRIUM, FOODWEB_DEFAULTS, FOODWEB_LIMITS, LEVEL_NAMES, LINKS, percentChange, simulateFoodWeb, SPECIES,
  type SpeciesId, type TrophicLevel,
} from '../models/foodweb';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

const ANIM_MS = 2500;

/** Posición de cada nodo en el diagrama (los productores abajo, el depredador tope arriba). */
const NODE_POS: Record<SpeciesId, { x: number; y: number }> = {
  pastos: { x: 320, y: 318 },
  saltamontes: { x: 150, y: 232 },
  ratones: { x: 470, y: 232 },
  ranas: { x: 130, y: 132 },
  serpientes: { x: 330, y: 128 },
  gavilanes: { x: 540, y: 44 },
};
/* ------------------------------------------------------------------ ilustraciones vectoriales
 * Cada ilustración se dibuja centrada en (0, 0) dentro de una caja de unos 40 × 40 unidades.
 * Son vectores propios (no emojis), así se ven igual en cualquier sistema operativo. */

function GrassArt() {
  return (
    <g>
      <ellipse cx="0" cy="15" rx="17" ry="3.5" fill="#6b4f2a" opacity="0.35" />
      {[[-12, -6, '#3f8f3a'], [-6, -16, '#2f7a33'], [0, -19, '#4ea445'], [6, -14, '#2f7a33'], [12, -8, '#3f8f3a'], [-3, -10, '#62b158'], [4, -6, '#62b158']].map(([dx, top, c], i) => (
        <path key={i} d={`M${Number(dx) - 2.2} 15 Q ${Number(dx) - 1} ${(Number(top) + 15) / 2} ${Number(dx) + (i % 2 ? 4 : -4)} ${top} Q ${Number(dx) + 1} ${(Number(top) + 15) / 2} ${Number(dx) + 2.2} 15 Z`} fill={String(c)} />
      ))}
      {[[-6, -16], [6, -14], [0, -19]].map(([x, y], i) => (
        <g key={i}>
          <ellipse cx={x + (i === 1 ? 4 : -4)} cy={y + 1} rx="1.8" ry="3.2" fill="#d9b45a" transform={`rotate(${i === 1 ? 25 : -25} ${x} ${y})`} />
          <ellipse cx={x + (i === 1 ? 6 : -2)} cy={y + 5} rx="1.6" ry="2.8" fill="#c99d3f" transform={`rotate(${i === 1 ? 35 : -35} ${x} ${y})`} />
        </g>
      ))}
    </g>
  );
}

function GrasshopperArt() {
  return (
    <g>
      <path d="M-4 4 L-14 13 M-1 5 L-6 14 M3 5 L4 14" stroke="#4d7a1f" strokeWidth="1.6" strokeLinecap="round" fill="none" />
      <path d="M-2 0 L8 -10 L14 12" stroke="#5b8f24" strokeWidth="3.2" strokeLinejoin="round" strokeLinecap="round" fill="none" />
      <path d="M8 -10 L14 12" stroke="#7fb43b" strokeWidth="1.4" fill="none" />
      <path d="M-18 2 Q -12 -6 4 -3 Q 12 -1 13 3 Q 4 7 -14 5 Z" fill="#7cb342" stroke="#4d7a1f" strokeWidth="0.9" />
      <path d="M-12 -1 Q -2 -5 9 -1" stroke="#a5d26a" strokeWidth="1.2" fill="none" />
      <path d="M-3 -3 Q 6 -4 12 2" stroke="#558b2f" strokeWidth="1" fill="none" opacity="0.7" />
      <ellipse cx="-17" cy="1" rx="4.6" ry="4.2" fill="#8bc34a" stroke="#4d7a1f" strokeWidth="0.9" />
      <circle cx="-18.4" cy="-0.2" r="1.6" fill="#2b2b1a" />
      <circle cx="-18.9" cy="-0.7" r="0.5" fill="#fff" />
      <path d="M-19 -3 Q -24 -14 -16 -18 M-18 -3 Q -20 -13 -11 -17" stroke="#4d7a1f" strokeWidth="0.9" fill="none" />
    </g>
  );
}

function MouseArt() {
  return (
    <g>
      <path d="M12 6 Q 22 4 20 -6 Q 18 -12 22 -15" stroke="#b48a78" strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="2" cy="4" rx="13" ry="9" fill="#9a7d6b" stroke="#6f5646" strokeWidth="0.9" />
      <ellipse cx="4" cy="7" rx="8" ry="4.2" fill="#c7b1a1" opacity="0.8" />
      <path d="M-8 0 Q -18 2 -19 6 Q -14 9 -6 8 Z" fill="#a8897a" stroke="#6f5646" strokeWidth="0.9" />
      <circle cx="-7" cy="-5" r="5.8" fill="#9a7d6b" stroke="#6f5646" strokeWidth="0.9" />
      <circle cx="-7" cy="-5" r="3.4" fill="#f1b5b0" />
      <circle cx="-13" cy="1.6" r="1.4" fill="#1f1714" />
      <circle cx="-13.4" cy="1.2" r="0.45" fill="#fff" />
      <circle cx="-19" cy="5.6" r="1.3" fill="#e58b86" />
      <path d="M-18 6 L-24 4 M-18 6.5 L-24 8" stroke="#6f5646" strokeWidth="0.5" />
      <path d="M-4 12 l-1 3 M6 12 l1 3" stroke="#e5a39c" strokeWidth="1.4" strokeLinecap="round" />
    </g>
  );
}

function FrogArt() {
  return (
    <g>
      <path d="M-16 12 Q -20 4 -12 3 Q -8 12 -2 14 Z" fill="#3e8e41" stroke="#1f5d24" strokeWidth="0.9" />
      <path d="M16 12 Q 20 4 12 3 Q 8 12 2 14 Z" fill="#3e8e41" stroke="#1f5d24" strokeWidth="0.9" />
      <ellipse cx="0" cy="4" rx="14" ry="10" fill="#5cb85c" stroke="#1f5d24" strokeWidth="0.9" />
      <ellipse cx="0" cy="8" rx="9" ry="5" fill="#d8ec9a" />
      <circle cx="-7" cy="-6" r="5" fill="#5cb85c" stroke="#1f5d24" strokeWidth="0.9" />
      <circle cx="7" cy="-6" r="5" fill="#5cb85c" stroke="#1f5d24" strokeWidth="0.9" />
      <circle cx="-7" cy="-6.5" r="3" fill="#f6d743" />
      <circle cx="7" cy="-6.5" r="3" fill="#f6d743" />
      <ellipse cx="-7" cy="-6.5" rx="2.2" ry="1.1" fill="#1b1b1b" />
      <ellipse cx="7" cy="-6.5" rx="2.2" ry="1.1" fill="#1b1b1b" />
      <path d="M-6 2 Q 0 5 6 2" stroke="#1f5d24" strokeWidth="1" fill="none" strokeLinecap="round" />
      <path d="M-12 13 l-4 3 M-12 13 l-1 4 M12 13 l4 3 M12 13 l1 4" stroke="#1f5d24" strokeWidth="1.2" strokeLinecap="round" />
    </g>
  );
}

function SnakeArt() {
  const body = 'M-17 12 C -22 2 -6 0 -2 6 C 2 12 18 12 16 2 C 14 -6 2 -6 4 -12';
  return (
    <g>
      <path d={body} stroke="#1c1c1c" strokeWidth="6.4" fill="none" strokeLinecap="round" />
      <path d={body} stroke="#d63c2f" strokeWidth="5" fill="none" strokeLinecap="round" />
      <path d={body} stroke="#1c1c1c" strokeWidth="5" fill="none" strokeDasharray="3 7" />
      <path d={body} stroke="#f2d04b" strokeWidth="5" fill="none" strokeDasharray="1.2 8.8" strokeDashoffset="-3.3" />
      <ellipse cx="5" cy="-14" rx="4.6" ry="3.4" fill="#1c1c1c" transform="rotate(-20 5 -14)" />
      <circle cx="6.4" cy="-15.2" r="0.9" fill="#f2d04b" />
      <path d="M9 -16 l4 -1.5 m-4 1.5 l4 0.6" stroke="#d63c2f" strokeWidth="0.8" />
    </g>
  );
}

function HawkArt() {
  return (
    <g>
      <path d="M-4 -4 Q -22 -18 -20 -2 Q -14 4 -2 4 Z" fill="#6d5a4b" stroke="#3e3128" strokeWidth="0.9" />
      <path d="M-18 -8 l5 3 M-19 -3 l5 2" stroke="#3e3128" strokeWidth="0.8" />
      <path d="M2 10 L-2 19 L6 19 L8 10 Z" fill="#8a6a52" stroke="#3e3128" strokeWidth="0.8" />
      <path d="M-1.5 14 h8 M-1 17 h7.5" stroke="#efe6d8" strokeWidth="1.1" />
      <ellipse cx="4" cy="2" rx="9" ry="11" fill="#8e7766" stroke="#3e3128" strokeWidth="0.9" />
      <ellipse cx="6" cy="5" rx="5.5" ry="7" fill="#d9a87a" />
      <path d="M3 2 h6 M3 5 h6.5 M3.5 8 h6" stroke="#b07a4f" strokeWidth="0.9" />
      <path d="M-2 -6 Q 10 -12 9 2 Q 2 0 -2 -6 Z" fill="#7a6555" stroke="#3e3128" strokeWidth="0.8" />
      <circle cx="9" cy="-10" r="6" fill="#7d8a93" stroke="#3e3128" strokeWidth="0.9" />
      <circle cx="11" cy="-11" r="1.9" fill="#f2c94c" />
      <circle cx="11.3" cy="-11" r="0.9" fill="#111" />
      <path d="M14 -10 Q 19 -10 17 -5 Q 16 -7 13.6 -7.4 Z" fill="#f2b632" stroke="#3e3128" strokeWidth="0.6" />
      <path d="M2 12 l-1 3 M7 12 l1 3" stroke="#f2b632" strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

const ART: Record<SpeciesId, () => ReactElement> = {
  pastos: GrassArt, saltamontes: GrasshopperArt, ratones: MouseArt, ranas: FrogArt, serpientes: SnakeArt, gavilanes: HawkArt,
};

function SpeciesArt({ id, x, y, scale = 1 }: { id: SpeciesId; x: number; y: number; scale?: number }) {
  const Art = ART[id];
  return <g transform={`translate(${x} ${y}) scale(${scale})`} aria-hidden="true"><Art /></g>;
}

/** Paisaje de fondo (potrero con borde de bosque) con tintes del tema: se adapta a claro y oscuro. */
function Landscape() {
  return (
    <g aria-hidden="true">
      <rect x="0" y="0" width="640" height="380" fill="url(#fw-sky)" />
      <path d="M0 250 Q 120 214 250 236 T 470 226 T 640 214 L640 380 L0 380 Z" fill="var(--bio)" opacity="0.08" />
      <path d="M0 292 Q 160 266 330 284 T 640 270 L640 380 L0 380 Z" fill="var(--bio)" opacity="0.1" />
      {/* borde de bosque */}
      {[[588, 150, 30], [620, 128, 34], [560, 176, 22], [632, 190, 26], [600, 200, 20]].map(([cx, cy, r], i) => (
        <g key={i} opacity="0.13">
          <rect x={cx - 2.5} y={cy} width="5" height={r + 30} fill="var(--amb)" />
          <circle cx={cx} cy={cy} r={r} fill="var(--bio)" />
          <circle cx={cx - r * 0.5} cy={cy + r * 0.35} r={r * 0.7} fill="var(--bio)" />
        </g>
      ))}
      {/* matas de pasto en primer plano */}
      {[30, 96, 190, 420, 520, 600].map((x, i) => (
        <path key={x} d={`M${x} 360 q 2 -14 -4 -22 M${x + 4} 360 q 0 -18 6 -26 M${x + 8} 360 q 2 -10 8 -14`} stroke="var(--bio)" strokeWidth="2" fill="none" opacity={i % 2 ? 0.22 : 0.3} strokeLinecap="round" />
      ))}
    </g>
  );
}

const LEVEL_COLOR: Record<TrophicLevel, string> = { productor: 'var(--bio)', herbivoro: 'var(--amb)', carnivoro: 'var(--fis)', tope: 'var(--bad)' };
const SERIES_COLOR: Record<SpeciesId, string> = {
  pastos: 'var(--series-3)', saltamontes: 'var(--series-6)', ratones: 'var(--series-8)', ranas: 'var(--series-5)', serpientes: 'var(--series-4)', gavilanes: 'var(--series-1)',
};
const NODE_W = 152, NODE_H = 58;
const LEVELS: TrophicLevel[] = ['tope', 'carnivoro', 'herbivoro', 'productor'];

/** Recorta una flecha entre centros para que empiece y termine en el borde de los rectángulos. */
function edgePoints(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.min((NODE_W / 2 + 4) / Math.max(Math.abs(dx), 1e-9), (NODE_H / 2 + 4) / Math.max(Math.abs(dy), 1e-9));
  return { x1: a.x + dx * t, y1: a.y + dy * t, x2: b.x - dx * t, y2: b.y - dy * t };
}

const signed = (v: number, d = 1) => {
  const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return `${r > 0 ? '+' : ''}${fmt(r, d)}`;
};

export default function FoodWebLab({ api }: LabProps) {
  const [rain, setRain] = useState(FOODWEB_DEFAULTS.rain);
  const [hunting, setHunting] = useState(FOODWEB_DEFAULTS.hunting);
  const [pesticide, setPesticide] = useState(FOODWEB_DEFAULTS.pesticide);
  const [years, setYears] = useState(FOODWEB_DEFAULTS.years);
  const [view, setView] = useState<'red' | 'piramide'>('red');
  const [plot, setPlot] = useState<'relativa' | SpeciesId>('relativa');
  const [frame, setFrame] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const raf = useRef(0);

  const res = useMemo(() => simulateFoodWeb({ rain, hunting, pesticide, years }), [rain, hunting, pesticide, years]);
  const base = useMemo(() => simulateFoodWeb({ ...FOODWEB_DEFAULTS, years }), [years]);
  const change = useMemo(() => percentChange(res.finalRaw, base.finalRaw), [res, base]);
  const lastIndex = res.times.length - 1;

  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setDone(false); setFrame(0); };
  useEffect(reset, [rain, hunting, pesticide, years]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setFrame(lastIndex); setRunning(false); setDone(true); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const el = Math.max(0, now - start);
      if (el >= ANIM_MS) { setFrame(lastIndex); setRunning(false); setDone(true); return; }
      setFrame(Math.min(lastIndex, Math.max(0, Math.floor((el / ANIM_MS) * lastIndex))));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, lastIndex]);

  const idx = Math.min(frame, lastIndex);
  const current = useMemo(() => Object.fromEntries(SPECIES.map((s) => [s.id, res.series[s.id][idx]])) as Record<SpeciesId, number>, [res, idx]);
  const levelNow = useMemo(() => {
    const l: Record<TrophicLevel, number> = { productor: 0, herbivoro: 0, carnivoro: 0, tope: 0 };
    for (const s of SPECIES) l[s.level] += current[s.id];
    return l;
  }, [current]);
  const tNow = res.times[idx];
  const started = running || done;

  const chartSeries = useMemo(() => {
    if (!started) return [];
    const pts = (id: SpeciesId, scale: (v: number) => number) => {
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i <= idx; i += 2) out.push({ x: res.times[i], y: scale(res.series[id][i]) });
      if (idx % 2 === 1) out.push({ x: res.times[idx], y: scale(res.series[id][idx]) });
      return out;
    };
    if (plot === 'relativa') {
      return SPECIES.map((s) => ({ label: s.name, color: SERIES_COLOR[s.id], kind: 'line' as const, points: pts(s.id, (v) => (100 * v) / BASE_EQUILIBRIUM[s.id]) }));
    }
    const sp = SPECIES.find((s) => s.id === plot)!;
    return [{ label: sp.name, color: SERIES_COLOR[sp.id], kind: 'line' as const, points: pts(sp.id, (v) => v) }];
  }, [started, idx, res, plot]);
  const plotSpecies = plot === 'relativa' ? null : SPECIES.find((s) => s.id === plot)!;

  const record = () => api.addTrial('escenarios', {
    lluvia: rain, caza: hunting, pesticida: pesticide, anios: years,
    pastos: res.final.pastos, saltamontes: res.final.saltamontes, ratones: res.final.ratones,
    ranas: res.final.ranas, serpientes: res.final.serpientes, gavilanes: res.final.gavilanes,
  });

  const extinctNames = SPECIES.filter((s) => res.extinct.includes(s.id)).map((s) => s.name.toLowerCase());
  const pyrWidth = (v: number) => 40 + 120 * Math.log10(1 + Math.max(0, v) / 0.1);

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented label="Vista" value={view} onChange={setView} options={[{ value: 'red', label: 'Red alimentaria' }, { value: 'piramide', label: 'Pirámide de biomasa' }]} />
        <div className="bench">
          {view === 'red' ? (
            <svg viewBox="0 0 640 380" role="img" aria-labelledby="fw-t fw-d">
              <title id="fw-t">Red alimentaria de un potrero con borde de bosque en Urabá</title>
              <desc id="fw-d">
                {`Las flechas indican «es comido por» y van en la dirección del flujo de energía: pastos y semillas hacia saltamontes y ratones; saltamontes hacia ranas; ranas y ratones hacia serpientes; ratones y serpientes hacia gavilanes. `}
                {started ? `Año ${fmt(tNow, 1)} de la simulación.` : 'Biomasa inicial, antes de simular.'}
              </desc>
              <defs>
                <marker id="fw-arrow" viewBox="0 0 10 10" refX="8.5" refY="5" markerWidth="6.5" markerHeight="6.5" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 Q 3 5 0 0 Z" fill="var(--ink-2)" />
                </marker>
                <linearGradient id="fw-sky" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0" style={{ stopColor: 'var(--fis)', stopOpacity: 0.12 }} />
                  <stop offset="1" style={{ stopColor: 'var(--fis)', stopOpacity: 0 }} />
                </linearGradient>
              </defs>
              <Landscape />
              {LINKS.map((l) => {
                const p = edgePoints(NODE_POS[l.prey], NODE_POS[l.predator]);
                return <line key={`${l.prey}-${l.predator}`} {...p} stroke="var(--ink-2)" strokeWidth="2.2" strokeLinecap="round" opacity="0.85" markerEnd="url(#fw-arrow)" />;
              })}
              {SPECIES.map((s) => {
                const { x, y } = NODE_POS[s.id];
                const rel = current[s.id] / BASE_EQUILIBRIUM[s.id];
                const bx = 58, barMax = NODE_W - bx - 10;
                const barW = Math.max(0, Math.min(1.5, rel) / 1.5) * barMax;
                const c = LEVEL_COLOR[s.level];
                return (
                  <g key={s.id} transform={`translate(${x - NODE_W / 2} ${y - NODE_H / 2})`}>
                    <rect width={NODE_W} height={NODE_H} rx="12" fill="var(--surface)" stroke={c} strokeWidth="2" filter="url(#kit-shadow-soft)" />
                    <circle cx="29" cy={NODE_H / 2} r="23" fill={c} opacity="0.14" />
                    <circle cx="29" cy={NODE_H / 2} r="23" fill="none" stroke={c} strokeWidth="1.2" opacity="0.6" />
                    <SpeciesArt id={s.id} x={29} y={NODE_H / 2} scale={0.95} />
                    <text x={bx} y="19" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>{s.name}</text>
                    <rect x={bx} y="26" width={barMax} height="8" rx="4" fill="var(--surface-2)" stroke="var(--line)" />
                    <rect x={bx} y="26" width={barW} height="8" rx="4" fill={c} />
                    <line x1={bx + barMax / 1.5} x2={bx + barMax / 1.5} y1="23" y2="37" stroke="var(--ink)" strokeWidth="1.2" />
                    <text x={bx} y="50" style={{ fontSize: 10.5, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(current[s.id], s.decimals)} kg/ha</text>
                  </g>
                );
              })}
              <text x="8" y="373" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Flecha: «es comido por» (flujo de energía). Barra: biomasa frente al equilibrio base (marca = 100 %).</text>
              {started && (
                <g>
                  <rect x="6" y="4" width="84" height="20" rx="10" fill="var(--surface)" stroke="var(--line)" />
                  <text x="48" y="18" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>Año {fmt(tNow, 1)}</text>
                </g>
              )}
            </svg>
          ) : (
            <svg viewBox="0 0 640 300" role="img" aria-labelledby="fwp-t fwp-d" style={{ minWidth: 600 }}>
              <title id="fwp-t">Pirámide de biomasa por niveles tróficos</title>
              <desc id="fwp-d">{`${started ? `Año ${fmt(tNow, 1)}` : 'Biomasa inicial'}: ${LEVELS.slice().reverse().map((l) => `${LEVEL_NAMES[l]} ${fmt(levelNow[l], l === 'tope' ? 3 : 1)} kg/ha`).join('; ')}. El ancho de cada barra está en escala logarítmica.`}</desc>
              <line x1="300" x2="300" y1="16" y2="262" stroke="var(--line)" strokeDasharray="3 4" />
              {LEVELS.map((l, i) => {
                const w = pyrWidth(levelNow[l]) * 0.55;
                const y = 18 + i * 62;
                const members = SPECIES.filter((s) => s.level === l);
                const [title, extra] = LEVEL_NAMES[l].split(' (');
                return (
                  <g key={l}>
                    <rect x={466 - w / 2} y={y} width={w} height="50" rx="8" fill={LEVEL_COLOR[l]} opacity="0.22" />
                    <rect x={466 - w / 2} y={y} width={w} height="50" rx="8" fill="none" stroke={LEVEL_COLOR[l]} strokeWidth="2" />
                    {members.map((m, k) => (
                      <g key={m.id}>
                        <circle cx={26 + k * 38} cy={y + 25} r="17" fill="var(--surface)" stroke={LEVEL_COLOR[l]} strokeWidth="1.4" />
                        <SpeciesArt id={m.id} x={26 + k * 38} y={y + 25} scale={0.7} />
                      </g>
                    ))}
                    <text x="94" y={y + 21} style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>{title}</text>
                    <text x="94" y={y + 38} style={{ fontSize: 12, fill: 'var(--ink)' }}>
                      {extra ? <tspan>{`${extra.replace(')', '')} · `}</tspan> : null}
                      <tspan style={{ fontFamily: 'var(--font-data)' }}>{`${fmt(levelNow[l], l === 'tope' ? 3 : 1)} kg/ha`}</tspan>
                    </text>
                  </g>
                );
              })}
              <text x="8" y="292" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Ancho en escala logarítmica: cada nivel tiene muchísima menos biomasa que el de abajo (regla del 10 %).</text>
            </svg>
          )}
        </div>
        <div className="card stack">
          <Select label="Qué graficar" value={plot} onChange={(v) => setPlot(v as 'relativa' | SpeciesId)}
            options={[{ value: 'relativa', label: 'Todas las especies (% del equilibrio base)' }, ...SPECIES.map((s) => ({ value: s.id, label: `${s.name} (kg/ha)` }))]} />
          <Chart title={plotSpecies ? `Biomasa de ${plotSpecies.name.toLowerCase()} en el tiempo` : 'Biomasa de cada especie en el tiempo (porcentaje del equilibrio base)'}
            xLabel="Tiempo (años)" yLabel={plotSpecies ? 'Biomasa (kg/ha)' : 'Biomasa (% del equilibrio base)'}
            xDomain={[0, years]} series={chartSeries} height={300}
            hLines={plotSpecies ? [] : [{ y: 100, label: 'equilibrio base' }]}
            emptyText="Pulsa «Simular» para ver cómo cambia la biomasa." />
        </div>
        <Readout items={SPECIES.map((s) => ({ k: `${s.name} al final`, v: done ? `${fmt(res.final[s.id], s.decimals)} kg/ha` : '—', data: true }))} />
        <Readout items={SPECIES.map((s) => ({ k: `Cambio de ${s.name.toLowerCase()} frente al base`, v: done ? `${signed(change[s.id])} %` : '—' }))} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones del potrero</h3>
          <Slider label="Lluvia (% de lo normal)" value={rain} min={FOODWEB_LIMITS.rain[0]} max={FOODWEB_LIMITS.rain[1]} step={5} unit="%" decimals={0} onChange={setRain}
            hint={`Capacidad de carga del pasto: ${fmt(res.carryingCapacity, 0)} kg/ha`} />
          <Slider label="Caza de gavilanes (% por año)" value={hunting} min={FOODWEB_LIMITS.hunting[0]} max={FOODWEB_LIMITS.hunting[1]} step={5} unit="%/año" decimals={0} onChange={setHunting} />
          <Slider label="Pesticida sobre insectos (% por año)" value={pesticide} min={FOODWEB_LIMITS.pesticide[0]} max={FOODWEB_LIMITS.pesticide[1]} step={5} unit="%/año" decimals={0} onChange={setPesticide} />
          <Slider label="Años simulados" value={years} min={FOODWEB_LIMITS.years[0]} max={FOODWEB_LIMITS.years[1]} step={1} unit="años" decimals={0} onChange={setYears} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setFrame(0); setDone(false); setRunning(true); }} disabled={running}>Simular</button>
            <button type="button" className="btn" onClick={reset}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        {done && extinctNames.length > 0 && (
          <Notice kind="warn">Prácticamente desaparecieron (menos del 2 % de su biomasa base): {extinctNames.join(', ')}.</Notice>
        )}
        <Notice>
          El escenario base es lluvia 100 %, sin caza ni pesticida, con los mismos años. Parámetros ilustrativos: el 10 % de lo que come cada animal se convierte en biomasa nueva.
        </Notice>
      </div>
    </div>
  );
}
