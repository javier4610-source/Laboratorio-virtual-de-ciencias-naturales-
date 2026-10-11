import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CIN0, DIFFUSION_LIMITS, GLUCOSE_DETECTION_LIMIT, naclOsmolarity, OSMOSIS_LIMITS, simulateDiffusion, simulateOsmosis, type CellType,
} from '../models/osmosis';
import { seededRandom } from '../models/math';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Slider } from '../components/ui';
import type { LabProps } from './registry';
import { Beaker, BenchTop, Stopwatch } from './kit';

const STATE_TEXT: Record<string, string> = {
  'isotónica': 'Sin cambio apreciable de volumen',
  'normal': 'Sin cambio apreciable',
  'turgente': 'Turgente: el protoplasto presiona la pared',
  'hinchada': 'Hinchada: entró agua',
  'lisis': 'Lisis: la membrana se rompió',
  'crenada': 'Crenada: salió agua y la célula se arrugó',
  'plasmólisis': 'Plasmólisis: el protoplasto se separó de la pared',
};

function useDots(n: number, seed: number) {
  return useMemo(() => {
    const r = seededRandom(seed);
    return Array.from({ length: n }, () => ({ x: r(), y: r() }));
  }, [n, seed]);
}

/** Mezcla lineal de dos colores hexadecimales (t = 0 → a, t = 1 → b). */
function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [p(a), p(b)];
  const k = Math.max(0, Math.min(1, t));
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}

/* ------------------------------------------------------------ campo del microscopio (ósmosis) */
const OF = { cx: 220, cy: 158, r: 146 };

/** Contorno crenado (equinocito): elipse con pequeñas espículas redondeadas. */
function crenatedPath(cx: number, cy: number, rx: number, ry: number, amp: number) {
  const n = 20;
  const pt = (a: number, k: number) => `${(cx + Math.cos(a) * rx * k).toFixed(1)} ${(cy + Math.sin(a) * ry * k).toFixed(1)}`;
  let d = `M${pt(0, 1)}`;
  for (let i = 1; i <= n; i++) {
    const a = (i / n) * Math.PI * 2, am = ((i - 0.5) / n) * Math.PI * 2;
    d += ` Q${pt(am, 1 + amp * 2)} ${pt(a, 1)}`;
  }
  return `${d} Z`;
}

/** Glóbulo rojo visto al microscopio según su volumen relativo V. */
function RedCell({ V, lysed }: { V: number; lysed: boolean }) {
  const { cx, cy } = OF;
  const scale = Math.sqrt(V);
  if (lysed) {
    // «Fantasma» del eritrocito: membrana rota y hemoglobina dispersa en el medio.
    return (
      <g>
        <ellipse cx={cx} cy={cy} rx={84} ry={74} fill="#e8a3a0" opacity="0.22" />
        <g stroke="#a3271f" strokeWidth="2.4" fill="none" strokeLinecap="round" opacity="0.75">
          <path d={`M${cx - 74} ${cy - 18} q16 -46 62 -40`} /><path d={`M${cx + 18} ${cy - 64} q50 8 58 52`} />
          <path d={`M${cx + 70} ${cy + 22} q-12 44 -62 46`} /><path d={`M${cx - 26} ${cy + 66} q-46 -8 -52 -52`} />
        </g>
        {[[-40, -50, 5], [52, -30, 4], [60, 52, 6], [-58, 40, 4], [8, 82, 3], [-92, -4, 3]].map(([dx, dy, r], i) => (
          <circle key={i} cx={cx + dx} cy={cy + dy} r={r} fill="#c9443d" opacity="0.35" />
        ))}
      </g>
    );
  }
  const rx = 66 * scale * (V < 0.9 ? 0.96 : 1), ry = 58 * scale;
  const fill = V > 1.15 ? 'url(#osm-rbc-sw)' : V < 0.9 ? 'url(#osm-rbc-cr)' : 'url(#osm-rbc)';
  return (
    <g>
      <ellipse cx={cx + 3} cy={cy + 5} rx={rx} ry={ry} fill="#5a1010" opacity="0.14" />
      {V < 0.9
        ? <path d={crenatedPath(cx, cy, rx, ry, Math.min(0.14, (0.92 - V) * 0.5))} fill={fill} stroke="#6e1212" strokeWidth="1.8" strokeLinejoin="round" />
        : <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill={fill} stroke="#7a1515" strokeWidth="1.8" />}
      <path d={`M${cx - rx * 0.78} ${cy - ry * 0.32} Q${cx - rx * 0.55} ${cy - ry * 0.86} ${cx - rx * 0.05} ${cy - ry * 0.9}`} fill="none" stroke="#fff" strokeOpacity="0.35" strokeWidth="2.5" strokeLinecap="round" />
    </g>
  );
}

