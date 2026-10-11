import { useEffect, useMemo, useState } from 'react';
import { GAS_LIMITS, INITIAL, simulateGas, type GasLaw } from '../models/gases';
import { seededRandom } from '../models/math';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';

const LAW_NAME: Record<GasLaw, string> = { boyle: 'Temperatura constante (Boyle)', charles: 'Presión constante (Charles)', 'gay-lussac': 'Volumen constante (Gay-Lussac)' };

export default function GasLab({ api }: LabProps) {
  const [law, setLaw] = useState<GasLaw>('boyle');
  const [volume, setVolume] = useState(INITIAL.volume);
  const [temperature, setTemperature] = useState(INITIAL.temperature);
  const [tick, setTick] = useState(0);
  const res = useMemo(() => simulateGas({ law, volume, temperature, pressure: INITIAL.pressure }), [law, volume, temperature]);

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
  const pos = (p: { x: number; vx: number }, len: number) => { const raw = (p.x + p.vx * speed * tick) % 2; const u = raw < 0 ? raw + 2 : raw; return (u > 1 ? 2 - u : u) * len; };

  const record = () => api.addTrial('mediciones', {
    ley: LAW_NAME[law], volumen: res.volumeReading, temperatura: law === 'boyle' ? INITIAL.temperature : temperature,
    temperaturaK: Number(res.temperatureK.toFixed(2)), presion: res.pressureReading,
    inversoV: Number((1 / res.volumeReading).toFixed(6)), pv: Number((res.pressureReading * res.volumeReading).toFixed(1)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 220" role="img" aria-labelledby="gas-t gas-d">
            <title id="gas-t">Jeringa con aire, manómetro y termómetro</title>
            <desc id="gas-d">{`${LAW_NAME[law]}. Volumen ${fmt(res.volumeReading, 0)} mL, presión ${fmt(res.pressureReading, 1)} kPa, temperatura ${fmt(res.temperatureC, 1)} °C.`}</desc>
            {law !== 'boyle' && <rect x="20" y="40" width="470" height="140" rx="12" fill={`rgba(${res.temperatureC > 25 ? 230 : 80},${res.temperatureC > 25 ? 120 : 140},${res.temperatureC > 25 ? 80 : 230},${Math.min(0.35, Math.abs(res.temperatureC - 25) / 200 + 0.08)})`} />}
            <rect x="60" y="80" width="400" height="60" fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="2" />
            {Array.from({ length: 11 }, (_, i) => <g key={i}><line x1={60 + i * 38} x2={60 + i * 38} y1="140" y2="150" stroke="var(--ink-2)" /><text x={60 + i * 38} y="162" textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>{i * 20}</text></g>)}
            <rect x="61" y="81" width={cylLen} height="58" fill="rgba(120,180,230,0.18)" />
            {particles.map((p, i) => <circle key={i} cx={61 + 4 + pos(p, Math.max(8, cylLen - 8))} cy={85 + pos({ x: p.y, vx: p.vy }, 50)} r="3" fill="var(--fis)" />)}
            <rect x={60 + cylLen} y="76" width="10" height="68" fill="var(--ink-2)" />
            <rect x={70 + cylLen} y="104" width={Math.max(0, 470 - cylLen)} height="12" fill="var(--line)" />
            <circle cx="560" cy="80" r="44" fill="var(--surface)" stroke="var(--ink-2)" strokeWidth="2" />
            <line x1="560" y1="80" x2={560 + 34 * Math.cos(Math.PI * (0.75 + (res.pressure / 300) * 1.5))} y2={80 + 34 * Math.sin(Math.PI * (0.75 + (res.pressure / 300) * 1.5))} stroke="var(--bad)" strokeWidth="3" />
            <text x="560" y="140" textAnchor="middle" style={{ fontSize: 13, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>{fmt(res.pressureReading, 1)} kPa</text>
            <line x1="516" y1="80" x2="60" y2="80" stroke="var(--ink-2)" strokeDasharray="3 3" opacity="0.4" />
            <text x="40" y="30" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{law === 'boyle' ? `T = ${fmt(INITIAL.temperature, 1)} °C (constante)` : `Baño a ${fmt(res.temperatureC, 1)} °C`}</text>
          </svg>
        </div>
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
