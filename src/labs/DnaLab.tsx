import { useMemo, useState } from 'react';
import {
  AMINO_ACIDS, analyzeMutation, cleanDNA, complement, DNA_PRESETS, GENETIC_CODE, replicate, transcribe, translate, validateDNA,
  type Base, type MutationAnalysis, type MutationType,
} from '../models/dna';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import type { LabProps } from './registry';

/* ------------------------------------------------------------------ paleta de bases
 * Los mismos cuatro tonos en todo el laboratorio (A rojo, T/U ámbar, G verde, C azul), igual que
 * los colores de las letras (.base). En los dibujos se usan tonos medios con texto casi negro. */
const BASE_FILL: Record<string, string> = { A: '#e2675c', T: '#e9b03c', U: '#e9b03c', G: '#4fb26c', C: '#5b9ae0' };
const BASE_INK = '#121212';
const OLD_STRAND = '#8c9ba0';
const NEW_STRAND = 'var(--data)';

function Strand({ seq, highlight, label }: { seq: string; highlight?: Set<number>; label: string }) {
  return (
    <div className="dna-strand" aria-label={`${label}: ${seq}`}>
      <span className="sr-only">{label}: {seq}</span>
      <span aria-hidden="true" style={{ display: 'inline-flex', gap: 2 }}>
        {[...seq].map((b, i) => (
          <span key={i} className={`base ${b}${highlight?.has(i) ? ' mut' : ''}`}
            style={{ minWidth: '1.55em', padding: '2px 0', background: highlight?.has(i) ? undefined : 'var(--surface-2)', borderBottom: `3px solid ${BASE_FILL[b] ?? 'var(--line)'}`, fontWeight: 700 }}>{b}</span>
        ))}
      </span>
    </div>
  );
}

