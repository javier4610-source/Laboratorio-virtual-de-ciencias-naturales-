import { useEffect, useMemo, useRef, useState } from 'react';
import { displacement, findRope, ropeWave, ROPES, soundWave, WAVE_LIMITS } from '../models/waves';
import { fmt, parseLocaleNumber } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

const VIEW_M = 12; // metros de cuerda visibles

function RopePart({ api }: LabProps) {
  const [ropeId, setRopeId] = useState('media');
  const [tension, setTension] = useState(20);
  const [f, setF] = useState(2);
  const [A, setA] = useState(4);
  const [running, setRunning] = useState(() => !prefersReducedMotion());
  const [slow, setSlow] = useState(4);
  const [t, setT] = useState(0);
  const [markA, setMarkA] = useState(1);
  const [markB, setMarkB] = useState(6);
  const [measured, setMeasured] = useState('');
  const res = useMemo(() => ropeWave({ ropeId, tension, frequency: f, amplitude: A }), [ropeId, tension, f, A]);
  const raf = useRef<number | null>(null);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!running) { last.current = null; return; }
    const tick = (now: number) => {
      if (last.current !== null) setT((x) => x + (now - last.current!) / 1000 / slow);
      last.current = now;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [running, slow]);

  const W = 640, H = 220, mid = 110, pxPerM = (W - 40) / VIEW_M, pxPerCm = 7;
  const pts = Array.from({ length: 401 }, (_, i) => {
    const x = (VIEW_M * i) / 400;
    return `${20 + x * pxPerM},${mid - displacement(x, t, A, res.wavelength, f) * pxPerCm}`;
  }).join(' ');
  const markerX = (m: number) => 20 + m * pxPerM;
  const distance = Math.abs(markB - markA);
  const measuredValue = parseLocaleNumber(measured);

  const record = () => api.addTrial('cuerda', {
    cuerda: findRope(ropeId).name, tension, frecuencia: f, amplitud: A,
    lambdaMedida: Number.isFinite(measuredValue) ? measuredValue : Number(distance.toFixed(2)),
    lambda: Number(res.wavelength.toFixed(4)), periodo: Number(res.period.toFixed(4)), rapidez: Number(res.speed.toFixed(3)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="wave-t wave-d">
            <title id="wave-t">Onda en una cuerda con regla de medición</title>
            <desc id="wave-d">{`Onda de ${fmt(f, 2)} Hz y amplitud ${fmt(A, 1)} cm en la ${findRope(ropeId).name.toLowerCase()} con ${tension} N. Longitud de onda del modelo ${fmt(res.wavelength, 2)} m. Marcadores de la regla en ${fmt(markA, 2)} m y ${fmt(markB, 2)} m.`}</desc>
            <line x1="20" x2={W - 20} y1={mid} y2={mid} stroke="var(--line)" strokeDasharray="4 4" />
            <rect x="4" y={mid - A * pxPerCm - 6} width="14" height={2 * A * pxPerCm + 12} rx="3" fill="var(--surface-2)" stroke="var(--ink-2)" />
            <polyline points={pts} fill="none" stroke="var(--data)" strokeWidth="3" strokeLinejoin="round" />
            <circle cx={20 + 3 * pxPerM} cy={mid - displacement(3, t, A, res.wavelength, f) * pxPerCm} r="6" fill="var(--fis)" stroke="var(--surface)" strokeWidth="2">
              <title>Punto marcado a 3 m: sube y baja, pero no avanza</title>
            </circle>
            {/* Regla */}
            <line x1="20" x2={W - 20} y1={H - 30} y2={H - 30} stroke="var(--ink-2)" />
            {Array.from({ length: VIEW_M * 2 + 1 }, (_, i) => i / 2).map((m) => (
              <g key={m}>
                <line x1={markerX(m)} x2={markerX(m)} y1={H - 30} y2={H - 30 + (m % 1 === 0 ? 10 : 5)} stroke="var(--ink-2)" />
                {m % 1 === 0 && <text x={markerX(m)} y={H - 8} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{m}</text>}
              </g>
            ))}
            {[markA, markB].map((m, i) => (
              <g key={i}>
                <line x1={markerX(m)} x2={markerX(m)} y1="10" y2={H - 30} stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 3" />
                <text x={markerX(m)} y="10" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--accent)', fontWeight: 700 }}>{i === 0 ? 'A' : 'B'}</text>
              </g>
            ))}
            <text x={W - 20} y="24" textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>t = {fmt(t, 2)} s {running && slow > 1 ? `(cámara lenta ×${slow})` : ''}</text>
          </svg>
        </div>
        <div className="card stack-sm">
          <h3>Mide la longitud de onda</h3>
          <p className="small">Pausa la onda y coloca los marcadores A y B sobre dos crestas consecutivas. La distancia entre ellos es tu medida de λ.</p>
          <div className="grid-2" style={{ gap: 8 }}>
            <Slider label="Marcador A" value={markA} min={0} max={VIEW_M} step={0.05} unit="m" decimals={2} onChange={setMarkA} />
            <Slider label="Marcador B" value={markB} min={0} max={VIEW_M} step={0.05} unit="m" decimals={2} onChange={setMarkB} />
          </div>
          <div className="btn-row">
            <span className="small">Distancia A–B: <strong className="num">{fmt(distance, 2)} m</strong></span>
            <label htmlFor="lambda-med" className="small">λ medida (m):</label>
            <input id="lambda-med" type="text" inputMode="decimal" value={measured} placeholder={fmt(distance, 2)} onChange={(e) => setMeasured(e.target.value)} style={{ maxWidth: 110 }} />
            <button type="button" className="btn small" onClick={() => setMeasured(fmt(distance, 2))}>Usar distancia A–B</button>
          </div>
          {Number.isFinite(measuredValue) && measured !== '' && (
            <p className="small" role="status">
              Error de tu medida: {fmt(Math.abs(measuredValue - res.wavelength) / res.wavelength * 100, 1)} %. {Math.abs(measuredValue - res.wavelength) / res.wavelength < 0.05 ? '¡Buena medición!' : 'Revisa que A y B estén en dos crestas consecutivas.'}
            </p>
          )}
        </div>
        <Readout items={[
          { k: 'Rapidez v = √(T/μ)', v: `${fmt(res.speed, 2)} m/s`, data: true },
          { k: 'Periodo T = 1/f', v: `${fmt(res.period, 3)} s` },
          { k: 'λ del modelo (oculta hasta medir)', v: measured !== '' ? `${fmt(res.wavelength, 3)} m` : 'mide primero' },
          { k: 'Energía relativa (∝ A²f²)', v: fmt(res.relativeEnergy, 0) },
        ]} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Generador y cuerda</h3>
          <Select label="Cuerda" value={ropeId} onChange={setRopeId} options={ROPES.map((r) => ({ value: r.id, label: `${r.name} · μ = ${fmt(r.mu, 2)} kg/m` }))} />
          <Slider label="Tensión" value={tension} min={WAVE_LIMITS.tension[0]} max={WAVE_LIMITS.tension[1]} step={1} unit="N" decimals={0} onChange={setTension} />
          <Slider label="Frecuencia" value={f} min={WAVE_LIMITS.frequency[0]} max={WAVE_LIMITS.frequency[1]} step={0.25} unit="Hz" decimals={2} onChange={setF} />
          <Slider label="Amplitud" value={A} min={WAVE_LIMITS.amplitude[0]} max={WAVE_LIMITS.amplitude[1]} step={0.5} unit="cm" decimals={1} onChange={setA} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => setRunning((r) => !r)}>{running ? 'Pausar' : 'Reanudar'}</button>
            <button type="button" className="btn" onClick={() => setT(0)}>Reiniciar tiempo</button>
          </div>
          <Select label="Velocidad de la animación" value={String(slow)} onChange={(v) => setSlow(Number(v))} options={[{ value: '1', label: 'Tiempo real' }, { value: '4', label: 'Cámara lenta ×4' }, { value: '10', label: 'Cámara lenta ×10' }]} />
          <RecordButton onRecord={record} />
        </div>
        <Notice>El punto azul sube y baja en su sitio: la onda transporta energía, no materia. La cámara lenta solo cambia la animación, no los valores calculados.</Notice>
      </div>
    </div>
  );
}

