import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { photoScene, type PhotoSceneInput } from './photo3d';

/** «fotosintesis»: cloroplasto 3D con flechas de luz, CO₂ y O₂ del modelo y burbujas al ritmo del banco. */
export default function FotosintesisView3D({ res, lampOn, color, phase, counted }: PhotoSceneInput) {
  const { effectiveLight, gross, net, bubblesPerMin, limiting } = res;
  const scene = useMemo(() => photoScene({ res: { effectiveLight, gross, net, bubblesPerMin, limiting }, lampOn, color, phase, counted }),
    [effectiveLight, gross, net, bubblesPerMin, limiting, lampOn, color, phase, counted]);
  return (
    <Scene3D idPrefix="fot3d" title="Cloroplasto en 3D con la luz, el CO₂ y el O₂" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.45, pitch: 0.28 }} status="ilustracion"
      statusNote="Largo de las flechas: luz efectiva, fotosíntesis bruta (CO₂) y neta (O₂) del modelo, con escalas fijas (la mayor luz y la mayor tasa posibles en la práctica). Las burbujas siguen la animación del banco. El cloroplasto es un dibujo: no está a escala y la planta tiene muchos." />
  );
}
