import { useMemo, useState } from 'react';
import {
  CO2, co2Conditions, co2Forcing, co2Warming, ECS, EPS_288, findPlanet, GH_LIMITS, kelvinToC, layerConditions, layerModel, PLANETS, SIGMA, SURFACES, T_OBS,
} from '../models/greenhouse';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { earthScene } from './greenhouse3d';

type Station = 'equilibrio' | 'capa' | 'co2';

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Sin efecto invernadero la Tierra sería un poco más fresca, pero agradable.', answer: 'falso', feedback: 'El balance de energía da 255 K (−18 °C) en promedio: el agua de la superficie estaría congelada casi en todas partes. El efecto invernadero natural mantiene la superficie unos 33 K más caliente.' },
  { id: 'i2', text: 'El efecto invernadero se debe al agujero de la capa de ozono, que deja entrar más calor.', answer: 'falso', feedback: 'El ozono de la estratosfera absorbe el ultravioleta. El efecto invernadero se debe a gases (vapor de agua, CO₂, metano) que absorben y reemiten infrarrojo. Son dos problemas distintos.' },
  { id: 'i3', text: 'La atmósfera calienta la superficie sin producir energía: solo devuelve hacia abajo parte del infrarrojo que absorbe.', answer: 'cierto', feedback: 'En el modelo de una capa, la capa emite hacia abajo εσT_a⁴; la superficie recibe la luz solar y esa energía, y para equilibrarse emite más (está más caliente). En la cima sale lo mismo que entra.' },
  { id: 'i4', text: 'Duplicar el CO₂ duplica el calentamiento que produce el CO₂ que ya hay.', answer: 'falso', feedback: 'El forzamiento crece con el logaritmo: cada duplicación agrega ≈ 3,7 W/m² (Myhre, 1998). De 278 a 557 ppm se agrega lo mismo que de 557 a 1113 ppm.' },
  { id: 'i5', text: 'Venus es más caliente que Mercurio, aunque está más lejos del Sol, por su atmósfera de CO₂.', answer: 'cierto', feedback: 'Sin atmósfera, Venus tendría unos 227 K porque refleja el 77 % de la luz (NASA). Su superficie está a 737 K: un efecto invernadero enorme por una atmósfera de CO₂ con una presión 92 veces la de la Tierra.' },
];

