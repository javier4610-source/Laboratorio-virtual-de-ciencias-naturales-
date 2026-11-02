import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { newtonScene, type NewtonSceneInput } from './newton3d';

/** «newton»: carrito en la pista con su diagrama de cuerpo libre 3D y la aceleración, sincronizado con el banco. */
export default function NewtonView3D(props: NewtonSceneInput) {
  const { mass, force, surfaceId, surfaceName, moves, weight, normal, friction, netForce, acceleration, x, t, running, done } = props;
  const scene = useMemo(() => newtonScene({ mass, force, surfaceId, surfaceName, moves, weight, normal, friction, netForce, acceleration, x, t, running, done }),
    [mass, force, surfaceId, surfaceName, moves, weight, normal, friction, netForce, acceleration, x, t, running, done]);
  return (
    <Scene3D idPrefix="nwt3d" title="Carrito en 3D con su diagrama de cuerpo libre" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.4, pitch: 0.2 }} status="modelo"
      statusNote="Fuerzas, aceleración y posición del carrito: las del modelo (a = F neta / m, x = ½·a·t²) en el mismo instante que el banco. Escalas fijas: 10 N = 0,30 m de flecha y 10 m/s² = 0,20 m (la aceleración se recorta a 40 m/s² y se avisa). Las pesas y las fotopuertas son dibujo." />
  );
}
