import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { heatScene, type HeatSceneInput } from './heat3d';

/** «calor»: el calorímetro en 3D con partículas que se agitan según la temperatura y la flecha de calor. */
export default function CalorView3D(p: HeatSceneInput) {
  const { isMetal, metalName, metalColor, density, container, sampleMass, waterMass, transfer, simT, poured, sampleT, waterT, toWater, toAir, G, L, sampleTemp0, waterTemp0, ambient, lcd, clock, done } = p;
  const scene = useMemo(() => heatScene({ isMetal, metalName, metalColor, density, container, sampleMass, waterMass, transfer, simT, poured, sampleT, waterT, toWater, toAir, G, L, sampleTemp0, waterTemp0, ambient, lcd, clock, done }),
    [isMetal, metalName, metalColor, density, container, sampleMass, waterMass, transfer, simT, poured, sampleT, waterT, toWater, toAir, G, L, sampleTemp0, waterTemp0, ambient, lcd, clock, done]);
  return (
    <Scene3D idPrefix="cal3d" title="Calorímetro con partículas en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.3 }} status="modelo"
      statusNote="Temperaturas de la muestra y del agua, flujo de calor entre ellas y hacia el aire: los del modelo en el mismo instante del banco (la flecha roja mide 4 cm con el flujo inicial; se acorta y desaparece en el equilibrio). Cada partícula se agita con amplitud ∝ √T absoluta (entre 20 y 60 °C solo un 7 % más) y su color sigue la escala fija de 20 °C azul a 100 °C rojo (40 °C turquesa, 55 °C amarillo, 75 °C naranja). Se mueven solo mientras corre el registro. Dibujo: número de partículas, ritmo de la oscilación y formas." />
  );
}