export default function GreenhouseLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('equilibrio');
  const [planetId, setPlanetId] = useState('tierra');
  const [S, setS] = useState(1361);
  const [albedo, setAlbedo] = useState(0.3);
  const [eps, setEps] = useState(EPS_288);
  const [C, setC] = useState(CO2.y2019);
  const [ecs, setEcs] = useState(ECS.best);

  const planet = findPlanet(planetId);
  const choosePlanet = (id: string) => { const p = findPlanet(id); setPlanetId(id); setS(p.S); setAlbedo(p.albedo); };
  const layerEps = station === 'equilibrio' ? 0 : station === 'co2' ? EPS_288 : eps;
  const r = useMemo(() => layerModel({ S, albedo, eps: layerEps }), [S, albedo, layerEps]);
  const lconds = useMemo(() => layerConditions({ S, albedo, eps: layerEps }), [S, albedo, layerEps]);
  const w = useMemo(() => co2Warming(C, ecs), [C, ecs]);
  const cconds = useMemo(() => co2Conditions(C, ecs), [C, ecs]);
  const scene = useMemo(() => earthScene({ S, albedo, eps: layerEps, co2: station === 'co2' ? { C, ecs } : null }), [S, albedo, layerEps, station, C, ecs]);

  usePublishModel(() => ({
    vars: {
      S: { sym: 'S', name: 'Irradiancia solar', value: S, unit: 'W/m²', decimals: 0 },
      a: { sym: 'α', name: 'Albedo', value: albedo, unit: '', decimals: 2 },
      sig: { sym: 'σ', name: 'Constante de Stefan–Boltzmann', value: SIGMA, unit: 'W/(m²·K⁴)', sig: 4 },
      e: { sym: 'ε', name: 'Absorción infrarroja de la capa', value: layerEps, unit: '', decimals: 2 },
      Te: { sym: 'T_e', name: 'Temperatura de equilibrio', value: r.Te, unit: 'K', decimals: 1 },
      C: { sym: 'C', name: 'CO₂', value: C, unit: 'ppm', decimals: 0 },
      C0: { sym: 'C_0', name: 'CO₂ preindustrial', value: CO2.preindustrial, unit: 'ppm', decimals: 1 },
    },
    equations: [
      { title: 'Temperatura de equilibrio', lhs: 'T_e', expr: '\\sqrt{\\sqrt{\\frac{[S]·(1 − [a])}{4·[sig]}}}' },
      { title: 'Modelo de una capa', lhs: 'T_s', expr: '[Te]·\\sqrt{\\sqrt{\\frac{2}{2 − [e]}}}' },
      { title: 'Forzamiento del CO₂ (Myhre)', lhs: 'ΔF', expr: '5,35·\\text{ln}([C]/[C0])' },
    ],
  }), [S, albedo, layerEps, r.Te, C]);

  const recordEq = () => api.addTrial('equilibrio', { planeta: planet.name, irradiancia: S, albedo, absorbida: Number(r.absorbed.toFixed(1)), te: Number(r.Te.toFixed(1)), teC: Number(kelvinToC(r.Te).toFixed(1)), tReal: planet.tSurface });
  const recordLayer = () => api.addTrial('capa', { eps: layerEps, ts: Number(r.Ts.toFixed(1)), tsC: Number(kelvinToC(r.Ts).toFixed(1)), ta: r.Ta === null ? 0 : Number(r.Ta.toFixed(1)), superficie: Number(r.surfaceIR.toFixed(1)), ventana: Number(r.window.toFixed(1)), capaArriba: Number(r.layerUp.toFixed(1)), capaAbajo: Number(r.layerDown.toFixed(1)), saliente: Number(r.olr.toFixed(1)) });
  const recordCo2 = () => api.addTrial('co2', { co2: Number(C.toFixed(1)), razon: Number(w.ratio.toFixed(3)), lnRazon: Number(w.lnRatio.toFixed(4)), forzamiento: Number(w.forcing.toFixed(3)), sensibilidad: ecs, calentamiento: Number(w.dT.toFixed(2)) });

  const forcingCurve = useMemo(() => Array.from({ length: 53 }, (_, k) => { const c = 150 + k * 20; return { x: c, y: co2Forcing(c) }; }), []);

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'equilibrio', label: 'Sin atmósfera' }, { value: 'capa', label: 'Capa de atmósfera' }, { value: 'co2', label: 'CO₂ y calentamiento' }]} />
        {station === 'equilibrio' && (
          <>
            <Readout items={[
              { k: 'Luz que llega (promedio por m²) S/4', v: `${fmt(r.incoming, 1)} W/m²` },
              { k: 'Luz reflejada S·α/4', v: `${fmt(r.reflected, 1)} W/m²` },
              { k: 'Luz absorbida S(1 − α)/4', v: `${fmt(r.absorbed, 1)} W/m²` },
              { k: 'Temperatura de equilibrio T_e', v: `${fmt(r.Te, 1)} K (${fmt(kelvinToC(r.Te), 1)} °C)`, data: true },
              { k: `Temperatura media real de ${planet.name} (NASA)`, v: `${fmt(planet.tSurface, 0)} K (${fmt(kelvinToC(planet.tSurface), 0)} °C)` },
              { k: 'Diferencia (efecto invernadero)', v: `${fmt(planet.tSurface - r.Te, 1)} K` },
            ]} />
            <Notice kind="info">{planet.note}</Notice>
          </>
        )}
        {station === 'capa' && (
          <Readout items={[
            { k: 'Temperatura de la superficie T_s', v: `${fmt(r.Ts, 1)} K (${fmt(kelvinToC(r.Ts), 1)} °C)`, data: true },
            { k: 'Temperatura de la capa T_a', v: r.Ta === null ? 'no hay capa (ε = 0)' : `${fmt(r.Ta, 1)} K (${fmt(kelvinToC(r.Ta), 1)} °C)` },
            { k: 'Infrarrojo de la superficie σT_s⁴', v: `${fmt(r.surfaceIR, 1)} W/m²` },
            { k: 'Lo absorbe la capa / escapa por la ventana', v: `${fmt(r.layerAbsorbs, 1)} / ${fmt(r.window, 1)} W/m²` },
            { k: 'La capa emite hacia arriba y hacia abajo', v: `${fmt(r.layerUp, 1)} W/m² cada uno` },
            { k: 'Sale al espacio = luz absorbida', v: `${fmt(r.olr, 1)} = ${fmt(r.absorbed, 1)} W/m²` },
            { k: 'Efecto invernadero del modelo T_s − T_e', v: `${fmt(r.greenhouse, 1)} K (real: ≈ ${fmt(T_OBS - r.Te, 0)} K)` },
          ]} />
        )}
        {station === 'co2' && (
          <>
            <Readout items={[
              { k: 'Razón C/C₀ (C₀ = 278,3 ppm, 1750)', v: `${fmt(w.ratio, 3)}; ln(C/C₀) = ${fmt(w.lnRatio, 3)}` },
              { k: 'Forzamiento ΔF = 5,35·ln(C/C₀)', v: `${fmt(w.forcing, 2)} W/m²`, data: true },
              { k: 'Calentamiento de equilibrio ΔT = ECS·ΔF/3,71', v: `${fmt(w.dT, 2)} °C`, data: true },
              { k: 'Parámetro de sensibilidad λ = ECS/ΔF₂ₓ', v: `${fmt(w.lambda, 3)} °C por W/m²` },
              { k: 'Rango probable del IPCC AR6 para este CO₂', v: `${fmt((ECS.likely[0] * w.forcing) / 3.708, 2)} a ${fmt((ECS.likely[1] * w.forcing) / 3.708, 2)} °C` },
            ]} />
            <Chart title="Forzamiento del CO₂ en función de la concentración" xLabel="CO₂ (ppm)" yLabel="Forzamiento ΔF (W/m²)" xUnit="ppm" yUnit="W/m²" height={240}
              exportName="forzamiento-co2" xDomain={[150, 1200]} yDomain={[-3, 9]}
              hLines={[{ y: 3.708, label: '2 × CO₂: 3,71 W/m²' }]}
              series={[{ label: 'ΔF = 5,35·ln(C/C₀) (modelo)', color: 'var(--series-2)', kind: 'line', points: forcingCurve }, { label: 'Concentración elegida', color: 'var(--data)', kind: 'scatter', points: [{ x: C, y: w.forcing }] }]} />
            <Notice kind="info">Calentamiento de EQUILIBRIO solo por el CO₂: no incluye el metano y otros gases ni los aerosoles, y el océano tarda décadas en calentarse. El calentamiento observado de 2011–2020 fue de ≈ 1,1 °C sobre 1850–1900 (IPCC AR6).</Notice>
          </>
        )}
        {[...(station === 'co2' ? cconds : lconds)].map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="inv-3d-h">
          <h3 id="inv-3d-h">Vista 3D: {station === 'equilibrio' ? 'la Tierra recibe luz como un disco y emite como una esfera' : station === 'capa' ? 'la capa devuelve infrarrojo a la superficie' : 'el CO₂ agrega un forzamiento'}</h3>
          <Scene3D idPrefix="inv" title="La Tierra y su balance de energía en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.2 }} status="modelo"
            statusNote="La longitud de cada flecha sobre el polo es proporcional al flujo promedio del modelo (500 W/m² = 1,8 radios terrestres); la flecha del forzamiento usa otra escala. La Tierra, la capa, los rayos y el Sol son un dibujo sin escala de tamaños ni distancias." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="inv" intro="Ideas frecuentes sobre el efecto invernadero. Decide si son ciertas o falsas y compruébalo con el balance de energía, la capa y el CO₂." />
      </div>
      <div className="controls">
        {station !== 'co2' && (
          <div className="card stack">
            <h3>{station === 'equilibrio' ? 'Planeta y luz del Sol' : 'Capa de atmósfera'}</h3>
            {station === 'equilibrio' && <>
              <Select label="Planeta" value={planetId} onChange={choosePlanet} options={PLANETS.map((p) => ({ value: p.id, label: p.name }))} />
              <Slider label="Irradiancia solar S" value={S} min={GH_LIMITS.S[0]} max={GH_LIMITS.S[1]} step={0.1} unit="W/m²" decimals={1} onChange={setS} />
              <Slider label="Albedo α" value={albedo} min={GH_LIMITS.albedo[0]} max={GH_LIMITS.albedo[1]} step={0.01} unit="" decimals={2} onChange={setAlbedo} />
              <Select label="Albedo de una superficie (ejemplos de los textos)" value="" onChange={(v) => { const s = SURFACES.find((x) => x.id === v); if (s) setAlbedo(s.albedo); }} options={[{ value: '', label: 'Elige una superficie…' }, ...SURFACES.map((s) => ({ value: s.id, label: `${s.name}: ≈ ${fmt(s.albedo, 2)}` }))]} />
              <RecordButton onRecord={recordEq} label="Guardar el equilibrio en la tabla" />
              <Notice>S de la Tierra: 1361 W/m² (Kopp y Lean, 2011). Marte y Venus: NASA Planetary Fact Sheet. Los albedos de las superficies son valores típicos e ilustrativos.</Notice>
            </>}
            {station === 'capa' && <>
              <Slider label="Absorción infrarroja de la capa ε" value={eps} min={GH_LIMITS.eps[0]} max={GH_LIMITS.eps[1]} step={0.01} unit="" decimals={2} onChange={setEps} />
              <p className="small">S = {fmt(S, 1)} W/m² y α = {fmt(albedo, 2)} (cámbialos en «Sin atmósfera»).</p>
              <RecordButton onRecord={recordLayer} label="Guardar la capa en la tabla" />
              <Notice>Modelo de una capa (Archer): la capa deja pasar toda la luz del Sol y absorbe la fracción ε del infrarrojo. La atmósfera real también lleva calor hacia arriba por convección y evaporación.</Notice>
            </>}
          </div>
        )}
        {station === 'co2' && (
          <div className="card stack">
            <h3>CO₂ y sensibilidad climática</h3>
            <Slider label="Concentración de CO₂" value={C} min={GH_LIMITS.co2[0]} max={GH_LIMITS.co2[1]} step={0.1} unit="ppm" decimals={1} onChange={setC} />
            <div className="btn-row" role="group" aria-label="Concentraciones de referencia">
              <button type="button" className="btn small" onClick={() => setC(CO2.glacial)}>Glaciación (185)</button>
              <button type="button" className="btn small" onClick={() => setC(CO2.preindustrial)}>1750 (278,3)</button>
              <button type="button" className="btn small" onClick={() => setC(CO2.y2019)}>2019 (409,9)</button>
              <button type="button" className="btn small" onClick={() => setC(CO2.doubled)}>2 × CO₂ (556,6)</button>
            </div>
            <Slider label="Sensibilidad climática de equilibrio" value={ecs} min={GH_LIMITS.ecs[0]} max={GH_LIMITS.ecs[1]} step={0.5} unit="°C" decimals={1} onChange={setEcs} />
            <RecordButton onRecord={recordCo2} label="Guardar el forzamiento en la tabla" />
            <Notice>CO₂ de 1750 y 2019: IPCC AR6, GT I, cap. 2. Glaciaciones: ≈ 180–190 ppm en los núcleos de hielo. Sensibilidad: 3 °C (probable 2,5–4 °C; muy probable 2–5 °C), IPCC AR6, cap. 7.</Notice>
          </div>
        )}
      </div>
    </div>
  );
}
