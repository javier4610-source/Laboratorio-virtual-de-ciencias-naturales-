import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  configText, aufbauConfiguration, groupMembers, isMainGroup, PERIODIC, PERIODIC_SOURCE, periodicElement, periodMembers, PROPERTY_INFO, propertyRange,
  slaterZeff, trend, type PeriodicElement, type PeriodicProperty,
} from '../models/periodicTrends';
import { CATEGORY_LABEL } from '../models/periodicTable';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { StatusChip } from '../components/Provenance';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { BLOCK_NAME, BLOCK_TOKEN, periodicScene } from './periodic3d';

const PROPS: PeriodicProperty[] = ['radioCov', 'en', 'ei', 'zef', 'radioVdW', 'masa'];
const SERIES = [
  ...[2, 3, 4, 5, 6].map((p) => ({ value: `p${p}`, label: `Período ${p}` })),
  ...[1, 2, 13, 14, 15, 16, 17, 18].map((g) => ({ value: `g${g}`, label: `Grupo ${g}` })),
];

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Los átomos con más protones y electrones siempre son más grandes.', answer: 'falso', feedback: 'En un período el radio DISMINUYE aunque Z aumente: del Na (155 pm) al Cl (99 pm). Los electrones nuevos entran en la misma capa y la carga nuclear efectiva crece (de 2,20 a 6,10), así que el núcleo los atrae más.' },
  { id: 'i2', text: 'Al bajar por un grupo los átomos son más grandes porque tienen más capas de electrones.', answer: 'cierto', feedback: 'Cada período añade una capa: Li 133 pm, Na 155, K 196, Rb 210, Cs 232 pm. La carga nuclear efectiva sobre el electrón de valencia casi no cambia (2,20 para Na y K), pero ese electrón está cada vez más lejos.' },
  { id: 'i3', text: 'La energía de ionización aumenta siempre, sin excepciones, de izquierda a derecha en un período.', answer: 'falso', feedback: 'Es la tendencia general, pero los datos del NIST muestran excepciones: en el período 3, el Al (5,986 eV) es menor que el Mg (7,646 eV) y el S (10,360 eV) menor que el P (10,487 eV). Se explican con la configuración electrónica (3p¹ y el primer par en 3p⁴).' },
  { id: 'i4', text: 'El elemento más electronegativo es el flúor.', answer: 'cierto', feedback: 'Con 3,98 en la escala de Pauling es el valor más alto de la tabla. Por eso en todos sus compuestos atrae hacia sí los electrones del enlace.' },
  { id: 'i5', text: 'Los gases nobles tienen la electronegatividad más alta porque están al final de cada período.', answer: 'falso', feedback: 'La electronegatividad mide cómo atrae un átomo los electrones de un ENLACE; el helio, el neón y el argón no forman compuestos estables, así que no tienen valor de Pauling (en la tabla de PubChem aparecen sin dato).' },
];

const valueText = (e: PeriodicElement, p: PeriodicProperty) => {
  const v = e[p];
  const info = PROPERTY_INFO[p];
  return v === null ? 'sin dato' : `${fmt(v, info.decimals)}${info.unit ? ` ${info.unit}` : ''}`;
};

