import { useEffect, useMemo, useRef, useState } from 'react';
import { fmt } from '../lib/format';
import { StatusChip } from '../components/Provenance';
import { Segmented } from '../components/ui';
import { ballRadius, elementColor, ionicRadius, STICK_RADIUS } from './elements';
import { applyMolStyle } from './molStyle';
import { ProjectedSvg, type SvgLine3D } from './ProjectedSvg';
import {
  bridgeAngles, calculatedDensity, cellMatrix, coordinationNumber, coordinationShell, CRYSTAL_GEOMETRY_LABEL, densityDeviation, densitySourceShort,
  DISTANCE_EXPR, formulaMass, generateLattice, networkBonds, shannonSum, shellDistances, SPACE_GROUP, STRUCTURE_NAME, SYSTEM_OF, toCart, type CrystalDef,
} from './crystal';
import { toSdf } from './species';
import { reducedMotion, use3DViewer, useThemeVersion, cssVar } from './engine3d';

type Size = 'shannon' | 'pequenas';
type V3 = [number, number, number];

const ionText = (el: string, q: number) => `${el}${Math.abs(q) > 1 ? Math.abs(q) : ''}${q > 0 ? '⁺' : '⁻'}`.replace(/([0-9])([⁺⁻])/, (_, d: string, s: string) => `${'⁰¹²³⁴⁵⁶⁷⁸⁹'[Number(d)]}${s}`);
const num = (v: number, d = 4) => fmt(v, d);

/** Aristas de las celdas de un bloque de n × n × n celdas (Å), con los vectores de la celda (cúbica, tetragonal o hexagonal). */
function cellEdges(c: CrystalDef, n: number): SvgLine3D[] {
  const M = cellMatrix(c);
  const P = (i: number, j: number, k: number) => toCart(M, [i, j, k]) as V3;
  const out: SvgLine3D[] = [];
  for (let i = 0; i <= n; i++) for (let j = 0; j <= n; j++) {
    out.push({ p: P(0, i, j), q: P(n, i, j) });
    out.push({ p: P(i, 0, j), q: P(i, n, j) });
    out.push({ p: P(i, j, 0), q: P(i, j, n) });
  }
  return out;
}

export interface Crystal3DProps { crystal: CrystalDef; idPrefix: string; height?: number; labelSuffix?: string }

/**
 * Red cristalina generada a partir de la estructura publicada (modelo calculado): bloque de 1 o 2 celdas por arista,
 * celda unidad, poliedro de coordinación y datos calculados (distancias, números de coordinación y densidad comparada
 * con la publicada). En las redes iónicas los iones se dibujan sin palitos (radios de Shannon o esferas pequeñas); en
 * las redes covalentes (cuarzo) se dibujan todos los enlaces con el estilo «esferas y palitos» común del kit
 * (applyMolStyle, src/chem/molStyle.ts).
 */
