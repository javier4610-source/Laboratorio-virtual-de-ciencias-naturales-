import { useMemo, useState } from 'react';
import {
  checkLewis, classifyBond, EN_THRESHOLDS, HOT_PLATE_MAX_C, inferStructure, LEWIS, lewisById, runTest, SUBSTANCES, substanceById,
  type LewisMolecule, type Substance, type TestId, type TestResult,
} from '../models/chemicalBonding';
import { periodicElement, PERIODIC_SOURCE } from '../models/periodicTrends';
import { fmt } from '../lib/format';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { StatusChip } from '../components/Provenance';
import { Crystal3D, getCrystal, Molecule3D, moleculeSpecies, speciesFromSdf, PUBCHEM_GEOMETRY_LABEL } from '../chem';
import { SUCROSE_SDF } from '../data/quimica/sacarosa-pubchem';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { metalScene, partialText, polarityScene } from './bonding3d';

type Station = 'en' | 'lewis' | 'propiedades';
const ELEMENTS = ['H', 'Li', 'C', 'N', 'O', 'F', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'K', 'Ca', 'Fe', 'Cu', 'Zn', 'Br', 'Ag', 'I'];
const TESTS: { id: TestId; label: string }[] = [
  { id: 'calentar', label: `Calentar en la placa (hasta ${HOT_PLATE_MAX_C} °C)` },
  { id: 'agua', label: 'Agitar 1 g en 10 mL de agua' },
  { id: 'conduceSolido', label: 'Conductímetro en el sólido' },
  { id: 'conduceAgua', label: 'Conductímetro en la mezcla con agua' },
];
const STRUCTURES: Substance['structure'][] = ['red iónica', 'red covalente', 'moléculas', 'red metálica'];

const IDEAS: Idea[] = [
  { id: 'i1', text: 'La sal (NaCl) sólida conduce la electricidad porque está formada por iones.', answer: 'falso', feedback: 'Tiene iones, pero en el sólido están fijos en la red. Solo conduce cuando los iones se pueden mover: disuelta en agua o fundida (a 800,7 °C).' },
  { id: 'i2', text: 'El azúcar se disuelve en agua, así que su disolución conduce igual que la de la sal.', answer: 'falso', feedback: 'Disolverse no es lo mismo que separarse en iones: las moléculas de sacarosa quedan enteras y sin carga, y el LED no enciende.' },
  { id: 'i3', text: 'En la molécula de CO₂ los enlaces C=O son polares, pero la molécula es no polar.', answer: 'cierto', feedback: 'ΔEN(C–O) = 0,89, así que cada enlace es polar; pero la molécula es lineal y los dos dipolos apuntan en sentidos opuestos: se cancelan.' },
  { id: 'i4', text: 'Un enlace es iónico o covalente: no hay casos intermedios.', answer: 'falso', feedback: 'El carácter iónico cambia de forma continua con ΔEN (Pauling): el H–Cl tiene ≈ 21 %, el Na–Cl ≈ 71 %. Los límites 0,4 y 1,7 son una convención para orientarse.' },
  { id: 'i5', text: 'La arena (cuarzo) tiene un punto de fusión muy alto porque sus átomos están unidos por enlaces covalentes en una red gigante.', answer: 'cierto', feedback: 'Para fundirla hay que romper enlaces Si–O muy fuertes en toda la red: funde a unos 1713 °C. La parafina, también covalente, funde a 36 °C porque solo hay que separar moléculas.' },
];

