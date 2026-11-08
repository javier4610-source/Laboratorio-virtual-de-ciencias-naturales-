import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { motionScene, type MotionSceneInput } from './motion3d';

/** «movimiento»: la pista en 3D con el móvil, su camino recorrido y su desplazamiento. */
export default function MovimientoView3D({ lanes, start, finish, tape, trip, isRace, gates, phase }: MotionSceneInput) {
  const scene = useMemo(() => motionScene({ lanes, start, finish, tape, trip, isRace, gates, phase }), [lanes, start, finish, tape, trip, isRace, gates, phase]);
  return (
    <Scene3D idPrefix="mov3d" title="Pista con el móvil, el camino y el desplazamiento en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={320} initialOrbit={{ yaw: 0, pitch: 0.95, zoom: 1.15 }} status="modelo"
      statusNote="Posición del móvil: la del banco en el mismo instante (modelo s = v·t, o con frenado para el balón); camino recorrido y desplazamiento a escala real (metros), con el cono, la bandera, la cinta y las fotopuertas donde los pusiste. Dibujo: la bicicleta, el balón y el carrito están ampliados; formas y colores." />
  );
}
