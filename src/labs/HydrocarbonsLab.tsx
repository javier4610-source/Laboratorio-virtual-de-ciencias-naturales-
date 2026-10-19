import { useMemo, useState } from 'react';
import { Chart } from '../components/Chart';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { StructureSvg } from '../components/organica/StructureSvg';
import { OrganicViewer3D } from '../components/organica/OrganicViewer3D';
import { ExpValue, PubChemLink, SourceList, StatusLine, TestTubeSvg } from '../components/organica/OrganicParts';
import { Molecule3D, Reaction3D, moleculeSpecies, type Reaction3DDef } from '../chem';
import { getOrganic, prettyHill, ORGANIC_RECORDS, type OrganicRecord } from '../data/quimica/organica';
import { orgSpecies } from '../data/quimica/organicaSpecies';
import {
  boilingPoint, bondSummary, butaneConformation, carbonCount, combustionEnergy, combustionEquation, COMBUSTION_LABEL, dihedralDeg, ethaneConformation,
  FAMILY_LABEL, GENERAL_FORMULA, hybridOf, HYBRID_LABEL, hydrogenCount, IDEAL_ANGLE, liquidDensity, meltingPoint, measureConformer, monohalogenation,
  phaseAt25, rotateAboutBond, SERIES, unsaturationTest, type CombustionKind, type Family, type UnsatTest, type XYZAtom,
} from '../models/hydrocarbons';
import { parseSmiles } from '../models/organicGraph';
import { nameMolecule } from '../models/organicNomenclature';
import { fmt } from '../lib/format';
import { playSound } from '../lib/sound';
import type { LabProps } from './registry';

type Station = 'series' | 'hibridacion' | 'isomeria' | 'conformaciones' | 'combustion' | 'reacciones';
const STATIONS: { value: Station; label: string }[] = [
  { value: 'series', label: '1 · Series homólogas' },
  { value: 'hibridacion', label: '2 · Hibridación' },
  { value: 'isomeria', label: '3 · Isomería' },
  { value: 'conformaciones', label: '4 · Conformaciones' },
  { value: 'combustion', label: '5 · Combustión' },
  { value: 'reacciones', label: '6 · Reacciones' },
];

const nameOf = (r: OrganicRecord) => { const n = nameMolecule(parseSmiles(r.smiles)); return n.ok ? n : null; };
const deg = (v: number) => `${fmt(v, 1)}°`;
const ang = (v: number) => `${fmt(v, 3)} Å`;

/* ------------------------------------------------------------------ 1 · series homólogas */

