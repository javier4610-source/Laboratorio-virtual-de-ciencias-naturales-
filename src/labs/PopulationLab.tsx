import { useMemo, useState } from 'react';
import { POPULATION_LIMITS, simulatePopulation } from '../models/population';
import { fmt } from '../lib/format';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Slider } from '../components/ui';
import type { LabProps } from './registry';

/* ------------------------------------------------------------------ ciénaga ilustrada */

const SW = 640, SH = 270, WATER_TOP = 92, WATER_BOTTOM = 236;
const MAX_FISH = 90;

/** Pez (bocachico estilizado) centrado en (0, 0), mirando a la derecha. */
function Fish({ tone }: { tone: number }) {
  const body = ['url(#pop-fish-a)', 'url(#pop-fish-b)', 'url(#pop-fish-c)'][tone % 3];
  return (
    <g>
      <path d="M-11 0 L-19 -7 Q -17 0 -19 7 Z" fill="#7d8b93" stroke="#4a5960" strokeWidth="0.7" />
      <path d="M-12 0 Q -4 -9 8 -6 Q 15 -3 15 0 Q 15 3 8 6 Q -4 9 -12 0 Z" fill={body} stroke="#46545b" strokeWidth="0.8" />
      <path d="M-4 -7 Q 0 -12 5 -6.5 Z" fill="#8e9ba2" stroke="#46545b" strokeWidth="0.5" />
      <path d="M-1 4.5 Q 1 9 4 5" fill="#e0894a" opacity="0.9" />
      <path d="M-8 -1 Q 2 -3.5 12 -1" stroke="#ffffff" strokeWidth="0.9" fill="none" opacity="0.55" />
      <path d="M6 -4.8 Q 4 0 6 4.8" stroke="#46545b" strokeWidth="0.6" fill="none" opacity="0.6" />
      <circle cx="10" cy="-1.4" r="1.6" fill="#fff" />
      <circle cx="10.3" cy="-1.4" r="0.9" fill="#1b1b1b" />
    </g>
  );
}

