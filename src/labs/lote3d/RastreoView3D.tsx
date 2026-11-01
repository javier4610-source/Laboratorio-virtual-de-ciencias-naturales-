import { useMemo, useState } from 'react';
import { AMINO_ACIDS } from '../../models/dna';
import type { GeneRecord, VariantResult } from '../../models/geneTrace';
import { BUNDLED_STRUCTURES } from '../../data/proteins';
import { Segmented } from '../../components/ui';
import { GENE_STRUCTURES, INS_SEQ_DIFF, variantMarks } from './mappings';
import { ProteinSpot3D, type ProteinColor } from './ProteinSpot3D';

const three = (aa: string) => (aa === '*' ? 'Ter' : AMINO_ACIDS[aa]?.three ?? '?');

/**
 * Rastreo génico en 3D: la estructura del producto del gen que ya está en el repositorio (HBB → 2HHB, INS → 3I40,
 * OCA2 → modelo de AlphaFold con su confianza pLDDT) y la variante analizada marcada en su residuo. LCT y lacZ no
 * tienen estructura incluida: se dice, sin descargar nada.
 */
export default function RastreoView3D({ gene, variant }: { gene: GeneRecord; variant: VariantResult | null }) {
  const map = GENE_STRUCTURES[gene.key] ?? null;
  const bundled = map ? BUNDLED_STRUCTURES.find((b) => b.file === map.file) ?? null : null;
  const [color, setColor] = useState<ProteinColor>(map?.kind === 'prediccion' ? 'plddt' : 'gen');
  const prefix = gene.key === 'HBB' ? 'β' : '';
  const m = useMemo(() => (map ? variantMarks(map, variant, three, prefix) : null), [map, variant, prefix]);
  if (!map || !bundled || !m) {
    return <p className="notice small">El repositorio no incluye una estructura 3D de la proteína de {gene.gene.symbol}{gene.structure ? ` (en el PDB: ${gene.structure.pdb}, sin descargar)` : ''}. Hay estructura incluida para HBB (2HHB), INS (3I40) y OCA2 (modelo de AlphaFold): elige uno de esos genes para verla.</p>;
  }
  const pred = map.kind === 'prediccion';
  const effColor = pred ? color : color === 'plddt' ? 'gen' : color;
  const desc = `${bundled.name} (${map.id}${pred ? ', modelo predicho por AlphaFold' : ', estructura experimental'}): producto del gen ${gene.gene.symbol}. ${m.headline}${pred && effColor === 'plddt' ? ' Color por confianza pLDDT: azul, muy alta; celeste, alta; amarillo, baja; naranja, muy baja.' : ''}`;
  return (
    <div className="stack-sm" style={{ minWidth: 0 }}>
      {pred && <Segmented label="Color de la cinta" value={effColor} onChange={setColor} options={[{ value: 'plddt', label: 'Confianza pLDDT' }, { value: 'gen', label: 'Una sola cadena' }]} />}
      <p className="small" style={{ margin: 0 }} aria-live="polite"><strong>{variant ? variant.label : 'Proteína de referencia'}:</strong> {m.headline}{gene.key === 'INS' ? INS_SEQ_DIFF.filter((d) => m.marks.some((x) => x.chain === d.chain && x.resSeq === d.resSeq)).map((d) => ` Ojo: ${d.note}.`).join('') : ''}</p>
      <ProteinSpot3D file={map.file} title={`${bundled.name} (${map.id})`} status={pred ? 'prediccion' : 'experimental'} idPrefix="ras3d" marks={m.marks} fadedFrom={m.fadedFrom} color={effColor} geneChains={map.geneChains}
        description={desc} height={pred ? 380 : 340}
        caption={<>{pred ? 'Modelo de AlphaFold DB' : 'PDB'} <a href={bundled.pageUrl} target="_blank" rel="noopener noreferrer">{map.id}</a> (archivo del repositorio, {bundled.retrieved}).{gene.key === 'HBB' ? ' Azul: cadenas β (gen HBB); gris: cadenas α.' : ''}{gene.key === 'INS' ? ' Insulina madura: cadenas A y B; el péptido señal y el péptido C no están en la estructura.' : ''}{pred ? ' Las regiones de pLDDT bajo pueden estar desordenadas: no interpretes su forma.' : ''}</>} />
    </div>
  );
}
