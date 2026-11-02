import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { energyScene, type EnergySceneInput } from './energy3d';

/** «energia»: pista con colinas en 3D con la esfera y las barras de Ep, Ec y energía disipada del mismo punto. */
export default function EnergiaView3D({ h0, hc, point, total, passesHill, stopX, done, mass, rolling }: EnergySceneInput) {
  const scene = useMemo(() => energyScene({ h0, hc, point, total, passesHill, stopX, done, mass, rolling }), [h0, hc, point, total, passesHill, stopX, done, mass, rolling]);
  return (
    <Scene3D idPrefix="ene3d" title="Pista con colinas en 3D y barras de energía" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.25 }} status="modelo"
      statusNote="Forma de la pista (en metros), posición y rapidez de la esfera y energías: las del modelo en el mismo punto que el banco. Las barras tienen una escala fija en cada recorrido: la energía total mide 1,2 m. La esfera se dibuja más grande para que se vea." />
  );
}
