import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { mitosisScene } from './mitosis3d';

/** «mitosis», actividad del ciclo celular: la célula 3D en la etapa elegida con el deslizador o los botones de fase. */
export default function MitosisView3D({ t }: { t: number }) {
  const scene = useMemo(() => mitosisScene(t), [t]);
  return (
    <Scene3D idPrefix="mit3d" title="Célula en división en 3D: cromosomas y huso" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={360} initialOrbit={{ yaw: 0.9, pitch: 0.25 }} status="ilustracion"
      statusNote="Número de cromosomas, cromátidas por cromosoma, núcleos y ADN copiado: los del modelo del ciclo en el tiempo elegido; forma, tamaño y posición de los cromosomas son dibujo (los pares van de mayor a menor y cada par tiene un color)." />
  );
}
