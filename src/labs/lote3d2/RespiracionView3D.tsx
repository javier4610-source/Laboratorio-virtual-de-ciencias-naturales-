import { useMemo, useState } from 'react';
import { Scene3D } from '../../three';
import { partFromId, partInfo, respirationScene, type MitoPart, type RespSceneInput } from './respiration3d';

const SEL_ID: Record<MitoPart, string> = { glucolisis: 'glucolisis', krebs: 'krebs', cadena: 'cadena-0' };

/** «respiracion»: mitocondria 3D con crestas elegibles, sincronizada con el respirómetro y con el balance de ATP. */
export default function RespiracionView3D(props: Omit<RespSceneInput, 'selected'>) {
  const [selected, setSelected] = useState<MitoPart | null>(null);
  const { atmosphere, alive, substrate, sampleName, vO2, vCO2, progress, accounting, shuttle } = props;
  const scene = useMemo(() => respirationScene({ atmosphere, alive, substrate, sampleName, vO2, vCO2, progress, accounting, shuttle, selected }),
    [atmosphere, alive, substrate, sampleName, vO2, vCO2, progress, accounting, shuttle, selected]);
  return (
    <Scene3D idPrefix="res3d" title="Mitocondria en 3D: dónde ocurre cada etapa de la respiración" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.3 }} status="ilustracion"
      selectedId={selected ? SEL_ID[selected] : null} onSelect={(id) => setSelected(partFromId(id))}
      statusNote="O₂ y CO₂: los del modelo del respirómetro, acumulados con el avance de la medición (cada esfera vale lo mismo en la corrida). ATP por etapa: la tabla de la práctica con la contabilidad elegida. La mitocondria es un dibujo (no está a escala).">
      <p className="small" aria-live="polite" style={{ margin: '8px 0 0' }}>
        {selected ? partInfo(selected, { accounting, shuttle, substrate, atmosphere }) : 'Elige la glucólisis, la matriz o las crestas (en la escena o en la lista de elementos) para ver qué ocurre allí y cuánto ATP aporta.'}
      </p>
    </Scene3D>
  );
}
