import { useEffect, useMemo, useRef, useState } from 'react';
import { NEWTON_LIMITS, positionAt, simulateCart, SURFACES, TRACK_LENGTH } from '../models/newton';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

function Arrow({ x1, y1, x2, y2, color, label }: { x1: number; y1: number; x2: number; y2: number; color: string; label: string }) {
  if (Math.hypot(x2 - x1, y2 - y1) < 2) return null;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const h = 8;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="3" />
      <path d={`M${x2} ${y2} L${x2 - h * Math.cos(ang - 0.4)} ${y2 - h * Math.sin(ang - 0.4)} L${x2 - h * Math.cos(ang + 0.4)} ${y2 - h * Math.sin(ang + 0.4)} Z`} fill={color} />
      <text x={x2 + 6 * Math.cos(ang)} y={y2 + 6 * Math.sin(ang) + 4} style={{ fontSize: 12, fill: color, fontWeight: 700 }}>{label}</text>
    </g>
  );
}

export default function NewtonLab({ api }: LabProps) {
  const [mass, setMass] = useState(0.5);
  const [force, setForce] = useState(2);
  const [surface, setSurface] = useState('colchon');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const res = useMemo(() => simulateCart({ mass, force, surfaceId: surface }), [mass, force, surface]);
  const raf = useRef(0);
  const reset = () => { setRunning(false); setDone(false); setT(0); };
  useEffect(reset, [mass, force, surface]);

  useEffect(() => {
    if (!running) return;
    if (!res.moves) { setRunning(false); setDone(true); return; }
    if (prefersReducedMotion()) { setT(res.time!); setRunning(false); setDone(true); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const el = Math.max(0, (now - start) / 1000);
      if (el >= res.time!) { setT(res.time!); setRunning(false); setDone(true); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, res]);

  const x = res.moves ? positionAt(res.acceleration, t) : 0;
  const trackX0 = 60, trackPx = 420;
  const cartX = trackX0 + (x / TRACK_LENGTH) * trackPx;
  const scaleF = 9; // px por newton en el diagrama
  const record = () => api.addTrial('carrito', {
    superficie: SURFACES.find((s) => s.id === surface)!.name, masa: mass, fuerza: force,
    tiempo: res.time, aMedida: res.measuredAcceleration === null ? 0 : Number(res.measuredAcceleration.toFixed(4)),
    friccion: Number(res.friction.toFixed(3)), inversoMasa: Number((1 / mass).toFixed(4)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 230" role="img" aria-labelledby="nw-t nw-d">
            <title id="nw-t">Carrito sobre una pista con dos fotopuertas separadas 1,00 m</title>
            <desc id="nw-d">{done ? (res.moves ? `El carrito recorrió 1,00 m en ${fmt(res.time!, 3)} s.` : 'El carrito no se movió: la fricción estática equilibra la fuerza aplicada.') : 'El carrito está en reposo en la primera fotopuerta.'}</desc>
            <rect x="30" y="150" width="500" height="10" fill={surface === 'lija' ? '#a8865a' : surface === 'madera' ? '#c79a62' : 'var(--line)'} />
            {[trackX0, trackX0 + trackPx].map((gx, i) => (
              <g key={i}><rect x={gx - 3} y="80" width="6" height="70" fill="var(--ink-2)" /><text x={gx} y="74" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>fotopuerta {i + 1}</text></g>
            ))}
            <g transform={`translate(${cartX - 30} 0)`}>
              <rect x="0" y="112" width="60" height="30" rx="5" fill="var(--fis)" />
              <circle cx="14" cy="146" r="6" fill="var(--ink)" /><circle cx="46" cy="146" r="6" fill="var(--ink)" />
              <text x="30" y="132" textAnchor="middle" style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }}>{fmt(mass, 2)} kg</text>
              <line x1="60" y1="125" x2="80" y2="125" stroke="var(--ink-2)" strokeWidth="2" />
              <text x="82" y="120" style={{ fontSize: 11, fill: 'var(--ink)' }}>{fmt(force, 1)} N</text>
            </g>
            <text x="560" y="40" textAnchor="middle" style={{ fontSize: 13, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>{fmt(t, 3)} s</text>
            <text x="560" y="58" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>cronómetro</text>
            <text x="300" y="200" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>1,00 m</text>
            <line x1={trackX0} x2={trackX0 + trackPx} y1="185" y2="185" stroke="var(--ink-2)" />
          </svg>
        </div>
        <div className="grid-2">
          <div className="card">
            <h3>Diagrama de cuerpo libre</h3>
            <svg viewBox="0 0 260 220" role="img" aria-label={`Fuerzas: peso ${fmt(res.weight, 2)} N hacia abajo, normal ${fmt(res.normal, 2)} N hacia arriba, aplicada ${fmt(force, 2)} N a la derecha, fricción ${fmt(res.friction, 2)} N a la izquierda.`} style={{ maxWidth: 280 }}>
              <rect x="105" y="85" width="50" height="40" rx="4" fill="var(--surface-2)" stroke="var(--ink-2)" />
              <Arrow x1={130} y1={125} x2={130} y2={125 + Math.min(80, res.weight * scaleF / 2)} color="var(--ink)" label={`P = ${fmt(res.weight, 1)} N`} />
              <Arrow x1={130} y1={85} x2={130} y2={85 - Math.min(80, res.normal * scaleF / 2)} color="var(--ok)" label={`N = ${fmt(res.normal, 1)} N`} />
              <Arrow x1={155} y1={105} x2={155 + force * scaleF} y2={105} color="var(--fis)" label={`F = ${fmt(force, 1)} N`} />
              <Arrow x1={105} y1={115} x2={105 - res.friction * scaleF} y2={115} color="var(--bad)" label="" />
              {res.friction > 0.01 && <text x={Math.max(4, 100 - res.friction * scaleF)} y="140" style={{ fontSize: 12, fill: 'var(--bad)', fontWeight: 700 }}>Fr = {fmt(res.friction, 2)}</text>}
            </svg>
          </div>
          <Readout items={[
            { k: 'Fuerza neta', v: `${fmt(res.netForce, 2)} N` },
            { k: 'Tiempo en 1,00 m', v: done ? (res.moves ? `${fmt(res.time!, 3)} s` : 'no se movió') : '—', data: true },
            { k: 'a medida = 2d/t²', v: done && res.measuredAcceleration !== null ? `${fmt(res.measuredAcceleration, 3)} m/s²` : '—', data: true },
            { k: 'Rapidez final', v: done && res.finalSpeed !== null ? `${fmt(res.finalSpeed, 2)} m/s` : '—' },
            { k: 'Fricción máxima estática', v: `${fmt(SURFACES.find((s) => s.id === surface)!.muS * res.normal, 2)} N` },
          ]} />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Select label="Superficie" value={surface} onChange={setSurface} options={SURFACES.map((s) => ({ value: s.id, label: s.name }))} />
          <Slider label="Masa del carrito" value={mass} min={NEWTON_LIMITS.mass[0]} max={NEWTON_LIMITS.mass[1]} step={0.05} unit="kg" decimals={2} onChange={setMass} />
          <Slider label="Fuerza aplicada" value={force} min={NEWTON_LIMITS.force[0]} max={NEWTON_LIMITS.force[1]} step={0.1} unit="N" decimals={1} onChange={setForce} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setT(0); setDone(false); setRunning(true); }} disabled={running}>Soltar el carrito</button>
            <button type="button" className="btn" onClick={reset}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>Fuerza constante y horizontal; g = 9,8 m/s². Los coeficientes de fricción son típicos y aproximados.</Notice>
      </div>
    </div>
  );
}
