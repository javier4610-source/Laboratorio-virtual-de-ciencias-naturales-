import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { collisionsScene, type CollisionsSceneInput } from './collisions3d';

/** «choques»: riel de aire 3D con los vectores de cantidad de movimiento antes, durante y después del choque. */
export default function ChoquesView3D({ res, st, pastContact, done, typeName }: CollisionsSceneInput) {
  const scene = useMemo(() => collisionsScene({ res, st, pastContact, done, typeName }), [res, st, pastContact, done, typeName]);
  return (
    <Scene3D idPrefix="cho3d" title="Riel de aire en 3D con la cantidad de movimiento de cada deslizador" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={330} initialOrbit={{ yaw: 0.3, pitch: 0.28 }} status="modelo"
      statusNote="Posiciones, velocidades y cantidad de movimiento (m·v): las del modelo en el mismo instante que el banco, también durante el contacto. Escala fija en cada ensayo: la mayor cantidad de movimiento del ensayo mide 0,45 m. La varilla gris marca el centro de masa." />
  );
}
