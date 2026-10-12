import { useEffect, useMemo, useState } from 'react';
import { LIGHT_COLORS, PHOTO_LIMITS, simulatePhotosynthesis, type LightColor } from '../models/photosynthesis';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Select, Slider, Warnings } from '../components/ui';
import { DataLogger, LoggerRunCharts, SensorCard } from '../components/DataLogger';
import { rangeStats, type LoggerChannel, type LoggerRun } from '../lib/logger';
import type { LabProps } from './registry';
import { BenchTop, ContactShadow, TestTube, shade } from './kit';
import { ManipHint, ManipScene, Plunger } from './manipulate';

/** Riel óptico: x de la lámpara para una distancia (5 cm junto al tubo, 100 cm en el extremo). */
const railX = (d: number) => 470 - (d / 100) * 330;

/** Rama de elodea: tallo con verticilos de tres hojas; el extremo cortado (arriba) libera las burbujas. */
const ELODEA = (() => {
  const stem = 'M536 244 C531 222 541 204 535 184 C530 166 540 150 536 132';
  const whorls = Array.from({ length: 9 }, (_, i) => {
    const t = i / 8;
    const y = 238 - t * 100, x = 536 + Math.sin(t * 7) * 3;
    const len = 15 - t * 4;
    return [-48, 6, 58].map((a, k) => {
      const ang = a + (i % 2 ? 14 : -10);
      return (
        <path key={`${i}-${k}`} d={`M0 0 Q${len * 0.5} ${-3.2} ${len} 0 Q${len * 0.5} 3.2 0 0 Z`} fill="url(#ph-leaf)" stroke="#256b29" strokeWidth="0.5"
          transform={`translate(${x} ${y}) rotate(${k === 1 ? ang + 180 : ang - 90 + (k === 0 ? -20 : 20)})`} />
      );
    });
  });
  return (
    <g>
      <path d={stem} stroke="#2e7d32" strokeWidth="3" fill="none" strokeLinecap="round" />
      {whorls}
      <ellipse cx="536" cy="131" rx="2.6" ry="1.4" fill="#cfe8b0" stroke="#2e7d32" strokeWidth="0.8" />
      <path d="M530 244 h12 v6 h-12 z" fill="url(#kit-metal)" stroke="#6f7a7c" strokeWidth="0.6" />
    </g>
  );
})();

