import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { ropeScene, type RopeSceneInput } from './rope3d';

/** «ondas»: la cuerda en 3D con la regla y los marcadores A y B del banco. */
export default function OndasView3D(p: RopeSceneInput) {
  const { ropeId, ropeName, tension, frequency, amplitude, wavelength, speed, t, markA, markB, revealed } = p;
  const scene = useMemo(() => ropeScene({ ropeId, ropeName, tension, frequency, amplitude, wavelength, speed, t, markA, markB, revealed }),
    [ropeId, ropeName, tension, frequency, amplitude, wavelength, speed, t, markA, markB, revealed]);
  return (
    <Scene3D idPrefix="ond3d" title="Onda en la cuerda en 3D con la regla" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={320} initialOrbit={{ yaw: 0.55, pitch: 0.3 }} status="modelo"
      statusNote="Forma de la cuerda y(x, t) = A·sen 2π(x/λ − f·t) con λ = v/f y v = √(T/μ) del modelo, en el mismo instante que el banco (se mueve y se pausa con el generador). Largo en metros reales; el desplazamiento se dibuja ×20. Flecha v: 40 m/s = 3 m de dibujo. Generador, polea y pesas: dibujo." />
  );
}
