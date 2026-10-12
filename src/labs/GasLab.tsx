import { useEffect, useMemo, useState } from 'react';
import { GAS_LIMITS, INITIAL, simulateGas, type GasLaw } from '../models/gases';
import { seededRandom } from '../models/math';
import { useMeasure } from '../components/Measurement';
import { instrument } from './instruments';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, GasSyringe, Lcd, Thermometer } from './kit';
import { Knob, ManipHint, ManipScene, Plunger } from './manipulate';

/* Geometría de la jeringa (200 mL en 380 px). */
const SYR = { x: 176, y: 98, len: 380, h: 46, cap: 200 };
const syrX = (v: number) => SYR.x + (v / SYR.cap) * SYR.len;

/** Ángulo (rad) de la aguja del manómetro: 0–300 kPa recorren 270°. */
const gaugeAngle = (p: number) => Math.PI * (0.75 + (Math.max(0, Math.min(300, p)) / 300) * 1.5);

/** Manómetro de carátula (tubo de Bourdon) con sensor digital en la base. */
function PressureGauge({ cx, cy, pressure, reading }: { cx: number; cy: number; pressure: number; reading: string }) {
  const ticks = useMemo(() => Array.from({ length: 31 }, (_, i) => {
    const a = gaugeAngle(i * 10), major = i % 5 === 0;
    const r1 = major ? 28 : 31, r2 = 35;
    return { i, major, x1: cx + r1 * Math.cos(a), y1: cy + r1 * Math.sin(a), x2: cx + r2 * Math.cos(a), y2: cy + r2 * Math.sin(a), lx: cx + 21 * Math.cos(a), ly: cy + 21 * Math.sin(a) + 2.6 };
  }), [cx, cy]);
  const a = gaugeAngle(pressure);
  const tip = { x: cx + 31 * Math.cos(a), y: cy + 31 * Math.sin(a) };
  const tail = { x: cx - 8 * Math.cos(a), y: cy - 8 * Math.sin(a) };
  const nx = -Math.sin(a) * 2.2, ny = Math.cos(a) * 2.2;
  const arc = (p0: number, p1: number, r: number) => {
    const a0 = gaugeAngle(p0), a1 = gaugeAngle(p1);
    return `M${cx + r * Math.cos(a0)} ${cy + r * Math.sin(a0)} A${r} ${r} 0 ${a1 - a0 > Math.PI ? 1 : 0} 1 ${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)}`;
  };
  return (
    <g>
      {/* base con sensor digital */}
      <g filter="url(#kit-shadow)">
        <rect x={cx - 8} y={cy + 40} width={16} height={18} fill="url(#kit-metal-h)" />
        <path d={`M${cx - 40} ${cy + 56} L${cx + 40} ${cy + 56} Q${cx + 46} ${cy + 56} ${cx + 46} ${cy + 62} L${cx + 48} 228 L${cx - 48} 228 L${cx - 46} ${cy + 62} Q${cx - 46} ${cy + 56} ${cx - 40} ${cy + 56} Z`} fill="url(#kit-body)" stroke="#a9b4b6" />
        <circle cx={cx} cy={cy} r={44} fill="url(#kit-metal)" stroke="#8f9a9e" />
      </g>
      <Lcd x={cx - 44} y={cy + 67} w={88} h={22} text={`${reading} kPa`} />
      <circle cx={cx} cy={cy} r={39} fill="#fbfbf7" stroke="#6f7a7e" strokeWidth="0.8" />
      <path d={arc(250, 300, 33)} fill="none" stroke="#d64541" strokeWidth="4" />
      <path d={arc(0, 101.3, 33)} fill="none" stroke="#3a9d6a" strokeWidth="2" opacity="0.6" />
      {ticks.map((t) => (
        <g key={t.i}>
          <line x1={t.x1} y1={t.y1} x2={t.x2} y2={t.y2} stroke="#1f2a2c" strokeWidth={t.major ? 1.3 : 0.6} />
          {t.major && <text x={t.lx} y={t.ly} textAnchor="middle" style={{ fontSize: 6.5, fill: '#1f2a2c', fontFamily: 'var(--font-data)' }}>{t.i * 10}</text>}
        </g>
      ))}
      <text x={cx} y={cy + 26} textAnchor="middle" style={{ fontSize: 7, fill: '#1f2a2c', fontWeight: 700 }}>kPa</text>
      <path d={`M${tail.x + nx} ${tail.y + ny} L${tip.x} ${tip.y} L${tail.x - nx} ${tail.y - ny} Z`} fill="#c62828" />
      <circle cx={cx} cy={cy} r={4.2} fill="url(#kit-metal)" stroke="#6f7a7e" strokeWidth="0.6" />
      <path d={`M${cx - 30} ${cy - 18} A36 36 0 0 1 ${cx + 12} ${cy - 34}`} fill="none" stroke="#fff" strokeWidth="5" opacity="0.35" strokeLinecap="round" />
    </g>
  );
}