const NOTES = [{ label: 'La₄ (diapasón)', f: 440 }, { label: 'Do₄', f: 261.6 }, { label: 'Voz grave', f: 120 }, { label: 'Silbido', f: 2000 }, { label: 'Límite inferior del oído', f: 20 }, { label: 'Límite superior del oído', f: 20000 }];

function SoundPart({ api }: LabProps) {
  const [freq, setFreq] = useState(440);
  const [temp, setTemp] = useState(20);
  const res = soundWave({ frequency: freq, temperature: temp });
  const record = () => api.addTrial('sonido', { temperatura: temp, frecuencia: freq, rapidez: Number(res.speed.toFixed(2)), lambda: Number(res.wavelength.toFixed(5)), rango: res.range });
  return (
    <div className="lab-layout">
      <div className="stack">
        <Readout items={[
          { k: 'Rapidez del sonido', v: `${fmt(res.speed, 1)} m/s`, data: true },
          { k: 'Longitud de onda', v: res.wavelength >= 1 ? `${fmt(res.wavelength, 2)} m` : `${fmt(res.wavelength * 100, 2)} cm`, data: true },
          { k: 'Periodo', v: `${fmt(res.period * 1000, 3)} ms` },
          { k: 'Rango', v: res.range },
        ]} />
        <div className="card stack-sm">
          <h3>Comparación de tamaños</h3>
          <p className="small">Una longitud de onda de {fmt(res.wavelength, 3)} m es {res.wavelength > 1.7 ? 'mayor que la estatura de una persona' : res.wavelength > 0.2 ? 'del tamaño de una mesa o un brazo' : res.wavelength > 0.02 ? 'del tamaño de una mano o un dedo' : 'menor que un dedo'}.</p>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Fuente sonora</h3>
          <Slider label="Frecuencia" value={freq} min={WAVE_LIMITS.soundFrequency[0]} max={WAVE_LIMITS.soundFrequency[1]} step={10} unit="Hz" decimals={0} onChange={setFreq} />
          <div className="btn-row">{NOTES.map((nn) => <button key={nn.label} type="button" className="btn small" onClick={() => setFreq(nn.f)}>{nn.label}</button>)}</div>
          <Slider label="Temperatura del aire" value={temp} min={WAVE_LIMITS.airTemperature[0]} max={WAVE_LIMITS.airTemperature[1]} step={1} unit="°C" decimals={0} onChange={setTemp} />
          <RecordButton onRecord={record} />
        </div>
        <Notice>Aire seco; v ≈ 331,3 + 0,606·T. El laboratorio no reproduce audio.</Notice>
      </div>
    </div>
  );
}

export default function WavesLab(props: LabProps) {
  const [tab, setTab] = useState<'cuerda' | 'sonido'>('cuerda');
  return (
    <div className="stack">
      <Segmented label="Experimento" value={tab} onChange={setTab} options={[{ value: 'cuerda', label: 'Onda en una cuerda' }, { value: 'sonido', label: 'Sonido en el aire' }]} />
      {tab === 'cuerda' ? <RopePart {...props} /> : <SoundPart {...props} />}
    </div>
  );
}
