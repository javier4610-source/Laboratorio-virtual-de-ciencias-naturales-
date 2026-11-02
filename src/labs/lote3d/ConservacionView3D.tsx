import { useMemo } from 'react';
import { moleculeSpecies } from '../../chem';
import { SpeciesScene3D } from '../../chem/SpeciesScene3D';
import { fmt } from '../../lib/format';
import { Readout } from '../../components/ui';
import { reactantAmounts, type ConservationInput, type ReactionId } from '../../models/massConservation';
import { speciesForFormula, type ExtraSpecies } from './formulaSpecies';
import { packets } from './mappings';
import { conservationScene, type ConsTerm } from './scenes';
import { useExtraSpecies } from './useExtraSpecies';

/** Unidades de reacción que se dibujan como máximo en cada reacción (para que la escena sea legible). */
const MAX_UNITS: Record<ReactionId, number> = { bicarbonato: 4, efervescente: 4, precipitacion: 4, oxidacion: 2 };

/** Términos de la ecuación que se dibuja (la del laboratorio; en la pastilla, la ecuación iónica neta que da el gas). */
function termsOf(id: ReactionId, extra: ExtraSpecies): { A: ConsTerm; B: ConsTerm; products: ConsTerm[]; equation: string; note: string } | null {
  const sp = (f: string) => speciesForFormula(f, extra);
  if (id === 'bicarbonato') {
    const a = sp('NaHCO3'), b = sp('CH3COOH'), c = sp('CH3COONa');
    if (!a || !b || !c) return null;
    return { A: { species: a, formula: 'NaHCO3', coef: 1 }, B: { species: b, formula: 'CH3COOH', coef: 1 }, products: [{ species: c, formula: 'CH3COONa', coef: 1 }, { species: sp('H2O')!, formula: 'H2O', coef: 1 }, { species: sp('CO2')!, formula: 'CO2', coef: 1, gas: true }],
      equation: 'NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂', note: 'El acetato de sodio y el agua quedan en el vaso; el CO₂ es gas.' };
  }
  if (id === 'efervescente') {
    return { A: { species: moleculeSpecies('hidrogenocarbonato'), formula: 'HCO3⁻', coef: 1 }, B: { species: moleculeSpecies('hidronio'), formula: 'H3O⁺', coef: 1 }, products: [{ species: sp('H2O')!, formula: 'H2O', coef: 2 }, { species: sp('CO2')!, formula: 'CO2', coef: 1, gas: true }],
      equation: 'HCO₃⁻ + H₃O⁺ → 2 H₂O + CO₂ (ecuación iónica neta)', note: 'El repositorio no tiene la geometría del ácido cítrico ni del citrato: se dibuja solo la parte que produce el gas (cada H⁺ del ácido, como H₃O⁺, con un HCO₃⁻ del bicarbonato). Los iones Na⁺ y citrato no cambian y no se dibujan.' };
  }
  if (id === 'precipitacion') {
    return { A: { species: sp('Na2CO3')!, formula: 'Na2CO3', coef: 1 }, B: { species: sp('CaCl2')!, formula: 'CaCl2', coef: 1 }, products: [{ species: sp('CaCO3')!, formula: 'CaCO3', coef: 1 }, { species: sp('NaCl')!, formula: 'NaCl', coef: 2 }],
      equation: 'CaCl₂ + Na₂CO₃ → CaCO₃ + 2 NaCl', note: 'No se produce gas: el CaCO₃ es el sólido blanco que precipita.' };
  }
  return { A: { species: sp('Fe')!, formula: 'Fe', coef: 3 }, B: { species: sp('O2')!, formula: 'O2', coef: 2, gas: true }, products: [{ species: sp('Fe3O4')!, formula: 'Fe3O4', coef: 1 }],
    equation: '3 Fe + 2 O₂ → Fe₃O₄', note: 'El oxígeno viene del aire: en la cápsula abierta entra desde afuera; en el frasco sellado solo está el del aire del frasco.' };
}

/**
 * Conservación de la masa en 3D: el recipiente (abierto o cerrado) con las partículas de los reactivos en la misma
 * proporción que las cantidades del laboratorio y el avance de la reacción del laboratorio. Lo que sale (CO₂) o entra
 * (O₂) cruza el borde del sistema, y el contador suma las masas atómicas de lo que hay adentro.
 */
