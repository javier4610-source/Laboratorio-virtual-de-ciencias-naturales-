import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { kineticsScene, type KineticsSceneInput } from './kinetics3d';

/** «cinetica»: partículas que chocan, gas producido y barrera de energía en 3D. */
export default function CineticaView3D(p: KineticsSceneInput) {
  const { marble, concentration, temperature, particle, catalyst, ea, eaUncatalyzed, rateConstant, simT, volume, remaining, speedUp } = p;
  const scene = useMemo(() => kineticsScene({ marble, concentration, temperature, particle, catalyst, ea, eaUncatalyzed, rateConstant, simT, volume, remaining, speedUp }),
    [marble, concentration, temperature, particle, catalyst, ea, eaUncatalyzed, rateConstant, simT, volume, remaining, speedUp]);
  return (
    <Scene3D idPrefix="cin3d" title="Choques de las partículas y gas producido en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.3 }} status="modelo"
      statusNote="Volumen de gas (1 punto = 1 mL), sólido que queda, Eₐ y temperatura: los del modelo en el mismo instante del cronómetro; la barrera mide Eₐ a escala fija (80 kJ/mol = 1,2 unidades). El número de partículas (∝ concentración), su rapidez (∝ √T) y la altura de los productos en el perfil son un dibujo." />
  );
}
