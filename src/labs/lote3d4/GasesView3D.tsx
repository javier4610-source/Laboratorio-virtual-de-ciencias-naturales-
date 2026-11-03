import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { gasScene, type GasSceneInput } from './gas3d';

/** «gases»: la jeringa en 3D como caja de partículas con émbolo. */
export default function GasesView3D({ law, volume, pressure, temperatureK, temperatureC, t }: GasSceneInput) {
  const scene = useMemo(() => gasScene({ law, volume, pressure, temperatureK, temperatureC, t }), [law, volume, pressure, temperatureK, temperatureC, t]);
  return (
    <Scene3D idPrefix="gas3d" title="Jeringa en 3D con las partículas del gas" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={320} initialOrbit={{ yaw: 0.4, pitch: 0.35 }} status="modelo"
      statusNote="Volumen (posición del émbolo), presión (flecha P: 300 kPa = 1,6 unidades) y temperatura: las del modelo con los mismos controles del banco. Las 40 partículas son un dibujo con rapidez ∝ √T; se mueven solo con «Animar las partículas» del laboratorio y se detienen en su pausa." />
  );
}
