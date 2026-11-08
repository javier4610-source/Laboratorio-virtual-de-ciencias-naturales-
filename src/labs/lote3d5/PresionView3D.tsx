import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { jetsScene, probeScene, type JetsSceneInput, type ProbeSceneInput } from './pressure3d';

type Props = { exp: 'sonda'; probe: ProbeSceneInput } | { exp: 'chorros'; jets: JetsSceneInput };

/** «presion»: el tanque con la sonda y el manómetro, o la botella con sus chorros, en 3D. */
export default function PresionView3D(props: Props) {
  const probe = props.exp === 'sonda' ? props.probe : null;
  const jets = props.exp === 'chorros' ? props.jets : null;
  const scene = useMemo(() => (probe ? probeScene(probe) : jetsScene(jets!)), [probe, jets]);
  return probe ? (
    <Scene3D idPrefix="pre3d" title="Tanque con la sonda y manómetro en U en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.45, pitch: 0.25 }} status="modelo"
      statusNote="Color de cada capa = presión manométrica ρ·g·h del modelo (escala fija: 0 Pa claro, 4000 Pa oscuro); flecha p sobre la membrana: la presión del modelo (4000 Pa = 6 cm); desnivel del manómetro: el que muestra el banco, a escala real. Medidas del tanque en centímetros; formas: dibujo." />
  ) : (
    <Scene3D idPrefix="pre3d" title="Botella con agujeros y chorros en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.25 }} status="modelo"
      statusNote="Color de cada capa y flechas p = presión manométrica ρ·g·h del modelo (0 Pa claro, 4000 Pa oscuro; 4000 Pa = 6 cm). Chorros: la trayectoria del modelo (salida horizontal con v = C_v·√(2gh), caída en t = √(2y/g)) hasta el alcance del modelo, con el mismo avance que el banco. Centímetros reales; formas: dibujo." />
  );
}