/** Una célula vegetal (pared + protoplasto) centrada en (x, y); f = fracción del protoplasto (≤ 1). */
function PlantCell({ x, y, f, turgid, detail }: { x: number; y: number; f: number; turgid: boolean; detail: boolean }) {
  const w = 152 * f, h = 122 * f;
  const rr = 10 + (1 - f) * 70;
  const fv = Math.pow(f, 1.6);
  const chl = 14;
  return (
    <g>
      <rect x={x - 85} y={y - 70} width="170" height="140" rx="6" fill="#eef5e2" />
      <rect x={x - 76 * f} y={y - 61 * f} width={w} height={h} rx={Math.min(rr, h / 2)} fill="url(#osm-cyto)" stroke="#1b5e20" strokeWidth={turgid ? 2.4 : 1.4} />
      <rect x={x - 62 * fv} y={y - 46 * fv} width={124 * fv} height={92 * fv} rx={Math.min(18 + (1 - f) * 50, 46 * fv)} fill="url(#osm-vac)" stroke="#7da36a" strokeWidth="0.8" />
      {detail && Array.from({ length: chl }, (_, k) => {
        const a = (k / chl) * Math.PI * 2 + 0.2;
        const c = Math.cos(a), s = Math.sin(a);
        const px = x + Math.sign(c) * Math.pow(Math.abs(c), 0.35) * (w / 2 - 7);
        const py = y + Math.sign(s) * Math.pow(Math.abs(s), 0.35) * (h / 2 - 6);
        return <ellipse key={k} cx={px} cy={py} rx="5.2" ry="3.2" fill="url(#osm-chl)" transform={`rotate(${(a * 180) / Math.PI + 90} ${px} ${py})`} />;
      })}
      <circle cx={x + 50 * f} cy={y - 30 * f} r={9 * Math.max(0.75, f)} fill="#cfe3bf" stroke="#3d6b2c" strokeWidth="1" />
      <circle cx={x + 52 * f} cy={y - 31 * f} r={3} fill="#52803d" />
      {/* pared celular: celulosa con lámina media */}
      <rect x={x - 85} y={y - 70} width="170" height="140" rx="6" fill="none" stroke="#a9c98a" strokeWidth="6" />
      <rect x={x - 88} y={y - 73} width="176" height="146" rx="7" fill="none" stroke="#5f7f3f" strokeWidth="1" opacity="0.8" />
    </g>
  );
}

function PlantTissue({ f, turgid }: { f: number; turgid: boolean }) {
  const { cx, cy } = OF;
  const cells: [number, number][] = [[0, 0], [-176, 0], [176, 0], [-264, -146], [-88, -146], [88, -146], [264, -146], [-264, 146], [-88, 146], [88, 146], [264, 146]];
  return <g>{cells.map(([dx, dy]) => <PlantCell key={`${dx},${dy}`} x={cx + dx} y={cy + dy} f={f} turgid={turgid} detail />)}</g>;
}