export default function ConservacionView3D({ input, extent, started }: { input: ConservationInput; extent: number; started: boolean }) {
  const extra = useExtraSpecies(input.reaction === 'bicarbonato' ? ['CH3COOH'] : []);
  const terms = useMemo(() => (extra ? termsOf(input.reaction, extra) : null), [extra, input.reaction]);
  const amounts = useMemo(() => reactantAmounts(input), [input]);
  const pk = useMemo(() => {
    const [a, b] = amounts;
    // En la pastilla se dibujan iones: un HCO₃⁻ por NaHCO₃ y un H⁺ (H₃O⁺) por cada uno de los 3 del ácido cítrico.
    if (input.reaction === 'efervescente') return packets(a.moles, 1, 3 * b.moles, 1, MAX_UNITS.efervescente);
    return packets(a.moles, a.coef, b.moles, b.coef, MAX_UNITS[input.reaction]);
  }, [amounts, input.reaction]);
  const closed = input.system !== 'abierto';
  const ext = started ? extent : 0;
  const scene = useMemo(() => (terms ? conservationScene(terms.A, terms.B, terms.products, pk, ext, closed) : null), [terms, pk, ext, closed]);

  if (!extra) return <p role="status" className="small">Cargando las moléculas…</p>;
  if (!terms || !scene) return <p className="notice small">No hay geometría 3D para esta reacción en el repositorio.</p>;

  const limName = pk.limiting === null ? 'ninguno (proporción exacta)' : amounts[pk.limiting].name;
  const delta = scene.massNow - scene.massInitial;
  const desc = `${closed ? 'Sistema cerrado' : 'Sistema abierto'}. ${terms.equation}. Avance ${fmt(ext * 100, 0)} %: reaccionaron ${scene.doneUnits} de ${pk.units} unidades. Masa de las partículas dentro: ${fmt(scene.massInitial, 2)} u al inicio y ${fmt(scene.massNow, 2)} u ahora (${delta === 0 ? 'igual' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta), 2)} u`}). ${scene.gasOutside ? `${scene.gasOutside} moléculas de gas están fuera del sistema.` : ''} Reactivo limitante: ${limName}.`;

  return (
    <div className="stack-sm" style={{ minWidth: 0 }}>
      <p className="small" style={{ margin: 0, fontFamily: 'var(--font-data)' }}>{terms.equation}</p>
      <SpeciesScene3D atoms={scene.atoms} bonds={scene.bonds} lines={scene.lines} labels={scene.labels} idPrefix="cms3d" title={`Partículas en el ${closed ? 'sistema cerrado' : 'sistema abierto'}`}
        description={desc} frameKey={`${input.reaction}|${input.system}|${pk.a}|${pk.b}`} framePoints={scene.frame} height={340}
        caption={<>las aristas son el borde del sistema ({closed ? 'cerrado: nada entra ni sale' : 'abierto: sin tapa'}); lo translúcido está fuera. Hay {pk.a} y {pk.b} partículas de reactivos, en la proporción de las cantidades que elegiste (escala reducida: cada partícula representa muchísimas). {terms.note}</>}>
        <div style={{ marginTop: 8 }}>
          <Readout items={[
            { k: 'Masa dentro del sistema (partículas dibujadas)', v: `${fmt(scene.massInitial, 2)} u → ${fmt(scene.massNow, 2)} u`, data: true },
            { k: 'Cambio', v: Math.abs(delta) < 1e-9 ? 'ninguno: la masa se conserva' : `${delta > 0 ? '+' : '−'}${fmt(Math.abs(delta), 2)} u (${delta > 0 ? 'entró oxígeno del aire' : 'salió gas'})` },
            { k: `Reactivo limitante (sobran ${pk.leftA + pk.leftB} partículas del otro)`, v: limName },
          ]} />
        </div>
        <p className="small muted" style={{ margin: '6px 0 0' }}>u = unidad de masa atómica (masas atómicas CIAAW de la práctica de balanceo). La balanza del laboratorio pesa gramos: muchísimas partículas como estas.{!started && ' Pesa el sistema y mezcla los reactivos para ver la reacción.'}</p>
      </SpeciesScene3D>
    </div>
  );
}
