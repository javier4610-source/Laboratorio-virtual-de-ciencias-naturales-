import { useEffect, useMemo, useRef, useState } from 'react';
import { ENERGY_LIMITS, simulateTrack, trackHeight, TRACK_X } from '../models/energy';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Slider } from '../components/ui';
import type { LabProps } from './registry';

const W = 640, H = 260;

export default function EnergyLab({ api }: LabProps) {
  const [mass, setMass] = useState(0.5);
  const [h0, setH0] = useState(1);
  const [hc, setHc] = useState(0.6);
  const [mu, setMu] = useState(0);
  const [rolling, setRolling] = useState(false);
  const [idx, setIdx] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const res = useMemo(() => simulateTrack({ mass, startHeight: h0, hillHeight: hc, mu, rolling }), [mass, h0, hc, mu, rolling]);
  const raf = useRef(0);
  useEffect(() => { setIdx(0); setRunning(false); setDone(false); }, [mass, h0, hc, mu, rolling]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setIdx(res.points.length - 1); setRunning(false); setDone(true); return; }
    const start = performance.now();
    const loop = (now: number) => {
      const i = Math.max(0, Math.min(res.points.length - 1, Math.floor(((now - start) / 3500) * res.points.length)));
      setIdx(i);
      if (i >= res.points.length - 1) { setRunning(false); setDone(true); return; }
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf.current);
  }, [running, res]);

  const p = res.points[Math.min(idx, res.points.length - 1)];
  const sx = (x: number) => 30 + (x / TRACK_X) * (W - 60), sy = (h: number) => 230 - h * 95;
  // dibuja la pista completa aunque la esfera no la recorra
  const path = useMemo(() => Array.from({ length: 201 }, (_, i) => {
    const x = (TRACK_X * i) / 200;
    return `${30 + (x / TRACK_X) * (W - 60)},${230 - trackHeight(x, h0, hc) * 95}`;
  }).join(' '), [h0, hc]);
  const E = res.totalEnergy;
  const bar = (v: number) => (Math.max(0, v) / E) * 150;
  const last = res.points[res.points.length - 1];

  const record = () => api.addTrial('recorridos', {
    masa: mass, altura: h0, colina: hc, mu, rueda: rolling ? 'sí' : 'no',
    vValle: Number(res.speedBottom.toFixed(3)), supera: res.passesHill ? 'sí' : 'no', disipada: Number(last.ef.toFixed(4)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="en-t en-d">
            <title id="en-t">Esfera en una pista con una colina</title>
            <desc id="en-d">{`Altura de salida ${fmt(h0, 2)} m; colina de ${fmt(hc, 2)} m. ${done ? (res.passesHill ? `Supera la colina; rapidez en el valle ${fmt(res.speedBottom, 2)} m/s.` : 'No supera la colina.') : ''}`}</desc>
            <polyline points={path} fill="none" stroke="var(--ink-2)" strokeWidth="4" strokeLinejoin="round" />
            <line x1="30" x2={W - 30} y1={sy(0)} y2={sy(0)} stroke="var(--line)" strokeDasharray="4 4" />
            <line x1="22" x2="22" y1={sy(0)} y2={sy(h0)} stroke="var(--ink-2)" />
            <text x="14" y={sy(h0) - 4} style={{ fontSize: 11, fill: 'var(--ink-2)' }}>h₀ = {fmt(h0, 2)} m</text>
            <circle cx={sx(p.x)} cy={sy(p.h) - 9} r="9" fill="var(--data)" stroke="var(--surface)" strokeWidth="2" />
            <text x={sx(p.x)} y={sy(p.h) - 24} textAnchor="middle" style={{ fontSize: 11, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>{fmt(p.v, 2)} m/s</text>
            {!res.passesHill && done && <text x={sx(res.stopX!)} y={sy(hc) - 30} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--bad)', fontWeight: 700 }}>no alcanza la cima</text>}
          </svg>
        </div>
        <div className="grid-2">
          <div className="card stack-sm" aria-live="polite">
            <h3>Energía ({fmt(E, 2)} J en total)</h3>
            {[{ k: 'Potencial (Ep)', v: p.ep, c: 'var(--fis)' }, { k: 'Cinética (Ec)', v: p.ek, c: 'var(--data)' }, { k: 'Disipada por fricción', v: p.ef, c: 'var(--bad)' }].map((b) => (
              <div key={b.k} className="small" style={{ display: 'grid', gridTemplateColumns: '150px 1fr 70px', gap: 8, alignItems: 'center' }}>
                <span>{b.k}</span>
                <span style={{ height: 14, background: 'var(--surface-2)', borderRadius: 4, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: bar(b.v), maxWidth: '100%', background: b.c }} /></span>
                <span className="num">{fmt(b.v, 2)} J</span>
              </div>
            ))}
          </div>
          <Readout items={[
            { k: 'Rapidez en el valle', v: done ? `${fmt(res.speedBottom, 2)} m/s` : 'suelta la esfera', data: true },
            { k: '¿Supera la colina?', v: done ? (res.passesHill ? 'sí' : 'no') : '—' },
            { k: 'Rapidez al final', v: done && res.speedEnd !== null ? `${fmt(res.speedEnd, 2)} m/s` : '—' },
            { k: 'Energía disipada', v: done ? `${fmt(last.ef, 3)} J` : '—' },
          ]} />
        </div>
        <details className="card">
          <summary>Gráfica de energías a lo largo de la pista (después de soltar)</summary>
          <Chart title="Energía en función de la posición" xLabel="Posición horizontal (m)" yLabel="Energía (J)" height={240}
            series={done ? [
              { label: 'Ep', kind: 'line', points: res.points.map((q) => ({ x: q.x, y: q.ep })) },
              { label: 'Ec', kind: 'line', points: res.points.map((q) => ({ x: q.x, y: q.ek })) },
              { label: 'Ep + Ec', kind: 'line', dashed: true, points: res.points.map((q) => ({ x: q.x, y: q.ep + q.ek })) },
            ] : []} emptyText="Suelta la esfera para ver la gráfica." />
        </details>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Slider label="Altura de salida" value={h0} min={ENERGY_LIMITS.startHeight[0]} max={ENERGY_LIMITS.startHeight[1]} step={0.1} unit="m" decimals={2} onChange={setH0} />
          <Slider label="Altura de la colina" value={hc} min={ENERGY_LIMITS.hillHeight[0]} max={ENERGY_LIMITS.hillHeight[1]} step={0.1} unit="m" decimals={2} onChange={setHc} />
          <Slider label="Masa de la esfera" value={mass} min={ENERGY_LIMITS.mass[0]} max={ENERGY_LIMITS.mass[1]} step={0.05} unit="kg" decimals={2} onChange={setMass} />
          <Slider label="Fricción efectiva μ" value={mu} min={ENERGY_LIMITS.mu[0]} max={ENERGY_LIMITS.mu[1]} step={0.005} decimals={3} onChange={setMu} />
          <label className="check"><input type="checkbox" checked={rolling} onChange={(e) => setRolling(e.target.checked)} /> La esfera rueda (parte de la energía va a la rotación)</label>
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setIdx(0); setDone(false); setRunning(true); }} disabled={running}>Soltar la esfera</button>
            <button type="button" className="btn" onClick={() => { setIdx(0); setDone(false); setRunning(false); }}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>g = 9,8 m/s²; sin resistencia del aire. La fricción se modela como μ·m·g por metro horizontal (aproximación para pendientes suaves).</Notice>
      </div>
    </div>
  );
}