export function Crystal3D({ crystal, idPrefix, height = 320, labelSuffix = '' }: Crystal3DProps) {
  const [n, setN] = useState<'1' | '2'>('1');
  const [size, setSize] = useState<Size>('pequenas');
  const [who, setWho] = useState<'cation' | 'anion'>('cation');
  const [showCell, setShowCell] = useState(true);
  const [spin, setSpin] = useState(false);
  const sfx = labelSuffix ? ` ${labelSuffix}` : '';
  const N = Number(n);
  const covalent = crystal.bonding === 'covalente';
  const ions = useMemo(() => generateLattice(crystal, N), [crystal, N]);
  const bonds = useMemo(() => (covalent ? networkBonds(crystal, ions) : []), [covalent, crystal, ions]);
  const cnC = useMemo(() => coordinationNumber(crystal, 'cation'), [crystal]);
  const cnA = useMemo(() => coordinationNumber(crystal, 'anion'), [crystal]);
  const radius = (el: string, q: number) => {
    if (covalent) return ballRadius(el);
    const r = ionicRadius(el, q > 0 ? cnC : cnA);
    return size === 'shannon' ? r : r * 0.38;
  };
  // Átomo central del tipo elegido (el más cercano al centro del bloque) y sus vecinos de signo contrario.
  const focus = useMemo(() => {
    const mid = toCart(cellMatrix(crystal), [N / 2, N / 2, N / 2]);
    const cand = ions.map((x, i) => ({ i, x })).filter(({ x }) => (who === 'cation' ? x.charge > 0 : x.charge < 0))
      .sort((p, q) => Math.hypot(p.x.x - mid[0], p.x.y - mid[1], p.x.z - mid[2]) - Math.hypot(q.x.x - mid[0], q.x.y - mid[1], q.x.z - mid[2]))[0];
    return { center: cand.i, shell: coordinationShell(ions, cand.i) };
  }, [ions, who, N, crystal]);
  const shell = useMemo(() => shellDistances(crystal, 'cation'), [crystal]);
  const rho = calculatedDensity(crystal);
  const dev = densityDeviation(crystal);
  const shannon = shannonSum(crystal);
  const angles = useMemo(() => (covalent ? bridgeAngles(crystal) : []), [covalent, crystal]);
  const edges = useMemo(() => (showCell ? cellEdges(crystal, N) : []), [showCell, crystal, N]);

  const hostRef = useRef<HTMLDivElement>(null);
  const { viewerRef, engine, retry, fail } = use3DViewer(hostRef, `cristal 3D ${idPrefix}`);
  const theme = useThemeVersion();
  const framedFor = useRef('');
  useEffect(() => {
    const v = viewerRef.current;
    if (engine !== 'disponible' || !v) return;
    try {
      const key = `${crystal.id}-${N}`;
      if (framedFor.current !== key) {
        framedFor.current = key;
        v.removeAllModels();
        if (covalent) {
          // Red covalente: modelo con sus enlaces y el estilo común de esferas y palitos (los palitos siempre a la vista).
          v.addModel(toSdf({ id: crystal.id, name: crystal.nombre, label: crystal.formula, atoms: ions.map(({ el, x, y, z }) => ({ el, x, y, z })), bonds, charge: 0, geometry: 'cristal', geometryLabel: CRYSTAL_GEOMETRY_LABEL, method: '' }), 'sdf');
          applyMolStyle(v, 'bs', ions.map((x) => x.el));
        } else {
          v.addModel(`${ions.length}\nencuadre\n${ions.map((p) => `H ${p.x.toFixed(3)} ${p.y.toFixed(3)} ${p.z.toFixed(3)}`).join('\n')}`, 'xyz');
          v.setStyle({}, { sphere: { radius: 0.01, opacity: 0.01 } });
        }
        v.resize(); v.zoomTo(); v.zoom(0.85);
      }
      v.removeAllShapes();
      const data = cssVar('--data', '#b23a0a'), line = cssVar('--ink-2', '#44524f');
      const inShell = new Set([focus.center, ...focus.shell]);
      if (!covalent) ions.forEach((x, i) => v.addSphere({ center: { x: x.x, y: x.y, z: x.z }, radius: radius(x.el, x.charge), color: elementColor(x.el), opacity: inShell.has(i) || size === 'pequenas' ? 1 : 0.55 }));
      const r = covalent ? STICK_RADIUS.bs * 1.35 : 0.07;
      for (const j of focus.shell) { const p = ions[focus.center], q = ions[j]; v.addCylinder({ start: { x: p.x, y: p.y, z: p.z }, end: { x: q.x, y: q.y, z: q.z }, radius: r, color: data, fromCap: 1, toCap: 1 }); }
      for (const e of edges) v.addCylinder({ start: { x: e.p[0], y: e.p[1], z: e.p[2] }, end: { x: e.q[0], y: e.q[1], z: e.q[2] }, radius: 0.03, color: line, dashed: true, dashLength: 0.25, gapLength: 0.18 });
      if (spin && !reducedMotion()) v.spin('y', 0.4); else v.spin(false);
      v.render();
    } catch (e) { fail(e); }
  }, [engine, ions, bonds, covalent, focus, size, edges, spin, theme, crystal, N, viewerRef, fail]);

  const fallback = engine === 'sin-webgl' || engine === 'no-disponible';
  const descId = `${idPrefix}-c3d-desc`;
  const cat = covalent ? crystal.cation[0] : ionText(...crystal.cation);
  const an = covalent ? crystal.anion[0] : ionText(...crystal.anion);
  const sys = SYSTEM_OF[crystal.type];
  const params = `a = ${num(crystal.a)} Å${crystal.c ? `, c = ${num(crystal.c)} Å` : ''}`;
  const shellText = shell.map((s) => `${num(s.d, 3)} Å${shell.length > 1 ? ` (×${s.n})` : ''}`).join(' y ');
  const atomWord = covalent ? 'átomos' : 'iones';
  const desc = `Red de ${crystal.nombre} (${crystal.formula}), estructura ${STRUCTURE_NAME[crystal.type]}, ${params}; bloque de ${N}×${N}×${N} celdas con ${ions.length} ${atomWord}${covalent ? ` y ${bonds.length} enlaces` : ''}. Cada ${cat} tiene ${cnC} ${an} vecinos y cada ${an} tiene ${cnA} ${cat}; distancia ${cat}–${an} ${shellText}. Resaltado: un ${who === 'cation' ? cat : an} y sus ${focus.shell.length} vecinos.`;
  const expr = DISTANCE_EXPR[crystal.type];

  return (
    <figure className="chem3d" style={{ margin: 0, minWidth: 0, maxWidth: '100%' }}>
      <div style={{ position: 'relative', width: '100%', height, borderRadius: 12, background: 'radial-gradient(120% 90% at 30% 20%, var(--surface), var(--surface-2))', border: '1px solid var(--line)', overflow: 'hidden' }}>
        <div ref={hostRef} role="img" aria-label={`Red cristalina 3D de ${crystal.nombre}; arrastra para girar`} aria-describedby={descId}
          style={{ position: 'absolute', inset: 0, visibility: engine === 'disponible' ? 'visible' : 'hidden' }} />
        {engine === 'cargando' && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}><p role="status" className="small">Cargando el visor 3D (3Dmol.js)…</p></div>}
        {fallback && (
          <div style={{ position: 'absolute', inset: 0 }}>
            <ProjectedSvg ariaLabel={`Red de ${crystal.nombre}: vista de respaldo con las posiciones calculadas; arrastra o usa las flechas para girarla`}
              atoms={ions.map((x) => ({ el: x.el, x: x.x, y: x.y, z: x.z, r: radius(x.el, x.charge), charge: covalent ? undefined : x.charge }))}
              bonds={covalent ? bonds : focus.shell.map((j) => ({ a: focus.center, b: j, order: 1 }))} lines={edges} height={height} width={Math.round(height * 1.6)} selection={[focus.center]} showCharges={!covalent && size === 'shannon'} />
          </div>
        )}
        <div className="small" aria-hidden="true" style={{ position: 'absolute', right: 10, top: 8, display: 'flex', gap: 8, padding: '3px 8px', borderRadius: 999, background: 'color-mix(in srgb, var(--surface) 88%, transparent)', border: '1px solid var(--line)' }}>
          {[crystal.cation, crystal.anion].map(([el, q]) => <span key={el}><svg width="10" height="10" aria-hidden="true"><circle cx="5" cy="5" r="5" fill={elementColor(el)} /></svg> {covalent ? el : ionText(el, q)}</span>)}
        </div>
      </div>
      <p id={descId} className="sr-only">{desc}</p>
      <figcaption className="small" style={{ marginTop: 6 }}>
        <StatusChip status="modelo" prefix={covalent ? 'Red covalente' : 'Red cristalina'} /> <span className="muted">{CRYSTAL_GEOMETRY_LABEL.replace(/^[^:]+:\s*/, '')}: {params} ({crystal.sources.short}).</span>
      </figcaption>
      {fallback && (
        <div className="notice small" role="status" style={{ marginTop: 6 }}>
          <strong>Vista de respaldo:</strong> {engine === 'sin-webgl' ? 'este equipo no ofrece WebGL;' : 'no se pudo cargar el visor 3D;'} la red se dibuja con las mismas posiciones.
          {engine === 'no-disponible' && <> <button type="button" className="btn small" onClick={retry}>Reintentar el visor 3D</button></>}
        </div>
      )}
      <div className="stack" style={{ gap: 8, marginTop: 10 }}>
        <div className="btn-row" style={{ alignItems: 'flex-end', gap: '10px 28px', flexWrap: 'wrap' }}>
          <Segmented label={`Bloque de celdas${sfx}`} value={n} options={[{ value: '1', label: '1 celda' }, { value: '2', label: '2 × 2 × 2' }]} onChange={setN} />
          {!covalent && <Segmented label={`Tamaño de los iones${sfx}`} value={size} options={[{ value: 'pequenas', label: 'Esferas pequeñas' }, { value: 'shannon', label: 'Radios de Shannon' }]} onChange={setSize} />}
          <Segmented label={`Coordinación de${sfx}`} value={who} options={[{ value: 'cation', label: `un ${cat}` }, { value: 'anion', label: `un ${an}` }]} onChange={setWho} />
        </div>
        <div className="btn-row">
          <label className="check small"><input type="checkbox" checked={showCell} onChange={(e) => setShowCell(e.target.checked)} /> Mostrar las aristas de la celda</label>
          {!fallback && <button type="button" className="btn small" aria-pressed={spin} disabled={engine !== 'disponible' || reducedMotion()} onClick={() => setSpin((s) => !s)}>{spin ? 'Detener el giro' : 'Girar continuamente'}</button>}
        </div>
        <dl className="small chem-dl" style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(0, auto) minmax(0, 1fr)', gap: '3px 12px' }}>
          <dt>Estructura</dt><dd style={{ margin: 0 }}>{STRUCTURE_NAME[crystal.type]}{crystal.mineral ? ` (mineral: ${crystal.mineral})` : ''}</dd>
          <dt>Grupo espacial</dt><dd style={{ margin: 0 }}>{SPACE_GROUP[crystal.type]} · celda {sys === 'cubica' ? 'cúbica' : sys === 'tetragonal' ? 'tetragonal' : 'hexagonal'} con Z = {crystal.z}</dd>
          <dt>Parámetros de red</dt><dd style={{ margin: 0 }}>{params} (medidos por difracción de rayos X)</dd>
          <dt>Distancia {cat}–{an}</dt><dd style={{ margin: 0 }}><strong>{shellText}</strong>{expr ? ` = ${expr}` : ''} (calculada)</dd>
          {shannon !== null
            ? <><dt>Suma de radios de Shannon</dt><dd style={{ margin: 0 }}>{num(shannon, 2)} Å</dd></>
            : <><dt>Ángulo {cat}–{an}–{cat}</dt><dd style={{ margin: 0 }}>{angles.map((x) => `${num(x, 1)}°`).join(', ')} (calculado; red covalente: no se usan radios iónicos)</dd></>}
          <dt>Coordinación</dt><dd style={{ margin: 0 }}>{cat}: {cnC} · {an}: {cnA} (contada en la red)</dd>
          <dt>Densidad calculada</dt><dd style={{ margin: 0 }}><strong>{num(rho, 3)} g/cm³</strong> = {crystal.z} · {num(formulaMass(crystal), 2)} g/mol / (N_A · V)</dd>
          <dt>Densidad publicada</dt><dd style={{ margin: 0 }}>{String(crystal.densityPublished).replace('.', ',')} g/cm³ ({densitySourceShort(crystal)}) · diferencia {dev >= 0 ? '+' : '−'}{num(Math.abs(dev), 1)} %</dd>
        </dl>
        {crystal.densityNote && <p className="small muted" style={{ margin: 0 }}><strong>Diferencia mayor que 3 %.</strong> {crystal.densityNote}</p>}
        <details>
          <summary className="small">Fuentes de la estructura y de la densidad</summary>
          <ul className="small list" style={{ margin: '6px 0 0', overflowWrap: 'anywhere' }}>
            <li>Estructura: {crystal.sources.lattice}.</li>
            <li>Densidad publicada: {crystal.sources.density}.</li>
            <li>Posiciones: operaciones de simetría del grupo {SPACE_GROUP[crystal.type]} aplicadas a la unidad asimétrica; coordinación contada hasta 1,10 × la distancia mínima.</li>
          </ul>
        </details>
      </div>
    </figure>
  );
}
