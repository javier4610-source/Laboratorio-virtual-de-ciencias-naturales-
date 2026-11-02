import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { workScene, type WorkSceneInput } from './work3d';

/** «trabajo»: plano inclinado 3D con fuerzas, desplazamiento y el área «fuerza × distancia». */
export default function TrabajoView3D({ ramp, slots, surfaceName, motion, phase, drive }: WorkSceneInput) {
  const scene = useMemo(() => workScene({ ramp, slots, surfaceName, motion, phase, drive }), [ramp, slots, surfaceName, motion, phase, drive]);
  return (
    <Scene3D idPrefix="trb3d" title="Plano inclinado en 3D con fuerzas, desplazamiento y trabajo" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.45, pitch: 0.42 }} status="modelo"
      statusNote="Ángulo, fuerzas (F = m·g·(sen θ + μ·cos θ), N, P y f), recorrido y altura: los del modelo con el mismo avance que el banco. Escala fija: 12 N = 0,40 m. Los rectángulos de atrás tienen de ancho la distancia (m) y de alto la fuerza con esa misma escala: su área es proporcional al trabajo." />
  );
}
