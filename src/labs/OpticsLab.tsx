import { memo, useMemo, useState } from 'react';
import { MEDIA, refract } from '../models/optics';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { useMeasure } from '../components/Measurement';
import { instrument } from './instruments';
import { DragHandle, ManipHint, ManipScene } from './manipulate';
import { playSound } from '../lib/sound';
import { usePublishModel } from '../components/Advanced';

const MEDIUM_FILL: Record<string, string> = { aire: 'rgba(200,225,240,0.10)', agua: 'rgba(70,150,220,0.28)', aceite: 'rgba(232,195,58,0.30)', vidrio: 'rgba(150,210,200,0.35)', diamante: 'rgba(210,220,240,0.55)', misterio: 'rgba(170,140,210,0.32)' };

/** Disco transportador de acrílico: graduado cada 2°, números cada 30° medidos desde la normal. Estático. */
const Protractor = memo(function Protractor({ cx, cy }: { cx: number; cy: number }) {
  const R = 138;
  const ticks = Array.from({ length: 180 }, (_, i) => i * 2);
  const fromNormal = (d: number) => (d <= 90 ? d : d <= 180 ? 180 - d : d <= 270 ? d - 180 : 360 - d);
  return (
    <g aria-hidden="true">
      <circle cx={cx} cy={cy} r={R} fill="var(--surface)" fillOpacity="0.35" stroke="var(--ink-2)" strokeOpacity="0.55" strokeWidth="1.2" />
      <circle cx={cx} cy={cy} r={R - 24} fill="none" stroke="var(--ink-2)" strokeOpacity="0.25" />
      {ticks.map((d) => {
        const a = ((d - 90) * Math.PI) / 180;
        const len = d % 10 === 0 ? 11 : d % 5 === 0 ? 7 : 4;
        return <line key={d} x1={cx + R * Math.cos(a)} y1={cy + R * Math.sin(a)} x2={cx + (R - len) * Math.cos(a)} y2={cy + (R - len) * Math.sin(a)} stroke="var(--ink-2)" strokeOpacity={d % 10 === 0 ? 0.8 : 0.5} strokeWidth={d % 10 === 0 ? 1.1 : 0.7} />;
      })}
      {ticks.filter((d) => d % 30 === 0).map((d) => {
        const a = ((d - 90) * Math.PI) / 180;
        return <text key={d} x={cx + (R + 11) * Math.cos(a)} y={cy + (R + 11) * Math.sin(a) + (d % 180 === 90 ? -5 : 3)} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fromNormal(d)}</text>;
      })}
    </g>
  );
});

