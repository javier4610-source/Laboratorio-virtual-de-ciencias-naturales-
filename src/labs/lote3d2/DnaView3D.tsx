import { useMemo, useState } from 'react';
import { Scene3D } from '../../three';
import { Select } from '../../components/ui';
import { complement } from '../../models/dna';
import { helixScene, pairFromId, pairInfo } from './helix';

const P = 'adn3d';

/**
 * «adn»: doble hélice 3D de la secuencia que escribió el estudiante (hebra codificante y su complementaria). En la
 * actividad de mutaciones, después de aplicar una, se dibuja la secuencia mutada con el par cambiado marcado.
 */
export default function DnaView3D({ seq, mutated, mutationIndex, mutationLabel }: { seq: string; mutated?: string; mutationIndex?: number | null; mutationLabel?: string }) {
  const [sel, setSel] = useState<number | null>(null);
  const strand1 = mutated ?? seq;
  const strand2 = useMemo(() => [...complement(strand1)], [strand1]);
  const scene = useMemo(() => helixScene({
    id: P, strand1, strand2, name1: 'hebra codificante', name2: 'hebra molde', showPairing: true,
    highlight: mutated ? mutationIndex ?? null : null, highlightLabel: mutationLabel ?? 'Mutación', selected: sel,
  }), [strand1, strand2, mutated, mutationIndex, mutationLabel, sel]);
  const chosen = sel !== null && sel < scene.n ? sel : null;
  return (
    <Scene3D idPrefix={P} title={mutated ? 'Doble hélice 3D de la secuencia mutada' : 'Doble hélice 3D de tu secuencia'} items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description + (chosen !== null ? ` Elegido: ${pairInfo(strand1, strand2, chosen)}` : '')} height={360} initialOrbit={{ yaw: 0.5, pitch: 0.12 }}
      status="modelo" selectedId={chosen === null ? null : `${P}-b${chosen}-1`} onSelect={(id) => { const i = pairFromId(P, id); if (i !== null) setSel(i); }}
      statusNote="Geometría calculada con los parámetros del ADN-B (10,5 pares por vuelta, 3,4 Å por par, fosfatos a 10 Å del eje) y tu secuencia; el desfase de las columnas que forma los surcos es aproximado y las bases son palitos, no anillos.">
      <div className="stack-sm" style={{ marginTop: 8 }}>
        <Select label="Par de bases que quieres ver" value={chosen === null ? '' : String(chosen)} onChange={(v) => setSel(v === '' ? null : Number(v))}
          options={[{ value: '', label: 'Ninguno (toca una base en la escena)' }, ...Array.from({ length: scene.n }, (_, i) => ({ value: String(i), label: `Par ${i + 1}: ${strand1[i]}–${strand2[i]}` }))]} />
        <p className="small" aria-live="polite" style={{ margin: 0 }}>{chosen !== null ? pairInfo(strand1, strand2, chosen) : 'Elige un par (en la lista o tocando una base) para ver cuántos puentes de hidrógeno lo unen.'}</p>
      </div>
    </Scene3D>
  );
}