function Reeds({ x, flip }: { x: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} 0)${flip ? ' scale(-1 1)' : ''}`} aria-hidden="true">
      {[0, 7, 14, 21, 28, 36].map((d, i) => (
        <g key={d}>
          <path d={`M${d} ${WATER_TOP + 14} Q ${d + 3} ${WATER_TOP - 30} ${d + (i % 2 ? 9 : -4)} ${WATER_TOP - 52 + (i % 3) * 10}`} stroke="#4f8a3a" strokeWidth="2.4" fill="none" strokeLinecap="round" />
          {i % 2 === 0 && <ellipse cx={d + (i % 2 ? 8 : -3)} cy={WATER_TOP - 46 + (i % 3) * 10} rx="2.6" ry="7" fill="#7a5532" />}
        </g>
      ))}
    </g>
  );
}

/** Ciénaga con un pez por cada `unit` individuos de la población al final de la simulación. */
function Swamp({ n, k, h, years }: { n: number; k: number; h: number; years: number }) {
  const unit = useMemo(() => {
    const raw = k / 30;
    const mag = 10 ** Math.floor(Math.log10(Math.max(1, raw)));
    return [1, 2, 5, 10].map((m) => m * mag).find((v) => v >= raw) ?? raw;
  }, [k]);
  const want = Math.max(0, Math.round(n / unit));
  const shown = Math.min(MAX_FISH, want);
  const fish = useMemo(() => {
    const frac = (v: number) => v - Math.floor(v);
    return Array.from({ length: MAX_FISH }, (_, i) => {
      const rx = frac(Math.sin(i * 91.7 + 3.1) * 43758.55);
      const ry = frac(Math.sin(i * 47.3 + 1.7) * 24634.63);
      return {
        x: 70 + rx * (SW - 140),
        y: WATER_TOP + 22 + ry * (WATER_BOTTOM - WATER_TOP - 40),
        dir: i % 3 === 0 ? -1 : 1,
        s: 0.85 + frac(rx * 7.3) * 0.4,
        tone: i,
      };
    });
  }, []);
  return (
    <svg viewBox={`0 0 ${SW} ${SH}`} role="img" aria-labelledby="pop-sw-t pop-sw-d">
      <title id="pop-sw-t">Ciénaga con la población de peces al final del tiempo simulado</title>
      <desc id="pop-sw-d">{`Se dibujan ${shown} peces; cada uno representa ${fmt(unit, 0)} individuos.${want > MAX_FISH ? ' La población es mayor de lo que cabe en el dibujo.' : ''}${h > 0 ? ' Una canoa de pesca indica que hay captura.' : ''}`}</desc>
      <defs>
        <linearGradient id="pop-water" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--fis)', stopOpacity: 0.28 }} />
          <stop offset="1" style={{ stopColor: 'var(--bio)', stopOpacity: 0.34 }} />
        </linearGradient>
        <linearGradient id="pop-sky" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" style={{ stopColor: 'var(--fis)', stopOpacity: 0.12 }} />
          <stop offset="1" style={{ stopColor: 'var(--fis)', stopOpacity: 0.02 }} />
        </linearGradient>
        <linearGradient id="pop-fish-a" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#9fb0b8" /><stop offset="0.55" stopColor="#dfe7ea" /><stop offset="1" stopColor="#f4f1e6" /></linearGradient>
        <linearGradient id="pop-fish-b" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#8a9aa3" /><stop offset="0.55" stopColor="#cdd8dc" /><stop offset="1" stopColor="#efe9d8" /></linearGradient>
        <linearGradient id="pop-fish-c" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#a7a58f" /><stop offset="0.55" stopColor="#e2e0cc" /><stop offset="1" stopColor="#f5f0dd" /></linearGradient>
        <clipPath id="pop-water-clip"><path d={`M40 ${WATER_TOP} H${SW - 40} Q ${SW - 10} ${WATER_BOTTOM} ${SW / 2} ${WATER_BOTTOM + 8} Q 10 ${WATER_BOTTOM} 40 ${WATER_TOP} Z`} /></clipPath>
      </defs>
      <rect x="0" y="0" width={SW} height={SH} fill="url(#pop-sky)" />
      {/* orillas: suelo de la ribera alrededor de la cubeta */}
      <path d={`M0 ${WATER_TOP - 8} Q ${SW / 2} ${WATER_TOP - 18} ${SW} ${WATER_TOP - 8} V ${SH - 22} H0 Z`} fill="var(--amb)" opacity="0.2" />
      <path d={`M0 ${WATER_TOP - 8} Q ${SW / 2} ${WATER_TOP - 18} ${SW} ${WATER_TOP - 8}`} stroke="var(--bio)" strokeOpacity="0.45" strokeWidth="3" fill="none" />
      {/* manglar / bosque inundable al fondo */}
      {[60, 120, 190, 260, 470, 530, 590].map((x, i) => (
        <g key={x} opacity="0.2">
          <circle cx={x} cy={WATER_TOP - 26 - (i % 2) * 8} r={22 + (i % 3) * 5} fill="var(--bio)" />
          <path d={`M${x - 10} ${WATER_TOP} q 4 -14 10 -22 q 6 8 10 22`} stroke="var(--amb)" strokeWidth="2" fill="none" />
        </g>
      ))}
      <path d={`M40 ${WATER_TOP} H${SW - 40} Q ${SW - 10} ${WATER_BOTTOM} ${SW / 2} ${WATER_BOTTOM + 8} Q 10 ${WATER_BOTTOM} 40 ${WATER_TOP} Z`} fill="url(#pop-water)" stroke="var(--fis)" strokeOpacity="0.45" strokeWidth="1.5" />
      <g clipPath="url(#pop-water-clip)">
        {[0, 1, 2].map((r) => (
          <path key={r} d={`M30 ${WATER_TOP + 8 + r * 40} q 20 -5 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0 t 40 0`} stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1.2" fill="none" />
        ))}
        <path d={`M40 ${WATER_BOTTOM - 6} Q 160 ${WATER_BOTTOM - 22} 320 ${WATER_BOTTOM - 12} T ${SW - 40} ${WATER_BOTTOM - 8} V ${SH} H40 Z`} fill="var(--amb)" opacity="0.25" />
        {[110, 180, 300, 420, 510].map((x, i) => (
          <path key={x} d={`M${x} ${WATER_BOTTOM} q -6 -16 2 -30 q 8 14 2 30 M${x + 6} ${WATER_BOTTOM} q 6 -12 -1 -22`} stroke="var(--bio)" strokeOpacity={0.5 - i * 0.03} strokeWidth="2.2" fill="none" />
        ))}
        {fish.slice(0, shown).map((f, i) => (
          <g key={i} transform={`translate(${f.x} ${f.y}) scale(${f.dir * f.s} ${f.s})`}><Fish tone={f.tone} /></g>
        ))}
      </g>
      {/* flor de loto y lirios en la superficie */}
      {[[150, WATER_TOP + 4], [420, WATER_TOP + 6]].map(([x, y]) => (
        <g key={x}>
          <ellipse cx={x} cy={y} rx="14" ry="3.6" fill="#4f8a3a" opacity="0.85" />
          <circle cx={x + 3} cy={y - 3} r="3.4" fill="#f3a6c8" stroke="#c76d96" strokeWidth="0.6" />
        </g>
      ))}
      <Reeds x={22} />
      <Reeds x={SW - 22} flip />
      {h > 0 && (
        <g transform={`translate(${SW - 190} ${WATER_TOP - 2})`}>
          <path d="M-36 0 Q 0 14 36 0 Z" fill="#8a5a2b" stroke="#5b3a1a" strokeWidth="1" />
          <path d="M-30 1 H30" stroke="#b07a42" strokeWidth="1.2" />
          <circle cx="-6" cy="-17" r="4" fill="#7a4e2d" />
          <path d="M-12 -18 Q -6 -26 0 -18 Z" fill="#e2c46a" />
          <path d="M-6 -13 V -2" stroke="#2f6f8f" strokeWidth="5" strokeLinecap="round" />
          <path d="M-4 -10 L 14 -4" stroke="#7a4e2d" strokeWidth="2" strokeLinecap="round" />
          <path d="M14 -4 Q 30 10 26 30" stroke="var(--ink-2)" strokeWidth="0.8" fill="none" strokeDasharray="2 2" />
          <path d="M18 20 l 16 0 l -3 16 l -12 0 Z" fill="none" stroke="var(--ink-2)" strokeWidth="0.7" strokeDasharray="1.5 1.5" />
        </g>
      )}
      <g>
        <rect x="10" y="8" width="300" height="24" rx="12" fill="var(--surface)" stroke="var(--line)" />
        <text x="22" y="24" style={{ fontSize: 12.5, fill: 'var(--ink)', fontWeight: 700 }}>{`Año ${years} · cada pez = ${fmt(unit, 0)} individuos`}</text>
      </g>
      {want > MAX_FISH && (
        <g>
          <rect x={SW - 222} y="8" width="212" height="24" rx="12" fill="var(--surface)" stroke="var(--line)" />
          <text x={SW - 116} y="24" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)' }}>No caben todos: hay más peces</text>
        </g>
      )}
      <text x={SW / 2} y={SH - 8} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Ilustración de la ciénaga al final del tiempo simulado</text>
    </svg>
  );
}

export default function PopulationLab({ api }: LabProps) {
  const [model, setModel] = useState<'exponencial' | 'logistico'>('logistico');
  const [n0, setN0] = useState(20);
  const [r, setR] = useState(0.5);
  const [k, setK] = useState(1000);
  const [h, setH] = useState(0);
  const [years, setYears] = useState(50);
  const [compare, setCompare] = useState(true);
  const res = useMemo(() => simulatePopulation({ model, n0, r, k, h, years }), [model, n0, r, k, h, years]);
  const other = useMemo(() => simulatePopulation({ model: model === 'logistico' ? 'exponencial' : 'logistico', n0, r, k, h, years }), [model, n0, r, k, h, years]);
  const yMax = Math.max(k * 1.3, ...res.series.map((p) => Math.min(p.n, k * 3)));
  const clip = (pts: { t: number; n: number }[]) => pts.filter((p) => p.n <= yMax * 1.05).map((p) => ({ x: p.t, y: p.n }));

  const record = () => api.addTrial('escenarios', {
    modelo: model, n0, r, k, h, anios: years, nfinal: Number(res.finalN.toFixed(1)),
    equilibrio: Number.isFinite(res.equilibrium) ? Number(res.equilibrium.toFixed(1)) : null,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <Swamp n={res.finalN} k={k} h={h} years={years} />
        </div>
        <div className="card">
          <Chart title="Tamaño de la población de peces en el tiempo" xLabel="Tiempo (años)" yLabel="Individuos" height={300}
            xDomain={[0, years]} yDomain={[0, yMax]}
            hLines={model === 'logistico' || compare ? [{ y: k, label: `K = ${k}` }] : []}
            series={[
              { label: model === 'logistico' ? 'Logístico' : 'Exponencial', kind: 'line', points: clip(res.series) },
              ...(compare ? [{ label: model === 'logistico' ? 'Exponencial (comparación)' : 'Logístico (comparación)', kind: 'line' as const, dashed: true, points: clip(other.series) }] : []),
            ]} />
        </div>
        <Readout items={[
          { k: 'Población final', v: fmt(res.finalN, 0), data: true },
          { k: 'Equilibrio N*', v: Number.isFinite(res.equilibrium) ? fmt(res.equilibrium, 0) : 'sin límite (crece siempre)' },
          { k: 'Captura anual en equilibrio (h·N*)', v: Number.isFinite(res.equilibrium) ? fmt(h * res.equilibrium, 0) : '—' },
          { k: 'Tiempo de duplicación inicial', v: res.doublingTime ? `${fmt(res.doublingTime, 1)} años` : 'la población no crece' },
          { k: 'Tiempo hasta K/2', v: res.timeToHalfK !== null ? `${fmt(res.timeToHalfK, 1)} años` : 'no se alcanza' },
          { k: 'Estado', v: res.extinct ? 'Colapso (menos de 2 individuos)' : 'Población viable' },
        ]} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Parámetros</h3>
          <Segmented label="Modelo" value={model} onChange={setModel} options={[{ value: 'logistico', label: 'Logístico' }, { value: 'exponencial', label: 'Exponencial' }]} />
          <label className="check"><input type="checkbox" checked={compare} onChange={(e) => setCompare(e.target.checked)} /> Mostrar el otro modelo para comparar</label>
          <Slider label="Población inicial N₀" value={n0} min={POPULATION_LIMITS.n0[0]} max={POPULATION_LIMITS.n0[1]} step={1} decimals={0} onChange={setN0} />
          <Slider label="Tasa de crecimiento r" value={r} min={POPULATION_LIMITS.r[0]} max={POPULATION_LIMITS.r[1]} step={0.05} unit="/año" decimals={2} onChange={setR} />
          <Slider label="Capacidad de carga K" value={k} min={POPULATION_LIMITS.k[0]} max={POPULATION_LIMITS.k[1]} step={50} decimals={0} onChange={setK} />
          <Slider label="Tasa de pesca h" value={h} min={POPULATION_LIMITS.h[0]} max={POPULATION_LIMITS.h[1]} step={0.05} unit="/año" decimals={2} onChange={setH} />
          <Slider label="Tiempo simulado" value={years} min={POPULATION_LIMITS.years[0]} max={POPULATION_LIMITS.years[1]} step={5} unit="años" decimals={0} onChange={setYears} />
          <RecordButton onRecord={record} />
        </div>
        <Notice>Modelo determinista con parámetros ilustrativos: no incluye azar demográfico, migración ni variaciones del ambiente.</Notice>
      </div>
    </div>
  );
}
