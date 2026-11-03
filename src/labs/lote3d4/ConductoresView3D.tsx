import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { conductorScene, type ConductorSceneInput } from './conductors3d';
import { FlowControls, useFlowClock } from './flow';

/** «conductores»: vista ampliada de la muestra con sus cargas libres o ligadas. */
export default function ConductoresView3D({ res, closed, glow }: Omit<ConductorSceneInput, 't'>) {
  const clock = useFlowClock();
  const scene = useMemo(() => conductorScene({ res, closed, glow, t: clock.t }), [res, closed, glow, clock.t]);
  return (
    <div>
      <FlowControls clock={clock} title="Cargas en la vista 3D" startLabel="Mover las cargas" still="las cargas se muestran quietas; la descripción dice si avanzan y hacia dónde." />
      <Scene3D idPrefix="con3d" title="Vista ampliada de la muestra con sus cargas" items={scene.items} extent={scene.extent} target={scene.target}
        description={scene.description} height={330} initialOrbit={{ yaw: 0.3, pitch: 0.38 }} status="modelo"
        statusNote="Clasificación, corriente (I/I_cc) y brillo: los del modelo con la misma muestra y las mismas pilas del banco; las cargas solo avanzan con el circuito cerrado y con una rapidez proporcional a esa corriente (exagerada). La red, el número de cargas y su tamaño son un dibujo." />
    </div>
  );
}
