import { useState } from 'react';
import { fmt } from '../../lib/format';
import { nativeFraction, pHFactor, type EnzymeInfo } from '../../models/enzyme';
import { BUNDLED_STRUCTURES } from '../../data/proteins';
import { Segmented } from '../../components/ui';
import { LYSOZYME_ACTIVE_SITE } from './mappings';
import { ProteinSpot3D, type ProteinColor } from './ProteinSpot3D';

const LZM = BUNDLED_STRUCTURES.find((b) => b.id === '2LZM')!;
const MARKS = LYSOZYME_ACTIVE_SITE.map((r) => ({ chain: r.chain, resSeq: r.resSeq, label: r.name }));

/**
 * Enzimas en 3D: la lisozima del fago T4 (PDB 2LZM, ya incluida en el repositorio) como ENZIMA MODELO, con su sitio
 * activo (Glu11 y Asp20) resaltado. Ni la amilasa, ni la pepsina ni la catalasa del laboratorio tienen estructura en el
 * repositorio. La temperatura y el pH del laboratorio se leen con el MISMO modelo: la fracción de enzima nativa (término
 * de desnaturalización) atenúa la cinta, y el factor B (medido) muestra qué regiones se mueven más.
 */
export default function EnzimasView3D({ enzyme, temperature, pH }: { enzyme: EnzymeInfo; temperature: number; pH: number }) {
  const [color, setColor] = useState<ProteinColor>('gen');
  const native = nativeFraction(enzyme, temperature);
  const fpH = pHFactor(enzyme, pH);
  const desc = `Lisozima del fago T4 (PDB 2LZM, ${LZM.experimental?.method === 'X-RAY DIFFRACTION' ? 'difracción de rayos X' : LZM.experimental?.method ?? ''}, ${fmt(LZM.experimental?.resolution ?? 0, 2)} Å), una sola cadena. Sitio activo: Glu11 y Asp20, en la hendidura entre los dos dominios. ${color === 'factorB' ? 'Color por factor B: azul, rígido; rojo, más móvil.' : 'Cinta azul.'} Con el modelo de la ${enzyme.name.toLowerCase()} a ${fmt(temperature, 0)} °C, el ${fmt(native * 100, 0)} % de las moléculas sigue plegado (nativo); a pH ${fmt(pH, 1)}, el factor de pH es ${fmt(fpH, 2)}.`;
  return (
    <div className="stack-sm" style={{ minWidth: 0 }}>
      <Segmented label="Color de la cinta" value={color} onChange={setColor} options={[{ value: 'gen', label: 'Sitio activo' }, { value: 'factorB', label: 'Factor B (movilidad medida)' }]} />
      <ProteinSpot3D file={LZM.file} title="Lisozima del fago T4 (2LZM)" status="experimental" idPrefix="enz3d" marks={MARKS} color={color} unfolded={1 - native} description={desc}
        caption={<>PDB <a href={LZM.pageUrl} target="_blank" rel="noopener noreferrer">2LZM</a> (archivo del repositorio, {LZM.retrieved}). Es una enzima modelo: la {enzyme.name.toLowerCase()} del laboratorio no tiene estructura incluida. El color de la cinta se aclara hacia el gris según la fracción desnaturalizada del modelo de la práctica (codificación visual: no es una estructura desnaturalizada).</>}>
        <div className="readout" style={{ marginTop: 8 }}>
          <div className="item"><div className="k">Moléculas plegadas (nativas) a {fmt(temperature, 0)} °C</div><div className="v data">{fmt(native * 100, 0)} %</div></div>
          <div className="item"><div className="k">Factor de pH a pH {fmt(pH, 1)}</div><div className="v">{fmt(fpH, 2)}</div></div>
        </div>
        <p className="small" style={{ margin: '6px 0 0' }}>
          {native < 0.5
            ? `Por encima de ${fmt(enzyme.tm, 0)} °C la mayoría de las cadenas pierde su forma: Glu11 y Asp20 se separan y el sitio activo deja de existir, aunque la secuencia no cambió.`
            : 'Glu11 y Asp20 están lejos en la secuencia, pero el plegamiento los junta en la hendidura donde entra el sustrato: la forma 3D crea el sitio activo.'}
          {fpH < 0.5 ? ' Con este pH cambian las cargas de los residuos del sitio activo (como Glu y Asp) y la enzima pierde actividad.' : ''}
        </p>
      </ProteinSpot3D>
    </div>
  );
}
