import { useMemo, useState } from 'react';
import {
  compassAt, compassConditions, EARTH, electromagnet, EM_LIMITS, emConditions, findMagnet, findMaterial, magnetField, magnetsForce, MAGNETS, MATERIALS, type EmInput, type PlacedMagnet,
} from '../models/magnetism';
import { fmt } from '../lib/format';
import { Notice, Readout, RecordButton, Segmented, Select, Slider } from '../components/ui';
import { ConditionAlert } from '../components/ConditionAlert';
import { resolutionText } from '../components/Experiment';
import { IdeasPanel, type Idea } from '../components/IdeasPanel';
import { useMeasure } from '../components/Measurement';
import { usePublishModel } from '../components/Advanced';
import { instrument } from './instruments';
import type { LabProps } from './registry';
import { Scene3D } from '../three';
import { currentScene, magnetScene, twoMagnetsScene } from './magnet3d';

type Station = 'iman' | 'imanes' | 'corriente';
type Facing = 'NN' | 'NS' | 'SS';

const IDEAS: Idea[] = [
  { id: 'i1', text: 'Los imanes atraen a todos los metales.', answer: 'falso', feedback: 'Solo atraen a los materiales ferromagnéticos (hierro, acero, níquel, cobalto). El aluminio de una lata, el cobre y el oro no se atraen. Pruébalo con los materiales de la estación «Dos imanes».' },
  { id: 'i2', text: 'Si se parte un imán por la mitad, se obtiene un polo norte suelto y un polo sur suelto.', answer: 'falso', feedback: 'Cada pedazo es un imán completo con su norte y su sur. Nunca se ha encontrado un polo magnético aislado; por eso las líneas de campo son cerradas.' },
  { id: 'i3', text: 'El polo norte de la aguja de una brújula apunta hacia una región que se comporta como un polo SUR magnético.', answer: 'cierto', feedback: 'Polos distintos se atraen: el norte de la aguja es atraído por el «sur magnético» de la Tierra, que está cerca del polo norte geográfico. En Apartadó, además, apunta 7,5° al oeste del norte geográfico (declinación, WMM2025).' },
  { id: 'i4', text: 'El campo magnético de un imán solo existe sobre la mesa, en el plano donde se riegan las limaduras.', answer: 'falso', feedback: 'El campo llena todo el espacio alrededor del imán: las líneas salen del polo norte también por encima y por debajo. Gira la vista 3D para verlo.' },
  { id: 'i5', text: 'Una corriente eléctrica puede mover la aguja de una brújula.', answer: 'cierto', feedback: 'Es el experimento de Oersted (1820): un cable con corriente produce un campo magnético. Con 1 A a 2 cm el campo es de 10 µT y la aguja se desvía unos 20°.' },
];

