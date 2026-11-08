import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { opticsScene, type OpticsSceneInput } from './optics3d';

/** «optica»: los rayos incidente, reflejado y refractado en el plano de incidencia, en 3D. */
export default function OpticaView3D(p: OpticsSceneInput) {
  const { m1, m2, name1, name2, n1, n2, angle, refraction, reflectance, transmittance, measured, readReflection, readRefraction } = p;
  const scene = useMemo(() => opticsScene({ m1, m2, name1, name2, n1, n2, angle, refraction, reflectance, transmittance, measured, readReflection, readRefraction }),
    [m1, m2, name1, name2, n1, n2, angle, refraction, reflectance, transmittance, measured, readReflection, readRefraction]);
  return (
    <Scene3D idPrefix="opt3d" title="Rayos de luz y plano de incidencia en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.7, pitch: 0.28 }} status="modelo"
      statusNote="Direcciones de los rayos (reflexión = incidencia; refracción con la ley de Snell o reflexión total interna) y grosor de cada haz (fracciones de Fresnel): las del modelo con los mismos controles del banco. Ángulos rotulados con las lecturas del transportador, solo después de medir. Tamaño del bloque y del láser: dibujo." />
  );
}
