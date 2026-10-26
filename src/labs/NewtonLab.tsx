import { useEffect, useMemo, useRef, useState } from 'react';
import { NEWTON_LIMITS, positionAt, simulateCart, SURFACES, TRACK_LENGTH } from '../models/newton';
import { fmt } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { playSound, useSoundLoop } from '../lib/sound';
import { Notice, Readout, RecordButton, Select, Slider } from '../components/ui';
import { SimControls, simStatusOf } from '../components/Experiment';
import type { LabProps } from './registry';
import { BenchTop, Lcd } from './kit';
import { ManipHint, ManipScene, Plunger } from './manipulate';

/** Alargamiento del dinamómetro (px por newton): el anillo se aleja del carrito al tirar más fuerte. */
const PX_PER_N = 5;
import { useMeasure } from '../components/Measurement';
import { instrument } from './instruments';
import { useModelParams, usePublishModel } from '../components/Advanced';
import { G } from '../models/newton';

function Arrow({ x1, y1, x2, y2, color, label }: { x1: number; y1: number; x2: number; y2: number; color: string; label: string }) {
  if (Math.hypot(x2 - x1, y2 - y1) < 2) return null;
  const ang = Math.atan2(y2 - y1, x2 - x1);
  const h = 8;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth="3" />
      <path d={`M${x2} ${y2} L${x2 - h * Math.cos(ang - 0.4)} ${y2 - h * Math.sin(ang - 0.4)} L${x2 - h * Math.cos(ang + 0.4)} ${y2 - h * Math.sin(ang + 0.4)} Z`} fill={color} />
      <text x={x2 + 6 * Math.cos(ang)} y={y2 + 6 * Math.sin(ang) + 4} style={{ fontSize: 12, fill: color, fontWeight: 700 }}>{label}</text>
    </g>
  );
}

/* ------------------------------------------------------------------ dibujo del banco */

const TOP = 158; // cara superior de la pista: allí se apoyan las ruedas del carrito
const RAIL_X0 = 24, RAIL_X1 = 548;

function NewtonDefs() {
  return (
    <defs>
      <linearGradient id="nw-cart" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0" stopColor="#4f93e6" />
        <stop offset="0.45" stopColor="#2563b8" />
        <stop offset="1" stopColor="#163f78" />
      </linearGradient>
      <linearGradient id="nw-brass" x1="0" x2="1" y1="0" y2="0">
        <stop offset="0" stopColor="#9c7417" />
        <stop offset="0.3" stopColor="#f1d27a" />
        <stop offset="0.6" stopColor="#c99a2e" />
        <stop offset="1" stopColor="#8a6512" />
      </linearGradient>
      <radialGradient id="nw-led" cx="0.5" cy="0.5" r="0.5">
        <stop offset="0" stopColor="#ff8a80" stopOpacity="0.9" />
        <stop offset="1" stopColor="#ff5252" stopOpacity="0" />
      </radialGradient>
      <pattern id="nw-holes" width="14" height="5" patternUnits="userSpaceOnUse">
        <rect width="14" height="5" fill="#d7dfe2" />
        <circle cx="7" cy="2.5" r="1.1" fill="#5d6d74" />
      </pattern>
      <pattern id="nw-grit" width="9" height="5" patternUnits="userSpaceOnUse">
        <rect width="9" height="5" fill="#a07d4f" />
        <circle cx="2" cy="1.5" r="0.7" fill="#6b4f2a" />
        <circle cx="6.5" cy="3.2" r="0.6" fill="#d9bf92" />
        <circle cx="4.2" cy="4.2" r="0.5" fill="#5a4223" />
      </pattern>
    </defs>
  );
}