function Codons({ mrna, startIndex, changed, upTo }: { mrna: string; startIndex: number; changed?: Set<number>; upTo?: number }) {
  const t = translate(mrna);
  if (startIndex < 0 || t.startIndex < 0) return <p className="small muted">No hay codón de inicio (AUG): esta secuencia no se traduce.</p>;
  const shown = upTo === undefined ? t.codons : t.codons.slice(0, upTo);
  return (
    <div className="stack-sm" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
      <div className="dna-strand" style={{ whiteSpace: 'normal', lineHeight: 1.4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {shown.map((c, i) => (
          <span key={i} className={`codon${c.aa === '*' ? ' stop' : ''}${changed?.has(i + 1) ? ' changed' : ''}`} title={AMINO_ACIDS[c.aa]?.name}
            style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', margin: 0, padding: '4px 6px', border: '1px solid var(--line)' }}>
            <span>{[...c.codon].map((b, k) => <span key={k} className={`base ${b}`} style={{ fontWeight: 700 }}>{b}</span>)}</span>
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', fontWeight: 700, letterSpacing: 0, color: 'var(--ink-2)' }}>{AMINO_ACIDS[c.aa]?.three ?? '?'}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

/** Mitad de un peldaño: de la columna (azúcar-fosfato) al centro, con la letra de la base. */
function HalfRung({ x1, y1, x2, y2, b, letter = true }: { x1: number; y1: number; x2: number; y2: number; b: string; letter?: boolean }) {
  const mx = (x1 * 0.42 + x2 * 0.58), my = (y1 * 0.42 + y2 * 0.58);
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={BASE_FILL[b] ?? '#999'} strokeWidth="10" />
      {letter && <text x={mx} y={my + 3.6} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{b}</text>}
    </g>
  );
}

const MAX_FORK = 30;

/** Horquilla de replicación: la doble hélice parental se abre y cada hebra antigua guía una nueva. */
function ReplicationFork({ seq }: { seq: string }) {
  const g = useMemo(() => {
    const s = seq.slice(0, MAX_FORK);
    const comp = complement(s);
    const n = s.length;
    const L = Math.max(4, Math.round(n * 0.38));
    const sp = 20, x0 = 40, cy = 160, amp = 22;
    const forkX = x0 + L * sp;
    const helix = Array.from({ length: Math.min(L, n) }, (_, i) => {
      const xi = x0 + i * sp + sp / 2;
      const phi = (((xi - forkX) / sp) * 36 * Math.PI) / 180;
      const c = Math.cos(phi);
      return { x: xi, yt: cy - amp * c, yb: cy + amp * c, c, top: s[i], bot: comp[i] };
    });
    const curve = (sign: number) => {
      const pts: string[] = [];
      for (let x = x0 - 6; x <= forkX; x += 3) {
        const phi = (((x - forkX) / sp) * 36 * Math.PI) / 180;
        const y = cy + sign * -amp * Math.cos(phi);
        pts.push(`${x.toFixed(1)} ${y.toFixed(1)}`);
      }
      return `M${pts.join(' L')}`;
    };
    const arm = (up: boolean) => {
      const a = ((up ? -17 : 17) * Math.PI) / 180;
      const d = [Math.cos(a), Math.sin(a)], nrm = [-Math.sin(a), Math.cos(a)];
      const h = 18;
      const oldSign = up ? -1 : 1;
      const rungs = Array.from({ length: n - L }, (_, j) => {
        const i = L + j;
        const t = 22 + j * sp;
        const cx = forkX + d[0] * t, cyy = cy + d[1] * t;
        return {
          cx, cy: cyy,
          ox: cx + nrm[0] * h * oldSign, oy: cyy + nrm[1] * h * oldSign,
          nx: cx - nrm[0] * h * oldSign, ny: cyy - nrm[1] * h * oldSign,
          oldB: up ? s[i] : comp[i], newB: up ? comp[i] : s[i], built: j >= 4,
        };
      });
      const end = 22 + (n - L) * sp;
      const tip = [forkX + d[0] * end, cy + d[1] * end];
      const line = (sign: number, from: number) => `M${forkX + d[0] * from + nrm[0] * h * sign} ${cy + d[1] * from + nrm[1] * h * sign} L${tip[0] + nrm[0] * h * sign} ${tip[1] + nrm[1] * h * sign}`;
      return {
        rungs, tip, nrm, d, oldSign, h,
        oldPath: `M${forkX} ${cy + (up ? -8 : 8)} ` + line(oldSign, 6).replace('M', 'L'),
        newPath: line(-oldSign, 22 + 3.5 * sp),
        poly: [forkX + d[0] * (22 + 3.2 * sp) - nrm[0] * h * 0.55 * oldSign, cy + d[1] * (22 + 3.2 * sp) - nrm[1] * h * 0.55 * oldSign],
      };
    };
    const up = arm(true), down = arm(false);
    const width = Math.max(640, Math.ceil(Math.max(up.tip[0], down.tip[0]) + 50));
    return { n, L, helix, topPath: curve(1), botPath: curve(-1), up, down, forkX, cy, x0, width, truncated: seq.length > MAX_FORK };
  }, [seq]);
  const H = 350;
  const ends = (armG: typeof g.up, upArm: boolean) => {
    const [tx, ty] = armG.tip;
    const o = [tx + armG.nrm[0] * armG.h * armG.oldSign + 12, ty + armG.nrm[1] * armG.h * armG.oldSign + 4];
    const nw = [tx - armG.nrm[0] * armG.h * armG.oldSign + 12, ty - armG.nrm[1] * armG.h * armG.oldSign + 4];
    return (
      <g style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>
        <text x={o[0]} y={o[1]}>{upArm ? '3′' : '5′'}</text>
        <text x={nw[0]} y={nw[1]}>{upArm ? '5′' : '3′'}</text>
      </g>
    );
  };
  return (
    <svg viewBox={`0 0 ${g.width} ${H}`} role="img" aria-labelledby="dna-fork-t dna-fork-d" style={{ minWidth: 600 }}>
      <title id="dna-fork-t">Horquilla de replicación</title>
      <desc id="dna-fork-d">{`La doble hélice de ${g.n} pares de bases${g.truncated ? ' (primeros 30)' : ''} se abre en la horquilla por la helicasa. Cada hebra antigua (gris) sirve de molde para una hebra nueva (naranja), que la ADN polimerasa construye apareando A con T y G con C.`}</desc>
      {/* hélice parental: peldaños detrás y delante según el giro */}
      <path d={g.topPath} stroke={OLD_STRAND} strokeWidth="5" fill="none" strokeLinecap="round" opacity="0.55" />
      {g.helix.map((r, i) => (
        <g key={i} opacity={0.55 + 0.45 * Math.abs(r.c)}>
          <HalfRung x1={r.x} y1={r.yt} x2={r.x} y2={(r.yt + r.yb) / 2} b={r.top} letter={Math.abs(r.c) > 0.55} />
          <HalfRung x1={r.x} y1={r.yb} x2={r.x} y2={(r.yt + r.yb) / 2} b={r.bot} letter={Math.abs(r.c) > 0.55} />
        </g>
      ))}
      <path d={g.botPath} stroke={OLD_STRAND} strokeWidth="5" fill="none" strokeLinecap="round" />
      <text x={g.x0 - 30} y={g.cy - 30} style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>5′</text>
      <text x={g.x0 - 30} y={g.cy + 38} style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>3′</text>
      {/* brazos de la horquilla */}
      {[g.up, g.down].map((armG, k) => (
        <g key={k}>
          <path d={armG.oldPath} stroke={OLD_STRAND} strokeWidth="5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={armG.newPath} stroke={NEW_STRAND} strokeWidth="5" fill="none" strokeLinecap="round" />
          {armG.rungs.map((r, j) => (
            <g key={j}>
              <HalfRung x1={r.ox} y1={r.oy} x2={r.cx} y2={r.cy} b={r.oldB} />
              {r.built ? <HalfRung x1={r.nx} y1={r.ny} x2={r.cx} y2={r.cy} b={r.newB} /> : null}
            </g>
          ))}
          <g transform={`translate(${armG.poly[0]} ${armG.poly[1]})`}>
            <ellipse cx="0" cy="0" rx="20" ry="14" fill="var(--fis)" opacity="0.9" filter="url(#kit-shadow-soft)" />
            <ellipse cx="-5" cy="-5" rx="8" ry="4" fill="#fff" opacity="0.25" />
          </g>
          {ends(armG, k === 0)}
        </g>
      ))}
      {/* helicasa en la horquilla */}
      <g transform={`translate(${g.forkX + 4} ${g.cy})`}>
        <path d="M0 -20 L17 -10 L17 10 L0 20 L-17 10 L-17 -10 Z" fill="var(--qui)" opacity="0.92" filter="url(#kit-shadow-soft)" />
        <path d="M0 -9 L8 -4.5 L8 4.5 L0 9 L-8 4.5 L-8 -4.5 Z" fill="var(--surface)" opacity="0.85" />
      </g>
      {/* rótulos */}
      <g style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>
        <line x1={g.forkX + 2} y1={g.cy + 20} x2={g.forkX - 22} y2={g.cy + 52} stroke="var(--ink-2)" strokeWidth="1" />
        <text x={g.forkX - 22} y={g.cy + 66} textAnchor="middle">Helicasa</text>
        <line x1={g.up.poly[0] + 14} y1={g.up.poly[1] + 10} x2={g.forkX + 170} y2={g.cy - 6} stroke="var(--ink-2)" strokeWidth="1" />
        <line x1={g.down.poly[0] + 14} y1={g.down.poly[1] - 10} x2={g.forkX + 170} y2={g.cy + 6} stroke="var(--ink-2)" strokeWidth="1" />
        <rect x={g.forkX + 170} y={g.cy - 11} width="108" height="22" rx="11" fill="var(--surface)" stroke="var(--line)" />
        <text x={g.forkX + 224} y={g.cy + 4} textAnchor="middle">ADN polimerasa</text>
      </g>
      <g transform={`translate(${g.x0 - 20} ${H - 40})`} style={{ fontSize: 11.5, fill: 'var(--ink-2)' }}>
        <line x1="0" x2="22" y1="0" y2="0" stroke={OLD_STRAND} strokeWidth="5" strokeLinecap="round" />
        <text x="30" y="4">Hebra antigua (molde)</text>
        <line x1="190" x2="212" y1="0" y2="0" stroke={NEW_STRAND} strokeWidth="5" strokeLinecap="round" />
        <text x="220" y="4">Hebra nueva</text>
        {(['A', 'T', 'G', 'C'] as const).map((b, i) => (
          <g key={b} transform={`translate(${i * 100} 15)`}>
            <rect width="18" height="18" rx="4" fill={BASE_FILL[b]} />
            <text x="9" y="13" textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{b}</text>
            <text x="24" y="13" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{{ A: 'adenina', T: 'timina', G: 'guanina', C: 'citosina' }[b]}</text>
          </g>
        ))}
      </g>
    </svg>
  );
}

const AA_FILLS = ['#f6c97a', '#9fd3a8', '#a9c8f0', '#e9a8c4', '#c9b6ec', '#f2a98f'];

/** Ribosoma traduciendo el ARNm: sitios P y A sobre dos codones y la cadena de aminoácidos que sale. */
function RibosomeView({ mrna, upTo }: { mrna: string; upTo?: number }) {
  const t = useMemo(() => translate(mrna), [mrna]);
  const tile = 18, x0 = 28, yM = 216;
  const width = Math.max(640, x0 * 2 + mrna.length * tile + 40);
  if (t.startIndex < 0 || t.codons.length === 0) return null;
  const count = upTo === undefined ? t.codons.length : Math.max(1, upTo);
  const cur = Math.min(t.codons.length, count) - 1; // codón en el sitio P
  const done = upTo === undefined;
  const pIndex = t.codons[cur].index;
  const px = x0 + (pIndex + 1.5) * tile; // centro del codón P
  const chain = t.codons.slice(0, cur + 1).filter((c) => c.aa !== '*');
  const released = done && t.stopFound;
  const beadR = 15, step = 31;
  const ant = (c: string) => [...c].map((b) => ({ A: 'U', U: 'A', G: 'C', C: 'G' }[b] ?? '?')).join('');
  const pCodon = t.codons[cur];
  return (
    <svg viewBox={`0 0 ${width} 286`} role="img" aria-labelledby="dna-rib-t dna-rib-d" style={{ minWidth: 600 }}>
      <title id="dna-rib-t">Ribosoma traduciendo el ARN mensajero</title>
      <desc id="dna-rib-d">{`El ribosoma lee el ARNm de tres en tres bases (codones) desde el AUG de inicio. Hay ${chain.length} aminoácidos unidos${released ? ' y la proteína se liberó al llegar al codón de terminación' : ''}.`}</desc>
      {/* subunidad mayor */}
      <g filter="url(#kit-shadow)">
        <path d={`M${px - 64} ${yM - 4} Q ${px - 82} ${yM - 92} ${px + 8} ${yM - 96} Q ${px + 96} ${yM - 92} ${px + 84} ${yM - 4} Z`} fill="var(--qui)" opacity="0.22" />
        <path d={`M${px - 64} ${yM - 4} Q ${px - 82} ${yM - 92} ${px + 8} ${yM - 96} Q ${px + 96} ${yM - 92} ${px + 84} ${yM - 4} Z`} fill="none" stroke="var(--qui)" strokeWidth="2" />
      </g>
      <text x={px + 70} y={yM - 84} style={{ fontSize: 11, fill: 'var(--ink-2)' }}>subunidad mayor</text>
      {/* sitios P y A */}
      <g style={{ fontSize: 11, fill: 'var(--ink)', fontWeight: 700 }}>
        <text x={px - 38} y={yM - 12} textAnchor="middle">P</text>
        <text x={px + 3 * tile} y={yM - 12} textAnchor="middle">A</text>
      </g>
      {/* ARNt en el sitio P con su anticodón */}
      {!released && (
        <g>
          <path d={`M${px - 20} ${yM - 8} V ${yM - 38} Q ${px} ${yM - 58} ${px + 20} ${yM - 38} V ${yM - 8}`} fill="var(--surface)" stroke="var(--amb)" strokeWidth="2" />
          {[...ant(pCodon.codon)].map((b, i) => (
            <g key={i}>
              <rect x={px - 27 + i * tile} y={yM - 26} width={tile - 2} height="18" rx="3" fill={BASE_FILL[b]} />
              <text x={px - 18 + i * tile} y={yM - 13} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{b}</text>
            </g>
          ))}
          <line x1={px} x2={px} y1={yM - 52} y2={yM - 62} stroke="var(--amb)" strokeWidth="2" />
        </g>
      )}
      {/* ARNm */}
      <line x1={x0 - 10} x2={x0 + mrna.length * tile + 10} y1={yM + 11} y2={yM + 11} stroke="var(--ink-2)" strokeWidth="2" />
      {[...mrna].map((b, i) => {
        const inFrame = i >= t.startIndex && i < t.codons[t.codons.length - 1].index + 3;
        return (
          <g key={i} opacity={inFrame ? 1 : 0.55}>
            <rect x={x0 + i * tile + 1} y={yM} width={tile - 2} height="22" rx="3" fill={BASE_FILL[b]} />
            <text x={x0 + i * tile + tile / 2} y={yM + 15} textAnchor="middle" style={{ fontSize: 11, fontWeight: 700, fill: BASE_INK, fontFamily: 'var(--font-data)' }}>{b}</text>
          </g>
        );
      })}
      {t.codons.map((c, k) => (
        <rect key={k} x={x0 + c.index * tile - 1} y={yM - 3} width={3 * tile + 2} height="28" rx="5" fill="none" stroke={c.aa === '*' ? 'var(--bad)' : 'var(--ink-2)'} strokeWidth={k === cur ? 2 : 1} strokeDasharray={k <= cur ? undefined : '3 3'} opacity={k <= cur ? 0.9 : 0.5} />
      ))}
      <text x={x0 - 10} y={yM + 44} style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>5′</text>
      <text x={x0 + mrna.length * tile + 2} y={yM + 44} style={{ fontSize: 11, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>3′</text>
      {/* subunidad menor */}
      <g filter="url(#kit-shadow-soft)">
        <ellipse cx={px + 10} cy={yM + 40} rx="76" ry="14" fill="var(--qui)" opacity="0.3" />
        <ellipse cx={px + 10} cy={yM + 40} rx="76" ry="14" fill="none" stroke="var(--qui)" strokeWidth="2" />
      </g>
      <text x={px + 92} y={yM + 46} style={{ fontSize: 11, fill: 'var(--ink-2)' }}>subunidad menor</text>
      {/* cadena de aminoácidos (la más reciente junto al ARNt) */}
      {chain.length > 1 && (
        <polyline fill="none" stroke="var(--ink-2)" strokeWidth="2.5" points={chain.map((_, k) => {
          const back = chain.length - 1 - k;
          return `${(released ? px - 40 : px) - back * step},${(released ? 50 : yM - 112 - beadR) - (back % 2) * 14}`;
        }).join(' ')} />
      )}
      {chain.map((c, k) => {
        const back = chain.length - 1 - k;
        const bx = (released ? px - 40 : px) - back * step;
        const by = (released ? 50 : yM - 112 - beadR) - (back % 2) * 14 - (released ? 0 : 0);
        const aa = AMINO_ACIDS[c.aa];
        return (
          <g key={k}>
            <circle cx={bx} cy={by} r={beadR} fill={c.aa === 'M' ? '#9be0d6' : AA_FILLS[c.aa.charCodeAt(0) % AA_FILLS.length]} stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
            <text x={bx} y={by + 4} textAnchor="middle" style={{ fontSize: 10.5, fontWeight: 700, fill: BASE_INK }}>{aa?.three ?? '?'}</text>
          </g>
        );
      })}
      {!released && chain.length > 0 && <line x1={px} y1={yM - 112} x2={px} y2={yM - 62} stroke="var(--ink-2)" strokeWidth="2.5" />}
      {released && <text x={px - 40} y={84} textAnchor="middle" style={{ fontSize: 11.5, fill: 'var(--ink)', fontWeight: 700 }}>Proteína liberada</text>}
      <text x={x0 - 10} y={20} style={{ fontSize: 12, fill: 'var(--ink)', fontWeight: 700 }}>{done ? 'Traducción completa' : `Codón ${cur + 1} de ${t.codons.length}`}</text>
    </svg>
  );
}

export default function DnaLab({ api }: LabProps) {
  const [presetId, setPresetId] = useState('practica');
  const [raw, setRaw] = useState(DNA_PRESETS[0].coding);
  const seq = cleanDNA(raw);
  const error = validateDNA(seq);
  const [tab, setTab] = useState<'replicacion' | 'expresion' | 'mutaciones'>('replicacion');
  const [answer, setAnswer] = useState('');
  const [checked, setChecked] = useState<string | null>(null);
  const [ribosome, setRibosome] = useState(0);
  const [mType, setMType] = useState<MutationType>('sustitucion');
  const [pos, setPos] = useState(6);
  const [base, setBase] = useState<Base>('A');
  const [analysis, setAnalysis] = useState<MutationAnalysis | null>(null);
  const [mError, setMError] = useState<string | null>(null);

  const mrna = useMemo(() => (error ? '' : transcribe(seq)), [seq, error]);
  const tr = useMemo(() => (error ? null : translate(mrna)), [mrna, error]);
  const preset = DNA_PRESETS.find((p) => p.id === presetId);

  const loadPreset = (id: string) => {
    setPresetId(id);
    const p = DNA_PRESETS.find((x) => x.id === id);
    if (p) setRaw(p.coding);
    setAnalysis(null); setAnswer(''); setChecked(null); setRibosome(0);
    if (id === 'hbb') { setMType('sustitucion'); setPos(20); setBase('T'); }
  };

  const checkComplement = () => {
    const a = cleanDNA(answer);
    const expected = complement(seq);
    if (a.length !== expected.length) { setChecked(`Tu hebra tiene ${a.length} bases y debe tener ${expected.length}.`); return; }
    const wrong = [...a].map((b, i) => (b !== expected[i] ? i + 1 : 0)).filter(Boolean);
    setChecked(wrong.length === 0 ? '¡Correcto! Cada A se aparea con T y cada G con C.' : `Hay ${wrong.length} error(es) en las posiciones ${wrong.slice(0, 8).join(', ')}${wrong.length > 8 ? '…' : ''}. Recuerda: A–T y G–C.`);
  };

  const applyMutation = () => {
    try {
      setMError(null);
      setAnalysis(analyzeMutation(seq, { type: mType, position: pos, base: mType === 'delecion' ? undefined : base }));
    } catch (e) {
      setAnalysis(null);
      setMError((e as Error).message);
    }
  };

  const mutatedSeq = analysis ? (() => {
    const i = pos - 1;
    if (mType === 'sustitucion') return seq.slice(0, i) + base + seq.slice(i + 1);
    if (mType === 'insercion') return seq.slice(0, i) + base + seq.slice(i);
    return seq.slice(0, i) + seq.slice(i + 1);
  })() : '';

  const record = () => {
    if (!analysis) return;
    const typeLabel = { sustitucion: 'sustitución', insercion: 'inserción', delecion: 'deleción' }[mType];
    api.addTrial('mutaciones', {
      gen: preset?.name ?? 'Secuencia propia', tipo: typeLabel, posicion: pos,
      cambio: mType === 'sustitucion' ? `${seq[pos - 1]}→${base}` : mType === 'insercion' ? `+${base}` : `−${seq[pos - 1]}`,
      efecto: analysis.effect, aaCambiados: analysis.changedPositions.length,
      identidad: Number(analysis.identityPercent.toFixed(2)), longitud: analysis.mutated.protein.length,
    });
  };

  const rep = error ? null : replicate(seq);

  return (
    <div className="stack">
      <div className="card stack">
        <div className="grid-2">
          <Select label="Secuencia" value={presetId} onChange={loadPreset} options={[...DNA_PRESETS.map((p) => ({ value: p.id, label: p.name })), { value: 'propia', label: 'Escribir mi propia secuencia' }]} />
          <div className="field">
            <label htmlFor="dna-seq">Hebra codificante 5′ → 3′</label>
            <textarea id="dna-seq" value={raw} rows={2} spellCheck={false} style={{ fontFamily: 'var(--font-data)', minHeight: 60 }}
              onChange={(e) => { setRaw(e.target.value); setPresetId('propia'); setAnalysis(null); setChecked(null); setRibosome(0); }}
              aria-invalid={error ? true : undefined} aria-describedby="dna-seq-help" />
            <span id="dna-seq-help" className="hint">{error ?? `${seq.length} pares de bases. Solo A, T, G, C.`}</span>
          </div>
        </div>
        {preset && presetId !== 'propia' && <p className="small muted">{preset.note}</p>}
      </div>
      {error ? <Notice kind="bad">{error}</Notice> : (
        <>
          <Segmented label="Proceso" value={tab} onChange={setTab} options={[{ value: 'replicacion', label: '1. Replicación' }, { value: 'expresion', label: '2. Transcripción y traducción' }, { value: 'mutaciones', label: '3. Mutaciones' }]} />
          {tab === 'replicacion' && rep && (
            <div className="stack" style={{ minWidth: 0 }}>
            <div className="bench"><ReplicationFork seq={seq} /></div>
            <div className="grid-2">
              <div className="card stack-sm" style={{ minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <h3>Construye la hebra complementaria</h3>
                <Strand seq={seq} label="Hebra original 5′→3′" />
                <label htmlFor="dna-comp" className="small">Escribe la hebra complementaria (3′→5′), base por base:</label>
                <input id="dna-comp" type="text" value={answer} onChange={(e) => setAnswer(e.target.value.toUpperCase())} spellCheck={false} style={{ fontFamily: 'var(--font-data)', letterSpacing: '0.08em' }} />
                <div className="btn-row">
                  <button type="button" className="btn primary" onClick={checkComplement}>Comprobar</button>
                  <button type="button" className="btn" onClick={() => { setAnswer(complement(seq)); setChecked('Se completó automáticamente. Revisa el apareamiento A–T y G–C.'); }}>Mostrar solución</button>
                </div>
                {checked && <p className="small" role="status">{checked}</p>}
              </div>
              <div className="card stack-sm" style={{ minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <h3>Replicación semiconservativa</h3>
                <p className="small muted">Gris: hebra parental (antigua) · Color: hebra nueva</p>
                <div className="stack-sm" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <strong className="small">Molécula hija 1</strong>
                  <div style={{ opacity: 0.55 }}><Strand seq={rep.daughter1.old} label="Hebra antigua" /></div>
                  <Strand seq={rep.daughter1.new} label="Hebra nueva" />
                  <strong className="small">Molécula hija 2</strong>
                  <div style={{ opacity: 0.55 }}><Strand seq={rep.daughter2.old} label="Hebra antigua" /></div>
                  <Strand seq={rep.daughter2.new} label="Hebra nueva" />
                </div>
                <p className="small">La ADN polimerasa sintetiza la hebra nueva en sentido 5′→3′; por eso una hebra se copia de forma continua y la otra en fragmentos (de Okazaki). Este modelo muestra el resultado, no el mecanismo enzimático.</p>
              </div>
            </div>
            </div>
          )}
          {tab === 'expresion' && tr && (
            <div className="card stack" style={{ minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
              <h3>Del gen a la proteína</h3>
              <div className="stack-sm" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <span className="eyebrow">Hebra codificante (5′→3′)</span><Strand seq={seq} label="Hebra codificante" />
                <span className="eyebrow">Hebra molde (3′→5′)</span><Strand seq={complement(seq)} label="Hebra molde" />
                <span className="eyebrow">ARN mensajero (5′→3′)</span><Strand seq={mrna} label="ARN mensajero" />
              </div>
              <div className="stack-sm" style={{ gridTemplateColumns: 'minmax(0, 1fr)' }}>
                <span className="eyebrow">Traducción (ribosoma)</span>
                <div className="bench" style={{ padding: 8 }}><RibosomeView mrna={mrna} upTo={ribosome === 0 ? undefined : ribosome} /></div>
                <Codons mrna={mrna} startIndex={tr.startIndex} upTo={ribosome === 0 ? undefined : ribosome} />
                <div className="btn-row">
                  <button type="button" className="btn small" onClick={() => setRibosome((r) => Math.min(tr.codons.length, (r === 0 ? 0 : r) + 1))}>Avanzar un codón</button>
                  <button type="button" className="btn small" onClick={() => setRibosome(0)}>Traducir todo</button>
                </div>
              </div>
              <Readout items={[
                { k: 'Inicio de la traducción', v: tr.startIndex >= 0 ? `base ${tr.startIndex + 1}` : 'sin AUG' },
                { k: 'Proteína (1 letra)', v: tr.protein || '—', data: true },
                { k: 'Aminoácidos', v: tr.protein.length },
                { k: 'Codón de terminación', v: tr.stopFound ? 'sí' : 'no (fragmento)' },
              ]} />
              <details>
                <summary>Tabla del código genético estándar</summary>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Codón</th><th>Aminoácido</th><th>Codón</th><th>Aminoácido</th><th>Codón</th><th>Aminoácido</th><th>Codón</th><th>Aminoácido</th></tr></thead>
                    <tbody>
                      {Array.from({ length: 16 }, (_, r) => (
                        <tr key={r}>
                          {Object.keys(GENETIC_CODE).filter((_, i) => i % 16 === r).map((c) => [
                            <td key={c} className="mono">{c}</td>, <td key={c + 'a'}>{AMINO_ACIDS[GENETIC_CODE[c]].three}</td>,
                          ])}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </details>
            </div>
          )}
          {tab === 'mutaciones' && tr && (
            <div className="lab-layout">
              <div className="stack">
                <div className="card stack-sm" style={{ minWidth: 0, gridTemplateColumns: 'minmax(0, 1fr)' }}>
                  <h3>Proteína original</h3>
                  <Codons mrna={mrna} startIndex={tr.startIndex} />
                  {analysis && (
                    <>
                      <h3>Secuencia y proteína mutadas</h3>
                      <Strand seq={mutatedSeq} highlight={new Set(mType === 'delecion' ? [] : [pos - 1])} label="Hebra codificante mutada" />
                      <Codons mrna={transcribe(mutatedSeq)} startIndex={analysis.mutated.startIndex} changed={new Set(analysis.changedPositions)} />
                    </>
                  )}
                </div>
                {analysis && (
                  <div className="card stack-sm" role="status">
                    <h3>Efecto: mutación {analysis.effect}</h3>
                    <p>{analysis.explanation}</p>
                    <Readout items={[
                      { k: 'Proteína original', v: analysis.original.protein || '—' },
                      { k: 'Proteína mutada', v: analysis.mutated.protein || '—', data: true },
                      { k: 'Aminoácidos distintos', v: analysis.changedPositions.length },
                      { k: 'Identidad', v: `${fmt(analysis.identityPercent, 1)} %` },
                    ]} />
                  </div>
                )}
              </div>
              <div className="controls">
                <div className="card stack">
                  <h3>Mutagénesis</h3>
                  <Segmented label="Tipo" value={mType} onChange={(v) => { setMType(v); setAnalysis(null); }} options={[{ value: 'sustitucion', label: 'Sustitución' }, { value: 'insercion', label: 'Inserción' }, { value: 'delecion', label: 'Deleción' }]} />
                  <div className="field">
                    <label htmlFor="mut-pos">Posición (base 1 a {seq.length})</label>
                    <input id="mut-pos" type="number" min={1} max={seq.length} value={pos} onChange={(e) => { setPos(Math.max(1, Math.min(seq.length, Number(e.target.value) || 1))); setAnalysis(null); }} />
                    <span className="hint">Base actual en esa posición: <strong className="mono">{seq[pos - 1] ?? '—'}</strong> (codón {Math.floor((pos - 1) / 3) + 1})</span>
                  </div>
                  {mType !== 'delecion' && (
                    <Segmented label="Base nueva" value={base} onChange={(v) => { setBase(v); setAnalysis(null); }} options={(['A', 'T', 'G', 'C'] as Base[]).map((b) => ({ value: b, label: b }))} />
                  )}
                  <button type="button" className="btn primary" onClick={applyMutation}>Aplicar mutación</button>
                  {mError && <Notice kind="bad">{mError}</Notice>}
                  <RecordButton onRecord={record} disabled={!analysis} />
                </div>
                <Notice>Las posiciones se cuentan sobre la hebra codificante, empezando en 1.</Notice>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
