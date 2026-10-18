import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GLViewer } from '3dmol';
import {
  analyzeCenter, angleTable, bondBetween, bondTable, centerCandidates, centralAtom, compareWithVsepr, describeMolecule,
  firstCid, hillFormula, measureAngle, measureDistance, neighbors, parsePubChemQuery, parseSdf, pubchemNameToCidUrl,
  pubchemSdf3dUrl, SDF_LIMITS, SdfError, vseprAt, type AngleComparison, type Molecule, type VseprResult,
} from '../models/geometry';
import { BUNDLED_CONFORMERS, MISSING_3D, PUBCHEM3D_METHOD } from '../data/conformers';
import { CPK, prettyFormula } from '../models/balancing';
import { MoleculeSvg } from '../components/MoleculeSvg';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import { StatusChip } from '../components/Provenance';
import type { LabProps } from './registry';

/* ------------------------------------------------------------------ motor 3D (3Dmol.js, carga diferida) */

type ThreeDmol = typeof import('3dmol');
let loader: Promise<ThreeDmol> | null = null;

/**
 * Carga 3Dmol.js solo al abrir este laboratorio (importación dinámica: un fragmento propio, fuera del JS inicial).
 * Se usa la compilación ES6 minificada del paquete fijado (3dmol@2.5.5, BSD-3-Clause), que pesa menos que la
 * entrada «main» (UMD sin minificar).
 */
function load3Dmol(): Promise<ThreeDmol> {
  if (!loader) {
    // @ts-ignore La compilación ES6 minificada no trae declaraciones propias; sus tipos son los del paquete '3dmol'.
    loader = import('3dmol/build/3Dmol.es6-min.js').then((m: unknown) => m as ThreeDmol);
    loader.catch(() => { loader = null; });
  }
  return loader;
}

function webglAvailable(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

type Engine = 'cargando' | 'disponible' | 'sin-webgl' | 'no-disponible';
type Style3D = 'bs' | 'esf' | 'pal';
type Kind = 'angulo' | 'distancia';

const STYLE_OPTIONS: { value: Style3D; label: string }[] = [
  { value: 'bs', label: 'Palitos y esferas' },
  { value: 'esf', label: 'Esferas' },
  { value: 'pal', label: 'Palitos' },
];
const STYLE_SPEC: Record<Style3D, Record<string, unknown>> = {
  bs: { stick: { radius: 0.14 }, sphere: { scale: 0.28 } },
  esf: { sphere: { scale: 0.9 } },
  pal: { stick: { radius: 0.2 } },
};
const STYLE_NAME: Record<Style3D, string> = { bs: 'palitos y esferas', esf: 'esferas', pal: 'palitos' };

/** Fórmulas como se escriben en clase (la de PubChem está en orden de Hill: H3N, O2S, CH4O…). */
const DISPLAY_FORMULA: Record<string, string> = {
  agua: 'H₂O', amoniaco: 'NH₃', metano: 'CH₄', co2: 'CO₂', so2: 'SO₂', formaldehido: 'H₂CO', eteno: 'C₂H₄', etino: 'C₂H₂',
  metanol: 'CH₃OH', hcn: 'HCN', h2s: 'H₂S', fosfina: 'PH₃',
};

interface MolEntry {
  key: string;
  cid: number;
  name: string;
  formula: string;
  sdf: string;
  sourceUrl: string;
  pageUrl: string;
  retrieved: string;
  conformerId: string;
  origin: 'incluido' | 'en vivo';
}

const BUNDLED: MolEntry[] = BUNDLED_CONFORMERS.map((c) => ({
  key: c.id, cid: c.cid, name: c.name, formula: DISPLAY_FORMULA[c.id] ?? prettyFormula(c.formula), sdf: c.sdf,
  sourceUrl: c.sourceUrl, pageUrl: c.pageUrl, retrieved: c.retrieved, conformerId: c.conformerId, origin: 'incluido',
}));

const reducedMotion = () => { try { return prefersReducedMotion(); } catch { return false; } };
const cssVar = (name: string, fallback: string) => {
  try { return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback; } catch { return fallback; }
};
/** Signo menos tipográfico y signo más explícito para las diferencias. */
const signed = (v: number, d = 1) => (v > 0 ? `+${fmt(v, d)}` : v < 0 ? `−${fmt(-v, d)}` : fmt(0, d));
const ORDER_TEXT: Record<number, string> = { 1: 'sencillo', 2: 'doble', 3: 'triple', 4: 'aromático' };

/** Átomos por defecto: ángulo vecino–centro–vecino y distancia centro–vecino. */
function defaultsFor(mol: Molecule) {
  const c = centralAtom(mol);
  const ns = neighbors(mol, c);
  const a = ns[0] ?? (c === 0 ? 1 : 0);
  const b = ns[1] ?? ns[0] ?? 0;
  return { center: c, ang: [a, c, b] as [number, number, number], dist: [c, a] as [number, number] };
}

interface Measurement {
  molKey: string;
  kind: Kind;
  atoms: number[];
  value: number;
  vertex?: VseprResult;
  cmp?: AngleComparison;
  note: string;
}

type LiveState = 'inactivo' | 'en cola' | 'ejecutando' | 'completado' | 'fallido' | 'cancelado';

const FETCH_TIMEOUT_MS = 15_000;
const MIN_GAP_MS = 500;

/** Descarga texto con tiempo máximo y límite de tamaño (corta la lectura si se pasa del límite). */
async function fetchText(url: string, signal: AbortSignal, maxChars: number): Promise<{ status: number; text: string }> {
  const res = await fetch(url, { signal });
  const len = Number(res.headers.get('content-length') ?? '0');
  if (len > maxChars) throw new SdfError(`La respuesta (${len} bytes) supera el límite de ${maxChars}.`);
  if (!res.body) return { status: res.status, text: (await res.text()).slice(0, maxChars + 1) };
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let text = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    text += dec.decode(value, { stream: true });
    if (text.length > maxChars) { await reader.cancel(); throw new SdfError(`La respuesta supera el límite de ${maxChars} caracteres.`); }
  }
  return { status: res.status, text: text + dec.decode() };
}

