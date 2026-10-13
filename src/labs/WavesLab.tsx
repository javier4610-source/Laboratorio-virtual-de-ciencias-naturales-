import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { displacement, findRope, ropeWave, ROPES, soundWave, WAVE_LIMITS } from '../models/waves';
import { fmt, parseLocaleNumber } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { usePublishModel } from '../components/Advanced';
import { BenchTop, ContactShadow } from './kit';
import { DragHandle, Knob, ManipHint, ManipScene } from './manipulate';

const VIEW_M = 12; // metros de cuerda visibles
const WX0 = 74, WX1 = 590;
const WPX = (WX1 - WX0) / VIEW_M;
const ROPE_LOOK: Record<string, { core: string; edge: string; w: number; links?: boolean }> = {
  liviana: { core: '#f2f4f5', edge: '#7d8a8f', w: 2.2 },
  media: { core: '#d9b77e', edge: '#7c5b2c', w: 3.6 },
  pesada: { core: '#b7c1c5', edge: '#4f5a5e', w: 5, links: true },
};

/** Regla de madera de 12 m (escala reducida) con divisiones cada 10 cm. Estática: se memoriza. */
const WaveRuler = memo(function WaveRuler() {
  const x = (m: number) => WX0 + m * WPX;
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={WX0 - 10} y={200} width={WX1 - WX0 + 20} height={24} rx={3} fill="url(#kit-wood)" stroke="#b8975a" />
      </g>
      {Array.from({ length: VIEW_M * 10 + 1 }, (_, k) => (
        <g key={k}>
          <line x1={x(k / 10)} x2={x(k / 10)} y1={200} y2={200 + (k % 10 === 0 ? 10 : k % 5 === 0 ? 7 : 3.5)} stroke="#4d3b1c" strokeWidth={k % 10 === 0 ? 1.1 : 0.6} />
          {k % 10 === 0 && <text x={x(k / 10)} y={220} textAnchor="middle" style={{ fontSize: 10, fill: '#4d3b1c', fontFamily: 'var(--font-data)' }}>{k / 10}</text>}
        </g>
      ))}
      <text x={WX1 + 6} y={220} style={{ fontSize: 8, fill: '#7a6334' }}>m</text>
    </g>
  );
});

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
  usePublishModel(() => ({
    vars: {
      v: { sym: 'v', name: 'Rapidez de la onda', value: res.speed, unit: 'm/s', decimals: 2 },
      T: { sym: 'F_{T}', name: 'Tensión de la cuerda', value: tension, unit: 'N', decimals: 0 },
      mu: { sym: '\\mu', name: 'Densidad lineal de la cuerda', value: findRope(ropeId).mu, unit: 'kg/m', decimals: 2 },
      f: { sym: 'f', name: 'Frecuencia', value: f, unit: 'Hz', decimals: 2 },
      lam: { sym: '\\lambda', name: 'Longitud de onda', value: res.wavelength, unit: 'm', decimals: 3 },
      P: { sym: 'T', name: 'Período', value: res.period, unit: 's', decimals: 3 },
    },
    equations: [
      { title: 'Rapidez en una cuerda tensa', lhs: 'v', expr: '\\sqrt{\\frac{[T]}{[mu]}}' },
      { title: 'Ecuación de la onda', lhs: 'lam', expr: '\\frac{[v]}{[f]}', note: 'La frecuencia la fija el generador; la rapidez, la cuerda.' },
      { title: 'Período', lhs: 'P', expr: '\\frac{1}{[f]}' },
    ],
  }), [res, tension, ropeId, f]);
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

  const W = 640, H = 246, mid = 110, X0 = WX0, X1 = WX1, pxPerM = WPX, pxPerCm = 7;
  const pts = Array.from({ length: 401 }, (_, i) => {
    const x = (VIEW_M * i) / 400;
    return `${X0 + x * pxPerM},${mid - displacement(x, t, A, res.wavelength, f) * pxPerCm}`;
  }).join(' ');
  const markerX = (m: number) => X0 + m * pxPerM;
  const yStart = mid - displacement(0, t, A, res.wavelength, f) * pxPerCm;
  const yEnd = mid - displacement(VIEW_M, t, A, res.wavelength, f) * pxPerCm;
  const rope = ROPE_LOOK[ropeId] ?? ROPE_LOOK.media;
  const hangDiscs = Math.max(1, Math.min(8, Math.round(tension / 10)));
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
          <ManipScene viewBox={`0 0 ${W} ${H}`} label="Controles del generador y de la regla" scene={
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="wave-t wave-d">
            <title id="wave-t">Onda en una cuerda con regla de medición</title>
            <desc id="wave-d">{`Onda de ${fmt(f, 2)} Hz y amplitud ${fmt(A, 1)} cm en la ${findRope(ropeId).name.toLowerCase()} con ${tension} N. Longitud de onda del modelo ${fmt(res.wavelength, 2)} m. Marcadores de la regla en ${fmt(markA, 2)} m y ${fmt(markB, 2)} m.`}</desc>
            <BenchTop y={226} width={W} />
            {/* generador de vibraciones */}
            <ContactShadow x={6} y={226} w={48} h={7} />
            <g filter="url(#kit-shadow)">
              <rect x={6} y={52} width={48} height={174} rx={7} fill="url(#kit-body-dark)" />
            </g>
            <rect x={11} y={62} width={38} height={22} rx={3} fill="url(#kit-lcd)" stroke="#05100d" />
            <text x={45} y={77} textAnchor="end" style={{ fontSize: 10, fill: '#7CFFB2', fontFamily: 'var(--font-data)' }}>{fmt(f, 2)}</text>
            <text x={30} y={96} textAnchor="middle" style={{ fontSize: 8, fill: '#c9d2d5', fontWeight: 700 }}>Hz</text>
            <circle cx={30} cy={146} r={2.4} fill={running ? '#66bb6a' : '#ffb300'} />
            <text transform="translate(33 196) rotate(-90)" textAnchor="middle" style={{ fontSize: 8, fill: '#c9d2d5', letterSpacing: 1 }}>GENERADOR</text>
            {/* guía y pinza que vibra */}
            <rect x={58} y={mid - 80} width={5} height={160} rx={2} fill="url(#kit-metal-h)" />
            <rect x={56} y={mid + 80} width={9} height={226 - mid - 80} fill="url(#kit-body-dark)" />
            <rect x={60} y={yStart - 6} width={14} height={12} rx={2} fill="#2f393c" stroke="#11171a" />
            <circle cx={67} cy={yStart} r={1.8} fill="url(#kit-metal)" />
            {/* polea y pesas que dan la tensión */}
            <rect x={603} y={mid} width={5} height={218 - mid} fill="url(#kit-metal-h)" />
            <rect x={594} y={216} width={24} height={10} rx={2} fill="url(#kit-body-dark)" />
            <line x1={619} x2={619} y1={mid} y2={mid + 44} stroke={rope.edge} strokeWidth={Math.max(2, rope.w - 1)} />
            <path d={`M612 ${mid + 44} q7 -6 14 0`} fill="none" stroke="#5d6b70" strokeWidth="1.6" />
            <rect x={617.5} y={mid + 44} width={3} height={hangDiscs * 5 + 6} fill="url(#kit-metal-h)" />
            {Array.from({ length: hangDiscs }, (_, k) => (
              <rect key={k} x={607} y={mid + 50 + k * 5} width={24} height={4.4} rx={1.2} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="0.6" />
            ))}
            <text x={619} y={mid + 66 + hangDiscs * 5} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{tension} N</text>
            <circle cx={606} cy={mid} r={13} fill="url(#kit-metal)" stroke="#6d7b80" strokeWidth="1.2" filter="url(#kit-shadow-soft)" />
            <circle cx={606} cy={mid} r={8} fill="none" stroke="#9aa5a9" />
            <circle cx={606} cy={mid} r={2.5} fill="#3a4448" />
            {/* posición de equilibrio */}
            <line x1={X0} x2={X1} y1={mid} y2={mid} stroke="var(--line)" strokeDasharray="4 4" />
            {/* cuerda */}
            <line x1={X1} x2={606} y1={yEnd} y2={mid - 13} stroke={rope.edge} strokeWidth={rope.w + 1.6} strokeLinecap="round" />
            <line x1={X1} x2={606} y1={yEnd} y2={mid - 13} stroke={rope.core} strokeWidth={rope.w} strokeLinecap="round" />
            <path d={`M606 ${mid - 13} A13 13 0 0 1 619 ${mid}`} fill="none" stroke={rope.core} strokeWidth={rope.w} />
            <polyline points={pts} fill="none" stroke={rope.edge} strokeWidth={rope.w + 1.6} strokeLinejoin="round" strokeLinecap="round" />
            <polyline points={pts} fill="none" stroke={rope.core} strokeWidth={rope.w} strokeLinejoin="round" strokeLinecap="round" />
            {rope.links
              ? <polyline points={pts} fill="none" stroke={rope.edge} strokeWidth={rope.w - 2.4} strokeDasharray="3.5 2.5" strokeLinejoin="round" />
              : <polyline points={pts} fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="0.9" strokeLinejoin="round" transform="translate(0 -0.8)" />}
            <circle cx={X0 + 3 * pxPerM} cy={mid - displacement(3, t, A, res.wavelength, f) * pxPerCm} r="6" fill="var(--fis)" stroke="var(--surface)" strokeWidth="2">
              <title>Punto marcado a 3 m: sube y baja, pero no avanza</title>
            </circle>
            <WaveRuler />
            {[markA, markB].map((m, i) => (
              <g key={i}>
                <line x1={markerX(m)} x2={markerX(m)} y1="16" y2={200} stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 3" />
                <path d={`M${markerX(m)} 200 l-5 -8 h10 Z`} fill="var(--accent)" />
                <rect x={markerX(m) - 8} y={0} width={16} height={17} rx={4} fill="var(--accent-soft)" stroke="var(--accent)" strokeWidth="1" />
                <text x={markerX(m)} y="12.5" textAnchor="middle" style={{ fontSize: 11, fill: "var(--accent)", fontWeight: 700 }}>{i === 0 ? "A" : "B"}</text>
              </g>
            ))}
            <text x={W - 20} y="24" textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>t = {fmt(t, 2)} s {running && slow > 1 ? `(cámara lenta ×${slow})` : ''}</text>
          </svg>}>
            <Knob label="Perilla del generador: frecuencia" cx={30} cy={120} r={10} value={f} min={WAVE_LIMITS.frequency[0]} max={WAVE_LIMITS.frequency[1]} step={0.25} pageStep={1} unit="Hz" decimals={2} onChange={setF} />
            {([['A', markA, setMarkA], ['B', markB, setMarkB]] as const).map(([name, m, set]) => (
              <DragHandle key={name} label={`Marcador ${name} sobre la regla`} value={m} min={0} max={VIEW_M} step={0.05} pageStep={0.5} unit="m" decimals={2}
                orientation="horizontal" hit={{ x: markerX(m) - 9, y: 0, w: 18, h: 30 }}
                valueFromPoint={({ point, start, startValue }) => startValue + (point.x - start.x) / pxPerM} onChange={set} />
            ))}
          </ManipScene>
        </div>
        <ManipHint>Gira la perilla del generador para cambiar la frecuencia y arrastra las pestañas A y B por la regla, o enfócalas con Tab y usa las flechas.</ManipHint>
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
  usePublishModel(() => ({
    vars: {
      v: { sym: 'v', name: 'Rapidez del sonido', value: res.speed, unit: 'm/s', decimals: 1 },
      Tc: { sym: 'T_{C}', name: 'Temperatura del aire', value: temp, unit: '°C', decimals: 0 },
      f: { sym: 'f', name: 'Frecuencia', value: freq, unit: 'Hz', decimals: 0 },
      lam: { sym: '\\lambda', name: 'Longitud de onda', value: res.wavelength, unit: 'm', sig: 4 },
    },
    equations: [
      { title: 'Rapidez del sonido en el aire', lhs: 'v', expr: '331,3\\,\\text{m/s} + 0,606\\,\\text{m/(s·°C)}·[Tc]' },
      { title: 'Ecuación de la onda', lhs: 'lam', expr: '\\frac{[v]}{[f]}' },
    ],
  }), [res, temp, freq]);
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
