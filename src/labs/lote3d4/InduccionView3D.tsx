import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { inductionScene, type InductionSceneInput } from './induction3d';

/** «induccion»: imán, bobina, líneas de campo y corriente inducida en 3D (ley de Faraday). */
export default function InduccionView3D({ magnet, pole, turns, xm, emfMv, linkage, moving }: InductionSceneInput) {
  const scene = useMemo(() => inductionScene({ magnet, pole, turns, xm, emfMv, linkage, moving }), [magnet, pole, turns, xm, emfMv, linkage, moving]);
  return (
    <Scene3D idPrefix="ind3d" title="Imán, bobina y líneas de campo en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.45, pitch: 0.3 }} status="modelo"
      statusNote="Posición del imán, flujo enlazado y fem (aguja y flechas de la corriente inducida): los del modelo en el mismo instante que el banco; las flechas de la corriente miden la fem a escala fija (1000 mV = 2,2 cm). Líneas de campo del dipolo con 1/r₀ igualmente espaciados: las que cruzan la espira central son proporcionales a su flujo. Tamaños en centímetros reales; la forma del galvanómetro es dibujo." />
  );
}
