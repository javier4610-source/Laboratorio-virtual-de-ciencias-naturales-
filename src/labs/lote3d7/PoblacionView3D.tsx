import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { useNarrow } from '../lote3d6/useNarrow';
import { populationScene, type PopSceneInput } from './population3d';

/** «poblacion»: superficie del crecimiento neto según N y la pesca, con la captura sostenible y su máximo. */
export default function PoblacionView3D(p: PopSceneInput) {
  const { model, n0, r, k, h, years, res } = p;
  const scene = useMemo(() => populationScene({ model, n0, r, k, h, years, res }), [model, n0, r, k, h, years, res]);
  const frame = useNarrow() ? scene.narrow : scene;
  return (
    <Scene3D idPrefix="pob3d" title="Superficie del crecimiento y del rendimiento sostenible en 3D" items={scene.items} extent={frame.extent} target={frame.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.55, pitch: 0.45 }} status="modelo"
      statusNote="Altura de la malla = crecimiento neto dN/dt del modelo de la práctica para cada N y cada h; equilibrio N* y captura sostenible h·N* (postes; el máximo, buscando h cada 0,01) de simulatePopulation; trayectoria N(t) y N final: la corrida del banco. Escala fija por condición (N hasta 1,3·K, h hasta 1 por año, altura r·K/4 = 3,5 unidades; se recorta en +5 y en −2,5). Dibujo: la malla es un muestreo de 11 filas y 24 tramos." />
  );
}
