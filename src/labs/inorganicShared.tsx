import { useState } from 'react';
import type { Compound } from '../models/inorganicNomenclature';
import { FUNCTION_LABEL } from '../models/inorganicNomenclature';
import { playSound } from '../lib/sound';
import { Lcd, TestTube, shade } from './kit';

/* ------------------------------------------------------------------ ideas erróneas */

export interface Idea { id: string; text: string; answer: 'cierto' | 'falso'; feedback: string }

/** Panel «Pon a prueba estas ideas»: el estudiante decide y recibe retroalimentación explicada. */
export function IdeasPanel({ ideas, idPrefix, intro }: { ideas: Idea[]; idPrefix: string; intro: string }) {
  const [picked, setPicked] = useState<Record<string, 'cierto' | 'falso'>>({});
  return (
    <section className="card stack" aria-labelledby={`${idPrefix}-ideas-h`}>
      <h3 id={`${idPrefix}-ideas-h`}>Pon a prueba estas ideas</h3>
      <p className="small muted">{intro}</p>
      <ol className="list stack-sm" style={{ paddingLeft: '1.2em' }}>
        {ideas.map((it) => {
          const p = picked[it.id];
          const ok = p === it.answer;
          return (
            <li key={it.id} className="stack-sm">
              <span><strong>«{it.text}»</strong></span>
              <div className="btn-row" role="group" aria-label={`Tu respuesta: ${it.text}`}>
                <button type="button" className="btn small" aria-pressed={p === 'cierto'} onClick={() => { setPicked((s) => ({ ...s, [it.id]: 'cierto' })); playSound('click'); }}>Es cierto</button>
                <button type="button" className="btn small" aria-pressed={p === 'falso'} onClick={() => { setPicked((s) => ({ ...s, [it.id]: 'falso' })); playSound('click'); }}>Es falso</button>
              </div>
              <div aria-live="polite">
                {p && <div className={`notice ${ok ? 'ok' : 'warn'}`}><strong>{ok ? `Bien: es ${it.answer === 'falso' ? 'falsa' : 'cierta'}. ` : `Revisa: la idea es ${it.answer === 'falso' ? 'falsa' : 'cierta'}. `}</strong>{it.feedback}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ nombres en los tres sistemas */

/** Ficha de nombres de un compuesto: sistemática, Stock y tradicional, con el estatus IUPAC 2005 de cada uno. */
export function NamesCard({ compound, title, idPrefix, compact = false }: { compound: Compound; title?: string; idPrefix: string; compact?: boolean }) {
  const c = compound;
  const rows: [string, string | null | undefined, string][] = [
    [c.fn === 'oxacido' ? 'Sistemática (nomenclatura de hidrógeno)' : c.fn === 'hidruro-no-metalico' ? 'Nombre IUPAC del hidruro' : 'Sistemática (prefijos)', c.names.sistematica, 'Recomendada por la IUPAC 2005'],
    ['Stock (número de oxidación)', c.names.stock, c.names.stock ? 'Recomendada por la IUPAC 2005' : 'No se usa para este tipo de compuesto'],
    ['Tradicional', c.names.tradicional, c.fn === 'oxacido' || c.fn === 'hidracido' ? 'Aceptada por la IUPAC 2005 para ácidos' : c.names.tradicional ? 'No recomendada por la IUPAC 2005 (uso escolar)' : 'No existe o no se usa'],
  ];
  if (c.names.comun) rows.push(['Nombre común', c.names.comun, 'Aceptado por la IUPAC']);
  if (c.names.antigua) rows.push(['Forma de textos anteriores', c.names.antigua, 'Ya no recomendada']);
  return (
    <div className="stack-sm">
      {title && <h4 style={{ margin: 0 }}>{title}: <span className="data-value" style={{ fontFamily: 'var(--font-data)' }}>{c.formulaPretty}</span></h4>}
      <p className="small" style={{ margin: 0 }}><span className="chip" style={{ whiteSpace: "normal", borderRadius: 12 }}>{FUNCTION_LABEL[c.fn]}</span></p>
      <div className="table-wrap" tabIndex={0} role="region" aria-label={`Nombres de ${c.formulaPretty}`}>
        <table className="small">
          <caption className="sr-only">Nombres de {c.formulaPretty} en cada sistema</caption>
          <thead><tr><th scope="col">Sistema</th><th scope="col">Nombre</th>{!compact && <th scope="col">IUPAC 2005</th>}</tr></thead>
          <tbody>{rows.map(([sys, name, st]) => <tr key={sys}><th scope="row" style={{ fontWeight: 600 }}>{sys}</th><td>{name ?? '—'}</td>{!compact && <td className="muted">{st}</td>}</tr>)}</tbody>
        </table>
      </div>
      {!compact && (
        <details>
          <summary className="small">Neutralidad de cargas y notas</summary>
          <ul className="small list" id={`${idPrefix}-neutral`}>{[...c.neutrality, ...c.notes].map((t) => <li key={t}>{t}</li>)}</ul>
          <p className="small muted">{c.recommended}</p>
        </details>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ instrumentos SVG */

/** Mechero Bunsen con llama (color según la sustancia); `burning` anima la llama si no hay movimiento reducido. */
export function Burner({ x, y, flame, on }: { x: number; y: number; flame: string; on: boolean }) {
  return (
    <g aria-hidden="true">
      <ellipse cx={x} cy={y + 2} rx={30} ry={5} fill="#000" opacity="0.18" />
      <path d={`M${x - 26} ${y} L${x + 26} ${y} L${x + 20} ${y - 10} L${x - 20} ${y - 10} Z`} fill="url(#kit-metal)" stroke="#7d8a8f" />
      <rect x={x - 7} y={y - 70} width={14} height={60} rx={2} fill="url(#kit-metal-h)" stroke="#7d8a8f" />
      <rect x={x - 9} y={y - 32} width={18} height={8} rx={2} fill="#59656a" />
      <path d={`M${x + 7} ${y - 22} h22 v6 h-22 Z`} fill="#c45a3c" />
      {on && (
        <g className="oxh-flame">
          <path d={`M${x} ${y - 140} C${x + 18} ${y - 110} ${x + 14} ${y - 84} ${x} ${y - 72} C${x - 14} ${y - 84} ${x - 18} ${y - 110} ${x} ${y - 140} Z`} fill="#6aa5ff" opacity="0.45" />
          <path d={`M${x} ${y - 118} C${x + 9} ${y - 100} ${x + 7} ${y - 84} ${x} ${y - 76} C${x - 7} ${y - 84} ${x - 9} ${y - 100} ${x} ${y - 118} Z`} fill="#2b5fd9" opacity="0.7" />
          <circle cx={x} cy={y - 150} r={20} fill={flame} opacity="0.55" />
          <circle cx={x} cy={y - 150} r={10} fill="#fff" opacity="0.7" />
        </g>
      )}
    </g>
  );
}

/** pH-metro de mano con electrodo; muestra la lectura o «—». */
export function PhMeter({ x, y, reading, probeTo }: { x: number; y: number; reading: string; probeTo: [number, number] }) {
  return (
    <g>
      <path d={`M${x + 40} ${y + 6} C${x + 40} ${y - 30} ${probeTo[0]} ${y - 40} ${probeTo[0]} ${probeTo[1] - 60}`} fill="none" stroke="#2c3438" strokeWidth="2.4" />
      <rect x={probeTo[0] - 4} y={probeTo[1] - 62} width={8} height={62} rx={3} fill="#e8eef0" stroke="#7d8a8f" />
      <circle cx={probeTo[0]} cy={probeTo[1]} r={5} fill="#cfe6f2" stroke="#7d8a8f" />
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={84} height={112} rx={12} fill="url(#kit-body-dark)" stroke="#20282b" />
      </g>
      <Lcd x={x + 8} y={y + 12} w={68} h={30} text={reading} />
      <text x={x + 42} y={y + 58} textAnchor="middle" style={{ fontSize: 9, fill: '#c9d3d6', fontWeight: 700, letterSpacing: 1 }}>pH-METRO</text>
      <circle cx={x + 26} cy={y + 82} r={8} fill="#3d474b" /><circle cx={x + 58} cy={y + 82} r={8} fill="#3d474b" />
    </g>
  );
}

/** Gradilla con tres tubos: fenolftaleína, papel tornasol (tira) e indicador universal. */
export function IndicatorRack({ x, y, readings, idle }: { x: number; y: number; readings: { name: string; color: string; text: string }[] | null; idle: boolean }) {
  const labels = ['Fenolf.', 'Tornasol', 'Univ.'];
  return (
    <g>
      <rect x={x - 8} y={y + 70} width={132} height={10} rx={2} fill="url(#kit-wood)" />
      <rect x={x - 8} y={y + 22} width={132} height={8} rx={2} fill="url(#kit-wood)" opacity="0.9" />
      {labels.map((l, i) => {
        const r = readings?.[i];
        const liquid = idle || !r ? '#dfeef5' : i === 1 ? '#e9f2f6' : r.color;
        return (
          <g key={l}>
            <TestTube x={x + i * 42} y={y} w={20} h={96} fill={0.55} liquid={liquid.startsWith('#') ? liquid : '#e9f2f6'} liquidOpacity={idle ? 0.35 : 0.8}>
              {i === 1 && r && !idle && <rect x={x + i * 42 + 7} y={y - 18} width={6} height={70} rx={1} fill={r.color} stroke={shade(r.color, -0.3)} strokeWidth="0.6" />}
            </TestTube>
            {i === 0 && r && !idle && r.color.startsWith('color-mix') && <rect x={x + 2} y={y + 50} width={16} height={40} fill="#d63384" opacity="0.4" />}
            <text x={x + i * 42 + 10} y={y + 114} textAnchor="middle" style={{ fontSize: 9.5, fill: 'var(--ink-2)' }}>{l}</text>
          </g>
        );
      })}
    </g>
  );
}
