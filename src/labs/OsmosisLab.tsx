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
  const idx = Math.min(playhead, series.length - 1);
  const point = series[idx];
  const finished = idx >= series.length - 1;

  useEffect(() => { setPlayhead(0); setRunning(false); }, [cellType, nacl, temperature, duration]);

  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setPlayhead(series.length - 1); setRunning(false); return; }
    const start = performance.now() - (playhead / series.length) * 4000;
    const tick = (now: number) => {
      const i = Math.min(series.length - 1, Math.floor(((now - start) / 4000) * series.length));
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
  const insideDots = useDots(18, 5);

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
  const cx = 230, cy = 160;
  const scale = Math.sqrt(V);
  const arrowsIn = res.waterDirection === 'entra';
  const showArrows = res.waterDirection !== 'sin flujo neto' && !lysedNow && idx > 0 && !finished;

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 460 320" role="img" aria-labelledby="osm-t osm-d">
            <title id="osm-t">Vista al microscopio de la célula en la solución</title>
            <desc id="osm-d">{`Célula ${cellType} en NaCl al ${fmt(nacl, 2)} % (${res.tonicity}). Tiempo ${fmt(point.t, 0)} s. Volumen ${fmt(V * 100, 1)} % del inicial. Estado: ${lysedNow ? 'lisis' : STATE_TEXT[res.state]}.`}</desc>
            <circle cx={cx} cy={cy} r="150" fill="rgba(120,180,220,0.10)" stroke="var(--line)" strokeWidth="2" />
            {outsideDots.map((d, i) => {
              const a = d.x * Math.PI * 2, rr = 100 + d.y * 45;
              return <circle key={i} cx={cx + Math.cos(a) * rr} cy={cy + Math.sin(a) * rr} r="2.6" fill="var(--ink-2)" opacity="0.55" />;
            })}
            {cellType === 'animal' ? (
              lysedNow ? (
                <g stroke="#b42318" strokeWidth="3" fill="none" opacity="0.7">
                  <path d={`M${cx - 70} ${cy - 20} q20 -40 60 -30`} /><path d={`M${cx + 20} ${cy - 50} q40 10 50 50`} />
                  <path d={`M${cx + 60} ${cy + 20} q-10 40 -60 40`} /><path d={`M${cx - 30} ${cy + 55} q-40 -10 -45 -50`} />
                </g>
              ) : (
                <g>
                  <ellipse cx={cx} cy={cy} rx={66 * scale * (V < 0.9 ? 0.96 : 1)} ry={58 * scale} fill="#d64545" stroke="#7a1515" strokeWidth="2.5"
                    strokeDasharray={V < 0.9 ? '6 3' : undefined} />
                  <ellipse cx={cx} cy={cy} rx={30 * scale} ry={24 * scale} fill="#e98080" opacity={V > 1.2 ? 0.2 : 0.7} />
                </g>
              )
            ) : (
              <g>
                <rect x={cx - 85} y={cy - 70} width="170" height="140" rx="8" fill="none" stroke="#2e7d32" strokeWidth="6" />
                <rect x={cx - 76 * Math.min(1, scale)} y={cy - 61 * Math.min(1, scale)} width={152 * Math.min(1, scale)} height={122 * Math.min(1, scale)} rx="10"
                  fill="rgba(76,160,80,0.55)" stroke="#1b5e20" strokeWidth={V > 1 ? 3 : 1.5} />
                {insideDots.map((d, i) => <ellipse key={i} cx={cx - 55 * Math.min(1, scale) + d.x * 110 * Math.min(1, scale)} cy={cy - 40 * Math.min(1, scale) + d.y * 80 * Math.min(1, scale)} rx="6" ry="4" fill="#2e7d32" />)}
              </g>
            )}
            {showArrows && [0, 1, 2, 3].map((k) => {
              const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
              const r1 = 125, r2 = 95;
              const [ra, rb] = arrowsIn ? [r1, r2] : [r2, r1];
              const x1 = cx + Math.cos(a) * ra, y1 = cy + Math.sin(a) * ra, x2 = cx + Math.cos(a) * rb, y2 = cy + Math.sin(a) * rb;
              return <g key={k}><line x1={x1} y1={y1} x2={x2} y2={y2} stroke="var(--fis)" strokeWidth="3" markerEnd="url(#arrow)" /></g>;
            })}
            <defs><marker id="arrow" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10z" fill="var(--fis)" /></marker></defs>
            <text x="395" y="30" textAnchor="middle" style={{ fontSize: 13, fontFamily: 'var(--font-data)', fill: 'var(--ink)' }}>t = {fmt(point.t, 0)} s</text>
            <text x="395" y="50" textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{fmt(V * 100, 1)} %</text>
            <text x="10" y="310" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Flechas azules: movimiento neto de agua · puntos: solutos del medio</text>
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
          <svg viewBox="0 0 460 300" role="img" aria-labelledby="dif-t dif-d">
            <title id="dif-t">Bolsa de diálisis dentro de un vaso de precipitados</title>
            <desc id="dif-d">{`Después de ${duration} minutos: glucosa fuera ${fmt(f.glucoseOut, 2)} g/L, yodo dentro ${fmt(f.iodineIn, 3)} g/L. El interior de la bolsa ${res.bagTurnsBlue ? 'se tiñó de azul oscuro' : 'no cambió de color'}.`}</desc>
            <path d="M120 40 L120 270 Q120 285 135 285 L325 285 Q340 285 340 270 L340 40" fill={`rgba(190,120,30,${0.08 + amber * 0.35})`} stroke="var(--ink-2)" strokeWidth="2" />
            <path d="M190 30 L190 230 Q230 270 270 230 L270 30" fill={`rgba(${Math.round(225 - blue * 200)},${Math.round(225 - blue * 200)},${Math.round(235 - blue * 140)},0.9)`} stroke="var(--ink-2)" strokeWidth="2" strokeDasharray="4 3" />
            <text x="230" y="22" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>bolsa (20 mL)</text>
            <text x="230" y="298" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>vaso (200 mL)</text>
            <g transform="translate(360 120)">
              <rect width="60" height="16" fill="var(--surface-2)" stroke="var(--ink-2)" />
              <rect x="44" width="16" height="16" fill={res.glucoseDetectedOutside ? '#3f8f3a' : '#e9e6a8'} stroke="var(--ink-2)" />
              <text y="34" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>tira de glucosa</text>
              <text y="48" style={{ fontSize: 10, fill: 'var(--ink)' }}>{res.glucoseDetectedOutside ? 'positiva' : 'negativa'}</text>
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
