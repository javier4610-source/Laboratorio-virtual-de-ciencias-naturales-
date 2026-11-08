import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { buoyancyScene, type BuoyancySceneInput } from './buoyancy3d';

/** «flotacion»: el objeto en el líquido con la línea de flotación, las fuerzas y el densímetro, en 3D. */
export default function FlotacionView3D(p: BuoyancySceneInput) {
  const { obj, liquidName, liquidColor, liquidOpacity, rhoLiq, setup, volume, descent, depth, vSub, fraction, weight, buoyancy, apparent, floating, submerged, levelRise, stemDepth, done } = p;
  const scene = useMemo(() => buoyancyScene({ obj, liquidName, liquidColor, liquidOpacity, rhoLiq, setup, volume, descent, depth, vSub, fraction, weight, buoyancy, apparent, floating, submerged, levelRise, stemDepth, done }),
    [obj, liquidName, liquidColor, liquidOpacity, rhoLiq, setup, volume, descent, depth, vSub, fraction, weight, buoyancy, apparent, floating, submerged, levelRise, stemDepth, done]);
  return (
    <Scene3D idPrefix="flo3d" title="Objeto en el líquido con peso, empuje y densímetro en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.45, pitch: 0.22 }} status="modelo"
      statusNote="Profundidad del objeto, línea de flotación, subida del nivel, volumen desalojado, peso, empuje y tensión (1 N = 3 cm) y tallo hundido del densímetro: los del modelo con los mismos controles del banco. Centímetros reales; resorte, soporte y formas: dibujo." />
  );
}
