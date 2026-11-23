import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { useNarrow } from '../lote3d6/useNarrow';
import { inquiryScene, type InquirySceneInput } from './inquiry3d';

/** «reto»: dispersión 3D de x, la variable de confusión y la respuesta, con las sombras de las dos gráficas. */
export default function RetoView3D(p: InquirySceneInput) {
  const { sys, samples, shown, confound, analysis, seed } = p;
  const scene = useMemo(() => inquiryScene({ sys, samples, shown, confound, analysis, seed }), [sys, samples, shown, confound, analysis, seed]);
  const frame = useNarrow() ? scene.narrow : scene;
  return (
    <Scene3D idPrefix="ret3d" title="Dispersión 3D de la variable independiente, la de confusión y la respuesta" items={scene.items} extent={frame.extent} target={frame.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.6, pitch: 0.35 }} status="modelo"
      statusNote="Cada punto es una muestra sintética del banco (x, variable de confusión registrada y lectura y con ruido), en el mismo orden de recolección; la recta y las correlaciones son las del análisis del banco al terminar. Ejes fijados con todas las muestras de la campaña. Dibujo: paredes, postes, sombras y colores por tercios." />
  );
}
