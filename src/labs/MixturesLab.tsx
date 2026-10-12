import { useMemo, useState } from 'react';
import { applyMethod, COMPONENTS, evaluate, initialState, METHODS, MIXTURE_LIMITS, type ComponentId, type Masses, type MethodId, type MixtureState } from '../models/mixtures';
import { fmt } from '../lib/format';
import { Notice, RecordButton, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { BenchTop, shade } from './kit';
import { playSound, type SoundName } from '../lib/sound';

/** Sonido de cada técnica: agitar con agua, imán que atrae limaduras, vertido, goteo del filtro, ebullición. */
const METHOD_SOUND: Record<MethodId, SoundName> = { agua: 'swirl', iman: 'clank', decantacion: 'pour', filtracion: 'drips', evaporacion: 'fizz' };

const DEFAULT: Masses = { hierro: 5, arena: 5, sal: 5, aserrin: 0, aceite: 0 };

/* Geometría del vaso principal (sobre trípode y rejilla) */
const BX = 70, BW = 140, BTOP = 52, BBOT = 192, BENCH = 272;
const IL = BX + 2, IR = BX + BW - 2, IB = BBOT - 2, IW = IR - IL;
const K = 0.72; // escala respecto al dibujo original del vaso
const beakerPath = `M${BX} ${BTOP} L${BX} ${BBOT - 8} Q${BX} ${BBOT} ${BX + 8} ${BBOT} L${BX + BW - 8} ${BBOT} Q${BX + BW} ${BBOT} ${BX + BW} ${BBOT - 8} L${BX + BW} ${BTOP}`;

/** Color dominante de una fracción separada (componente de mayor masa). */
const SHORT: Record<ComponentId, string> = { hierro: 'hierro', arena: 'arena', sal: 'sal', aserrin: 'aserrín', aceite: 'aceite' };

function fractionLook(masses: Masses) {
  let best = COMPONENTS[0], m = -1;
  for (const c of COMPONENTS) if (masses[c.id] > m) { m = masses[c.id]; best = c; }
  return best;
}

function MixtureBench({ s, last }: { s: MixtureState; last: MethodId | null }) {
  const v = s.vessel;
  const has = (k: ComponentId) => v[k] > 0.01;
  const waterH = s.water > 0 ? Math.min(118, (40 + s.water / 3) * K) : 0;
  const sandH = has('arena') ? (6 + v.arena * 2) * K : 0;
  const oilH = has('aceite') ? v.aceite * 1.6 * K : 0;
  const n = s.separated.length;
  const step = n > 0 ? Math.min(100, 300 / n) : 100;
  const dishW = Math.min(84, step - 10);
  const heating = last === 'evaporacion';
  return (
    <svg viewBox="0 0 640 300" role="img" aria-label={`Vaso: ${COMPONENTS.filter((c) => has(c.id)).map((c) => `${c.name.toLowerCase()} ${fmt(v[c.id], 1)} g`).join(', ') || 'vacío'}${s.water ? `, ${fmt(s.water, 0)} g de agua` : ''}.`} style={{ gridColumn: '1 / -1', minWidth: 520 }}>
      <defs>
        <clipPath id="mix-inner"><path d={`M${IL} ${BTOP} L${IL} ${IB - 7} Q${IL} ${IB} ${IL + 7} ${IB} L${IR - 7} ${IB} Q${IR} ${IB} ${IR} ${IB - 7} L${IR} ${BTOP} Z`} /></clipPath>
        <pattern id="mix-gauze" width="4" height="4" patternUnits="userSpaceOnUse"><path d="M0 0 L4 4 M4 0 L0 4" stroke="#6f7a7e" strokeWidth="0.6" /></pattern>
        <radialGradient id="mix-flame" cx="0.5" cy="0.85" r="0.8"><stop offset="0" stopColor="#bcd4ff" stopOpacity="0.95" /><stop offset="0.6" stopColor="#4d7dff" stopOpacity="0.7" /><stop offset="1" stopColor="#4d7dff" stopOpacity="0" /></radialGradient>
      </defs>
      <BenchTop y={BENCH} width={640} />
      {/* trípode, rejilla y mechero */}
      <g filter="url(#kit-shadow-soft)">
        <path d={`M${BX + 4} 198 L${BX - 14} ${BENCH}`} stroke="#4a5356" strokeWidth="4" strokeLinecap="round" />
        <path d={`M${BX + BW - 4} 198 L${BX + BW + 14} ${BENCH}`} stroke="#4a5356" strokeWidth="4" strokeLinecap="round" />
        <path d={`M${BX + BW / 2 + 22} 198 L${BX + BW / 2 + 26} ${BENCH - 4}`} stroke="#3a4245" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <rect x={BX - 10} y={192} width={BW + 20} height={6} rx={1.5} fill="url(#mix-gauze)" stroke="#5b6568" strokeWidth="0.8" />
        <ellipse cx={BX + BW / 2} cy={195} rx={34} ry={2.6} fill={heating ? '#f08a4b' : '#e9e4da'} opacity={heating ? 0.95 : 0.9} />
        <path d={`M${BX + BW / 2 - 22} ${BENCH} L${BX + BW / 2 + 22} ${BENCH} L${BX + BW / 2 + 16} ${BENCH - 10} L${BX + BW / 2 - 16} ${BENCH - 10} Z`} fill="url(#kit-metal)" stroke="#8f9a9e" />
        <rect x={BX + BW / 2 - 6} y={222} width={12} height={41} fill="url(#kit-metal-h)" stroke="#8f9a9e" strokeWidth="0.6" />
        <rect x={BX + BW / 2 - 7.5} y={242} width={15} height={7} rx={1.5} fill="url(#kit-metal)" stroke="#8f9a9e" strokeWidth="0.6" />
      </g>
      <path d={`M${BX + BW / 2 - 18} ${BENCH - 5} Q${BX + 20} ${BENCH - 4} ${BX - 30} ${BENCH - 2}`} fill="none" stroke="#d06a3a" strokeWidth="4" strokeLinecap="round" />
      {heating && (
        <g>
          <path d={`M${BX + BW / 2 - 9} 222 Q${BX + BW / 2 - 13} 206 ${BX + BW / 2} 196 Q${BX + BW / 2 + 13} 206 ${BX + BW / 2 + 9} 222 Z`} fill="url(#mix-flame)" />
          <path d={`M${BX + BW / 2 - 4.5} 222 Q${BX + BW / 2 - 6} 212 ${BX + BW / 2} 205 Q${BX + BW / 2 + 6} 212 ${BX + BW / 2 + 4.5} 222 Z`} fill="#2f5fe0" opacity="0.85" />
          {[0, 1, 2].map((i) => <path key={i} d={`M${BX + 40 + i * 30} 46 q-8 -10 0 -18 q8 -8 0 -18`} fill="none" stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round" opacity="0.35" />)}
        </g>
      )}
      {/* vaso principal con la mezcla */}
      <path d={beakerPath} fill="url(#kit-glass-fill)" />
      <g clipPath="url(#mix-inner)">
        {s.water > 0 && <rect x={IL} y={IB - waterH} width={IW} height={waterH} fill={has('sal') ? 'rgba(110,172,226,0.5)' : 'rgba(120,180,230,0.36)'} />}
        {s.water > 0 && <rect x={IL} y={IB - waterH} width={IW} height={waterH} fill="url(#kit-liquid-shade)" />}
        {oilH > 0 && <rect x={IL} y={IB - waterH - oilH} width={IW} height={oilH} fill="rgba(232,195,58,0.8)" />}
        {s.water > 0 && <line x1={IL} x2={IR} y1={IB - waterH - oilH} y2={IB - waterH - oilH} stroke={oilH > 0 ? '#b38f1f' : '#5a8fb8'} strokeWidth="1.3" opacity="0.8" />}
        {sandH > 0 && <rect x={IL} y={IB - sandH} width={IW} height={sandH} fill="#d9b26f" />}
        {sandH > 0 && Array.from({ length: 36 }, (_, i) => <circle key={i} cx={IL + 4 + ((i * 23) % (IW - 8))} cy={IB - 1.5 - ((i * 7) % Math.max(1, sandH - 3))} r="0.8" fill="#a8823f" opacity="0.8" />)}
        {has('hierro') && Array.from({ length: Math.ceil(v.hierro * 4) }, (_, i) => <rect key={i} x={IL + 5 + ((i * 37) % (IW - 10))} y={IB - sandH - 3 - (i % 3) * 1.6} width="2.6" height="1.3" fill="#3f444b" transform={`rotate(${(i * 47) % 180} ${IL + 6 + ((i * 37) % (IW - 10))} ${IB - sandH - 2.4 - (i % 3) * 1.6})`} />)}
        {has('aserrin') && Array.from({ length: Math.ceil(v.aserrin * 4) }, (_, i) => <rect key={i} x={IL + 6 + ((i * 29) % (IW - 12))} y={(s.water > 0 ? IB - waterH - oilH - 3 : IB - sandH - 5) + (i % 2) * 1.5} width="4.5" height="1.8" rx="0.6" fill="#9c6a3a" />)}
        {s.water === 0 && has('sal') && Array.from({ length: Math.ceil(v.sal * 3) }, (_, i) => <rect key={i} x={IL + 6 + ((i * 41) % (IW - 12))} y={IB - 3 - sandH - (i % 4) * 1.8} width="2.6" height="2.6" fill="#fafafa" stroke="#9aa5a9" strokeWidth="0.5" />)}
      </g>
      {last === 'agua' && <g><line x1={BX + BW - 22} y1={18} x2={BX + 46} y2={IB - 6} stroke="var(--glass-edge, #8fa9b3)" strokeWidth="4.5" strokeLinecap="round" /><line x1={BX + BW - 23} y1={20} x2={BX + 45} y2={IB - 8} stroke="#fff" strokeWidth="1.2" opacity="0.5" /></g>}
      <path d={`M${BX - 4} ${BTOP - 3} Q${BX} ${BTOP - 1} ${BX} ${BTOP + 4} ` + beakerPath.slice(beakerPath.indexOf('L'))} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.8" />
      <rect x={BX + 7} y={BTOP + 10} width={3.5} height={BBOT - BTOP - 26} rx={1.7} fill="#fff" opacity="0.4" />
      {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={BX + BW - 6} x2={BX + BW - 20} y1={BBOT - f * (BBOT - BTOP - 10)} y2={BBOT - f * (BBOT - BTOP - 10)} stroke="var(--glass-print, #24454a)" strokeWidth="1" opacity="0.7" />)}
      {/* herramienta del último método */}
      {last === 'iman' && (
        <g filter="url(#kit-shadow-soft)">
          <path d={`M${BX + BW / 2 - 22} 70 L${BX + BW / 2 - 22} 28 A22 22 0 0 1 ${BX + BW / 2 + 22} 28 L${BX + BW / 2 + 22} 70`} fill="none" stroke="#d23c35" strokeWidth="14" />
          <rect x={BX + BW / 2 - 29} y={60} width={14} height={14} fill="url(#kit-metal)" />
          <rect x={BX + BW / 2 + 15} y={60} width={14} height={14} fill="url(#kit-metal)" />
          {Array.from({ length: 70 }, (_, i) => { const px = BX + BW / 2 + (i % 2 ? 22 : -22) - 7 + ((i * 7) % 15), depth = 10 - Math.abs(((i * 7) % 15) - 7); const py = 75 + ((i * 13) % Math.max(2, depth)); return <rect key={i} x={px - 1.3} y={py - 0.7} width="2.8" height="1.3" fill="#3f444b" transform={`rotate(${70 + ((i * 37) % 40)} ${px} ${py})`} />; })}
        </g>
      )}
      {last === 'filtracion' && (
        <g>
          <rect x={BX + BW + 34} y={14} width={6} height={BENCH - 18} rx={2} fill="url(#kit-metal-h)" stroke="#8f9a9e" strokeWidth="0.6" />
          <rect x={BX + BW + 22} y={BENCH - 8} width={34} height={8} rx={2} fill="url(#kit-body-dark)" />
          <rect x={BX + BW / 2 + 44} y={36} width={BW / 2 - 6} height={5} fill="url(#kit-metal)" stroke="#8f9a9e" strokeWidth="0.6" />
          <path d={`M${BX + BW / 2 - 46} 22 L${BX + BW / 2 + 46} 22 L${BX + BW / 2 + 5} 64 L${BX + BW / 2 - 5} 64 Z`} fill="url(#kit-glass-fill)" />
          <path d={`M${BX + BW / 2 - 40} 25 L${BX + BW / 2 + 40} 25 L${BX + BW / 2} 62 Z`} fill="#fbfaf4" stroke="#d8d2c2" strokeWidth="0.8" />
          <path d={`M${BX + BW / 2 - 18} 45 L${BX + BW / 2 + 18} 45 L${BX + BW / 2} 62 Z`} fill="#d9b26f" />
          <path d={`M${BX + BW / 2 - 46} 22 L${BX + BW / 2 + 46} 22 L${BX + BW / 2 + 5} 64 L${BX + BW / 2 + 3} 104 L${BX + BW / 2 - 3} 104 L${BX + BW / 2 - 5} 64 Z`} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.5" />
          <circle cx={BX + BW / 2} cy={110} r={1.8} fill="rgba(110,172,226,0.9)" />
        </g>
      )}
      <text x={BX + BW / 2} y="292" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Mezcla{s.water > 0 ? ' con agua' : ''}</text>
      {/* fracciones separadas en vidrios de reloj, sobre una bandeja */}
      <rect x={316} y={BENCH - 5} width={312} height={6} rx={2} fill="url(#kit-body)" stroke="#a9b4b6" strokeWidth="0.8" filter="url(#kit-shadow-soft)" />
      {s.separated.map((f, i) => {
        const cx = 320 + step * i + step / 2;
        const c = fractionLook(f.masses);
        const total = COMPONENTS.reduce((a, k) => a + f.masses[k.id], 0);
        const hgt = 5 + Math.min(20, Math.sqrt(total) * 5);
        const w = dishW / 2;
        return (
          <g key={i}>
            <path d={`M${cx - w * 0.62} ${BENCH - 7} Q${cx} ${BENCH - 7 - hgt * 1.6} ${cx + w * 0.62} ${BENCH - 7} Z`} fill={c.color} stroke={shade(c.color, -0.3)} strokeWidth="0.7" />
            {c.id === 'hierro' && <path d={`M${cx - w * 0.4} ${BENCH - 8} Q${cx} ${BENCH - 7 - hgt * 1.2} ${cx + w * 0.4} ${BENCH - 8}`} fill="none" stroke="#8a9098" strokeWidth="0.8" strokeDasharray="1 2" />}
            {f.water > 0 && <path d={`M${cx - w * 0.62} ${BENCH - 7} Q${cx} ${BENCH - 7 - hgt * 1.6} ${cx + w * 0.62} ${BENCH - 7} Z`} fill="#2d5f8a" opacity="0.18" />}
            <path d={`M${cx - w} ${BENCH - 10} Q${cx} ${BENCH + 1} ${cx + w} ${BENCH - 10} Q${cx} ${BENCH - 3} ${cx - w} ${BENCH - 10} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />
            <circle cx={cx} cy={BENCH - 56} r={10} fill="var(--surface)" stroke="var(--line)" />
            <text x={cx} y={BENCH - 52} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink)' }}>{i + 1}</text>
            <text x={cx} y="292" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{SHORT[c.id]}</text>
          </g>
        );
      })}
      {n === 0 && <text x="470" y={BENCH - 30} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Vidrios de reloj para las fracciones</text>}
      {n === 0 && [400, 470, 540].map((cx) => <path key={cx} d={`M${cx - 26} ${BENCH - 8} Q${cx} ${BENCH + 3} ${cx + 26} ${BENCH - 8} Q${cx} ${BENCH - 1} ${cx - 26} ${BENCH - 8} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" />)}
    </svg>
  );
}

export default function MixturesLab({ api }: LabProps) {
  const [masses, setMasses] = useState<Masses>(DEFAULT);
  const [water, setWater] = useState(100);
  const [power, setPower] = useState(500);
  const [state, setState] = useState<MixtureState>(() => initialState(DEFAULT));
  const [steps, setSteps] = useState<MethodId[]>([]);
  const ev = useMemo(() => evaluate(state, masses), [state, masses]);
  const started = steps.length > 0;

  const reset = (m = masses) => { setState(initialState(m)); setSteps([]); };
  const setMass = (k: ComponentId, val: number) => { const m = { ...masses, [k]: val }; setMasses(m); reset(m); };
  const apply = (m: MethodId) => { setState((s) => applyMethod(s, m, { water, power })); setSteps((st) => [...st, m]); playSound(METHOD_SOUND[m], { duration: 0.9, intensity: 0.5 }); };
  const name = (m: MethodId) => METHODS.find((x) => x.id === m)!.name;
  const get = (id: ComponentId) => ev.find((e) => e.component.id === id);

  const record = () => api.addTrial('separaciones', {
    secuencia: steps.map(name).join(' → '), pasos: steps.length, agua: water, potencia: power,
    recSal: get('sal') ? Number(get('sal')!.recoveryPercent.toFixed(2)) : null,
    purezaSal: get('sal') ? Number(get('sal')!.purity.toFixed(2)) : null,
    purezaArena: get('arena') ? Number(get('arena')!.purity.toFixed(2)) : null,
    minutos: Number(state.minutes.toFixed(2)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 240px), 1fr))', alignItems: 'start' }}>
          <MixtureBench s={state} last={steps.length ? steps[steps.length - 1] : null} />
          <div className="stack-sm" aria-live="polite" style={{ gridColumn: '1 / -1', display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 220px), 1fr))' }}>
            <strong className="small" style={{ gridColumn: '1 / -1', minWidth: 520 }}>Fracciones separadas</strong>
            {state.separated.length === 0 && <p className="small muted">Aún no has separado nada.</p>}
            {state.separated.map((f, i) => (
              <div key={i} className="item card" style={{ padding: 8 }}>
                <div className="small"><strong>{i + 1}. {f.label}</strong></div>
                <div className="small">{COMPONENTS.filter((c) => f.masses[c.id] > 0.001).map((c) => `${c.name}: ${fmt(f.masses[c.id], 2)} g`).join(' · ')}{f.water > 0 ? ` · agua: ${fmt(f.water, 1)} g` : ''}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="card stack-sm">
          <h3>Bitácora</h3>
          {state.log.length === 0 ? <p className="small muted">Aplica un método para empezar.</p> : <ol className="list small">{state.log.map((l, i) => <li key={i}>{l}</li>)}</ol>}
          <p className="small">Secuencia: <strong>{steps.length ? steps.map(name).join(' → ') : '—'}</strong> · tiempo total {fmt(state.minutes, 1)} min</p>
        </div>
        <div className="table-wrap">
          <table>
            <caption>Recuperación y pureza (en la fracción donde más se recuperó cada componente)</caption>
            <thead><tr><th>Componente</th><th className="n">Inicial (g)</th><th className="n">Recuperado (g)</th><th className="n">Recuperación</th><th className="n">Pureza</th><th>Dónde</th></tr></thead>
            <tbody>{ev.map((e) => <tr key={e.component.id}><td>{e.component.name}</td><td className="n">{fmt(masses[e.component.id], 1)}</td><td className="n">{fmt(e.recovered, 2)}</td><td className="n">{fmt(e.recoveryPercent, 1)} %</td><td className="n">{e.recovered > 0 ? `${fmt(e.purity, 1)} %` : '—'}</td><td className="small">{e.where}</td></tr>)}</tbody>
          </table>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Mezcla inicial</h3>
          {COMPONENTS.map((c) => <Slider key={c.id} label={c.name} value={masses[c.id]} min={MIXTURE_LIMITS.mass[0]} max={MIXTURE_LIMITS.mass[1]} step={0.5} unit="g" decimals={1} onChange={(v) => setMass(c.id, v)} />)}
        </div>
        <div className="card stack">
          <h3>Métodos</h3>
          <Slider label="Agua a agregar" value={water} min={MIXTURE_LIMITS.water[0]} max={MIXTURE_LIMITS.water[1]} step={10} unit="g" decimals={0} onChange={setWater} />
          <Slider label="Potencia del mechero" value={power} min={MIXTURE_LIMITS.power[0]} max={MIXTURE_LIMITS.power[1]} step={50} unit="W" decimals={0} onChange={setPower} />
          <div className="stack-sm">
            {METHODS.map((m) => <button key={m.id} type="button" className="btn" onClick={() => apply(m.id)} title={m.description}>{m.name}</button>)}
          </div>
          <div className="btn-row"><button type="button" className="btn ghost" onClick={() => reset()}>Reiniciar mezcla</button></div>
          <RecordButton onRecord={record} disabled={!started} />
        </div>
        <Notice>Las pérdidas son ilustrativas: 3 % de la solución queda en el papel filtro y 2 % del aceite en el embudo.</Notice>
      </div>
    </div>
  );
}