/** Estructura de Lewis en 2D: enlaces (sencillo, doble, triple) y pares libres como puntos. */
function LewisSvg({ m }: { m: LewisMolecule }) {
  const S = 70, W = 340, H = 200, cx = W / 2, cy = H / 2;
  const P = m.atoms.map((a) => ({ x: cx + a.x * S, y: cy - a.y * S }));
  const pairs: { x: number; y: number; ang: number }[] = [];
  m.atoms.forEach((a, i) => {
    if (!a.lone) return;
    const bondAngles = m.bonds.filter((b) => b.a === i || b.b === i).map((b) => { const o = P[b.a === i ? b.b : b.a]; return Math.atan2(o.y - P[i].y, o.x - P[i].x); });
    const cands = [-Math.PI / 2, 0, Math.PI / 2, Math.PI, -Math.PI / 4, -3 * Math.PI / 4];
    const free = cands.filter((c) => bondAngles.every((b) => Math.abs(Math.atan2(Math.sin(c - b), Math.cos(c - b))) > 0.6));
    free.slice(0, a.lone).forEach((ang) => pairs.push({ x: P[i].x + 24 * Math.cos(ang), y: P[i].y + 24 * Math.sin(ang), ang }));
  });
  const chk = checkLewis(m);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="enl-lw-t enl-lw-d" style={{ width: '100%', maxWidth: 420, height: 'auto' }}>
      <title id="enl-lw-t">{`Estructura de Lewis de ${m.formula}`}</title>
      <desc id="enl-lw-d">{`${m.formula}: ${chk.bondingPairs} pares de electrones compartidos y ${chk.lonePairs} pares libres, ${chk.drawn} electrones de valencia en total.`}</desc>
      <rect width={W} height={H} rx="12" fill="var(--surface-2)" />
      {m.bonds.map((b, k) => {
        const p = P[b.a], q = P[b.b];
        const L = Math.hypot(q.x - p.x, q.y - p.y) || 1;
        const nx = -(q.y - p.y) / L, ny = (q.x - p.x) / L;
        const offs = b.order === 1 ? [0] : b.order === 2 ? [-4, 4] : [-6, 0, 6];
        const sx = ((q.x - p.x) / L) * 15, sy = ((q.y - p.y) / L) * 15;
        return offs.map((o) => <line key={`${k}-${o}`} x1={p.x + sx + nx * o} y1={p.y + sy + ny * o} x2={q.x - sx + nx * o} y2={q.y - sy + ny * o} stroke="var(--ink)" strokeWidth="2.2" />);
      })}
      {pairs.map((d, i) => {
        const tx = -Math.sin(d.ang) * 4, ty = Math.cos(d.ang) * 4;
        return <g key={i}><circle cx={d.x + tx} cy={d.y + ty} r="2.6" fill="var(--series-1)" /><circle cx={d.x - tx} cy={d.y - ty} r="2.6" fill="var(--series-1)" /></g>;
      })}
      {m.atoms.map((a, i) => <text key={i} x={P[i].x} y={P[i].y + 7} textAnchor="middle" style={{ fontSize: 20, fontWeight: 700, fill: 'var(--ink)' }}>{a.el}</text>)}
    </svg>
  );
}

/** Escala de ΔEN con los límites orientativos 0,4 y 1,7. */
function DeltaScale({ dEN }: { dEN: number }) {
  const W = 520, x = (v: number) => 20 + (Math.min(3.3, v) / 3.3) * (W - 40);
  return (
    <svg viewBox={`0 0 ${W} 74`} role="img" aria-label={`Escala de diferencia de electronegatividad: ΔEN = ${fmt(dEN, 2)}`} style={{ width: '100%', height: 'auto' }}>
      <rect x={x(0)} y="16" width={x(EN_THRESHOLDS.nonPolar) - x(0)} height="18" fill="var(--series-8)" opacity="0.35" />
      <rect x={x(EN_THRESHOLDS.nonPolar)} y="16" width={x(EN_THRESHOLDS.ionic) - x(EN_THRESHOLDS.nonPolar)} height="18" fill="var(--series-2)" opacity="0.3" />
      <rect x={x(EN_THRESHOLDS.ionic)} y="16" width={x(3.3) - x(EN_THRESHOLDS.ionic)} height="18" fill="var(--series-1)" opacity="0.3" />
      {[0, 0.4, 1, 1.7, 2, 3].map((v) => <text key={v} x={x(v)} y="48" textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(v, v === 0.4 || v === 1.7 ? 1 : 0)}</text>)}
      <text x={x(0.2)} y="12" textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)' }}>no polar</text>
      <text x={x(1.05)} y="12" textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)' }}>covalente polar</text>
      <text x={x(2.5)} y="12" textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink)' }}>iónico (metal + no metal)</text>
      <path d={`M${x(dEN)} 36 l-7 14 h14 Z`} fill="var(--data)" />
      <text x={x(dEN)} y="68" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--data)', fontWeight: 700 }}>ΔEN = {fmt(dEN, 2)}</text>
    </svg>
  );
}

