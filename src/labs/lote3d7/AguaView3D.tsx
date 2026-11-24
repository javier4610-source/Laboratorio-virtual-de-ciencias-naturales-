import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { useNarrow } from '../lote3d6/useNarrow';
import { waterScene, type WaterSceneInput } from './water3d';

/** «agua»: el tramo de río con el oxígeno disuelto del modelo en color y en altura, y el punto de muestreo. */
export default function AguaView3D(p: WaterSceneInput) {
  const { res, profile, distance, dischargeFlow, sourceId, measured, sampling, odReading } = p;
  const scene = useMemo(() => waterScene({ res, profile, distance, dischargeFlow, sourceId, measured, sampling, odReading }),
    [res, profile, distance, dischargeFlow, sourceId, measured, sampling, odReading]);
  const narrow = useNarrow();
  const frame = narrow ? scene.narrow : scene;
  return (
    <Scene3D idPrefix="agu3d" title="Tramo de río con el oxígeno disuelto en 3D" items={scene.items} extent={frame.extent} target={frame.target}
      description={scene.description} height={330} initialOrbit={narrow ? scene.narrow.orbit : { yaw: 0.12, pitch: 0.55 }} status="modelo"
      statusNote="Al medir: color de cada tramo de 0,5 km y altura de la cerca = oxígeno disuelto del modelo de Streeter–Phelps (escala fija: 0 mg/L rojo oscuro, 2 rojo, 4 naranja, 6 amarillo verdoso, 8 azul; 1 mg/L = 0,55 de altura), punto crítico del modelo, lectura de la sonda y familias del BMWP/Col en el punto de muestreo. Antes de medir no hay datos, como en el banco. Dibujo: forma del cauce, orillas y la pluma del vertimiento." />
  );
}
