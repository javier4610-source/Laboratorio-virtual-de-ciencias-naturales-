import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { useNarrow } from './useNarrow';
import { kinematicsScene, type KinematicsSceneInput } from './kinematics3d';

/** «cinematica»: la ciclorruta en 3D con el ciclista, sus vectores v y a, las fotos y la pared x–t. */
export default function CinematicaView3D(p: KinematicsSceneInput) {
  const { x, v, t, acceleration, vMax, strobe, curve, target, tMax, stopped, atEnd, started, running, done, finalSpeed, distance, time } = p;
  const scene = useMemo(() => kinematicsScene({ x, v, t, acceleration, vMax, strobe, curve, target, tMax, stopped, atEnd, started, running, done, finalSpeed, distance, time }),
    [x, v, t, acceleration, vMax, strobe, curve, target, tMax, stopped, atEnd, started, running, done, finalSpeed, distance, time]);
  const frame = useNarrow() ? scene.narrow : scene;
  return (
    <Scene3D idPrefix="cin3d" title="Ciclorruta con vectores y pared posición–tiempo en 3D" items={scene.items} extent={frame.extent} target={frame.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.32 }} status="modelo"
      statusNote="Posición y velocidad del ciclista: las del modelo (x = v₀·t + ½·a·t², v = v₀ + a·t, sin retroceder) en el mismo instante del banco; fotos cada 0,5 s y curva x–t: las del banco. Escalas fijas: la mayor rapidez del recorrido mide 6 m de flecha y 3 m/s² miden 3 m; la pared mide 8 m de alto para la duración del gráfico. Dibujo: la bicicleta y los colores." />
  );
}
