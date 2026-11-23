import { useEffect, useMemo, useState } from 'react';
import { parseStructure, type ProteinStructure } from '../../models/protein';
import type { Alignment } from '../../models/sequences';
import { Scene3D } from '../../three';
import { useNarrow } from '../lote3d6/useNarrow';
import { matchChains, sequenceScene } from './sequences3d';

/**
 * Estructuras del repositorio que pueden corresponder a las secuencias de ejemplo (se cargan solo al abrir la vista y si
 * el alineamiento es de proteínas; son los mismos fragmentos que usa la práctica de proteínas).
 */
const CANDIDATES: { id: string; load: () => Promise<string> }[] = [
  { id: '2HHB', load: () => import('../../data/proteinas/2HHB.cif?raw').then((m) => m.default) },
  { id: '3I40', load: () => import('../../data/proteinas/3I40.cif?raw').then((m) => m.default) },
];

interface Props { al: Alignment | null; nameA: string; nameB: string; seqA: string; seqB: string; protein: boolean }

/** «secuencias»: el alineamiento coloreado sobre la estructura 3D de la proteína (o, sin estructura, su escalera). */
export default function SecuenciasView3D({ al, nameA, nameB, seqA, seqB, protein }: Props) {
  const [structure, setStructure] = useState<{ id: string; s: ProteinStructure } | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    let alive = true;
    setStructure(null);
    if (!al || !protein) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      for (const c of CANDIDATES) {
        try {
          const s = parseStructure(await c.load());
          if (matchChains(s, seqA, seqB).length) { if (alive) setStructure({ id: c.id, s }); break; }
        } catch { /* sin conexión o archivo ilegible: se queda la escalera */ }
        if (!alive) return;
      }
      if (alive) setLoading(false);
    })();
    return () => { alive = false; };
  }, [al, protein, seqA, seqB]);
  const scene = useMemo(() => sequenceScene({ al, nameA, nameB, seqA, seqB, structure, loading }), [al, nameA, nameB, seqA, seqB, structure, loading]);
  const frame = useNarrow() ? scene.narrow : scene;
  const note = scene.mode === 'estructura'
    ? `Color de cada residuo = marca de su columna en el alineamiento del banco (idéntico, parecido, distinto, frente a un hueco); coordenadas de los Cα: archivo ${structure?.id} del PDB incluido en el repositorio; la cadena se reconoce porque su secuencia es un tramo exacto de la secuencia alineada; distancias medias calculadas con el archivo. Dibujo: grosor de la traza y tamaño de las esferas.`
    : 'Columnas, marcas y huecos: los del alineamiento del banco. Sin una estructura que corresponda a estas secuencias, la escalera solo ordena el alineamiento en 3D (no es la forma de la molécula). Dibujo: disposición en filas de 40 columnas.';
  return (
    <div>
      {loading && <p role="status" className="small muted" style={{ margin: '0 0 6px' }}>Buscando una estructura 3D que corresponda a estas secuencias…</p>}
      <Scene3D idPrefix="seq3d" title={scene.mode === 'estructura' ? `Alineamiento coloreado sobre la estructura ${structure?.id} en 3D` : 'Escalera del alineamiento en 3D'} items={scene.items}
        extent={frame.extent} target={frame.target} description={scene.description} height={340} initialOrbit={{ yaw: 0.3, pitch: 0.25 }} status="modelo" statusNote={note} />
    </div>
  );
}
