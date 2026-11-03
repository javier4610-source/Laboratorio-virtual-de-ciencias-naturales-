import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { FlowControls, useFlowClock } from './flow';
import { simpleCircuitScene, type SimpleCircuitSceneInput } from './simpleCircuits3d';

/** «circuitos-simples»: la mesa de bornes en 3D con los electrones que recorren el circuito. */
export default function CircuitosSimplesView3D({ netlist, res, wireColor }: Omit<SimpleCircuitSceneInput, 't'>) {
  const clock = useFlowClock();
  const scene = useMemo(() => simpleCircuitScene({ netlist, res, wireColor, t: clock.t }), [netlist, res, wireColor, clock.t]);
  return (
    <div>
      <FlowControls clock={clock} title="Electrones en la vista 3D" startLabel="Mover los electrones" still="los electrones se muestran quietos; la descripción dice hacia dónde van y con qué corriente." />
      <Scene3D idPrefix="csi3d" title="Mesa de bornes en 3D con los electrones del circuito" items={scene.items} extent={scene.extent} target={scene.target}
        description={scene.description} height={340} initialOrbit={{ yaw: 0.25, pitch: 0.8 }} status="modelo"
        statusNote="Piezas, conexiones, brillo (P/Pₙ) y corriente de cada tramo: los del modelo con la misma mesa del banco. La rapidez de los electrones está exagerada muchísimo (0,3 A = 1 casilla por segundo; la real es de fracciones de milímetro por segundo), pero es proporcional a la corriente de cada tramo. Formas de las piezas: dibujo." />
    </div>
  );
}
