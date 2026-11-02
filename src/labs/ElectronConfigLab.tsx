import { useEffect, useMemo, useRef, useState } from 'react';
import {
  analyzeBoxes, aufbauOccupancy, boxesOf, configString, configurationConditions, fillingSequence, groundState, hundBoxes, isException,
  lastElectron, MAX_Z, nobleGasString, ORDER, tablePlace, type Boxes, type Spin,
} from '../models/electronConfiguration';
import { periodicElement } from '../models/periodicTrends';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { orbitalScene, type OrbitalView } from './electron3d';

type Tool = 'up' | 'down' | 'quitar';
/** Milisegundos entre electrones en el llenado automático. */
const STEP_MS = 420;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Los electrones giran alrededor del núcleo en órbitas fijas, como los planetas alrededor del Sol.', answer: 'falso', feedback: 'Ese es el modelo de Bohr. En el modelo cuántico un orbital no es una trayectoria: es la región donde es probable encontrar al electrón. La nube de puntos de la vista 3D muestra esa probabilidad.' },
  { id: 'i2', text: 'En el potasio y el calcio el subnivel 4s se llena antes que el 3d.', answer: 'cierto', feedback: 'El 4s tiene n + ℓ = 4 y el 3d tiene n + ℓ = 5: según la regla de Madelung el 4s se ocupa primero, y el dato medido del K ([Ar] 4s¹) lo confirma. Ojo: al formar iones como el Fe²⁺, el hierro pierde primero los electrones 4s.' },
  { id: 'i3', text: 'Un orbital p tiene forma de ocho porque el electrón recorre un camino en forma de ocho.', answer: 'falso', feedback: 'Los dos lóbulos muestran dónde es más probable encontrar al electrón; no es un camino. En el plano nodal (por ejemplo, z = 0 para el pz) la probabilidad es cero.' },
  { id: 'i4', text: 'Dos electrones en el mismo orbital tienen que tener espines opuestos.', answer: 'cierto', feedback: 'Es el principio de exclusión de Pauli: en un átomo no hay dos electrones con los cuatro números cuánticos (n, ℓ, mℓ, mₛ) iguales. Prueba a poner dos ↑ en una caja: el laboratorio lo marca como no válido.' },
  { id: 'i5', text: 'Con la regla de las diagonales se predice la configuración de todos los elementos.', answer: 'falso', feedback: 'Entre los 54 primeros elementos, 8 tienen un estado fundamental medido distinto de la predicción: Cr, Cu, Nb, Mo, Ru, Rh, Pd y Ag. Compruébalo con el botón «Comparar con el dato medido».' },
];

const ARROW = (s: Spin[]) => s.map((x) => (x > 0 ? '↑' : '↓')).join('');

/* ------------------------------------------------------------------ diagrama de las diagonales */

function DiagonalRule({ next }: { next: string | null }) {
  const W = 260, H = 210, cx = (l: number) => 40 + l * 62, cy = (n: number) => 22 + (n - 1) * 40;
  const rows = [1, 2, 3, 4, 5];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="cfg-dg-t cfg-dg-d" style={{ width: '100%', maxWidth: 300, height: 'auto' }}>
      <title id="cfg-dg-t">Regla de las diagonales (orden de Madelung)</title>
      <desc id="cfg-dg-d">{`Subniveles ordenados por n (filas) y ℓ (columnas); las flechas diagonales dan el orden de llenado: 1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p, 5s, 4d, 5p.${next ? ` El siguiente subnivel por llenar es ${next}.` : ''}`}</desc>
      <rect width={W} height={H} rx="10" fill="var(--surface-2)" />
      {[[1, 0], [2, 0], [3, 0], [4, 0], [5, 0], [6, 0]].map(([s]) => {
        // diagonal de n + ℓ = s (+1 para empezar en ns)
        const pts = [0, 1, 2].map((l) => ({ n: s - l, l })).filter((p) => p.n >= 1 && p.n <= 5 && p.l < p.n);
        if (pts.length < 2) return null;
        const a = pts[0], b = pts[pts.length - 1];
        return <line key={s} x1={cx(a.l) + 10} y1={cy(a.n) - 6} x2={cx(b.l) - 10} y2={cy(b.n) + 6} stroke="var(--ink-3)" strokeWidth="1.2" markerEnd="url(#cfg-arr)" />;
      })}
      <defs><marker id="cfg-arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0 L8 4 L0 8 Z" fill="var(--ink-3)" /></marker></defs>
      {rows.flatMap((n) => [0, 1, 2].filter((l) => l < n && ORDER.some((s) => s.n === n && s.l === l)).map((l) => {
        const key = `${n}${'spd'[l]}`;
        const on = key === next;
        return (
          <g key={key}>
            {on && <rect x={cx(l) - 19} y={cy(n) - 14} width="38" height="24" rx="6" fill="var(--data)" opacity="0.18" stroke="var(--data)" />}
            <text x={cx(l)} y={cy(n) + 4} textAnchor="middle" style={{ fontSize: 14, fontFamily: 'var(--font-data)', fill: on ? 'var(--data)' : 'var(--ink)', fontWeight: on ? 700 : 400 }}>{key}</text>
          </g>
        );
      }))}
    </svg>
  );
}

