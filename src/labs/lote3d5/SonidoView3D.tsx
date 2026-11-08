import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { FlowControls, useFlowClock } from '../lote3d4/flow';
import { useEnvelope } from '../soundEnvelope';
import { soundScene, type SoundSceneInput } from './sound3d';

type Props = Omit<SoundSceneInput, 't' | 'env'> & { strikeAt: number | null; genOn: boolean };

/** «sonido»: el tubo de resonancia en 3D con las capas de aire y la presión coloreada. */
export default function SonidoView3D({ strikeAt, genOn, type, lengthCm, diameterCm, k, endCm, response, f, tempC, source }: Props) {
  const clock = useFlowClock();
  // La misma envolvente en vivo que el banco: el aire se mueve mientras suena la fuente.
  const env = useEnvelope(strikeAt, genOn);
  const scene = useMemo(() => soundScene({ type, lengthCm, diameterCm, k, endCm, response, env, f, tempC, source, t: clock.t }),
    [type, lengthCm, diameterCm, k, endCm, response, env, f, tempC, source, clock.t]);
  return (
    <div>
      <FlowControls clock={clock} title="Aire en la vista 3D" startLabel="Mover el aire" still="las capas de aire se muestran en su desplazamiento máximo; la descripción dice dónde están los nodos y los vientres." />
      <Scene3D idPrefix="son3d" title="Tubo de resonancia en 3D con las capas de aire" items={scene.items} extent={scene.extent} target={scene.target}
        description={scene.description} height={360} initialOrbit={{ yaw: 0.35, pitch: 0.18 }} status="modelo"
        statusNote="Forma de la onda estacionaria (con el número de onda k y la corrección de extremo del modelo), nodos, vientres y amplitud relativa: los del banco (refuerzo del tubo × fuente en vivo). La presión es la pendiente del desplazamiento. Dibujo: el desplazamiento máximo mide 1,5 cm, el diámetro del tubo está ampliado y el aire vibra 1 vez por segundo con «Mover el aire» (el real, cientos de veces)." />
    </div>
  );
}
