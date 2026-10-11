import { useMemo, useState } from 'react';
import { MEDIA, refract } from '../models/optics';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

const MEDIUM_FILL: Record<string, string> = { aire: 'rgba(200,225,240,0.10)', agua: 'rgba(70,150,220,0.28)', aceite: 'rgba(232,195,58,0.30)', vidrio: 'rgba(150,210,200,0.35)', diamante: 'rgba(210,220,240,0.55)', misterio: 'rgba(170,140,210,0.32)' };

export default function OpticsLab({ api }: LabProps) {
  const [m1, setM1] = useState('aire');
  const [m2, setM2] = useState('agua');
  const [angle, setAngle] = useState(40);
  const [measured, setMeasured] = useState(false);
  const r = useMemo(() => refract(m1, m2, angle), [m1, m2, angle]);
  const W = 520, H = 400, cx = 260, cy = 200, L = 180;
  const rad = (d: number) => (d * Math.PI) / 180;
  // Rayo incidente desde arriba a la izquierda
  const ix = cx - L * Math.sin(rad(angle)), iy = cy - L * Math.cos(rad(angle));
  const rx = cx + L * Math.sin(rad(angle)), ry = cy - L * Math.cos(rad(angle));
  const tx = r.refraction === null ? null : cx + L * Math.sin(rad(r.refraction));
  const ty = r.refraction === null ? null : cy + L * Math.cos(rad(r.refraction));
  const name = (id: string) => MEDIA.find((m) => m.id === id)!.name;
  const change = (fn: () => void) => { fn(); setMeasured(false); };

  const record = () => api.addTrial('rayos', {
    medio1: name(m1), medio2: name(m2), incidencia: angle, reflexion: r.reflection,
    refraccion: r.refraction === null ? null : Number(r.refraction.toFixed(2)),
    senoI: Number(Math.sin(rad(angle)).toFixed(4)), senoT: r.refraction === null ? null : Number(Math.sin(rad(r.refraction)).toFixed(4)),
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
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="opt-t opt-d">
            <title id="opt-t">Rayo de luz que llega a la superficie entre dos medios</title>
            <desc id="opt-d">{`Luz de ${name(m1).toLowerCase()} a ${name(m2).toLowerCase()} con ${fmt(angle, 1)}° de incidencia. ${measured ? (r.totalInternalReflection ? 'Reflexión total interna: no sale luz al segundo medio.' : `Ángulo de refracción ${fmt(r.refraction!, 1)}°.`) : 'Ángulos aún no medidos.'}`}</desc>
            <rect x="0" y="0" width={W} height={cy} fill={MEDIUM_FILL[m1]} />
            <rect x="0" y={cy} width={W} height={H - cy} fill={MEDIUM_FILL[m2]} />
            <line x1="0" x2={W} y1={cy} y2={cy} stroke="var(--ink-2)" strokeWidth="2" />
            <line x1={cx} x2={cx} y1="10" y2={H - 10} stroke="var(--ink-2)" strokeDasharray="6 5" />
            <text x={cx + 6} y="22" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>normal</text>
            <text x="10" y="22" style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>{name(m1)}{m1 === 'misterio' ? '' : ` (n = ${fmt(r.n1, 3)})`}</text>
            <text x="10" y={H - 12} style={{ fontSize: 13, fill: 'var(--ink)', fontWeight: 700 }}>{name(m2)}{m2 === 'misterio' ? '' : ` (n = ${fmt(r.n2, 3)})`}</text>
            {/* transportador */}
            {Array.from({ length: 36 }, (_, i) => i * 10).map((d) => {
              const a = rad(d - 90);
              return <line key={d} x1={cx + 150 * Math.cos(a)} y1={cy + 150 * Math.sin(a)} x2={cx + 160 * Math.cos(a)} y2={cy + 160 * Math.sin(a)} stroke="var(--ink-2)" opacity="0.5" />;
            })}
            <line x1={ix} y1={iy} x2={cx} y2={cy} stroke="#e53935" strokeWidth="3" />
            <line x1={cx} y1={cy} x2={rx} y2={ry} stroke="#e53935" strokeWidth={Math.max(1, 3 * r.reflectance + 0.8)} opacity={0.35 + 0.65 * r.reflectance} />
            {tx !== null && ty !== null && <line x1={cx} y1={cy} x2={tx} y2={ty} stroke="#e53935" strokeWidth={Math.max(1, 3 * r.transmittance)} opacity={0.3 + 0.7 * r.transmittance} />}
            <circle cx={ix} cy={iy} r="7" fill="#333" />
            {measured && (
              <g style={{ fontSize: 12, fontFamily: 'var(--font-data)' }}>
                <path d={arc(0, angle, 50, false)} fill="none" stroke="var(--fis)" />
                <text x={cx - 60} y={cy - 60} textAnchor="end" style={{ fill: 'var(--fis)' }}>θ₁ = {fmt(angle, 1)}°</text>
                <text x={cx + 60} y={cy - 60} style={{ fill: 'var(--fis)' }}>θᵣ = {fmt(r.reflection, 1)}°</text>
                {r.refraction !== null && <><path d={arc(0, r.refraction, 50, true)} fill="none" stroke="var(--data)" /><text x={cx + 60} y={cy + 72} style={{ fill: 'var(--data)' }}>θ₂ = {fmt(r.refraction, 1)}°</text></>}
              </g>
            )}
            {r.totalInternalReflection && <text x={cx + 20} y={cy + 40} style={{ fontSize: 13, fill: 'var(--bad)', fontWeight: 700 }}>Reflexión total interna</text>}
          </svg>
        </div>
        <Readout items={[
          { k: 'θ incidencia', v: `${fmt(angle, 1)}°` },
          { k: 'θ reflexión', v: measured ? `${fmt(r.reflection, 1)}°` : 'mide', data: true },
          { k: 'θ refracción', v: measured ? (r.refraction === null ? 'no hay (reflexión total)' : `${fmt(r.refraction, 1)}°`) : 'mide', data: true },
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
          <Slider label="Ángulo de incidencia" value={angle} min={0} max={89} step={1} unit="°" decimals={0} onChange={(v) => change(() => setAngle(v))} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => setMeasured(true)}>Medir con el transportador</button>
            <button type="button" className="btn" onClick={() => change(() => { const a = m1; setM1(m2); setM2(a); })}>Invertir medios</button>
          </div>
          <RecordButton onRecord={record} disabled={!measured} />
        </div>
        <Notice>Luz amarilla (≈ 589 nm) e índices aproximados. El grosor del rayo reflejado y refractado representa la fracción de luz (ecuaciones de Fresnel).</Notice>
      </div>
    </div>
  );
}
