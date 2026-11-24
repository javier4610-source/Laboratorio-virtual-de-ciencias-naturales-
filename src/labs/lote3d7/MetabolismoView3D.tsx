import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { useNarrow } from '../lote3d6/useNarrow';
import { metabolismScene, type MetabolismSceneInput } from './metabolism3d';

/** «metabolismo»: la red central de E. coli en una célula esquemática, con los flujos del FBA en grosor y en altura. */
export default function MetabolismoView3D(p: MetabolismSceneInput) {
  const { fluxes, computed, disabled, view, carbonLabel } = p;
  const scene = useMemo(() => metabolismScene({ fluxes, computed, disabled, view, carbonLabel }), [fluxes, computed, disabled, view, carbonLabel]);
  const frame = useNarrow() ? scene.narrow : scene;
  return (
    <Scene3D idPrefix="met3d" title="Célula de E. coli con los flujos del FBA en 3D" items={scene.items} extent={frame.extent} target={frame.target}
      description={scene.description} height={360} initialOrbit={{ yaw: 0.25, pitch: 0.75 }} status="modelo"
      statusNote="Flujos de la solución del FBA que muestra el mapa del banco (modelo e_coli_core): flecha en el sentido del flujo con grosor ∝ √|v| (la regla del banco) y columna con altura ∝ |v| en UNA sola escala lineal para todas las columnas (10 mmol/gDW/h = 2,5 unidades = una marca de la regla; tope en 40); las cinco reacciones de energía van en su grupo, detrás de la célula, con esa misma escala y la regla al lado; rojas, las apagadas por las eliminaciones; esfera de biomasa con μ. Dibujo: la célula, la membrana y la posición de los nodos (el diagrama del banco, no la ubicación real)." />
  );
}
