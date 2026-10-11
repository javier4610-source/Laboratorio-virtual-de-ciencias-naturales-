import { useEffect, useMemo, useState } from 'react';
import { LIGHT_COLORS, PHOTO_LIMITS, simulatePhotosynthesis, type LightColor } from '../models/photosynthesis';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';

export default function PhotoLab({ api }: LabProps) {
  const [distance, setDistance] = useState(20);
  const [bicarbonate, setBicarbonate] = useState(1);
  const [temperature, setTemperature] = useState(25);
  const [color, setColor] = useState<LightColor>('blanca');
  const [lampOn, setLampOn] = useState(true);
  const [counted, setCounted] = useState<number | null>(null);
  const [phase, setPhase] = useState(0);
  const res = useMemo(() => simulatePhotosynthesis({ distance, bicarbonate, temperature, color, lampOn }), [distance, bicarbonate, temperature, color, lampOn]);
  const change = <T,>(set: (v: T) => void) => (v: T) => { set(v); setCounted(null); };

  // Animación de burbujas: su ritmo es proporcional a las burbujas por minuto (acelerado 10× para verlas).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0, last = performance.now();
    const tick = (now: number) => { setPhase((p) => p + ((now - last) / 1000) * (res.bubblesPerMin / 6)); last = now; raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [res.bubblesPerMin]);

  const lampColor = LIGHT_COLORS.find((c) => c.id === color)!.color;
  const lampX = 470 - (distance / 100) * 330; // riel: 5 cm cerca del tubo, 100 cm lejos
  const bubbles = Array.from({ length: 6 }, (_, i) => {
    const prog = (phase + i / 6) % 1;
    return res.bubblesPerMin > 0 ? { y: 200 - prog * 150, r: 3 + (i % 3) } : null;
  }).filter(Boolean) as { y: number; r: number }[];

  const record = () => api.addTrial('ensayos', {
    color: LIGHT_COLORS.find((c) => c.id === color)!.name, distancia: distance, irradiancia: Number(res.irradiance.toFixed(1)),
    bicarbonato: bicarbonate, temperatura: temperature, burbujas: counted ?? Number(res.bubblesPerMin.toFixed(1)),
    neta: Number(res.net.toFixed(2)), limitante: lampOn ? res.limiting : 'sin luz',
  });

  const warnings: string[] = [];
  if (temperature >= 40) warnings.push('A esta temperatura las enzimas de la fotosíntesis empiezan a desnaturalizarse.');
  if (lampOn && res.net <= 0) warnings.push('La respiración supera a la fotosíntesis: no se liberan burbujas (por debajo del punto de compensación).');

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 260" role="img" aria-labelledby="ph-t ph-d">
            <title id="ph-t">Planta acuática Elodea iluminada por una lámpara sobre un riel</title>
            <desc id="ph-d">{`Lámpara ${lampOn ? `encendida, luz ${color}, a ${distance} cm` : 'apagada'}. ${fmt(res.bubblesPerMin, 1)} burbujas por minuto.`}</desc>
            <line x1="120" x2="480" y1="230" y2="230" stroke="var(--ink-2)" strokeWidth="3" />
            {[5, 20, 40, 60, 80, 100].map((d) => (
              <g key={d}><line x1={470 - (d / 100) * 330} x2={470 - (d / 100) * 330} y1="224" y2="236" stroke="var(--ink-2)" /><text x={470 - (d / 100) * 330} y="252" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{d} cm</text></g>
            ))}
            {lampOn && <path d={`M${lampX + 22} 120 L520 60 L520 210 Z`} fill={lampColor} opacity={Math.min(0.45, 0.06 + res.irradiance / 3000)} />}
            <g transform={`translate(${lampX} 95)`}>
              <rect x="-18" y="0" width="40" height="50" rx="8" fill={lampOn ? lampColor : 'var(--surface-2)'} stroke="var(--ink-2)" />
              <line x1="2" x2="2" y1="50" y2="135" stroke="var(--ink-2)" strokeWidth="3" />
            </g>
            <rect x="500" y="40" width="70" height="180" rx="10" fill={`rgba(120,180,220,${0.15 + Math.min(0.3, bicarbonate * 0.05)})`} stroke="var(--ink-2)" strokeWidth="2" />
            <path d="M535 215 C530 180 545 160 532 130 C524 110 540 95 535 70" stroke="#2e7d32" strokeWidth="5" fill="none" />
            {[90, 115, 140, 165, 190].map((y, i) => <ellipse key={y} cx={535 + (i % 2 ? 10 : -10)} cy={y} rx="9" ry="4" fill="#4caf50" transform={`rotate(${i % 2 ? 30 : -30} ${535 + (i % 2 ? 10 : -10)} ${y})`} />)}
            {bubbles.map((b, i) => <circle key={i} cx={536 + (i % 2 ? 3 : -3)} cy={b.y - 20} r={b.r} fill="rgba(255,255,255,0.8)" stroke="var(--fis)" />)}
            <text x="535" y="32" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{temperature} °C</text>
          </svg>
        </div>
        <Readout items={[
          { k: 'Irradiancia', v: `${fmt(res.irradiance, 0)} µmol/m²·s` },
          { k: 'Burbujas por minuto', v: counted !== null ? fmt(counted, 0) : 'cuenta 1 minuto', data: true },
          ...(counted === null ? [{ k: 'Valores del modelo', v: 'se muestran después de contar' }] : [
            { k: 'Fotosíntesis bruta', v: `${fmt(res.gross, 1)} µmol O₂/g·h` },
            { k: 'Respiración', v: `${fmt(res.respiration, 1)} µmol O₂/g·h` },
            { k: 'Fotosíntesis neta', v: `${fmt(res.net, 1)} µmol O₂/g·h`, data: true },
            { k: 'Factor limitante (modelo)', v: lampOn ? res.limiting : 'luz (apagada)' },
            { k: 'Punto de compensación', v: res.compensationIrradiance === null ? 'no se alcanza' : `${fmt(res.compensationIrradiance, 0)} µmol/m²·s` },
          ]),
        ]} />
        <Warnings list={warnings} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Slider label="Distancia de la lámpara" value={distance} min={PHOTO_LIMITS.distance[0]} max={PHOTO_LIMITS.distance[1]} step={1} unit="cm" decimals={0} onChange={change(setDistance)} />
          <Slider label="Bicarbonato de sodio (CO₂)" value={bicarbonate} min={PHOTO_LIMITS.bicarbonate[0]} max={PHOTO_LIMITS.bicarbonate[1]} step={0.25} unit="g/L" decimals={2} onChange={change(setBicarbonate)} />
          <Slider label="Temperatura del agua" value={temperature} min={PHOTO_LIMITS.temperature[0]} max={PHOTO_LIMITS.temperature[1]} step={1} unit="°C" decimals={0} onChange={change(setTemperature)} />
          <Select label="Color de la luz" value={color} onChange={(v) => change(setColor)(v as LightColor)} options={LIGHT_COLORS.map((c) => ({ value: c.id, label: c.name }))} />
          <label className="check"><input type="checkbox" checked={lampOn} onChange={(e) => change(setLampOn)(e.target.checked)} /> Lámpara encendida</label>
          <button type="button" className="btn primary" onClick={() => setCounted(Math.round(res.bubblesPerMin))}>Contar burbujas durante 1 minuto</button>
          <RecordButton onRecord={record} disabled={counted === null} />
          {counted === null && <p className="small muted">Cuenta las burbujas antes de guardar el ensayo.</p>}
        </div>
        <Notice>Modelo de factores limitantes con parámetros ilustrativos. Espera a que la planta se aclimate: el conteo supone condiciones estables.</Notice>
      </div>
    </div>
  );
}
