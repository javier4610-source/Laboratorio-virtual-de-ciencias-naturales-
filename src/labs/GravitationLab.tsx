import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AU_PER_YEAR_KMS, findPair, findPlanet, forceConditions, G_CONST, geostationaryAltitude, gravForce, GRAV_LIMITS, integrateOrbit, keplerTable, M_EARTH, M_SUN,
  orbitAt, orbitConditions, PAIRS, PLANETS, R_EARTH_MEAN, SATELLITES, satellitePeriod, satelliteSpeed, surfaceGravity, auOf,
} from '../models/gravitation';
import { fmt, fmtSig } from '../lib/format';
import { prefersReducedMotion } from '../lib/prefs';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { SimControls, simStatusOf } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { orbitScene } from './gravitation3d';

type Station = 'fuerza' | 'orbita' | 'planetas';
/** Una vuelta completa se recorre en 12 s de pantalla. */
const SCREEN_S = 12;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'En la Estación Espacial los astronautas flotan porque allá arriba no hay gravedad.', answer: 'falso', feedback: 'A 420 km la gravedad todavía es ≈ 8,6 m/s², casi el 88 % de la de la superficie. Flotan porque caen libremente junto con la estación: van tan rápido (7,7 km/s) que, mientras caen, la Tierra se curva debajo de ellos.' },
  { id: 'i2', text: 'Un planeta va más rápido cuando está más cerca del Sol.', answer: 'cierto', feedback: 'Es la segunda ley de Kepler: el radio barre áreas iguales en tiempos iguales, así que cerca del Sol el planeta recorre un arco más largo en el mismo tiempo. La vis-viva lo confirma: v² = μ(2/r − 1/a).' },
  { id: 'i3', text: 'Si se duplica la distancia entre dos cuerpos, la fuerza gravitacional se reduce a la mitad.', answer: 'falso', feedback: 'Se reduce a la CUARTA parte: F es proporcional a 1/r². Compruébalo con el control de la distancia en «Ley de gravitación».' },
  { id: 'i4', text: 'Las estaciones del año se deben a que la Tierra se acerca y se aleja del Sol.', answer: 'falso', feedback: 'La órbita de la Tierra es casi circular (e = 0,0167): la distancia cambia solo ≈ 3 %, y la Tierra pasa por el perihelio en enero, cuando en el hemisferio norte es invierno. Las estaciones se deben a la inclinación del eje de rotación.' },
  { id: 'i5', text: 'La Luna atrae a la Tierra con la misma fuerza con la que la Tierra atrae a la Luna.', answer: 'cierto', feedback: 'Por la tercera ley de Newton las dos fuerzas son iguales y opuestas (≈ 1,98 × 10²⁰ N). La Luna se acelera mucho más porque su masa es 81 veces menor.' },
];

