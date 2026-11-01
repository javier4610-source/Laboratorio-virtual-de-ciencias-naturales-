import { useMemo } from 'react';
import { SpeciesScene3D } from '../../chem/SpeciesScene3D';
import { sceneCounts } from '../../chem/sceneLayout';
import { prettyFormula } from '../../models/chemistry';
import type { StoichResult } from '../../models/stoichiometry';
import { speciesForFormula } from './formulaSpecies';
import { packets } from './mappings';
import { stoichScene, type StoichTerm } from './scenes';
import { useExtraSpecies } from './useExtraSpecies';

/** Unidades de reacción que se dibujan para el reactivo que alcanza para más (las demás cantidades, en proporción). */
export const STOICH_UNITS = 4;

/**
 * Estequiometría en 3D: «paquetes» de moléculas en la proporción de los moles del laboratorio. Antes: los dos
 * reactivos. Después: los productos, el reactivo en exceso que sobra y, atenuado, lo que no llegó a producto por el
 * rendimiento. Los átomos de antes y de después se cuentan en la tabla (son los mismos).
 */
export default function EstequiometriaView3D({ res, yieldPercent }: { res: StoichResult; yieldPercent: number }) {
  const rx = res.reaction;
  const formulas = useMemo(() => [...rx.reactants, ...rx.products].map((s) => s.formula), [rx]);
  const extra = useExtraSpecies(formulas);
  const terms = useMemo(() => {
    if (!extra) return null;
    const t = [...rx.reactants, ...rx.products].map((s): StoichTerm | null => { const sp = speciesForFormula(s.formula, extra); return sp ? { species: sp, formula: s.formula, coef: s.coef } : null; });
    return t.every(Boolean) ? (t as StoichTerm[]) : null;
  }, [extra, rx]);
  const [A, B] = rx.reactants;
  const pk = useMemo(() => packets(res.molesA, A.coef, res.molesB, B.coef, STOICH_UNITS), [res.molesA, res.molesB, A.coef, B.coef]);
  const scene = useMemo(() => (terms ? stoichScene(terms[0], terms[1], terms.slice(2), pk, yieldPercent) : null), [terms, pk, yieldPercent]);

  if (!extra) return <p role="status" className="small">Cargando las moléculas…</p>;
  if (!terms || !scene) return <p className="notice small">No hay geometría 3D para todas las sustancias de esta reacción en el repositorio.</p>;

  const before = sceneCounts(scene, scene.before), after = sceneCounts(scene, scene.after);
  const els = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const limName = pk.limiting === null ? (pk.units ? 'ninguno: proporción exacta' : 'no hay reacción (falta un reactivo)') : `${prettyFormula(rx.reactants[pk.limiting].formula)} (${rx.reactants[pk.limiting].name})`;
  const excess = pk.limiting === 0 ? { n: pk.leftB, f: B.formula } : pk.limiting === 1 ? { n: pk.leftA, f: A.formula } : null;
  const desc = `Antes: ${pk.a} de ${prettyFormula(A.formula)} y ${pk.b} de ${prettyFormula(B.formula)}. Reaccionan ${pk.units} veces la ecuación; reactivo limitante: ${limName}.` +
    ` Después: ${rx.products.map((p) => `${scene.formedUnits * p.coef} de ${prettyFormula(p.formula)}`).join(', ')}${excess && excess.n ? `; sobran ${excess.n} de ${prettyFormula(excess.f)}` : ''}${scene.lostUnits ? `; con rendimiento ${yieldPercent} %, ${scene.lostUnits} de las ${pk.units} unidades no llegaron a producto (atenuadas)` : ''}. Átomos antes y después: ${els.map((e) => `${e} ${before[e] ?? 0} y ${after[e] ?? 0}`).join(', ')}.`;

  return (
    <div className="stack-sm" style={{ minWidth: 0 }}>
      <SpeciesScene3D atoms={scene.atoms} bonds={scene.bonds} labels={[...scene.labels, { text: '→', size: 34, at: [scene.boxes[1] ? (scene.boxes[1].max[0] + (scene.boxes[2]?.min[0] ?? scene.boxes[1].max[0])) / 2 : 0, 0, 0] }]}
        idPrefix="sto3d" title={`Paquetes de moléculas de ${rx.name}`} description={desc} frameKey={`${rx.id}|${pk.a}|${pk.b}|${scene.formedUnits}`} height={340}
        caption={<>izquierda, antes de reaccionar; derecha, después. Las cantidades de partículas están en la proporción de los moles que calculó el laboratorio (escala reducida: la mayor cantidad se dibuja como {STOICH_UNITS} unidades de reacción). Atenuado: reactivo que no llegó a producto por el rendimiento.</>}>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Partículas y átomos antes y después en la escena 3D" style={{ marginTop: 8 }}>
          <table className="small">
            <caption className="sr-only">Átomos de cada elemento antes y después en la escena 3D</caption>
            <thead><tr><th>Átomos</th>{els.map((e) => <th key={e} className="n">{e}</th>)}</tr></thead>
            <tbody>
              <tr><td>Antes</td>{els.map((e) => <td key={e} className="n">{before[e] ?? 0}</td>)}</tr>
              <tr><td>Después</td>{els.map((e) => <td key={e} className="n">{after[e] ?? 0}</td>)}</tr>
            </tbody>
          </table>
        </div>
        <p className="small" style={{ margin: '6px 0 0' }}><strong>Reactivo limitante en la escena:</strong> {limName}{excess && excess.n ? `; sobran ${excess.n} ${prettyFormula(excess.f)}` : ''}.</p>
      </SpeciesScene3D>
    </div>
  );
}