function OsmosisDefs() {
  return (
    <defs>
      <clipPath id="osm-field"><circle cx={OF.cx} cy={OF.cy} r={OF.r} /></clipPath>
      <radialGradient id="osm-medium" cx="0.45" cy="0.42" r="0.65">
        <stop offset="0" stopColor="#fdfdf8" /><stop offset="1" stopColor="#e6eef0" />
      </radialGradient>
      <radialGradient id="osm-vignette" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0.72" stopColor="#000" stopOpacity="0" /><stop offset="0.92" stopColor="#000" stopOpacity="0.28" /><stop offset="1" stopColor="#000" stopOpacity="0.7" />
      </radialGradient>
      <radialGradient id="osm-rbc" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ee9a95" /><stop offset="0.3" stopColor="#e2615b" /><stop offset="0.72" stopColor="#cf3a34" /><stop offset="0.9" stopColor="#b2241f" /><stop offset="1" stopColor="#8e1916" />
      </radialGradient>
      <radialGradient id="osm-rbc-sw" cx="0.4" cy="0.36" r="0.68">
        <stop offset="0" stopColor="#f08a84" /><stop offset="0.55" stopColor="#d4433c" /><stop offset="1" stopColor="#9c1d19" />
      </radialGradient>
      <radialGradient id="osm-rbc-cr" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#c8443e" /><stop offset="0.7" stopColor="#b02a24" /><stop offset="1" stopColor="#7d1714" />
      </radialGradient>
      <radialGradient id="osm-cyto" cx="0.5" cy="0.5" r="0.6">
        <stop offset="0.5" stopColor="#bfe0a6" /><stop offset="1" stopColor="#86c06a" />
      </radialGradient>
      <radialGradient id="osm-vac" cx="0.45" cy="0.4" r="0.7">
        <stop offset="0" stopColor="#f6fbf2" stopOpacity="0.95" /><stop offset="1" stopColor="#dcebd0" stopOpacity="0.9" />
      </radialGradient>
      <radialGradient id="osm-chl" cx="0.4" cy="0.4" r="0.7">
        <stop offset="0" stopColor="#5fae4f" /><stop offset="1" stopColor="#1f6a24" />
      </radialGradient>
      <marker id="osm-arrow" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="4" markerHeight="4" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="#1e5fae" /></marker>
      <linearGradient id="osm-gauge" x1="0" x2="1">
        <stop offset="0" stopColor="#000" stopOpacity="0.18" /><stop offset="0.4" stopColor="#fff" stopOpacity="0.2" /><stop offset="1" stopColor="#000" stopOpacity="0.2" />
      </linearGradient>
    </defs>
  );
}

