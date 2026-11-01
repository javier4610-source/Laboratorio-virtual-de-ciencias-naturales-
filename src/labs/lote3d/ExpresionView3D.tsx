import { useMemo } from 'react';
import { fmt } from '../../lib/format';
import { AMINO_ACIDS } from '../../models/dna';
import type { MutationAnalysis } from '../../models/geneExpression';
import { BUNDLED_STRUCTURES } from '../../data/proteins';
import { GENE_STRUCTURES, proteinMarks } from './mappings';
import { ProteinSpot3D } from './ProteinSpot3D';

const HB = BUNDLED_STRUCTURES.find((b) => b.id === '2HHB')!;
const MAP = GENE_STRUCTURES.HBB!;
const three = (aa: string) => (aa === '*' ? 'Ter' : AMINO_ACIDS[aa]?.three ?? '?');

/**
 * Expresión génica en 3D: la hemoglobina humana (PDB 2HHB, incluida en el repositorio) con las dos cadenas β (producto
 * del gen HBB de la práctica) en azul y las α en gris. El codón elegido o mutado se liga con su residuo en la proteína
 * plegada (codón c → residuo β(c − 1): la Met inicial se retira); una proteína truncada o con corrimiento atenúa lo que
 * ya no se fabricaría. Las mutaciones del promotor, del empalme o de la cola de poli-A cambian la CANTIDAD de proteína.
 */
export default function ExpresionView3D({ wildProtein, analysis, focusCodon }: { wildProtein: string; analysis: MutationAnalysis | null; focusCodon: number | null }) {
  const m = useMemo(() => proteinMarks(MAP, wildProtein.replace(/\*$/, ''), analysis ? analysis.mutant.protein.replace(/\*$/, '') : null, analysis ? (analysis.location.codon ?? null) : focusCodon, three, 'β'), [wildProtein, analysis, focusCodon]);
  const expr = analysis ? analysis.expressionPercent : 100;
  const desc = `Hemoglobina humana (2HHB): dos cadenas α (gris) y dos cadenas β (azul, producto del gen HBB), cada una con su grupo hemo. ${m.headline}${analysis ? ` Mutación: ${analysis.label}. Expresión relativa: ${fmt(expr, 0)} %.` : ''}`;
  return (
    <div className="stack-sm" style={{ minWidth: 0 }}>
      <p className="small" style={{ margin: 0 }} aria-live="polite"><strong>{analysis ? analysis.label : 'Gen silvestre'}:</strong> {m.headline}{analysis && expr < 100 ? ` La célula produce el ${fmt(expr, 0)} % de la proteína normal.` : ''}</p>
      <ProteinSpot3D file={HB.file} title="Hemoglobina humana (2HHB)" status="experimental" idPrefix="exp3d" marks={m.marks} fadedFrom={m.fadedFrom} color="gen" geneChains={MAP.geneChains} description={desc}
        caption={<>PDB <a href={HB.pageUrl} target="_blank" rel="noopener noreferrer">2HHB</a> (archivo del repositorio, {HB.retrieved}): desoxihemoglobina por difracción de rayos X. Azul: cadenas β (gen HBB); gris: cadenas α (otro gen); en barras, el hemo y los residuos marcados. La marca aparece en las dos cadenas β porque las dos salen del mismo gen.</>} />
      <p className="small muted" style={{ margin: 0 }}>En la anemia falciforme (codón 7: GAG → GTG) el residuo β6 pasa de glutamato (con carga) a valina (hidrofóbica) en la superficie de la proteína: las hemoglobinas se pegan entre sí cuando sueltan el oxígeno.</p>
    </div>
  );
}
