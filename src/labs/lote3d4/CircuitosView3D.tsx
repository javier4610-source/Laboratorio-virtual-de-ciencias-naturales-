import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { circuitScene, type CircuitSceneInput } from './circuits3d';
import { FlowControls, useFlowClock } from './flow';

/** «circuitos»: el circuito como paisaje de potencial en 3D, con los electrones que lo recorren. */
export default function CircuitosView3D({ topology, res, emf, closed, main }: Omit<CircuitSceneInput, 't'>) {
  const clock = useFlowClock();
  const scene = useMemo(() => circuitScene({ topology, res, emf, closed, main, t: clock.t }), [topology, res, emf, closed, main, clock.t]);
  return (
    <div>
      <FlowControls clock={clock} title="Electrones en la vista 3D" startLabel="Mover los electrones" still="los electrones se muestran quietos; la descripción dice la corriente de cada bombillo." />
      <Scene3D idPrefix="cir3d" title="Paisaje de potencial del circuito en 3D" items={scene.items} extent={scene.extent} target={scene.target}
        description={scene.description} height={340} initialOrbit={{ yaw: 0.35, pitch: 0.36 }} status="modelo"
        statusNote="Altura = potencial eléctrico del modelo respecto del polo − (escala fija: 1 V = 0,2 de alto); caídas de voltaje, corrientes y brillo: los del modelo con los mismos controles del banco. La rapidez de los electrones es proporcional a la corriente de cada tramo pero exagerada (0,25 A = 1 unidad por segundo). Formas: dibujo." />
    </div>
  );
}