function SeriesStation({ api }: LabProps) {
  const [family, setFamily] = useState<Family>('alcano');
  const [n, setN] = useState(1);
  const ids = SERIES[family];
  const minN = family === 'alcano' ? 1 : 2;
  const nn = Math.max(minN, Math.min(10, n));
  const rec = getOrganic(ids[nn - minN]);
  const nm = nameOf(rec);
  const tEb = boilingPoint(rec), tFus = meltingPoint(rec), dens = liquidDensity(rec);
  const species = useMemo(() => orgSpecies(rec.id), [rec.id]);
  const mol = useMemo(() => parseSmiles(rec.smiles), [rec.smiles]);
  const H = hydrogenCount(rec), C = carbonCount(rec);
  const expectedH = family === 'alcano' ? 2 * C + 2 : family === 'alqueno' ? 2 * C : 2 * C - 2;
  const series = (Object.keys(SERIES) as Family[]).map((f, k) => ({
    label: FAMILY_LABEL[f], color: `var(--series-${k + 1})`, kind: 'both' as const,
    points: SERIES[f].map((id) => getOrganic(id)).filter((r) => r.propiedades.tEb).map((r) => ({ x: carbonCount(r), y: r.propiedades.tEb!.valor, label: r.nombre })),
  }));
  const missingAlk = SERIES.alquino.map((id) => getOrganic(id)).filter((r) => !r.propiedades.tEb).map((r) => r.nombre);
  const record = () => api.addTrial('series', {
    familia: FAMILY_LABEL[family], compuesto: nm?.es ?? rec.nombre, n: C, formula: rec.formula, tEb: tEb?.value ?? null, tFus: tFus?.value ?? null,
    densidad: dens.ok?.value ?? null, estado: phaseAt25(rec) ?? '—', fuente: `PubChem CID ${rec.cid} (PUG View, ${rec.fecha})`,
  });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>{nm?.es ?? rec.nombre} <span className="muted small">({prettyHill(rec.formula)})</span></h3>
          <Molecule3D species={species} idPrefix="hcb-ser" height={280} measure />
          <StructureSvg mol={mol} mode="condensada" title={`Fórmula estructural condensada de ${nm?.es ?? rec.nombre}`} height={150} />
          <p className="small muted">Fórmula estructural: ilustración en 2D. La forma 3D es el confórmero calculado por PubChem.</p>
        </div>
        <div className="card stack">
          <h3>Temperatura de ebullición frente al número de carbonos</h3>
          <StatusLine status="experimental" prefix="Datos">puntos de ebullición publicados (PubChem, Hazardous Substances Data Bank, que cita el CRC Handbook u otras obras); cada punto lleva su fuente en la tabla.</StatusLine>
          <Chart series={series} xLabel="Número de carbonos" yLabel="Temperatura de ebullición" yUnit="°C" title="Tₑb de alcanos, 1-alquenos y 1-alquinos" exportName="hidrocarburos-teb" height={300} />
          <p className="small muted">Sin información disponible en PubChem (consulta del {rec.fecha}) para: {missingAlk.join(', ')}. No se rellenan con estimaciones.</p>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Segmented label="Familia" value={family} onChange={(f) => { setFamily(f); if (f !== 'alcano' && n < 2) setN(2); }} options={(Object.keys(SERIES) as Family[]).map((f) => ({ value: f, label: f === 'alcano' ? 'Alcanos' : f === 'alqueno' ? 'Alquenos' : 'Alquinos' }))} />
          <Slider label="Número de carbonos n" value={nn} min={minN} max={10} step={1} decimals={0} onChange={setN} />
          <Readout items={[
            { k: 'Nombre IUPAC (motor del laboratorio)', v: nm?.es ?? '—' },
            { k: 'Fórmula molecular', v: prettyHill(rec.formula), data: true },
            { k: `Fórmula general ${GENERAL_FORMULA[family]}`, v: H === expectedH ? `H = ${expectedH} ✓` : `H = ${H}` },
            { k: 'Tₑb (experimental)', v: <ExpValue p={tEb} decimals={1} />, data: true },
            { k: 'T de fusión (experimental)', v: <ExpValue p={tFus} decimals={1} />, data: true },
            { k: 'Densidad del líquido (20–25 °C)', v: dens.ok ? `${fmt(dens.ok.value, 3)} g/cm³` : 'No comparable', data: true },
            { k: 'Estado a 25 °C y 1 atm', v: phaseAt25(rec) ?? 'Sin información' },
          ]} />
          <RecordButton onRecord={record} />
          <p className="small">Ficha en PubChem: <PubChemLink rec={rec} /> · nombre de PubChem (LexiChem): <em>{rec.nombreIupac}</em></p>
        </div>
        <details className="card">
          <summary>Fuentes de los datos de {nm?.es ?? rec.nombre}</summary>
          <SourceList items={[{ label: 'Tₑb', p: tEb }, { label: 'T de fusión', p: tFus }, { label: 'Densidad', p: dens.ok, motivo: dens.motivo }]} />
        </details>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 2 · hibridación y geometría */

const HYB_IDS = ['metano', 'etano', 'eteno', 'etino', 'propano', 'propeno', 'propino', 'buta-1,3-dieno', 'but-2-ino'];

function HybridStation({ api }: LabProps) {
  const [id, setId] = useState('etano');
  const rec = getOrganic(id);
  const species = useMemo(() => orgSpecies(id), [id]);
  const meas = useMemo(() => measureConformer(species.atoms, species.bonds), [species]);
  const summary = bondSummary(meas.bonds);
  const nm = nameOf(rec);
  const carbons = species.atoms.map((a, i) => (a.el === 'C' ? i : -1)).filter((i) => i >= 0);
  const byHyb = (['sp3', 'sp2', 'sp'] as const).map((h) => {
    const list = meas.angles.filter((a) => a.hybrid === h);
    return { h, n: list.length, mean: list.length ? list.reduce((s, a) => s + a.angle, 0) / list.length : null };
  }).filter((x) => x.n);
  const cc = summary.filter((s) => /^C[–=≡]C$/.test(s.kind));
  const record = () => {
    for (const s of cc) {
      const order = s.kind.includes('≡') ? 3 : s.kind.includes('=') ? 2 : 1;
      const b = meas.bonds.find((x) => x.kind === s.kind)!;
      const h = hybridOf(species.bonds, b.a);
      api.addTrial('geometria', { compuesto: nm?.es ?? rec.nombre, enlace: s.kind, ordenEnlace: order, longitud: Number(s.mean.toFixed(3)), hibridacion: HYBRID_LABEL[h], angulo: byHyb.find((x) => x.h === h)?.mean ?? null, anguloIdeal: IDEAL_ANGLE[h], fuente: `PubChem3D CID ${rec.cid}` });
    }
  };
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>{nm?.es ?? rec.nombre}: hibridación de cada carbono</h3>
          <Molecule3D species={species} idPrefix="hcb-hib" height={300} measure />
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Longitudes de enlace medidas">
            <table>
              <caption className="small muted">Longitudes medidas sobre el confórmero de PubChem (Modelo calculado: coordenadas MMFF94s)</caption>
              <thead><tr><th>Enlace</th><th>Cantidad</th><th>Promedio</th><th>Mínimo–máximo</th></tr></thead>
              <tbody>{summary.map((s) => <tr key={s.kind}><td>{s.kind}</td><td>{s.n}</td><td>{ang(s.mean)}</td><td>{fmt(s.min, 3)}–{fmt(s.max, 3)} Å</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Molécula" value={id} onChange={setId} options={HYB_IDS.map((x) => ({ value: x, label: `${nameOf(getOrganic(x))?.es ?? x} (${prettyHill(getOrganic(x).formula)})` }))} />
          <Readout items={[
            ...carbons.map((c, k) => ({ k: `Carbono ${k + 1}`, v: `${HYBRID_LABEL[hybridOf(species.bonds, c)]} (ideal ${fmt(IDEAL_ANGLE[hybridOf(species.bonds, c)], 1)}°)` })),
            ...byHyb.map((x) => ({ k: `Ángulo medio en C ${HYBRID_LABEL[x.h]}`, v: deg(x.mean!), data: true })),
            ...cc.map((s) => ({ k: `Longitud ${s.kind}`, v: ang(s.mean), data: true })),
          ]} />
          <RecordButton onRecord={record} label="Guardar los enlaces C–C de esta molécula" />
          <p className="small muted">Toca dos átomos en el modelo (o usa las listas) para medir una distancia, o tres para un ángulo.</p>
        </div>
        <div className="card stack small">
          <h3>Qué observar</h3>
          <p>sp³ (4 dominios, tetraédrico, ≈ 109,5°), sp² (3 dominios, trigonal plano, ≈ 120°) y sp (2 dominios, lineal, 180°). Cuantos más enlaces comparten dos carbonos, más corto es el enlace: C–C &gt; C=C &gt; C≡C.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 3 · isomería */

const ISO_GROUPS: Record<string, { label: string; ids: string[] }> = {
  c5: { label: 'C₅H₁₂ (isómeros de cadena)', ids: ['pentano', 'isopentano', 'neopentano'] },
  c6: { label: 'C₆H₁₄ (isómeros de cadena)', ids: ['hexano', '2-metilpentano', '3-metilpentano', '2,3-dimetilbutano', '2,2-dimetilbutano'] },
  c4h8: { label: 'C₄H₈ (posición y geométricos)', ids: ['but-1-eno', 'cis-but-2-eno', 'trans-but-2-eno', 'isobuteno'] },
};

function IsomerStation({ api }: LabProps) {
  const [group, setGroup] = useState('c5');
  const [id, setId] = useState('pentano');
  const g = ISO_GROUPS[group];
  const cur = g.ids.includes(id) ? id : g.ids[0];
  const rec = getOrganic(cur);
  const species = useMemo(() => orgSpecies(cur), [cur]);
  const rows = g.ids.map((x) => {
    const r = getOrganic(x); const n = nameOf(r);
    return { id: x, r, n, chain: n?.parent.size ?? 0, tEb: boilingPoint(r), tFus: meltingPoint(r) };
  });
  const chartSeries = [{ label: g.label, color: 'var(--series-1)', kind: 'scatter' as const, points: rows.filter((x) => x.tEb).map((x) => ({ x: x.chain, y: x.tEb!.value, label: x.n?.es })) }];
  const record = () => {
    const x = rows.find((r) => r.id === cur)!;
    api.addTrial('isomeros', { grupo: g.label, compuesto: x.n?.es ?? x.r.nombre, formula: x.r.formula, cadenaPrincipal: x.chain, ramificaciones: carbonCount(x.r) - x.chain, tEb: x.tEb?.value ?? null, tFus: x.tFus?.value ?? null, fuente: `PubChem CID ${x.r.cid}` });
  };
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>{rows.find((r) => r.id === cur)?.n?.es}</h3>
          <Molecule3D species={species} idPrefix="hcb-iso" height={260} measure={group === 'c4h8'} />
          <div className="iso-grid" style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))' }}>
            {rows.map((x) => (
              <button key={x.id} type="button" className="card" aria-pressed={x.id === cur} onClick={() => setId(x.id)} style={{ padding: 8, textAlign: 'left', cursor: 'pointer', borderColor: x.id === cur ? 'var(--accent)' : undefined }}>
                <StructureSvg mol={parseSmiles(x.r.smiles)} title={`Estructura de ${x.n?.es}`} width={220} height={110} highlight={x.n?.parent.atoms} mainChain={x.n?.parent.kind === 'cadena' ? x.n.parent.atoms : undefined} />
                <span className="small" style={{ fontWeight: 700 }}>{x.n?.es}</span><br />
                <span className="small muted">Tₑb {x.tEb ? `${fmt(x.tEb.value, 1)} °C` : '—'}</span>
              </button>
            ))}
          </div>
          <p className="small muted">Resaltada en color, la cadena principal que elige el motor de nomenclatura. Dibujo 2D: ilustración.</p>
        </div>
        <div className="card stack">
          <h3>Ramificación y temperatura de ebullición</h3>
          <StatusLine status="experimental" prefix="Datos">Tₑb publicadas (PubChem/HSDB). Eje x: carbonos de la cadena principal (menos carbonos en la cadena = más ramificado).</StatusLine>
          <Chart series={chartSeries} xLabel="Carbonos en la cadena principal" yLabel="Temperatura de ebullición" yUnit="°C" title={`Tₑb de los isómeros ${g.label}`} exportName="isomeros-teb" height={260} />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Segmented label="Grupo de isómeros" value={group} onChange={(v) => { setGroup(v); setId(ISO_GROUPS[v].ids[0]); }} options={Object.entries(ISO_GROUPS).map(([k, v]) => ({ value: k, label: v.label.split(' ')[0] }))} />
          <Readout items={[
            { k: 'Nombre IUPAC', v: rows.find((r) => r.id === cur)?.n?.es ?? '—' },
            { k: 'Fórmula molecular', v: prettyHill(rec.formula), data: true },
            { k: 'Carbonos en la cadena principal', v: String(rows.find((r) => r.id === cur)?.chain ?? '—'), data: true },
            { k: 'Tₑb (experimental)', v: <ExpValue p={boilingPoint(rec)} />, data: true },
            { k: 'T de fusión (experimental)', v: <ExpValue p={meltingPoint(rec)} />, data: true },
          ]} />
          <RecordButton onRecord={record} />
          <p className="small">Fuente: <PubChemLink rec={rec} /></p>
        </div>
        {group === 'c4h8' && (
          <div className="card stack small">
            <h3>Isomería geométrica (cis/trans)</h3>
            <p>El doble enlace no gira libremente: en el (Z)-but-2-eno (cis) los dos metilos quedan del mismo lado; en el (E) (trans), en lados opuestos. Mide el diedro C–C=C–C en el modelo: ≈ 0° (cis) o ≈ 180° (trans).</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 4 · conformaciones (ilustración) */

function NewmanSvg({ atoms, front, back, title }: { atoms: XYZAtom[]; front: { c: number; subs: { i: number; label: string }[] }; back: { c: number; subs: { i: number; label: string }[] }; title: string }) {
  const F = atoms[front.c], B = atoms[back.c];
  const ax = [B.x - F.x, B.y - F.y, B.z - F.z]; const L = Math.hypot(...ax); const k = ax.map((v) => v / L);
  const ref = Math.abs(k[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const cr = (u: number[], v: number[]) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  let u = cr(k, ref); const ul = Math.hypot(...u); u = u.map((x) => x / ul);
  const v = cr(k, u);
  const proj = (i: number, o: XYZAtom) => { const p = atoms[i]; const d = [p.x - o.x, p.y - o.y, p.z - o.z]; const x = d[0] * u[0] + d[1] * u[1] + d[2] * u[2], y = d[0] * v[0] + d[1] * v[1] + d[2] * v[2]; const l = Math.hypot(x, y) || 1; return { x: x / l, y: y / l }; };
  const R = 46, cx = 110, cy = 110;
  return (
    <svg viewBox="0 0 220 220" role="img" aria-label={title} style={{ width: '100%', maxWidth: 240 }}>
      {back.subs.map((s) => { const p = proj(s.i, B); return (
        <g key={`b${s.i}`}>
          <line x1={cx + p.x * R} y1={cy - p.y * R} x2={cx + p.x * 92} y2={cy - p.y * 92} stroke="var(--ink-2)" strokeWidth={3} />
          <text x={cx + p.x * 102} y={cy - p.y * 102 + 4} textAnchor="middle" style={{ fontSize: 12, fill: s.label === 'H' ? 'var(--ink-2)' : 'var(--series-2)', fontWeight: 700 }}>{s.label}</text>
        </g>); })}
      <circle cx={cx} cy={cy} r={R} fill="var(--surface)" stroke="var(--ink)" strokeWidth={2.5} />
      {front.subs.map((s) => { const p = proj(s.i, F); return (
        <g key={`f${s.i}`}>
          <line x1={cx} y1={cy} x2={cx + p.x * 80} y2={cy - p.y * 80} stroke="var(--ink)" strokeWidth={3} />
          <text x={cx + p.x * 90} y={cy - p.y * 90 + 4} textAnchor="middle" style={{ fontSize: 12, fill: s.label === 'H' ? 'var(--ink)' : 'var(--series-1)', fontWeight: 700 }}>{s.label}</text>
        </g>); })}
      <circle cx={cx} cy={cy} r={3.5} fill="var(--ink)" />
    </svg>
  );
}

function EnergySketch({ phi, kind }: { phi: number; kind: 'etano' | 'butano' }) {
  const W = 300, Hh = 130, pad = 18;
  const E = (p: number) => { const r = (p * Math.PI) / 180; return kind === 'etano' ? (1 + Math.cos(3 * r)) / 2 : (0.6 * (1 + Math.cos(r)) + 1 * (1 + Math.cos(3 * r))) / 3.2; };
  const pts = Array.from({ length: 73 }, (_, i) => i * 5).map((p) => `${pad + (p / 360) * (W - 2 * pad)},${Hh - pad - E(p) * (Hh - 2 * pad)}`).join(' ');
  const px = pad + (((phi % 360) + 360) % 360 / 360) * (W - 2 * pad), py = Hh - pad - E(phi) * (Hh - 2 * pad);
  return (
    <svg viewBox={`0 0 ${W} ${Hh}`} role="img" aria-label={`Curva cualitativa de energía frente al ángulo de giro (ilustración, sin valores): ángulo actual ${fmt(phi, 0)}°`} style={{ width: '100%', maxWidth: 360 }}>
      <line x1={pad} y1={Hh - pad} x2={W - pad} y2={Hh - pad} stroke="var(--line-strong)" />
      <line x1={pad} y1={pad / 2} x2={pad} y2={Hh - pad} stroke="var(--line-strong)" />
      <polyline points={pts} fill="none" stroke="var(--model-curve, var(--series-1))" strokeWidth={2.5} strokeDasharray="6 3" />
      <circle cx={px} cy={py} r={6} fill="var(--data)" stroke="var(--surface)" strokeWidth={2} />
      {[0, 60, 120, 180, 240, 300, 360].map((d) => <text key={d} x={pad + (d / 360) * (W - 2 * pad)} y={Hh - 4} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{d}°</text>)}
      <text x={pad + 4} y={12} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>energía (forma cualitativa)</text>
    </svg>
  );
}

function ConformationStation() {
  const [mol, setMol] = useState<'etano' | 'butano'>('etano');
  const [rot, setRot] = useState(0);
  const sp = useMemo(() => orgSpecies(mol), [mol]);
  const geo = useMemo(() => {
    const atoms = sp.atoms, bonds = sp.bonds;
    const C = atoms.map((a, i) => (a.el === 'C' ? i : -1)).filter((i) => i >= 0);
    const nb = (i: number) => bonds.filter((b) => b.a === i || b.b === i).map((b) => (b.a === i ? b.b : b.a));
    let a: number, b: number;
    if (mol === 'etano') { [a, b] = C; } else {
      // carbonos internos: los dos con dos vecinos carbono
      const inner = C.filter((c) => nb(c).filter((x) => atoms[x].el === 'C').length === 2);
      [a, b] = inner;
    }
    return { a, b, nb };
  }, [sp, mol]);
  const atoms = useMemo(() => rotateAboutBond(sp.atoms, sp.bonds, geo.a, geo.b, rot), [sp, geo, rot]);
  const subsOf = (c: number, other: number) => geo.nb(c).filter((x) => x !== other).map((i) => ({ i, label: atoms[i].el === 'C' ? 'CH₃' : 'H' }));
  const front = { c: geo.a, subs: subsOf(geo.a, geo.b) }, back = { c: geo.b, subs: subsOf(geo.b, geo.a) };
  let phi: number, conf: string, refPair: string;
  if (mol === 'etano') {
    const hs = (c: number, o: number) => geo.nb(c).filter((x) => x !== o);
    let min = 999;
    for (const h1 of hs(geo.a, geo.b)) for (const h2 of hs(geo.b, geo.a)) { const d = Math.abs(dihedralDeg(atoms[h1], atoms[geo.a], atoms[geo.b], atoms[h2])); if (d < min) min = d; }
    phi = min; conf = ethaneConformation(min); refPair = 'menor diedro H–C–C–H';
  } else {
    const c1 = geo.nb(geo.a).find((x) => atoms[x].el === 'C' && x !== geo.b)!, c4 = geo.nb(geo.b).find((x) => atoms[x].el === 'C' && x !== geo.a)!;
    phi = dihedralDeg(atoms[c1], atoms[geo.a], atoms[geo.b], atoms[c4]); conf = butaneConformation(phi); refPair = 'diedro C1–C2–C3–C4';
  }
  const phi0 = mol === 'etano' ? phi : ((phi % 360) + 360) % 360;
  const presets = mol === 'etano'
    ? [{ l: 'Alternada', target: 60 }, { l: 'Eclipsada', target: 0 }]
    : [{ l: 'Anti', target: 180 }, { l: 'Gauche', target: 60 }, { l: 'Eclipsada', target: 120 }, { l: 'Totalmente eclipsada', target: 0 }];
  const goTo = (target: number) => {
    // ajuste exacto: se gira la diferencia entre el diedro actual y el buscado
    const cur = mol === 'etano' ? phi : phi0;
    let d = target - cur;
    if (mol === 'etano') { d = ((target - phi + 60) % 120 + 120) % 120 - 60; }
    setRot((r) => Math.round((((r + d) % 360) + 360) % 360));
    playSound('click', { intensity: 0.4 });
  };
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Conformaciones del {mol}</h3>
          <OrganicViewer3D atoms={atoms} bonds={sp.bonds} idPrefix="hcb-conf" viewKey={mol} status="ilustracion" statusPrefix="Conformación"
            provenance={<>confórmero de PubChem (CID {sp.source?.cid}) con un grupo girado rígidamente alrededor del enlace C–C: las longitudes y ángulos no se reoptimizan y la energía no se calcula.</>}
            ariaLabel={`Modelo 3D del ${mol} en conformación ${conf}`} highlight={[geo.a, geo.b]} styleLabel="Estilo del modelo de conformaciones" />
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', alignItems: 'center' }}>
            <figure style={{ margin: 0 }}>
              <NewmanSvg atoms={atoms} front={front} back={back} title={`Proyección de Newman del ${mol} (${conf}), calculada con las coordenadas del modelo`} />
              <figcaption className="small muted">Proyección de Newman calculada con las mismas coordenadas: carbono delantero (centro) y trasero (círculo).</figcaption>
            </figure>
            <figure style={{ margin: 0 }}>
              <EnergySketch phi={mol === 'etano' ? phi : phi0} kind={mol} />
              <figcaption className="small muted">Ilustración educativa: forma cualitativa de la energía (mínimos en las alternadas, máximos en las eclipsadas). No muestra valores.</figcaption>
            </figure>
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Segmented label="Molécula" value={mol} onChange={(v) => { setMol(v); setRot(0); }} options={[{ value: 'etano', label: 'Etano' }, { value: 'butano', label: 'Butano (C2–C3)' }]} />
          <Slider label="Giro del grupo trasero" value={rot} min={0} max={355} step={5} decimals={0} unit="°" onChange={setRot} />
          <div className="btn-row">{presets.map((p) => <button key={p.l} type="button" className="btn small" onClick={() => goTo(p.target)}>{p.l}</button>)}</div>
          <Readout items={[
            { k: `Ángulo ${refPair}`, v: deg(mol === 'etano' ? phi : Math.abs(((phi + 540) % 360) - 180)), data: true },
            { k: 'Conformación', v: conf },
          ]} />
          <p className="small muted">La rotación alrededor de un enlace sencillo es libre a temperatura ambiente: las conformaciones se interconvierten continuamente. No son isómeros que se puedan separar.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 5 · combustión */

const FUELS = ['metano', 'etano', 'propano', 'butano', 'pentano', 'hexano', 'heptano', 'octano', 'nonano', 'decano', 'isooctano', 'eteno', 'buta-1,3-dieno', 'etino', 'ciclohexano', 'benceno'];

function useCombustionReactions(): { id: string; label: string; def: Reaction3DDef }[] {
  return useMemo(() => [
    { id: 'ch4', label: 'Combustión completa del metano', def: { id: 'hcb-ch4', title: 'Combustión completa del metano', reactants: [{ species: moleculeSpecies('metano'), coef: 1, formula: 'CH4', name: 'metano' }, { species: moleculeSpecies('oxigeno'), coef: 2, formula: 'O2', name: 'oxígeno' }], products: [{ species: moleculeSpecies('co2'), coef: 1, formula: 'CO2', name: 'dióxido de carbono' }, { species: moleculeSpecies('agua'), coef: 2, formula: 'H2O', name: 'agua' }] } },
    { id: 'ch4co', label: 'Combustión incompleta del metano (CO)', def: { id: 'hcb-ch4co', title: 'Combustión incompleta del metano', reactants: [{ species: moleculeSpecies('metano'), coef: 2, formula: 'CH4', name: 'metano' }, { species: moleculeSpecies('oxigeno'), coef: 3, formula: 'O2', name: 'oxígeno' }], products: [{ species: moleculeSpecies('co'), coef: 2, formula: 'CO', name: 'monóxido de carbono' }, { species: moleculeSpecies('agua'), coef: 4, formula: 'H2O', name: 'agua' }] } },
    { id: 'c3h8', label: 'Combustión completa del propano (gas de cocina)', def: { id: 'hcb-c3h8', title: 'Combustión completa del propano', reactants: [{ species: moleculeSpecies('propano'), coef: 1, formula: 'C3H8', name: 'propano' }, { species: moleculeSpecies('oxigeno'), coef: 5, formula: 'O2', name: 'oxígeno' }], products: [{ species: moleculeSpecies('co2'), coef: 3, formula: 'CO2', name: 'dióxido de carbono' }, { species: moleculeSpecies('agua'), coef: 4, formula: 'H2O', name: 'agua' }] } },
  ], []);
}

function CombustionStation({ api }: LabProps) {
  const [id, setId] = useState('metano');
  const [kind, setKind] = useState<CombustionKind>('completa');
  const [rx, setRx] = useState('ch4');
  const reactions = useCombustionReactions();
  const rec = getOrganic(id);
  const C = carbonCount(rec), H = hydrogenCount(rec);
  const eq = combustionEquation(prettyHill(rec.formula), C, H, kind);
  const en = kind === 'completa' ? combustionEnergy(rec) : null;
  const nm = nameOf(rec);
  const withData = ORGANIC_RECORDS.filter((r) => SERIES.alcano.includes(r.id) && combustionEnergy(r));
  const chart = [{ label: 'Alcanos (ΔcH° experimental)', color: 'var(--series-1)', kind: 'scatter' as const, points: withData.map((r) => ({ x: carbonCount(r), y: combustionEnergy(r)!.kJmol, label: r.nombre })) }];
  const record = () => api.addTrial('combustion', {
    compuesto: nm?.es ?? rec.nombre, n: C, tipo: COMBUSTION_LABEL[kind], ecuacion: eq, o2PorMol: kind === 'completa' ? C + H / 4 : kind === 'co' ? C / 2 + H / 4 : H / 4,
    dHc: en?.kJmol ?? null, kJg: en ? Number(en.kJg.toFixed(2)) : null, gCO2MJ: en ? Number(en.gCO2perMJ.toFixed(1)) : null, fuente: en ? en.source.source : 'Sin información (solo ecuación balanceada)',
  });
  const rdef = reactions.find((r) => r.id === rx)!;
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Ecuación balanceada</h3>
          <p className="eq" style={{ fontSize: '1.25rem', fontFamily: 'var(--font-data)' }} aria-live="polite">{eq}</p>
          <StatusLine status="modelo" prefix="Coeficientes">calculados por conservación de átomos (C, H y O) con enteros mínimos.</StatusLine>
        </div>
        <div className="card stack">
          <h3>Reacción en 3D</h3>
          <Select label="Reacción" value={rx} onChange={setRx} options={reactions.map((r) => ({ value: r.id, label: r.label }))} />
          <Reaction3D def={rdef.def} idPrefix="hcb-rx" height={300} />
        </div>
        <div className="card stack">
          <h3>Energía de combustión de los alcanos</h3>
          <StatusLine status="experimental" prefix="Datos">ΔcH° publicadas (HSDB, que cita el CRC Handbook o Riddick et al.). Activa el ajuste lineal para estimar los alcanos sin dato (la estimación es un modelo, no un dato).</StatusLine>
          <Chart series={chart} xLabel="Número de carbonos" yLabel="Energía liberada −ΔcH°" yUnit="kJ/mol" title="Calor de combustión de los alcanos" exportName="combustion-alcanos" height={260} fit="linear" />
          <p className="small muted">Sin dato con fuente estándar en PubChem: {SERIES.alcano.map((x) => getOrganic(x)).filter((r) => !combustionEnergy(r)).map((r) => r.nombre).join(', ')}.</p>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Combustible" value={id} onChange={setId} options={FUELS.map((x) => ({ value: x, label: `${nameOf(getOrganic(x))?.es ?? x} (${prettyHill(getOrganic(x).formula)})` }))} />
          <Segmented label="Cantidad de oxígeno" value={kind} onChange={setKind} options={[{ value: 'completa', label: 'Suficiente' }, { value: 'co', label: 'Poca (CO)' }, { value: 'hollin', label: 'Muy poca (C)' }]} />
          <Readout items={[
            { k: 'Tipo de combustión', v: COMBUSTION_LABEL[kind] },
            { k: 'O₂ por mol de combustible', v: `${fmt(kind === 'completa' ? C + H / 4 : kind === 'co' ? C / 2 + H / 4 : H / 4, 2)} mol`, data: true },
            { k: 'Energía liberada (−ΔcH°)', v: en ? `${fmt(en.kJmol, 1)} kJ/mol` : kind === 'completa' ? 'Sin información disponible' : 'No se calcula', data: true },
            { k: 'Energía por gramo', v: en ? `${fmt(en.kJg, 1)} kJ/g` : '—', data: true },
            { k: 'CO₂ emitido por energía', v: en ? `${fmt(en.gCO2perMJ, 1)} g CO₂/MJ` : '—', data: true },
          ]} />
          <RecordButton onRecord={record} />
          {en && <p className="small muted">ΔcH°: «{en.source.text}» — {en.source.source}{en.source.note ? ` (${en.source.note})` : ''}.</p>}
          {kind !== 'completa' && <Notice kind="warn">La combustión incompleta produce CO (gas tóxico, sin olor) u hollín y libera menos energía. Para la energía de esta reacción haría falta la entalpía del CO o del carbono con la misma fuente: el laboratorio no la inventa.</Notice>}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ 6 · reacciones */

const TEST_IDS = ['hexano', 'hex-1-eno', 'hex-1-ino', 'ciclohexano', 'ciclohexeno', 'benceno'];
const HALO_IDS: Record<string, string> = { propano: 'CCC', butano: 'CCCC', isobutano: 'CC(C)C', pentano: 'CCCCC', isopentano: 'CCC(C)C' };

function ReactionsStation({ api }: LabProps) {
  const [rx, setRx] = useState('h2');
  const [test, setTest] = useState<UnsatTest>('bromo');
  const [sub, setSub] = useState('hex-1-eno');
  const [added, setAdded] = useState(false);
  const [alk, setAlk] = useState('propano');
  const [hal, setHal] = useState<'Cl' | 'Br'>('Cl');
  const defs = useMemo<Record<string, { label: string; def: Reaction3DDef }>>(() => ({
    h2: { label: 'Hidrogenación del eteno (adición de H₂)', def: { id: 'hcb-h2', title: 'Eteno + hidrógeno → etano', reactants: [{ species: moleculeSpecies('eteno'), coef: 1, formula: 'C2H4', name: 'eteno' }, { species: moleculeSpecies('hidrogeno'), coef: 1, formula: 'H2', name: 'hidrógeno' }], products: [{ species: moleculeSpecies('etano'), coef: 1, formula: 'C2H6', name: 'etano' }] } },
    br2: { label: 'Adición de Br₂ al eteno', def: { id: 'hcb-br2', title: 'Eteno + bromo → 1,2-dibromoetano', reactants: [{ species: moleculeSpecies('eteno'), coef: 1, formula: 'C2H4', name: 'eteno' }, { species: orgSpecies('bromo'), coef: 1, formula: 'Br2', name: 'bromo' }], products: [{ species: orgSpecies('1,2-dibromoetano'), coef: 1, formula: 'C2H4Br2', name: '1,2-dibromoetano' }] } },
    hbr: { label: 'Adición de HBr al propeno (Markovnikov)', def: { id: 'hcb-hbr', title: 'Propeno + HBr → 2-bromopropano', reactants: [{ species: orgSpecies('propeno'), coef: 1, formula: 'C3H6', name: 'propeno' }, { species: moleculeSpecies('hbr'), coef: 1, formula: 'HBr', name: 'bromuro de hidrógeno' }], products: [{ species: orgSpecies('2-bromopropano'), coef: 1, formula: 'C3H7Br', name: '2-bromopropano' }] } },
    cl2: { label: 'Halogenación del metano (sustitución, con luz)', def: { id: 'hcb-cl2', title: 'Metano + cloro → clorometano + HCl', reactants: [{ species: moleculeSpecies('metano'), coef: 1, formula: 'CH4', name: 'metano' }, { species: moleculeSpecies('cloro'), coef: 1, formula: 'Cl2', name: 'cloro' }], products: [{ species: orgSpecies('clorometano'), coef: 1, formula: 'CH3Cl', name: 'clorometano' }, { species: moleculeSpecies('hcl'), coef: 1, formula: 'HCl', name: 'cloruro de hidrógeno' }] } },
  }), []);
  const rec = getOrganic(sub);
  const res = unsaturationTest(parseSmiles(rec.smiles), test);
  const before = test === 'bromo' ? '#d9822b' : '#7b2d8e';
  const after = added && res.positive ? (test === 'bromo' ? '#f3efe2' : '#c9b8a0') : before;
  const prods = useMemo(() => monohalogenation(HALO_IDS[alk], hal), [alk, hal]);
  const nm = nameOf(rec);
  const record = () => api.addTrial('pruebas', { compuesto: nm?.es ?? rec.nombre, reactivo: test === 'bromo' ? 'Agua de bromo (Br₂)' : 'Permanganato de potasio (KMnO₄) diluido y frío', insaturado: res.positive ? 1 : 0, resultado: res.positive ? 'Positiva (se decolora)' : 'Negativa', observacion: res.observation });
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3>Reacciones de los hidrocarburos en 3D</h3>
          <Select label="Reacción en 3D" value={rx} onChange={setRx} options={Object.entries(defs).map(([k, v]) => ({ value: k, label: v.label }))} />
          <Reaction3D def={defs[rx].def} idPrefix="hcb-rx6" height={300} labelSuffix=" (reacciones de hidrocarburos)" />
          {rx === 'h2' && <p className="small muted">La geometría del H₂ la calcula el kit (PubChem no tiene confórmero 3D del H₂). El catalizador (Ni, Pd o Pt) no se dibuja.</p>}
          {rx === 'cl2' && <p className="small muted">En la realidad ocurre por radicales libres en varios pasos y necesita luz ultravioleta o calor; la animación solo muestra qué átomos cambian de pareja.</p>}
        </div>
        <div className="card stack">
          <h3>Pruebas de insaturación</h3>
          <StatusLine status="ilustracion" prefix="Tubos">dibujo del resultado esperado según la estructura (presencia de C=C o C≡C); no es una medición ni un video.</StatusLine>
          <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
            <TestTubeSvg idPrefix="hcb-tubo" color={after} precipitate={added && res.positive && test === 'permanganato'} label={`Tubo con ${nm?.es} y ${test === 'bromo' ? 'agua de bromo' : 'permanganato'}: ${added ? (res.positive ? 'se decoloró' : 'conserva el color') : 'antes de agregar el reactivo'}`} />
            <div className="stack-sm" style={{ flex: 1, minWidth: 200 }}>
              <p aria-live="polite" style={{ margin: 0 }}><strong>{added ? (res.positive ? 'Prueba positiva.' : 'Prueba negativa.') : 'Agrega el reactivo para ver qué ocurre.'}</strong>{added && ` ${res.observation}`}</p>
              {added && <p className="small muted" style={{ margin: 0 }}>{res.explanation}</p>}
            </div>
          </div>
        </div>
        <div className="card stack">
          <h3>Halogenación por radicales: ¿cuántos productos y en qué proporción?</h3>
          <StatusLine status="modelo" prefix="Proporciones">modelo estadístico: supone que todos los H reaccionan igual (en la realidad los H de carbonos secundarios y terciarios reaccionan más rápido, sobre todo con Br₂).</StatusLine>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Productos monohalogenados">
            <table>
              <caption className="small muted">Productos monohalogenados distintos del {alk} (nombres calculados por el motor de nomenclatura)</caption>
              <thead><tr><th>Producto</th><th>Tipo de H</th><th>H equivalentes</th><th>% estadístico</th></tr></thead>
              <tbody>{prods.map((p) => <tr key={p.smilesKey}><td>{p.nombre}</td><td>{p.type}</td><td>{p.hydrogens}</td><td>{fmt(p.percent, 1)} %</td></tr>)}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Prueba de insaturación</h3>
          <Select label="Sustancia del tubo" value={sub} onChange={(v) => { setSub(v); setAdded(false); }} options={TEST_IDS.map((x) => ({ value: x, label: nameOf(getOrganic(x))?.es ?? x }))} />
          <Segmented label="Reactivo" value={test} onChange={(v) => { setTest(v); setAdded(false); }} options={[{ value: 'bromo', label: 'Agua de bromo' }, { value: 'permanganato', label: 'KMnO₄ (Baeyer)' }]} />
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={() => { setAdded(true); playSound(res.positive ? 'confirm' : 'click'); }} disabled={added}>Agregar 5 gotas del reactivo</button>
            <button type="button" className="btn ghost small" onClick={() => setAdded(false)} disabled={!added}>Tubo nuevo</button>
          </div>
          <RecordButton onRecord={record} disabled={!added} label="Guardar la prueba en la tabla" />
        </div>
        <div className="card stack">
          <h3>Halogenación</h3>
          <Select label="Alcano" value={alk} onChange={setAlk} options={Object.keys(HALO_IDS).map((x) => ({ value: x, label: nameOf(getOrganic(x))?.es ?? x }))} />
          <Segmented label="Halógeno" value={hal} onChange={setHal} options={[{ value: 'Cl', label: 'Cl₂' }, { value: 'Br', label: 'Br₂' }]} />
          <p className="small muted">Productos distintos: {prods.length}. Compara con el número de «tipos» de hidrógeno de la molécula.</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function HydrocarbonsLab(props: LabProps) {
  const [station, setStation] = useState<Station>('series');
  return (
    <div className="stack">
      <Notice>
        <strong>Propósito:</strong> aprendes cómo la estructura de los hidrocarburos (número de carbonos, tipo de enlace, ramificación y forma) explica sus propiedades y reacciones al cambiar la molécula, girar sus enlaces y provocar reacciones, y observar sus puntos de ebullición reales, sus longitudes y ángulos medidos en 3D, sus ecuaciones balanceadas y los productos que se forman.
      </Notice>
      <Segmented label="Estación" value={station} onChange={setStation} options={STATIONS} />
      {station === 'series' && <SeriesStation {...props} />}
      {station === 'hibridacion' && <HybridStation {...props} />}
      {station === 'isomeria' && <IsomerStation {...props} />}
      {station === 'conformaciones' && <ConformationStation />}
      {station === 'combustion' && <CombustionStation {...props} />}
      {station === 'reacciones' && <ReactionsStation {...props} />}
    </div>
  );
}
