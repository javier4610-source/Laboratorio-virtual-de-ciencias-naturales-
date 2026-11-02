import { useMemo } from 'react';
import { Scene3D } from '../../three';
import type { Gene, Genotype } from '../../models/mendel';
import { mendelScene } from './mendel3d';

/** «mendel»: cromosomas homólogos de los progenitores con los loci de los alelos y los gametos que forman. */
export default function MendelView3D({ g1, g2, genes }: { g1: Genotype; g2: Genotype; genes: Gene[] }) {
  const k1 = g1.join(','), k2 = g2.join(','), kg = genes.map((g) => g.id).join(',');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scene = useMemo(() => mendelScene(g1, g2, genes), [k1, k2, kg]);
  return (
    <Scene3D idPrefix="mdl3d" title="Cromosomas homólogos, alelos y gametos en 3D" items={scene.items} extent={scene.extent} target={scene.target}
      description={scene.description} height={340} initialOrbit={{ yaw: 0.25, pitch: 0.15 }} status="ilustracion"
      statusNote="Genotipos y gametos: los del cruce y del cuadro de Punnett (cada gameto es una fila o columna del cuadro). Cromosomas, loci y células son dibujo: la posición real de estos genes en los cromosomas no está en la práctica.">
      <p className="small" style={{ margin: '8px 0 0' }}>
        <span className="scene3d-swatch" aria-hidden="true" style={{ background: 'var(--data)' }} /> Locus con el alelo dominante (mayúscula) ·{' '}
        <span className="scene3d-swatch" aria-hidden="true" style={{ background: 'var(--series-5)' }} /> locus con el alelo recesivo (minúscula). Gametos del progenitor 1: <strong className="num">{scene.gametes1.join(', ')}</strong>; del progenitor 2: <strong className="num">{scene.gametes2.join(', ')}</strong>.
      </p>
    </Scene3D>
  );
}
