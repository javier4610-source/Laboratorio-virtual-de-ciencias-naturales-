import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { feScene, no2Scene, type FeSceneInput, type No2SceneInput } from './equilibrium3d';

/** «equilibrio»: partículas de reactivos y productos en las proporciones del equilibrio del modelo. */
export default function EquilibrioView3D({ fe, no2 }: { fe?: FeSceneInput; no2?: No2SceneInput }) {
  const scene = useMemo(() => (fe ? feScene(fe) : no2 ? no2Scene(no2) : null), [fe, no2]);
  if (!scene) return null;
  return fe ? (
    <Scene3D idPrefix="equ3d" title="Tubo de ensayo en 3D con los iones del equilibrio" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.25 }} status="modelo"
      statusNote="Cantidades de Fe³⁺, SCN⁻, FeSCN²⁺ y AgSCN (1 punto = 1 µmol en el tubo), volumen y color: los del modelo con lo que muestra el banco en ese instante (la respuesta tras una perturbación es una relajación ilustrativa). Las posiciones de los puntos son un dibujo." />
  ) : (
    <Scene3D idPrefix="equ3d" title="Jeringa en 3D con las moléculas de NO₂ y N₂O₄" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={320} initialOrbit={{ yaw: 0.35, pitch: 0.3 }} status="modelo"
      statusNote="Moléculas de NO₂ y N₂O₄ (1 = 0,05 mmol, la misma cuenta del banco), volumen y tinte del gas: los del modelo con lo que muestra el banco en ese instante (la respuesta tras un cambio es una relajación ilustrativa). Las posiciones son un dibujo." />
  );
}