/** Montaje del sensor de oxígeno disuelto: 1 g de elodea en 100 mL de agua; corrida de 10 min. */
const PLANT_G = 1, WATER_L = 0.1, O2_MG_PER_UMOL = 0.032, SENSOR_DURATION = 600;
/** Oxígeno disuelto de saturación en agua dulce (mg/L) según la temperatura (ajuste empírico, 0–40 °C). */
const doSaturation = (T: number) => 14.62 - 0.3898 * T + 0.006969 * T * T - 0.00005897 * T * T * T;
/** Cambio de oxígeno disuelto por segundo (mg/L·s) para una fotosíntesis neta en µmol O₂/g·h. */
const doRate = (net: number) => (net * PLANT_G * O2_MG_PER_UMOL) / WATER_L / 3600;

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
  const waterColor = bicarbonate > 0 ? '#9fd3e6' : '#bfe3f0';
  const lampX = railX(distance);
  const bubbles = Array.from({ length: 6 }, (_, i) => {
    const prog = (phase + i / 6) % 1;
    return res.bubblesPerMin > 0 ? { y: 128 - prog * 64, r: 2 + (i % 3) * 0.8 } : null;
  }).filter(Boolean) as { y: number; r: number }[];

  const record = () => api.addTrial('ensayos', {
    color: LIGHT_COLORS.find((c) => c.id === color)!.name, distancia: distance, irradiancia: Number(res.irradiance.toFixed(1)),
    bicarbonato: bicarbonate, temperatura: temperature, burbujas: counted ?? Number(res.bubblesPerMin.toFixed(1)),
    neta: Number(res.net.toFixed(2)), limitante: lampOn ? res.limiting : 'sin luz',
  });

  /* Sensores en tiempo real: oxígeno disuelto y luz junto a la planta. */
  const [sensorRun, setSensorRun] = useState<LoggerRun | null>(null);
  const sensorChannels = useMemo<LoggerChannel[]>(() => {
    const do0 = doSaturation(temperature), k = doRate(res.net);
    return [
      { id: 'oxigeno', name: 'Oxígeno disuelto', unit: 'mg/L', resolution: 0.01, noise: 0.012, min: 0, color: 'var(--series-3)', sample: (t) => do0 + k * t },
      { id: 'luz', name: 'Luz (PAR)', unit: 'µmol/m²·s', resolution: 1, noise: 0.6, min: 0, color: 'var(--series-6)', sample: () => res.effectiveLight },
    ];
  }, [temperature, res]);
  const conditions = `Luz ${LIGHT_COLORS.find((c) => c.id === color)!.name.toLowerCase()} ${lampOn ? `a ${distance} cm` : 'apagada'}, ${fmt(bicarbonate, 2)} g/L de bicarbonato, ${temperature} °C`;
  const sensorSlope = sensorRun ? rangeStats(sensorRun.samples, 0)?.slope ?? null : null;

  const warnings: string[] = [];
  if (temperature >= 40) warnings.push('A esta temperatura las enzimas de la fotosíntesis empiezan a desnaturalizarse.');
  if (lampOn && res.net <= 0) warnings.push('La respiración supera a la fotosíntesis: no se liberan burbujas (por debajo del punto de compensación).');

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox="0 0 640 300" label="Controles del montaje de la lámpara" scene={
          <svg viewBox="0 0 640 300" role="img" aria-labelledby="ph-t ph-d">
            <title id="ph-t">Planta acuática Elodea iluminada por una lámpara sobre un riel</title>
            <desc id="ph-d">{`Lámpara ${lampOn ? `encendida, luz ${color}, a ${distance} cm` : 'apagada'}. ${fmt(res.bubblesPerMin, 1)} burbujas por minuto.`}</desc>
            <defs>
              <linearGradient id="ph-beam" x1="0" x2="1">
                <stop offset="0" stopColor={lampColor} stopOpacity="0.95" /><stop offset="1" stopColor={lampColor} stopOpacity="0.15" />
              </linearGradient>
              <radialGradient id="ph-bulb" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0" stopColor="#fff" /><stop offset="0.45" stopColor={lampColor} /><stop offset="1" stopColor={shade(lampColor, -0.35)} />
              </radialGradient>
              <linearGradient id="ph-leaf" x1="0" x2="1">
                <stop offset="0" stopColor="#7cc36a" /><stop offset="1" stopColor="#2f7d32" />
              </linearGradient>
            </defs>
            <BenchTop y={274} width={640} />
            {/* haz de luz */}
            {lampOn && <path d={`M${lampX + 20} 112 L512 52 L512 236 L${lampX + 20} 156 Z`} fill="url(#ph-beam)" opacity={Math.min(0.45, 0.06 + res.irradiance / 3000)} />}
            {/* riel óptico graduado */}
            <rect x="104" y="250" width="392" height="18" rx="3" fill="url(#kit-metal)" stroke="#8d989c" filter="url(#kit-shadow-soft)" />
            <rect x="112" y="268" width="10" height="6" fill="#6f7a7c" /><rect x="478" y="268" width="10" height="6" fill="#6f7a7c" />
            {[5, 20, 40, 60, 80, 100].map((d) => (
              <g key={d}><line x1={470 - (d / 100) * 330} x2={470 - (d / 100) * 330} y1="250" y2="257" stroke="#33403f" /><text x={470 - (d / 100) * 330} y="265.5" textAnchor="middle" style={{ fontSize: 8.5, fill: '#24302f', fontFamily: 'var(--font-data)' }}>{d} cm</text></g>
            ))}
            {/* lámpara sobre su carro */}
            <g transform={`translate(${lampX} 0)`}>
              <rect x="-16" y="238" width="36" height="13" rx="3" fill="url(#kit-body-dark)" />
              <rect x="-1" y="146" width="6" height="94" fill="url(#kit-metal-h)" />
              <circle cx="2" cy="148" r="4.5" fill="url(#kit-metal)" stroke="#6f7a7c" />
              <path d="M-22 116 L6 110 L20 104 L20 164 L6 158 L-22 152 Z" fill="url(#kit-body-dark)" filter="url(#kit-shadow-soft)" />
              <path d="M-20 119 L4 114" stroke="#fff" strokeOpacity="0.18" strokeWidth="2" />
              <ellipse cx="20" cy="134" rx="6" ry="30" fill={lampOn ? 'url(#ph-bulb)' : '#4a5456'} stroke="#1c2325" strokeWidth="1.5" />
              {lampOn && <ellipse cx="22" cy="134" rx="4" ry="22" fill="#fff" opacity="0.35" />}
            </g>
            {/* soporte universal con pinza */}
            <ContactShadow x={572} y={274} w={58} h={7} />
            <rect x="572" y="264" width="58" height="10" rx="2" fill="url(#kit-body-dark)" />
            <rect x="597" y="26" width="7" height="240" fill="url(#kit-metal-h)" />
            <rect x="560" y="78" width="44" height="7" rx="2" fill="url(#kit-metal)" stroke="#8d989c" />
            {/* tubo con agua, bicarbonato y elodea */}
            <TestTube x={506} y={40} w={58} h={212} fill={0.9} liquid={waterColor} liquidOpacity={0.4 + Math.min(0.2, bicarbonate * 0.04)}>
              {ELODEA}
              {bubbles.map((b, i) => <circle key={i} cx={536 + (i % 2 ? 3 : -3)} cy={b.y} r={b.r} fill="#fff" fillOpacity="0.75" stroke="#2a6f9e" strokeWidth="1" />)}
            </TestTube>
            <rect x="500" y="76" width="70" height="10" rx="3" fill="url(#kit-body-dark)" />
            <text x="535" y="30" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{temperature} °C</text>
          </svg>}>
            <Plunger label="Lámpara sobre el riel: distancia al tubo" value={distance} min={PHOTO_LIMITS.distance[0]} max={PHOTO_LIMITS.distance[1]} step={1} pageStep={5} unit="cm" decimals={0}
              from={{ x: railX(PHOTO_LIMITS.distance[0]) + 2, y: 134 }} to={{ x: railX(PHOTO_LIMITS.distance[1]) + 2, y: 134 }} size={48} onChange={change(setDistance)} />
          </ManipScene>
        </div>
        <ManipHint>Arrastra la lámpara por el riel para acercarla o alejarla del tubo, o enfócala con Tab y usa las flechas (← la acerca, → la aleja).</ManipHint>
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
        <SensorCard intro={`Sonda de oxígeno disuelto y sensor de luz junto a la planta (${fmt(PLANT_G, 0)} g de elodea en ${fmt(WATER_L * 1000, 0)} mL de agua, partiendo de la saturación). El registrador simula ${fmt(SENSOR_DURATION / 60, 0)} min con las condiciones actuales; la pendiente del oxígeno disuelto mide la fotosíntesis neta.`}>
          <DataLogger title="Interfaz de sensores · fotosíntesis" channels={sensorChannels} duration={SENSOR_DURATION} speed={30} rates={[1, 2, 5, 10]} defaultRate={1}
            resetKey={conditions} runLabel={conditions} onUseRun={setSensorRun} />
          {sensorRun && (
            <div className="stack-sm">
              <h3>Corrida en uso</h3>
              <p className="small muted" style={{ margin: 0 }}>{sensorRun.label} · {sensorRun.samples.length} muestras a {fmt(sensorRun.rate, 0)} muestras/s.</p>
              {sensorSlope !== null && (
                <Notice kind="info">
                  Pendiente del oxígeno disuelto: <strong>{fmt(sensorSlope * 60, 3)} mg/L por minuto</strong>. Con {fmt(PLANT_G, 0)} g de planta en {fmt(WATER_L * 1000, 0)} mL equivale a una fotosíntesis neta de <strong>{fmt((sensorSlope * WATER_L * 3600) / (O2_MG_PER_UMOL * PLANT_G), 1)} µmol O₂/g·h</strong>.
                </Notice>
              )}
              <LoggerRunCharts run={sensorRun} channels={[0]} fits={{ oxigeno: 'linear' }} />
            </div>
          )}
        </SensorCard>
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
