import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  checkClassification, FOCUS_RANGE, KINGDOM_NAME, OBJECTIVES, observe, OCULAR, SAMPLES, STAINS,
  type ClassificationCheck, type Kingdom, type Objective, type Observation, type SampleId, type StainId,
} from '../models/microscope';
import { seededRandom } from '../models/math';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

/* Geometría de la ilustración (px) */
const W = 660, H = 420, CX = 210, CY = 210, R = 180;
const COUNT_MS = 1400;

/** Colores reales de la preparación: luz del microscopio y colorantes (hex con buen contraste entre sí). */
const LOOK: Record<StainId, { bg: string; edge: string; nucleus: string; cell: string }> = {
  ninguna: { bg: '#f7f4ea', edge: '#6f7262', nucleus: '#55584a', cell: '#fbf9f1' },
  lugol: { bg: '#f2dc9f', edge: '#7a4a12', nucleus: '#5a3008', cell: '#f6e6b8' },
  azul: { bg: '#d9e7f5', edge: '#1d4a86', nucleus: '#102c66', cell: '#c6daf0' },
};
const CHLOROPLAST = '#2e7d32';
const ELODEA_CELL = '#cfe8b0';
const YEAST_CELL = '#efe4c4';

/** Polígonos irregulares (µm) para las células de la mucosa: semilla fija, se calculan una vez. */
const MUCOSA_TILE = 110;
const MUCOSA_CELLS = (() => {
  const rnd = seededRandom(17);
  return [0, 1].flatMap((i) => [0, 1].map((j) => {
    const cx = 27.5 + 55 * i, cy = 27.5 + 55 * j;
    const pts = Array.from({ length: 7 }, (_, k) => {
      const a = (k / 7) * 2 * Math.PI + rnd() * 0.4;
      const r = 23 + rnd() * 4;
      return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
    }).join(' ');
    return { pts, nx: cx + (rnd() - 0.5) * 8, ny: cy + (rnd() - 0.5) * 8 };
  }));
})();

interface TileProps { obs: Observation; s: number; }