const LAW_NAME: Record<GasLaw, string> = { boyle: 'Temperatura constante (Boyle)', charles: 'Presión constante (Charles)', 'gay-lussac': 'Volumen constante (Gay-Lussac)' };

export default function GasLab({ api }: LabProps) {
  const [law, setLaw] = useState<GasLaw>('boyle');
  const [volume, setVolumeState] = useState(INITIAL.volume);
  const [temperature, setTemperatureState] = useState(INITIAL.temperature);
  // Sonido: chirrido del émbolo de goma (más agudo cuanto más comprimido) y detentes de la perilla del termostato.
  const setVolume = (v: number) => { setVolumeState(v); if (v !== volume) playSound('squeak', { intensity: Math.min(1, 40 / Math.max(10, v)) }); };
  const setTemperature = (v: number) => { setTemperatureState(v); if (v !== temperature) playSound('knob'); };
  const [tick, setTick] = useState(0);
  const model = useMemo(() => simulateGas({ law, volume, temperature, pressure: INITIAL.pressure }), [law, volume, temperature]);
  // Lecturas de los instrumentos. En modo real: el émbolo queda un poco desalineado de la marca de la escala
  // (el volumen real del gas difiere del indicado y la presión sigue P ∝ 1/V del modelo) y el manómetro suma su ruido.
  const { measure, remeasure, deviation } = useMeasure();
  const res = useMemo(() => {
    const syr = instrument('gases', 'jeringa');
    let pressure = model.pressure, volumeReading = model.volumeReading;
    if (law === 'charles') volumeReading = measure(model.volume, { ...syr, key: 'jeringa' });
    else {
      const dv = deviation('jeringa', syr.sigma ?? 0);
      if (dv !== 0) pressure = (model.pressure * model.volume) / (model.volume + dv);
    }
    const pressureReading = measure(pressure, { ...instrument('gases', 'manometro'), key: 'manometro' });
    return { ...model, pressureReading, volumeReading };
  }, [model, law, measure, deviation]);

  // Partículas: su rapidez de animación ∝ √T (energía cinética media ∝ T).
  useEffect(() => {
    if (prefersReducedMotion()) return;
    let raf = 0;
    const loop = () => { setTick((x) => x + 1); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, []);
  const particles = useMemo(() => { const r = seededRandom(3); return Array.from({ length: 40 }, () => ({ x: r(), y: r(), vx: r() - 0.5, vy: r() - 0.5 })); }, []);
  const speed = Math.sqrt(res.temperatureK / 298) * 0.004;
  const cylLen = (res.volume / 200) * 380; // px de gas dentro de la jeringa
  const warm = res.temperatureC > 25;
  const bathColor = `rgba(${warm ? 230 : 80},${warm ? 120 : 140},${warm ? 80 : 230},${Math.min(0.35, Math.abs(res.temperatureC - 25) / 200 + 0.08)})`;
  const pos = (p: { x: number; vx: number }, len: number) => { const raw = (p.x + p.vx * speed * tick) % 2; const u = raw < 0 ? raw + 2 : raw; return (u > 1 ? 2 - u : u) * len; };

  const record = () => { api.addTrial('mediciones', {
    ley: LAW_NAME[law], volumen: res.volumeReading, temperatura: law === 'boyle' ? INITIAL.temperature : temperature,
    temperaturaK: Number(res.temperatureK.toFixed(2)), presion: res.pressureReading,
    inversoV: Number((1 / res.volumeReading).toFixed(6)), pv: Number((res.pressureReading * res.volumeReading).toFixed(1)),
  });
  // Cada ensayo guardado cuenta como una medición: la siguiente lectura es una repetición nueva.
  remeasure('manometro', 'jeringa'); };

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox="0 0 640 256" label="Controles de la jeringa y del baño" scene={
          <svg viewBox="0 0 640 256" role="img" aria-labelledby="gas-t gas-d">
            <title id="gas-t">Jeringa con aire, manómetro y termómetro</title>
            <desc id="gas-d">{`${LAW_NAME[law]}. Volumen ${fmt(res.volumeReading, 0)} mL, presión ${fmt(res.pressureReading, 1)} kPa, temperatura ${fmt(res.temperatureC, 1)} °C.`}</desc>
            <BenchTop y={228} width={640} />
            {/* baño de agua termostatizado (solo si cambia la temperatura) */}
            {law !== 'boyle' && <rect x={118} y={58} width={478} height={170} rx={4} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />}
            {/* soportes en V */}
            {[233, 499].map((cx) => (
              <g key={cx}>
                <rect x={cx - 7} y={150} width={14} height={law !== 'boyle' ? 74 : 78} fill="url(#kit-body-dark)" />
                <path d={`M${cx - 13} 143 L${cx + 13} 143 L${cx + 9} 152 L${cx - 9} 152 Z`} fill="url(#kit-body-dark)" />
              </g>
            ))}
            {law !== 'boyle' && <rect x={121} y={74} width={472} height={151} fill="rgba(110,170,220,0.2)" />}
            {law !== 'boyle' && <rect x={121} y={74} width={472} height={151} fill={bathColor} />}
            {law !== 'boyle' && <rect x={121} y={74} width={472} height={3} fill="#fff" opacity="0.35" />}
            {law === 'boyle' && <path d="M124 228 L148 228 L144 219 L128 219 Z" fill="url(#kit-body-dark)" />}
            <Thermometer x={136} y={36} h={186} min={-20} max={100} value={res.temperatureC} />
            <GasSyringe x={SYR.x} y={SYR.y} length={SYR.len} height={SYR.h} fraction={res.volume / SYR.cap} capacity={SYR.cap} major={20} gas="rgba(120,180,230,0.2)">
              {particles.map((p, i) => <circle key={i} cx={177 + 4 + pos(p, Math.max(8, cylLen - 10))} cy={103 + pos({ x: p.y, vx: p.vy }, 36)} r="2.8" fill="var(--fis)" opacity="0.9" />)}
            </GasSyringe>
            {law !== 'boyle' && <rect x={118} y={58} width={478} height={170} rx={4} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />}
            {/* manguera al manómetro */}
            <path d="M100 121 L162 121" stroke="#56636a" strokeWidth="6" strokeLinecap="round" />
            <path d="M100 119.5 L162 119.5" stroke="#fff" strokeWidth="1.2" opacity="0.25" />
            <PressureGauge cx={60} cy={110} pressure={res.pressure} reading={fmt(res.pressureReading, 1)} />
            <text x="200" y="30" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{law === 'boyle' ? `T = ${fmt(INITIAL.temperature, 1)} °C (constante)` : `Baño a ${fmt(res.temperatureC, 1)} °C`}</text>
          </svg>}>
            {law === 'boyle' ? (
              <Plunger label="Émbolo de la jeringa" value={volume} min={GAS_LIMITS.volume[0]} max={GAS_LIMITS.volume[1]} step={10} unit="mL" decimals={0}
                from={{ x: syrX(GAS_LIMITS.volume[0]), y: SYR.y + SYR.h / 2 }} to={{ x: syrX(GAS_LIMITS.volume[1]), y: SYR.y + SYR.h / 2 }} size={SYR.h} onChange={setVolume} />
            ) : (
              <Knob label="Perilla del termostato del baño" cx={614} cy={30} r={13} value={temperature} min={GAS_LIMITS.temperature[0]} max={GAS_LIMITS.temperature[1]} step={5} unit="°C" decimals={0} caption="termostato" onChange={setTemperature} />
            )}
          </ManipScene>
        </div>
        <ManipHint>{law === 'boyle'
          ? 'Arrastra el émbolo de la jeringa para cambiar el volumen, o enfócalo con Tab y usa las flechas.'
          : 'Gira la perilla del termostato (arriba a la derecha) para cambiar la temperatura del baño, o enfócala con Tab y usa las flechas.'}</ManipHint>
        <Readout items={[
          { k: 'Presión (manómetro)', v: `${fmt(res.pressureReading, 1)} kPa`, data: true },
          { k: 'Volumen (escala)', v: `${fmt(res.volumeReading, 0)} mL`, data: true },
          { k: 'Temperatura', v: `${fmt(res.temperatureC, 1)} °C = ${fmt(res.temperatureK, 1)} K` },
          { k: law === 'boyle' ? 'P·V' : law === 'charles' ? 'V/T' : 'P/T', v: law === 'boyle' ? `${fmt(res.pv, 0)} kPa·mL` : law === 'charles' ? `${fmt(res.vOverT, 4)} mL/K` : `${fmt(res.pOverT, 4)} kPa/K` },
        ]} />
        <Warnings list={res.warnings} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Experimento</h3>
          <Segmented label="Variable que se mantiene constante" value={law} onChange={setLaw} options={[{ value: 'boyle', label: 'Temperatura' }, { value: 'charles', label: 'Presión' }, { value: 'gay-lussac', label: 'Volumen' }]} />
          {law === 'boyle'
            ? <Slider label="Volumen de la jeringa" value={volume} min={GAS_LIMITS.volume[0]} max={GAS_LIMITS.volume[1]} step={10} unit="mL" decimals={0} onChange={setVolume} />
            : <Slider label="Temperatura del baño" value={temperature} min={GAS_LIMITS.temperature[0]} max={GAS_LIMITS.temperature[1]} step={5} unit="°C" decimals={0} onChange={setTemperature} />}
          <RecordButton onRecord={record} />
          <p className="small muted">Para Charles, grafica volumen contra temperatura (°C) y prolonga la recta de ajuste hasta volumen cero.</p>
        </div>
        <Notice>Gas ideal: 100 mL de aire a 101,3 kPa y 25 °C. La rapidez de las partículas en la animación aumenta con la temperatura absoluta.</Notice>
      </div>
    </div>
  );
}
