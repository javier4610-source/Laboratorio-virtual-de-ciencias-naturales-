import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { leverScene, pulleyScene, type LeverSceneInput, type PulleySceneInput } from './machines3d';

/** «maquinas»: palanca o poleas en 3D con fuerzas, brazos y recorridos del mismo avance de la medición. */
export default function MaquinasView3D({ lever, pulley }: { lever: LeverSceneInput | null; pulley: PulleySceneInput | null }) {
  const scene = useMemo(() => (lever ? leverScene(lever) : pulley ? pulleyScene(pulley) : null), [lever, pulley]);
  if (!scene) return <p className="small">Ubica la carga y la fuerza según el género elegido para ver la palanca en 3D.</p>;
  return lever ? (
    <Scene3D idPrefix="maq3d" title="Palanca en 3D con sus fuerzas y brazos" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={330} initialOrbit={{ yaw: 0.35, pitch: 0.22 }} status="modelo"
      statusNote="Posiciones de la carga y del dinamómetro, giro de la barra y fuerzas R y F (con su sentido): las del modelo (equilibrio de momentos) con el mismo avance que el banco. Escala fija en cada montaje: la mayor fuerza mide 0,40 m." />
  ) : (
    <Scene3D idPrefix="maq3d" title="Poleas en 3D: cuerda jalada y subida de la carga" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.15 }} status="modelo"
      statusNote="Tramos que sostienen la carga, cuerda jalada s, subida h = s/n y fuerzas F y R: las del modelo con el mismo avance que el banco; s y h en metros reales. Escala fija en cada montaje: la mayor fuerza mide 0,40 m. Las poleas y la mano son dibujo." />
  );
}