export default function MagnetismLab({ api }: LabProps) {
  const [station, setStation] = useState<Station>('iman');
  const [magnetId, setMagnetId] = useState('ferrita');
  const [angleDeg, setAngleDeg] = useState(0);
  const [cx, setCx] = useState(8);
  const [cy, setCy] = useState(4);
  const [lines, setLines] = useState(true);
  const [gap, setGap] = useState(2);
  const [facing, setFacing] = useState<Facing>('NN');
  const [material, setMaterial] = useState('clavo');
  const [tested, setTested] = useState<string | null>(null);
  const [source, setSource] = useState<EmInput['source']>('bobina');
  const [turns, setTurns] = useState(50);
  const [current, setCurrent] = useState(1);
  const [dist, setDist] = useState(10);
  const { measure, real } = useMeasure();

  const magnet = findMagnet(magnetId);
  const placed: PlacedMagnet = useMemo(() => ({ magnet, center: [0, 0, 0], angle: (angleDeg * Math.PI) / 180 }), [magnet, angleDeg]);
  const conds = useMemo(() => compassConditions(placed, cx / 100, cy / 100), [placed, cx, cy]);
  const blocked = conds.some((c) => c.level === 'invalido');
  const reading = useMemo(() => (blocked ? null : compassAt(placed, cx / 100, cy / 100)), [placed, cx, cy, blocked]);
  const compassInst = instrument('magnetismo-imanes', 'brujula'), teslaInst = instrument('magnetismo-imanes', 'teslametro');
  const angRead = reading ? measure(reading.angle, { ...compassInst, key: 'angulo' }) : null;
  const B = reading ? magnetField(placed, [cx / 100, cy / 100, 0]) : null;
  const Bread = B ? measure(Math.hypot(B[0], B[1], B[2]) * 1e6, { ...teslaInst, key: 'campo' }) : null;
  const force = magnetsForce(magnet, gap / 100, facing);
  const mat = findMaterial(material);
  const em: EmInput = useMemo(() => ({ source, turns, current, distanceCm: dist }), [source, turns, current, dist]);
  const emR = useMemo(() => electromagnet(em), [em]);
  const emConds = useMemo(() => emConditions(em), [em]);
  const defl = measure(emR.deflection, { ...compassInst, key: 'desviacion' });

  usePublishModel(() => ({
    vars: {
      I: { sym: 'I', name: 'Corriente', value: current, unit: 'A', decimals: 2 },
      d: { sym: 'd', name: 'Distancia', value: dist / 100, unit: 'm', decimals: 2 },
      H: { sym: 'H', name: 'Campo horizontal de la Tierra', value: EARTH.H, unit: 'T', sig: 4 },
    },
    equations: [{ title: 'Campo de un cable recto', lhs: 'B', expr: '\\frac{4π·10^{-7}·[I]}{2π·[d]}' }],
  }), [current, dist]);

  const scene = useMemo(() => (station === 'iman' ? magnetScene({ placed, compass: [cx / 100, cy / 100], showLines: lines }) : station === 'imanes' ? twoMagnetsScene(magnet, gap, facing) : currentScene(em)), [station, placed, cx, cy, lines, magnet, gap, facing, em]);

  const recordCompass = () => reading && api.addTrial('brujula', { iman: magnet.name.replace(/ \(.*/, ''), x: cx, y: cy, distancia: Number(Math.hypot(cx, cy).toFixed(1)), campo: Bread ?? 0, angulo: angRead ?? 0 });
  const recordEm = () => api.addTrial('electroiman', { fuente: source === 'cable' ? 'cable recto' : 'bobina', espiras: source === 'cable' ? 1 : turns, corriente: current, distancia: dist, campo: Number((emR.B * 1e6).toFixed(3)), desviacion: defl, tanDesviacion: Number(Math.tan((defl * Math.PI) / 180).toFixed(4)) });
  const recordMaterial = () => api.addTrial('materiales', { material: mat.name, atrae: mat.magnetic ? 'sí' : 'no' });

  return (
    <div className="lab-layout">
      <div className="stack">
        <Segmented<Station> label="Estación" value={station} onChange={setStation} options={[{ value: 'iman', label: 'Imán y brújula' }, { value: 'imanes', label: 'Dos imanes y materiales' }, { value: 'corriente', label: 'Corriente y electroimán' }]} />
        {station === 'iman' && (
          <>
            <div className="bench">
              <svg viewBox="0 0 400 300" role="img" aria-labelledby="mag-b-t mag-b-d">
                <title id="mag-b-t">Imán de barra en la mesa con limaduras de hierro y una brújula</title>
                <desc id="mag-b-d">{reading ? `La brújula en (${fmt(cx, 1)}; ${fmt(cy, 1)}) cm apunta ${fmt(reading.angle, 0)}° desde el norte geográfico.` : 'La brújula está pegada al imán.'}</desc>
                <rect width="400" height="300" rx="14" fill="var(--surface-2)" />
                {Array.from({ length: 15 * 11 }, (_, k) => {
                  const gx = (k % 15) - 7, gy = Math.floor(k / 15) - 5;
                  const x = gx * 1.4 / 100, y = gy * 1.4 / 100;
                  if (Math.abs(gx) < 3 && Math.abs(gy) < 1) return null;
                  const c = compassAt(placed, x, y);
                  const a = (c.angle * Math.PI) / 180;
                  const px = 200 + gx * 26, py = 150 - gy * 26;
                  return <line key={k} x1={px - 7 * Math.sin(a)} y1={py + 7 * Math.cos(a)} x2={px + 7 * Math.sin(a)} y2={py - 7 * Math.cos(a)} stroke="var(--ink-3)" strokeWidth="1.4" />;
                })}
                <g transform={`rotate(${-angleDeg} 200 150)`}>
                  <rect x={200 - magnet.length * 1000 * 0.5 * 1.86} y="138" width={magnet.length * 1000 * 0.93} height="24" fill="var(--series-2)" />
                  <rect x="200" y="138" width={magnet.length * 1000 * 0.93} height="24" fill="var(--series-1)" />
                  <text x={200 + magnet.length * 1000 * 0.45} y="155" textAnchor="middle" style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }}>N</text>
                  <text x={200 - magnet.length * 1000 * 0.45} y="155" textAnchor="middle" style={{ fontSize: 12, fill: '#fff', fontWeight: 700 }}>S</text>
                </g>
                {reading && <g transform={`translate(${200 + cx * 18.6} ${150 - cy * 18.6})`}>
                  <circle r="14" fill="var(--surface)" stroke="var(--ink)" />
                  <line x1={-11 * Math.sin((reading.angle * Math.PI) / 180)} y1={11 * Math.cos((reading.angle * Math.PI) / 180)} x2={11 * Math.sin((reading.angle * Math.PI) / 180)} y2={-11 * Math.cos((reading.angle * Math.PI) / 180)} stroke="var(--data)" strokeWidth="3" />
                </g>}
                <text x="16" y="24" style={{ fontSize: 11, fill: 'var(--ink-2)' }}>↑ norte geográfico</text>
              </svg>
            </div>
            <Readout items={[
              { k: 'Brújula (dirección de la aguja)', v: angRead !== null ? `${fmt(angRead, 0)}° desde el norte geográfico` : 'pegada al imán', data: angRead !== null, resolution: angRead !== null ? resolutionText(compassInst.resolution, '°') : undefined },
              { k: 'Teslámetro (campo del imán)', v: Bread !== null ? `${fmt(Bread, 1)} µT` : '—', data: Bread !== null, resolution: Bread !== null ? resolutionText(teslaInst.resolution, 'µT') : undefined },
              { k: 'Campo del imán frente al de la Tierra', v: reading ? `${fmt(reading.magnetToEarth, 2)} veces el horizontal terrestre (${fmt(EARTH.H * 1e6, 1)} µT)` : '—' },
              { k: 'Momento magnético del imán', v: `${fmt(magnet.moment, 2)} A·m² (B_r ≈ ${fmt(magnet.br, 2)} T)` },
              { k: 'Campo de la Tierra en Apartadó (WMM2025)', v: `${fmt(EARTH.F * 1e6, 1)} µT; inclinación ${fmt(EARTH.inclination, 1)}°; declinación ${fmt(-EARTH.declination, 1)}° al oeste` },
            ]} />
            {conds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
          </>
        )}
        {station === 'imanes' && (
          <>
            <Readout items={[
              { k: 'Fuerza entre los imanes', v: `${fmt(Math.abs(force), 3)} N: ${force > 0 ? 'se repelen' : 'se atraen'}` },
              { k: 'Material de prueba', v: tested ? `${findMaterial(tested).name}: ${findMaterial(tested).magnetic ? 'el imán lo atrae' : 'no lo atrae'}` : 'acerca el imán a un material' },
              { k: 'Por qué', v: tested ? findMaterial(tested).why : '—' },
            ]} />
            <Notice kind="info">La fuerza sale del modelo de polos puntuales: cerca de 1 cm sobrestima la fuerza real.</Notice>
          </>
        )}
        {station === 'corriente' && (
          <>
            <Readout items={[
              { k: 'Brújula: desviación de la aguja', v: `${fmt(defl, 0)}°`, data: true, resolution: resolutionText(compassInst.resolution, '°') },
              { k: 'Campo de la corriente en la brújula', v: `${fmt(emR.B * 1e6, 2)} µT` },
              { k: 'tan θ = B/H', v: fmt(emR.tan, 3) },
              ...(emR.inside !== null ? [{ k: 'Campo dentro de la bobina (sin núcleo)', v: `${fmt(emR.inside * 1000, 3)} mT` }] : []),
            ]} />
            {emConds.map((x) => <ConditionAlert key={x.text} level={x.level} cause={x.text} fix={x.fix} />)}
          </>
        )}
        <section className="card" aria-labelledby="mag-3d-h">
          <h3 id="mag-3d-h">Vista 3D: {station === 'iman' ? 'el campo llena el espacio alrededor del imán' : station === 'imanes' ? 'fuerzas entre polos' : 'la corriente crea un campo magnético'}</h3>
          <Scene3D idPrefix="mag" title={station === 'iman' ? 'Imán con líneas de campo en 3D' : station === 'imanes' ? 'Dos imanes en 3D' : 'Corriente y brújula en 3D'} items={scene.items} extent={scene.extent} target={scene.target}
            description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.6 }} status="modelo"
            statusNote="Líneas de campo integradas con el campo del imán (modelo de dos polos) y brújulas orientadas con el campo horizontal total (imán + Tierra, WMM2025); fuerzas y desviaciones del mismo modelo. Las agujas no están a escala." />
        </section>
        <IdeasPanel ideas={IDEAS} idPrefix="mag" intro="Ideas frecuentes sobre los imanes. Decide si son ciertas o falsas y compruébalo con la brújula, los materiales y la vista 3D." />
      </div>
      <div className="controls">
        {station === 'iman' && (
          <div className="card stack">
            <h3>Imán y brújula</h3>
            <Select label="Imán" value={magnetId} onChange={setMagnetId} options={MAGNETS.map((m) => ({ value: m.id, label: m.name }))} />
            <Slider label="Orientación del polo norte (desde el este)" value={angleDeg} min={0} max={345} step={15} unit="°" decimals={0} onChange={setAngleDeg} />
            <Slider label="Brújula: posición este (x)" value={cx} min={-15} max={15} step={0.5} unit="cm" decimals={1} onChange={setCx} />
            <Slider label="Brújula: posición norte (y)" value={cy} min={-15} max={15} step={0.5} unit="cm" decimals={1} onChange={setCy} />
            <Segmented<'si' | 'no'> label="Líneas de campo en 3D" value={lines ? 'si' : 'no'} onChange={(v) => setLines(v === 'si')} options={[{ value: 'si', label: 'Mostrar' }, { value: 'no', label: 'Ocultar' }]} />
            <RecordButton onRecord={recordCompass} disabled={!reading} label="Guardar la lectura de la brújula" />
            <Notice>{real ? 'Instrumento real: la brújula y el teslámetro traen su error típico.' : 'Brújula con divisiones de 1° y teslámetro de 0,1 µT.'} El norte geográfico está hacia arriba del dibujo.</Notice>
          </div>
        )}
        {station === 'imanes' && (
          <div className="card stack">
            <h3>Dos imanes</h3>
            <Select label="Imanes (dos iguales)" value={magnetId} onChange={setMagnetId} options={MAGNETS.map((m) => ({ value: m.id, label: m.name }))} />
            <Segmented<Facing> label="Polos enfrentados" value={facing} onChange={setFacing} options={[{ value: 'NN', label: 'N con N' }, { value: 'NS', label: 'N con S' }, { value: 'SS', label: 'S con S' }]} />
            <Slider label="Separación entre los imanes" value={gap} min={0.5} max={10} step={0.5} unit="cm" decimals={1} onChange={setGap} />
            <h3>Materiales</h3>
            <Select label="Material" value={material} onChange={setMaterial} options={MATERIALS.map((m) => ({ value: m.id, label: m.name }))} />
            <button type="button" className="btn" onClick={() => setTested(material)}>Acercar el imán</button>
            <RecordButton onRecord={recordMaterial} disabled={tested !== material} label="Guardar el material en la tabla" />
          </div>
        )}
        {station === 'corriente' && (
          <div className="card stack">
            <h3>Corriente y brújula</h3>
            <Segmented<EmInput['source']> label="Fuente del campo" value={source} onChange={setSource} options={[{ value: 'cable', label: 'Cable recto (Oersted)' }, { value: 'bobina', label: 'Bobina (electroimán)' }]} />
            {source === 'bobina' && <Slider label="Número de espiras" value={turns} min={EM_LIMITS.turns[0]} max={EM_LIMITS.turns[1]} step={10} unit="" decimals={0} onChange={setTurns} />}
            <Slider label="Corriente" value={current} min={EM_LIMITS.current[0]} max={EM_LIMITS.current[1]} step={0.1} unit="A" decimals={1} onChange={setCurrent} />
            <Slider label={source === 'cable' ? 'Distancia del cable a la brújula' : 'Distancia de la brújula al centro de la bobina'} value={dist} min={EM_LIMITS.distance[0]} max={EM_LIMITS.distance[1]} step={1} unit="cm" decimals={0} onChange={setDist} />
            <RecordButton onRecord={recordEm} label="Guardar la desviación en la tabla" />
            <Notice>Con un núcleo de hierro (una puntilla) dentro de la bobina el campo crece cientos de veces y el electroimán levanta clips; el modelo calcula solo la bobina sin núcleo.</Notice>
          </div>
        )}
      </div>
    </div>
  );
}
