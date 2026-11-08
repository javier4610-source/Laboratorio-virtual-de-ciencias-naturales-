import { useEffect, useMemo, useState } from 'react';
import { Select, Slider } from '../../components/ui';
import { Scene3D } from '../../three';
import { popGenScene } from './popgen3d';

interface Props {
  /** Serie del modelo: la frecuencia de A de cada réplica en cada generación. */
  series: readonly { generation: number; p: readonly number[] }[];
  n: number;
  drift: boolean;
  migration: number;
  migrantP: number;
}

/** «popgen»: la isla y el continente en 3D, con individuos coloreados por sus alelos y migrantes que cruzan. */
export default function PopGenView3D({ series, n, drift, migration, migrantP }: Props) {
  const last = series.length - 1;
  const reps = series[0]?.p.length ?? 1;
  const [gen, setGen] = useState(last);
  const [rep, setRep] = useState(0);
  // Una simulación nueva (otros controles u otra semilla) muestra su última generación.
  useEffect(() => { setGen(last); }, [series, last]);
  const g = Math.min(gen, last), r = Math.min(rep, reps - 1);
  const p = series[g]?.p[r] ?? 0.5;
  const scene = useMemo(() => popGenScene({ p, n, generation: series[g]?.generation ?? 0, replicate: r, replicates: reps, drift, migration, migrantP }),
    [p, n, series, g, r, reps, drift, migration, migrantP]);
  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 8 }}>
        <Slider label="Generación que se muestra (vista 3D)" value={g} min={0} max={last} step={1} decimals={0} onChange={(v) => setGen(Math.round(v))} />
        {drift && reps > 1 && (
          <Select label="Población (réplica) en la isla" value={String(r)} onChange={(v) => setRep(Number(v))}
            options={Array.from({ length: reps }, (_, k) => ({ value: String(k), label: `Población ${k + 1}` }))} />
        )}
      </div>
      <Scene3D idPrefix="pg3d" title="Isla y continente con sus alelos en 3D" items={scene.items} extent={scene.extent} target={scene.target}
        description={scene.description} height={320} initialOrbit={{ yaw: 0.2, pitch: 0.7 }} status="modelo"
        statusNote="Frecuencia p y copias de A (2N·p) de la isla: las del modelo en la población y la generación elegidas; individuos con las proporciones de Hardy-Weinberg de ese p (como la poza génica del banco; con N > 100, una muestra de 100); continente con la p de los migrantes y m·individuos migrantes por generación. Dibujo: paisaje, formas y lugar de cada individuo." />
    </div>
  );
}
