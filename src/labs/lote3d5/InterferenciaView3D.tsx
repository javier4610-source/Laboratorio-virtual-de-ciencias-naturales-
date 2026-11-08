import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { FlowControls, useFlowClock } from '../lote3d4/flow';
import { interferenceScene, type InterferenceSceneInput } from './interference3d';

/** «interferencia»: el banco óptico en 3D con las ondas de cada rendija y el patrón del modelo en la pantalla. */
export default function InterferenciaView3D({ on, kind, kindName, source, ap, L_cm, half_mm, viewName, exposure }: Omit<InterferenceSceneInput, 't'>) {
  const clock = useFlowClock();
  const scene = useMemo(() => interferenceScene({ on, kind, kindName, source, ap, L_cm, half_mm, viewName, exposure, t: clock.t }),
    [on, kind, kindName, source, ap, L_cm, half_mm, viewName, exposure, clock.t]);
  return (
    <div>
      <FlowControls clock={clock} title="Ondas en la vista 3D" startLabel="Mover las ondas" still="las crestas se muestran quietas; la pantalla tiene el patrón del modelo." />
      <Scene3D idPrefix="int3d" title="Banco óptico de interferencia en 3D" items={scene.items} extent={scene.extent} target={scene.target}
        description={scene.description} height={340} initialOrbit={{ yaw: -0.6, pitch: 0.28 }} status="modelo"
        statusNote="Patrón de la pantalla: el del modelo (intensidad de la rendija, la doble rendija, la red o el agujero, con la misma exposición del banco), ampliado en la ventana de la vista frontal (±15, ±60 o ±400 mm); por eso la separación de las franjas es λ·L/d. Posición de la pantalla: la distancia L del riel (1 unidad = 20 cm). Crestas: dibujo con λ y separación de rendijas sin escala." />
    </div>
  );
}
