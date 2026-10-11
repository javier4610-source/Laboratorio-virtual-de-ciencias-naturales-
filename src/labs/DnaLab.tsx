import { useMemo, useState } from 'react';
import {
  AMINO_ACIDS, analyzeMutation, cleanDNA, complement, DNA_PRESETS, GENETIC_CODE, replicate, transcribe, translate, validateDNA,
  type Base, type MutationAnalysis, type MutationType,
} from '../models/dna';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select } from '../components/ui';
import type { LabProps } from './registry';

function Strand({ seq, highlight, label }: { seq: string; highlight?: Set<number>; label: string }) {
  return (
    <div className="dna-strand" aria-label={`${label}: ${seq}`}>
      <span className="sr-only">{label}: {seq}</span>
      <span aria-hidden="true">
        {[...seq].map((b, i) => <span key={i} className={`base ${b}${highlight?.has(i) ? ' mut' : ''}`}>{b}</span>)}
      </span>
    </div>
  );
}

function Codons({ mrna, startIndex, changed, upTo }: { mrna: string; startIndex: number; changed?: Set<number>; upTo?: number }) {
  const t = translate(mrna);
  if (startIndex < 0 || t.startIndex < 0) return <p className="small muted">No hay codón de inicio (AUG): esta secuencia no se traduce.</p>;
  const shown = upTo === undefined ? t.codons : t.codons.slice(0, upTo);
  return (
    <div className="stack-sm">
      <div className="dna-strand" style={{ whiteSpace: 'normal', lineHeight: 2.2 }}>
        {shown.map((c, i) => (
          <span key={i} className={`codon${c.aa === '*' ? ' stop' : ''}${changed?.has(i + 1) ? ' changed' : ''}`} title={AMINO_ACIDS[c.aa]?.name}>
            {c.codon}<sub style={{ marginLeft: 3, fontFamily: 'var(--font-body)' }}>{AMINO_ACIDS[c.aa]?.three ?? '?'}</sub>
          </span>
        ))}
      </div>
    </div>
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
            <div className="grid-2">
              <div className="card stack-sm">
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
              <div className="card stack-sm">
                <h3>Replicación semiconservativa</h3>
                <p className="small muted">Gris: hebra parental (antigua) · Color: hebra nueva</p>
                <div className="stack-sm">
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
          )}
          {tab === 'expresion' && tr && (
            <div className="card stack">
              <h3>Del gen a la proteína</h3>
              <div className="stack-sm">
                <span className="eyebrow">Hebra codificante (5′→3′)</span><Strand seq={seq} label="Hebra codificante" />
                <span className="eyebrow">Hebra molde (3′→5′)</span><Strand seq={complement(seq)} label="Hebra molde" />
                <span className="eyebrow">ARN mensajero (5′→3′)</span><Strand seq={mrna} label="ARN mensajero" />
              </div>
              <div className="stack-sm">
                <span className="eyebrow">Traducción (ribosoma)</span>
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
                <div className="card stack-sm">
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
