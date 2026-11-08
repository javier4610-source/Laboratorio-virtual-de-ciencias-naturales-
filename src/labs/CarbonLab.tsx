import { useMemo, useState } from 'react';
import {
  A_1750, A_2019, AIRBORNE_FRACTION, BUDGET, C_LIMITS, carbonConditions, EMISSIONS_2010s, END_YEAR, findReservoir, GROSS, IMBALANCE, PGC_PER_PPM, RESERVOIRS,
  SCENARIOS, simulateCarbon, START_YEAR, type Scenario,
} from '../models/carbon';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { carbonScene } from './carbon3d';

type Station = 'reservorios' | 'balance' | 'escenarios';
const BASE: Scenario = SCENARIOS[0].s;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Las plantas sacan del aire el carbono con el que forman su cuerpo.', answer: 'cierto', feedback: 'En la fotosíntesis las plantas toman CO₂ del aire y con su carbono fabrican azúcares, celulosa y madera. Por eso un bosque o un manglar es un reservorio de carbono.' },
  { id: 'i2', text: 'Todo el CO₂ que emitimos al quemar combustibles se queda en la atmósfera.', answer: 'falso', feedback: 'En 2010–2019 se quedó en el aire ≈ 46 %: el océano absorbió ≈ 2,5 y las plantas y el suelo ≈ 3,4 de los 11,2 PgC emitidos por año (IPCC AR6).' },
  { id: 'i3', text: 'Si un árbol se quema o se pudre, su carbono vuelve al aire.', answer: 'cierto', feedback: 'La combustión y la descomposición liberan CO₂. Por eso la deforestación es una fuente de carbono (≈ 1,6 PgC por año en 2010–2019).' },
  { id: 'i4', text: 'Los animales no participan en el ciclo del carbono.', answer: 'falso', feedback: 'Los animales comen plantas (o a otros animales) y liberan CO₂ al respirar; sus restos se descomponen. Hacen parte de la respiración y la descomposición.' },
  { id: 'i5', text: 'El carbono del petróleo y del carbón estuvo alguna vez en seres vivos.', answer: 'cierto', feedback: 'Son restos de plantas y organismos marinos enterrados hace millones de años. Al quemarlos devolvemos al aire, en pocos siglos, carbono que tardó millones de años en guardarse.' },
];

