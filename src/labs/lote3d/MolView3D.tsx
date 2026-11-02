import { useMemo, useState } from 'react';
import { Reaction3D, type Reaction3DDef } from '../../chem';
import { SpeciesScene3D } from '../../chem/SpeciesScene3D';
import { buildScene } from '../../chem/sceneLayout';
import { fmt, fmtSig } from '../../lib/format';
import { ATOMIC_MASS, ELEMENT_NAME, parseFormula, prettyFormula } from '../../models/balancing';
import type { EntityCount, MolReactionDef } from '../../models/mole';
import { Select } from '../../components/ui';
import { NO_GEOMETRY, speciesForFormula } from './formulaSpecies';
import { useExtraSpecies } from './useExtraSpecies';

const ENTITY_ONE: Record<string, [string, string]> = { 'unidades fórmula': ['unidad fórmula', 'una'], moléculas: ['molécula', 'una'], átomos: ['átomo', 'un'] };

/**
 * El mol en 3D. «Contar pesando»: la entidad que se cuenta (molécula, unidad fórmula o átomo) con sus átomos, la masa
 * de UNA entidad (M/N_A) y cuántas hay en la muestra que se leyó en la balanza. «Reacción en la balanza»: la ecuación
 * del laboratorio con sus coeficientes en Reaction3D (los coeficientes son moles de cada sustancia).
 */
export default function MolView3D({ activity, formula, name, entity, counted, reaction }: {
  activity: 'contar' | 'reaccion'; formula: string; name: string; entity: string; counted: EntityCount | null; reaction: MolReactionDef;
}) {
  const formulas = useMemo(() => (activity === 'contar' ? [formula] : [...reaction.reaction.reactants, ...reaction.reaction.products].map((s) => s.formula)), [activity, formula, reaction]);
  const extra = useExtraSpecies(formulas);
  const [mark, setMark] = useState('');
  const comp = useMemo(() => parseFormula(formula), [formula]);
  const entitySpecies = useMemo(() => (extra && activity === 'contar' ? speciesForFormula(formula, extra) : null), [extra, activity, formula]);
  const scene = useMemo(() => (entitySpecies ? buildScene([{ species: entitySpecies, count: 1, center: [0, 0, 0], markElement: mark || null }]) : null), [entitySpecies, mark]);
  const def = useMemo<Reaction3DDef | null>(() => {
    if (!extra || activity !== 'reaccion') return null;
    const rx = reaction.reaction;
    const term = (s: { formula: string; coef: number; name: string }) => { const sp = speciesForFormula(s.formula, extra); return sp ? { species: sp, coef: s.coef, formula: s.formula, name: s.name } : null; };
    const rs = rx.reactants.map(term), ps = rx.products.map(term);
    if (![...rs, ...ps].every(Boolean)) return null;
    return { id: `mol-${reaction.id}`, title: reaction.name, reactants: rs as NonNullable<(typeof rs)[number]>[], products: ps as NonNullable<(typeof ps)[number]>[] };
  }, [extra, activity, reaction]);

  if (!extra) return <p role="status" className="small">Cargando las moléculas…</p>;

  if (activity === 'reaccion') {
    if (!def) return <p className="notice small">No hay geometría 3D para todas las sustancias de esta reacción en el repositorio.</p>;
    return (
      <div className="stack-sm" style={{ minWidth: 0 }}>
        <p className="small" style={{ margin: 0 }}>Los coeficientes de la ecuación son <strong>moles</strong>: {reaction.reaction.reactants.map((s) => `${s.coef} mol de ${prettyFormula(s.formula)}`).join(' y ')} producen {reaction.reaction.products.map((s) => `${s.coef} mol de ${prettyFormula(s.formula)}`).join(', ')}. En la animación, cada copia representa 1 mol (6,022 × 10²³ entidades).</p>
        <Reaction3D def={def} idPrefix="mol3dr" height={300} labelSuffix="(mol)" />
      </div>
    );
  }

  const M = Object.entries(comp).reduce((s, [el, n]) => s + n * (ATOMIC_MASS[el] ?? NaN), 0);
  const [entityWord, art] = ENTITY_ONE[entity] ?? ['entidad', 'una'];
  const Art = art[0].toUpperCase() + art.slice(1);
  const compText = Object.entries(comp).map(([el, n]) => `${n} ${ELEMENT_NAME[el] ?? el}`).join(', ');
  const sample = counted ? ` En tu muestra de ${fmt(counted.mass, 3)} g hay ${fmtSig(counted.entities, 4)} ${entity}.` : ' Lee la balanza para saber cuántas hay en tu muestra.';
  const desc = `${Art} ${entityWord} de ${name} (${prettyFormula(formula)}): ${compText}. Masa de ${art} ${entityWord}: ${fmt(M, 3)} u = ${fmtSig(M / 6.02214076e23, 4)} g.${sample}`;

  return (
    <div className="stack-sm" style={{ minWidth: 0 }}>
      {scene && entitySpecies ? (
        <>
          <Select label="Resaltar los átomos de" value={mark} onChange={setMark}
            options={[{ value: '', label: 'Ningún elemento' }, ...Object.keys(comp).map((el) => ({ value: el, label: `${el} (${ELEMENT_NAME[el] ?? el})` }))]} />
          <SpeciesScene3D atoms={scene.atoms} bonds={scene.bonds} idPrefix="mol3d" title={`${Art} ${entityWord} de ${prettyFormula(formula)}`} description={desc} frameKey={formula} height={300}
            status={/^Ilustración/.test(entitySpecies.geometryLabel) ? 'ilustracion' : 'modelo'}
            caption={<>{entitySpecies.geometryLabel.replace(/^[^:]+:\s*/, '')}. La balanza no ve entidades sueltas: pesa muchísimas a la vez, por eso se cuentan en moles.</>} />
        </>
      ) : (
        <p className="notice small">Sin vista 3D de esta sustancia: {NO_GEOMETRY[formula] ?? 'el repositorio no tiene su geometría'} (no se descargan datos nuevos). Su composición sí se cuenta abajo.</p>
      )}
      <div className="table-wrap" tabIndex={0} role="region" aria-label="De una entidad a la muestra" style={{ minWidth: 0 }}>
        <table className="small">
          <caption className="sr-only">Átomos de una entidad y de la muestra leída en la balanza</caption>
          <thead><tr><th>Elemento</th><th className="n">En 1 {entityWord}</th><th className="n">Masa (u)</th><th className="n">En la muestra</th></tr></thead>
          <tbody>
            {Object.entries(comp).map(([el, n]) => (
              <tr key={el}><td>{el}</td><td className="n">{n}</td><td className="n">{fmt(n * ATOMIC_MASS[el], 3)}</td><td className="n">{counted ? fmtSig(counted.atoms[el], 4) : '—'}</td></tr>
            ))}
            <tr><td><strong>Total</strong></td><td className="n">{Object.values(comp).reduce((s, n) => s + n, 0)}</td><td className="n"><strong>{fmt(M, 3)}</strong></td><td className="n">{counted ? fmtSig(counted.totalAtoms, 4) : '—'}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>La masa de {art} {entityWord} en u (unidades de masa atómica) es el mismo número que la masa molar en g/mol: 1 mol = 6,022 140 76 × 10²³ entidades.{counted ? ` Masa de ${art} ${entityWord}: ${fmtSig(counted.massPerEntity, 4)} g.` : ''}</p>
    </div>
  );
}