export default function ChemicalBondingLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('en');
  const [a, setA] = useState('Na');
  const [b, setB] = useState('Cl');
  const [molId, setMolId] = useState('h2o');
  const [subId, setSubId] = useState('nacl');
  const [done, setDone] = useState<Record<string, Partial<Record<TestId, TestResult>>>>({});
  const [guess, setGuess] = useState<Record<string, string>>({});

  const bond = classifyBond(a, b);
  const mol = lewisById(molId);
  const lewis = checkLewis(mol);
  const species = useMemo(() => moleculeSpecies(mol.speciesId), [mol]);
  const pol = useMemo(() => polarityScene(species, mol.formula), [species, mol]);
  const sub = substanceById(subId);
  const results = done[subId] ?? {};
  const allDone = TESTS.every((t) => results[t.id]);
  const inferred = allDone ? inferStructure(Object.fromEntries(TESTS.map((t) => [t.id, results[t.id]!.positive])) as Record<TestId, boolean | null>) : null;
  const sucrose = useMemo(() => speciesFromSdf(SUCROSE_SDF, { id: 'sacarosa', name: 'Sacarosa', label: 'C₁₂H₂₂O₁₁', geometry: 'pubchem', geometryLabel: PUBCHEM_GEOMETRY_LABEL,
    method: 'Confórmero 3D calculado por PubChem3D (OMEGA y campo de fuerza MMFF94s); no es una estructura medida.', source: { cid: 5988, url: 'https://pubchem.ncbi.nlm.nih.gov/compound/5988', fecha: '2026-11-01' } }), []);
  const metal = useMemo(() => metalScene(3), []);

  const doTest = (t: TestId) => {
    const r = runTest(sub, t);
    setDone((d) => ({ ...d, [subId]: { ...d[subId], [t]: r } }));
    playSound(t === 'calentar' ? 'click' : 'glassClink', { intensity: 0.5 });
  };
  const recordBond = () => api.addTrial('enlaces', { elementoA: a, elementoB: b, enA: bond.enA, enB: bond.enB, deltaEN: bond.dEN, caracterIonico: Number(bond.ionicPct.toFixed(1)), tipo: bond.type });
  const recordMol = () => api.addTrial('moleculas', {
    molecula: mol.formula, electronesValencia: lewis.valenceTotal, paresEnlace: lewis.bondingPairs, paresLibres: lewis.lonePairs,
    deltaENmax: Math.max(0, ...pol.polarity.bondDipoles.map((d) => Number(d.dEN.toFixed(2)))), dipoloNeto: Number(pol.polarity.netMagnitude.toFixed(2)), polaridad: pol.polarity.polar ? 'polar' : 'no polar',
  });
  const recordSub = () => api.addTrial('sustancias', {
    sustancia: sub.name, fusion: sub.meltingC, solubilidad: sub.solubility, deltaEN: sub.dEN,
    conduceSolido: sub.conductsSolid ? 1 : 0, conduceAgua: sub.conductsInWater === null ? null : sub.conductsInWater ? 1 : 0,
    estructura: guess[subId] ?? '', enlace: sub.bond,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation}
          options={[{ value: 'en', label: '1. Electronegatividad' }, { value: 'lewis', label: '2. Moléculas y Lewis' }, { value: 'propiedades', label: '3. Propiedades' }]} />
        {station === 'en' && (
          <>
            <section className="card stack" aria-labelledby="enl-en-h">
              <h3 id="enl-en-h">¿Qué tan desigual es el reparto de los electrones?</h3>
              <DeltaScale dEN={bond.dEN} />
              <p className="small" style={{ margin: 0 }}>{bond.note}</p>
            </section>
            <Readout items={[
              { k: `Electronegatividad de ${a}`, v: fmt(bond.enA, 2), data: true },
              { k: `Electronegatividad de ${b}`, v: fmt(bond.enB, 2), data: true },
              { k: 'Diferencia ΔEN', v: fmt(bond.dEN, 2), data: true },
              { k: 'Tipo de enlace (criterio orientativo)', v: bond.type },
              { k: 'Carácter iónico (Pauling)', v: `${fmt(bond.ionicPct, 0)} %` },
              { k: 'Atrae más los electrones (δ−)', v: bond.negative ?? 'ninguno: reparto igual' },
            ]} />
            {a === b && <ConditionAlert level="nota" title="el mismo elemento" cause={periodicElement(a).category === 'nometal' || periodicElement(a).category === 'halogeno' ? `Dos átomos de ${a} comparten los electrones por igual (ΔEN = 0): enlace covalente no polar, como en el ${a}₂.` : `Muchos átomos de ${a} juntos forman un metal (enlace metálico).`} fix="Elige un segundo elemento distinto para comparar repartos desiguales." />}
          </>
        )}
        {station === 'lewis' && (
          <>
            <section className="card stack" aria-labelledby="enl-lw-h">
              <h3 id="enl-lw-h">Estructura de Lewis de {mol.formula} ({mol.name.toLowerCase()})</h3>
              <LewisSvg m={mol} />
              <p className="small" style={{ margin: 0 }}>Puntos rojos: pares de electrones libres. Cada línea es un par compartido.</p>
            </section>
            <Readout items={[
              { k: 'Electrones de valencia (suma)', v: `${lewis.valenceTotal}`, data: true },
              { k: 'Pares compartidos / libres', v: `${lewis.bondingPairs} / ${lewis.lonePairs}` },
              { k: 'Octeto (dueto en H)', v: lewis.ok ? 'se cumple en todos los átomos' : 'no se cumple' },
              { k: 'Geometría', v: mol.geometry },
              { k: 'Cargas parciales', v: [...new Set(species.atoms.map((x, i) => `${x.el} ${partialText(pol.polarity.partial[i])}`))].join(', ') },
              { k: 'La molécula es', v: pol.polarity.polar ? `polar (dipolo ${fmt(pol.polarity.netMagnitude, 2)})` : 'no polar', data: true },
            ]} />
            <section className="card" aria-labelledby="enl-3d-h">
              <h3 id="enl-3d-h">Vista 3D: cargas parciales y polaridad</h3>
              <Scene3D idPrefix="enl" title={`Cargas parciales y dipolos de ${mol.formula} en 3D`} items={pol.items} extent={pol.extent} target={pol.target}
                description={pol.description} height={320} initialOrbit={{ yaw: 0.3, pitch: 0.25, zoom: 1.5 }} status="modelo"
                statusNote="Geometría de PubChem (o VSEPR del kit para el H₂); colores según la carga parcial estimada con ΔEN (rojo δ−, azul δ+, gris casi neutro); flechas ∝ ΔEN: estimación cualitativa, no un cálculo de densidad electrónica." />
            </section>
            <section className="card stack" aria-labelledby="enl-mol-h">
              <h3 id="enl-mol-h">La molécula real en 3D (visor molecular)</h3>
              <Molecule3D species={species} idPrefix="enlm" height={260} measure />
            </section>
          </>
        )}
        {station === 'propiedades' && (
          <>
            <section className="card stack" aria-labelledby="enl-pr-h">
              <h3 id="enl-pr-h">Pruebas con {sub.name.toLowerCase()} ({sub.formula})</h3>
              <ul className="list stack-sm" aria-live="polite" style={{ margin: 0 }}>
                {TESTS.map((t) => <li key={t.id}><strong>{t.label}:</strong> {results[t.id] ? results[t.id]!.text : <span className="muted">sin hacer</span>}</li>)}
              </ul>
              {allDone && (
                <div className="stack-sm">
                  <Select label="Según tus pruebas, la sustancia está formada por…" value={guess[subId] ?? ''} onChange={(v) => setGuess((g) => ({ ...g, [subId]: v }))}
                    options={[{ value: '', label: 'Elige una opción' }, ...STRUCTURES.map((s) => ({ value: s, label: s }))]} />
                  <div aria-live="polite">
                    {guess[subId] && (guess[subId] === sub.structure
                      ? <div className="notice ok"><strong>Correcto.</strong> {sub.note}</div>
                      : <div className="notice warn"><strong>Revisa.</strong> {guess[subId] === inferred ? '' : `Las pruebas apuntan a «${inferred}». `}{sub.note}</div>)}
                  </div>
                </div>
              )}
            </section>
            <Readout items={[
              { k: 'Punto de fusión', v: `${String(sub.meltingC).replace('.', ',')} °C${sub.decomposes ? ' (se descompone)' : ''}`, data: true },
              { k: 'Solubilidad en agua (25 °C)', v: sub.solubility > 0 ? `${fmt(sub.solubility, 1)} g/100 g` : 'insoluble', data: true },
              { k: 'Mayor ΔEN entre átomos enlazados', v: fmt(sub.dEN, 2) },
              { k: 'Tipo de enlace', v: allDone && guess[subId] === sub.structure ? sub.bond : 'decide con tus pruebas' },
            ]} />
            <p className="small" style={{ margin: 0 }}><StatusChip status="experimental" prefix="Datos" /> Fusión: {sub.meltingSource}. Solubilidad: {sub.solubilitySource}. <StatusChip status="ilustracion" prefix="Pruebas" /> resultado esperado según la bibliografía.</p>
            <section className="card" aria-labelledby="enl-est-h">
              <h3 id="enl-est-h">Vista 3D: ¿qué partículas forman {sub.name.toLowerCase()}?</h3>
              {sub.id === 'nacl' && <Crystal3D crystal={getCrystal('nacl')} idPrefix="enlc" height={300} />}
              {sub.id === 'cuarzo' && <Crystal3D crystal={getCrystal('sio2')} idPrefix="enlq" height={300} />}
              {sub.id === 'sacarosa' && <Molecule3D species={sucrose} idPrefix="enls" height={300} extraDescription="Una molécula de sacarosa; en el azúcar sólido muchas moléculas como esta se apilan y se unen por puentes de hidrógeno." />}
              {sub.id === 'cobre' && <Scene3D idPrefix="enlcu" title="Cobre: iones en una red y mar de electrones" items={metal.items} extent={metal.extent} target={metal.target} description={metal.description} height={300}
                status="ilustracion" statusNote="Posiciones de los iones de la red cúbica de caras centradas del cobre (a = 3,615 Å, Wyckoff 1963); electrones dibujados al azar: ilustración del «mar de electrones»." />}
              {sub.id === 'parafina' && <Notice>PubChem no tiene confórmero 3D del n-eicosano (cadenas largas y flexibles), así que el laboratorio no lo dibuja. Imagina cadenas de 20 carbonos en zigzag rodeadas de hidrógenos, apiladas como lápices y unidas solo por fuerzas débiles.</Notice>}
            </section>
          </>
        )}
        <IdeasPanel ideas={IDEAS} idPrefix="enl" intro="Ideas frecuentes sobre los enlaces. Decide si son ciertas o falsas y compruébalo en las tres estaciones." />
      </div>
      <div className="controls">
        {station === 'en' && (
          <div className="card stack">
            <h3>Elementos que se enlazan</h3>
            <Select label="Elemento A" value={a} onChange={setA} options={ELEMENTS.map((s) => ({ value: s, label: `${s} · ${periodicElement(s).es} (χ = ${fmt(periodicElement(s).en, 2)})` }))} />
            <Select label="Elemento B" value={b} onChange={setB} options={ELEMENTS.map((s) => ({ value: s, label: `${s} · ${periodicElement(s).es} (χ = ${fmt(periodicElement(s).en, 2)})` }))} />
            <RecordButton onRecord={recordBond} label="Guardar el par en la tabla" />
            <p className="small muted" style={{ margin: 0 }}>Electronegatividades de Pauling de PubChem ({PERIODIC_SOURCE.fecha}).</p>
          </div>
        )}
        {station === 'lewis' && (
          <div className="card stack">
            <h3>Molécula</h3>
            <Select label="Molécula" value={molId} onChange={setMolId} options={LEWIS.map((m) => ({ value: m.id, label: `${m.formula} · ${m.name}` }))} />
            <RecordButton onRecord={recordMol} label="Guardar la molécula en la tabla" />
          </div>
        )}
        {station === 'propiedades' && (
          <div className="card stack">
            <h3>Sustancia y pruebas</h3>
            <Select label="Sustancia" value={subId} onChange={setSubId} options={SUBSTANCES.map((s) => ({ value: s.id, label: `${s.name} (${s.formula})` }))} />
            {TESTS.map((t) => <button key={t.id} type="button" className="btn" onClick={() => doTest(t.id)} aria-pressed={!!results[t.id]}>{t.label}</button>)}
            <RecordButton onRecord={recordSub} disabled={!allDone} label="Guardar la sustancia en la tabla" />
            <Notice>Haz las cuatro pruebas y decide de qué partículas está hecha la sustancia antes de ver su tipo de enlace.</Notice>
          </div>
        )}
      </div>
    </div>
  );
}
