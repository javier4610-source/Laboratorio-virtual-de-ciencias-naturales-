import { useId, useMemo, useState, type ReactNode } from 'react';
import { StatusChip } from '../Provenance';
import { Select } from '../ui';
import { fmt } from '../../lib/format';
import { BenchTop, ContactShadow, TestTube, shade } from '../../labs/kit';
import { FormulaSvg } from './FormulaSvg';
import type { EpistemicStatus } from '../../lib/provenance';
import { baseShort, getFunc, type FProp, type FPka, type FRecord, type FSolubility } from '../../data/quimica/funcionales';
import { compareWithPubChem, MATCH_EXPLAIN, nameFunctional } from '../../models/functionalNomenclature';
import { parseSmiles, SmilesError, type OMolecule } from '../../models/organicGraph';
import { GROUP_LABEL, SUFFIX_PREFIX } from '../../models/functionalGroups';
import type { TestOutcome } from '../../models/functionalProperties';

/** Franja de estatus de una sección. */
export function Status({ status, prefix, children }: { status: EpistemicStatus; prefix: string; children: ReactNode }) {
  return (
    <div className="btn-row small fn-status" role="note" aria-label={`Estatus: ${prefix}`} style={{ alignItems: 'baseline' }}>
      <StatusChip status={status} prefix={prefix} /> <span className="muted">{children}</span>
    </div>
  );
}

/** Valor experimental con su fuente al pasar el cursor, o «Sin información disponible». */
export function Exp({ p, decimals = 1, unit }: { p: FProp | FPka | null | undefined; decimals?: number; unit?: string }) {
  if (!p) return <span className="muted">Sin información disponible</span>;
  return <span title={`«${p.texto}» — ${p.cita || baseShort(p.base)}`}>{fmt(p.valor, decimals)}{unit ?? ('unidad' in p && p.unidad ? ` ${p.unidad}` : '')}{'nota' in p && p.nota ? ` (${p.nota})` : ''}</span>;
}

export function solText(s: FSolubility | null | undefined): string {
  if (!s) return 'Sin información disponible';
  if (s.tipo === 'miscible') return 'miscible';
  const v = s.valor ?? 0;
  return `${v >= 100 ? fmt(v, 0) : v >= 1 ? fmt(v, 1) : v >= 0.01 ? fmt(v, 3) : v.toExponential(1).replace('.', ',')} g/L${s.temperatura !== undefined && s.temperatura !== 25 ? ` (${fmt(s.temperatura, 0)} °C)` : ''}`;
}

