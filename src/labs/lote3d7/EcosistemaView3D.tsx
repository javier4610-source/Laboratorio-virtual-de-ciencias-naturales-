import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { useNarrow } from '../lote3d6/useNarrow';
import { ecosystemScene, type EcoSceneInput } from './ecosystem3d';

/** «ecosistema»: el frasco cerrado en 3D con sus organismos y las flechas de luz, O₂ y CO₂ del día que se muestra. */
export default function EcosistemaView3D(p: EcoSceneInput) {
  const { vis, plants, snails, fish, decomposers, par, distance, lit, flakes, started, done, day, clock, gpp, respiration, decomposition, readings, readLabel } = p;
  const scene = useMemo(() => ecosystemScene({ vis, plants, snails, fish, decomposers, par, distance, lit, flakes, started, done, day, clock, gpp, respiration, decomposition, readings, readLabel }),
    [vis, plants, snails, fish, decomposers, par, distance, lit, flakes, started, done, day, clock, gpp, respiration, decomposition, readings, readLabel]);
  const frame = useNarrow() ? scene.narrow : scene;
  return (
    <Scene3D idPrefix="eco3d" title="Frasco cerrado con sus organismos en 3D" items={scene.items} extent={frame.extent} target={frame.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.32 }} status="modelo"
      statusNote="Organismos (ramitas y su tamaño, caracoles y guppys vivos o muertos, restos), color del agua y lámpara: los del estado del modelo que dibuja el banco en ese instante. Flechas del día que se muestra: O₂ de la fotosíntesis bruta, CO₂ de la respiración de plantas y animales y de los descomponedores, y luz en el vidrio; grosor ∝ √(valor del modelo) con una escala fija; los valores se leen al terminar la medición. Dibujo: formas, lugar de cada organismo, largo de las flechas y distancia de la lámpara (a escala reducida)." />
  );
}