/* ------------------------------------------------------------------ instrumento: transportador y regla en Å */

const PW = 600, PH = 250;
const PROT = { cx: 170, cy: 212, r: 140 };
const RULER = { x0: 360, x1: 576, y: 150 };

function AtomDot({ x, y, el, r = 9 }: { x: number; y: number; el: string; r?: number }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} fill={CPK[el] ?? '#b0b8bf'} stroke="var(--ink-2)" strokeWidth="1" />
      <circle cx={x - r * 0.35} cy={y - r * 0.35} r={r * 0.3} fill="#fff" opacity="0.55" />
    </g>
  );
}

function Instrument({ mol, m, kind }: { mol: Molecule; m: Measurement | null; kind: Kind }) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const pt = (deg: number, r: number) => ({ x: PROT.cx + r * Math.cos(rad(deg)), y: PROT.cy - r * Math.sin(rad(deg)) });
  const ticks = useMemo(() => Array.from({ length: 37 }, (_, i) => i * 5), []);
  const angleM = m && m.kind === 'angulo' ? m : null;
  const distM = m && m.kind === 'distancia' ? m : null;
  const rulerMax = Math.max(3, Math.ceil(distM?.value ?? 0));
  const pxA = (RULER.x1 - RULER.x0) / rulerMax;
  const ideal = angleM?.cmp?.ideal;
  const label = (i: number) => mol.atoms[i]?.label ?? '';
  const desc = angleM
    ? `Transportador: ángulo ${angleM.atoms.map(label).join('–')} de ${fmt(angleM.value, 1)}°${ideal !== undefined ? `; ángulo ideal VSEPR ${fmt(ideal, 1)}°, dibujado con línea discontinua` : ''}.`
    : distM
      ? `Regla en ángstroms: distancia ${distM.atoms.map(label).join('–')} de ${fmt(distM.value, 3)} Å.`
      : `Transportador y regla en ángstroms vacíos: mide ${kind === 'angulo' ? 'un ángulo' : 'una distancia'} para verlo aquí.`;
  return (
    <svg viewBox={`0 0 ${PW} ${PH}`} role="img" aria-labelledby="gmv-t gmv-d">
      <title id="gmv-t">Transportador y regla de la medición (calculados a partir de las coordenadas)</title>
      <desc id="gmv-d">{desc}</desc>
      {/* transportador de acrílico */}
      <g filter="url(#kit-shadow-soft)">
        <path d={`M${PROT.cx - PROT.r - 8} ${PROT.cy} A${PROT.r + 8} ${PROT.r + 8} 0 0 1 ${PROT.cx + PROT.r + 8} ${PROT.cy} Z`} fill="url(#kit-glass)" stroke="var(--glass-edge)" strokeWidth="1.4" />
      </g>
      <path d={`M${PROT.cx - 34} ${PROT.cy} A34 34 0 0 1 ${PROT.cx + 34} ${PROT.cy}`} fill="none" stroke="var(--glass-print)" strokeOpacity="0.5" />
      {ticks.map((d) => {
        const len = d % 30 === 0 ? 14 : d % 10 === 0 ? 9 : 5;
        const p1 = pt(d, PROT.r), p2 = pt(d, PROT.r - len);
        return <line key={d} x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="var(--glass-print)" strokeWidth={d % 30 === 0 ? 1.4 : 0.8} />;
      })}
      {ticks.filter((d) => d % 30 === 0).map((d) => {
        const p = pt(d, PROT.r - 26);
        return <text key={d} x={p.x} y={p.y + 4} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{d}</text>;
      })}
      <line x1={PROT.cx - PROT.r - 8} y1={PROT.cy} x2={PROT.cx + PROT.r + 8} y2={PROT.cy} stroke="var(--glass-print)" strokeWidth="1.2" />
      {angleM && (() => {
        const a = pt(angleM.value, PROT.r - 18), b = pt(0, PROT.r - 18);
        const arcEnd = pt(angleM.value, 46), arcStart = pt(0, 46);
        const [iA, iV, iC] = angleM.atoms;
        return (
          <g>
            <path d={`M${PROT.cx} ${PROT.cy} L${arcStart.x} ${arcStart.y} A46 46 0 0 0 ${arcEnd.x} ${arcEnd.y} Z`} fill="var(--data)" fillOpacity="0.18" />
            {ideal !== undefined && (() => { const q = pt(ideal, PROT.r - 4); return <><line x1={PROT.cx} y1={PROT.cy} x2={q.x} y2={q.y} stroke="var(--ink-2)" strokeWidth="1.5" strokeDasharray="5 4" /><text x={q.x + (ideal > 90 ? -6 : 6)} y={q.y - 6} textAnchor={ideal > 90 ? 'end' : 'start'} style={{ fontSize: 11, fill: 'var(--ink-2)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 3 }}>ideal {fmt(ideal, 1)}°</text></>; })()}
            <line x1={PROT.cx} y1={PROT.cy} x2={b.x} y2={b.y} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            <line x1={PROT.cx} y1={PROT.cy} x2={a.x} y2={a.y} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            <AtomDot x={b.x} y={b.y} el={mol.atoms[iC].element} />
            <AtomDot x={a.x} y={a.y} el={mol.atoms[iA].element} />
            <AtomDot x={PROT.cx} y={PROT.cy} el={mol.atoms[iV].element} r={11} />
            <text x={PROT.cx} y={PROT.cy - 58} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: 'var(--data)', fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4 }}>θ = {fmt(angleM.value, 1)}°</text>
          </g>
        );
      })()}
      {!angleM && <text x={PROT.cx} y={PROT.cy - 60} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{kind === 'angulo' ? 'Mide un ángulo' : 'Transportador'}</text>}
      {/* regla en ángstroms */}
      <g filter="url(#kit-shadow-soft)">
        <rect x={RULER.x0 - 10} y={RULER.y} width={RULER.x1 - RULER.x0 + 20} height={34} rx={4} fill="url(#kit-glass)" stroke="var(--glass-edge)" />
      </g>
      {Array.from({ length: rulerMax * 10 + 1 }, (_, i) => i).map((i) => {
        const x = RULER.x0 + (i / 10) * pxA;
        const len = i % 10 === 0 ? 13 : i % 5 === 0 ? 9 : 5;
        return <line key={i} x1={x} x2={x} y1={RULER.y} y2={RULER.y + len} stroke="var(--glass-print)" strokeWidth={i % 10 === 0 ? 1.2 : 0.7} />;
      })}
      {Array.from({ length: rulerMax + 1 }, (_, i) => i).map((i) => (
        <text key={i} x={RULER.x0 + i * pxA} y={RULER.y + 28} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{i}</text>
      ))}
      <text x={RULER.x1 + 4} y={RULER.y + 50} textAnchor="end" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>Å (10⁻¹⁰ m)</text>
      {distM && (() => {
        const x2 = RULER.x0 + distM.value * pxA;
        const [i, j] = distM.atoms;
        return (
          <g>
            <line x1={RULER.x0} y1={RULER.y - 22} x2={x2} y2={RULER.y - 22} stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            <line x1={RULER.x0} y1={RULER.y - 22} x2={RULER.x0} y2={RULER.y} stroke="var(--data)" strokeDasharray="3 3" />
            <line x1={x2} y1={RULER.y - 22} x2={x2} y2={RULER.y} stroke="var(--data)" strokeDasharray="3 3" />
            <AtomDot x={RULER.x0} y={RULER.y - 22} el={mol.atoms[i].element} />
            <AtomDot x={x2} y={RULER.y - 22} el={mol.atoms[j].element} />
            <text x={(RULER.x0 + x2) / 2} y={RULER.y - 40} textAnchor="middle" style={{ fontSize: 15, fontWeight: 700, fill: 'var(--data)', fontFamily: 'var(--font-data)', paintOrder: 'stroke', stroke: 'var(--surface)', strokeWidth: 4 }}>d = {fmt(distM.value, 3)} Å</text>
          </g>
        );
      })()}
      {!distM && <text x={(RULER.x0 + RULER.x1) / 2} y={RULER.y - 26} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{kind === 'distancia' ? 'Mide una distancia' : 'Regla en ángstroms'}</text>}
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function GeometryLab({ api }: LabProps) {
  const [live, setLive] = useState<MolEntry[]>([]);
  const entries = useMemo(() => [...BUNDLED, ...live], [live]);
  const [molKey, setMolKey] = useState('agua');
  const entry = entries.find((e) => e.key === molKey) ?? BUNDLED[0];
  const mol = useMemo(() => parseSdf(entry.sdf), [entry.sdf]);
  const initial = useMemo(() => defaultsFor(parseSdf(BUNDLED[0].sdf)), []);
  const [center, setCenter] = useState(initial.center);
  const [angSel, setAngSel] = useState<[number, number, number]>(initial.ang);
  const [distSel, setDistSel] = useState<[number, number]>(initial.dist);
  const [kind, setKind] = useState<Kind>('angulo');
  const [style, setStyle] = useState<Style3D>('bs');
  const [showLabels, setShowLabels] = useState(true);
  const [slot, setSlot] = useState(0);
  const [measurement, setMeasurement] = useState<Measurement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const selection = kind === 'angulo' ? angSel : distSel;
  const current = measurement && measurement.molKey === molKey && measurement.kind === kind
    && measurement.atoms.join(',') === selection.join(',') ? measurement : null;

  const selectMolecule = useCallback((key: string, list: MolEntry[] = entries) => {
    const e = list.find((x) => x.key === key);
    if (!e) return;
    const d = defaultsFor(parseSdf(e.sdf));
    setMolKey(key); setCenter(d.center); setAngSel(d.ang); setDistSel(d.dist); setSlot(0); setMeasurement(null); setError(null);
  }, [entries]);

  const analysis = useMemo(() => analyzeCenter(mol, center), [mol, center]);
  const bonds = useMemo(() => bondTable(mol), [mol]);
  const angles = useMemo(() => angleTable(mol), [mol]);
  const atomOptions = useMemo(() => mol.atoms.map((a) => ({ value: String(a.index), label: a.label })), [mol]);
  const label = (i: number) => mol.atoms[i]?.label ?? '—';

  /* ---------- medición */
  const measure = () => {
    try {
      if (kind === 'angulo') {
        const [a, v, c] = angSel;
        const value = measureAngle(mol, a, v, c);
        const isBondAngle = !!bondBetween(mol, a, v) && !!bondBetween(mol, c, v);
        const vx = vseprAt(mol, v);
        const cmp = isBondAngle && vx.ok ? compareWithVsepr(value, vx) : undefined;
        const note = !isBondAngle
          ? `${label(a)} y ${label(c)} no están ambos unidos a ${label(v)}: no es un ángulo de enlace y no se compara con VSEPR.`
          : vx.ok ? cmp!.verdict : vx.reason;
        setMeasurement({ molKey, kind, atoms: [a, v, c], value, vertex: vx, cmp, note });
      } else {
        const [a, b] = distSel;
        const value = measureDistance(mol, a, b);
        const bond = bondBetween(mol, a, b);
        const note = bond ? `Enlace ${ORDER_TEXT[bond.order]} según el archivo: es la longitud de enlace del confórmero.` : 'Estos átomos no están enlazados: es una distancia entre núcleos no enlazados.';
        setMeasurement({ molKey, kind, atoms: [a, b], value, note });
      }
      setError(null);
      playSound('click', { intensity: 0.6 });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo medir.');
      playSound('error');
    }
  };

  const record = () => {
    if (!current) return;
    const vx = current.vertex && current.vertex.ok ? current.vertex : null;
    api.addTrial('mediciones', {
      molecula: entry.name,
      formula: entry.formula,
      cid: String(entry.cid),
      tipo: current.kind === 'angulo' ? 'Ángulo' : 'Distancia',
      atomos: current.atoms.map(label).join('–'),
      centro: current.kind === 'angulo' ? label(current.atoms[1]) : null,
      notacion: current.cmp && vx ? vx.notation : null,
      dominios: current.cmp && vx ? vx.domains : null,
      paresLibres: current.cmp && vx ? vx.lonePairs : null,
      distancia: current.kind === 'distancia' ? current.value : null,
      angulo: current.kind === 'angulo' ? current.value : null,
      anguloIdeal: current.cmp ? Number(current.cmp.ideal.toFixed(1)) : null,
      diferencia: current.cmp ? current.cmp.difference : null,
      fuente: `PubChem3D, CID ${entry.cid} (${entry.origin}, ${entry.retrieved})`,
    });
  };

  /* ---------- visor 3D */
  const hostRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<GLViewer | null>(null);
  const [engine, setEngine] = useState<Engine>('cargando');
  const [retry, setRetry] = useState(0);
  const pickRef = useRef<(i: number) => void>(() => {});
  pickRef.current = (i: number) => {
    if (!Number.isInteger(i) || i < 0 || i >= mol.atoms.length) return;
    const n = kind === 'angulo' ? 3 : 2;
    const s = slot % n;
    if (kind === 'angulo') setAngSel((prev) => { const next = [...prev] as [number, number, number]; next[s] = i; return next; });
    else setDistSel((prev) => { const next = [...prev] as [number, number]; next[s] = i; return next; });
    setSlot((s + 1) % n);
    setError(null);
    playSound('click', { intensity: 0.3 });
  };

  useEffect(() => {
    const host = hostRef.current;
    let cancelled = false;
    if (!host) return;
    if (!webglAvailable()) { setEngine('sin-webgl'); return; }
    setEngine('cargando');
    load3Dmol().then((lib) => {
      if (cancelled) return;
      try {
        viewerRef.current = lib.createViewer(host, { backgroundColor: 'white', backgroundAlpha: 0, antialias: true });
        setEngine('disponible');
      } catch (e) {
        console.warn('[geometría] No se pudo crear el visor 3D; se usa la vista de respaldo.', e);
        setEngine('no-disponible');
      }
    }).catch((e) => { console.warn('[geometría] No se pudo descargar el visor 3D (¿sin conexión?); se usa la vista de respaldo.', e); if (!cancelled) setEngine('no-disponible'); });
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => { try { viewerRef.current?.resize(); viewerRef.current?.render(); } catch { /* sin visor */ } });
    ro?.observe(host);
    return () => {
      cancelled = true;
      ro?.disconnect();
      try { viewerRef.current?.clear(); } catch { /* ya liberado */ }
      viewerRef.current = null;
      host.innerHTML = '';
    };
  }, [retry]);

  const zoomedFor = useRef('');

  // Carga del modelo cuando cambia la molécula.
  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      v.removeAllModels();
      v.addModel(entry.sdf, 'sdf');
      // El lienzo puede tener aún tamaño 0 al montarse: se ajusta el encuadre cuando ya tiene su tamaño real.
      zoomedFor.current = '';
    } catch (e) {
      console.warn('[geometría] El visor 3D no pudo cargar la molécula; se usa la vista de respaldo.', e);
      setEngine('no-disponible');
    }
  }, [engine, entry.sdf]);

  // Estilo, etiquetas, selección y medición.
  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      const ink = cssVar('--ink', '#1d2327'), surface = cssVar('--surface', '#ffffff'), data = cssVar('--data', '#1971c2');
      v.setStyle({}, STYLE_SPEC[style]);
      v.removeAllShapes();
      v.removeAllLabels();
      v.setClickable({}, true, (atom: { index?: number }) => { if (typeof atom?.index === 'number') pickRef.current(atom.index); });
      const P = (i: number) => ({ x: mol.atoms[i].x, y: mol.atoms[i].y, z: mol.atoms[i].z });
      for (const i of new Set(selection)) v.addSphere({ center: P(i), radius: style === 'esf' ? 1.25 : 0.55, color: data, opacity: 0.35 });
      if (showLabels) for (const a of mol.atoms) v.addLabel(a.label, { position: P(a.index), fontSize: 12, fontColor: ink, backgroundColor: surface, backgroundOpacity: 0.75, borderThickness: 0, inFront: true, alignment: 'bottomLeft' });
      if (current) {
        const pts = current.atoms;
        const pairs = current.kind === 'angulo' ? [[pts[0], pts[1]], [pts[2], pts[1]]] : [[pts[0], pts[1]]];
        for (const [i, j] of pairs) v.addCylinder({ start: P(i), end: P(j), radius: 0.035, color: data, dashed: true, dashLength: 0.12, gapLength: 0.08 });
        const at = current.kind === 'angulo' ? P(pts[1]) : { x: (mol.atoms[pts[0]].x + mol.atoms[pts[1]].x) / 2, y: (mol.atoms[pts[0]].y + mol.atoms[pts[1]].y) / 2, z: (mol.atoms[pts[0]].z + mol.atoms[pts[1]].z) / 2 };
        v.addLabel(current.kind === 'angulo' ? `${fmt(current.value, 1)}°` : `${fmt(current.value, 3)} Å`, { position: at, fontSize: 14, fontColor: surface, backgroundColor: data, backgroundOpacity: 0.95, inFront: true, alignment: 'topCenter' });
      }
      // Encuadre al cargar una molécula: después de aplicar el estilo (3Dmol encuadra los átomos visibles) y con el
      // lienzo ya medido (al montarse puede tener tamaño 0).
      if (zoomedFor.current !== entry.sdf) {
        zoomedFor.current = entry.sdf;
        v.resize();
        v.zoomTo();
        // 3Dmol encuadra como mínimo una esfera de ~5 Å de radio: las moléculas de 3 a 6 átomos quedarían diminutas.
        const n = mol.atoms.length;
        const cx = mol.atoms.reduce((t, a) => t + a.x, 0) / n, cy = mol.atoms.reduce((t, a) => t + a.y, 0) / n, cz = mol.atoms.reduce((t, a) => t + a.z, 0) / n;
        const radius = Math.max(...mol.atoms.map((a) => Math.hypot(a.x - cx, a.y - cy, a.z - cz))) + 1.2;
        if (radius < 5) v.zoom(Math.min(3, 5 / radius));
      }
      v.render();
    } catch (e) {
      console.warn('[geometría] Error al dibujar en el visor 3D; se usa la vista de respaldo.', e);
      setEngine('no-disponible');
    }
  }, [engine, entry.sdf, mol, style, showLabels, selection, current]);

  const view = (fn: (v: GLViewer, ms: number) => void) => {
    const v = viewerRef.current;
    if (!v) return;
    try { fn(v, reducedMotion() ? 0 : 350); v.render(); } catch { /* sin visor */ }
  };

  /* ---------- búsqueda en PubChem (en vivo) */
  const [query, setQuery] = useState('');
  const [liveState, setLiveState] = useState<LiveState>('inactivo');
  const [liveMsg, setLiveMsg] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const lastReq = useRef(0);
  useEffect(() => () => abortRef.current?.abort(), []);

  const search = async () => {
    let q;
    try { q = parsePubChemQuery(query); } catch (e) { setLiveState('fallido'); setLiveMsg((e as Error).message); return; }
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      setLiveState('fallido'); setLiveMsg('Servicio no disponible: el equipo no tiene conexión a internet. Las 12 moléculas incluidas siguen funcionando sin conexión.');
      return;
    }
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    let timedOut = false;
    const timer = setTimeout(() => { timedOut = true; ctrl.abort(); }, FETCH_TIMEOUT_MS);
    const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
    const turn = async () => {
      const wait = Math.max(0, lastReq.current + MIN_GAP_MS - Date.now());
      if (wait > 0) await pause(wait);
      lastReq.current = Date.now();
      if (ctrl.signal.aborted) throw new DOMException('cancelado', 'AbortError');
    };
    try {
      setLiveState('en cola'); setLiveMsg('Esperando turno: las solicitudes a PubChem se espacian al menos medio segundo.');
      await turn();
      let cid: number;
      if (q.kind === 'cid') cid = q.cid;
      else {
        setLiveState('ejecutando'); setLiveMsg(`Buscando el CID de «${q.name}» en PubChem…`);
        const r = await fetchText(pubchemNameToCidUrl(q.name), ctrl.signal, 20_000);
        if (r.status === 404) throw new Error(`PubChem no encontró ningún compuesto con el nombre «${q.name}». Prueba con el nombre en inglés (p. ej. «carbon tetrachloride»).`);
        if (r.status >= 500 || r.status === 429) throw new Error(`Servicio no disponible: PubChem respondió ${r.status}. Intenta más tarde.`);
        const found = firstCid(r.text);
        if (r.status !== 200 || found === null) throw new Error(`Respuesta inesperada de PubChem (código ${r.status}).`);
        cid = found;
        setLiveState('en cola'); setLiveMsg(`CID ${cid} encontrado. Esperando turno para descargar el confórmero 3D…`);
        await turn();
      }
      const bundled = BUNDLED.find((b) => b.cid === cid);
      if (bundled) {
        selectMolecule(bundled.key);
        setLiveState('completado'); setLiveMsg(`CID ${cid} ya está incluido en el laboratorio (${bundled.name}); se muestra la copia incluida.`);
        return;
      }
      setLiveState('ejecutando'); setLiveMsg(`Descargando el confórmero 3D del CID ${cid}…`);
      const url = pubchemSdf3dUrl(cid);
      const r = await fetchText(url, ctrl.signal, SDF_LIMITS.maxChars);
      if (r.status === 404) throw new Error(`PubChem no tiene confórmero 3D para el CID ${cid}. PubChem3D solo los calcula para moléculas pequeñas con H, C, N, O, F, Si, P, S, Cl, Br o I (por eso faltan, por ejemplo, BF₃ y SF₆).`);
      if (r.status >= 500 || r.status === 429) throw new Error(`Servicio no disponible: PubChem respondió ${r.status}. Intenta más tarde.`);
      if (r.status !== 200) throw new Error(`Respuesta inesperada de PubChem (código ${r.status}).`);
      const m = parseSdf(r.text);
      if (!m.is3D) throw new SdfError('El archivo recibido no tiene coordenadas 3D.');
      const fileCid = Number(m.props.PUBCHEM_COMPOUND_CID);
      if (fileCid !== cid) throw new SdfError(`El archivo dice ser del CID ${m.props.PUBCHEM_COMPOUND_CID ?? '—'} y no del ${cid}.`);
      const e: MolEntry = {
        key: `cid-${cid}`, cid, name: q.kind === 'name' ? `«${q.name}» (PubChem)` : `PubChem CID ${cid}`, formula: prettyFormula(hillFormula(m)), sdf: r.text,
        sourceUrl: url, pageUrl: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`, retrieved: new Date().toISOString().slice(0, 10),
        conformerId: m.props.PUBCHEM_CONFORMER_ID ?? 'no indicado', origin: 'en vivo',
      };
      const list = [...BUNDLED, ...live.filter((x) => x.key !== e.key), e];
      setLive(list.slice(BUNDLED.length));
      selectMolecule(e.key, list);
      setLiveState('completado'); setLiveMsg(`Confórmero 3D del CID ${cid} descargado (${m.atoms.length} átomos).`);
      playSound('confirm');
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        if (abortRef.current !== ctrl) return; // reemplazada por otra búsqueda o laboratorio cerrado
        setLiveState(timedOut ? 'fallido' : 'cancelado');
        setLiveMsg(timedOut ? `Servicio no disponible: PubChem no respondió en ${FETCH_TIMEOUT_MS / 1000} s.` : 'Búsqueda cancelada.');
      } else if (err instanceof TypeError) {
        setLiveState('fallido'); setLiveMsg('Servicio no disponible: no se pudo conectar con PubChem (sin conexión o bloqueo de red).');
      } else {
        setLiveState('fallido'); setLiveMsg((err as Error).message);
      }
      playSound('error');
    } finally {
      clearTimeout(timer);
    }
  };
  const cancelSearch = () => abortRef.current?.abort();
  const busy = liveState === 'en cola' || liveState === 'ejecutando';

  /* ---------- textos */
  const vs = analysis.vsepr;
  const sceneText = useMemo(() => {
    const base = describeMolecule(mol, entry.name, entry.cid, center);
    const sel = `Estilo: ${STYLE_NAME[style]}. Átomos elegidos para ${kind === 'angulo' ? 'el ángulo' : 'la distancia'}: ${selection.map(label).join(', ')}.`;
    const res = current ? ` Medición: ${current.kind === 'angulo' ? `${fmt(current.value, 1)}°` : `${fmt(current.value, 3)} Å`}.` : '';
    return `${base} ${sel}${res}`;
  }, [mol, entry.name, entry.cid, center, style, kind, selection, current]);

  const readoutItems = kind === 'angulo'
    ? [
      { k: 'Molécula', v: `${entry.name} (${entry.formula})` },
      { k: 'Ángulo elegido', v: angSel.map(label).join('–') },
      { k: 'Ángulo medido', v: current ? `${fmt(current.value, 1)}°` : 'mide', data: true },
      { k: 'Ángulo ideal (VSEPR)', v: current ? (current.cmp ? `${fmt(current.cmp.ideal, 1)}°` : 'no aplica') : '—' },
      { k: 'Diferencia (medido − ideal)', v: current?.cmp ? `${signed(current.cmp.difference)}°` : '—', data: true },
    ]
    : [
      { k: 'Molécula', v: `${entry.name} (${entry.formula})` },
      { k: 'Distancia elegida', v: distSel.map(label).join('–') },
      { k: 'Distancia medida', v: current ? `${fmt(current.value, 3)} Å` : 'mide', data: true },
      { k: 'En picómetros', v: current ? `${fmt(current.value * 100, 1)} pm` : '—' },
    ];

  const fallbackOpen = engine === 'sin-webgl' || engine === 'no-disponible';
  const slotNames = kind === 'angulo' ? ['A', 'V (vértice)', 'C'] : ['A', 'B'];

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <div style={{ position: 'relative', width: '100%', height: 340, borderRadius: 10, background: 'var(--surface-2)', border: '1px solid var(--line)', overflow: 'hidden' }}>
            <div ref={hostRef} role="img" aria-label={`Modelo 3D interactivo de ${entry.name}; arrastra para girar, rueda para acercar y toca un átomo para elegirlo`} aria-describedby="gmv-3d-desc"
              style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
            {engine === 'cargando' && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <p role="status" className="small">Cargando el visor 3D (3Dmol.js)…</p>
              </div>
            )}
            {fallbackOpen && (
              <div style={{ position: 'absolute', inset: 0 }}>
                <MoleculeSvg atoms={mol.atoms.map((a) => ({ index: a.index, element: a.element, x: a.x, y: a.y, z: a.z, label: label(a.index) }))}
                  bonds={mol.bonds} style={style} selection={selection} onPick={(i) => pickRef.current(i)} title={entry.name} />
              </div>
            )}
          </div>
          {fallbackOpen && (
            <div className="notice small" role="status" style={{ marginTop: 8 }}>
              <strong>Vista de respaldo:</strong> {engine === 'sin-webgl' ? 'este navegador o equipo no ofrece WebGL,' : 'no se pudo cargar el visor 3D (por ejemplo, sin conexión),'} así que la molécula
              se dibuja aquí con las mismas coordenadas del archivo. Arrástrala o usa las flechas del teclado para girarla y toca un átomo para elegirlo;
              las mediciones son idénticas. Los tamaños de las esferas son solo de dibujo.
              {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={() => setRetry((n) => n + 1)}>Reintentar el visor 3D</button></>}
            </div>
          )}
          <p id="gmv-3d-desc" className="sr-only">{sceneText}</p>
          {!fallbackOpen && <div className="btn-row" style={{ marginTop: 8 }}>
            <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => view((v, ms) => v.rotate(90, 'y', ms))}>Girar 90° (eje vertical)</button>
            <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => view((v, ms) => v.rotate(90, 'x', ms))}>Girar 90° (eje horizontal)</button>
            <button type="button" className="btn small" disabled={engine !== 'disponible'} onClick={() => view((v, ms) => v.zoomTo({}, ms))}>Centrar la molécula</button>
          </div>}
          <p className="small muted" style={{ margin: '6px 0 10px' }}>
            Toca átomos en el modelo 3D para elegirlos (el próximo será <strong>{slotNames[slot % slotNames.length]}</strong>) o usa las listas de la derecha con el teclado.
          </p>
          <Instrument mol={mol} m={current} kind={kind} />
        </div>
        <Readout items={readoutItems} />
        {current && <Notice kind={current.cmp && current.cmp.verdict.startsWith('No es') ? 'warn' : 'info'}>{current.note}</Notice>}
        {error && <Notice kind="bad">{error}</Notice>}

        <div className="card stack">
          <h3>¿De dónde salen estas coordenadas?</h3>
          <div className="btn-row" role="note" aria-label="Procedencia de la geometría">
            <StatusChip status="prediccion" prefix="Coordenadas 3D" />
            <StatusChip status="modelo" prefix="Distancias, ángulos y VSEPR" />
          </div>
          <p className="small">
            Confórmero 3D <strong>calculado</strong> por PubChem (PubChem3D) para <strong>{entry.name}</strong>: CID{' '}
            <a href={entry.pageUrl} target="_blank" rel="noopener noreferrer">{entry.cid}</a>, confórmero {entry.conformerId},{' '}
            {entry.origin === 'incluido' ? 'copia incluida en el laboratorio' : 'descargado en vivo'} el {entry.retrieved} desde{' '}
            <a href={entry.sourceUrl} target="_blank" rel="noopener noreferrer">PUG REST</a>.
          </p>
          <p className="small">{PUBCHEM3D_METHOD.resumen} Software: {PUBCHEM3D_METHOD.software}</p>
          <p className="small">
            <strong>No es una estructura experimental.</strong> Una estructura experimental se obtiene de mediciones (por ejemplo,
            espectroscopia de microondas o difracción de electrones en gases, o difracción de rayos X en cristales) y se publica con
            su método y su incertidumbre. Este confórmero es una predicción computacional con un campo de fuerza: sus distancias y
            ángulos pueden diferir de los experimentales. Para comparar, consulta una base de datos de estructuras medidas.
          </p>
          <details>
            <summary className="small">Cita textual de PubChem (en inglés)</summary>
            {PUBCHEM3D_METHOD.quotes.map((q) => <blockquote key={q} className="small" style={{ margin: '6px 0' }}>«{q}»</blockquote>)}
            <p className="small">Fuente: <a href={PUBCHEM3D_METHOD.sourceUrl} target="_blank" rel="noopener noreferrer">notas de la versión de PubChem3D</a> (consultadas el {PUBCHEM3D_METHOD.retrieved}).</p>
          </details>
          <p className="small muted">Sin confórmero 3D en PubChem (no se incluyen ni se dibujan): {MISSING_3D.map((m) => `${m.name} (CID ${m.cid})`).join(', ')}.</p>
        </div>

        <details className="card" open={fallbackOpen || undefined}>
          <summary>Tabla calculada de enlaces y ángulos{fallbackOpen ? ' (vista 3D no disponible)' : ''}</summary>
          <p className="small muted">Calculada con las coordenadas del archivo (modelo calculado). Úsala para comprobar tus mediciones.</p>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de enlaces">
            <table>
              <caption className="sr-only">Enlaces de {entry.name}</caption>
              <thead><tr><th>Enlace</th><th>Tipo</th><th className="n">Longitud (Å)</th></tr></thead>
              <tbody>{bonds.map((b) => <tr key={`${b.a}-${b.b}`}><td>{label(b.a)}–{label(b.b)}</td><td>{ORDER_TEXT[b.order]}</td><td className="n">{fmt(b.length, 3)}</td></tr>)}</tbody>
            </table>
          </div>
          <div className="table-wrap" tabIndex={0} role="region" aria-label="Tabla de ángulos de enlace" style={{ marginTop: 8 }}>
            <table>
              <caption className="sr-only">Ángulos de enlace de {entry.name}</caption>
              <thead><tr><th>Ángulo</th><th className="n">Valor (°)</th></tr></thead>
              <tbody>{angles.length ? angles.map((r) => <tr key={`${r.a}-${r.v}-${r.c}`}><td>{label(r.a)}–{label(r.v)}–{label(r.c)}</td><td className="n">{fmt(r.angle, 1)}</td></tr>) : <tr><td colSpan={2}>No hay átomos con dos o más enlaces.</td></tr>}</tbody>
            </table>
          </div>
        </details>
      </div>

      <div className="controls">
        <div className="card stack">
          <h3>Molécula</h3>
          <Select label="Molécula" value={molKey} onChange={(v) => { selectMolecule(v); playSound('click', { intensity: 0.3 }); }}
            options={entries.map((e) => ({ value: e.key, label: `${e.name} · ${e.formula} · CID ${e.cid}${e.origin === 'en vivo' ? ' (en vivo)' : ''}` }))} />
          <Segmented label="Estilo del modelo 3D" value={style} options={STYLE_OPTIONS} onChange={(v) => setStyle(v)} />
          <label className="check"><input type="checkbox" checked={showLabels} onChange={(e) => setShowLabels(e.target.checked)} /> Mostrar los nombres de los átomos en 3D</label>
        </div>

        <div className="card stack">
          <h3>Medición</h3>
          <Segmented label="Tipo de medición" value={kind} options={[{ value: 'angulo', label: 'Ángulo (3 átomos)' }, { value: 'distancia', label: 'Distancia (2 átomos)' }]}
            onChange={(v) => { setKind(v); setSlot(0); setError(null); }} />
          {kind === 'angulo' ? (
            <>
              <Select label="Átomo A" value={String(angSel[0])} options={atomOptions} onChange={(v) => setAngSel([Number(v), angSel[1], angSel[2]])} />
              <Select label="Átomo V (vértice)" value={String(angSel[1])} options={atomOptions} onChange={(v) => setAngSel([angSel[0], Number(v), angSel[2]])} />
              <Select label="Átomo C" value={String(angSel[2])} options={atomOptions} onChange={(v) => setAngSel([angSel[0], angSel[1], Number(v)])} />
            </>
          ) : (
            <>
              <Select label="Átomo A de la distancia" value={String(distSel[0])} options={atomOptions} onChange={(v) => setDistSel([Number(v), distSel[1]])} />
              <Select label="Átomo B de la distancia" value={String(distSel[1])} options={atomOptions} onChange={(v) => setDistSel([distSel[0], Number(v)])} />
            </>
          )}
          <div className="btn-row">
            <button type="button" className="btn primary" onClick={measure}>{kind === 'angulo' ? 'Medir ángulo' : 'Medir distancia'}</button>
          </div>
          <RecordButton onRecord={record} disabled={!current} />
          {!current && <p className="small muted">Mide para poder guardar el ensayo.</p>}
        </div>

        <div className="card stack">
          <h3>Predicción VSEPR</h3>
          <StatusChip status="modelo" prefix="Reglas VSEPR" />
          <Select label="Átomo central (VSEPR)" value={String(center)} onChange={(v) => { setCenter(Number(v)); }}
            options={centerCandidates(mol).map((i) => ({ value: String(i), label: label(i) }))} />
          {vs.ok ? (
            <dl className="small" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 10px' }}>
              <dt>Notación</dt><dd style={{ margin: 0 }}><strong>{vs.notation}</strong></dd>
              <dt>Átomos unidos</dt><dd style={{ margin: 0 }}>{vs.bonded}</dd>
              <dt>Pares libres</dt><dd style={{ margin: 0 }}>{vs.lonePairs} (({vs.valence} − {vs.bondOrderSum}{mol.atoms[center].charge ? ` − (${mol.atoms[center].charge})` : ''}) / 2)</dd>
              <dt>Dominios</dt><dd style={{ margin: 0 }}>{vs.domains}: geometría electrónica {vs.electronGeometry}</dd>
              <dt>Forma</dt><dd style={{ margin: 0 }}>{vs.molecularShape}</dd>
              <dt>Ángulo ideal</dt><dd style={{ margin: 0 }}>{vs.idealAngles.map((a) => `${fmt(a, 1)}°`).join(', ')}</dd>
              <dt>Se espera</dt><dd style={{ margin: 0 }}>{vs.expectation === 'menor' ? 'un ángulo menor que el ideal (los pares libres empujan más)' : vs.hasMultipleBond ? 'el ideal en promedio; el enlace múltiple puede abrir los ángulos que lo incluyen' : 'el ángulo ideal'}</dd>
            </dl>
          ) : <p className="small">{vs.reason}</p>}
        </div>

        <div className="card stack">
          <h3>Buscar otra molécula en PubChem</h3>
          <div className="field">
            <label htmlFor="gmv-q">Nombre en inglés o número CID</label>
            <input id="gmv-q" type="text" value={query} maxLength={60} placeholder="p. ej. carbon tetrachloride o 5943" autoComplete="off"
              onChange={(e) => setQuery(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !busy) void search(); }} />
          </div>
          <div className="btn-row">
            <button type="button" className="btn" onClick={() => void search()} disabled={busy}>Buscar en PubChem</button>
            {busy && <button type="button" className="btn small ghost" onClick={cancelSearch}>Cancelar la búsqueda</button>}
          </div>
          <p className="small" aria-live="polite">
            {liveState !== 'inactivo' && <><strong>Estado: {liveState}.</strong> {liveMsg}</>}
          </p>
          <p className="small muted">Requiere internet. Se consulta directamente el servicio público PUG REST de PubChem (sin servidor propio), con {FETCH_TIMEOUT_MS / 1000} s de tiempo máximo y archivos de hasta {fmt(SDF_LIMITS.maxChars / 1000, 0)} kB y {SDF_LIMITS.maxAtoms} átomos. El resultado se rotula con su CID, su URL y la fecha de descarga.</p>
        </div>

        <Notice>
          Las coordenadas son predicciones computacionales de PubChem, no mediciones. VSEPR predice tendencias cualitativas (menor o mayor
          que el ideal), no el valor exacto del ángulo. Visor: 3Dmol.js 2.5.5 (licencia BSD-3-Clause).
        </Notice>
      </div>
    </div>
  );
}