/** Indicador vertical del volumen relativo (40 %–170 %). */
function VolumeGauge({ x, y, h, V, color, lysisLine }: { x: number; y: number; h: number; V: number; color: string; lysisLine: boolean }) {
  const yAt = (p: number) => y + h - ((p - 40) / 130) * h;
  const vy = yAt(Math.max(40, Math.min(170, V * 100)));
  return (
    <g>
      <rect x={x} y={y - 6} width="22" height={h + 12} rx="11" fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
      <rect x={x + 4} y={vy} width="14" height={y + h + 2 - vy} rx="5" fill={color} />
      <rect x={x + 4} y={vy} width="14" height={y + h + 2 - vy} rx="5" fill="url(#osm-gauge)" />
      <rect x={x} y={y - 6} width="22" height={h + 12} rx="11" fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.4" />
      {[40, 60, 80, 100, 120, 140, 160].map((p) => (
        <g key={p}>
          <line x1={x + 24} x2={x + 31} y1={yAt(p)} y2={yAt(p)} stroke="var(--ink-2)" strokeWidth="1" />
          <text x={x + 34} y={yAt(p) + 3.5} style={{ fontSize: 9, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{p}</text>
        </g>
      ))}
      <line x1={x - 6} x2={x + 28} y1={yAt(100)} y2={yAt(100)} stroke="var(--ink)" strokeWidth="1.2" strokeDasharray="3 2" />
      {lysisLine && <line x1={x - 6} x2={x + 28} y1={yAt(155)} y2={yAt(155)} stroke="var(--bad)" strokeWidth="1.4" strokeDasharray="3 2" />}
    </g>
  );
}

function OsmosisPart({ api }: LabProps) {
  const [cellType, setCellType] = useState<CellType>('animal');
  const [nacl, setNacl] = useState(0.9);
  const [temperature, setTemperature] = useState(25);
  const [duration, setDuration] = useState(60);
  const [playhead, setPlayhead] = useState(0); // índice en la serie
  const [running, setRunning] = useState(false);
  const raf = useRef<number | null>(null);
  const res = useMemo(() => simulateOsmosis({ cellType, naclPercent: nacl, temperature, duration }), [cellType, nacl, temperature, duration]);
  const series = res.series;
  // Índice siempre dentro de la serie (las marcas de tiempo de requestAnimationFrame pueden ser anteriores al inicio).
  const idx = Math.max(0, Math.min(Number.isFinite(playhead) ? playhead : 0, series.length - 1));
  const point = series[idx];
  const finished = idx >= series.length - 1;

  useEffect(() => { setPlayhead(0); setRunning(false); }, [cellType, nacl, temperature, duration]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setPlayhead(series.length - 1); setRunning(false); return; }
    const start = performance.now() - (playhead / series.length) * 4000;
    const tick = (now: number) => {
      const i = Math.max(0, Math.min(series.length - 1, Math.floor(((now - start) / 4000) * series.length)));
      setPlayhead(i);
      if (i < series.length - 1) raf.current = requestAnimationFrame(tick);
      else setRunning(false);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, series]);

  const lysedNow = res.lysedAt !== null && point.t >= res.lysedAt - 1e-9;
  const V = point.volume;
  const outsideDots = useDots(Math.round(naclOsmolarity(nacl) * 60), 11);

  const rapidez = () => {
    const tRef = res.lysedAt !== null ? Math.min(10, res.lysedAt) : 10;
    const p = series.reduce((best, s) => (Math.abs(s.t - tRef) < Math.abs(best.t - tRef) ? s : best), series[0]);
    return p.t > 0 ? Math.abs(p.changePercent) / p.t : 0;
  };

  const record = () => api.addTrial('osmosis', {
    celula: cellType, nacl, osm: Number(res.externalOsm.toFixed(4)), temp: temperature, tiempo: duration,
    cambio: Number(res.finalChangePercent.toFixed(2)), rapidez: Number(rapidez().toFixed(3)),
    turgencia: Number(series[series.length - 1].turgor.toFixed(0)), estado: res.state,
  });

  // Dibujo de la célula
  const { cx, cy } = OF;
  const scale = Math.sqrt(V);
  const arrowsIn = res.waterDirection === 'entra';
  const showArrows = res.waterDirection !== 'sin flujo neto' && !lysedNow && idx > 0 && !finished;
  // El tejido vegetal se redibuja solo cuando cambia apreciablemente el protoplasto.
  const plantF = Math.round(Math.min(1, scale) * 400) / 400;
  const plantTurgid = V > 1;
  const tissue = useMemo(() => <PlantTissue f={plantF} turgid={plantTurgid} />, [plantF, plantTurgid]);
  const solutes = useMemo(() => outsideDots.map((d, i) => {
    const a = d.x * Math.PI * 2, rr = 98 + d.y * 46;
    return <circle key={i} cx={cx + Math.cos(a) * rr} cy={cy + Math.sin(a) * rr} r={i % 2 ? 2 : 2.6} fill={i % 2 ? '#3f6f8f' : '#6b5a8a'} opacity="0.7" />;
  }), [outsideDots, cx, cy]);

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 340" role="img" aria-labelledby="osm-t osm-d">
            <title id="osm-t">Vista al microscopio de la célula en la solución</title>
            <desc id="osm-d">{`Célula ${cellType} en NaCl al ${fmt(nacl, 2)} % (${res.tonicity}). Tiempo ${fmt(point.t, 0)} s. Volumen ${fmt(V * 100, 1)} % del inicial. Estado: ${lysedNow ? 'lisis' : finished ? STATE_TEXT[res.state] : 'en observación'}.`}</desc>
            <OsmosisDefs />
            {/* ocular: el entorno del campo se ve oscuro */}
            <rect x="0" y="0" width="440" height="316" rx="16" fill="#0d0f0e" />
            <circle cx={cx} cy={cy} r={OF.r + 7} fill="#1d2220" stroke="#3b423f" strokeWidth="1.5" />
            <g clipPath="url(#osm-field)">
              <rect x={cx - OF.r} y={cy - OF.r} width={OF.r * 2} height={OF.r * 2} fill="url(#osm-medium)" />
              {cellType === 'animal' && lysedNow && <rect x={cx - OF.r} y={cy - OF.r} width={OF.r * 2} height={OF.r * 2} fill="#e46a62" opacity="0.1" />}
              {cellType === 'animal' ? <>{solutes}<RedCell V={V} lysed={lysedNow} /></> : <>{tissue}{solutes.filter((_, i) => i % 3 === 0)}</>}
              {showArrows && [0, 1, 2, 3].map((k) => {
                const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
                const r1 = 125, r2 = 95;
                const [ra, rb] = arrowsIn ? [r1, r2] : [r2, r1];
                const x1 = cx + Math.cos(a) * ra, y1 = cy + Math.sin(a) * ra, x2 = cx + Math.cos(a) * rb, y2 = cy + Math.sin(a) * rb;
                return (
                  <g key={k}>
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#fff" strokeWidth="8" strokeLinecap="round" opacity="0.85" />
                    <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#1e5fae" strokeWidth="4.5" strokeLinecap="round" markerEnd="url(#osm-arrow)" />
                  </g>
                );
              })}
              <circle cx={cx} cy={cy} r={OF.r} fill="url(#osm-vignette)" />
            </g>
            <circle cx={cx} cy={cy} r={OF.r} fill="none" stroke="#000" strokeOpacity="0.6" strokeWidth="2" />
            {/* instrumentos: cronómetro e indicador de volumen */}
            <Stopwatch x={482} y={22} text={`${fmt(point.t, 0)} s`} label="tiempo" />
            <text x="534" y="112" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>Volumen celular</text>
            <text x="534" y="127" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>% del inicial</text>
            <VolumeGauge x={510} y={146} h={142} V={V} color={cellType === 'animal' ? '#cf3a34' : '#5aa046'} lysisLine={cellType === 'animal'} />
            <text x="534" y="314" textAnchor="middle" style={{ fontSize: 15, fill: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 700 }}>{fmt(V * 100, 1)} %</text>
            <text x="10" y="334" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Flechas azules: movimiento neto de agua · puntos: solutos del medio</text>
          </svg>
        </div>
        <Readout items={[
          { k: 'Osmolaridad externa', v: `${fmt(res.externalOsm, 3)} Osm/L` },
          { k: 'Osmolaridad interna inicial', v: `${fmt(CIN0, 2)} Osm/L` },
          { k: 'Tipo de medio', v: res.tonicity },
          { k: 'Agua', v: res.waterDirection },
          { k: 'Volumen celular', v: `${fmt(V * 100, 1)} %`, data: true },
          { k: 'Turgencia', v: `${fmt(point.turgor, 0)} kPa` },
          { k: 'π externa (van \'t Hoff)', v: `${fmt(res.externalPressureKPa, 0)} kPa` },
          { k: 'Estado', v: finished ? (lysedNow ? 'Lisis' : STATE_TEXT[res.state]) : 'En observación…' },
        ]} />
        <div className="card">
          <Chart title="Volumen celular en el tiempo" xLabel="Tiempo (s)" yLabel="Volumen (% del inicial)"
            series={[{ label: 'Volumen', kind: 'line', points: series.slice(0, idx + 1).map((p) => ({ x: p.t, y: p.volume * 100 })) }]}
            xDomain={[0, duration]} yDomain={[40, 170]}
            hLines={[{ y: 100, label: 'volumen inicial' }, ...(cellType === 'animal' ? [{ y: 155, label: 'umbral de lisis' }] : [])]} height={240} />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Segmented label="Tipo de célula" value={cellType} onChange={setCellType} options={[{ value: 'animal', label: 'Glóbulo rojo' }, { value: 'vegetal', label: 'Célula vegetal' }]} />
          <Slider label="NaCl en el medio" value={nacl} min={OSMOSIS_LIMITS.naclPercent[0]} max={OSMOSIS_LIMITS.naclPercent[1]} step={0.05} unit="% m/v" decimals={2} onChange={setNacl}
            hint="0 % = agua destilada · 0,9 % = suero fisiológico" />
          <Slider label="Temperatura" value={temperature} min={OSMOSIS_LIMITS.temperature[0]} max={OSMOSIS_LIMITS.temperature[1]} step={1} unit="°C" decimals={0} onChange={setTemperature} />
          <Slider label="Tiempo de observación" value={duration} min={OSMOSIS_LIMITS.duration[0]} max={OSMOSIS_LIMITS.duration[1]} step={10} unit="s" decimals={0} onChange={setDuration} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { if (finished) setPlayhead(0); setRunning(true); }} disabled={running}>{finished ? 'Repetir' : idx > 0 ? 'Continuar' : 'Iniciar'}</button>
            <button type="button" className="btn" onClick={() => setRunning(false)} disabled={!running}>Pausar</button>
            <button type="button" className="btn" onClick={() => { setRunning(false); setPlayhead(0); }}>Reiniciar</button>
          </div>
          <RecordButton onRecord={record} disabled={!finished} />
          {!finished && <p className="small muted">Ejecuta la observación completa para guardar el ensayo.</p>}
        </div>
        <Notice>La escala de tiempo es ilustrativa. Un glóbulo rojo real se equilibra en segundos o menos.</Notice>
      </div>
    </div>
  );
}