/** Contenido de una baldosa del patrón, en micrómetros. Devuelve también su tamaño y el centro de la primera fila. */
function tileFor({ obs, s }: TileProps): { w: number; h: number; rowY: number; body: ReactNode } {
  const look = LOOK[obs.stain.id];
  const sample = obs.sample;
  const show = (id: string) => { const v = obs.structures.find((x) => x.structure.id === id); return !!v && v.bigEnough && v.contrast; };
  const outline = obs.structures.find((x) => x.structure.outline)!;
  const edgeOpacity = !outline.contrast ? 0.12 : outline.bigEnough ? 1 : 0.5;
  const sw = Math.min(1.4 / s, 0.15 * sample.widthUm);
  const L = sample.lengthUm, Wd = sample.widthUm;
  const brick = [{ x: 0, y: 0 }, { x: -L / 2, y: Wd }, { x: L / 2, y: Wd }];

  if (sample.id === 'cebolla' || sample.id === 'elodea') {
    const isElodea = sample.id === 'elodea';
    return {
      w: L, h: 2 * Wd, rowY: Wd / 2,
      body: brick.map((c, i) => (
        <g key={i}>
          <rect x={c.x + sw / 2} y={c.y + sw / 2} width={L - sw} height={Wd - sw} fill={isElodea ? ELODEA_CELL : look.cell} stroke={look.edge} strokeOpacity={edgeOpacity} strokeWidth={sw} />
          <rect x={c.x + sw + Wd * 0.08} y={c.y + sw + Wd * 0.08} width={Math.max(0, L - 2 * sw - Wd * 0.16)} height={Math.max(0, Wd - 2 * sw - Wd * 0.16)} rx={Wd * 0.12} fill="#fff" opacity={isElodea ? 0.22 : 0.3} />
          {!isElodea && show('nucleo') && (
            <g>
              <ellipse cx={c.x + 0.38 * L} cy={c.y + Wd / 2} rx={10} ry={8} fill={look.nucleus} opacity={0.85} />
              <circle cx={c.x + 0.38 * L + 2} cy={c.y + Wd / 2 - 1} r={2.4} fill={look.edge} opacity={0.9} />
            </g>
          )}
          {isElodea && show('cloroplastos') && [5, 13.5, 22, 30.5, 39, 47.5, 55].flatMap((dx, k) => [
            <circle key={`t${k}`} cx={c.x + dx} cy={c.y + 4.5} r={2.4} fill={CHLOROPLAST} stroke="#1b5e20" strokeWidth={0.4} />,
            <circle key={`b${k}`} cx={c.x + dx + 3} cy={c.y + Wd - 4.5} r={2.4} fill={CHLOROPLAST} stroke="#1b5e20" strokeWidth={0.4} />,
          ])}
        </g>
      )),
    };
  }
  if (sample.id === 'mucosa') {
    return {
      w: MUCOSA_TILE, h: MUCOSA_TILE, rowY: 27.5,
      body: MUCOSA_CELLS.map((c, i) => (
        <g key={i}>
          <polygon points={c.pts} fill={look.cell} fillOpacity={outline.contrast ? 0.9 : 0.25} stroke={look.edge} strokeOpacity={edgeOpacity} strokeWidth={sw} />
          {show('nucleo') && <circle cx={c.nx} cy={c.ny} r={4} fill={look.nucleus} />}
          {outline.contrast && [[-9, 6], [7, 9], [10, -8], [-6, -10], [2, 14]].map(([dx, dy], k) => <circle key={k} cx={c.nx + dx} cy={c.ny + dy} r={0.9} fill={look.edge} opacity={0.35} />)}
        </g>
      )),
    };
  }
  // levadura: dos células ovaladas por baldosa de 12 × 10 µm
  return {
    w: 2 * L, h: 2 * Wd, rowY: Wd / 2,
    body: (
      <g>
        <ellipse cx={L / 2} cy={Wd / 2} rx={L / 2 - sw} ry={Wd / 2 - sw} fill={YEAST_CELL} stroke={look.edge} strokeOpacity={edgeOpacity} strokeWidth={sw} />
        <ellipse cx={1.5 * L} cy={1.5 * Wd} rx={L / 2 - sw} ry={Wd / 2 - sw} fill={YEAST_CELL} stroke={look.edge} strokeOpacity={edgeOpacity} strokeWidth={sw} />
        <circle cx={L / 2 + 0.6} cy={Wd / 2 - 0.4} r={Wd * 0.17} fill="#fff" opacity={0.5} />
        <circle cx={1.5 * L - 0.6} cy={1.5 * Wd + 0.3} r={Wd * 0.15} fill="#fff" opacity={0.5} />
        {show('yemas') && <circle cx={L + 0.3} cy={1.6} r={0.9} fill={YEAST_CELL} stroke={look.edge} strokeWidth={sw} />}
      </g>
    ),
  };
}

const OBJ_COLOR: Record<number, string> = { 4: '#d32f2f', 10: '#f2c230', 40: '#1e88e5' };

