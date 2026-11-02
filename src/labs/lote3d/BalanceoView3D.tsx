import { useMemo, useState } from 'react';
import { Reaction3D, type Reaction3DDef, type Species3D } from '../../chem';
import { SpeciesScene3D } from '../../chem/SpeciesScene3D';
import { ELEMENT_NAME, prettyFormula, type ElementRow, type ReactionDef } from '../../models/balancing';
import { Select } from '../../components/ui';
import { speciesForFormula } from './formulaSpecies';
import { balanceScene, balanceSceneCounts } from './scenes';
import { useExtraSpecies } from './useExtraSpecies';

/**
 * Balanceo en 3D: cada coeficiente añade o quita copias 3D reales de la sustancia y la tabla cuenta los átomos de la
 * escena a cada lado. Con la ecuación balanceada se puede ver la reacción animada (Reaction3D): los átomos se
 * reorganizan, no aparecen ni desaparecen.
 */
export default function BalanceoView3D({ reaction, coefs, mark, rows }: { reaction: ReactionDef; coefs: number[]; mark: string | null; rows: ElementRow[] }) {
  const formulas = useMemo(() => [...reaction.reactants, ...reaction.products].map((s) => s.formula), [reaction]);
  const extra = useExtraSpecies(formulas);
  const species = useMemo(() => (extra ? formulas.map((f) => speciesForFormula(f, extra)) : null), [formulas, extra]);
  const nR = reaction.reactants.length;
  const elements = rows.map((r) => r.element);
  const [pick, setPick] = useState<string>('');
  const highlight = pick === 'pista' ? mark : pick || null;
  const ready = species && species.every((s) => s !== null);
  const scene = useMemo(() => (ready ? balanceScene(species as Species3D[], formulas, nR, coefs, highlight) : null), [ready, species, formulas, nR, coefs, highlight]);
  const counts = useMemo(() => (scene ? balanceSceneCounts(scene) : null), [scene]);
  const balanced = rows.every((r) => r.diff === 0);
  const [animate, setAnimate] = useState(false);
  const def = useMemo<Reaction3DDef | null>(() => {
    if (!ready || !balanced) return null;
    const term = (i: number) => ({ species: species![i]!, coef: coefs[i], formula: formulas[i], name: [...reaction.reactants, ...reaction.products][i].name });
    return { id: `bal-${reaction.id}-${coefs.join('-')}`, title: reaction.name, reactants: reaction.reactants.map((_, i) => term(i)), products: reaction.products.map((_, i) => term(nR + i)) };
  }, [ready, balanced, species, coefs, formulas, reaction, nR]);

  if (!extra) return <p role="status" className="small">Cargando las moléculas…</p>;
  if (!scene || !counts) return <p className="notice small">No hay geometría 3D para todas las sustancias de esta ecuación en el repositorio.</p>;

  const side = (list: Record<string, number>) => elements.map((el) => `${list[el] ?? 0} de ${ELEMENT_NAME[el] ?? el}`).join(', ');
  const terms = (from: number, to: number) => formulas.slice(from, to).map((f, i) => `${coefs[from + i]} × ${prettyFormula(f)}`).join(' + ');
  const desc = `Reactivos (izquierda): ${terms(0, nR)}; átomos: ${side(counts.left)}. Productos (derecha): ${terms(nR, formulas.length)}; átomos: ${side(counts.right)}. ${balanced ? 'Cada elemento tiene los mismos átomos a los dos lados.' : `No coinciden: ${rows.filter((r) => r.diff !== 0).map((r) => `${r.element} (${r.left} frente a ${r.right})`).join(', ')}.`}${highlight ? ` Resaltados los átomos de ${ELEMENT_NAME[highlight] ?? highlight}.` : ''}`;

  return (
    <div className="stack-sm" style={{ minWidth: 0 }}>
      <Select label="Resaltar los átomos de" value={pick} onChange={setPick}
        options={[{ value: '', label: 'Ningún elemento' }, ...(mark ? [{ value: 'pista', label: `El elemento de la pista (${mark})` }] : []), ...elements.map((el) => ({ value: el, label: `${el} (${ELEMENT_NAME[el] ?? el})` }))]} />
      <SpeciesScene3D atoms={scene.atoms} bonds={scene.bonds} labels={[...scene.labels, { text: '→', at: scene.arrow, size: 34 }]} idPrefix="bal3d" title={`Moléculas de ${reaction.name}`}
        description={desc} frameKey={`${reaction.id}|${coefs.join(',')}`} height={340}
        caption={<>cada copia es una molécula o unidad fórmula con su geometría del kit (confórmeros de PubChem, iones VSEPR o fragmento de red; los compuestos iónicos se dibujan como iones separados). El número de copias es el coeficiente que elegiste.</>}>
        <div className="table-wrap" tabIndex={0} role="region" aria-label="Átomos contados en la escena 3D" style={{ marginTop: 8 }}>
          <table className="small">
            <caption className="sr-only">Átomos de cada elemento contados en la escena 3D, a cada lado de la ecuación</caption>
            <thead><tr><th>Elemento</th><th className="n">Reactivos (3D)</th><th className="n">Productos (3D)</th><th>¿Iguales?</th></tr></thead>
            <tbody>
              {elements.map((el) => {
                const l = counts.left[el] ?? 0, r = counts.right[el] ?? 0;
                return <tr key={el}><td>{el}</td><td className="n">{l}</td><td className="n">{r}</td><td style={{ color: l === r ? 'var(--ok)' : 'var(--bad)', fontWeight: 700 }}>{l === r ? 'Sí' : `No (${r - l > 0 ? '+' : '−'}${Math.abs(r - l)})`}</td></tr>;
              })}
            </tbody>
          </table>
        </div>
      </SpeciesScene3D>
      {def ? (
        <div className="stack-sm">
          <button type="button" className="btn small" aria-pressed={animate} onClick={() => setAnimate((a) => !a)}>{animate ? 'Ocultar la reacción animada' : 'Ver la reacción animada (los átomos se reorganizan)'}</button>
          {animate && <Reaction3D def={def} idPrefix="bal3dr" height={300} labelSuffix="(balanceo)" />}
        </div>
      ) : (
        <p className="small muted" style={{ margin: 0 }}>Cuando la ecuación esté balanceada podrás ver la reacción animada: con átomos de más o de menos a un lado no hay forma de reorganizarlos sin crear o destruir materia.</p>
      )}
    </div>
  );
}
