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
const W = 600, H = 420, CX = 210, CY = 210, R = 180;
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
          {!isElodea && show('nucleo') && <ellipse cx={c.x + 0.38 * L} cy={c.y + Wd / 2} rx={10} ry={8} fill={look.nucleus} opacity={0.85} />}
          {isElodea && show('cloroplastos') && [5, 13.5, 22, 30.5, 39, 47.5, 55].flatMap((dx, k) => [
            <circle key={`t${k}`} cx={c.x + dx} cy={c.y + 4.5} r={2.4} fill={CHLOROPLAST} />,
            <circle key={`b${k}`} cx={c.x + dx + 3} cy={c.y + Wd - 4.5} r={2.4} fill={CHLOROPLAST} />,
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
        {show('yemas') && <circle cx={L + 0.3} cy={1.6} r={0.9} fill={YEAST_CELL} stroke={look.edge} strokeWidth={sw} />}
      </g>
    ),
  };
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
              <filter id="cel-blur" x="-5%" y="-5%" width="110%" height="110%"><feGaussianBlur stdDeviation={obs.focus.blurPx} /></filter>
            </defs>
            {/* ocular: lo que rodea el campo se ve oscuro */}
            <rect x="0" y="0" width={2 * CX} height={H} rx="18" fill="#0d0f0e" />
            <g clipPath="url(#cel-field)">
              <g filter={obs.focus.blurPx > 0.05 ? 'url(#cel-blur)' : undefined}>
                <rect x={CX - R - 10} y={CY - R - 10} width={2 * R + 20} height={2 * R + 20} fill={look.bg} />
                <rect x={CX - R - 10} y={CY - R - 10} width={2 * R + 20} height={2 * R + 20} fill="url(#cel-pat)" />
              </g>
              <line x1={CX - R} x2={CX + R} y1={CY} y2={CY} stroke="var(--data)" strokeWidth="1.5" strokeDasharray="6 5" opacity="0.8" />
              {Array.from({ length: ticks }, (_, i) => {
                const x = CX - R + (i + 1) * step;
                return <path key={i} d={`M${x} ${CY - 3} l-4 -8 h8 z`} fill="var(--data)" />;
              })}
            </g>
            <circle cx={CX} cy={CY} r={R} fill="none" stroke="#3a3f3c" strokeWidth="3" />
            <g style={{ fontSize: 13, fill: 'var(--ink)' }}>
              <text x="440" y="40" style={{ fontWeight: 700 }}>Microscopio</text>
              <text x="440" y="66">Ocular: {OCULAR}×</text>
              <text x="440" y="88">Objetivo: {objective}×</text>
              <text x="440" y="110">Aumento: {obs.magnification}×</text>
              <text x="440" y="142" style={{ fill: 'var(--ink-2)', fontSize: 12 }}>Diámetro del campo</text>
              <text x="440" y="162" style={{ fontFamily: 'var(--font-data)' }}>{fmt(obs.fieldUm, 0)} µm</text>
              <text x="440" y="194" style={{ fill: 'var(--ink-2)', fontSize: 12 }}>Tinción</text>
              <text x="440" y="214">{obs.stain.name}</text>
              <text x="440" y="246" style={{ fill: 'var(--ink-2)', fontSize: 12 }}>Imagen</text>
              <text x="440" y="266" style={{ fill: obs.focus.inFocus ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{obs.focus.inFocus ? 'nítida' : 'borrosa'}</text>
              <line x1="440" x2="470" y1="300" y2="300" stroke="var(--data)" strokeWidth="1.5" strokeDasharray="6 5" />
              <text x="476" y="304" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>diámetro</text>
              {measured && obs.count.ok && <text x="440" y="330" style={{ fill: 'var(--data)', fontWeight: 700 }}>{fmt(obs.count.count, 1)} células</text>}
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
