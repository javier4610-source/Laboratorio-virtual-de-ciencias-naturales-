import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { projectileScene, type ProjectileSceneInput } from './projectile3d';

/** «proyectiles»: el lanzamiento en 3D con la trayectoria, la sombra y los vectores v, vx y vy del mismo instante. */
export default function ProyectilesView3D(props: ProjectileSceneInput) {
  const { path, strobe, flightTime, t, fired, landed, measured, v0, angle, height, g, air, spanX, spanY, sphereName, sphereColor, sphereDiameter, target, rangeReading, idealPath } = props;
  const scene = useMemo(() => projectileScene({ path, strobe, flightTime, t, fired, landed, measured, v0, angle, height, g, air, spanX, spanY, sphereName, sphereColor, sphereDiameter, target, rangeReading, idealPath }),
    [path, strobe, flightTime, t, fired, landed, measured, v0, angle, height, g, air, spanX, spanY, sphereName, sphereColor, sphereDiameter, target, rangeReading, idealPath]);
  return (
    <Scene3D idPrefix="pry3d" title="Lanzamiento de proyectil en 3D con los vectores de velocidad" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.25, pitch: 0.12 }} status="modelo"
      statusNote="Trayectoria, posición y velocidad: las del modelo en el mismo instante que el banco (sin aire, la velocidad exacta; con aire, la pendiente entre las muestras de la integración). Las flechas tienen una escala fija en cada disparo: la rapidez máxima posible mide lo mismo. La esfera, la mesa y el lanzador no están a escala." />
  );
}
