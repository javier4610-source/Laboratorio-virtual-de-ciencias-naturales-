import { useMemo, useState } from 'react';
import { moleculeSpecies, type Species3D } from '../../chem';
import { SHANNON } from '../../chem/elements';
import { SpeciesScene3D } from '../../chem/SpeciesScene3D';
import { fmt, fmtSig } from '../../lib/format';
import { molarMass, prettyFormula } from '../../models/chemistry';
import { Segmented } from '../../components/ui';
import { dissolvedParticles } from './formulaSpecies';
import { BOX_MAX_DRAWN, BOX_NM, ionWaterDistance, unitsInBox } from './mappings';
import { hydrationScene, solutionBoxScene } from './scenes';

/** Moléculas de agua en el cubo: agua líquida a 25 °C (0,997 g/mL, el dato de la práctica del mol) → c = 997 g/L ÷ M. */
const WATER_IN_BOX = unitsInBox(997 / molarMass('H2O'));

/** Ion monoatómico con radio de Shannon en el kit: se dibuja con su capa de hidratación. */
const hasShell = (s: Species3D) => s.atoms.length === 1 && !!SHANNON[s.atoms[0].el];

/**
 * Soluciones en 3D. «Capa de hidratación»: cada ion del soluto rodeado por 6 moléculas de agua orientadas (el O hacia
 * los cationes; un H hacia los aniones). «Partículas en un cubo»: cuántas unidades del soluto hay en un cubo de 5 nm
 * de lado con la concentración del laboratorio (N = c·N_A·V): al diluir, quedan menos en el mismo volumen.
 */