const BAG = 'M246 66 C232 80 222 96 222 120 L222 228 Q222 252 260 254 Q298 252 298 228 L298 120 C298 96 288 80 274 66 Z';

function DiffusionPart({ api }: LabProps) {
  const [temperature, setTemperature] = useState(25);
  const [area, setArea] = useState(10);
  const [glucose, setGlucose] = useState(20);
  const [iodine, setIodine] = useState(1);
  const [starch, setStarch] = useState(true);
  const [duration, setDuration] = useState(30);
  const res = useMemo(() => simulateDiffusion({ temperature, area, glucoseInside0: glucose, iodineOutside0: iodine, starchInside: starch, duration }), [temperature, area, glucose, iodine, starch, duration]);
  const f = res.final;
  const blue = starch ? Math.min(1, f.iodineIn / 0.15) : 0;
  const amber = Math.min(1, f.iodineOut / 1.2);
  const record = () => api.addTrial('difusion', {
    temp: temperature, area, tiempo: duration,
    glucosaFuera: Number(f.glucoseOut.toFixed(3)), yodoDentro: Number(f.iodineIn.toFixed(4)),
    tmedio: Number(res.halfTimeGlucose.toFixed(2)), color: res.bagTurnsBlue ? 'azul oscuro' : 'sin cambio',
  });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 560 316" role="img" aria-labelledby="dif-t dif-d">
            <title id="dif-t">Bolsa de diálisis dentro de un vaso de precipitados</title>
            <desc id="dif-d">{`Después de ${duration} minutos: glucosa fuera ${fmt(f.glucoseOut, 2)} g/L, yodo dentro ${fmt(f.iodineIn, 3)} g/L. El interior de la bolsa ${res.bagTurnsBlue ? 'se tiñó de azul oscuro' : 'no cambió de color'}.`}</desc>
            <defs>
              <linearGradient id="dif-bag" x1="0" x2="1">
                <stop offset="0" stopColor="#fff" stopOpacity="0.28" /><stop offset="0.25" stopColor="#fff" stopOpacity="0.06" /><stop offset="0.7" stopColor="#000" stopOpacity="0" /><stop offset="1" stopColor="#000" stopOpacity="0.22" />
              </linearGradient>
            </defs>
            <BenchTop y={280} width={560} />
            <Beaker x={150} y={70} w={220} h={210} fill={0.85} liquid={mix('#f4ecd0', '#9a4a12', amber)} liquidOpacity={0.62}>
              {/* bolsa de diálisis atada a la varilla */}
              <g>
                <path d={BAG} fill={mix('#eef1f6', '#1a2150', blue)} opacity="0.92" />
                {starch && [[240, 150], [272, 132], [258, 196], [236, 220], [282, 214], [266, 168], [246, 112], [284, 178]].map(([x, y], i) => (
                  <circle key={i} cx={x} cy={y} r={i % 2 ? 2 : 2.6} fill="#fff" opacity={0.25 + 0.25 * (1 - blue)} />
                ))}
                <path d={BAG} fill="url(#dif-bag)" stroke="#7d8794" strokeWidth="1.6" />
                <path d="M234 118 C230 150 231 200 236 232" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M262 92 L262 240 M276 104 C279 150 279 200 276 236" fill="none" stroke="#5f6874" strokeOpacity="0.3" strokeWidth="0.8" />
                <path d="M256 254 q4 6 8 0 l3 10 m-11 -10 l-4 9" fill="#cfd5dc" stroke="#7d8794" strokeWidth="1.2" />
              </g>
            </Beaker>
            {/* varilla de vidrio e hilo */}
            <path d="M246 66 L254 58 M274 66 L266 58" stroke="#8a6d3b" strokeWidth="1.4" />
            <rect x="130" y="53" width="260" height="7" rx="3.5" fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.2" filter="url(#kit-shadow-soft)" />
            <rect x="134" y="54.5" width="252" height="1.6" rx="0.8" fill="#fff" opacity="0.6" />
            <text x="260" y="40" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>bolsa (20 mL)</text>
            <text x="260" y="311" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>vaso (200 mL)</text>
            {/* tira reactiva de glucosa con su carta de colores */}
            <g transform="translate(404 112)">
              <rect x="-10" y="-14" width="148" height="122" rx="10" fill="var(--surface-2)" stroke="var(--line)" />
              <rect x="0" y="0" width="112" height="14" rx="2" fill="url(#kit-body)" stroke="#9aa5a9" filter="url(#kit-shadow-soft)" />
              <rect x="92" y="1.5" width="16" height="11" rx="1.5" fill={res.glucoseDetectedOutside ? '#3f8f3a' : '#e9e6a8'} stroke="#6f7a7c" strokeWidth="0.8" />
              <text y="34" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>tira de glucosa</text>
              <text y="50" style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>{res.glucoseDetectedOutside ? 'positiva' : 'negativa'}</text>
              <rect x="0" y="66" width="18" height="12" rx="2" fill="#e9e6a8" stroke="#6f7a7c" strokeWidth="0.8" />
              <text x="24" y="76" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>sin glucosa</text>
              <rect x="0" y="84" width="18" height="12" rx="2" fill="#3f8f3a" stroke="#6f7a7c" strokeWidth="0.8" />
              <text x="24" y="94" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>con glucosa</text>
            </g>
          </svg>
        </div>
        <Readout items={[
          { k: 'Glucosa dentro / fuera', v: `${fmt(f.glucoseIn, 2)} / ${fmt(f.glucoseOut, 2)} g/L`, data: true },
          { k: 'Yodo dentro / fuera', v: `${fmt(f.iodineIn, 3)} / ${fmt(f.iodineOut, 3)} g/L`, data: true },
          { k: 't½ glucosa', v: `${fmt(res.halfTimeGlucose, 1)} min` },
          { k: 't½ yodo', v: `${fmt(res.halfTimeIodine, 1)} min` },
          { k: 'Color de la bolsa', v: res.bagTurnsBlue ? 'azul oscuro (yodo + almidón)' : 'sin cambio' },
          { k: 'Glucosa detectada fuera', v: res.glucoseDetectedOutside ? `sí (≥ ${fmt(GLUCOSE_DETECTION_LIMIT, 1)} g/L)` : 'no' },
        ]} />
        <div className="card">
          <Chart title="Concentraciones en el tiempo" xLabel="Tiempo (min)" yLabel="Concentración (g/L)" height={240}
            series={[
              { label: 'Glucosa dentro', kind: 'line', points: res.series.map((p) => ({ x: p.t, y: p.glucoseIn })) },
              { label: 'Glucosa fuera', kind: 'line', dashed: true, points: res.series.map((p) => ({ x: p.t, y: p.glucoseOut })) },
              { label: 'Yodo dentro', kind: 'line', points: res.series.map((p) => ({ x: p.t, y: p.iodineIn })) },
              { label: 'Yodo fuera', kind: 'line', dashed: true, points: res.series.map((p) => ({ x: p.t, y: p.iodineOut })) },
            ]} />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Slider label="Temperatura" value={temperature} min={DIFFUSION_LIMITS.temperature[0]} max={DIFFUSION_LIMITS.temperature[1]} step={1} unit="°C" decimals={0} onChange={setTemperature} />
          <Slider label="Área de la membrana" value={area} min={DIFFUSION_LIMITS.area[0]} max={DIFFUSION_LIMITS.area[1]} step={1} unit="cm²" decimals={0} onChange={setArea} />
          <Slider label="Glucosa inicial en la bolsa" value={glucose} min={DIFFUSION_LIMITS.glucose[0]} max={DIFFUSION_LIMITS.glucose[1]} step={1} unit="g/L" decimals={0} onChange={setGlucose} />
          <Slider label="Yodo inicial en el vaso" value={iodine} min={DIFFUSION_LIMITS.iodine[0]} max={DIFFUSION_LIMITS.iodine[1]} step={0.1} unit="g/L" decimals={1} onChange={setIodine} />
          <label className="check"><input type="checkbox" checked={starch} onChange={(e) => setStarch(e.target.checked)} /> La bolsa contiene almidón</label>
          <Slider label="Tiempo transcurrido" value={duration} min={DIFFUSION_LIMITS.duration[0]} max={DIFFUSION_LIMITS.duration[1]} step={1} unit="min" decimals={0} onChange={setDuration} />
          <RecordButton onRecord={record} />
        </div>
        <Notice>El almidón no atraviesa la membrana; la glucosa y el yodo sí. El tiempo de semiequilibrio (t½) indica la rapidez de la difusión.</Notice>
      </div>
    </div>
  );
}

export default function OsmosisLab(props: LabProps) {
  const [tab, setTab] = useState<'osmosis' | 'difusion'>('osmosis');
  return (
    <div className="stack">
      <Segmented label="Experimento" value={tab} onChange={setTab} options={[{ value: 'osmosis', label: 'Ósmosis en células' }, { value: 'difusion', label: 'Difusión en bolsa de diálisis' }]} />
      {tab === 'osmosis' ? <OsmosisPart {...props} /> : <DiffusionPart {...props} />}
    </div>
  );
}