export default function CarbonLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('reservorios');
  const [resId, setResId] = useState('vegetacion');
  const [preset, setPreset] = useState('igual');
  const [s, setS] = useState<Scenario>(BASE);
  const [year, setYear] = useState(2100);

  const scen = station === 'escenarios' ? s : BASE;
  const run = useMemo(() => simulateCarbon(scen), [scen]);
  const baseRun = useMemo(() => simulateCarbon(BASE), []);
  const conds = useMemo(() => (station === 'escenarios' ? carbonConditions(s, run) : []), [station, s, run]);
  const shownYear = station === 'escenarios' ? year : START_YEAR;
  const scene = useMemo(() => carbonScene({ run, s: scen, year: shownYear, mode: station === 'reservorios' ? 'natural' : 'humano' }), [run, scen, shownYear, station]);
  const res = findReservoir(resId);
  const emitted = run.cumFossil + 81 * (scen.landUse - scen.reforest);
  const at = (y: number) => run.points.find((p) => p.year === y)!;

  const choosePreset = (id: string) => { setPreset(id); const p = SCENARIOS.find((x) => x.id === id); if (p) setS(p.s); };
  const change = (k: keyof Scenario) => (v: number) => { setPreset('propio'); setS((o) => ({ ...o, [k]: v })); };

  usePublishModel(() => ({
    vars: {
      Ef: { sym: 'E_f', name: 'Emisiones fósiles (2019)', value: BUDGET.fossil.value, unit: 'PgC/año', decimals: 1 },
      Es: { sym: 'E_s', name: 'Deforestación', value: scen.landUse, unit: 'PgC/año', decimals: 1 },
      So: { sym: 'S_o', name: 'Sumidero del océano', value: BUDGET.ocean.value, unit: 'PgC/año', decimals: 1 },
      St: { sym: 'S_t', name: 'Sumidero de la tierra', value: BUDGET.land.value, unit: 'PgC/año', decimals: 1 },
      k: { sym: 'k', name: 'PgC por ppm', value: PGC_PER_PPM, unit: 'PgC/ppm', decimals: 3 },
    },
    equations: [
      { title: 'Crecimiento de la atmósfera (balance)', lhs: 'dA/dt', expr: '[Ef] + [Es] − [So] − [St]' },
      { title: 'Crecimiento en ppm por año', lhs: 'dC/dt', expr: '\\frac{[Ef] + [Es] − [So] − [St]}{[k]}' },
    ],
  }), [scen.landUse]);

  const recordRes = () => api.addTrial('reservorios', { reservorio: res.name, minimo: Math.round(res.low), maximo: Math.round(res.high), veces: Number((res.mid / A_1750).toFixed(2)) });
  const recordBalance = () => api.addTrial('balance', { periodo: '2010–2019', fosil: BUDGET.fossil.value, suelo: BUDGET.landUse.value, atmosfera: BUDGET.atmosphere.value, oceano: BUDGET.ocean.value, tierra: BUDGET.land.value, fraccion: Number((AIRBORNE_FRACTION * 100).toFixed(1)) });
  const recordScen = () => api.addTrial('escenarios', { fosil2050: s.fossil2050, deforestacion: s.landUse, reforestacion: s.reforest, ppm2050: Number(run.ppm2050.toFixed(1)), ppm2100: Number(run.ppm2100.toFixed(1)), aire: Number(((run.cumAtm / emitted) * 100).toFixed(1)) });

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'reservorios', label: 'Reservorios' }, { value: 'balance', label: 'Balance de un año' }, { value: 'escenarios', label: 'Escenarios hasta 2100' }]} />
        {station === 'reservorios' && (
          <>
            <Readout items={[
              { k: `Carbono en ${res.name.toLowerCase()}`, v: res.low === res.high ? `≈ ${fmt(res.mid, 0)} PgC` : `${fmt(res.low, 0)} a ${fmt(res.high, 0)} PgC`, data: true },
              { k: 'Comparado con la atmósfera de 1750 (591 PgC)', v: `≈ ${fmt(res.mid / A_1750, 1)} veces` },
              { k: 'Atmósfera en 2019 (409,9 ppm × 2,124)', v: `${fmt(A_2019, 0)} PgC: ${fmt(A_2019 - A_1750, 0)} PgC más que en 1750` },
              { k: 'Tiempo que pasa un átomo de carbono en el aire', v: `≈ ${fmt(A_1750 / (GROSS.photosynthesis + GROSS.oceanIn), 0)} años (591 PgC ÷ ≈ ${GROSS.photosynthesis + GROSS.oceanIn} PgC/año que entran a plantas y mar)` },
            ]} />
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Reservorios de carbono">
              <table>
                <caption className="small muted">Reservorios antes de 1750 (PgC = miles de millones de toneladas de carbono). IPCC AR5, GT I, figura 6.1, redondeados; la atmósfera con 2,124 PgC/ppm.</caption>
                <thead><tr><th>Reservorio</th><th>Carbono (PgC)</th></tr></thead>
                <tbody>{RESERVOIRS.map((r) => <tr key={r.id}><td>{r.name}</td><td>{r.low === r.high ? `≈ ${fmt(r.mid, 0)}` : `${fmt(r.low, 0)}–${fmt(r.high, 0)}`}</td></tr>)}</tbody>
              </table>
            </div>
            <Notice kind="info">{res.note}</Notice>
          </>
        )}
        {station === 'balance' && (
          <>
            <div className="table-wrap" tabIndex={0} role="region" aria-label="Balance anual del carbono 2010–2019">
              <table>
                <caption className="small muted">Promedio de 2010–2019 en PgC por año (IPCC AR6, GT I, tabla 5.1).</caption>
                <thead><tr><th>Flujo</th><th>PgC/año</th></tr></thead>
                <tbody>
                  <tr><td>Fuente: quema de combustibles fósiles y cemento</td><td>{fmt(BUDGET.fossil.value, 1)} ± {fmt(BUDGET.fossil.unc, 1)}</td></tr>
                  <tr><td>Fuente: deforestación y cambio de uso del suelo</td><td>{fmt(BUDGET.landUse.value, 1)} ± {fmt(BUDGET.landUse.unc, 1)}</td></tr>
                  <tr><td>Se queda en la atmósfera</td><td>{fmt(BUDGET.atmosphere.value, 1)} ± {fmt(BUDGET.atmosphere.unc, 2)}</td></tr>
                  <tr><td>Sumidero: océano</td><td>{fmt(BUDGET.ocean.value, 1)} ± {fmt(BUDGET.ocean.unc, 1)}</td></tr>
                  <tr><td>Sumidero: plantas y suelo</td><td>{fmt(BUDGET.land.value, 1)} ± {fmt(BUDGET.land.unc, 1)}</td></tr>
                </tbody>
              </table>
            </div>
            <Readout items={[
              { k: 'Total emitido por año', v: `${fmt(EMISSIONS_2010s, 1)} PgC` },
              { k: 'Fracción que se queda en el aire', v: `${fmt(AIRBORNE_FRACTION * 100, 0)} %`, data: true },
              { k: 'Aumento del CO₂ por año (5,1 ÷ 2,124)', v: `${fmt(BUDGET.atmosphere.value / PGC_PER_PPM, 2)} ppm` },
              { k: 'Desbalance (lo que las mediciones no logran cerrar)', v: `${fmt(IMBALANCE, 1)} PgC/año` },
            ]} />
          </>
        )}
        {station === 'escenarios' && (
          <>
            <Readout items={[
              { k: `CO₂ en ${shownYear}`, v: `${fmt(at(shownYear).ppm, 1)} ppm`, data: true },
              { k: 'CO₂ en 2050 y en 2100', v: `${fmt(run.ppm2050, 0)} y ${fmt(run.ppm2100, 0)} ppm` },
              { k: 'Emitido de 2019 a 2100 (neto)', v: `${fmt(emitted, 0)} PgC` },
              { k: 'Adónde fue', v: `aire ${fmt(run.cumAtm, 0)}; océano ${fmt(run.cumOcean, 0)}; plantas y suelo ${fmt(run.cumLand + 81 * scen.reforest, 0)} PgC` },
            ]} />
            <Chart title="CO₂ en el aire según el escenario (modelo de cajas)" xLabel="Año" yLabel="CO₂ (ppm)" xUnit="año" yUnit="ppm" height={240} exportName="escenarios-co2"
              xDomain={[START_YEAR, END_YEAR]} yDomain={[250, 700]} hLines={[{ y: 278.3, label: '1750: 278 ppm' }]}
              series={[
                { label: 'Escenario elegido', color: 'var(--series-1)', kind: 'line', points: run.points.map((p) => ({ x: p.year, y: p.ppm })) },
                { label: 'Todo sigue igual (referencia)', color: 'var(--series-8)', kind: 'line', dashed: true, points: baseRun.points.map((p) => ({ x: p.year, y: p.ppm })) },
                { label: 'Año mostrado', color: 'var(--data)', kind: 'scatter', points: [{ x: shownYear, y: at(shownYear).ppm }] },
              ]} />
          </>
        )}
        {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
        <section className="card" aria-labelledby="car-3d-h">
          <h3 id="car-3d-h">Vista 3D: {station === 'reservorios' ? 'reservorios y flujos naturales' : 'flujos causados por las personas y sumideros'}</h3>
          <Scene3D idPrefix="car" title="Ciclo del carbono en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.25 }} status="modelo"
            statusNote="El volumen de cada cubo es proporcional al carbono del reservorio (punto medio del rango) y el área de la sección de cada flecha, al flujo. Las posiciones del paisaje son un esquema." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="car" intro="Ideas frecuentes sobre el ciclo del carbono. Decide si son ciertas o falsas y compruébalo con los reservorios, el balance y los escenarios." />
      </div>
      <div className="controls">
        <div className="card stack">
          {station === 'reservorios' && <>
            <h3>Reservorios</h3>
            <Select label="Reservorio" value={resId} onChange={setResId} options={RESERVOIRS.map((r) => ({ value: r.id, label: r.name }))} />
            <RecordButton onRecord={recordRes} label="Guardar el reservorio en la tabla" />
            <Notice>Cifras redondeadas del IPCC (AR5, figura 6.1; el AR6 las actualiza en la figura 5.12 con valores del mismo orden): verifícalas con la figura. Los flujos naturales «≈ 120» y «≈ 80» PgC/año son órdenes de magnitud.</Notice>
          </>}
          {station === 'balance' && <>
            <h3>Balance de un año</h3>
            <RecordButton onRecord={recordBalance} label="Guardar el balance en la tabla" />
            <Notice>Balance medido del carbono (IPCC AR6, GT I, cap. 5, tabla 5.1; Global Carbon Budget, Friedlingstein y otros, 2020). La incertidumbre (±) es la del informe.</Notice>
          </>}
          {station === 'escenarios' && <>
            <h3>Escenario</h3>
            <Select label="Escenario de partida" value={preset} onChange={choosePreset} options={[...SCENARIOS.map((x) => ({ value: x.id, label: x.name })), { value: 'propio', label: 'Mi escenario' }]} />
            <Slider label="Emisiones fósiles en 2050" value={s.fossil2050} min={C_LIMITS.fossil2050[0]} max={C_LIMITS.fossil2050[1]} step={0.1} unit="PgC/año" decimals={1} onChange={change('fossil2050')} />
            <Slider label="Deforestación" value={s.landUse} min={C_LIMITS.landUse[0]} max={C_LIMITS.landUse[1]} step={0.1} unit="PgC/año" decimals={1} onChange={change('landUse')} />
            <Slider label="Reforestación adicional" value={s.reforest} min={C_LIMITS.reforest[0]} max={C_LIMITS.reforest[1]} step={0.1} unit="PgC/año" decimals={1} onChange={change('reforest')} />
            <Slider label="Años después de 2019 (año que se muestra)" value={year - START_YEAR} min={0} max={END_YEAR - START_YEAR} step={1} unit="años" decimals={0} onChange={(v) => setYear(START_YEAR + v)} />
            <RecordButton onRecord={recordScen} label="Guardar el escenario en la tabla" />
            <Notice>Modelo de cajas propio, calibrado con el balance de 2010–2019: los sumideros son proporcionales al exceso de carbono del aire. Es una simplificación optimista; no es una proyección del IPCC.</Notice>
          </>}
        </div>
      </div>
    </div>
  );
}