/** Microscopio óptico compuesto dibujado de perfil; el objetivo activo apunta a la platina. */
function MicroscopeDrawing({ x, y, objective, stainTint }: { x: number; y: number; objective: Objective; stainTint: string }) {
  const others = OBJECTIVES.filter((o) => o !== objective);
  const objLen: Record<number, number> = { 4: 20, 10: 25, 40: 31 };
  const Obj = ({ o, rot }: { o: number; rot: number }) => (
    <g transform={`rotate(${rot} 66 82)`}>
      <rect x="61" y="84" width="10" height={objLen[o]} rx="2" fill="url(#kit-metal-h)" stroke="#7d878b" strokeWidth="0.6" />
      <rect x="61" y={84 + objLen[o] * 0.45} width="10" height="3" fill={OBJ_COLOR[o]} />
      <rect x="63" y={84 + objLen[o]} width="6" height="3" rx="1" fill="#2a3234" />
    </g>
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      <g filter="url(#kit-shadow)">
        {/* brazo */}
        <path d="M118 190 C140 150 142 92 104 40" fill="none" stroke="#2c3537" strokeWidth="20" strokeLinecap="round" />
        <path d="M118 190 C140 150 142 92 104 40" fill="none" stroke="#4a5659" strokeWidth="6" strokeLinecap="round" opacity="0.6" />
        {/* base con lámpara */}
        <path d="M14 206 L22 186 L146 186 L154 206 Z" fill="url(#kit-body-dark)" />
        <ellipse cx="66" cy="184" rx="11" ry="3.5" fill="#ffe9a8" />
        <ellipse cx="66" cy="184" rx="17" ry="6" fill="#ffe9a8" opacity="0.35" />
        {/* platina, preparación y condensador */}
        <rect x="58" y="136" width="16" height="16" rx="2" fill="url(#kit-metal-h)" />
        <rect x="18" y="128" width="104" height="8" rx="2" fill="url(#kit-body-dark)" />
        <rect x="34" y="124" width="64" height="4" fill="#dfeef2" stroke="#8fa9b3" strokeWidth="0.6" />
        <rect x="58" y="124.6" width="16" height="2.8" fill={stainTint} />
        <path d="M30 124 l10 -3 h12" fill="none" stroke="#9aa5a9" strokeWidth="1.4" />
        {/* tornillos macro y micrométrico */}
        <circle cx="124" cy="120" r="11" fill="url(#kit-metal)" stroke="#6f7a7c" />
        <circle cx="124" cy="120" r="6" fill="url(#kit-body-dark)" />
        {/* tubo, cabezal y ocular */}
        <rect x="56" y="44" width="20" height="34" rx="3" fill="url(#kit-body-dark)" />
        <g transform="rotate(-28 66 46)">
          <rect x="59" y="10" width="14" height="38" rx="2" fill="url(#kit-metal-h)" stroke="#6f7a7c" strokeWidth="0.6" />
          <rect x="57" y="4" width="18" height="9" rx="2" fill="#1d2325" />
        </g>
        <path d="M50 78 L82 78 L78 88 L54 88 Z" fill="url(#kit-metal)" stroke="#7d878b" strokeWidth="0.6" />
      </g>
      {others.map((o, i) => <Obj key={o} o={o} rot={i === 0 ? 34 : -34} />)}
      <Obj o={objective} rot={0} />
    </g>
  );
}

const CLASS_OPTIONS = [
  { value: '', label: 'Sin clasificar' },
  ...(['vegetal', 'animal', 'hongo'] as Kingdom[]).map((k) => ({ value: k, label: KINGDOM_NAME[k] })),
];