/** Haz láser: halo ancho y tenue, núcleo rojo y línea central clara. k = fracción de la luz (0–1). */
function Beam({ x1, y1, x2, y2, k }: { x1: number; y1: number; x2: number; y2: number; k: number }) {
  if (k < 0.002) return null;
  const core = Math.max(1, 3 * k + 0.4);
  return (
    <g strokeLinecap="round">
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ff5252" strokeWidth={core + 6} strokeOpacity={0.08 + 0.17 * k} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#e53935" strokeWidth={core} strokeOpacity={0.35 + 0.65 * k} />
      {k > 0.15 && <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffe0dc" strokeWidth={Math.max(0.6, core * 0.3)} strokeOpacity={0.9 * k} />}
    </g>
  );
}

/** Puntero láser cilíndrico; (x, y) es la abertura y `angle` (grados) la dirección del haz. */
function Laser({ x, y, angle }: { x: number; y: number; angle: number }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${angle})`} filter="url(#kit-shadow-soft)">
      <rect x={-50} y={-7} width={46} height={14} rx={3} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.8" />
      <rect x={-52} y={-6} width={6} height={12} rx={2} fill="url(#kit-body-dark)" />
      <rect x={-30} y={-9} width={10} height={3} rx={1} fill="#c62828" />
      <rect x={-5} y={-5} width={5} height={10} rx={1} fill="#20292c" />
      <circle cx={-1} cy={0} r={1.8} fill="#ff8a80" />
    </g>
  );
}

export default function OpticsLab({ api }: LabProps) {
  const [m1, setM1] = useState('aire');
  const [m2, setM2] = useState('agua');
  const [angle, setAngle] = useState(40);
  const [measured, setMeasured] = useState(false);
  const r = useMemo(() => refract(m1, m2, angle), [m1, m2, angle]);
  // Lecturas del transportador (el dibujo del rayo usa siempre los ángulos verdaderos del modelo).
  const { measure, remeasure } = useMeasure();
  const read = useMemo(() => {
    const tp = instrument('optica', 'transportador');
    return {
      reflection: measure(r.reflection, { ...tp, key: 'reflexion' }),
      refraction: r.refraction === null ? null : measure(r.refraction, { ...tp, key: 'refraccion' }),
    };
  }, [r, measure]);
  usePublishModel(() => {
    const name = (id: string) => MEDIA.find((m) => m.id === id)!.name;
    return {
      vars: {
        n1: { sym: 'n_{1}', name: `Índice de refracción (${name(m1).toLowerCase()})`, value: r.n1, decimals: 4 },
        n2: { sym: 'n_{2}', name: `Índice de refracción (${name(m2).toLowerCase()})`, value: r.n2, decimals: 4 },
        t1: { sym: '\\theta_{1}', name: 'Ángulo de incidencia', value: angle, unit: '°', decimals: 1 },
        t2: { sym: '\\theta_{2}', name: 'Ángulo de refracción', value: r.refraction, unit: '°', decimals: 1 },
        s2: { sym: '\\sin \\theta_{2}', name: 'Seno del ángulo de refracción', value: r.refraction === null ? null : Math.sin((r.refraction * Math.PI) / 180), decimals: 4 },
        tr: { sym: '\\theta_{r}', name: 'Ángulo de reflexión', value: r.reflection, unit: '°', decimals: 1 },
        tc: { sym: '\\theta_{c}', name: 'Ángulo crítico', value: r.criticalAngle, unit: '°', decimals: 1 },
        v2: { sym: 'v_{2}', name: 'Rapidez de la luz en el medio 2', value: r.speedInMedium2, unit: 'm/s', sig: 4 },
        c: { sym: 'c', value: 299792458, unit: 'm/s', sig: 4 },
        one: { sym: '1', value: 1 },
      },
      equations: [
        { title: 'Ley de la reflexión', lhs: 'tr', expr: '[t1]' },
        { title: 'Ley de Snell', lhs: 's2', expr: '\\frac{[n1]}{[n2]}·\\sin [t1]', note: r.totalInternalReflection ? 'sen θ₂ > 1: no hay refracción, ocurre reflexión total interna.' : undefined },
        ...(r.criticalAngle !== null ? [{ title: 'Ángulo crítico (n₁ > n₂)', lhs: 'tc', expr: '\\sin^{−1}(\\frac{[n2]}{[n1]})' }] : []),
        { title: 'Rapidez de la luz en el medio 2', lhs: 'v2', expr: '\\frac{[c]}{[n2]}' },
      ],
    };
  }, [r, m1, m2, angle]);
  const W = 520, H = 400, cx = 260, cy = 200, L = 180;
  const rad = (d: number) => (d * Math.PI) / 180;
  // Rayo incidente desde arriba a la izquierda
  const LS = 150; // distancia de la abertura del láser al punto de incidencia
  const ix = cx - LS * Math.sin(rad(angle)), iy = cy - LS * Math.cos(rad(angle));
  const rx = cx + L * Math.sin(rad(angle)), ry = cy - L * Math.cos(rad(angle));
  const tx = r.refraction === null ? null : cx + L * Math.sin(rad(r.refraction));
  const ty = r.refraction === null ? null : cy + L * Math.cos(rad(r.refraction));
  const name = (id: string) => MEDIA.find((m) => m.id === id)!.name;
  const change = (fn: () => void) => { fn(); setMeasured(false); };

  const record = () => api.addTrial('rayos', {
    medio1: name(m1), medio2: name(m2), incidencia: angle, reflexion: read.reflection,
    refraccion: read.refraction === null ? null : Number(read.refraction.toFixed(2)),
    senoI: Number(Math.sin(rad(angle)).toFixed(4)), senoT: read.refraction === null ? null : Number(Math.sin(rad(read.refraction)).toFixed(4)),
    reflejada: Number((r.reflectance * 100).toFixed(2)),
  });

  const arc = (from: number, to: number, radius: number, below: boolean) => {
    const a1 = rad(from), a2 = rad(to);
    const p = (a: number) => (below ? `${cx + radius * Math.sin(a)} ${cy + radius * Math.cos(a)}` : `${cx - radius * Math.sin(a)} ${cy - radius * Math.cos(a)}`);
    return `M${p(a1)} A${radius} ${radius} 0 0 ${below ? 0 : 1} ${p(a2)}`;
  };

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox={`0 0 ${W} ${H}`} label="Control del puntero láser" scene={
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="opt-t opt-d">
            <title id="opt-t">Rayo de luz que llega a la superficie entre dos medios</title>
            <desc id="opt-d">{`Luz de ${name(m1).toLowerCase()} a ${name(m2).toLowerCase()} con ${fmt(angle, 1)}° de incidencia. ${measured ? (r.totalInternalReflection ? 'Reflexión total interna: no sale luz al segundo medio.' : `Ángulo de refracción ${fmt(read.refraction!, 1)}°.`) : 'Ángulos aún no medidos.'}`}</desc>
            <rect x="0" y="0" width={W} height={cy} fill={MEDIUM_FILL[m1]} />
            <rect x="0" y={cy} width={W} height={H - cy} fill={MEDIUM_FILL[m2]} />
            <defs>
              <linearGradient id="opt-sheen" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.16" />
                <stop offset="1" stopColor="#fff" stopOpacity="0" />
              </linearGradient>
            </defs>
            {m2 !== 'aire' && <rect x="0" y={cy} width={W} height={22} fill="url(#opt-sheen)" />}
            <Protractor cx={cx} cy={cy} />
            <line x1="0" x2={W} y1={cy} y2={cy} stroke="var(--ink-2)" strokeWidth="2" />
            <line x1="0" x2={W} y1={cy + 1.5} y2={cy + 1.5} stroke="#fff" strokeOpacity="0.5" strokeWidth="1" />
            <line x1={cx} x2={cx} y1="10" y2={H - 10} stroke="var(--ink-2)" strokeDasharray="6 5" />
            <text x={cx + 6} y={H - 30} style={{ fontSize: 11, fill: 'var(--ink-2)' }}>normal</text>
            <text x="10" y="22" style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>{name(m1)}{m1 === 'misterio' ? '' : ` (n = ${fmt(r.n1, 3)})`}</text>
            <text x="10" y={H - 12} style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>{name(m2)}{m2 === 'misterio' ? '' : ` (n = ${fmt(r.n2, 3)})`}</text>
            {/* haces: halo suave y núcleo brillante; el grosor y la opacidad siguen las fracciones de Fresnel */}
            <Beam x1={ix} y1={iy} x2={cx} y2={cy} k={1} />
            <Beam x1={cx} y1={cy} x2={rx} y2={ry} k={r.reflectance} />
            {tx !== null && ty !== null && <Beam x1={cx} y1={cy} x2={tx} y2={ty} k={r.transmittance} />}
            <circle cx={cx} cy={cy} r={7} fill="#ff8a80" opacity="0.45" />
            <circle cx={cx} cy={cy} r={2.6} fill="#fff3f0" />
            <Laser x={ix} y={iy} angle={(Math.atan2(cy - iy, cx - ix) * 180) / Math.PI} />
            {measured && (
              <g style={{ fontSize: 12, fontFamily: 'var(--font-data)' }}>
                <path d={arc(0, angle, 50, false)} fill="none" stroke="var(--fis)" strokeWidth="1.5" />
                <text x={cx - 60} y={cy - 60} textAnchor="end" style={{ fill: 'var(--fis)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>θ₁ = {fmt(angle, 1)}°</text>
                <text x={cx + 60} y={cy - 60} style={{ fill: 'var(--fis)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>θᵣ = {fmt(read.reflection, 1)}°</text>
                {r.refraction !== null && read.refraction !== null && <><path d={arc(0, r.refraction, 50, true)} fill="none" stroke="var(--data)" strokeWidth="1.5" /><text x={cx + 60} y={cy + 72} style={{ fill: 'var(--data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>θ₂ = {fmt(read.refraction, 1)}°</text></>}
              </g>
            )}
            {r.totalInternalReflection && <text x={cx + 20} y={cy + 40} style={{ fontSize: 13, fill: 'var(--bad)', fontWeight: 700, paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>Reflexión total interna</text>}
          </svg>}>
            {/* el láser se desliza por el borde del disco: el ángulo se mide desde la normal */}
            <DragHandle label="Puntero láser: ángulo de incidencia" value={angle} min={0} max={89} step={1} unit="°" decimals={0}
              hit={{ cx: cx - (LS + 26) * Math.sin(rad(angle)), cy: cy - (LS + 26) * Math.cos(rad(angle)), r: 16 }}
              valueText={(v) => `${fmt(v, 0)}° desde la normal`}
              valueFromPoint={({ point }) => (Math.atan2(cx - point.x, cy - point.y) * 180) / Math.PI}
              onChange={(v) => change(() => { setAngle(v); playSound('knob', { intensity: 0.4 }); })} />
          </ManipScene>
        </div>
        <ManipHint>Arrastra el puntero láser alrededor del disco para cambiar el ángulo de incidencia, o enfócalo con Tab y usa las flechas.</ManipHint>
        <Readout items={[
          { k: 'θ incidencia', v: `${fmt(angle, 1)}°` },
          { k: 'θ reflexión', v: measured ? `${fmt(read.reflection, 1)}°` : 'mide', data: true },
          { k: 'θ refracción', v: measured ? (read.refraction === null ? 'no hay (reflexión total)' : `${fmt(read.refraction, 1)}°`) : 'mide', data: true },
          { k: 'Luz reflejada', v: `${fmt(r.reflectance * 100, 1)} %` },
          { k: 'El rayo se acerca a…', v: measured ? r.bendsToward : '—' },
          { k: 'Ángulo crítico', v: r.criticalAngle === null ? 'no existe (n₁ < n₂)' : measured ? `${fmt(r.criticalAngle, 1)}°` : 'búscalo' },
        ]} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Montaje</h3>
          <Select label="Medio 1 (de donde viene la luz)" value={m1} onChange={(v) => change(() => setM1(v))} options={MEDIA.map((m) => ({ value: m.id, label: m.name }))} />
          <Select label="Medio 2" value={m2} onChange={(v) => change(() => setM2(v))} options={MEDIA.map((m) => ({ value: m.id, label: m.name }))} />
          <Slider label="Ángulo de incidencia" value={angle} min={0} max={89} step={1} unit="°" decimals={0} onChange={(v) => change(() => { setAngle(v); playSound('knob', { intensity: 0.4 }); })} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { remeasure('reflexion', 'refraccion'); setMeasured(true); playSound('click', { intensity: 0.6 }); }}>Medir con el transportador</button>
            <button type="button" className="btn" onClick={() => change(() => { const a = m1; setM1(m2); setM2(a); playSound('glassClink', { intensity: 0.4 }); })}>Invertir medios</button>
          </div>
          <RecordButton onRecord={record} disabled={!measured} />
        </div>
        <Notice>Luz amarilla (≈ 589 nm) e índices aproximados. El grosor del rayo reflejado y refractado representa la fracción de luz (ecuaciones de Fresnel).</Notice>
      </div>
    </div>
  );
}
