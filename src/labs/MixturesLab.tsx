import { useMemo, useState } from 'react';
import { applyMethod, COMPONENTS, evaluate, initialState, METHODS, MIXTURE_LIMITS, type ComponentId, type Masses, type MethodId, type MixtureState } from '../models/mixtures';
import { fmt } from '../lib/format';
import { Notice, RecordButton, Slider } from '../components/ui';
import type { LabProps } from './registry';

const DEFAULT: Masses = { hierro: 5, arena: 5, sal: 5, aserrin: 0, aceite: 0 };

function Beaker({ s }: { s: MixtureState }) {
  const v = s.vessel;
  const has = (k: ComponentId) => v[k] > 0.01;
  const waterH = s.water > 0 ? Math.min(150, 40 + s.water / 3) : 0;
  const bottom = 230;
  const sandH = has('arena') ? 6 + v.arena * 2 : 0;
  return (
    <svg viewBox="0 0 240 250"  role="img" className="beaker" aria-label={`Vaso: ${COMPONENTS.filter((c) => has(c.id)).map((c) => `${c.name.toLowerCase()} ${fmt(v[c.id], 1)} g`).join(', ') || 'vacío'}${s.water ? `, ${fmt(s.water, 0)} g de agua` : ''}.`} style={{ maxWidth: 260 }}>
      <path d="M40 30 L40 230 Q40 242 52 242 L188 242 Q200 242 200 230 L200 30" fill="none" stroke="var(--ink-2)" strokeWidth="3" />
      {s.water > 0 && <rect x="42" y={bottom - waterH} width="156" height={waterH + 10} fill={has('sal') ? 'rgba(120,180,230,0.42)' : 'rgba(120,180,230,0.3)'} />}
      {has('aceite') && <rect x="42" y={bottom - waterH - (s.water > 0 ? 0 : -waterH) - v.aceite * 1.6} width="156" height={v.aceite * 1.6} fill="rgba(232,195,58,0.75)" />}
      {sandH > 0 && <rect x="42" y={bottom + 10 - sandH} width="156" height={sandH} fill="#d9b26f" />}
      {has('hierro') && Array.from({ length: Math.ceil(v.hierro * 4) }, (_, i) => <circle key={i} cx={50 + ((i * 37) % 140)} cy={bottom + 6 - sandH - 2 - (i % 3) * 2} r="1.8" fill="#4a4f57" />)}
      {has('aserrin') && Array.from({ length: Math.ceil(v.aserrin * 4) }, (_, i) => <rect key={i} x={50 + ((i * 29) % 140)} y={(s.water > 0 ? bottom - waterH - (has('aceite') ? v.aceite * 1.6 : 0) - 4 : bottom + 4 - sandH - 8) + (i % 2) * 2} width="5" height="2" fill="#9c6a3a" />)}
      {s.water === 0 && has('sal') && Array.from({ length: Math.ceil(v.sal * 3) }, (_, i) => <rect key={i} x={52 + ((i * 41) % 136)} y={bottom + 2 - sandH - (i % 4) * 2} width="3" height="3" fill="#fafafa" stroke="#bbb" strokeWidth="0.5" />)}
      <text x="120" y="20" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>Mezcla{s.water > 0 ? ' con agua' : ''}</text>
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
  const apply = (m: MethodId) => { setState((s) => applyMethod(s, m, { water, power })); setSteps((st) => [...st, m]); };
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
          <Beaker s={state} />
          <div className="stack-sm" aria-live="polite">
            <strong className="small">Fracciones separadas</strong>
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
