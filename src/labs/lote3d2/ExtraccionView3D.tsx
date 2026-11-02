import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { tubeScene, type TubeInput } from './extraction3d';

/** «extraccion-adn», actividad de extracción: el tubo 3D con las capas y el ADN precipitado según la etapa del montaje. */
export default function ExtraccionView3D(props: TubeInput) {
  const { stage, yieldIndex, filtrate, ethanol, fruitName, ethanolT, stageText, appearance } = props;
  const scene = useMemo(() => tubeScene({ stage, yieldIndex, filtrate, ethanol, fruitName, ethanolT, stageText, appearance }),
    [stage, yieldIndex, filtrate, ethanol, fruitName, ethanolT, stageText, appearance]);
  return (
    <Scene3D idPrefix="xad3d" title="Tubo de ensayo 3D con las capas y el ADN precipitado" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={360} initialOrbit={{ yaw: 0.35, pitch: 0.2 }} status="ilustracion"
      statusNote="Dibujo del tubo según la etapa del montaje; la altura de las capas es la del banco 2D y la cantidad de hebras crece con el índice de rendimiento del modelo calculado (√índice, como el precipitado del banco). La forma de las fibras es ilustrativa: cada hebra visible tiene millones de moléculas de ADN." />
  );
}
