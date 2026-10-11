import { useEffect, useMemo, useRef, useState } from 'react';
import {
  BASE_EQUILIBRIUM, FOODWEB_DEFAULTS, FOODWEB_LIMITS, LEVEL_NAMES, LINKS, percentChange, simulateFoodWeb, SPECIES,
  type SpeciesId, type TrophicLevel,
} from '../models/foodweb';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import type { LabProps } from './registry';

const ANIM_MS = 2500;

/** Posición de cada nodo en el diagrama (los productores abajo, el depredador tope arriba). */
const NODE_POS: Record<SpeciesId, { x: number; y: number }> = {
  pastos: { x: 320, y: 318 },
  saltamontes: { x: 150, y: 232 },
  ratones: { x: 470, y: 232 },
  ranas: { x: 130, y: 132 },
  serpientes: { x: 330, y: 128 },
  gavilanes: { x: 540, y: 44 },
};
const ICON: Record<SpeciesId, string> = { pastos: '🌾', saltamontes: '🦗', ratones: '🐭', ranas: '🐸', serpientes: '🐍', gavilanes: '🦅' };
const LEVEL_COLOR: Record<TrophicLevel, string> = { productor: 'var(--bio)', herbivoro: 'var(--amb)', carnivoro: 'var(--fis)', tope: 'var(--bad)' };
const SERIES_COLOR: Record<SpeciesId, string> = {
  pastos: 'var(--series-3)', saltamontes: 'var(--series-6)', ratones: 'var(--series-8)', ranas: 'var(--series-5)', serpientes: 'var(--series-4)', gavilanes: 'var(--series-1)',
};
const NODE_W = 132, NODE_H = 52;
const LEVELS: TrophicLevel[] = ['tope', 'carnivoro', 'herbivoro', 'productor'];

/** Recorta una flecha entre centros para que empiece y termine en el borde de los rectángulos. */
function edgePoints(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = Math.min((NODE_W / 2 + 4) / Math.max(Math.abs(dx), 1e-9), (NODE_H / 2 + 4) / Math.max(Math.abs(dy), 1e-9));
  return { x1: a.x + dx * t, y1: a.y + dy * t, x2: b.x - dx * t, y2: b.y - dy * t };
}

const signed = (v: number, d = 1) => {
  const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return `${r > 0 ? '+' : ''}${fmt(r, d)}`;
};

