import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  applyFePerturbation, compareText, DIRECTION_TEXT, FE_INITIAL, FE_LIMITS, FE_PERTURBATION_TEXT, FE_SETUP, feResponse,
  NO2_INITIAL, NO2_LIMITS, no2Intensity, no2Q, no2Response, relaxProgress, solveFeSCN, solveNO2,
  type FePerturbation, type FeState, type No2State,
} from '../models/equilibrium';
import { seededRandom } from '../models/math';
import { fmt, fmtSig } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound } from '../lib/sound';
import { Notice, Readout, RecordButton, Segmented, Slider, Warnings } from '../components/ui';
import type { LabProps } from './registry';
import { Beaker, BenchTop, GasSyringe, Lcd, TestTube, Thermometer } from './kit';

const RELAX_S = 3;
const SYS_A = 'Fe³⁺ + SCN⁻ ⇌ FeSCN²⁺';
const SYS_B = '2 NO₂ ⇌ N₂O₄';

/* ------------------------------------------------------------------ utilidades */

/** Texto de Q: ∞ si falta un reactivo, — si no hay reacción posible. */
function qText(q: number): string {
  if (Number.isNaN(q)) return '—';
  if (!Number.isFinite(q)) return '∞';
  return fmtSig(q, 3);
}

/** Q para guardar en la tabla (null si es infinito o indefinido). */
const qValue = (q: number) => (Number.isFinite(q) ? Number(q.toPrecision(4)) : null);

/**
 * Animación de la relajación hacia el nuevo equilibrio. `key` cambia en cada perturbación;
 * el progreso (0 → 1) sigue una cinética de primer orden aparente, solo ilustrativa.
 */