/** Pista de aluminio sobre dos patas, con la superficie elegida encima y escala grabada entre las fotopuertas. */
function Track({ surface, gateA, gateB }: { surface: string; gateA: number; gateB: number }) {
  const fill = surface === 'lija' ? 'url(#nw-grit)' : surface === 'madera' ? 'url(#kit-wood)' : 'url(#nw-holes)';
  const ticks = useMemo(() => Array.from({ length: 11 }, (_, i) => gateA + ((gateB - gateA) * i) / 10), [gateA, gateB]);
  return (
    <g>
      {/* patas regulables */}
      {[44, 528].map((lx) => (
        <g key={lx} filter="url(#kit-shadow-soft)">
          <path d={`M${lx - 9} ${TOP + 19} L${lx + 9} ${TOP + 19} L${lx + 20} 220 L${lx - 20} 220 Z`} fill="url(#kit-body-dark)" />
          <rect x={lx - 3} y={218} width={6} height={6} fill="url(#kit-metal-h)" />
          <rect x={lx - 12} y={223} width={24} height={4} rx={2} fill="#263033" />
        </g>
      ))}
      {/* perfil de aluminio */}
      <g filter="url(#kit-shadow)">
        <rect x={RAIL_X0} y={TOP + 5} width={RAIL_X1 - RAIL_X0} height={14} rx={2} fill="url(#kit-metal)" stroke="#8c979b" />
      </g>
      <line x1={RAIL_X0 + 2} x2={RAIL_X1 - 2} y1={TOP + 13} y2={TOP + 13} stroke="#97a3a7" strokeWidth="1.2" />
      {ticks.map((tx, i) => (
        <line key={i} x1={tx} x2={tx} y1={TOP + 5} y2={TOP + (i % 5 === 0 ? 12 : 9)} stroke="#37474f" strokeWidth={i % 5 === 0 ? 1.2 : 0.8} />
      ))}
      {/* superficie de rodadura */}
      <rect x={RAIL_X0} y={TOP} width={RAIL_X1 - RAIL_X0} height={5} fill={fill} stroke={surface === 'madera' ? '#b8975a' : '#7d8a8f'} strokeWidth="0.6" />
      {/* topes de los extremos */}
      {[RAIL_X0 - 2, RAIL_X1 - 8].map((sx) => (
        <g key={sx}>
          <rect x={sx} y={TOP - 16} width={10} height={21} rx={2} fill="url(#kit-body-dark)" />
          <rect x={sx === RAIL_X0 - 2 ? sx + 10 : sx - 3} y={TOP - 12} width={3} height={10} rx={1} fill="#c62828" />
        </g>
      ))}
    </g>
  );
}

/** Fotopuerta: cabezal con emisor infrarrojo montado sobre una varilla. */
function Photogate({ x, label, blocked }: { x: number; label: string; blocked: boolean }) {
  return (
    <g>
      <rect x={x - 2.5} y={116} width={5} height={TOP + 18 - 116} fill="url(#kit-metal-h)" />
      <g filter="url(#kit-shadow-soft)">
        <path d={`M${x - 11} 84 h22 a3 3 0 0 1 3 3 v28 a3 3 0 0 1 -3 3 h-22 a3 3 0 0 1 -3 -3 v-28 a3 3 0 0 1 3 -3 Z`} fill="url(#kit-body-dark)" />
      </g>
      <rect x={x - 4} y={98} width={8} height={18} rx={1.5} fill="#0d1416" />
      {blocked ? <circle cx={x} cy={106} r={2.4} fill="#ffd54a" /> : <><circle cx={x} cy={106} r={7} fill="url(#nw-led)" /><circle cx={x} cy={106} r={2.2} fill="#ff5252" /></>}
      <circle cx={x + 7} cy={89} r={1.6} fill={blocked ? '#ffd54a' : '#66bb6a'} />
      <text x={x} y={76} textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>{label}</text>
    </g>
  );
}

