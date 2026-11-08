import { useMemo, useState } from 'react';
import { Select } from '../../components/ui';
import { RODS, findRod, simulateConduction, type CoverId, type RodId, type RodSolution } from '../../models/conduction';
import { Scene3D } from '../../three';
import { conductionScene, type ConductionSceneInput } from './conduction3d';

type Props = Omit<ConductionSceneInput, 'main' | 'compare'> & { rodId: RodId; rodShort: string; solution: RodSolution; cover: CoverId };

/** «conduccion»: la varilla con su mapa de color de temperatura y, si se elige, otra varilla al lado para comparar. */
export default function ConduccionView3D({ rodId, rodShort, solution, cover, bathT, simT, indicator, nTacks, probes, lcd, started, done }: Props) {
  const [cmpId, setCmpId] = useState<RodId | 'ninguna'>('ninguna');
  // La comparación es otra corrida del MISMO modelo con el mismo baño y la misma funda.
  const cmpRun = useMemo(() => (cmpId === 'ninguna' || cmpId === rodId ? null : { short: findRod(cmpId).short, solution: simulateConduction({ rod: cmpId, cover, bathT }).solution }), [cmpId, rodId, cover, bathT]);
  const scene = useMemo(() => conductionScene({ main: { short: rodShort, solution }, compare: cmpRun, cover, bathT, simT, indicator, nTacks, probes, lcd, started, done }),
    [rodShort, solution, cmpRun, cover, bathT, simT, indicator, nTacks, probes, lcd, started, done]);
  return (
    <div>
      <div style={{ maxWidth: 360, marginBottom: 8 }}>
        <Select label="Comparar con otra varilla (vista 3D)" value={cmpId} onChange={(v) => setCmpId(v as RodId | 'ninguna')}
          options={[{ value: 'ninguna', label: 'Sin comparación' }, ...RODS.filter((r) => r.id !== rodId).map((r) => ({ value: r.id, label: r.short }))]}
          hint="Otra varilla con el mismo baño, la misma funda y el mismo tiempo." />
      </div>
      <Scene3D idPrefix="con3d" title="Varilla con su mapa de temperatura en 3D" items={scene.items} extent={scene.extent} target={scene.target}
        description={scene.description} height={340} initialOrbit={{ yaw: 0.25, pitch: 0.42 }} status="modelo"
        statusNote="Color de cada centímetro = temperatura del modelo (ecuación de la aleta) en el mismo instante del banco, con una escala fija (20 °C azul, 40 °C turquesa, 55 °C amarillo, 75 °C naranja, 100 °C rojo); caída de las tachuelas y lecturas de los termopares: las del banco. La varilla de comparación es otra corrida del mismo modelo. Dibujo: grosor de la varilla (×1,5), baño, mechero y formas." />
    </div>
  );
}
