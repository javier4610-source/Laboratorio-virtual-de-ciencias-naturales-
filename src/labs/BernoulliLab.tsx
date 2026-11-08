import { useMemo, useState } from 'react';
import {
  atomizer, FL_LIMITS, G, H1, hose, HOSE_D, hoseConditions, LIQUIDS, minAirSpeed, MU_WATER, RHO_AIR, RHO_WATER, VENTURI_D1, venturiConditions,
} from '../models/bernoulli';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { usePublishModel } from '../components/Advanced';
import { Chart } from '../components/Chart';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { venturiScene } from './venturi3d';

type Station = 'continuidad' | 'venturi' | 'atomizador';
const BUCKET_L = 10;

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Donde el tubo se angosta, el agua va más despacio porque le cuesta pasar.', answer: 'falso', feedback: 'Va MÁS RÁPIDO: el mismo caudal pasa por un área menor (A₁v₁ = A₂v₂). Es lo que haces al tapar con el dedo la punta de la manguera.' },
  { id: 'i2', text: 'Donde el agua va más rápido, la presión es menor.', answer: 'cierto', feedback: 'Por Bernoulli, p + ½ρv² es constante en el flujo ideal: si v sube, p baja. En el Venturi la columna del piezómetro de la garganta es la más baja.' },
  { id: 'i3', text: 'Si se tapa media manguera con el dedo, sale menos agua por segundo pero más rápido.', answer: 'falso', feedback: 'Con la misma llave abierta, el caudal casi no cambia (si el grifo da la presión suficiente): sale casi la misma agua por segundo, pero más rápido. Con el dedo también aumentan las pérdidas, por eso en la realidad el caudal baja un poco.' },
  { id: 'i4', text: 'Al soplar entre dos hojas de papel colgadas, se separan porque el aire las empuja.', answer: 'falso', feedback: 'Se JUNTAN: el aire rápido entre ellas tiene menor presión que el aire quieto de afuera. Es el mismo principio del atomizador.' },
  { id: 'i5', text: 'En un fluido ideal, después de la garganta del Venturi la presión vuelve a ser la de la entrada.', answer: 'cierto', feedback: 'Si el área vuelve a ser la de la entrada, la rapidez y la presión también (la energía se conserva). En un tubo real la salida queda un poco más baja porque la viscosidad disipa energía.' },
];

