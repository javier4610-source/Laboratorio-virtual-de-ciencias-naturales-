import { useMemo, useState } from 'react';
import {
  BIOMASS_ID, CARBON_SOURCES, ECOLI_CORE, ESSENTIAL_THRESHOLD, FBA_LIMITS, KEY_EXCHANGES, KEY_REACTIONS, MAP_EDGES, MAP_NODES, MODEL_PROVENANCE,
  PATHWAY_LABEL, REFERENCE_CONDITION, UNLIMITED, conditionBounds, fluxVariability, geneKnockoutScan, oxygenSeries, pathwayOf, roundFlux, roundGrowth, runFba,
  type CarbonId, type FbaCondition, type FbaResult, type KnockoutRow, type MapEdge,
} from '../models/metabolism';
import { STATUS_HELP } from '../lib/provenance';
import { fmt, fmtSig } from '../lib/format';
import { StatusChip } from '../components/Provenance';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';

type O2Mode = 'ilimitado' | 'limitado' | 'sin';
type MapView = 'actual' | 'referencia';

const O2_SERIES = Array.from({ length: 31 }, (_, i) => i);
const GENE_NAME = new Map(ECOLI_CORE.genes.map(([id, name]) => [id, name]));
const RXN = new Map(ECOLI_CORE.reactions.map((r) => [r.id, r]));
const MET_NAME = new Map(ECOLI_CORE.metabolites.map(([id, name]) => [id, name]));
const carbonLabel = (id: CarbonId) => CARBON_SOURCES.find((c) => c.id === id)!.label;
const geneLabel = (id: string) => `${GENE_NAME.get(id) ?? id} (${id})`;
/** Flujo «visible»: por debajo de este valor se considera cero (ruido numérico). */
const ZERO = 1e-6;

interface Computed {
  cond: FbaCondition;
  fba: FbaResult;
  /** Intervalo FVA (100 % del óptimo) de los intercambios y reacciones destacadas. */
  fva: Record<string, [number, number]> | null;
  series: { oxygen: number; growth: number }[];
}

function compute(cond: FbaCondition): Computed {
  const fba = runFba(cond);
  const ids = [...KEY_EXCHANGES.map((e) => e.id), ...KEY_REACTIONS.map((r) => r.id)];
  const fva = fba.status === 'optimal' ? fluxVariability(cond, ids, 1) : null;
  const series = oxygenSeries(cond, O2_SERIES).map((p) => ({ oxygen: p.oxygen, growth: roundGrowth(p.growth) }));
  return { cond, fba, fva, series };
}

function knockoutText(c: FbaCondition): string {
  const parts = [...(c.geneKnockouts ?? []).map((g) => `Δ${GENE_NAME.get(g) ?? g} (${g})`), ...(c.reactionKnockouts ?? []).map((r) => `sin ${r}`)];
  return parts.length ? parts.join(', ') : 'ninguna';
}
const o2Text = (o: number) => (o >= UNLIMITED ? 'sin límite (1000)' : o === 0 ? '0 (anaerobiosis)' : `${fmt(o, 1)} mmol/gDW/h`);

/* ------------------------------------------------------------------ mapa */

const W = 1040, H = 772;

interface EdgeGeom { e: MapEdge; d: string; mx: number; my: number; ux: number; uy: number; ax: number; ay: number; bx: number; by: number; nx: number; ny: number }

/** Geometría de las flechas (independiente de los flujos: se calcula una vez). */
function edgeGeometry(): EdgeGeom[] {
  return MAP_EDGES.map((e) => {
    const A = MAP_NODES[e.from], B = MAP_NODES[e.to];
    const dx = B.x - A.x, dy = B.y - A.y, L = Math.hypot(dx, dy) || 1;
    const ux = dx / L, uy = dy / L, nx = -uy, ny = ux;
    const off = e.off ?? 0;
    // recorte para no tapar los rótulos de los nodos
    const padA = MAP_NODES[e.from].y < 40 || MAP_NODES[e.from].y > 720 || MAP_NODES[e.from].x > 990 || MAP_NODES[e.from].x < 60 ? 16 : 20;
    const padB = MAP_NODES[e.to].y < 40 || MAP_NODES[e.to].y > 720 || MAP_NODES[e.to].x > 990 || MAP_NODES[e.to].x < 60 ? 16 : 20;
    const ax = A.x + ux * padA + nx * off, ay = A.y + uy * padA + ny * off;
    const bx = B.x - ux * padB + nx * off, by = B.y - uy * padB + ny * off;
    const bend = e.bend ?? 0;
    const cx = (ax + bx) / 2 + nx * bend, cy = (ay + by) / 2 + ny * bend;
    const d = bend ? `M${ax.toFixed(1)} ${ay.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${bx.toFixed(1)} ${by.toFixed(1)}` : `M${ax.toFixed(1)} ${ay.toFixed(1)} L${bx.toFixed(1)} ${by.toFixed(1)}`;
    const mx = bend ? 0.25 * ax + 0.5 * cx + 0.25 * bx : (ax + bx) / 2, my = bend ? 0.25 * ay + 0.5 * cy + 0.25 * by : (ay + by) / 2;
    return { e, d, mx, my, ux, uy, ax, ay, bx, by, nx, ny };
  });
}

