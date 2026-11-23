import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { useNarrow } from '../lote3d6/useNarrow';
import { decompositionScene, type DecompSceneInput } from './decomposition3d';

/** «descomposicion»: la compostera en corte con las bolsas, el termómetro y la bolsa que se pesa. */
export default function DescomposicionView3D(p: DecompSceneInput) {
  const { res, materialId, weeks, temperature, moisture, aerated, chopped, move, outOfPile, measured } = p;
  const scene = useMemo(() => decompositionScene({ res, materialId, weeks, temperature, moisture, aerated, chopped, move, outOfPile, measured }),
    [res, materialId, weeks, temperature, moisture, aerated, chopped, move, outOfPile, measured]);
  const frame = useNarrow() ? scene.narrow : scene;
  return (
    <Scene3D idPrefix="des3d" title="Compostera en corte con las bolsas de descomposición en 3D" items={scene.items} extent={frame.extent} target={frame.target}
      description={scene.description} height={330} initialOrbit={{ yaw: 0.3, pitch: 0.3 }} status="modelo"
      statusNote="Temperatura de la pila (color del termómetro y del centro con la escala fija de 20 °C azul a 100 °C rojo), masa seca que queda en la bolsa (un trozo por gramo, M = M₀·e^(−k·t)), hongos, lombrices y vapor: los del modelo con las condiciones del banco; la lectura de la balanza aparece cuando el banco termina de pesar. Dibujo: tablas, capas, color de la tierra según la humedad, lugar de cada trozo y formas." />
  );
}