function useRelaxation() {
  const [key, setKey] = useState(0);
  const [p, setP] = useState(1);
  const raf = useRef(0);
  useEffect(() => {
    if (key === 0 || prefersReducedMotion()) return;
    const start = performance.now();
    const tick = (now: number) => {
      const el = Math.max(0, (now - start) / 1000);
      setP(el >= RELAX_S ? 1 : relaxProgress(el, 0.6, RELAX_S));
      if (el < RELAX_S) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [key]);
  const trigger = () => { setP(prefersReducedMotion() ? 1 : 0); setKey((k) => k + 1); };
  const reset = () => { cancelAnimationFrame(raf.current); setP(1); };
  return { p, trigger, reset };
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Color del tubo según la absorbancia del FeSCN²⁺ (amarillo pálido → naranja → rojo sangre). */
const RED_STOPS: [number, [number, number, number]][] = [
  [0, [246, 238, 200]], [0.15, [244, 196, 120]], [0.45, [226, 96, 38]], [1.2, [176, 22, 18]], [2.5, [110, 6, 8]], [4, [70, 4, 6]],
];
function bloodColor(absorbance: number): string {
  const a = Math.max(0, absorbance);
  for (let i = 1; i < RED_STOPS.length; i++) {
    const [x1, c1] = RED_STOPS[i];
    const [x0, c0] = RED_STOPS[i - 1];
    if (a <= x1 || i === RED_STOPS.length - 1) {
      const t = Math.min(1, (a - x0) / (x1 - x0));
      return `rgb(${Math.round(lerp(c0[0], c1[0], t))}, ${Math.round(lerp(c0[1], c1[1], t))}, ${Math.round(lerp(c0[2], c1[2], t))})`;
    }
  }
  return 'rgb(70, 4, 6)';
}

/** Marrón del NO₂: la opacidad sigue a la intensidad relativa (inicial = 100). */
const brown = (intensity: number) => `rgba(150, 72, 22, ${Math.min(0.9, 0.08 + 0.28 * (intensity / 100)).toFixed(3)})`;

/** Escala logarítmica de Q frente a K. */
function QKGauge({ x, y, w, q, k, minExp, maxExp }: { x: number; y: number; w: number; q: number; k: number; minExp: number; maxExp: number }) {
  const pos = (v: number) => x + ((Math.log10(v) - minExp) / (maxExp - minExp)) * w;
  const clampX = (v: number) => (v <= 0 ? x : !Number.isFinite(v) ? x + w : Math.max(x, Math.min(x + w, pos(v))));
  const kx = clampX(k);
  const qx = Number.isNaN(q) ? null : clampX(q);
  const exps = Array.from({ length: maxExp - minExp + 1 }, (_, i) => minExp + i);
  return (
    <g aria-hidden="true">
      <rect x={x - 10} y={y - 16} width={w + 20} height={62} rx={8} fill="var(--surface)" stroke="var(--line)" />
      <text x={x} y={y - 3} style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>Q frente a K (escala logarítmica)</text>
      <rect x={x} y={y + 8} width={w} height={6} rx={3} fill="var(--surface-2)" stroke="var(--line)" />
      {exps.map((e) => (
        <g key={e}>
          <line x1={pos(10 ** e)} x2={pos(10 ** e)} y1={y + 6} y2={y + 17} stroke="var(--ink-2)" strokeWidth="0.8" />
          <text x={pos(10 ** e)} y={y + 28} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{fmt(10 ** e, e < 0 ? -e : 0)}</text>
        </g>
      ))}
      <line x1={kx} x2={kx} y1={y + 2} y2={y + 20} stroke="var(--qui)" strokeWidth="2.5" />
      <text x={kx} y={y + 40} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--qui)', fontWeight: 700 }}>K</text>
      {qx !== null && (
        <g>
          <path d={`M${qx} ${y + 6} L${qx - 6} ${y - 4} L${qx + 6} ${y - 4} Z`} fill="var(--data)" />
          <text x={qx + 8} y={y + 1} style={{ fontSize: 10, fill: 'var(--data)', fontWeight: 700 }}>Q{Number.isFinite(q) ? '' : ' = ∞'}</text>
        </g>
      )}
    </g>
  );
}

/* ------------------------------------------------------------------ piezas del sistema A */

/** Frasco gotero de vidrio con pipeta de bulbo de caucho. */
function DropperBottle({ x, label, liquid, amber = false }: { x: number; label: string; liquid: string; amber?: boolean }) {
  const base = 344, w = 30, top = base - 54;
  return (
    <g aria-hidden="true">
      <g filter="url(#kit-shadow-soft)">
        <path d={`M${x + 6} ${top + 10} Q${x} ${top + 14} ${x} ${top + 22} L${x} ${base - 3} Q${x} ${base} ${x + 3} ${base} L${x + w - 3} ${base} Q${x + w} ${base} ${x + w} ${base - 3} L${x + w} ${top + 22} Q${x + w} ${top + 14} ${x + w - 6} ${top + 10} Z`} fill={amber ? '#9a5b22' : 'url(#kit-glass-fill)'} opacity={amber ? 0.85 : 1} stroke="var(--glass-edge, #8fa9b3)" />
      </g>
      <rect x={x + 2} y={top + 26} width={w - 4} height={base - top - 28} rx={2} fill={liquid} opacity={amber ? 0.5 : 0.75} />
      <rect x={x + 9} y={top + 2} width={w - 18} height={10} rx={1.5} fill="#2b3335" />
      <path d={`M${x + 10} ${top + 2} Q${x + 10} ${top - 16} ${x + w / 2} ${top - 18} Q${x + w - 10} ${top - 16} ${x + w - 10} ${top + 2} Z`} fill="#c0392b" />
      <rect x={x + 4} y={top + 30} width={w - 8} height={14} rx={1.5} fill="#fff" stroke="#c8d2d4" strokeWidth="0.6" />
      <text x={x + w / 2} y={top + 40} textAnchor="middle" style={{ fontSize: 7.5, fill: '#24454a', fontWeight: 700 }}>{label}</text>
      <rect x={x + 4} y={top + 24} width={2.5} height={base - top - 30} rx={1} fill="#fff" opacity="0.45" />
    </g>
  );
}

/** Pipeta gotero suspendida sobre el tubo, con una gota que cae. */
function Dropper({ x, y, liquid, dropY }: { x: number; y: number; liquid: string; dropY: number | null }) {
  return (
    <g aria-hidden="true">
      <path d={`M${x - 7} ${y} Q${x - 9} ${y - 22} ${x} ${y - 24} Q${x + 9} ${y - 22} ${x + 7} ${y} Z`} fill="#c0392b" />
      <path d={`M${x - 4} ${y} L${x + 4} ${y} L${x + 1.5} ${y + 46} L${x - 1.5} ${y + 46} Z`} fill="url(#kit-glass-fill)" stroke="var(--glass-edge, #8fa9b3)" />
      <rect x={x - 2.5} y={y + 26} width={5} height={18} fill={liquid} opacity="0.8" />
      {dropY !== null && <path d={`M${x} ${dropY - 5} Q${x + 3.5} ${dropY + 1} ${x} ${dropY + 3} Q${x - 3.5} ${dropY + 1} ${x} ${dropY - 5} Z`} fill={liquid} stroke={liquid === '#eef3f5' ? '#9fb1b8' : 'none'} />}
    </g>
  );
}

/** Colorímetro de mesa (450 nm) con cubeta, pantalla LCD y botón de lectura. */
function Colorimeter({ x, y, reading, cuvette }: { x: number; y: number; reading: string; cuvette: string }) {
  const w = 132, h = 124;
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <path d={`M${x + 8} ${y + 20} L${x + w - 8} ${y + 20} Q${x + w} ${y + 20} ${x + w} ${y + 28} L${x + w + 4} ${y + h} L${x - 4} ${y + h} L${x} ${y + 28} Q${x} ${y + 20} ${x + 8} ${y + 20} Z`} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      {/* compartimento de la cubeta */}
      <rect x={x + w - 44} y={y + 8} width={30} height={20} rx={3} fill="url(#kit-body-dark)" />
      <rect x={x + w - 37} y={y - 8} width={16} height={30} rx={1.5} fill={cuvette} opacity="0.9" stroke="#9fb1b8" />
      <rect x={x + w - 37} y={y - 8} width={16} height={30} rx={1.5} fill="url(#kit-glass)" />
      <rect x={x + 10} y={y + 34} width={w - 20} height={44} rx={6} fill="url(#kit-body-dark)" />
      <Lcd x={x + 16} y={y + 40} w={w - 32} h={32} text={reading} />
      <rect x={x + 16} y={y + 88} width={36} height={14} rx={3} fill="url(#kit-body-dark)" />
      <text x={x + 34} y={y + 114} textAnchor="middle" style={{ fontSize: 7, fill: '#55605f', fontWeight: 700 }}>LEER</text>
      <circle cx={x + w - 22} cy={y + 95} r={3} fill="#3ddc84" stroke="#2b3335" strokeWidth="0.5" />
      <text x={x + 14} y={y + 16} style={{ fontSize: 8, fill: 'var(--ink-2)', fontWeight: 700 }}>λ = 450 nm</text>
    </g>
  );
}

/** Gradilla de plástico con tubos (se dibujan entre la placa trasera y la delantera). */
function Rack({ x, w, children }: { x: number; w: number; children: ReactNode }) {
  return (
    <g>
      <g filter="url(#kit-shadow-soft)">
        <rect x={x} y={334} width={w} height={10} rx={2} fill="#e9edf0" stroke="#aab4b8" />
        <rect x={x + 4} y={240} width={6} height={96} fill="#d5dcde" stroke="#aab4b8" strokeWidth="0.6" />
        <rect x={x + w - 10} y={240} width={6} height={96} fill="#d5dcde" stroke="#aab4b8" strokeWidth="0.6" />
      </g>
      {children}
      <rect x={x} y={240} width={w} height={11} rx={2} fill="#f4f6f7" stroke="#aab4b8" opacity="0.94" />
      <rect x={x} y={296} width={w} height={8} rx={2} fill="#f4f6f7" stroke="#aab4b8" opacity="0.9" />
    </g>
  );
}

/* ------------------------------------------------------------------ sistema A */

function FePart({ api }: LabProps) {
  const [st, setSt] = useState<FeState>(FE_INITIAL);
  const [prev, setPrev] = useState<FeState | null>(null);
  const [last, setLast] = useState<FePerturbation['kind'] | null>(null);
  const [measured, setMeasured] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { p, trigger, reset } = useRelaxation();

  const eq = useMemo(() => solveFeSCN(st), [st]);
  const resp = useMemo(() => (prev ? feResponse(prev, st) : null), [prev, st]);
  const initialEq = useMemo(() => solveFeSCN(FE_INITIAL), []);

  const perturb = (pt: FePerturbation) => {
    try {
      const next = applyFePerturbation(st, pt);
      setPrev(st); setSt(next); setLast(pt.kind); setMeasured(false); setError(null);
      trigger();
      // Gota del gotero (o chorro de agua) y agitación suave del tubo.
      playSound(pt.kind === 'agua' ? 'pour' : 'drop', { duration: 0.5, intensity: 0.5 });
      playSound('swirl', { intensity: 0.4, delay: 0.25 });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      playSound('error');
    }
  };
  const newTube = () => { reset(); setSt(FE_INITIAL); setPrev(null); setLast(null); setMeasured(false); setError(null); };

  // Concentraciones mostradas durante la relajación (solo ilustrativa).
  const t = resp ? p : 1;
  const shown = resp
    ? { fe: lerp(resp.immediate.fe, resp.after.fe, t), scn: lerp(resp.immediate.scn, resp.after.scn, t), complex: lerp(resp.immediate.complex, resp.after.complex, t) }
    : { fe: eq.fe, scn: eq.scn, complex: eq.complex };
  const qNow = shown.fe * shown.scn > 0 ? shown.complex / (shown.fe * shown.scn) : shown.complex > 0 ? Infinity : NaN;
  const settled = t >= 1;
  const tubeColor = bloodColor(4700 * shown.complex);
  const qImm = resp ? resp.qImmediate : eq.Q;
  const direction = resp ? resp.direction : 'ninguno';
  const perturbLabel = last ? FE_PERTURBATION_TEXT[last] : 'Estado inicial';
  const dropKind = last === 'fe' || last === 'scn' || last === 'ag' ? last : null;
  const dropLiquid = dropKind === 'fe' ? '#e9b949' : '#eef3f5';
  const dropY = dropKind && p < 0.35 ? lerp(112, 232, p / 0.35) : null;
  const tubeFill = eq.volumeML / 25;
  const warmth = st.temperatura - 25;
  const bath = `rgba(${warmth > 0 ? 230 : 80}, ${warmth > 0 ? 120 : 150}, ${warmth > 0 ? 80 : 230}, ${Math.min(0.32, Math.abs(warmth) / 160 + 0.06).toFixed(3)})`;
  const lcd = measured ? (eq.absorbanceReading === null ? 'SAT' : fmt(eq.absorbanceReading, 3)) : '-.---';

  const record = () => api.addTrial('estados', {
    sistema: SYS_A, perturbacion: perturbLabel, temperatura: st.temperatura,
    gotasFe: st.gotasFe, gotasSCN: st.gotasSCN, gotasAg: st.gotasAg, agua: st.aguaML, volumen: null,
    Q: qValue(qImm), K: Number(eq.K.toFixed(2)), absorbancia: eq.absorbanceReading, intensidad: null, fraccionNO2: null,
    sentido: resp ? DIRECTION_TEXT[direction] : 'en equilibrio',
  });

  const atMax = (n: number) => n >= FE_LIMITS.drops[1];
  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 380" role="img" aria-labelledby="eqb-a-t eqb-a-d">
            <title id="eqb-a-t">Tubo de tiocianato de hierro en un baño de agua, goteros y colorímetro</title>
            <desc id="eqb-a-d">{`Última perturbación: ${perturbLabel}. Tubo de ${fmt(eq.volumeML, 2)} mL a ${fmt(st.temperatura, 0)} °C. ` +
              (resp ? `Justo después de perturbar, Q = ${qText(resp.qImmediate)} y K = ${fmtSig(resp.K, 3)}: ${compareText(resp.qImmediate, resp.K)} ` : '') +
              (eq.agTotal > 0 ? 'Hay un precipitado blanco de AgSCN en el fondo. ' : '') +
              (measured ? `El colorímetro marca ${eq.absorbanceReading === null ? 'fuera de rango' : fmt(eq.absorbanceReading, 3)}.` : 'Absorbancia aún no medida.')}</desc>
            <BenchTop y={344} width={640} />
            <QKGauge x={378} y={34} w={240} q={qNow} k={eq.K} minExp={0} maxExp={3} />
            {/* gradilla con el tubo de referencia y un blanco de agua */}
            <Rack x={18} w={132}>
              <TestTube x={42} y={196} w={22} h={140} fill={10 / 25 + 0.02} liquid={bloodColor(initialEq.absorbance)} liquidOpacity={0.9} />
              <TestTube x={98} y={196} w={22} h={140} fill={0.4} liquid="#d8ecf4" liquidOpacity={0.45} />
            </Rack>
            <text x={53} y={186} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>inicial</text>
            <text x={109} y={186} textAnchor="middle" style={{ fontSize: 9, fill: 'var(--ink-2)' }}>blanco</text>
            <text x={84} y={366} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>gradilla de referencia</text>
            {/* baño de agua con el tubo de trabajo y el termómetro */}
            <Beaker x={172} y={176} w={176} h={168} fill={0.72} liquid="#9cc9e6" liquidOpacity={0.35}>
              <rect x={175} y={230} width={170} height={108} fill={bath} />
              <Thermometer x={196} y={110} h={220} min={0} max={70} value={st.temperatura} />
              <TestTube x={250} y={112} w={28} h={208} fill={tubeFill} liquid={tubeColor} liquidOpacity={0.9}>
                {eq.agTotal > 0 && (
                  <g>
                    <ellipse cx={264} cy={312} rx={11} ry={Math.min(6, 2 + eq.precipitated * 400)} fill="#f7f7f2" stroke="#c9cfd0" strokeWidth="0.6" />
                    {[0, 1, 2, 3, 4, 5].map((i) => <circle key={i} cx={256 + ((i * 7) % 16)} cy={300 - (i % 3) * 7} r={1.1} fill="#fbfbf6" opacity="0.8" />)}
                  </g>
                )}
              </TestTube>
            </Beaker>
            {dropKind && p < 1 && <Dropper x={264} y={62} liquid={dropLiquid} dropY={dropY} />}
            <text x={260} y={366} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>baño a {fmt(st.temperatura, 0)} °C · tubo de {fmt(eq.volumeML, 2)} mL</text>
            {/* goteros con los reactivos */}
            <DropperBottle x={366} label="Fe³⁺" liquid="#e9b949" />
            <DropperBottle x={404} label="SCN⁻" liquid="#eef3f5" />
            <DropperBottle x={442} label="Ag⁺" liquid="#eef3f5" amber />
            <text x={421} y={366} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>goteros (0,05 mL/gota)</text>
            <Colorimeter x={492} y={220} reading={lcd} cuvette={tubeColor} />
            <text x={558} y={366} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>colorímetro · cubeta 1 cm</text>
          </svg>
        </div>
        <Notice kind={direction === 'ninguno' ? 'info' : 'warn'}>
          <strong>{resp ? `Justo después de «${lowerFirst(perturbLabel)}»: ` : 'Estado inicial: '}</strong>
          Q = {qText(qImm)} · K = {fmtSig(eq.K, 3)}. {resp ? compareText(resp.qImmediate, resp.K) : 'Q = K: el sistema está en equilibrio.'}
          {resp && !settled ? ' El sistema está respondiendo…' : ''}
        </Notice>
        <Readout items={[
          { k: 'Perturbación', v: perturbLabel },
          { k: 'Q justo después', v: qText(qImm) },
          { k: `K a ${fmt(st.temperatura, 0)} °C`, v: `${fmtSig(eq.K, 3)} L/mol` },
          { k: 'Sentido del desplazamiento', v: resp ? DIRECTION_TEXT[direction] : 'en equilibrio' },
          { k: 'Absorbancia (450 nm)', v: measured ? (eq.absorbanceReading === null ? 'fuera de rango (> 3)' : fmt(eq.absorbanceReading, 3)) : 'mide', data: true },
          { k: 'Volumen del tubo', v: `${fmt(eq.volumeML, 2)} mL` },
        ]} />
        <Warnings list={eq.warnings} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Perturbaciones (una a la vez)</h3>
          <div className="btn-row">
            <button type="button" className="btn small" disabled={atMax(st.gotasFe)} onClick={() => perturb({ kind: 'fe' })}>Agregar 1 gota de Fe³⁺</button>
            <button type="button" className="btn small" disabled={atMax(st.gotasSCN)} onClick={() => perturb({ kind: 'scn' })}>Agregar 1 gota de SCN⁻</button>
            <button type="button" className="btn small" disabled={atMax(st.gotasAg)} onClick={() => perturb({ kind: 'ag' })}>Agregar 1 gota de Ag⁺</button>
            <button type="button" className="btn small" disabled={st.aguaML >= FE_LIMITS.waterML[1]} onClick={() => perturb({ kind: 'agua' })}>Agregar {fmt(FE_SETUP.waterStepML, 0)} mL de agua</button>
          </div>
          <p className="small muted">Gotas: Fe³⁺ {st.gotasFe}, SCN⁻ {st.gotasSCN}, Ag⁺ {st.gotasAg} (máximo 10 de cada una) · agua {fmt(st.aguaML, 0)} mL.</p>
          <Slider label="Temperatura del baño del tubo" value={st.temperatura} min={FE_LIMITS.temperature[0]} max={FE_LIMITS.temperature[1]} step={5} unit="°C" decimals={0}
            onChange={(v) => { if (v !== st.temperatura) perturb({ kind: 'temperatura', value: v }); }} />
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={!settled} onClick={() => setMeasured(true)}>Medir absorbancia</button>
            <button type="button" className="btn" onClick={() => { newTube(); playSound('glassClink'); }}>Preparar tubo nuevo</button>
          </div>
          {!settled && <p className="small muted" aria-live="polite">Espera a que el sistema alcance el nuevo equilibrio para medir.</p>}
          {error && <p className="small" role="alert" style={{ color: 'var(--bad)' }}>{error}</p>}
          <RecordButton onRecord={record} disabled={!measured} />
        </div>
        <Notice>Kc ≈ 1,1 × 10² a 25 °C y ΔH ≈ −6 kJ/mol son valores de referencia aproximados. El equilibrio se resuelve exactamente con la ecuación cuadrática; la animación de la relajación es solo ilustrativa.</Notice>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ sistema B */

function No2Part({ api }: LabProps) {
  const [st, setSt] = useState<No2State>(NO2_INITIAL);
  const [prev, setPrev] = useState<No2State | null>(null);
  const [last, setLast] = useState<string>('Estado inicial');
  const [measured, setMeasured] = useState(false);
  const { p, trigger, reset } = useRelaxation();
  const eq = useMemo(() => solveNO2(st), [st]);
  const resp = useMemo(() => (prev ? no2Response(prev, st) : null), [prev, st]);

  const change = (next: No2State, label: string) => {
    if (next.volumen === st.volumen && next.temperatura === st.temperatura) return;
    setPrev(st); setSt(next); setLast(label); setMeasured(false); trigger();
    if (next.volumen !== st.volumen) playSound('squeak', { intensity: next.volumen < st.volumen ? 0.9 : 0.4 });
  };
  const restore = () => { reset(); setSt(NO2_INITIAL); setPrev(null); setLast('Estado inicial'); setMeasured(false); };

  const t = resp ? p : 1;
  const settled = t >= 1;
  const nNO2 = resp ? lerp(resp.immediate.nNO2, resp.after.nNO2, t) : eq.nNO2;
  const nN2O4 = resp ? lerp(resp.immediate.nN2O4, resp.after.nN2O4, t) : eq.nN2O4;
  const qNow = no2Q(nNO2, nN2O4, st);
  const intensityNow = no2Intensity(nNO2 / st.volumen);
  const qImm = resp ? resp.qImmediate : eq.Q;
  const direction = resp ? resp.direction : 'ninguno';

  // Modelo de partículas: 1 punto por cada 0,05 mmol (posiciones fijas con semilla).
  const seeds = useMemo(() => { const r = seededRandom(11); return Array.from({ length: 80 }, () => ({ x: r(), y: r(), a: r() * Math.PI })); }, []);
  const SX = 150, SY = 176, SL = 360, SH = 46;
  const gasLen = (st.volumen / 100) * SL;
  const dots = Math.round(nNO2 / 0.05), pairs = Math.round(nN2O4 / 0.05);
  const warmth = st.temperatura - 25;
  const bath = `rgba(${warmth > 0 ? 230 : 80}, ${warmth > 0 ? 120 : 150}, ${warmth > 0 ? 80 : 230}, ${Math.min(0.32, Math.abs(warmth) / 200 + 0.06).toFixed(3)})`;
  const swatches = [50, 100, 150, 200, 300];

  const record = () => api.addTrial('estados', {
    sistema: SYS_B, perturbacion: last, temperatura: st.temperatura,
    gotasFe: null, gotasSCN: null, gotasAg: null, agua: null, volumen: st.volumen,
    Q: qValue(qImm), K: Number(eq.K.toPrecision(4)), absorbancia: null, intensidad: eq.intensityReading,
    fraccionNO2: Number(eq.fractionNO2.toFixed(3)), sentido: resp ? DIRECTION_TEXT[direction] : 'en equilibrio',
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <svg viewBox="0 0 640 340" role="img" aria-labelledby="eqb-b-t eqb-b-d">
            <title id="eqb-b-t">Jeringa sellada con NO₂ y N₂O₄ en un baño de agua y comparador de color</title>
            <desc id="eqb-b-d">{`Última perturbación: ${last}. Jeringa en ${fmt(st.volumen, 0)} mL a ${fmt(st.temperatura, 0)} °C. ` +
              (resp ? `Justo después de perturbar, Q = ${qText(resp.qImmediate)} y K = ${fmtSig(resp.K, 3)}: ${compareText(resp.qImmediate, resp.K)} ` : '') +
              (measured ? `Intensidad del color: ${fmt(eq.intensityReading, 0)} (inicial = 100).` : 'Color aún no medido.')}</desc>
            <BenchTop y={316} width={640} />
            <QKGauge x={378} y={32} w={240} q={qNow} k={eq.K} minExp={-2} maxExp={3} />
            {/* comparador de color con patrones */}
            <g>
              <rect x={14} y={16} width={330} height={66} rx={8} fill="var(--surface)" stroke="var(--line)" />
              <text x={24} y={32} style={{ fontSize: 10, fill: 'var(--ink-2)', fontWeight: 700 }}>Comparador de color (inicial = 100)</text>
              {swatches.map((s, i) => (
                <g key={s}>
                  <rect x={24 + i * 40} y={40} width={32} height={22} rx={3} fill="#ffffff" stroke="var(--line)" />
                  <rect x={24 + i * 40} y={40} width={32} height={22} rx={3} fill={brown(s)} />
                  <text x={40 + i * 40} y={74} textAnchor="middle" style={{ fontSize: 8, fill: 'var(--ink-2)', fontFamily: 'var(--font-data)' }}>{s}</text>
                </g>
              ))}
              <Lcd x={232} y={38} w={102} h={32} text={measured ? fmt(eq.intensityReading, 0) : '---'} />
            </g>
            {/* baño de agua de vidrio */}
            <rect x={104} y={118} width={512} height={198} rx={4} fill="url(#kit-glass-fill)" filter="url(#kit-shadow-soft)" />
            <rect x={107} y={136} width={506} height={177} fill="rgba(110,170,220,0.2)" />
            <rect x={107} y={136} width={506} height={177} fill={bath} />
            <rect x={107} y={136} width={506} height={3} fill="#fff" opacity="0.35" />
            {[230, 440].map((cx) => (
              <g key={cx}>
                <rect x={cx - 6} y={226} width={12} height={88} fill="url(#kit-body-dark)" />
                <path d={`M${cx - 13} 220 L${cx + 13} 220 L${cx + 9} 229 L${cx - 9} 229 Z`} fill="url(#kit-body-dark)" />
              </g>
            ))}
            <GasSyringe x={SX} y={SY} length={SL} height={SH} fraction={st.volumen / 100} capacity={100} major={10} gas={brown(intensityNow)}>
              {seeds.slice(0, Math.min(80, dots)).map((s, i) => (
                <circle key={`n${i}`} cx={SX + 5 + s.x * Math.max(4, gasLen - 12)} cy={SY + 6 + s.y * (SH - 12)} r={2.6} fill="#7a3510" />
              ))}
              {seeds.slice(0, Math.min(80, pairs)).map((s, i) => {
                const cx = SX + 6 + ((s.y * 0.61 + s.x * 0.37) % 1) * Math.max(4, gasLen - 14), cy = SY + 7 + ((s.x * 0.73 + 0.2) % 1) * (SH - 14);
                return (
                  <g key={`d${i}`}>
                    <circle cx={cx - 2.2 * Math.cos(s.a)} cy={cy - 2.2 * Math.sin(s.a)} r={2.2} fill="#f2e6dc" stroke="#b08a70" strokeWidth="0.5" />
                    <circle cx={cx + 2.2 * Math.cos(s.a)} cy={cy + 2.2 * Math.sin(s.a)} r={2.2} fill="#f2e6dc" stroke="#b08a70" strokeWidth="0.5" />
                  </g>
                );
              })}
            </GasSyringe>
            <rect x={SX - 22} y={SY + SH / 2 - 7} width={10} height={14} rx={2} fill="#2b3335" />
            <Thermometer x={590} y={96} h={196} min={0} max={80} value={st.temperatura} />
            <rect x={104} y={118} width={512} height={198} rx={4} fill="url(#kit-glass)" stroke="var(--glass-edge, #8fa9b3)" strokeWidth="1.6" />
            <g aria-hidden="true" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>
              <circle cx={130} cy={102} r={2.6} fill="#7a3510" /><text x={136} y={105}>NO₂ (marrón)</text>
              <circle cx={218} cy={102} r={2.2} fill="#f2e6dc" stroke="#b08a70" strokeWidth="0.5" /><circle cx={222.4} cy={102} r={2.2} fill="#f2e6dc" stroke="#b08a70" strokeWidth="0.5" /><text x={229} y={105}>N₂O₄ (incoloro)</text>
            </g>
            <text x={360} y={334} textAnchor="middle" style={{ fontSize: 10, fill: 'var(--ink-2)' }}>jeringa sellada en baño a {fmt(st.temperatura, 0)} °C · cada punto ≈ 0,05 mmol</text>
          </svg>
        </div>
        <Notice kind={direction === 'ninguno' ? 'info' : 'warn'}>
          <strong>{resp ? `Justo después de «${lowerFirst(last)}»: ` : 'Estado inicial: '}</strong>
          Q = {qText(qImm)} bar⁻¹ · K = {fmtSig(eq.K, 3)} bar⁻¹. {resp ? compareText(resp.qImmediate, resp.K) : 'Q = K: el sistema está en equilibrio.'}
          {resp && !settled ? ' El sistema está respondiendo…' : ''}
        </Notice>
        <Readout items={[
          { k: 'Perturbación', v: last },
          { k: 'Q justo después', v: `${qText(qImm)} bar⁻¹` },
          { k: `Kp a ${fmt(st.temperatura, 0)} °C`, v: `${fmtSig(eq.K, 3)} bar⁻¹` },
          { k: 'Sentido del desplazamiento', v: resp ? DIRECTION_TEXT[direction] : 'en equilibrio' },
          { k: 'Intensidad del color', v: measured ? fmt(eq.intensityReading, 0) : 'mide', data: true },
          { k: 'Fracción de NO₂', v: measured ? fmt(eq.fractionNO2, 3) : 'mide', data: true },
          { k: 'Presión total', v: `${fmt(eq.pTotal, 2)} bar` },
        ]} />
        <Warnings list={eq.warnings} />
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Jeringa sellada</h3>
          <Slider label="Volumen de la jeringa" value={st.volumen} min={NO2_LIMITS.volume[0]} max={NO2_LIMITS.volume[1]} step={10} unit="mL" decimals={0}
            onChange={(v) => change({ ...st, volumen: v }, v < st.volumen ? 'Comprimir' : 'Expandir')} />
          <Slider label="Temperatura del baño de la jeringa" value={st.temperatura} min={NO2_LIMITS.temperature[0]} max={NO2_LIMITS.temperature[1]} step={5} unit="°C" decimals={0}
            onChange={(v) => change({ ...st, temperatura: v }, v > st.temperatura ? 'Calentar' : 'Enfriar')} />
          <div className="btn-row">
            <button type="button" className="btn primary" disabled={!settled} onClick={() => setMeasured(true)}>Medir intensidad del color</button>
            <button type="button" className="btn" onClick={restore}>Restablecer jeringa</button>
          </div>
          {!settled && <p className="small muted" aria-live="polite">Espera a que el sistema alcance el nuevo equilibrio para medir.</p>}
          <RecordButton onRecord={record} disabled={!measured} />
          <p className="small muted">Fíjate en el color justo después de comprimir y compáralo con el color final.</p>
        </div>
        <Notice>Kp ≈ 6,7 bar⁻¹ a 25 °C y ΔH ≈ −57 kJ/mol (tablas termodinámicas). Gases ideales con 2,0 mmol de NO₂ equivalente y 1,2 mmol de aire. Por su toxicidad, el NO₂ real solo se manipula en vitrina de extracción.</Notice>
      </div>
    </div>
  );
}

/** Minúscula solo en la primera letra: conserva los símbolos químicos (Fe³⁺, SCN⁻, Ag⁺). */
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

export default function EquilibriumLab(props: LabProps) {
  const [sys, setSys] = useState<'A' | 'B'>('A');
  return (
    <div className="stack">
      <Segmented label="Sistema en equilibrio" value={sys} onChange={setSys} options={[{ value: 'A', label: SYS_A }, { value: 'B', label: SYS_B }]} />
      {sys === 'A' ? <FePart {...props} /> : <No2Part {...props} />}
    </div>
  );
}
