import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { mixturesScene, PER_G, type MixturesSceneInput } from './mixtures3d';

/** «mezclas»: el vaso con la mezcla y cada fracción separada en la herramienta de su técnica, en 3D. */
export default function MezclasView3D({ state, last }: MixturesSceneInput) {
  const scene = useMemo(() => mixturesScene({ state, last }), [state, last]);
  return (
    <Scene3D idPrefix="mez3d" title="Montaje de separación de mezclas en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.38 }} status="modelo"
      statusNote={`Dónde queda cada componente y cuánto (${PER_G} partículas por gramo): lo que dice el modelo con los métodos que aplicaste, en el mismo orden del banco; la sal se disuelve, lo que flota queda arriba y lo que se hunde, abajo. Dibujo: formas de las herramientas, altura de las capas y posición de cada partícula.`} />
  );
}