/** Gráfica de la propiedad en un período o grupo, con los símbolos y la línea de tendencia de los datos. */
function TrendChart({ series, prop, title }: { series: PeriodicElement[]; prop: PeriodicProperty; title: string }) {
  const info = PROPERTY_INFO[prop];
  const tr = trend(series, prop);
  const W = 600, H = 230, L = 58, R = 16, T = 16, B = 40;
  const vals = tr.points.map((p) => p.v);
  const lo = vals.length ? Math.min(0, ...vals) : 0, hi = vals.length ? Math.max(...vals) * 1.1 : 1;
  const x = (i: number) => L + (series.length > 1 ? (i / (series.length - 1)) * (W - L - R) : (W - L - R) / 2);
  const y = (v: number) => T + ((hi - v) / (hi - lo || 1)) * (H - T - B);
  const idx = (sym: string) => series.findIndex((e) => e.sym === sym);
  const path = tr.points.map((p, i) => `${i ? 'L' : 'M'}${x(idx(p.sym)).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const dirText = tr.direction === 'sin datos' ? 'faltan datos para ver una tendencia' : tr.direction === 'irregular' ? 'no sigue una tendencia clara' : `${tr.direction} (${fmt(tr.consistency * 100, 0)} % de los pasos)`;
  return (
    <figure style={{ margin: 0 }}>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby="tpe-g-t tpe-g-d" style={{ width: '100%', height: 'auto' }}>
        <title id="tpe-g-t">{`${info.label} en el ${title.toLowerCase()}`}</title>
        <desc id="tpe-g-d">{`${tr.points.map((p) => `${p.sym}: ${fmt(p.v, info.decimals)}`).join('; ')}. La propiedad ${dirText}.${tr.exceptions.length ? ` Excepciones: ${tr.exceptions.join(', ')}.` : ''}`}</desc>
        <rect x={L} y={T} width={W - L - R} height={H - T - B} fill="var(--surface)" stroke="var(--line)" />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => { const v = lo + f * (hi - lo); return <g key={f}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke="var(--line)" strokeDasharray="2 3" /><text x={L - 6} y={y(v) + 4} textAnchor="end" style={{ fontSize: 10, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(v, info.decimals > 1 ? 1 : 0)}</text></g>; })}
        <path d={path} fill="none" stroke="var(--series-2)" strokeWidth="2" />
        {series.map((e, i) => {
          const v = e[prop];
          return (
            <g key={e.sym}>
              {v !== null ? <circle cx={x(i)} cy={y(v)} r="5" fill="var(--data)" stroke="var(--surface)" /> : <text x={x(i)} y={H - B - 6} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-3)' }}>s/d</text>}
              <text x={x(i)} y={H - B + 16} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700 }}>{e.sym}</text>
            </g>
          );
        })}
        <text x={(L + W) / 2} y={H - 6} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{title}: Z creciente →</text>
        <text x={8} y={T + 4} style={{ fontSize: 10, fill: 'var(--ink-2)' }}>{info.unit || '—'}</text>
      </svg>
      <figcaption className="small" style={{ marginTop: 4 }}>
        <strong>Tendencia en tus datos reales:</strong> la {info.short} {dirText}.{tr.exceptions.length ? ` Pasos en sentido contrario: ${tr.exceptions.join(', ')}.` : ''}
      </figcaption>
    </figure>
  );
}

export default function PeriodicTableLab({ api }: LabProps) {
  const [prop, setProp] = useState<PeriodicProperty>('radioCov');
  const [sel, setSel] = useState('Na');
  const [serie, setSerie] = useState('p3');
  const [spheres, setSpheres] = useState<'periodo' | 'grupo' | 'ninguna'>('periodo');
  const gridRef = useRef<HTMLDivElement>(null);
  const e = periodicElement(sel);
  const info = PROPERTY_INFO[prop];
  const { max } = propertyRange(prop);
  const seriesEls = serie.startsWith('p') ? periodMembers(Number(serie.slice(1))) : groupMembers(Number(serie.slice(1)));
  const seriesTitle = SERIES.find((s) => s.value === serie)!.label;
  const slater = isMainGroup(e) ? slaterZeff(e.z) : null;
  const scene = useMemo(() => periodicScene({ property: prop, selected: sel, spheres }), [prop, sel, spheres]);

  const choose = (sym: string) => setSel(sym.replace(/^el-|^esf-/, ''));
  const focusCell = (sym: string) => { choose(sym); requestAnimationFrame(() => gridRef.current?.querySelector<HTMLButtonElement>(`[data-sym="${sym}"]`)?.focus()); };
  const onGridKey = (ev: KeyboardEvent<HTMLDivElement>) => {
    const dirs: Record<string, [number, number]> = { ArrowLeft: [0, -1], ArrowRight: [0, 1], ArrowUp: [-1, 0], ArrowDown: [1, 0] };
    if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); focusCell(ev.key === 'Home' ? 'H' : 'Og'); return; }
    const d = dirs[ev.key];
    if (!d) return;
    ev.preventDefault();
    // Casilla más cercana en esa dirección (salta los huecos de la tabla).
    const cands = PERIODIC.filter((x) => (d[0] ? Math.sign(x.row - e.row) === d[0] : x.row === e.row) && (d[1] ? Math.sign(x.col - e.col) === d[1] : true));
    const best = cands.sort((a, b) => (Math.abs(a.row - e.row) + Math.abs(a.col - e.col) * (d[0] ? 0.4 : 1)) - (Math.abs(b.row - e.row) + Math.abs(b.col - e.col) * (d[0] ? 0.4 : 1)))[0];
    if (best) focusCell(best.sym);
  };

  const record = () => api.addTrial('elementos', {
    simbolo: e.sym, z: e.z, periodo: e.period, grupo: e.group, radioCov: e.radioCov, radioVdW: e.radioVdW, en: e.en, ei: e.ei,
    zef: e.zef === null ? null : Number(e.zef.toFixed(2)), masa: e.masa,
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <section className="card stack" aria-labelledby="tpe-tabla-h">
          <h3 id="tpe-tabla-h">Tabla periódica: {info.label.toLowerCase()}</h3>
          <p className="small muted" style={{ margin: 0 }}>La barra de cada casilla mide en proporción al valor (la más alta: {fmt(max, info.decimals)}{info.unit ? ` ${info.unit}` : ''}). Elige un elemento con clic o con las flechas del teclado.</p>
          <div className="table-wrap" tabIndex={-1} role="region" aria-label="Tabla periódica (se desplaza en pantallas angostas)">
            <div ref={gridRef} role="group" aria-label={`Tabla periódica de los 118 elementos; ${info.label}. Flechas: moverse entre casillas`} onKeyDown={onGridKey}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(18, minmax(31px, 1fr))', gap: 2, minWidth: 600 }}>
              {PERIODIC.map((el) => {
                const v = el[prop];
                const isSel = el.sym === sel;
                return (
                  <button type="button" key={el.sym} data-sym={el.sym} tabIndex={isSel ? 0 : -1} aria-pressed={isSel}
                    aria-label={`${el.sym}, ${el.es}, Z = ${el.z}: ${info.short} ${valueText(el, prop)}`}
                    onClick={() => setSel(el.sym)}
                    style={{ gridRow: el.row + (el.row >= 8 ? 1 : 0), gridColumn: el.col, position: 'relative', width: '100%', height: 40, padding: '2px 0 0', borderRadius: 4, cursor: 'pointer', overflow: 'hidden',
                      border: isSel ? '2px solid var(--data)' : '1px solid var(--line)', background: 'var(--surface)', color: 'var(--ink)', font: 'inherit' }}>
                    <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: v === null ? 3 : `${Math.max(6, (v / max) * 100)}%`,
                      background: v === null ? 'var(--line-strong)' : `var(--${BLOCK_TOKEN[el.bloque]})`, opacity: 0.32 }} />
                    <span aria-hidden="true" style={{ position: 'relative', fontSize: 9, display: 'block', lineHeight: 1, color: 'var(--ink-2)' }}>{el.z}</span>
                    <span aria-hidden="true" style={{ position: 'relative', fontSize: 13, fontWeight: 700, lineHeight: 1.3 }}>{el.sym}</span>
                  </button>
                );
              })}
              <div aria-hidden="true" style={{ gridRow: 8, gridColumn: '1 / span 18', height: 8 }} />
            </div>
          </div>
          <p className="small" style={{ margin: 0 }}>
            {(['s', 'p', 'd', 'f'] as const).map((b) => <span key={b} style={{ marginRight: 12, whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 12, borderRadius: 3, background: `var(--${BLOCK_TOKEN[b]})`, opacity: 0.6, marginRight: 4, verticalAlign: 'middle' }} />{BLOCK_NAME[b]}</span>)}
            <span style={{ whiteSpace: 'nowrap' }}><span aria-hidden="true" style={{ display: 'inline-block', width: 12, height: 3, background: 'var(--line-strong)', marginRight: 4, verticalAlign: 'middle' }} />sin dato</span>
          </p>
        </section>
        <div aria-live="polite">
          <Readout live={false} items={[
            { k: 'Elemento', v: `${e.sym} · ${e.es} (Z = ${e.z})` },
            { k: 'Período y grupo', v: `${e.period}${e.group ? ` · grupo ${e.group}` : ' · bloque f'} (${CATEGORY_LABEL[e.category]})` },
            { k: 'Radio covalente', v: valueText(e, 'radioCov'), data: true },
            { k: 'Electronegatividad (Pauling)', v: valueText(e, 'en'), data: true },
            { k: '1.ª energía de ionización', v: valueText(e, 'ei'), data: true },
            { k: 'Z efectiva (Slater)', v: slater ? fmt(slater.zef, 2) : 'solo grupos principales' },
            { k: 'Radio de van der Waals', v: valueText(e, 'radioVdW') },
            { k: 'Masa atómica', v: valueText(e, 'masa') },
          ]} />
        </div>
        {slater && (
          <p className="small" style={{ margin: 0 }}>
            <strong>Slater para {e.sym}</strong> ({configText(aufbauConfiguration(e.z))}): el electrón de la capa {slater.n} siente Z_ef = {e.z} − ({slater.same} × {slater.n === 1 ? '0,30' : '0,35'} + {slater.inner1} × 0,85 + {slater.inner2} × 1,00) = <strong>{fmt(slater.zef, 2)}</strong>.
          </p>
        )}
        {e[prop] === null && (
          <ConditionAlert level="nota" title={`${e.sym} no tiene dato de ${info.short}`}
            cause={e.z > 103 ? 'Los elementos superpesados duran fracciones de segundo y casi no hay mediciones.' : prop === 'en' ? 'La escala de Pauling necesita enlaces del elemento; los gases nobles livianos no forman compuestos estables.' : prop === 'zef' ? 'Las reglas de Slater de esta práctica son para los grupos principales (bloques s y p).' : 'La fuente no da este valor.'}
            fix="Elige otro elemento u otra propiedad: el laboratorio nunca inventa un valor que falta." />
        )}
        <section className="card stack" aria-labelledby="tpe-tend-h">
          <h3 id="tpe-tend-h">Tendencia en un período o en un grupo</h3>
          <Select label="Serie de elementos" value={serie} onChange={setSerie} options={SERIES} />
          <TrendChart series={seriesEls} prop={prop} title={seriesTitle} />
        </section>
        <section className="card" aria-labelledby="tpe-3d-h">
          <h3 id="tpe-3d-h">Vista 3D: relieve periódico</h3>
          <Segmented<'periodo' | 'grupo' | 'ninguna'> label="Esferas con el radio real" value={spheres} onChange={setSpheres}
            options={[{ value: 'periodo', label: 'Del período' }, { value: 'grupo', label: 'Del grupo' }, { value: 'ninguna', label: 'Ninguna' }]} />
          <Scene3D idPrefix="tpe" title={`Relieve periódico: ${info.label.toLowerCase()}`} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={360} initialOrbit={{ yaw: 0.35, pitch: 0.62, zoom: 1.15 }} selectedId={`el-${sel}`} onSelect={choose}
            status="modelo" statusNote="Alturas proporcionales a los datos reales (PubChem y Pyykkö); esferas con el radio covalente a escala entre sí. Toca una columna para elegir el elemento." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="tpe" intro="Ideas frecuentes sobre la tabla periódica. Decide si son ciertas o falsas y compruébalo con los datos." />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Propiedad</h3>
          <Select label="Propiedad que se muestra" value={prop} onChange={(v) => setProp(v as PeriodicProperty)} options={PROPS.map((p) => ({ value: p, label: `${PROPERTY_INFO[p].label}${PROPERTY_INFO[p].unit ? ` (${PROPERTY_INFO[p].unit})` : ''}` }))} />
          <Select label="Elemento elegido" value={sel} onChange={setSel} options={PERIODIC.map((x) => ({ value: x.sym, label: `${x.z} · ${x.sym} · ${x.es}` }))} />
          <RecordButton onRecord={record} label="Guardar el elemento en la tabla" />
        </div>
        <div className="card stack">
          <h3>Procedencia de los datos</h3>
          <p className="small" style={{ margin: 0 }}><StatusChip status="experimental" prefix="Datos" /> {info.source}.</p>
          <p className="small" style={{ margin: 0, overflowWrap: 'anywhere' }}>Tabla periódica de PubChem (pubchem.ncbi.nlm.nih.gov), consulta del {PERIODIC_SOURCE.fecha}. Radios covalentes: Pyykkö y Atsumi (2009).</p>
          <p className="small" style={{ margin: 0 }}><StatusChip status="modelo" prefix="Z efectiva" /> reglas de Slater (1930), calculadas por el laboratorio.</p>
        </div>
        <Notice>Guarda los elementos de un período completo y de un grupo completo: en el cuaderno podrás graficar el radio contra Z o contra Z_ef y buscar la relación.</Notice>
      </div>
    </div>
  );
}
