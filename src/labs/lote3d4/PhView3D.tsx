import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { phScene, type PhSceneInput } from './ph3d';

/** «ph»: iones H₃O⁺ y OH⁻ del vaso en escala logarítmica. */
export default function PhView3D({ pH, context, indicator }: PhSceneInput) {
  const scene = useMemo(() => phScene({ pH, context, indicator }), [pH, context, indicator]);
  return (
    <Scene3D idPrefix="ph3d" title="Vaso con los iones H₃O⁺ y OH⁻ en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={320} initialOrbit={{ yaw: 0.35, pitch: 0.3 }} status="modelo"
      statusNote="pH, [H₃O⁺] = 10^(−pH) y [OH⁻] = 10^(pH − 14): los del modelo con lo que muestra el banco. Escala LOGARÍTMICA (3 puntos por cada potencia de 10 desde 10⁻¹⁴ mol/L): en proporción real, a pH 1 habría 10¹² H₃O⁺ por cada OH⁻ y este no se vería. Posiciones y color del líquido: dibujo." />
  );
}
