import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { kpScene, type KpSceneInput } from './kp3d';

const TITLES = { cinetica: 'Riel de aire en 3D con barras de energía', gravitatoria: 'Torre de caída en 3D con barras de energía', elastica: 'Resorte y carrito en 3D con barras de energía' } as const;

/** «cinetica-potencial»: la estación elegida en 3D con el objeto, la fotopuerta y las barras de energía del banco. */
export default function CineticaPotencialView3D(props: KpSceneInput) {
  const { station, position, objY, height, v, vMax, ep, ek, heat, total, compression, caption, massKg } = props;
  const scene = useMemo(() => kpScene({ station, position, objY, height, v, vMax, ep, ek, heat, total, compression, caption, massKg }),
    [station, position, objY, height, v, vMax, ep, ek, heat, total, compression, caption, massKg]);
  return (
    <Scene3D idPrefix="ecp3d" title={TITLES[station]} items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.4, pitch: 0.22 }} status="modelo"
      statusNote="Posición, rapidez y energías (Ep, Ec y disipada): las del modelo en el mismo instante que el banco, con las mismas barras. Escalas fijas en cada corrida: la energía de la corrida llena la columna y la mayor rapidez posible mide lo mismo. Carrito, objeto y fotopuerta no están a escala." />
  );
}