export default function BernoulliLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('continuidad');
  const [seconds, setSeconds] = useState(30);
  const [nozzle, setNozzle] = useState(HOSE_D);
  const [q, setQ] = useState(0.3);
  const [d2, setD2] = useState(12.5);
  const [air, setAir] = useState(20);
  const [straw, setStraw] = useState(2);
  const [liquidId, setLiquidId] = useState('agua');

  const h = useMemo(() => hose(BUCKET_L, seconds, nozzle), [seconds, nozzle]);
  const hconds = useMemo(() => hoseConditions(h), [h]);
  const scene = useMemo(() => venturiScene(q, VENTURI_D1, d2), [q, d2]);
  const r = scene.result;
  const vconds = useMemo(() => venturiConditions(r), [r]);
  const liquid = LIQUIDS.find((l) => l.id === liquidId)!;
  const spray = atomizer(air, straw, liquid.rho);

  usePublishModel(() => ({
    vars: {
      Q: { sym: 'Q', name: 'Caudal', value: r.Q, unit: 'm³/s', sig: 3 },
      A1: { sym: 'A_1', name: 'Área de la entrada', value: r.A1, unit: 'm²', sig: 4 },
      A2: { sym: 'A_2', name: 'Área de la garganta', value: r.A2, unit: 'm²', sig: 4 },
      rho: { sym: 'ρ', name: 'Densidad del agua (20 °C)', value: RHO_WATER, unit: 'kg/m³', decimals: 1 },
      v1: { sym: 'v_1', name: 'Rapidez en la entrada', value: r.v1, unit: 'm/s', decimals: 3 },
      v2: { sym: 'v_2', name: 'Rapidez en la garganta', value: r.v2, unit: 'm/s', decimals: 3 },
    },
    equations: [
      { title: 'Continuidad', lhs: 'v_2', expr: '\\frac{[Q]}{[A2]}' },
      { title: 'Bernoulli en el Venturi', lhs: 'Δp', expr: '\\frac{1}{2}·[rho]·([v2]^2 − [v1]^2)' },
    ],
  }), [r]);

  const recordHose = () => api.addTrial('continuidad', { tiempo: seconds, boquilla: nozzle, caudal: Number((h.Q * 1000).toFixed(4)), area: Number((h.A2 * 1e6).toFixed(2)), rapidez: Number(h.v2.toFixed(3)) });
  const recordVenturi = () => api.addTrial('venturi', { caudal: q, garganta: d2, v1: Number(r.v1.toFixed(3)), v2: Number(r.v2.toFixed(3)), dp: Number(r.dp.toFixed(1)), dh: Number((r.dh * 100).toFixed(2)), v2cuad: Number((r.v2 ** 2 - r.v1 ** 2).toFixed(3)) });
  const recordSpray = () => api.addTrial('atomizador', { liquido: liquid.name, aire: air, dp: Number(spray.dp.toFixed(1)), sube: Number((spray.rise * 100).toFixed(3)), pitillo: straw, atomiza: spray.sprays ? 'sí' : 'no' });

  const sprayCurve = useMemo(() => Array.from({ length: 41 }, (_, k) => ({ x: k, y: atomizer(k, 1, liquid.rho).rise * 100 })), [liquid.rho]);

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'continuidad', label: 'Manguera y continuidad' }, { value: 'venturi', label: 'Tubo de Venturi' }, { value: 'atomizador', label: 'Atomizador' }]} />
        {station === 'continuidad' && (
          <>
            <Readout items={[
              { k: 'Caudal Q = volumen/tiempo', v: `${fmt(h.Q * 1000, 3)} L/s` },
              { k: 'Rapidez en la manguera v₁ = Q/A₁', v: `${fmt(h.v1, 2)} m/s` },
              { k: 'Rapidez en la boquilla v₂ = Q/A₂', v: `${fmt(h.v2, 2)} m/s`, data: true },
              { k: 'A₁/A₂ = (D₁/D₂)²', v: `${fmt(h.ratio, 2)} veces` },
            ]} />
            {hconds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
          </>
        )}
        {station === 'venturi' && (
          <>
            <Readout items={[
              { k: 'Rapidez en la entrada y en la garganta', v: `${fmt(r.v1, 3)} y ${fmt(r.v2, 3)} m/s` },
              { k: 'Caída de presión Δp = ½ρ(v₂² − v₁²)', v: `${fmt(r.dp, 0)} Pa`, data: true },
              { k: 'Columnas de los piezómetros', v: `entrada ${fmt(r.h1 * 100, 1)} cm; garganta ${fmt(r.h2 * 100, 1)} cm; salida ${fmt(r.h3 * 100, 1)} cm` },
              { k: 'Desnivel Δh = (v₂² − v₁²)/(2g)', v: `${fmt(r.dh * 100, 1)} cm`, data: true },
              { k: 'p + ½ρv² en la entrada y en la garganta', v: `${fmt(r.energy1, 0)} = ${fmt(r.energy2, 0)} Pa` },
              { k: 'Caudal calculado con Δh (medidor)', v: `${fmt(r.flowFromDh * 1000, 3)} L/s` },
              { k: 'Número de Reynolds en la garganta', v: fmt(r.re2, 0) },
            ]} />
            {vconds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
          </>
        )}
        {station === 'atomizador' && (
          <>
            <Readout items={[
              { k: 'Baja de presión ½ρ_aire·v²', v: `${fmt(spray.dp, 1)} Pa` },
              { k: `Altura que sube el ${liquid.name.toLowerCase()}`, v: `${fmt(spray.rise * 100, 2)} cm`, data: true },
              { k: '¿Llega a la boca del pitillo?', v: spray.sprays ? `sí: se atomiza (sube más de ${fmt(straw, 1)} cm)` : `no: le faltan ${fmt(straw - spray.rise * 100, 2)} cm` },
              { k: 'Rapidez mínima del aire', v: `${fmt(minAirSpeed(straw, liquid.rho), 1)} m/s` },
            ]} />
            <Chart title="Altura que sube el líquido contra la rapidez del aire" xLabel="Rapidez del aire (m/s)" yLabel="Altura (cm)" xUnit="m/s" yUnit="cm" height={230} exportName="atomizador"
              xDomain={[0, 40]} yDomain={[0, 12]} hLines={[{ y: straw, label: `boca del pitillo: ${fmt(straw, 1)} cm` }]}
              series={[{ label: `${liquid.name} (modelo ideal)`, color: 'var(--series-2)', kind: 'line', points: sprayCurve }, { label: 'Rapidez elegida', color: 'var(--data)', kind: 'scatter', points: [{ x: air, y: spray.rise * 100 }] }]} />
          </>
        )}
        <section className="card" aria-labelledby="ven-3d-h">
          <h3 id="ven-3d-h">Vista 3D: tubo de Venturi con trazadores y piezómetros</h3>
          <Scene3D idPrefix="ven" title="Tubo de Venturi en 3D" items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.25 }} status="modelo"
            statusNote="Los trazadores se marcan cada mismo intervalo de tiempo (su separación es proporcional a la rapidez del modelo), las flechas miden v (1 m/s = 0,6 unidades) y las columnas, la altura de presión (10 cm = 0,25 unidades). El tubo es un dibujo con el diámetro elegido." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="ven" intro="Ideas frecuentes sobre los fluidos en movimiento. Decide si son ciertas o falsas y compruébalo con la manguera, el Venturi y el atomizador." />
      </div>
      <div className="controls">
        <div className="card stack">
          {station === 'continuidad' && <>
            <h3>Manguera y balde de 10 L</h3>
            <Slider label="Tiempo para llenar el balde" value={seconds} min={FL_LIMITS.bucketTime[0]} max={FL_LIMITS.bucketTime[1]} step={1} unit="s" decimals={0} onChange={setSeconds} />
            <Slider label="Diámetro de la boquilla" value={nozzle} min={FL_LIMITS.nozzle[0]} max={FL_LIMITS.nozzle[1]} step={0.05} unit="mm" decimals={2} onChange={setNozzle} />
            <RecordButton onRecord={recordHose} label="Guardar la boquilla en la tabla" />
            <Notice>Manguera de ½ pulgada (12,7 mm de diámetro interno, valor típico ilustrativo). El caudal lo fija el grifo; la boquilla solo cambia el área por donde sale.</Notice>
          </>}
          {station === 'venturi' && <>
            <h3>Tubo de Venturi (entrada de {fmt(VENTURI_D1, 0)} mm)</h3>
            <Slider label="Caudal de agua" value={q} min={FL_LIMITS.flow[0]} max={FL_LIMITS.flow[1]} step={0.01} unit="L/s" decimals={2} onChange={setQ} />
            <Slider label="Diámetro de la garganta" value={d2} min={FL_LIMITS.throat[0]} max={FL_LIMITS.throat[1]} step={0.5} unit="mm" decimals={1} onChange={setD2} />
            <RecordButton onRecord={recordVenturi} label="Guardar el Venturi en la tabla" />
            <Notice>Fluido ideal: sin viscosidad, incompresible y con flujo estacionario. Agua a 20 °C: ρ = {fmt(RHO_WATER, 1)} kg/m³ y μ = {fmt(MU_WATER * 1000, 3)} mPa·s (CRC Handbook); g = {fmt(G, 2)} m/s². La columna de entrada ({fmt(H1 * 100, 0)} cm) y los diámetros son ilustrativos.</Notice>
          </>}
          {station === 'atomizador' && <>
            <h3>Atomizador</h3>
            <Select label="Líquido" value={liquidId} onChange={setLiquidId} options={LIQUIDS.map((l) => ({ value: l.id, label: `${l.name} (${fmt(l.rho, 1)} kg/m³)` }))} />
            <Slider label="Rapidez del aire sobre el pitillo" value={air} min={FL_LIMITS.air[0]} max={FL_LIMITS.air[1]} step={0.5} unit="m/s" decimals={1} onChange={setAir} />
            <Slider label="Altura de la boca del pitillo sobre el líquido" value={straw} min={FL_LIMITS.straw[0]} max={FL_LIMITS.straw[1]} step={0.1} unit="cm" decimals={1} onChange={setStraw} />
            <RecordButton onRecord={recordSpray} label="Guardar el atomizador en la tabla" />
            <Notice>Aire seco a 20 °C: ρ = {fmt(RHO_AIR, 3)} kg/m³. Densidades del agua y del etanol a 20 °C: CRC Handbook. No se incluye la tensión superficial.</Notice>
          </>}
        </div>
      </div>
    </div>
  );
}
