import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { useNarrow } from './useNarrow';
import { selectionScene, type SelectionSceneInput } from './selection3d';

/** «seleccion»: el suelo con los escarabajos visto desde el ave, con cuántos hay de cada color y cuántos escaparían. */
export default function SeleccionView3D({ backgroundName, B, mean, sample, positions, predation, generation, measured }: SelectionSceneInput) {
  const scene = useMemo(() => selectionScene({ backgroundName, B, mean, sample, positions, predation, generation, measured }),
    [backgroundName, B, mean, sample, positions, predation, generation, measured]);
  const frame = useNarrow() ? scene.narrow : scene;
  return (
    <Scene3D idPrefix="sel3d" title="Suelo con escarabajos visto desde el ave en 3D" items={scene.items} extent={frame.extent} target={frame.target}
      description={scene.description} height={340} initialOrbit={{ yaw: -0.75, pitch: 0.62 }} status="modelo"
      statusNote="Color del suelo, color de cada escarabajo y número por clase de color: la misma muestra de 40 del banco (cuantiles de la población del modelo) en la misma generación. Columnas interiores: n·s(z), la supervivencia del modelo frente a las aves en el centro de cada clase (aparecen después de la primera ronda). Dibujo: formas, tamaño del terreno y 1 escarabajo = 0,5 de alto en las columnas." />
  );
}