export default function SolucionesView3D({ formula, name, molarity, finalMolarity, diluted }: { formula: string; name: string; molarity: number; finalMolarity: number; diluted: boolean }) {
  const parts = useMemo(() => dissolvedParticles(formula), [formula]);
  const water = useMemo(() => moleculeSpecies('agua'), []);
  const [mode, setMode] = useState<'capa' | 'cubo'>('capa');
  const [which, setWhich] = useState<'madre' | 'diluida'>('madre');
  const ownShells = !!parts && parts.some((p) => hasShell(p.species));
  const isIonic = !!parts && parts.length > 1;
  // Si los iones del soluto no tienen capa en el kit (Cu²⁺, iones poliatómicos), se ofrece el ejemplo del NaCl.
  const [example, setExample] = useState(false);
  const useNaCl = isIonic && (example || !ownShells) && formula !== 'NaCl';
  const shellParts = useMemo(() => (useNaCl ? dissolvedParticles('NaCl') : parts), [useNaCl, parts]);
  const c = diluted && which === 'diluida' ? finalMolarity : molarity;
  const n = unitsInBox(c);
  const drawn = Math.min(BOX_MAX_DRAWN, Math.round(n));
  const sideA = BOX_NM * 10;
  const box = useMemo(() => (parts ? solutionBoxScene(parts, drawn, sideA) : null), [parts, drawn, sideA]);
  const hyd = useMemo(() => (shellParts ? hydrationScene(shellParts, water, hasShell) : null), [shellParts, water]);
  if (!parts || !box || !hyd) return <p className="notice small">No hay geometría 3D para este soluto en el repositorio.</p>;

  const ionic = parts.length > 1;
  const partNames = parts.map((p) => p.species.label).join(' y ');
  const shellText = shellParts!.map((p) => (hasShell(p.species) ? `${p.species.label}: 6 aguas con el ${p.species.atoms[0].charge! > 0 ? 'oxígeno hacia el ion' : 'hidrógeno hacia el ion'}, O a ${fmt(ionWaterDistance(p.species.atoms[0].el), 2)} Å` : `${p.species.label}: sin capa dibujada`)).join('; ');
  const descCapa = ionic
    ? `Al disolverse, ${prettyFormula(formula)} se separa en ${partNames}.${useNaCl ? ' Ejemplo de capa de hidratación con el NaCl:' : ''} ${shellText}.`
    : `${name} no se separa en iones: cada molécula queda entera, rodeada de agua (las aguas no se dibujan).`;
  const descCubo = `Cubo de ${BOX_NM} nm de lado (${fmtSig(125, 3)} nm³) con ${fmtSig(c, 3)} mol/L: N = c·N_A·V = ${fmtSig(n, 3)} unidades de ${prettyFormula(formula)}${drawn < Math.round(n) ? `; se dibujan ${drawn}` : ''}${ionic ? ` (${drawn * parts.length} iones dibujados)` : ''}. Las moléculas de agua no se dibujan.`;

  return (
    <div className="stack-sm" style={{ minWidth: 0 }}>
      <div className="btn-row" style={{ alignItems: 'flex-end', gap: '8px 20px' }}>
        <Segmented label="Qué mostrar" value={mode} onChange={setMode} options={[{ value: 'capa', label: ionic ? 'Capa de hidratación' : 'Partícula disuelta' }, { value: 'cubo', label: `Partículas en un cubo de ${BOX_NM} nm` }]} />
        {mode === 'capa' && isIonic && ownShells && formula !== 'NaCl' && <Segmented label="Iones" value={example ? 'ej' : 'sol'} onChange={(v) => setExample(v === 'ej')} options={[{ value: 'sol', label: 'Del soluto elegido' }, { value: 'ej', label: 'Ejemplo: NaCl' }]} />}
        {mode === 'cubo' && diluted && <Segmented label="Solución" value={which} onChange={setWhich} options={[{ value: 'madre', label: 'Madre' }, { value: 'diluida', label: 'Diluida' }]} />}
      </div>
      {mode === 'capa' ? (
        <SpeciesScene3D atoms={hyd.atoms} bonds={hyd.bonds} labels={hyd.labels} idPrefix="sol3dh" title={ionic ? (useNaCl ? 'Iones Na⁺ y Cl⁻ hidratados (ejemplo)' : `Iones de ${prettyFormula(formula)} hidratados`) : `Molécula de ${name}`} description={descCapa} frameKey={`capa-${formula}-${useNaCl}`} height={300}
          caption={ionic
            ? <>iones del kit y agua de PubChem; las aguas se colocan en las 6 direcciones de un octaedro a la distancia de la suma de radios iónicos de Shannon (ion y O²⁻), una estimación del orden de las medidas en disolución. En el agua real la capa cambia de forma continuamente.{useNaCl ? ` Los iones de ${prettyFormula(formula)} (${partNames}) no tienen capa en el kit: el Cu²⁺ no tiene radio iónico en su tabla y los iones poliatómicos no se orientan con esta regla; por eso se muestra el NaCl como ejemplo.` : ''}</>
            : <>confórmero 3D de PubChem. Un soluto molecular no conduce la electricidad: no forma iones.</>} />
      ) : (
        <SpeciesScene3D atoms={box.atoms} bonds={box.bonds} lines={box.lines} idPrefix="sol3dc" title={`Cubo de disolución de ${BOX_NM} nm`} description={descCubo} frameKey={`cubo-${formula}`} height={320}
          caption={<>posiciones al azar (reproducibles) dentro del cubo; el número sale de la concentración {which === 'diluida' && diluted ? 'final (diluida)' : 'de la solución madre'} del laboratorio. Sin las moléculas de agua, que llenarían el cubo (≈ {fmt(WATER_IN_BOX, 0)} con agua de 0,997 g/mL).</>}>
          <p className="small" style={{ margin: '6px 0 0' }} aria-live="polite">
            <strong>{fmtSig(c, 3)} mol/L:</strong> en {BOX_NM} nm × {BOX_NM} nm × {BOX_NM} nm hay en promedio <strong>{fmtSig(n, 3)}</strong> unidades de {prettyFormula(formula)}
            {drawn < Math.round(n) ? ` (se dibujan ${drawn})` : ''}{n < 0.5 ? ': en un cubo tan pequeño, la mayoría de las veces no hay ninguna.' : '.'}
            {diluted && ` Al diluir (${fmtSig(molarity, 3)} → ${fmtSig(finalMolarity, 3)} mol/L) quedan menos partículas en el mismo volumen: los moles no cambian, el volumen crece.`}
          </p>
        </SpeciesScene3D>
      )}
    </div>
  );
}
