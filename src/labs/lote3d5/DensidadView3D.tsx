import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { densityScene, type DensitySceneInput } from './density3d';

/** «densidad»: la balanza, la probeta a escala y cubos de igual masa, en 3D. */
export default function DensidadView3D(p: DensitySceneInput) {
  const { material, side, station, weighed, massReading, level, overflow, floats, pushUnder, submergedFraction, initialWater } = p;
  const scene = useMemo(() => densityScene({ material, side, station, weighed, massReading, level, overflow, floats, pushUnder, submergedFraction, initialWater }),
    [material, side, station, weighed, massReading, level, overflow, floats, pushUnder, submergedFraction, initialWater]);
  return (
    <Scene3D idPrefix="den3d" title="Balanza, probeta y cubos de igual masa en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={330} initialOrbit={{ yaw: 0.3, pitch: 0.42 }} status="modelo"
      statusNote="Arista del cubo, lugar de la muestra, lectura de la balanza, nivel de la probeta y fracción sumergida: los del banco y su modelo. La probeta está a escala en volumen (1 mL = 1 cm³). Los cubos de atrás tienen 50 g cada uno (masa elegida para el dibujo) y arista ∛(50 g/ρ) con las densidades de la tabla." />
  );
}