/** Lista de fuentes de un compuesto (texto literal, obra citada, base y enlace a PUG View). */
export function Sources({ rec, keys }: { rec: FRecord; keys: { k: keyof FRecord['propiedades']; label: string }[] }) {
  return (
    <ul className="list small" style={{ margin: 0 }}>
      {keys.map(({ k, label }) => {
        const p = rec.propiedades[k];
        return (
          <li key={k}><strong>{label}:</strong>{' '}
            {p ? <>«{p.texto}» — {p.cita ? `${p.cita} ` : ''}({baseShort(p.base)}). <a href={p.url} target="_blank" rel="noopener noreferrer">PUG View</a> ({p.fecha}).</> : <span className="muted">Sin información disponible en PubChem (consulta del {rec.fuente.fecha}).</span>}
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------------------ banco de tubos de ensayo */

export interface TubeView { label: string; outcome: TestOutcome | null; reagent: string; /** Rótulo corto del frasco (p. ej. «Tollens»). */ short?: string }

/** Gradilla con un tubo de ensayo y el frasco gotero del reactivo (Ilustración educativa). */
export function TubeBench({ tube, idPrefix, adding }: { tube: TubeView; idPrefix: string; adding: boolean }) {
  const uid = useId().replace(/:/g, '');
  const o = tube.outcome;
  const look = o?.look ?? { liquid: '#eef2f3' };
  const W = 560, H = 300, tx = 298, ty = 74, tw = 44, th = 176;
  const liquid = look.liquid;
  const text = o ? `${tube.label} con ${tube.reagent}: ${o.observation}` : `${tube.label}: tubo con la muestra, antes de agregar ${tube.reagent}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${idPrefix}-${uid}-t`} className="fn-bench" style={{ width: '100%', height: 'auto', display: 'block' }}>
      <title id={`${idPrefix}-${uid}-t`}>{text}</title>
      <style>{`
        @keyframes ${uid}-rise { 0% { transform: translateY(0); opacity: 0 } 15% { opacity: .9 } 100% { transform: translateY(-120px); opacity: 0 } }
        @keyframes ${uid}-drop { 0% { transform: translateY(0); opacity: 0 } 20% { opacity: 1 } 100% { transform: translateY(70px); opacity: 0 } }
        .${uid}-b { animation: ${uid}-rise 2.2s ease-in infinite; }
        .${uid}-d { animation: ${uid}-drop .9s ease-in 3; }
      `}</style>
      <defs>
        <linearGradient id={`${uid}-mirror`} x1="0" x2="1">
          <stop offset="0" stopColor="#3d4447" /><stop offset="0.18" stopColor="#d7dde0" /><stop offset="0.32" stopColor="#6e787c" /><stop offset="0.55" stopColor="#f6f9fa" /><stop offset="0.78" stopColor="#7b8589" /><stop offset="1" stopColor="#40484b" />
        </linearGradient>
        <radialGradient id={`${uid}-turb`} cx="0.5" cy="0.6" r="0.6"><stop offset="0" stopColor="#ffffff" stopOpacity="0.85" /><stop offset="1" stopColor="#ffffff" stopOpacity="0.35" /></radialGradient>
      </defs>
      <BenchTop y={262} width={W} />
      {/* gradilla */}
      <g aria-hidden="true">
        <ContactShadow x={190} y={262} w={260} />
        <rect x={196} y={170} width={248} height={14} rx={3} fill="url(#kit-wood)" stroke="#8a6a45" strokeWidth="1" />
        <rect x={196} y={238} width={248} height={10} rx={3} fill="url(#kit-wood)" stroke="#8a6a45" strokeWidth="1" />
        <rect x={204} y={184} width={8} height={78} fill="url(#kit-wood)" /><rect x={428} y={184} width={8} height={78} fill="url(#kit-wood)" />
        {[236, 372].map((x) => <ellipse key={x} cx={x + 11} cy={177} rx={14} ry={4} fill="#5d452c" opacity="0.55" />)}
        <TestTube x={226} y={92} w={22} h={150} fill={0.25} liquid="#e9eef0" liquidOpacity={0.4} />
        <TestTube x={362} y={92} w={22} h={150} fill={0.25} liquid="#e9eef0" liquidOpacity={0.4} />
      </g>
      {/* tubo principal (se apoya en la gradilla) */}
      <g>
        <ellipse cx={tx + tw / 2} cy={177} rx={tw / 2 + 4} ry={5} fill="#5d452c" opacity="0.6" aria-hidden="true" />
        <TestTube x={tx} y={ty} w={tw} h={th} fill={0.42} liquid={liquid} liquidOpacity={0.78}>
          {look.turbid && <path d={`M${tx + 2} ${ty + th - th * 0.42 + 3} L${tx + tw - 2} ${ty + th - th * 0.42 + 3} L${tx + tw - 2} ${ty + th - tw / 2} A${tw / 2 - 2} ${tw / 2 - 2} 0 0 1 ${tx + 2} ${ty + th - tw / 2} Z`} fill={`url(#${uid}-turb)`} />}
          {look.layer && <rect x={tx + 2} y={ty + th - th * 0.42 + 2} width={tw - 4} height={12} fill="#fff8d8" opacity="0.85" />}
          {look.precipitate && <ellipse cx={tx + tw / 2} cy={ty + th - 12} rx={tw / 2 - 5} ry={8} fill={look.precipitate} />}
          {look.precipitate && <ellipse cx={tx + tw / 2} cy={ty + th - 16} rx={tw / 2 - 9} ry={4} fill={shade(look.precipitate, 0.25)} opacity="0.8" />}
          {look.mirror && <path d={`M${tx + 1.5} ${ty + th * 0.45} L${tx + 1.5} ${ty + th - tw / 2} A${tw / 2 - 1.5} ${tw / 2 - 1.5} 0 0 0 ${tx + tw - 1.5} ${ty + th - tw / 2} L${tx + tw - 1.5} ${ty + th * 0.45} L${tx + tw - 6} ${ty + th * 0.45} L${tx + tw - 6} ${ty + th - tw / 2} A${tw / 2 - 6} ${tw / 2 - 6} 0 0 1 ${tx + 6} ${ty + th - tw / 2} L${tx + 6} ${ty + th * 0.45} Z`} fill={`url(#${uid}-mirror)`} opacity="0.95" />}
          {look.bubbles && [0, 1, 2, 3, 4, 5].map((k) => (
            <circle key={k} className={`${uid}-b`} cx={tx + 10 + (k * 7) % (tw - 18)} cy={ty + th - 18 - (k % 3) * 8} r={2 + (k % 3)} fill="#ffffff" stroke="#9fb6bd" strokeWidth="0.8" style={{ animationDelay: `${k * 0.35}s` }} />
          ))}
        </TestTube>
      </g>
      {/* frasco gotero del reactivo */}
      <g aria-hidden="true">
        <ContactShadow x={70} y={262} w={86} />
        <path d="M76 262 L76 168 Q76 150 96 146 L130 146 Q150 150 150 168 L150 262 Z" fill="#6b4a2a" opacity="0.92" />
        <path d="M76 262 L76 168 Q76 150 96 146 L130 146 Q150 150 150 168 L150 262 Z" fill="url(#kit-glass)" />
        <rect x={84} y={190} width={58} height={44} rx={4} fill="var(--surface)" stroke="var(--line)" />
        <text x={113} y={209} textAnchor="middle" style={{ fontSize: (tube.short ?? '').length > 8 ? 9 : 11, fontWeight: 800, fill: 'var(--ink)' }}>{tube.short ?? tube.reagent.split(' ')[0]}</text>
        <text x={113} y={222} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)' }}>reactivo</text>
        <rect x={100} y={126} width={26} height={22} rx={4} fill="url(#kit-body-dark)" />
        <path d="M108 126 L108 96 Q113 84 118 96 L118 126 Z" fill="#2c2f31" />
      </g>
      {/* gotero sobre el tubo */}
      <g aria-hidden="true" transform={adding ? 'translate(0 0)' : 'translate(-140 40)'} style={{ transition: 'transform .5s ease' }}>
        <rect x={tx + tw / 2 - 5} y={-4} width={10} height={34} rx={3} fill="#2c2f31" />
        <path d={`M${tx + tw / 2 - 3} 30 L${tx + tw / 2 + 3} 30 L${tx + tw / 2 + 1} 50 L${tx + tw / 2 - 1} 50 Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge)" />
        {adding && <circle className={`${uid}-d`} cx={tx + tw / 2} cy={54} r={3} fill={liquid} stroke={shade(liquid.startsWith('#') ? liquid : '#888888', -0.3)} />}
      </g>
      {/* rótulo del tubo y resultado, a la derecha con una línea guía */}
      <g aria-hidden="true">
        <line x1={tx + tw + 2} x2={tx + tw + 22} y1={ty + 64} y2={ty + 64} stroke="var(--ink-2)" strokeWidth="1.2" />
        <rect x={tx + tw + 22} y={ty + 52} width={Math.min(170, 26 + tube.label.length * 7.2)} height={24} rx={12} fill="var(--surface)" stroke="var(--line)" />
        <text x={tx + tw + 34} y={ty + 68} style={{ fontSize: 12, fontWeight: 700, fill: 'var(--ink)' }}>{tube.label.length > 21 ? `${tube.label.slice(0, 20)}…` : tube.label}</text>
        {o && (
          <g>
            <rect x={tx + tw + 22} y={ty + 14} width={92} height={28} rx={14} fill={o.positive ? 'var(--ok)' : 'var(--surface-3)'} stroke="var(--line)" />
            <text x={tx + tw + 68} y={ty + 33} textAnchor="middle" style={{ fontSize: 12, fontWeight: 800, letterSpacing: 0.5, fill: o.positive ? '#fff' : 'var(--ink)' }}>{o.positive ? 'POSITIVA' : 'NEGATIVA'}</text>
          </g>
        )}
      </g>
    </svg>
  );
}

/* ------------------------------------------------------------------ panel de nomenclatura */

export interface NamePreset { value: string; label: string; smiles: string; recId?: string }

/**
 * Nomenclatura con el motor del laboratorio: elige un ejemplo o escribe un SMILES; muestra el nombre (español e inglés), el grupo
 * principal, los pasos y la fórmula estructural con la cadena principal y sus localizadores, y la comparación con PubChem.
 */
export function NomenclaturePanel({ presets, idPrefix, onName }: { presets: NamePreset[]; idPrefix: string; onName?: (r: { es: string; en: string; smiles: string; clase: string }) => void }) {
  const [sel, setSel] = useState(presets[0].value);
  const [draft, setDraft] = useState('');
  const [custom, setCustom] = useState<string | null>(null);
  const preset = presets.find((p) => p.value === sel) ?? presets[0];
  const smiles = custom ?? preset.smiles;
  const parsed = useMemo((): { mol: OMolecule | null; error: string | null } => {
    try { return { mol: parseSmiles(smiles), error: null }; } catch (e) { return { mol: null, error: e instanceof SmilesError ? e.message : 'SMILES no válido.' }; }
  }, [smiles]);
  const res = useMemo(() => (parsed.mol ? nameFunctional(parsed.mol) : null), [parsed.mol]);
  const rec: FRecord | null = !custom && preset.recId ? getFunc(preset.recId) : null;
  const match = res?.ok && rec ? compareWithPubChem(rec.nombreIupac, res.en) : null;
  const clase = res?.ok ? (res.principal ? GROUP_LABEL[res.principal].replace(/ \(.*$/, '').toLowerCase() : 'sin grupo con sufijo') : '';
  const hl = res?.ok ? res.principalAtoms : [];
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="card stack">
          <h3 style={{ marginBottom: 0 }}>{res?.ok ? res.es : 'Nombre no disponible'}</h3>
          {res?.ok && <p className="small muted" style={{ margin: 0 }}>En inglés (Recomendaciones IUPAC 2013): <em>{res.en}</em>{res.comun ? <> · nombre común: <strong>{res.comun}</strong></> : null}</p>}
          <Status status="modelo" prefix="Nombre">calculado por el motor de nomenclatura del laboratorio (reglas IUPAC 2013: P-41 prioridad de grupos, P-44 progenitor, P-31.1.4 numeración).</Status>
          {parsed.mol && (
            <FormulaSvg mol={parsed.mol} mode="condensada" highlight={hl} locants={res?.ok ? res.locants : undefined} mainChain={res?.ok && res.parentKind === 'cadena' ? res.parentAtoms : undefined}
              title={`Fórmula estructural de ${res?.ok ? res.es : smiles}`} desc={res?.ok ? `Progenitor resaltado con sus localizadores; grupo principal: ${clase}.` : undefined} height={200} />
          )}
          <p className="small muted" style={{ margin: 0 }}>Fórmula estructural: ilustración en 2D (no es la geometría). Los números son los localizadores de la cadena o el anillo progenitor; en color, el grupo principal.</p>
          {!res?.ok && <div className="notice warn" role="status">{parsed.error ?? (res && !res.ok ? res.motivo : '')}</div>}
        </div>
        {res?.ok && (
          <div className="card stack">
            <h3>Cómo se construye el nombre</h3>
            <ol className="list" style={{ margin: 0 }}>{res.pasos.map((p) => <li key={p.titulo}><strong>{p.titulo.replace(/^\d+\.\s*/, '')}:</strong> {p.texto}</li>)}</ol>
          </div>
        )}
      </div>
      <div className="controls">
        <div className="card stack">
          <Select label="Compuesto de ejemplo" value={sel} onChange={(v) => { setSel(v); setCustom(null); setDraft(''); }} options={presets.map((p) => ({ value: p.value, label: p.label }))} />
          <div className="field">
            <label htmlFor={`${idPrefix}-smi`}>O escribe un SMILES</label>
            <div className="btn-row">
              <input id={`${idPrefix}-smi`} type="text" value={draft} placeholder="p. ej. CC(O)CC" spellCheck={false} autoCapitalize="off" style={{ flex: 1, minWidth: 140, fontFamily: 'var(--font-data)' }}
                onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && draft.trim()) setCustom(draft.trim()); }} />
              <button type="button" className="btn small" disabled={!draft.trim()} onClick={() => setCustom(draft.trim())}>Nombrar</button>
            </div>
            <span className="hint small muted">SMILES: C, O, N y halógenos; «=» doble enlace, «#» triple, ramas entre paréntesis, anillos con números.</span>
          </div>
          {res?.ok && (
            <div className="readout" aria-live="polite">
              <div className="item"><div className="k">Grupo principal (sufijo)</div><div className="v">{clase}</div></div>
              <div className="item"><div className="k">Sufijo</div><div className="v">{res.principal ? SUFFIX_PREFIX[res.principal].sufijo : '—'}</div></div>
              <div className="item"><div className="k">Como prefijo</div><div className="v">{res.principal ? SUFFIX_PREFIX[res.principal].prefijo : 'solo prefijos'}</div></div>
              <div className="item"><div className="k">Progenitor</div><div className="v">{res.parentKind === 'benceno' ? 'anillo de benceno' : res.parentKind === 'anillo' ? `anillo de ${res.parentAtoms.length} C` : `cadena de ${res.parentAtoms.length} C`}</div></div>
            </div>
          )}
          {onName && res?.ok && <button type="button" className="btn data" onClick={() => onName({ es: res.es, en: res.en, smiles, clase })}>Guardar el nombre en la tabla</button>}
        </div>
        {rec && res?.ok && match && (
          <div className="card stack">
            <h3>Comparación con PubChem</h3>
            <p className="small" style={{ margin: 0 }}>PubChem (LexiChem TK, CID <a href={`https://pubchem.ncbi.nlm.nih.gov/compound/${rec.cid}`} target="_blank" rel="noopener noreferrer">{rec.cid}</a>): <em>{rec.nombreIupac}</em></p>
            <p className="small" style={{ margin: 0 }}><strong>{match === 'idéntico' ? 'Coincide.' : 'Difiere por convención.'}</strong> {MATCH_EXPLAIN[match]}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ ideas erróneas */

export interface Idea { id: string; text: string; answer: 'cierto' | 'falso'; feedback: string }

/** «Pon a prueba estas ideas»: el estudiante decide si cada idea es cierta y recibe retroalimentación explicada con datos. */
export function IdeasPanel({ ideas, idPrefix, intro }: { ideas: Idea[]; idPrefix: string; intro: string }) {
  const [picked, setPicked] = useState<Record<string, 'cierto' | 'falso'>>({});
  return (
    <section className="card stack" aria-labelledby={`${idPrefix}-ideas-h`}>
      <h3 id={`${idPrefix}-ideas-h`}>Pon a prueba estas ideas</h3>
      <p className="small muted" style={{ margin: 0 }}>{intro}</p>
      <ol className="list stack-sm" style={{ paddingLeft: '1.2em', margin: 0 }}>
        {ideas.map((it) => {
          const p = picked[it.id];
          const ok = p === it.answer;
          return (
            <li key={it.id} className="stack-sm">
              <span><strong>«{it.text}»</strong></span>
              <div className="btn-row" role="group" aria-label={`Tu respuesta: ${it.text}`}>
                <button type="button" className="btn small" aria-pressed={p === 'cierto'} onClick={() => setPicked((s) => ({ ...s, [it.id]: 'cierto' }))}>Es cierto</button>
                <button type="button" className="btn small" aria-pressed={p === 'falso'} onClick={() => setPicked((s) => ({ ...s, [it.id]: 'falso' }))}>Es falso</button>
              </div>
              <div aria-live="polite">
                {p && <div className={`notice ${ok ? 'ok' : 'warn'}`}><strong>{ok ? 'Bien. ' : 'Revisa. '}</strong>La idea es {it.answer === 'cierto' ? 'cierta' : 'falsa'}. {it.feedback}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ barras comparativas (valores con signo) */

export interface BarItem { label: string; value: number | null; note?: string; color?: string; title?: string }

/** Barras horizontales accesibles (admite valores negativos; «Sin información» si falta el dato). La nota va bajo el nombre. */
export function BarCompare({ items, unit, title, decimals = 1, idPrefix, legend }: { items: BarItem[]; unit: string; title: string; decimals?: number; idPrefix: string; legend?: { color: string; label: string }[] }) {
  const uid = useId().replace(/:/g, '');
  const vals = items.map((i) => i.value).filter((v): v is number => v !== null);
  const min = Math.min(0, ...vals), max = Math.max(0, ...vals);
  const span = max - min || 1;
  const hasNote = items.some((i) => i.note);
  const W = 640, rowH = hasNote ? 44 : 34, left = 200, right = 64, top = 8;
  const H = top + items.length * rowH + 26;
  const x = (v: number) => left + ((v - min) / span) * (W - left - right);
  const ticks = niceTicksLocal(min, max);
  return (
    <figure style={{ margin: 0, minWidth: 0 }}>
      {legend && (
        <ul className="small" aria-hidden="true" style={{ listStyle: 'none', padding: 0, margin: '0 0 6px', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
          {legend.map((l) => <li key={l.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 12, height: 12, borderRadius: 3, background: l.color }} />{l.label}</li>)}
        </ul>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-labelledby={`${idPrefix}-${uid}-bt`} style={{ width: '100%', height: 'auto', display: 'block' }}>
        <title id={`${idPrefix}-${uid}-bt`}>{`${title}: ${items.map((i) => `${i.label} ${i.value === null ? 'sin información' : `${fmt(i.value, decimals)} ${unit}`}${i.note ? ` (${i.note})` : ''}`).join('; ')}`}</title>
        {ticks.map((t) => (
          <g key={t} aria-hidden="true">
            <line x1={x(t)} x2={x(t)} y1={top} y2={H - 22} stroke="var(--line)" strokeDasharray={t === 0 ? undefined : '3 4'} strokeWidth={t === 0 ? 1.6 : 1} />
            <text x={x(t)} y={H - 6} textAnchor="middle" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{fmt(t === 0 ? 0 : t, 0)}</text>
          </g>
        ))}
        {items.map((it, k) => {
          const y = top + k * rowH;
          const v = it.value;
          const cy = y + (hasNote ? 15 : rowH / 2);
          return (
            <g key={it.label}>
              <text x={left - 10} y={cy + 5} textAnchor="end" style={{ fontSize: 14, fill: 'var(--ink)', fontWeight: 600 }}>{it.label}</text>
              {it.note && <text x={left - 10} y={cy + 22} textAnchor="end" style={{ fontSize: 11.5, fill: 'var(--ink-2)' }}>{it.note}</text>}
              {v === null ? <text x={x(0) + 6} y={cy + 5} style={{ fontSize: 12, fill: 'var(--ink-2)', fontStyle: 'italic' }}>Sin información disponible</text> : (
                <>
                  <rect x={Math.min(x(0), x(v))} y={cy - 10} width={Math.max(2, Math.abs(x(v) - x(0)))} height={20} rx={5} fill={it.color ?? 'var(--series-1)'}>
                    <title>{it.title ?? `${it.label}: ${fmt(v, decimals)} ${unit}`}</title>
                  </rect>
                  <text x={Math.max(x(0), x(v)) + 6} y={cy + 5} style={{ fontSize: 13, fill: 'var(--ink)', fontFamily: 'var(--font-data)', fontWeight: 600 }}>{fmt(v, decimals)}</text>
                </>
              )}
            </g>
          );
        })}
        <text x={W - 4} y={H - 6} textAnchor="end" style={{ fontSize: 12, fill: 'var(--ink-2)' }}>{unit}</text>
      </svg>
    </figure>
  );
}

function niceTicksLocal(min: number, max: number): number[] {
  const span = max - min || 1;
  const step0 = span / 5;
  const p = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 5, 10].map((m) => m * p).find((s) => s >= step0) ?? p * 10;
  const out: number[] = [];
  for (let t = Math.ceil(min / step) * step; t <= max + 1e-9; t += step) out.push(Math.round(t * 1e6) / 1e6);
  return out;
}