export default function GravitationLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('fuerza');
  const [pairId, setPairId] = useState('tierra-luna');
  const [rFactor, setRFactor] = useState(1);
  const [preset, setPreset] = useState('tierra');
  const [a, setA] = useState(auOf(findPlanet('tierra')));
  const [e, setE] = useState(findPlanet('tierra').e);
  const [altKm, setAltKm] = useState(420);
  const [t, setT] = useState(0);
  const [running, setRunning] = useState(false);
  const raf = useRef(0);

  const pair = findPair(pairId);
  const r = pair.r * rFactor;
  const F = gravForce(pair.m1, pair.m2, r);
  const F0 = gravForce(pair.m1, pair.m2, pair.r);
  const fconds = useMemo(() => forceConditions(rFactor, pairId), [rFactor, pairId]);

  const run = useMemo(() => integrateOrbit(a, e), [a, e]);
  const oconds = useMemo(() => orbitConditions(a, e), [a, e]);
  const st = orbitAt(run, t);
  const incl = preset === 'personalizada' ? 0 : findPlanet(preset).incl;
  const name = preset === 'personalizada' ? 'Planeta imaginario' : findPlanet(preset).name;
  const scene = useMemo(() => orbitScene({ run, t, inclDeg: incl, name }), [run, t, incl, name]);
  const rows = useMemo(() => keplerTable(), []);
  const satT = satellitePeriod(altKm * 1000);

  const choosePreset = (id: string) => { setPreset(id); if (id !== 'personalizada') { const p = findPlanet(id); setA(auOf(p)); setE(p.e); } };
  const resetRun = () => { cancelAnimationFrame(raf.current); setRunning(false); setT(0); };
  useEffect(resetRun, [run]);
  useEffect(() => {
    if (!running) return;
    if (prefersReducedMotion()) { setT(run.period); setRunning(false); return; }
    const speed = run.period / SCREEN_S;
    const start = performance.now() - (t / speed) * 1000;
    const tick = (now: number) => {
      const el = ((now - start) / 1000) * speed;
      if (el >= run.period) { setT(run.period); setRunning(false); return; }
      setT(el);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, run]); // eslint-disable-line react-hooks/exhaustive-deps
  const finished = t >= run.period - 1e-12 && !running;
  const status = simStatusOf(running, t > 0, finished);

  usePublishModel(() => ({
    vars: {
      G: { sym: 'G', name: 'Constante de gravitación', value: G_CONST, unit: 'N·m²/kg²', sig: 6 },
      m1: { sym: 'm_1', name: pair.n1, value: pair.m1, unit: 'kg', sig: 4 },
      m2: { sym: 'm_2', name: pair.n2, value: pair.m2, unit: 'kg', sig: 4 },
      r: { sym: 'r', name: 'Distancia entre centros', value: r, unit: 'm', sig: 4 },
      a: { sym: 'a', name: 'Semieje mayor', value: a, unit: 'UA', decimals: 3 },
      mu: { sym: 'μ', name: 'G·M del Sol', value: run.mu, unit: 'UA³/año²', decimals: 3 },
    },
    equations: [
      { title: 'Ley de gravitación universal', lhs: 'F', expr: '\\frac{[G]·[m1]·[m2]}{[r]^2}' },
      { title: 'Tercera ley de Kepler', lhs: 'T', expr: '2π·\\sqrt{\\frac{[a]^3}{[mu]}}' },
    ],
  }), [pair, r, a, run.mu]);

  const recordForce = () => api.addTrial('fuerza', { pareja: pair.name, distanciaRel: Number(rFactor.toFixed(3)), distancia: Number(r.toPrecision(5)), fuerza: Number(F.toPrecision(5)), fuerzaRel: Number((F / F0).toFixed(5)) });
  const areaSpread = (() => { const m = run.areas.reduce((s, x) => s + x, 0) / 8; return Math.max(...run.areas.map((x) => Math.abs(x - m) / m)) * 100; })();
  const recordOrbit = () => api.addTrial('orbitas', { cuerpo: name, a: Number(a.toFixed(4)), e: Number(e.toFixed(4)), periodo: Number(run.period.toFixed(4)), vp: Number((run.vp * AU_PER_YEAR_KMS).toFixed(2)), va: Number((run.va * AU_PER_YEAR_KMS).toFixed(2)), areas: Number(areaSpread.toExponential(2)) });
  const recordPlanets = () => rows.forEach((x) => api.addTrial('planetas', { planeta: x.planet.name, aUA: Number(x.aAU.toFixed(4)), periodoAnios: Number(x.Tyears.toFixed(4)), periodoCalc: Number(x.Tcalc.toFixed(1)), razon: Number(x.ratio.toFixed(4)), logA: Number(x.logA.toFixed(4)), logT: Number(x.logT.toFixed(4)) }));
  const recordSat = () => api.addTrial('satelites', { altitud: altKm, periodo: Number((satT / 60).toFixed(1)), rapidez: Number((satelliteSpeed(altKm * 1000) / 1000).toFixed(3)) });

  const forceCurve = useMemo(() => Array.from({ length: 76 }, (_, k) => { const x = 0.25 + k * 0.05; return { x, y: 1 / (x * x) }; }), []);

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'fuerza', label: 'Ley de gravitación' }, { value: 'orbita', label: 'Órbita y leyes de Kepler' }, { value: 'planetas', label: 'Planetas y satélites' }]} />
        {station === 'fuerza' && (
          <>
            <Readout items={[
              { k: 'Distancia entre centros r', v: `${fmtSig(r / 1000, 4)} km` },
              { k: 'Fuerza gravitacional F = G·m₁·m₂/r²', v: `${fmtSig(F, 4)} N`, data: true },
              { k: 'F comparada con la distancia original', v: `${fmt(F / F0, 4)} veces (r × ${fmt(rFactor, 2)})` },
              { k: 'Gravedad en la superficie g = G·M/R²', v: `Tierra ${fmt(surfaceGravity(M_EARTH, R_EARTH_MEAN), 2)} m/s²; Luna ${fmt(surfaceGravity(7.346e22, 1737.4e3), 2)} m/s²; Marte ${fmt(surfaceGravity(6.4169e23, 3389.5e3), 2)} m/s²` },
            ]} />
            <Chart title="Fuerza gravitacional contra la distancia" xLabel="Distancia / distancia original" yLabel="F / F original" height={230} exportName="gravitacion-fuerza"
              xDomain={[0, 4]} yDomain={[0, 16]}
              series={[{ label: 'F ∝ 1/r² (modelo)', color: 'var(--series-2)', kind: 'line', points: forceCurve }, { label: 'Distancia elegida', color: 'var(--data)', kind: 'scatter', points: [{ x: rFactor, y: F / F0 }] }]} />
            <Notice kind="info">{pair.note} En Apartadó se mide g ≈ 9,78 m/s²: la rotación de la Tierra y su forma achatada la reducen respecto a los 9,82 m/s² del cálculo.</Notice>
          </>
        )}
        {station === 'orbita' && (
          <>
            <Readout items={[
              { k: 'Período T = 2π·√(a³/μ)', v: `${fmt(run.period, 3)} años (${fmt(run.period * 365.25, 1)} días)`, data: true },
              { k: 'Día de la órbita', v: `${fmt(st.t * 365.25, 0)} de ${fmt(run.period * 365.25, 0)}` },
              { k: 'Distancia al Sol y rapidez ahora (vis-viva)', v: `${fmt(st.r, 3)} UA; ${fmt(st.v * AU_PER_YEAR_KMS, 2)} km/s` },
              { k: 'Perihelio', v: `${fmt(run.rp, 3)} UA; ${fmt(run.vp * AU_PER_YEAR_KMS, 2)} km/s` },
              { k: 'Afelio', v: `${fmt(run.ra, 3)} UA; ${fmt(run.va * AU_PER_YEAR_KMS, 2)} km/s` },
              { k: 'Cada área barrida en 1/8 del período', v: `${fmt(run.areas[0], 4)} UA²`, data: true },
              { k: 'Diferencia entre las 8 áreas', v: `< ${fmtSig(Math.max(areaSpread, 1e-9), 1)} %` },
              { k: 'Variación relativa de la energía', v: fmtSig(Math.max(run.energy.maxRelDrift, 1e-16), 2) },
            ]} />
            {oconds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
          </>
        )}
        {station === 'planetas' && (
          <>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Tercera ley de Kepler con los planetas">
              <table>
                <caption className="small muted">Semieje mayor y período sideral: fichas de la NASA (Planetary Fact Sheets). Período calculado con T = 2π√(a³/G(M + m)).</caption>
                <thead><tr><th>Planeta</th><th>a (UA)</th><th>T medido (años)</th><th>T calculado (días)</th><th>T medido (días)</th><th>T²/a³ (años²/UA³)</th></tr></thead>
                <tbody>{rows.map((x) => <tr key={x.planet.id}><td>{x.planet.name}</td><td>{fmt(x.aAU, 3)}</td><td>{fmt(x.Tyears, 3)}</td><td>{fmt(x.Tcalc, 1)}</td><td>{fmt(x.planet.period, 1)}</td><td>{fmt(x.ratio, 3)}</td></tr>)}</tbody>
              </table>
            </div>
            <Chart title="Tercera ley de Kepler (escala logarítmica)" xLabel="log₁₀ del semieje mayor (UA)" yLabel="log₁₀ del período (años)" height={240} exportName="kepler-planetas"
              xDomain={[-0.6, 1.6]} yDomain={[-0.8, 2.4]}
              series={[{ label: 'log T = 1,5·log a (Kepler)', color: 'var(--series-2)', kind: 'line', points: [{ x: -0.6, y: -0.9 }, { x: 1.6, y: 2.4 }] }, { label: 'Planetas (NASA)', color: 'var(--data)', kind: 'scatter', points: rows.map((x) => ({ x: x.logA, y: x.logT, label: x.planet.name })) }]} />
            <Readout items={[
              { k: 'Satélite de la Tierra: período', v: `${fmt(satT / 60, 1)} min (${fmt(satT / 3600, 2)} h)`, data: true },
              { k: 'Rapidez orbital', v: `${fmt(satelliteSpeed(altKm * 1000) / 1000, 2)} km/s` },
              { k: 'Órbita geoestacionaria (T = 1 día sidéreo)', v: `altitud ${fmt(geostationaryAltitude() / 1000, 0)} km` },
            ]} />
            <Notice kind="info">Para Saturno, Urano y Neptuno el período calculado difiere hasta ≈ 0,6 % del medido: los semiejes de las fichas son de una época dada y los planetas se perturban entre sí. Las altitudes de los satélites son aproximadas (la Estación Espacial varía entre ≈ 400 y 420 km).</Notice>
          </>
        )}
        {fconds.length > 0 && station === 'fuerza' && fconds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="grav-3d-h">
          <h3 id="grav-3d-h">Vista 3D: la órbita de {name}, la velocidad, la fuerza y las áreas iguales</h3>
          <Scene3D idPrefix="grav" title="Órbita alrededor del Sol en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.9, pitch: 0.7 }} status="modelo"
            statusNote="La trayectoria es la órbita integrada por el modelo; la flecha de la velocidad mide la rapidez (50 km/s = 1,2 unidades) y la de la fuerza es proporcional a 1/r². El Sol y el planeta no están a escala de tamaño." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="grav" intro="Ideas frecuentes sobre la gravedad y las órbitas. Decide si son ciertas o falsas y compruébalo con la ley de Newton, la órbita y los planetas." />
      </div>
      <div className="controls">
        <div className="card stack">
          {station === 'fuerza' && <>
            <h3>Dos cuerpos</h3>
            <Select label="Pareja de cuerpos" value={pairId} onChange={(v) => { setPairId(v); setRFactor(1); }} options={PAIRS.map((p) => ({ value: p.id, label: p.name }))} />
            <Slider label="Distancia (veces la original)" value={rFactor} min={GRAV_LIMITS.rFactor[0]} max={GRAV_LIMITS.rFactor[1]} step={0.05} unit="" decimals={2} onChange={setRFactor} />
            <RecordButton onRecord={recordForce} label="Guardar la fuerza en la tabla" />
            <Notice>G = 6,674 30 × 10⁻¹¹ N·m²/kg² (CODATA 2018). Masas de la Tierra, la Luna y el Sol: NASA. Masa del Sol: {fmtSig(M_SUN, 5)} kg.</Notice>
          </>}
          {station === 'orbita' && <>
            <h3>Órbita alrededor del Sol</h3>
            <Select label="Cuerpo" value={preset} onChange={choosePreset} options={[...PLANETS.map((p) => ({ value: p.id, label: p.name })), { value: 'personalizada', label: 'Planeta imaginario (elige a y e)' }]} />
            <Slider label="Semieje mayor a" value={a} min={GRAV_LIMITS.a[0]} max={GRAV_LIMITS.a[1]} step={0.01} unit="UA" decimals={3} onChange={(v) => { setPreset('personalizada'); setA(v); }} />
            <Slider label="Excentricidad e" value={e} min={GRAV_LIMITS.e[0]} max={GRAV_LIMITS.e[1]} step={0.01} unit="" decimals={3} onChange={(v) => { setPreset('personalizada'); setE(v); }} />
            <SimControls title="Órbita" status={status} startLabel="Recorrer una vuelta" repeatLabel="Repetir la vuelta"
              onStart={() => { setT(0); setRunning(true); }} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={resetRun}
              progress={{ value: t * 365.25, max: run.period * 365.25, unit: 'días', label: 't', decimals: 0 }} />
            <RecordButton onRecord={recordOrbit} disabled={running} label="Guardar la órbita en la tabla" />
            <Notice>Órbita integrada con Runge–Kutta de 4.º orden (4000 pasos por vuelta) con μ = G·M del Sol (IAU). Datos de los planetas: NASA Planetary Fact Sheets. El planeta imaginario es ilustrativo.</Notice>
          </>}
          {station === 'planetas' && <>
            <h3>Planetas y satélites</h3>
            <RecordButton onRecord={recordPlanets} label="Guardar los 8 planetas en la tabla" />
            <Slider label="Altitud del satélite" value={altKm} min={GRAV_LIMITS.altitude[0]} max={GRAV_LIMITS.altitude[1]} step={10} unit="km" decimals={0} onChange={setAltKm} />
            <div className="btn-row" role="group" aria-label="Satélites de referencia">
              {SATELLITES.map((s) => <button key={s.id} type="button" className="btn small" onClick={() => setAltKm(s.altitude / 1000)}>{s.name}</button>)}
            </div>
            <RecordButton onRecord={recordSat} label="Guardar el satélite en la tabla" />
            <Notice>GM de la Tierra: 3,986 004 418 × 10¹⁴ m³/s² (IERS); radio ecuatorial 6378,137 km (WGS 84); día sidéreo 86 164,0905 s.</Notice>
          </>}
        </div>
      </div>
    </div>
  );
}