export default function FoodWebLab({ api }: LabProps) {
  const [rain, setRain] = useState(FOODWEB_DEFAULTS.rain);
  const [hunting, setHunting] = useState(FOODWEB_DEFAULTS.hunting);
  const [pesticide, setPesticide] = useState(FOODWEB_DEFAULTS.pesticide);
  const [years, setYears] = useState(FOODWEB_DEFAULTS.years);
  const [view, setView] = useState<'red' | 'piramide'>('red');
  const [plot, setPlot] = useState<'relativa' | SpeciesId>('relativa');
  const [frame, setFrame] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const raf = useRef(0);

  const res = useMemo(() => simulateFoodWeb({ rain, hunting, pesticide, years }), [rain, hunting, pesticide, years]);
  const base = useMemo(() => simulateFoodWeb({ ...FOODWEB_DEFAULTS, years }), [years]);
  const change = useMemo(() => percentChange(res.finalRaw, base.finalRaw), [res, base]);
  const lastIndex = res.times.length - 1;

  const reset = () => { cancelAnimationFrame(raf.current); setRunning(false); setDone(false); setFrame(0); };
  useEffect(reset, [rain, hunting, pesticide, years]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setFrame(lastIndex); setRunning(false); setDone(true); return; }
    const start = performance.now();
    const tick = (now: number) => {
      const el = Math.max(0, now - start);
      if (el >= ANIM_MS) { setFrame(lastIndex); setRunning(false); setDone(true); return; }
      setFrame(Math.min(lastIndex, Math.max(0, Math.floor((el / ANIM_MS) * lastIndex))));
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, lastIndex]);

  const idx = Math.min(frame, lastIndex);
  const current = useMemo(() => Object.fromEntries(SPECIES.map((s) => [s.id, res.series[s.id][idx]])) as Record<SpeciesId, number>, [res, idx]);
  const levelNow = useMemo(() => {
    const l: Record<TrophicLevel, number> = { productor: 0, herbivoro: 0, carnivoro: 0, tope: 0 };
    for (const s of SPECIES) l[s.level] += current[s.id];
    return l;
  }, [current]);
  const tNow = res.times[idx];
  const started = running || done;

  const chartSeries = useMemo(() => {
    if (!started) return [];
    const pts = (id: SpeciesId, scale: (v: number) => number) => {
      const out: { x: number; y: number }[] = [];
      for (let i = 0; i <= idx; i += 2) out.push({ x: res.times[i], y: scale(res.series[id][i]) });
      if (idx % 2 === 1) out.push({ x: res.times[idx], y: scale(res.series[id][idx]) });
      return out;
    };
    if (plot === 'relativa') {
      return SPECIES.map((s) => ({ label: s.name, color: SERIES_COLOR[s.id], kind: 'line' as const, points: pts(s.id, (v) => (100 * v) / BASE_EQUILIBRIUM[s.id]) }));
    }
    const sp = SPECIES.find((s) => s.id === plot)!;
    return [{ label: sp.name, color: SERIES_COLOR[sp.id], kind: 'line' as const, points: pts(sp.id, (v) => v) }];
  }, [started, idx, res, plot]);
  const plotSpecies = plot === 'relativa' ? null : SPECIES.find((s) => s.id === plot)!;

  const record = () => api.addTrial('escenarios', {
    lluvia: rain, caza: hunting, pesticida: pesticide, anios: years,
    pastos: res.final.pastos, saltamontes: res.final.saltamontes, ratones: res.final.ratones,
    ranas: res.final.ranas, serpientes: res.final.serpientes, gavilanes: res.final.gavilanes,
  });

  const extinctNames = SPECIES.filter((s) => res.extinct.includes(s.id)).map((s) => s.name.toLowerCase());
  const pyrWidth = (v: number) => 40 + 120 * Math.log10(1 + Math.max(0, v) / 0.1);

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented label="Vista" value={view} onChange={setView} options={[{ value: 'red', label: 'Red alimentaria' }, { value: 'piramide', label: 'Pirámide de biomasa' }]} />
        <div className="bench">
          {view === 'red' ? (
            <svg viewBox="0 0 640 360" role="img" aria-labelledby="fw-t fw-d">
              <title id="fw-t">Red alimentaria de un potrero con borde de bosque en Urabá</title>
              <desc id="fw-d">
                {`Las flechas indican «es comido por» y van en la dirección del flujo de energía: pastos y semillas hacia saltamontes y ratones; saltamontes hacia ranas; ranas y ratones hacia serpientes; ratones y serpientes hacia gavilanes. `}
                {started ? `Año ${fmt(tNow, 1)} de la simulación.` : 'Biomasa inicial, antes de simular.'}
              </desc>
              <defs>
                <marker id="fw-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                  <path d="M0 0 L10 5 L0 10 Z" fill="var(--ink-2)" />
                </marker>
              </defs>
              {LINKS.map((l) => {
                const p = edgePoints(NODE_POS[l.prey], NODE_POS[l.predator]);
                return <line key={`${l.prey}-${l.predator}`} {...p} stroke="var(--ink-2)" strokeWidth="2" markerEnd="url(#fw-arrow)" />;
              })}
              {SPECIES.map((s) => {
                const { x, y } = NODE_POS[s.id];
                const rel = current[s.id] / BASE_EQUILIBRIUM[s.id];
                const barMax = NODE_W - 20;
                const barW = Math.max(0, Math.min(1.5, rel) / 1.5) * barMax;
                return (
                  <g key={s.id} transform={`translate(${x - NODE_W / 2} ${y - NODE_H / 2})`}>
                    <rect width={NODE_W} height={NODE_H} rx="8" fill="var(--surface)" stroke={LEVEL_COLOR[s.level]} strokeWidth="2.5" />
                    <text x="8" y="21" style={{ fontSize: 16 }} aria-hidden="true">{ICON[s.id]}</text>
                    <text x="30" y="20" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>{s.name}</text>
                    <rect x="10" y="30" width={barMax} height="8" rx="3" fill="var(--surface-2)" stroke="var(--line)" />
                    <rect x="10" y="30" width={barW} height="8" rx="3" fill={LEVEL_COLOR[s.level]} />
                    <line x1={10 + barMax / 1.5} x2={10 + barMax / 1.5} y1="27" y2="41" stroke="var(--ink)" strokeWidth="1.2" />
                    <text x="10" y="50" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(current[s.id], s.decimals)} kg/ha</text>
                  </g>
                );
              })}
              <text x="8" y="352" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Flecha: «es comido por» (flujo de energía). Barra: biomasa frente al equilibrio base (marca = 100 %).</text>
              {started && <text x="8" y="16" style={{ fontSize: 12, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>Año {fmt(tNow, 1)}</text>}
            </svg>
          ) : (
            <svg viewBox="0 0 640 300" role="img" aria-labelledby="fwp-t fwp-d">
              <title id="fwp-t">Pirámide de biomasa por niveles tróficos</title>
              <desc id="fwp-d">{`${started ? `Año ${fmt(tNow, 1)}` : 'Biomasa inicial'}: ${LEVELS.slice().reverse().map((l) => `${LEVEL_NAMES[l]} ${fmt(levelNow[l], l === 'tope' ? 3 : 1)} kg/ha`).join('; ')}. El ancho de cada barra está en escala logarítmica.`}</desc>
              {LEVELS.map((l, i) => {
                const w = pyrWidth(levelNow[l]);
                const y = 20 + i * 62;
                return (
                  <g key={l}>
                    <rect x={320 - w / 2} y={y} width={w} height="50" rx="4" fill={LEVEL_COLOR[l]} opacity="0.9" />
                    <text x="320" y={y + 21} textAnchor="middle" style={{ fontSize: 12, fontWeight: 700, fill: '#fff' }}>{w > 200 ? LEVEL_NAMES[l] : ''}</text>
                    <text x="320" y={y + 39} textAnchor="middle" style={{ fontSize: 12, fill: '#fff', fontFamily: 'var(--font-data)' }}>{w > 200 ? `${fmt(levelNow[l], l === 'tope' ? 3 : 1)} kg/ha` : ''}</text>
                    {w <= 200 && (
                      <text x={320 + w / 2 + 8} y={y + 30} style={{ fontSize: 12, fill: 'var(--ink)' }}>{`${LEVEL_NAMES[l]}: ${fmt(levelNow[l], l === 'tope' ? 3 : 1)} kg/ha`}</text>
                    )}
                  </g>
                );
              })}
              <text x="8" y="292" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>Ancho en escala logarítmica: cada nivel tiene muchísima menos biomasa que el de abajo (regla del 10 %).</text>
            </svg>
          )}
        </div>
        <div className="card stack">
          <Select label="Qué graficar" value={plot} onChange={(v) => setPlot(v as 'relativa' | SpeciesId)}
            options={[{ value: 'relativa', label: 'Todas las especies (% del equilibrio base)' }, ...SPECIES.map((s) => ({ value: s.id, label: `${s.name} (kg/ha)` }))]} />
          <Chart title={plotSpecies ? `Biomasa de ${plotSpecies.name.toLowerCase()} en el tiempo` : 'Biomasa de cada especie en el tiempo (porcentaje del equilibrio base)'}
            xLabel="Tiempo (años)" yLabel={plotSpecies ? 'Biomasa (kg/ha)' : 'Biomasa (% del equilibrio base)'}
            xDomain={[0, years]} series={chartSeries} height={300}
            hLines={plotSpecies ? [] : [{ y: 100, label: 'equilibrio base' }]}
            emptyText="Pulsa «Simular» para ver cómo cambia la biomasa." />
        </div>
        <Readout items={SPECIES.map((s) => ({ k: `${s.name} al final`, v: done ? `${fmt(res.final[s.id], s.decimals)} kg/ha` : '—', data: true }))} />
        <Readout items={SPECIES.map((s) => ({ k: `Cambio de ${s.name.toLowerCase()} frente al base`, v: done ? `${signed(change[s.id])} %` : '—' }))} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones del potrero</h3>
          <Slider label="Lluvia (% de lo normal)" value={rain} min={FOODWEB_LIMITS.rain[0]} max={FOODWEB_LIMITS.rain[1]} step={5} unit="%" decimals={0} onChange={setRain}
            hint={`Capacidad de carga del pasto: ${fmt(res.carryingCapacity, 0)} kg/ha`} />
          <Slider label="Caza de gavilanes (% por año)" value={hunting} min={FOODWEB_LIMITS.hunting[0]} max={FOODWEB_LIMITS.hunting[1]} step={5} unit="%/año" decimals={0} onChange={setHunting} />
          <Slider label="Pesticida sobre insectos (% por año)" value={pesticide} min={FOODWEB_LIMITS.pesticide[0]} max={FOODWEB_LIMITS.pesticide[1]} step={5} unit="%/año" decimals={0} onChange={setPesticide} />
          <Slider label="Años simulados" value={years} min={FOODWEB_LIMITS.years[0]} max={FOODWEB_LIMITS.years[1]} step={1} unit="años" decimals={0} onChange={setYears} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setFrame(0); setDone(false); setRunning(true); }} disabled={running}>Simular</button>
            <button type="button" className="btn" onClick={reset}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        {done && extinctNames.length > 0 && (
          <Notice kind="warn">Prácticamente desaparecieron (menos del 2 % de su biomasa base): {extinctNames.join(', ')}.</Notice>
        )}
        <Notice>
          El escenario base es lluvia 100 %, sin caza ni pesticida, con los mismos años. Parámetros ilustrativos: el 10 % de lo que come cada animal se convierte en biomasa nueva.
        </Notice>
      </div>
    </div>
  );
}
