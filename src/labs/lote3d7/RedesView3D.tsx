import { useMemo, useState } from 'react';
import { Select } from '../../components/ui';
import { SPECIES, simulateFoodWeb, type SpeciesId } from '../../models/foodweb';
import { Scene3D } from '../../three';
import { useNarrow } from '../lote3d6/useNarrow';
import { foodWebScene } from './foodweb3d';

interface Props {
  rain: number;
  hunting: number;
  pesticide: number;
  years: number;
  /** Índice de muestra (año) que muestra el banco y biomasa del banco en ese año. */
  idx: number;
  year: number;
  current: Record<SpeciesId, number>;
  started: boolean;
}

/** «redes»: la red trófica en niveles 3D y la pirámide de biomasa; opcionalmente, la cascada al quitar una especie. */
export default function RedesView3D({ rain, hunting, pesticide, years, idx, year, current, started }: Props) {
  const [removed, setRemoved] = useState<SpeciesId | 'ninguna'>('ninguna');
  // Otra corrida del MISMO modelo y las mismas condiciones, sin la especie elegida desde el inicio.
  const run = useMemo(() => (removed === 'ninguna' ? null : simulateFoodWeb({ rain, hunting, pesticide, years, initial: { [removed]: 0 } })), [removed, rain, hunting, pesticide, years]);
  const biomass = useMemo(() => {
    if (!run) return current;
    const i = Math.min(idx, run.times.length - 1);
    return Object.fromEntries(SPECIES.map((s) => [s.id, run.series[s.id][i]])) as Record<SpeciesId, number>;
  }, [run, idx, current]);
  const scene = useMemo(() => foodWebScene({ biomass, benchBiomass: current, removed: removed === 'ninguna' ? null : removed, year, started }), [biomass, current, removed, year, started]);
  const frame = useNarrow() ? scene.narrow : scene;
  return (
    <div>
      <div style={{ maxWidth: 380, marginBottom: 8 }}>
        <Select label="Quitar una especie (vista 3D)" value={removed} onChange={(v) => setRemoved(v as SpeciesId | 'ninguna')}
          options={[{ value: 'ninguna', label: 'Ninguna: la red del banco' }, ...SPECIES.map((s) => ({ value: s.id, label: `Sin ${s.name.toLowerCase()}` }))]}
          hint="Otra corrida del mismo modelo, con las mismas condiciones, que empieza sin esa especie: verde sube y rojo baja frente al banco en el mismo año." />
      </div>
      <Scene3D idPrefix="red3d" title="Red trófica por niveles y pirámide de biomasa en 3D" items={scene.items} extent={frame.extent} target={frame.target}
        description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.22 }} status="modelo"
        statusNote="Biomasa de cada especie (volumen de su esfera ∝ biomasa frente al equilibrio base) y de cada nivel (pirámide, lado en la escala logarítmica del banco): las del modelo en el mismo año del banco; enlaces «es comido por» del modelo; gris por debajo del 2 % del equilibrio base. «Quitar una especie» es otra corrida del mismo modelo. Dibujo: posiciones en cada nivel, colores y largo de las varillas." />
    </div>
  );
}