/** Cronómetro de fotopuertas (caja de control con pantalla LCD). */
function GateTimer({ x, y, text }: { x: number; y: number; text: string }) {
  return (
    <g>
      <g filter="url(#kit-shadow)">
        <rect x={x} y={y} width={96} height={72} rx={8} fill="url(#kit-body)" stroke="#a9b4b6" />
      </g>
      <Lcd x={x + 8} y={y + 9} w={80} h={28} text={text} unit="s" />
      <text x={x + 48} y={y + 52} textAnchor="middle" style={{ fontSize: 11, fill: '#3a4644', fontWeight: 700 }}>cronómetro</text>
      {[48, 60].map((dy) => (
        <g key={dy}>
          <rect x={x - 5} y={y + dy - 3} width={7} height={6} rx={1.5} fill="#263033" />
          <rect x={x - 1} y={y + dy - 1.5} width={3} height={3} fill="#c9d2d5" />
        </g>
      ))}
    </g>
  );
}

/** Carrito dinámico con pesas ranuradas, bandera opaca y dinamómetro que tira de él. */
function Cart({ mass, force }: { mass: number; force: number }) {
  const discs = Math.max(1, Math.min(8, Math.round(mass / 0.25)));
  const arrowLen = force > 0 ? 10 + force * 4.5 : 0;
  return (
    <g>
      <ellipse cx={30} cy={TOP + 1} rx={30} ry={2.5} fill="#000" opacity="0.18" />
      {/* bandera que interrumpe el haz de las fotopuertas */}
      <rect x={28} y={98} width={4} height={28} rx={1} fill="#1f2a2d" />
      {/* pesas ranuradas en dos columnas */}
      {[6, 36].map((px, col) => {
        const n = Math.ceil((discs - col) / 2);
        return (
          <g key={px}>
            <rect x={px + 8.5} y={124 - n * 4.5 - 4} width={3} height={n * 4.5 + 6} fill="url(#kit-metal-h)" />
            {Array.from({ length: n }, (_, i) => (
              <rect key={i} x={px} y={124 - (i + 1) * 4.5} width={20} height={4.1} rx={1.2} fill="url(#nw-brass)" stroke="#7a5a12" strokeWidth="0.5" />
            ))}
          </g>
        );
      })}
      {/* cuerpo */}
      <path d="M3 124 H57 Q60 124 60 127 V146 Q60 149 57 149 H3 Q0 149 0 146 V127 Q0 124 3 124 Z" fill="url(#nw-cart)" stroke="#123d73" />
      <rect x={3} y={125.5} width={54} height={3} rx={1.5} fill="#fff" opacity="0.25" />
      <text x={30} y={141} textAnchor="middle" style={{ fontSize: 11, fill: '#fff', fontWeight: 700 }}>{fmt(mass, 2)} kg</text>
      {/* ruedas */}
      {[13, 47].map((wx) => (
        <g key={wx}>
          <circle cx={wx} cy={TOP - 7} r={7} fill="#20292c" />
          <circle cx={wx} cy={TOP - 7} r={3.4} fill="url(#kit-metal)" stroke="#7d8a8f" strokeWidth="0.6" />
        </g>
      ))}
      {/* dinamómetro */}
      <line x1={60} x2={66} y1={136} y2={136} stroke="#5d6b70" strokeWidth="1.6" />
      <rect x={66} y={130.5} width={36} height={11} rx={3} fill="url(#kit-glass-fill)" stroke="var(--glass-edge)" />
      <path d="M68 136 l3 -3.5 l3 7 l3 -7 l3 7 l3 -7 l3 7 l3 -7 l3 7 l3 -3.5" fill="none" stroke="#6d7b80" strokeWidth="1" />
      <rect x={66} y={130.5} width={36} height={11} rx={3} fill="url(#kit-glass)" />
      {/* vástago que sale del tubo al tirar y anillo del que se tira */}
      <rect x={100} y={134.8} width={3 + force * PX_PER_N} height={2.4} rx={1} fill="url(#kit-metal-h)" stroke="#6d7b80" strokeWidth="0.4" />
      <circle cx={107 + force * PX_PER_N} cy={136} r={4.5} fill="none" stroke="#5d6b70" strokeWidth="1.8" />
      {arrowLen > 0 && (
        <g>
          <line x1={66} x2={66 + arrowLen - 7} y1={119} y2={119} stroke="var(--fis)" strokeWidth="3" />
          <path d={`M${66 + arrowLen} 119 l-8 -5 v10 Z`} fill="var(--fis)" />
        </g>
      )}
      <text x={66} y={112} style={{ fontSize: 11, fill: 'var(--fis)', fontWeight: 700 }}>{fmt(force, 1)} N</text>
    </g>
  );
}
export default function NewtonLab({ api }: LabProps) {
  const [mass, setMass] = useState(0.5);
  const [force, setForce] = useState(2);
  const [surface, setSurface] = useState('colchon');
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const { measure, remeasure } = useMeasure();
  const P = useModelParams();
  const res = useMemo(() => {
    const m = simulateCart({ mass, force, surfaceId: surface, g: P.g });
    if (!m.moves) return m;
    // Lectura del cronómetro de fotopuertas (en modo real, con la dispersión típica de la ficha).
    const time = measure(Math.sqrt((2 * TRACK_LENGTH) / m.acceleration), { ...instrument('newton', 'cronometro'), key: 'cronometro' });
    return { ...m, time, measuredAcceleration: (2 * TRACK_LENGTH) / time ** 2 };
  }, [mass, force, surface, measure, P.g]);
  usePublishModel(() => {
    const s = SURFACES.find((x) => x.id === surface)!;
    const g = P.g ?? G;
    return {
      vars: {
        a: { sym: 'a', name: 'Aceleración del modelo', value: res.acceleration, unit: 'm/s²', decimals: 3 },
        F: { sym: 'F', name: 'Fuerza aplicada', value: force, unit: 'N', decimals: 2 },
        f: { sym: 'f_{k}', name: 'Fricción cinética', value: res.moves ? res.friction : null, unit: 'N', decimals: 2 },
        fs: { sym: 'f_{s,máx}', name: 'Fricción estática máxima', value: s.muS * mass * g, unit: 'N', decimals: 2 },
        m: { sym: 'm', name: 'Masa del carrito', value: mass, unit: 'kg', decimals: 2 },
        g: { sym: 'g', name: 'Gravedad', value: g, unit: 'm/s²', decimals: 2 },
        mu: { sym: '\\mu_{k}', name: 'Coeficiente de fricción cinética', value: s.muK, decimals: 2 },
        muS: { sym: '\\mu_{s}', name: 'Coeficiente de fricción estática', value: s.muS, decimals: 2 },
        N: { sym: 'N', name: 'Fuerza normal', value: mass * g, unit: 'N', decimals: 2 },
        d: { sym: 'd', name: 'Distancia entre fotopuertas', value: TRACK_LENGTH, unit: 'm', decimals: 2 },
        t: { sym: 't', name: 'Tiempo (cronómetro)', value: res.time, unit: 's', decimals: 3 },
        am: { sym: 'a_{med}', name: 'Aceleración medida', value: res.measuredAcceleration, unit: 'm/s²', decimals: 3 },
      },
      equations: [
        { title: 'Fuerza normal (pista horizontal)', lhs: 'N', expr: '[m]·[g]' },
        { title: 'Fricción', lhs: 'f', expr: '[mu]·[N]', note: res.moves ? undefined : `El carrito no se mueve: F no supera la fricción estática máxima μ_s·N.` },
        { title: 'Segunda ley de Newton', lhs: 'a', expr: '\\frac{[F] − [f]}{[m]}' },
        { title: 'Aceleración medida con las fotopuertas', lhs: 'am', expr: '\\frac{2·[d]}{[t]^{2}}' },
      ],
    };
  }, [res, force, mass, surface, P.g]);
  const raf = useRef(0);
  const reset = () => { setRunning(false); setDone(false); setT(0); };
  useEffect(reset, [mass, force, surface]);

  useEffect(() => {
    if (!running) return;
    if (!res.moves) { setRunning(false); setDone(true); return; }
    if (prefersReducedMotion()) { setT(res.time!); setRunning(false); setDone(true); return; }
    // Al reanudar tras una pausa, el reloj sigue desde el tiempo ya recorrido.
    const start = performance.now() - t * 1000;
    const tick = (now: number) => {
      const el = Math.max(0, (now - start) / 1000);
      if (el >= res.time!) { setT(res.time!); setRunning(false); setDone(true); playSound('photogate'); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, res]);

  const x = res.moves ? positionAt(res.acceleration, t) : 0;
  // Rodadura del carrito mientras se mueve, más fuerte a medida que gana rapidez.
  useSoundLoop('rolling', running && res.moves, res.moves && res.time ? 0.15 + 0.85 * Math.min(1, t / res.time) : 0);
  const trackX0 = 60, trackPx = 420;
  const cartX = trackX0 + (x / TRACK_LENGTH) * trackPx;
  const scaleF = 9; // px por newton en el diagrama
  const record = () => api.addTrial('carrito', {
    superficie: SURFACES.find((s) => s.id === surface)!.name, masa: mass, fuerza: force,
    tiempo: res.time, aMedida: res.measuredAcceleration === null ? 0 : Number(res.measuredAcceleration.toFixed(4)),
    friccion: Number(res.friction.toFixed(3)), inversoMasa: Number((1 / mass).toFixed(4)),
  });

  return (
    <div className="lab-layout">
      <div className="stack">
        <div className="bench">
          <ManipScene viewBox="0 0 640 250" label="Control del dinamómetro" scene={
          <svg viewBox="0 0 640 250" role="img" aria-labelledby="nw-t nw-d">
            <title id="nw-t">Carrito sobre una pista con dos fotopuertas separadas 1,00 m</title>
            <desc id="nw-d">{done ? (res.moves ? `El carrito recorrió 1,00 m en ${fmt(res.time!, 3)} s.` : 'El carrito no se movió: la fricción estática equilibra la fuerza aplicada.') : 'El carrito está en reposo en la primera fotopuerta.'}</desc>
            <NewtonDefs />
            <BenchTop y={226} width={640} />
            {/* cables de las fotopuertas al cronómetro */}
            <path d={`M${trackX0 + 14} 96 C${trackX0 + 60} 96, ${trackX0 + 70} 40, 300 40 S 500 62, 535 62`} fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
            <path d={`M${trackX0 + trackPx + 14} 96 C${trackX0 + trackPx + 40} 96, 515 74, 535 74`} fill="none" stroke="var(--ink-2)" strokeWidth="2" strokeLinecap="round" opacity="0.75" />
            {[trackX0, trackX0 + trackPx].map((gx, i) => (
              <Photogate key={i} x={gx} label={`fotopuerta ${i + 1}`} blocked={Math.abs(cartX - gx) < 4} />
            ))}
            <Track surface={surface} gateA={trackX0} gateB={trackX0 + trackPx} />
            <g transform={`translate(${cartX - 30} 0)`}>
              <Cart mass={mass} force={force} />
            </g>
            <GateTimer x={540} y={14} text={fmt(t, 3)} />
            {/* cota entre fotopuertas */}
            <g>
              <line x1={trackX0} x2={trackX0 + trackPx} y1="200" y2="200" stroke="var(--ink-2)" />
              <line x1={trackX0} x2={trackX0} y1="193" y2="207" stroke="var(--ink-2)" />
              <line x1={trackX0 + trackPx} x2={trackX0 + trackPx} y1="193" y2="207" stroke="var(--ink-2)" />
              <rect x={trackX0 + trackPx / 2 - 26} y="191" width="52" height="18" rx="4" fill="var(--surface)" />
              <text x={trackX0 + trackPx / 2} y="204" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>1,00 m</text>
            </g>
          </svg>}>
            <Plunger label="Anillo del dinamómetro: fuerza aplicada" value={force} min={NEWTON_LIMITS.force[0]} max={NEWTON_LIMITS.force[1]} step={0.1} unit="N" decimals={1}
              from={{ x: cartX - 30 + 107 + NEWTON_LIMITS.force[0] * PX_PER_N, y: 136 }} to={{ x: cartX - 30 + 107 + NEWTON_LIMITS.force[1] * PX_PER_N, y: 136 }} size={20}
              disabled={running} onChange={setForce} />
          </ManipScene>
        </div>
        <ManipHint>Tira del anillo del dinamómetro hacia la derecha para aplicar más fuerza, o enfócalo con Tab y usa las flechas.</ManipHint>
        <div className="grid-2">
          <div className="card">
            <h3>Diagrama de cuerpo libre</h3>
            <svg viewBox="0 0 260 220" role="img" aria-label={`Fuerzas: peso ${fmt(res.weight, 2)} N hacia abajo, normal ${fmt(res.normal, 2)} N hacia arriba, aplicada ${fmt(force, 2)} N a la derecha, fricción ${fmt(res.friction, 2)} N a la izquierda.`} style={{ maxWidth: 280 }}>
              <rect x="105" y="85" width="50" height="40" rx="4" fill="var(--surface-2)" stroke="var(--ink-2)" />
              <Arrow x1={130} y1={125} x2={130} y2={125 + Math.min(80, res.weight * scaleF / 2)} color="var(--ink)" label={`P = ${fmt(res.weight, 1)} N`} />
              <Arrow x1={130} y1={85} x2={130} y2={85 - Math.min(80, res.normal * scaleF / 2)} color="var(--ok)" label={`N = ${fmt(res.normal, 1)} N`} />
              <Arrow x1={155} y1={105} x2={155 + force * scaleF} y2={105} color="var(--fis)" label={`F = ${fmt(force, 1)} N`} />
              <Arrow x1={105} y1={115} x2={105 - res.friction * scaleF} y2={115} color="var(--bad)" label="" />
              {res.friction > 0.01 && <text x={Math.max(4, 100 - res.friction * scaleF)} y="140" style={{ fontSize: 12, fill: 'var(--bad)', fontWeight: 700 }}>Fr = {fmt(res.friction, 2)}</text>}
            </svg>
          </div>
          <Readout items={[
            { k: 'Fuerza neta', v: `${fmt(res.netForce, 2)} N` },
            { k: 'Tiempo en 1,00 m', v: done ? (res.moves ? `${fmt(res.time!, 3)} s` : 'no se movió') : '—', data: true },
            { k: 'a medida = 2d/t²', v: done && res.measuredAcceleration !== null ? `${fmt(res.measuredAcceleration, 3)} m/s²` : '—', data: true },
            { k: 'Rapidez final', v: done && res.finalSpeed !== null ? `${fmt(res.finalSpeed, 2)} m/s` : '—' },
            { k: 'Fricción máxima estática', v: `${fmt(SURFACES.find((s) => s.id === surface)!.muS * res.normal, 2)} N` },
          ]} />
        </div>
      </div>
      <div className="controls">
        <div className="card stack">
          <h3>Condiciones</h3>
          <Select label="Superficie" value={surface} onChange={setSurface} options={SURFACES.map((s) => ({ value: s.id, label: s.name }))} />
          <Slider label="Masa del carrito" value={mass} min={NEWTON_LIMITS.mass[0]} max={NEWTON_LIMITS.mass[1]} step={0.05} unit="kg" decimals={2} onChange={setMass} />
          <Slider label="Fuerza aplicada" value={force} min={NEWTON_LIMITS.force[0]} max={NEWTON_LIMITS.force[1]} step={0.1} unit="N" decimals={1} onChange={setForce} />
          {/* Sin barra de avance: el tiempo en recorrer 1,00 m es la lectura que se mide. */}
          <SimControls title="Carrito" status={simStatusOf(running, t > 0, done)} startLabel="Soltar el carrito" repeatLabel="Soltar de nuevo"
            onStart={() => { remeasure('cronometro'); setT(0); setDone(false); setRunning(true); playSound('click', { intensity: 0.8 }); }}
            onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset} />
          <RecordButton onRecord={record} disabled={!done} />
        </div>
        <Notice>Fuerza constante y horizontal; g = 9,8 m/s². Los coeficientes de fricción son típicos y aproximados.</Notice>
      </div>
    </div>
  );
}