const widthOf = (v: number) => Math.min(10, 1.6 + 6 * Math.sqrt(Math.min(Math.abs(v), 40) / 20));

function Arrowhead({ x, y, ux, uy, w, color }: { x: number; y: number; ux: number; uy: number; w: number; color: string }) {
  const s = 5 + w * 0.9;
  const px = -uy, py = ux;
  const p = `${x},${y} ${x - ux * s + px * s * 0.6},${y - uy * s + py * s * 0.6} ${x - ux * s - px * s * 0.6},${y - uy * s - py * s * 0.6}`;
  return <polygon points={p} fill={color} />;
}

function FluxMap({ fluxes, disabled, carbon, view, computed }: { fluxes: Record<string, number> | null; disabled: Set<string>; carbon: CarbonId; view: MapView; computed: boolean }) {
  const geom = useMemo(edgeGeometry, []);
  const carbonEx = CARBON_SOURCES.find((c) => c.id === carbon)!.exchange;
  const exValue = (met: string) => {
    const id = `EX_${met}`;
    return fluxes && RXN.has(id) ? fluxes[id] : null;
  };
  const energyRows = [
    { id: BIOMASS_ID, label: 'Biomasa (μ, h⁻¹)', scale: 1 },
    { id: 'EX_o2_e', label: 'O₂ (intercambio)', scale: 30 },
    { id: 'EX_co2_e', label: 'CO₂ (intercambio)', scale: 30 },
    { id: 'NADH16', label: 'NADH deshidrogenasa', scale: 50 },
    { id: 'CYTBD', label: 'Citocromo oxidasa', scale: 50 },
    { id: 'ATPS4r', label: 'ATP sintasa', scale: 50 },
    { id: 'THD2', label: 'Transhidrogenasa', scale: 50 },
    { id: 'ATPM', label: 'ATP de mantenimiento', scale: 50 },
  ];
  const active = fluxes ? MAP_EDGES.filter((e) => Math.abs(fluxes[e.r] ?? 0) > ZERO).length : 0;
  const desc = !computed
    ? `Mapa del metabolismo central de E. coli con ${MAP_EDGES.length} reacciones del modelo e_coli_core. Aún no hay flujos: pulsa «Calcular el óptimo».`
    : fluxes
      ? `Flujos ${view === 'referencia' ? 'de la condición de referencia' : 'de la condición actual'}: ${active} de ${MAP_EDGES.length} reacciones dibujadas llevan flujo. Crecimiento ${fmt(roundGrowth(fluxes[BIOMASS_ID]), 4)} h⁻¹. Los valores exactos están en la tabla de flujos.`
      : 'La condición no tiene solución factible: no hay flujos que dibujar.';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="fba-map-t fba-map-d" style={{ minWidth: 900 }}>
      <title id="fba-map-t">Mapa de rutas del metabolismo central (modelo E. coli core)</title>
      <desc id="fba-map-d">{desc}</desc>
      <defs>
        <linearGradient id="fba-cyto" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="var(--surface)" />
          <stop offset="1" stopColor="var(--surface-2)" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width={W} height={H} rx="16" fill="var(--surface-2)" />
      {/* célula: membrana externa e interna */}
      <rect x="78" y="48" width="884" height="664" rx="46" fill="none" stroke="var(--bio)" strokeOpacity="0.35" strokeWidth="9" />
      <rect x="84" y="54" width="872" height="652" rx="40" fill="url(#fba-cyto)" stroke="var(--bio)" strokeWidth="1.6" />
      <text x="100" y="698" style={{ fontSize: 12, fontWeight: 700, fill: 'var(--bio)' }}>Citoplasma de E. coli</text>
      <text x="1030" y="18" textAnchor="end" style={{ fontSize: 11.5, fill: 'var(--ink-2)' }}>Medio externo</text>
      {/* rótulos de las vías */}
      <g style={{ fontSize: 11, fontWeight: 700, fill: 'var(--ink-2)', letterSpacing: '0.04em' }}>
        <text x="236" y="250">GLUCÓLISIS</text>
        <text x="330" y="140">VÍA DE LAS PENTOSAS FOSFATO</text>
        <text x="600" y="700" textAnchor="middle">CICLO DE KREBS</text>
        <text x="690" y="398">FERMENTACIÓN</text>
        <text x="880" y="500" textAnchor="middle">NITRÓGENO</text>
      </g>
      {/* flechas */}
      {geom.map(({ e, d, mx, my, ux, uy, ax, ay, bx, by }) => {
        const rx = RXN.get(e.r)!;
        const v = fluxes ? fluxes[e.r] ?? 0 : 0;
        const off = disabled.has(e.r);
        const on = computed && fluxes !== null && Math.abs(v) > ZERO;
        const color = off ? 'var(--bad)' : on ? (pathwayOf(e.r) === 'transporte' ? 'var(--fis)' : 'var(--bio)') : 'var(--ink-2)';
        const w = on ? widthOf(v) : 1.4;
        const dash = off ? '5 4' : on ? undefined : '3 4';
        const tip = `${e.r} · ${rx.name}: ${!computed ? 'sin calcular' : off ? 'eliminada (flujo 0)' : fluxes ? `${fmt(roundFlux(v), 2)} mmol/gDW/h${Math.abs(v) > ZERO ? (v > 0 ? ' (sentido de la ecuación)' : ' (sentido inverso)') : ''}` : 'sin solución'}`;
        const join = e.join ? MAP_NODES[e.join] : null;
        const split = e.split ? MAP_NODES[e.split] : null;
        return (
          <g key={e.r} opacity={on || off ? 1 : computed ? 0.55 : 0.7}>
            <title>{tip}</title>
            {join && <line x1={join.x} y1={join.y + 10} x2={mx} y2={my} stroke={color} strokeWidth={Math.max(1.2, w * 0.7)} strokeDasharray={dash} strokeLinecap="round" />}
            {split && <line x1={mx} y1={my} x2={split.x} y2={split.y - 10} stroke={color} strokeWidth={Math.max(1.2, w * 0.7)} strokeDasharray={dash} strokeLinecap="round" />}
            <path d={d} fill="none" stroke={color} strokeWidth={w} strokeDasharray={dash} strokeLinecap="round" />
            {on && (v > 0 ? <Arrowhead x={bx} y={by} ux={ux} uy={uy} w={w} color={color} /> : <Arrowhead x={ax} y={ay} ux={-ux} uy={-uy} w={w} color={color} />)}
            {off && (
              <g stroke="var(--bad)" strokeWidth="2.6" strokeLinecap="round">
                <line x1={mx - 6} y1={my - 6} x2={mx + 6} y2={my + 6} /><line x1={mx - 6} y1={my + 6} x2={mx + 6} y2={my - 6} />
              </g>
            )}
            {on && !off && (
              <text x={mx + 6} y={my - 5} className="scene-label" style={{ fontSize: 10, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>
                {fmt(Math.abs(roundFlux(v)), 1)}
              </text>
            )}
          </g>
        );
      })}
      {/* nodos */}
      {Object.entries(MAP_NODES).map(([id, n]) => {
        const ext = id.endsWith('_e');
        const ev = ext ? exValue(id) : null;
        const w = Math.max(44, n.label.length * 6.6 + 14);
        const isSource = ext && `EX_${id}` === carbonEx;
        return (
          <g key={id}>
            <title>{`${MET_NAME.get(id) ?? id} (${id})${ev !== null ? `: intercambio ${fmt(roundFlux(ev), 2)} mmol/gDW/h (negativo = captación)` : ''}`}</title>
            <rect x={n.x - w / 2} y={n.y - 10} width={w} height={20} rx={10}
              fill={ext ? 'var(--surface)' : 'var(--surface)'} stroke={isSource ? 'var(--bio)' : ext ? 'var(--ink-2)' : 'var(--line)'}
              strokeWidth={isSource ? 2.2 : 1.2} strokeDasharray={ext && !isSource ? '3 2' : undefined} />
            <text x={n.x} y={n.y + 4} textAnchor="middle" style={{ fontSize: 11, fontWeight: ext ? 600 : 700, fill: 'var(--ink)' }}>{n.label}</text>
            {ext && ev !== null && Math.abs(ev) > ZERO && (
              <text x={n.y < 40 ? n.x + w / 2 + 6 : n.x} y={n.y < 40 ? n.y + 4 : n.y > 720 || n.x < 60 ? n.y + 23 : n.y - 15} textAnchor={n.y < 40 ? 'start' : 'middle'} className="scene-label" style={{ fontSize: 10, fill: ev < 0 ? 'var(--data)' : 'var(--ink)', fontWeight: 700, fontFamily: 'var(--font-data)' }}>
                {ev < 0 ? `entra ${fmt(-roundFlux(ev), 2)}` : `sale ${fmt(roundFlux(ev), 2)}`}
              </text>
            )}
          </g>
        );
      })}
      {/* panel de energía y respiración */}
      <g transform="translate(724 66)">
        <rect x="0" y="0" width="226" height="176" rx="10" fill="var(--surface)" stroke="var(--line)" />
        <text x="10" y="17" style={{ fontSize: 11.5, fontWeight: 700, fill: 'var(--ink)' }}>Energía, respiración y biomasa</text>
        {energyRows.map((row, i) => {
          const v = fluxes ? fluxes[row.id] ?? 0 : null;
          const off = disabled.has(row.id);
          const len = v === null ? 0 : Math.min(1, Math.abs(v) / row.scale) * 70;
          return (
            <g key={row.id} transform={`translate(10 ${30 + i * 18})`}>
              <title>{`${row.id} · ${RXN.get(row.id)?.name ?? ''}: ${v === null ? 'sin calcular' : `${fmt(row.id === BIOMASS_ID ? roundGrowth(v) : roundFlux(v), row.id === BIOMASS_ID ? 4 : 2)}`}`}</title>
              <text x="0" y="9" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>{row.label}</text>
              <rect x="112" y="1" width="70" height="9" rx="2" fill="var(--surface-2)" stroke="var(--line)" strokeWidth="0.6" />
              {len > 0 && <rect x="112" y="1" width={len} height="9" rx="2" fill={off ? 'var(--bad)' : row.id === BIOMASS_ID ? 'var(--ok)' : 'var(--bio)'} />}
              <text x="206" y="9" textAnchor="end" style={{ fontSize: 9.5, fill: 'var(--ink)', fontFamily: 'var(--font-data)' }}>
                {v === null ? '—' : off ? '0 ×' : fmt(row.id === BIOMASS_ID ? roundGrowth(v) : roundFlux(v), row.id === BIOMASS_ID ? 3 : 1)}
              </text>
            </g>
          );
        })}
      </g>
      {/* leyenda */}
      <g transform="translate(400 26)" style={{ fontSize: 10.5, fill: 'var(--ink-2)' }}>
        <text x="0" y="0">Grosor ∝ √|flujo| · punta = sentido · número = mmol/gDW/h · discontinua = flujo 0 · roja con × = eliminada</text>
      </g>
      {!computed && (
        <text x={W / 2} y={H / 2 + 20} textAnchor="middle" className="scene-label" style={{ fontSize: 15, fontWeight: 700, fill: 'var(--ink)' }}>Pulsa «Calcular el óptimo» para ver los flujos</text>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function MetabolismLab({ api }: LabProps) {
  const [carbon, setCarbon] = useState<CarbonId>('glc__D');
  const [uptake, setUptake] = useState(10);
  const [o2Mode, setO2Mode] = useState<O2Mode>('ilimitado');
  const [o2, setO2] = useState(10);
  const [genes, setGenes] = useState<string[]>([]);
  const [rxns, setRxns] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [koKind, setKoKind] = useState<'gen' | 'reaccion'>('gen');
  const [result, setResult] = useState<Computed | null>(null);
  const [reference, setReference] = useState<Computed | null>(null);
  const [mapView, setMapView] = useState<MapView>('actual');
  const [scan, setScan] = useState<{ cond: FbaCondition; wildType: number; rows: KnockoutRow[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const oxygen = o2Mode === 'ilimitado' ? UNLIMITED : o2Mode === 'sin' ? 0 : o2;
  const cond = useMemo<FbaCondition>(() => ({ carbon, uptake, oxygen, geneKnockouts: genes, reactionKnockouts: rxns }), [carbon, uptake, oxygen, genes, rxns]);
  const preview = useMemo(() => { try { return conditionBounds(cond).disabled; } catch { return []; } }, [cond]);

  const change = (fn: () => void) => { fn(); setResult(null); setError(null); };
  const calc = () => {
    try {
      const r = compute(cond);
      setResult(r);
      setReference((ref) => ref ?? compute(REFERENCE_CONDITION));
      setError(null);
    } catch (e) { setResult(null); setError((e as Error).message); }
  };
  const ref = reference;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (koKind === 'gen') {
      return ECOLI_CORE.genes.filter(([id, name]) => !genes.includes(id) && (q === '' || id.toLowerCase().includes(q) || name.toLowerCase().includes(q))).slice(0, 12)
        .map(([id]) => ({ id, label: geneLabel(id), hint: ECOLI_CORE.reactions.filter((r) => r.gpr.includes(id)).map((r) => r.id).join(', ') }));
    }
    return ECOLI_CORE.reactions.filter((r) => r.id !== BIOMASS_ID && !rxns.includes(r.id) && (q === '' || r.id.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))).slice(0, 12)
      .map((r) => ({ id: r.id, label: `${r.id} · ${r.name}`, hint: PATHWAY_LABEL[pathwayOf(r.id)] }));
  }, [query, koKind, genes, rxns]);
  const totalKo = genes.length + rxns.length;

  const growth = result ? roundGrowth(result.fba.growth) : null;
  const refGrowth = ref ? ref.fba.growth : null;
  const ratio = result && refGrowth ? (result.fba.growth / refGrowth) * 100 : null;
  const flux = (c: Computed | null, id: string) => (c && c.fba.status === 'optimal' ? c.fba.fluxes[id] ?? 0 : null);
  const mapData = mapView === 'referencia' ? ref : result;
  const mapDisabled = useMemo(() => new Set(mapData?.fba.disabled ?? preview), [mapData, preview]);

  const record = () => {
    if (!result) return;
    const f = (id: string) => (result.fba.status === 'optimal' ? roundFlux(result.fba.fluxes[id] ?? 0) : null);
    const rng = (id: string, k: 0 | 1) => (result.fva ? roundFlux(result.fva[id][k]) : null);
    const same = JSON.stringify(result.cond) === JSON.stringify(REFERENCE_CONDITION);
    api.addTrial('condiciones', {
      condicion: same ? 'referencia' : 'alterada', carbono: carbonLabel(result.cond.carbon), captacion: result.cond.uptake, oxigeno: result.cond.oxygen,
      eliminacion: knockoutText(result.cond), estado: result.fba.status === 'optimal' ? 'óptimo' : 'no factible', crecimiento: roundGrowth(result.fba.growth),
      relativo: ratio === null ? null : roundToTenth(ratio), consumoO2: f('EX_o2_e') === null ? null : Math.abs(f('EX_o2_e') as number), co2: f('EX_co2_e'), acetato: f('EX_ac_e'),
      acetatoMin: rng('EX_ac_e', 0), acetatoMax: rng('EX_ac_e', 1), etanol: f('EX_etoh_e'), formiato: f('EX_for_e'), lactato: f('EX_lac__D_e'), succinato: f('EX_succ_e'),
    });
  };

  const runScan = () => {
    try { const s = geneKnockoutScan(cond); setScan({ cond, ...s }); setError(null); } catch (e) { setError((e as Error).message); }
  };
  const essential = scan ? scan.rows.filter((r) => r.essential) : [];
  const reduced = scan ? scan.rows.filter((r) => !r.essential && r.ratio < 0.999) : [];

  const warn: string[] = [];
  if (result && result.fba.status !== 'optimal') warn.push('El problema no es factible: con estas restricciones no existe ningún vector de flujos que cumpla el balance de masa, los límites y el mantenimiento mínimo (ATPM ≥ 8,39 mmol/gDW/h). El modelo predice que no hay crecimiento.');
  if (result && result.fva && KEY_EXCHANGES.some((e) => result.fva![e.id][1] - result.fva![e.id][0] > 0.01)) warn.push('Hay óptimos alternativos: algunos flujos de intercambio pueden tomar distintos valores con el mismo crecimiento máximo. La tabla muestra el intervalo (FVA); el valor puntual es solo una de las soluciones.');
  if (carbon === 'for') warn.push('El formiato no aporta carbono para la biomasa en este modelo: espera un problema no factible.');

  const series = [
    ...(ref ? [{ label: 'Referencia (glucosa 10, sin eliminaciones)', color: 'var(--series-2)', kind: 'line' as const, dashed: true, points: ref.series.map((p) => ({ x: p.oxygen, y: p.growth })) }] : []),
    ...(result ? [{ label: `Condición actual (${carbonLabel(result.cond.carbon)} ${fmt(result.cond.uptake, 1)}${knockoutText(result.cond) !== 'ninguna' ? `, ${knockoutText(result.cond)}` : ''})`, color: 'var(--series-1)', kind: 'both' as const, points: result.series.map((p) => ({ x: p.oxygen, y: p.growth })) }] : []),
  ];

  return (
    <div className="lab-layout">
      <div className="stack">
        <Notice>
          <strong>Propósito:</strong> aprendes que el crecimiento que predice un modelo metabólico depende de las restricciones (nutriente, oxígeno y genes disponibles) al manipular la fuente de carbono, el oxígeno y las eliminaciones de genes o reacciones, y observar cómo cambian el crecimiento óptimo, los productos de fermentación y los flujos del mapa.
        </Notice>
        <div className="bench" tabIndex={0} role="region" aria-label="Mapa de rutas metabólicas (se desplaza horizontalmente)">
          <FluxMap fluxes={mapData && mapData.fba.status === 'optimal' ? mapData.fba.fluxes : null} disabled={mapDisabled} carbon={mapData?.cond.carbon ?? carbon} view={mapView} computed={mapData !== null} />
        </div>
        <div className="btn-row small" role="note" aria-label="Estatus de la escena">
          <StatusChip status="modelo" prefix="Mapa" /> <span className="muted">dibujado con las reacciones del modelo y los flujos calculados; la posición de los nodos es un diagrama, no la ubicación real en la célula.</span>
        </div>
        {ref && result && (
          <Segmented label="Flujos que muestra el mapa" value={mapView} onChange={setMapView} options={[{ value: 'actual', label: 'Condición actual' }, { value: 'referencia', label: 'Referencia' }]} />
        )}

        <div className="card stack">
          <h3>Resultado del FBA</h3>
          <Readout items={[
            { k: 'Crecimiento estimado', v: result ? (result.fba.status === 'optimal' ? `${fmt(growth, 4)} h⁻¹` : 'no factible (0 h⁻¹)') : 'pulsa «Calcular el óptimo»', data: true },
            { k: 'Relativo a la referencia', v: ratio === null ? '—' : `${fmt(roundToTenth(ratio), 1)} %`, data: true },
            { k: 'Tiempo de duplicación', v: result && result.fba.growth > 1e-6 ? `${fmt((Math.LN2 / result.fba.growth) * 60, 0)} min` : '—' },
            { k: 'Consumo de O₂', v: flux(result, 'EX_o2_e') === null ? '—' : `${fmt(Math.abs(roundFlux(flux(result, 'EX_o2_e')!)), 2)} mmol/gDW/h` },
            { k: 'Acetato secretado', v: flux(result, 'EX_ac_e') === null ? '—' : `${fmt(roundFlux(flux(result, 'EX_ac_e')!), 2)} mmol/gDW/h` },
            { k: 'Etanol secretado', v: flux(result, 'EX_etoh_e') === null ? '—' : `${fmt(roundFlux(flux(result, 'EX_etoh_e')!), 2)} mmol/gDW/h` },
          ]} />
          {error && <Notice kind="bad">{error}</Notice>}
          <Warnings list={warn} />
          {result && (
            <p className="small muted">
              Condición: {carbonLabel(result.cond.carbon)} hasta {fmt(result.cond.uptake, 1)} mmol/gDW/h, oxígeno {o2Text(result.cond.oxygen)}, eliminaciones: {knockoutText(result.cond)}.
              {result.fba.disabled.length > 0 && ` Reacciones apagadas por la regla GPR: ${result.fba.disabled.join(', ')}.`}
              {' '}Símplex: {result.fba.iterations} iteraciones; balance de masa |S·v| = {result.fba.status === 'optimal' ? fmtSig(result.fba.balanceResidual, 2) : '—'}.
            </p>
          )}
          {result && ref && (
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Comparación entre la referencia y la condición actual">
              <table>
                <caption className="small muted">Referencia frente a condición actual (mmol/gDW/h; negativo = captación, positivo = secreción o sentido de la ecuación). Intervalo: valores compatibles con el mismo óptimo (FVA al 100 %).</caption>
                <thead><tr><th scope="col">Flujo</th><th scope="col">Referencia</th><th scope="col">Condición actual</th><th scope="col">Intervalo (actual)</th></tr></thead>
                <tbody>
                  <tr><th scope="row">Crecimiento (h⁻¹)</th><td>{fmt(roundGrowth(ref.fba.growth), 4)}</td><td>{fmt(roundGrowth(result.fba.growth), 4)}</td><td>—</td></tr>
                  {[...KEY_EXCHANGES.map((e) => ({ id: e.id, label: `${e.label} (intercambio)` })), ...KEY_REACTIONS.map((r) => ({ id: r.id, label: `${r.label} · ${r.id}` }))].map((row) => {
                    const a = flux(ref, row.id), b = flux(result, row.id);
                    const rg = result.fva?.[row.id];
                    const off = result.fba.disabled.includes(row.id);
                    return (
                      <tr key={row.id}>
                        <th scope="row">{row.label}</th>
                        <td>{a === null ? '—' : fmt(roundFlux(a), 2)}</td>
                        <td>{off ? '0 (eliminada)' : b === null ? '—' : fmt(roundFlux(b), 2)}{b !== null && a !== null && Math.abs(b - a) > 0.5 ? (b > a ? ' ▲' : ' ▼') : ''}</td>
                        <td>{rg ? (Math.abs(rg[1] - rg[0]) < 0.005 ? 'único' : `${fmt(roundFlux(rg[0]), 2)} a ${fmt(roundFlux(rg[1]), 2)}`) : '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {result && <p className="small muted">▲ / ▼: el flujo sube o baja más de 0,5 mmol/gDW/h respecto a la referencia.</p>}
        </div>

        <div className="card stack">
          <h3>Crecimiento frente al oxígeno disponible</h3>
          <Chart title="Crecimiento óptimo estimado frente a la captación máxima de O₂" xLabel="Captación máxima de O₂ (mmol/gDW/h)" yLabel="Crecimiento óptimo (h⁻¹)"
            xUnit="mmol/gDW/h" yUnit="h⁻¹" height={260} series={series} xDomain={[0, 30]} exportName="fba-crecimiento-oxigeno"
            emptyText="Pulsa «Calcular el óptimo»: se calcula una serie de 31 FBA (O₂ de 0 a 30) con la fuente de carbono y las eliminaciones actuales." />
          <p className="small muted">Cada punto es un FBA completo con los mismos datos y solo cambia el límite de O₂ (Modelo calculado). Por encima de unos 21,8 mmol/gDW/h con glucosa 10, el oxígeno deja de limitar.</p>
        </div>

        <details className="card">
          <summary><strong>Tabla de las 95 reacciones del modelo</strong></summary>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Flujos de todas las reacciones" style={{ maxHeight: 360, overflow: 'auto' }}>
            <table>
              <caption className="small muted">Flujos en mmol/gDW/h (biomasa en h⁻¹). Vía: agrupación didáctica de este laboratorio (el archivo del modelo no trae subsistemas).</caption>
              <thead><tr><th scope="col">Reacción</th><th scope="col">Nombre en el modelo</th><th scope="col">Vía</th><th scope="col">Límites</th><th scope="col">Referencia</th><th scope="col">Actual</th><th scope="col">Regla GPR</th></tr></thead>
              <tbody>
                {ECOLI_CORE.reactions.map((r) => {
                  const a = flux(ref, r.id), b = flux(result, r.id);
                  return (
                    <tr key={r.id}>
                      <th scope="row" style={{ fontFamily: 'var(--font-data)' }}>{r.id}</th><td>{r.name}</td><td>{PATHWAY_LABEL[pathwayOf(r.id)]}</td>
                      <td>{`${fmt(r.lb, r.lb % 1 ? 2 : 0)} a ${fmt(r.ub, 0)}`}</td>
                      <td>{a === null ? '—' : fmt(r.id === BIOMASS_ID ? roundGrowth(a) : roundFlux(a), r.id === BIOMASS_ID ? 4 : 2)}</td>
                      <td>{result?.fba.disabled.includes(r.id) ? '0 (eliminada)' : b === null ? '—' : fmt(r.id === BIOMASS_ID ? roundGrowth(b) : roundFlux(b), r.id === BIOMASS_ID ? 4 : 2)}</td>
                      <td className="small" style={{ fontFamily: 'var(--font-data)' }}>{r.gpr || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="small muted">Límites de la condición actual: la fuente de carbono elegida tiene límite inferior −captación, las demás fuentes de carbono 0, y el O₂ −captación de oxígeno. Esta tabla muestra los límites originales del archivo.</p>
        </details>

        <div className="card stack">
          <h3>Genes esenciales en la condición actual</h3>
          <p className="small">Elimina uno por uno los 137 genes del modelo con la fuente de carbono, el oxígeno y las eliminaciones actuales. Un gen se considera esencial si el crecimiento predicho cae por debajo del {fmt(ESSENTIAL_THRESHOLD * 100, 0)} % del óptimo de esa condición (umbral por defecto de COBRApy).</p>
          <div className="btn-row"><button type="button" className="btn" onClick={runScan}>Buscar genes esenciales</button></div>
          {scan && (
            <>
              <p className="small" aria-live="polite">
                {essential.length} genes esenciales y {reduced.length} con crecimiento reducido (sin ser esenciales) para {carbonLabel(scan.cond.carbon)}, oxígeno {o2Text(scan.cond.oxygen)}{(scan.cond.geneKnockouts?.length || scan.cond.reactionKnockouts?.length) ? `, con ${knockoutText(scan.cond)}` : ''} (μ = {fmt(roundGrowth(scan.wildType), 4)} h⁻¹).
              </p>
              <div className="table-wrap" tabIndex={0} role="region" aria-label="Genes esenciales y genes con crecimiento reducido" style={{ maxHeight: 280, overflow: 'auto' }}>
                <table>
                  <thead><tr><th scope="col">Gen</th><th scope="col">Crecimiento sin el gen (h⁻¹)</th><th scope="col">Relativo</th><th scope="col">Predicción</th><th scope="col">Reacciones apagadas</th></tr></thead>
                  <tbody>
                    {[...essential, ...reduced].map((r) => (
                      <tr key={r.id}>
                        <th scope="row">{geneLabel(r.id)}</th>
                        <td>{r.status === 'optimal' ? fmt(roundGrowth(r.growth), 4) : 'no factible'}</td>
                        <td>{fmt(roundToTenth(r.ratio * 100), 1)} %</td>
                        <td>{r.essential ? 'esencial' : 'crecimiento reducido'}</td>
                        <td style={{ fontFamily: 'var(--font-data)' }}>{r.disabled.join(', ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="small muted">Predicción del modelo (Modelo calculado). No se compara aquí con colecciones experimentales de mutantes: no se incluyó una fuente verificada. Un gen «no esencial» en el modelo puede ser importante en la célula real.</p>
            </>
          )}
        </div>

        <details className="card">
          <summary><strong>Concepciones erróneas frecuentes</strong></summary>
          <ul className="list small">
            <li>«El FBA mide cuánto crece la bacteria»: calcula el crecimiento máximo compatible con las restricciones; es un óptimo del modelo, no una medición.</li>
            <li>«Si quitar un gen no cambia el crecimiento predicho, el gen no sirve»: el modelo no tiene regulación ni cinética, y una isoenzima del modelo puede no expresarse en la célula en esas condiciones; además el gen puede tener funciones fuera del metabolismo central.</li>
            <li>«El mapa muestra lo que hace la célula»: muestra una de las soluciones óptimas; con óptimos alternativos otros flujos dan el mismo crecimiento (mira el intervalo FVA).</li>
            <li>«Sin oxígeno la bacteria no puede crecer»: el modelo predice crecimiento por fermentación, más lento y con secreción de acetato, etanol y formiato.</li>
            <li>«El FBA simula el tiempo»: es un estado estacionario; no dice cómo cambian las concentraciones con el tiempo (eso requiere un modelo dinámico).</li>
          </ul>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Medio de cultivo</h3>
          <Select label="Fuente de carbono" value={carbon} onChange={(v) => change(() => setCarbon(v as CarbonId))}
            options={CARBON_SOURCES.map((c) => ({ value: c.id, label: `${c.label} (${c.exchange})` }))} />
          <Slider label="Captación máxima de la fuente de carbono" value={uptake} min={FBA_LIMITS.uptake[0]} max={FBA_LIMITS.uptake[1]} step={0.5} unit="mmol/gDW/h" decimals={1}
            onChange={(v) => change(() => setUptake(v))} hint="Límite inferior del intercambio = −captación. El valor de referencia del modelo es 10." />
          <Segmented label="Oxígeno disponible" value={o2Mode} onChange={(v) => change(() => setO2Mode(v))}
            options={[{ value: 'ilimitado', label: 'Sin límite' }, { value: 'limitado', label: 'Limitado' }, { value: 'sin', label: 'Sin oxígeno' }]} />
          {o2Mode === 'limitado' && (
            <Slider label="Captación máxima de O₂" value={o2} min={0} max={30} step={0.5} unit="mmol/gDW/h" decimals={1} onChange={(v) => change(() => setO2(v))} />
          )}
        </div>

        <div className="card stack">
          <h3>Eliminaciones</h3>
          <Segmented label="Eliminar un" value={koKind} onChange={(v) => { setKoKind(v); setQuery(''); }} options={[{ value: 'gen', label: 'Gen' }, { value: 'reaccion', label: 'Reacción' }]} />
          <div className="field">
            <label htmlFor="fba-search">{koKind === 'gen' ? 'Buscar gen (nombre o locus b)' : 'Buscar reacción (identificador o nombre)'}</label>
            <input id="fba-search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={koKind === 'gen' ? 'p. ej., pgi o b4025' : 'p. ej., PFK o citrate'} aria-describedby="fba-search-h" />
            <span id="fba-search-h" className="hint">{totalKo}/{FBA_LIMITS.maxKnockouts} eliminaciones. Se muestran hasta 12 coincidencias.</span>
          </div>
          <ul className="list" aria-label="Coincidencias" style={{ listStyle: 'none', paddingLeft: 0, margin: 0, maxHeight: 220, overflow: 'auto' }} tabIndex={0}>
            {matches.map((m) => (
              <li key={m.id} style={{ marginBottom: 4 }}>
                <button type="button" className="btn small" disabled={totalKo >= FBA_LIMITS.maxKnockouts} aria-label={`Eliminar ${m.label}`}
                  onClick={() => change(() => (koKind === 'gen' ? setGenes((g) => [...g, m.id]) : setRxns((r) => [...r, m.id])))}>
                  Eliminar {m.label}
                </button>
                <span className="small muted"> {m.hint}</span>
              </li>
            ))}
            {matches.length === 0 && <li className="small muted">Sin coincidencias.</li>}
          </ul>
          {totalKo > 0 && (
            <div className="stack-sm">
              <span className="small" style={{ fontWeight: 600 }}>Eliminados</span>
              <div className="btn-row">
                {genes.map((g) => <button key={g} type="button" className="btn small ghost" aria-label={`Quitar la eliminación del gen ${geneLabel(g)}`} onClick={() => change(() => setGenes((x) => x.filter((y) => y !== g)))}>Δ{geneLabel(g)} ✕</button>)}
                {rxns.map((r) => <button key={r} type="button" className="btn small ghost" aria-label={`Quitar la eliminación de la reacción ${r}`} onClick={() => change(() => setRxns((x) => x.filter((y) => y !== r)))}>sin {r} ✕</button>)}
              </div>
              <span className="small muted">{preview.length ? `Reacciones que se apagan: ${preview.join(', ')}.` : 'Ninguna reacción se apaga: otra enzima del modelo (isoenzima) cubre la función.'}</span>
            </div>
          )}
        </div>

        <div className="card stack">
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={calc}>Calcular el óptimo</button>
            <button type="button" className="btn" disabled={!result || result.fba.status !== 'optimal'} onClick={() => result && setReference(result)}>Usar como referencia</button>
          </div>
          <RecordButton onRecord={record} disabled={!result} label="Guardar condición en la tabla" />
          <p className="small muted">Referencia inicial: glucosa 10 mmol/gDW/h, oxígeno sin límite y sin eliminaciones.{ref && JSON.stringify(ref.cond) !== JSON.stringify(REFERENCE_CONDITION) ? ` Referencia actual: ${carbonLabel(ref.cond.carbon)} ${fmt(ref.cond.uptake, 1)}, O₂ ${o2Text(ref.cond.oxygen)}, ${knockoutText(ref.cond)}.` : ''}</p>
        </div>

        <div className="card stack-sm small">
          <div><StatusChip status="modelo" prefix="Crecimiento y flujos" /></div>
          <span className="muted">{STATUS_HELP.modelo} Predicción de un modelo basado en restricciones (FBA), no una medición: no incluye regulación, cinética ni espacio, y da un óptimo posible, no lo que la célula necesariamente hace.</span>
          <span><strong>Modelo:</strong> {MODEL_PROVENANCE.modelId}, archivo {MODEL_PROVENANCE.file}; exportado el {MODEL_PROVENANCE.exported}. {MODEL_PROVENANCE.reference}</span>
          <span className="muted">{MODEL_PROVENANCE.referenceNote} Validado contra {MODEL_PROVENANCE.validation}: glucosa aerobia 0,873922 h⁻¹ y anaerobia 0,211663 h⁻¹.</span>
        </div>
      </div>
    </div>
  );
}

function roundToTenth(v: number): number {
  return Math.round(v * 10) / 10;
}