/* ------------------------------------------------------------------ laboratorio */

export default function ElectronConfigLab({ api }: LabProps) {
  const [z, setZ] = useState(8);
  const [boxes, setBoxes] = useState<Boxes>({});
  const [tool, setTool] = useState<Tool>('up');
  const [checked, setChecked] = useState(false);
  const [view, setView] = useState<OrbitalView>('valencia');
  const [auto, setAuto] = useState<{ k: number; running: boolean } | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const el = periodicElement(z);
  const seq = useMemo(() => fillingSequence(z), [z]);
  const a = useMemo(() => analyzeBoxes(boxes, z), [boxes, z]);
  const conds = useMemo(() => configurationConditions(a), [a]);
  const place = useMemo(() => tablePlace(z), [z]);
  const gs = useMemo(() => groundState(z), [z]);
  const pred = useMemo(() => aufbauOccupancy(z), [z]);
  const exception = isException(z);

  // Subniveles que se muestran: hasta el último que necesita este elemento (y el siguiente, para equivocarse).
  const lastIdx = Math.max(ORDER.findIndex((s) => s.key === [...ORDER].reverse().find((x) => (pred[x.key] ?? 0) > 0 || (gs[x.key] ?? 0) > 0)!.key),
    ...Object.keys(boxes).filter((k) => (boxes[k] ?? []).length).map((k) => ORDER.findIndex((s) => k.startsWith(s.key))));
  const rows = ORDER.slice(0, Math.min(ORDER.length, lastIdx + 2));
  const nextSub = a.electrons < z ? seq[a.electrons]?.box.slice(0, 2) ?? null : null;

  const reset = () => { window.clearTimeout(timer.current); setAuto(null); setBoxes({}); setChecked(false); };
  useEffect(reset, [z]); // eslint-disable-line react-hooks/exhaustive-deps

  // Llenado automático electrón por electrón (SimControls): se detiene en pausa y salta al final con movimiento reducido.
  useEffect(() => {
    if (!auto?.running) return;
    if (prefersReducedMotion()) { setBoxes(hundBoxes(aufbauOccupancy(z))); setAuto({ k: z, running: false }); return; }
    if (auto.k >= z) { setAuto({ k: z, running: false }); playSound('click', { intensity: 0.6 }); return; }
    timer.current = window.setTimeout(() => {
      const step = seq[auto.k];
      setBoxes((b) => ({ ...b, [step.box]: [...(b[step.box] ?? []), step.spin] }));
      setAuto({ k: auto.k + 1, running: true });
    }, STEP_MS);
    return () => window.clearTimeout(timer.current);
  }, [auto, seq, z]);

  const clickBox = (id: string) => {
    if (auto?.running) return;
    setChecked(false);
    setBoxes((b) => {
      const cur = b[id] ?? [];
      if (tool === 'quitar') return { ...b, [id]: cur.slice(0, -1) };
      if (cur.length >= 2) return b;
      playSound('click', { intensity: 0.3 });
      return { ...b, [id]: [...cur, tool === 'up' ? 1 : -1] as Spin[] };
    });
  };
  const nextElectron = () => {
    if (a.electrons >= z) return;
    const step = seq[a.electrons];
    setChecked(false);
    setBoxes((b) => ({ ...b, [step.box]: [...(b[step.box] ?? []), step.spin] }));
    playSound('click', { intensity: 0.4 });
  };
  const status = auto ? simStatusOf(auto.running, auto.k > 0, auto.k >= z) : 'listo';

  const le = lastElectron(z);
  usePublishModel(() => ({
    vars: {
      Z: { sym: 'Z', name: `Número atómico (${el.es})`, value: z, unit: '', decimals: 0 },
      n: { sym: 'n', name: 'Número cuántico principal del último electrón', value: le.n, unit: '', decimals: 0 },
      l: { sym: 'ℓ', name: 'Número cuántico secundario del último electrón', value: le.l, unit: '', decimals: 0 },
      N: { sym: 'N', name: 'Capacidad del subnivel', value: 2 * (2 * le.l + 1), unit: 'e⁻', decimals: 0 },
    },
    equations: [{ title: 'Capacidad de un subnivel (Pauli)', lhs: 'N', expr: '2·(2·[l]+1)' }],
  }), [z, le.n, le.l]);

  const scene = useMemo(() => orbitalScene({ boxes, view }), [boxes, view]);

  const record = () => api.addTrial('configuraciones', {
    simbolo: el.sym, z, electrones: a.electrons, configuracion: configString(a.occupancy) || '—', abreviada: nobleGasString(a.occupancy) || '—',
    desapareados: a.unpaired, valencia: place.valence, periodo: place.period, grupo: place.group, bloque: place.block,
    coincideNist: a.matchesGround ? 1 : 0, excepcion: exception ? 1 : 0,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <section className="card stack" aria-labelledby="cfg-cajas-h">
          <h3 id="cfg-cajas-h">Diagrama de orbitales del {el.es} ({el.sym}, Z = {z})</h3>
          <p className="small muted" style={{ margin: 0 }}>Cada caja es un orbital; las flechas son electrones con espín +½ (↑) o −½ (↓). Elige la herramienta y toca una caja. Las cajas van de mℓ = −ℓ a +ℓ (convención escolar).</p>
          <div role="group" aria-label="Diagrama de cajas de orbitales" className="stack-sm">
            {rows.map((s) => (
              <div key={s.key} style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <span style={{ width: 34, fontFamily: 'var(--font-data)', fontWeight: 700, color: s.key === nextSub ? 'var(--data)' : 'var(--ink)' }}>{s.key}</span>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {boxesOf(s).map((b) => {
                    const sp = boxes[b.id] ?? [];
                    const bad = a.pauli.includes(b.id);
                    const state = sp.length === 0 ? 'vacío' : sp.length === 1 ? `un electrón ${sp[0] > 0 ? 'con espín ↑' : 'con espín ↓'}` : bad ? 'dos electrones con el mismo espín (no válido)' : 'dos electrones ↑↓';
                    const act = tool === 'quitar' ? 'Quitar un electrón' : `Agregar un electrón ${tool === 'up' ? '↑' : '↓'}`;
                    return (
                      <button key={b.id} type="button" className="btn" data-box={b.id} onClick={() => clickBox(b.id)}
                        aria-label={`Orbital ${s.key}, mℓ = ${b.ml}: ${state}. ${act}.`}
                        style={{ minWidth: 44, minHeight: 44, padding: '2px 6px', fontSize: 20, lineHeight: 1, fontFamily: 'var(--font-data)', borderColor: bad ? 'var(--bad)' : undefined, borderWidth: bad ? 3 : undefined }}>
                        {ARROW(sp) || ' '}
                      </button>
                    );
                  })}
                </div>
                <span className="small muted">{(a.occupancy[s.key] ?? 0)}/{s.cap}</span>
              </div>
            ))}
          </div>
        </section>
        <Readout items={[
          { k: 'Electrones colocados', v: `${a.electrons} de ${z}`, data: true, state: a.electrons === z ? 'ok' : a.electrons > z ? 'bad' : undefined },
          { k: 'Tu configuración', v: configString(a.occupancy) || '—', data: true },
          { k: 'Notación abreviada', v: a.electrons ? nobleGasString(a.occupancy) : '—' },
          { k: 'Electrones desapareados', v: `${a.unpaired}${a.electrons ? (a.unpaired ? ' (paramagnético)' : ' (diamagnético)') : ''}` },
          { k: 'Último electrón (n, ℓ, mℓ, mₛ) según Aufbau', v: `(${le.n}, ${le.l}, ${le.ml > 0 ? '+' : ''}${le.ml}, ${le.ms > 0 ? '+½' : '−½'})` },
          { k: 'Período, grupo y bloque (deducidos)', v: `período ${place.period}, grupo ${place.group}, bloque ${place.block}` },
          { k: place.block === 'd' ? 'Electrones externos ns + (n − 1)d' : 'Electrones de valencia', v: place.valenceText },
        ]} />
        {conds.map((c) => <ConditionAlert key={c.text} level={c.level} cause={c.text} fix={c.fix} />)}
        {a.matchesGround && <Notice kind="ok">{a.matchesException ? `¡Bien! Tu diagrama coincide con el estado fundamental MEDIDO del ${el.es}, que es una excepción del principio de construcción.` : `Tu diagrama es el estado fundamental del ${el.es}: cumple Aufbau, Pauli y Hund y coincide con el dato medido.`}</Notice>}
        {checked && (
          <section className="card stack" aria-labelledby="cfg-nist-h">
            <h3 id="cfg-nist-h">Comparación con el dato medido</h3>
            <Readout items={[
              { k: 'Predicción del principio de construcción', v: nobleGasString(pred) },
              { k: 'Estado fundamental medido (PubChem)', v: nobleGasString(gs), data: true },
              { k: '¿Coinciden?', v: exception ? 'no: es una excepción' : 'sí' },
              { k: 'Tu diagrama', v: a.matchesGround ? 'coincide con el dato medido' : 'no coincide todavía' },
            ]} />
            {exception && <p className="small" style={{ margin: 0 }}>En el {el.es} el estado de menor energía medido no sigue la regla de Madelung: las energías de los subniveles {Object.keys(gs).filter((k) => (gs[k] ?? 0) !== (pred[k] ?? 0)).join(' y ')} son tan parecidas que la repulsión entre electrones decide el orden.</p>}
          </section>
        )}
        <section className="card stack" aria-labelledby="cfg-3d-h">
          <h3 id="cfg-3d-h">Vista 3D: los orbitales que vas llenando</h3>
          <Segmented<OrbitalView> label="Qué orbitales mostrar" value={view} onChange={setView}
            options={[{ value: 'valencia', label: 'Capa de valencia' }, { value: 'subnivel', label: 'Último subnivel' }, { value: 'todos', label: 'Todos los ocupados' }]} />
          <Scene3D idPrefix="cfg" title={`Orbitales ocupados del ${el.es} en 3D`} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={360} initialOrbit={{ yaw: 0.6, pitch: 0.35 }} status="modelo"
            statusNote="Nubes de puntos con la densidad |ψ|² del átomo de hidrógeno (forma y orientación reales de s, p y d); el tamaño no es el de un átomo con muchos electrones y el radio se comprime con √r para que quepan varias capas. Ilustración cualitativa." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="cfg" intro="Ideas frecuentes sobre los electrones y los orbitales. Decide si son ciertas o falsas y compruébalo con el diagrama o con la vista 3D." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Elemento</h3>
          <Select label="Elemento (Z = 1 a 54)" value={String(z)} onChange={(v) => setZ(Number(v))}
            options={Array.from({ length: MAX_Z }, (_, i) => { const e = periodicElement(i + 1); return { value: String(i + 1), label: `${i + 1} · ${e.sym} · ${e.es}` }; })} />
          <Segmented<Tool> label="Herramienta" value={tool} onChange={setTool}
            options={[{ value: 'up', label: 'Agregar ↑' }, { value: 'down', label: 'Agregar ↓' }, { value: 'quitar', label: 'Quitar' }]} />
          <div className="btn-row">
            <button type="button" className="btn" onClick={nextElectron} disabled={a.electrons >= z || !!auto?.running}>Siguiente electrón (Aufbau)</button>
            <button type="button" className="btn ghost" onClick={reset}>Vaciar</button>
          </div>
          <button type="button" className="btn primary" onClick={() => { setChecked(true); playSound('click', { intensity: 0.5 }); }}>Comparar con el dato medido</button>
          <RecordButton onRecord={record} disabled={a.electrons === 0} />
          <Notice>Datos medidos: configuraciones del estado fundamental de la tabla periódica de PubChem (las mismas que publica el NIST), consultadas el 2026-11-01.</Notice>
        </div>
        <div className="card stack">
          <h3>Llenado automático</h3>
          <SimControls title="Llenado electrón por electrón" status={status} startLabel="Llenar paso a paso" repeatLabel="Llenar otra vez"
            onStart={() => { setBoxes({}); setChecked(false); setAuto({ k: 0, running: true }); }}
            onPause={() => setAuto((s) => (s ? { ...s, running: false } : s))} onResume={() => setAuto((s) => (s ? { ...s, running: true } : s))} onReset={reset}
            progress={auto ? { value: auto.k, max: z, unit: 'e⁻', label: 'electrones' } : undefined} />
          <p className="small muted" style={{ margin: 0 }}>Coloca un electrón cada {fmt(STEP_MS / 1000, 2)} s con Aufbau, Hund y Pauli; mira cómo aparecen los orbitales en 3D.</p>
          <DiagonalRule next={nextSub} />
        </div>
      </div>
    </div>
  );
}