export default function MicroscopeLab({ api }: LabProps) {
  const [sampleId, setSampleId] = useState<SampleId>('cebolla');
  const [stain, setStain] = useState<StainId>('ninguna');
  const [objective, setObjective] = useState<Objective>(4);
  const [focus, setFocus] = useState(50);
  const [classification, setClassification] = useState('');
  const [phase, setPhase] = useState<'idle' | 'counting' | 'done'>('idle');
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [check, setCheck] = useState<ClassificationCheck | null>(null);
  const raf = useRef(0);

  const obs = useMemo(() => observe({ sampleId, stain, objective, focus }), [sampleId, stain, objective, focus]);
  const s = (2 * R) / obs.fieldUm; // px por µm
  const tile = useMemo(() => tileFor({ obs, s }), [obs, s]);
  const look = LOOK[stain];
  const measured = phase === 'done' && obs.count.ok;

  const change = (fn: () => void) => { fn(); setPhase('idle'); setProgress(0); setError(null); setCheck(null); };

  useEffect(() => {
    if (phase !== 'counting') return;
    if (prefersReducedMotion()) { setProgress(1); setPhase('done'); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, now - start) / COUNT_MS);
      setProgress(p);
      if (p >= 1) { setPhase('done'); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [phase]);

  const startCount = () => {
    setCheck(null);
    if (!obs.count.ok) { setError(obs.count.reason); setPhase('idle'); return; }
    setError(null); setProgress(0); setPhase('counting');
  };

  const countValue = obs.count.ok ? obs.count.count : 0;
  const ticks = phase === 'idle' ? 0 : Math.min(Math.floor(countValue), Math.max(0, Math.floor(progress * countValue + 1e-9)));
  const step = obs.sample.lengthUm * s;

  const record = () => {
    if (!obs.count.ok) return;
    api.addTrial('observaciones', {
      muestra: obs.sample.name, tincion: obs.stain.name, objetivo: `${objective}×`, aumento: obs.magnification,
      campo: obs.fieldUm, celulas: obs.count.count, tamano: Number(obs.count.estimatedSizeUm.toFixed(1)),
      estructuras: obs.visibleCount,
      clasificacion: classification ? KINGDOM_NAME[classification as Kingdom] : 'Sin clasificar',
    });
    setCheck(checkClassification(sampleId, classification));
  };

  const visibleNames = obs.structures.filter((v) => v.visible).map((v) => v.structure.name.toLowerCase());
  const desc = `${obs.sample.name}, ${obs.stain.name.toLowerCase()}, aumento total ${obs.magnification}×, campo de ${fmt(obs.fieldUm, 0)} µm de diámetro. `
    + `${obs.focus.inFocus ? 'Imagen nítida.' : 'Imagen borrosa.'} Estructuras visibles: ${visibleNames.length ? visibleNames.join(', ') : 'ninguna'}.`
    + (measured && obs.count.ok ? ` Caben ${fmt(obs.count.count, 1)} células a lo largo del diámetro.` : '');

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="cel-t cel-d">
            <title id="cel-t">Campo visual del microscopio óptico</title>
            <desc id="cel-d">{desc}</desc>
            <defs>
              <clipPath id="cel-field"><circle cx={CX} cy={CY} r={R} /></clipPath>
              <pattern id="cel-pat" patternUnits="userSpaceOnUse" x={CX - R} y={CY - tile.rowY * s} width={tile.w * s} height={tile.h * s}>
                <g transform={`scale(${s})`}>{tile.body}</g>
              </pattern>
              <radialGradient id="cel-vignette" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0.7" stopColor="#000" stopOpacity="0" /><stop offset="0.9" stopColor="#000" stopOpacity="0.25" /><stop offset="1" stopColor="#000" stopOpacity="0.65" />
              </radialGradient>
              <radialGradient id="cel-light" cx="0.42" cy="0.4" r="0.6">
                <stop offset="0" stopColor="#fff" stopOpacity="0.22" /><stop offset="1" stopColor="#fff" stopOpacity="0" />
              </radialGradient>
              <filter id="cel-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={obs.focus.blurPx} /></filter>
            </defs>
            {/* ocular: lo que rodea el campo se ve oscuro */}
            <rect x="0" y="0" width={2 * CX} height={H} rx="18" fill="#0d0f0e" />
            <circle cx={CX} cy={CY} r={R + 8} fill="#1b201e" stroke="#343b38" strokeWidth="1.5" />
            <g clipPath="url(#cel-field)">
              <g filter={obs.focus.blurPx > 0.05 ? 'url(#cel-blur)' : undefined}>
                <rect x={CX - R - 10} y={CY - R - 10} width={2 * R + 20} height={2 * R + 20} fill={look.bg} />
                <rect x={CX - R - 10} y={CY - R - 10} width={2 * R + 20} height={2 * R + 20} fill="url(#cel-pat)" />
              </g>
              <circle cx={CX} cy={CY} r={R} fill="url(#cel-light)" />
              <line x1={CX - R} x2={CX + R} y1={CY} y2={CY} stroke="var(--data)" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.8" />
              {Array.from({ length: ticks }, (_, i) => {
                const x = CX - R + (i + 1) * step;
                return <path key={i} d={`M${x} ${CY - 3} l-4 -8 h8 z`} fill="var(--data)" />;
              })}
              <circle cx={CX} cy={CY} r={R} fill="url(#cel-vignette)" />
            </g>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#000" strokeOpacity="0.7" strokeWidth="2" />
            {/* microscopio y ficha de observación */}
            <MicroscopeDrawing x={452} y={6} objective={objective} stainTint={look.edge} />
            <text x="540" y="226" textAnchor="middle" style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>Microscopio</text>
            <rect x="438" y="236" width="214" height="176" rx="12" fill="var(--surface-2)" stroke="var(--line)" />
            <g style={{ fontSize: 13, fill: 'var(--ink)' }}>
              <text x="452" y="258">Ocular: {OCULAR}×</text>
              <text x="556" y="258">Objetivo: {objective}×</text>
              <circle cx="548" cy="254" r="3" fill={OBJ_COLOR[objective]} stroke="var(--ink-2)" strokeWidth="0.6" />
              <text x="452" y="280" style={{ fontWeight: 700 }}>Aumento: {obs.magnification}×</text>
              <text x="452" y="304" style={{ fill: 'var(--ink-2)', fontSize: 11 }}>Diámetro del campo</text>
              <text x="452" y="321" style={{ fontFamily: 'var(--font-data)' }}>{fmt(obs.fieldUm, 0)} µm</text>
              <text x="452" y="345" style={{ fill: 'var(--ink-2)', fontSize: 11 }}>Tinción</text>
              <text x="452" y="362">{obs.stain.name}</text>
              <text x="580" y="304" style={{ fill: 'var(--ink-2)', fontSize: 11 }}>Imagen</text>
              <text x="580" y="321" style={{ fill: obs.focus.inFocus ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{obs.focus.inFocus ? 'nítida' : 'borrosa'}</text>
              <line x1="452" x2="482" y1="390" y2="390" stroke="var(--data)" strokeWidth="1.5" strokeDasharray="6 5" />
              <text x="488" y="394" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>diámetro</text>
              {measured && obs.count.ok && <text x="638" y="394" textAnchor="end" style={{ fill: 'var(--data)', fontWeight: 700 }}>{fmt(obs.count.count, 1)} células</text>}
            </g>
          </svg>
        </div>
        <Readout items={[
          { k: 'Aumento total', v: `${obs.magnification}×` },
          { k: 'Diámetro del campo', v: `${fmt(obs.fieldUm, 0)} µm` },
          { k: 'Células en el diámetro', v: measured && obs.count.ok ? fmt(obs.count.count, 1) : '—', data: true },
          { k: 'Tamaño estimado (campo ÷ células)', v: measured && obs.count.ok ? `${fmt(obs.count.estimatedSizeUm, 1)} µm` : '—', data: true },
          { k: 'Estructuras visibles', v: String(obs.visibleCount) },
        ]} />
        <div className="card">
          <h3>Estructuras de la muestra</h3>
          <ul className="list">
            {obs.structures.map((v) => (
              <li key={v.structure.id}>
                <strong>{v.structure.name}:</strong>{' '}
                {v.visible ? <span style={{ color: 'var(--ok)' }}>se ve</span> : <span style={{ color: 'var(--ink-2)' }}>no se ve ({v.reasonText})</span>}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Preparación y microscopio</h3>
          <Select label="Muestra" value={sampleId} onChange={(v) => change(() => setSampleId(v as SampleId))} options={SAMPLES.map((m) => ({ value: m.id, label: m.name }))} />
          <Select label="Tinción" value={stain} onChange={(v) => change(() => setStain(v as StainId))} options={STAINS.map((m) => ({ value: m.id, label: m.name }))} />
          <Segmented label="Objetivo" value={String(objective)} onChange={(v) => change(() => setObjective(Number(v) as Objective))} options={OBJECTIVES.map((o) => ({ value: String(o), label: `${o}×` }))} />
          <Slider label="Tornillo micrométrico (enfoque)" value={focus} min={FOCUS_RANGE[0]} max={FOCUS_RANGE[1]} step={1} decimals={0} onChange={(v) => change(() => setFocus(v))} hint="Con objetivos de mayor aumento, el margen de enfoque es mucho más estrecho." />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={startCount} disabled={phase === 'counting'}>Contar células a lo largo del diámetro</button>
          </div>
          {error && <Notice kind="warn">{error}</Notice>}
          <Select label="Clasificación de la célula" value={classification} onChange={(v) => { setClassification(v); setCheck(null); }} options={CLASS_OPTIONS} hint="Decide con base en las estructuras que observas." />
          <RecordButton onRecord={record} disabled={!measured} />
          {check && <Notice kind={check.correct ? 'ok' : 'warn'}>{check.feedback}</Notice>}
        </div>
        <Notice>Ocular de 10× con número de campo de 18 mm. Una estructura se ve si su tamaño aparente (tamaño real × aumento) es de al menos 0,25 mm, si tiene contraste y si la imagen está enfocada. Tamaños típicos y aproximados.</Notice>
      </div>
    </div>
  );
}
