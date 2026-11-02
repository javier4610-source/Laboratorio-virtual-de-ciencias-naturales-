import { useMemo } from 'react';
import { Scene3D } from '../../three';
import { osmosisScene, type OsmosisSceneInput } from './osmosis3d';

/** «osmosis»: la célula 3D sincronizada con la observación del banco (mismo instante, mismo volumen, mismo flujo). */
export default function OsmosisView3D(props: OsmosisSceneInput) {
  const { cellType, volume, t, duration, waterDirection, lysed, externalOsm, naclPercent, tonicity } = props;
  const scene = useMemo(() => osmosisScene({ cellType, volume, t, duration, waterDirection, lysed, externalOsm, naclPercent, tonicity }),
    [cellType, volume, t, duration, waterDirection, lysed, externalOsm, naclPercent, tonicity]);
  return (
    <Scene3D idPrefix="osm3d" title={cellType === 'animal' ? 'Glóbulo rojo en 3D con su membrana y el agua que la cruza' : 'Célula vegetal en 3D con su membrana y el agua que la cruza'}
      items={scene.items} extent={scene.extent} target={scene.target} description={scene.description} height={340} initialOrbit={{ yaw: 0.5, pitch: 0.35 }}
      status="modelo"
      statusNote="Volumen de la célula (V^⅓ en cada eje), sentido del flujo neto de agua y lisis: los del modelo en el mismo instante que el banco; solutos dibujados ∝ osmolaridad. La forma de la célula, los canales y la ubicación de las partículas son dibujo; las moléculas no están a escala." />
  );
}
