/**
 * Pruebas de los modelos de funciones orgánicas y reacciones (prácticas grupos-oxigenados, grupos-nitrogenados, reacciones-organicas):
 * integridad de los datos de PubChem (SHA-256, fórmulas), grupos funcionales, acidez y basicidad, pruebas de laboratorio, geometría
 * de amidas, balanceo, estequiometría, ley de Hess y equilibrio de esterificación. Los valores esperados se calcularon a mano.
 */
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { FUNC_RECORDS, funcSpecies, getFunc } from '../../src/data/quimica/funcionales';
import { classify, detectGroups, hBondSites } from '../../src/models/functionalGroups';
import { hillFormula, molFromMolfile, parseSmiles, stripHydrogens } from '../../src/models/organicGraph';
import {
  ALCOHOL_COMBUSTION_SERIES, amideGeometry, amineGeometry, homologousCheck, ionizedFraction, labTest, pKaAsAcid, pKaH, protonatedFraction, TEST_BANK, weakAcidPH, weakBasePH,
} from '../../src/models/functionalProperties';
import { equationOf, esterEquilibrium, hessEnthalpy, markovnikovAddition, ORG_REACTIONS, oxidizeAlcohol, reactionById, stoichiometry } from '../../src/models/organicReactions';
import { buildReactionScene, checkBalanced, moleculeSpecies, atomSpecies, type Reaction3DDef } from '../../src/chem';
import { reaction3dDef } from '../../src/components/funcional/reaction3dDefs';

const sha = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex');

describe('datos de PubChem (funcionales-moleculas.json)', () => {
  it('cada bloque molfile tiene el SHA-256 registrado y la fórmula de Hill esperada', () => {
    let n3d = 0;
    for (const r of FUNC_RECORDS) {
      if (!r.sdf) continue;
      n3d++;
      expect(sha(r.sdf), r.id).toBe(r.fuente.sha256Bloque);
      const g = stripHydrogens(molFromMolfile(r.sdf).mol).mol;
      expect(hillFormula(g), r.id).toBe(r.formula);
      expect(hillFormula(parseSmiles(r.smiles)), r.id).toBe(r.formula);
    }
    expect(n3d).toBeGreaterThanOrEqual(100);
  });
  it('cada propiedad experimental guarda texto literal, obra citada, base, URL de PUG View y fecha', () => {
    for (const r of FUNC_RECORDS) for (const [k, p] of Object.entries(r.propiedades)) {
      if (!p) continue;
      expect(p.texto.length, `${r.id}.${k}`).toBeGreaterThan(0);
      expect(p.url, `${r.id}.${k}`).toMatch(/^https:\/\/pubchem\.ncbi\.nlm\.nih\.gov\/rest\/pug_view\/data\/compound\/\d+\/JSON\?heading=/);
      expect(p.fecha).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });
  it('valores de referencia (HSDB/CRC) leídos del texto literal', () => {
    expect(getFunc('etanol').propiedades.tEb!.valor).toBeCloseTo(78.24, 2);
    expect(getFunc('acido-etanoico').propiedades.tEb!.valor).toBeCloseTo(117.9, 2);
    expect(getFunc('butano').propiedades.tEb!.valor).toBeCloseTo(-0.5, 2);
    expect(getFunc('propanona').propiedades.tEb!.valor).toBeCloseTo(56.08, 2);
    expect(getFunc('fenol').propiedades.pKa!.valor).toBeCloseTo(9.99, 2);
    expect(getFunc('acido-etanoico').propiedades.pKa!.valor).toBeCloseTo(4.76, 2);
    expect(getFunc('metano').propiedades.dHc!.valor).toBeCloseTo(890.8, 1);
    expect(getFunc('amoniaco').propiedades.pKa).toMatchObject({ tipo: 'pKb', valor: 4.751, temperatura: 25 });
    expect(getFunc('pentan-1-ol').propiedades.solubilidad!.valor).toBeCloseTo(22, 6); // «22,000 mg/L» → 22 g/L
  });
});

describe('grupos funcionales', () => {
  const kinds = (s: string) => detectGroups(parseSmiles(s)).map((g) => g.kind).sort();
  it('reconoce cada clase', () => {
    expect(kinds('CCO')).toEqual(['alcohol']);
    expect(kinds('Oc1ccccc1')).toEqual(['fenol']);
    expect(kinds('CCOCC')).toEqual(['eter']);
    expect(kinds('CC=O')).toEqual(['aldehido']);
    expect(kinds('CC(C)=O')).toEqual(['cetona']);
    expect(kinds('CC(O)=O')).toEqual(['acido']);
    expect(kinds('CCOC(C)=O')).toEqual(['ester']);
    expect(kinds('CC(N)=O')).toEqual(['amida']);
    expect(kinds('CN')).toEqual(['amina']);
    expect(kinds('NC(N)=O')).toEqual(['urea']);
    expect(kinds('CC(=O)Nc1ccc(O)cc1')).toEqual(['amida', 'fenol']);
  });
  it('clasifica alcoholes y aminas en 1.º, 2.º y 3.º', () => {
    const deg = (s: string) => detectGroups(parseSmiles(s)).find((g) => g.kind === 'alcohol' || g.kind === 'amina')!.degree;
    expect(deg('CCO')).toBe('primario'); expect(deg('CC(C)O')).toBe('secundario'); expect(deg('CC(C)(C)O')).toBe('terciario'); expect(deg('CO')).toBe('metanol');
    expect(deg('CCN')).toBe('primario'); expect(deg('CNC')).toBe('secundario'); expect(deg('CN(C)C')).toBe('terciario');
    expect(classify(parseSmiles('CC(C)(C)O')).texto).toBe('alcohol terciario');
  });
  it('cuenta donadores y aceptores de puentes de hidrógeno (también con H explícitos del confórmero)', () => {
    expect(hBondSites(parseSmiles('CCO'))).toMatchObject({ donors: 1, acceptors: 1 });
    expect(hBondSites(parseSmiles('COC'))).toMatchObject({ donors: 0, acceptors: 1 });
    expect(hBondSites(parseSmiles('CC(O)=O'))).toMatchObject({ donors: 1, acceptors: 2 });
    expect(hBondSites(parseSmiles('CN(C)C'))).toMatchObject({ donors: 0, acceptors: 1 });
    expect(hBondSites(parseSmiles('CC(N)=O'))).toMatchObject({ donors: 2, acceptors: 1 });
    expect(hBondSites(molFromMolfile(getFunc('etanol').sdf!).mol)).toMatchObject({ donors: 1, acceptors: 1 });
  });
});

describe('acidez y basicidad (Henderson-Hasselbalch con pKa citados)', () => {
  it('fracción ionizada y pH de ácidos débiles', () => {
    expect(ionizedFraction(4.76, 4.76)).toBeCloseTo(0.5, 12);
    expect(ionizedFraction(4.76, 7)).toBeCloseTo(1 / (1 + 10 ** -2.24), 12);
    expect(weakAcidPH(4.76, 0.1).pH).toBeCloseTo(2.88, 2); // caso de referencia 9.2 del prompt (Ka ≈ 1,8·10⁻⁵ → 2,87)
  });
  it('orden de acidez con los datos: ácidos > fenoles > alcoholes', () => {
    const p = (id: string) => pKaAsAcid(getFunc(id))!.value;
    expect(p('acido-tricloroacetico')).toBeLessThan(p('acido-cloroacetico'));
    expect(p('acido-cloroacetico')).toBeLessThan(p('acido-etanoico'));
    expect(p('acido-etanoico')).toBeLessThan(p('4-nitrofenol'));
    expect(p('4-nitrofenol')).toBeLessThan(p('fenol'));
    expect(p('fenol')).toBeLessThan(p('etanol'));
  });
  it('pKaH de bases: dato directo o pKw − pKb, y pH de 0,10 M', () => {
    expect(pKaH(getFunc('amoniaco'))!.value).toBeCloseTo(9.249, 3);
    expect(pKaH(getFunc('amoniaco'))!.calculated).toBe(true);
    expect(pKaH(getFunc('metanamina'))!.value).toBeCloseTo(10.66, 2);
    expect(pKaH(getFunc('anilina'))!.value).toBeCloseTo(4.6, 2);
    expect(weakBasePH(10.66, 0.1).pH).toBeCloseTo(11.82, 2);
    expect(weakBasePH(4.6, 0.1).pH).toBeCloseTo(8.80, 2);
    expect(protonatedFraction(10.66, 7.4)).toBeGreaterThan(0.999);
  });
});

describe('pruebas de laboratorio (resultado esperado según la bibliografía)', () => {
  const t = (id: string, test: Parameters<typeof labTest>[1]) => labTest(getFunc(id), test).positive;
  it('Tollens y Fehling distinguen aldehídos alifáticos, aromáticos y cetonas', () => {
    expect(t('propanal', 'tollens')).toBe(true); expect(t('propanal', 'fehling')).toBe(true);
    expect(t('benzaldehido', 'tollens')).toBe(true); expect(t('benzaldehido', 'fehling')).toBe(false);
    expect(t('propanona', 'tollens')).toBe(false); expect(t('propanona', 'fehling')).toBe(false);
    expect(t('glucosa', 'fehling')).toBe(true);
  });
  it('FeCl₃ (fenoles), Lucas (3.º inmediato, 2.º lento, 1.º no) y bicarbonato (ácidos)', () => {
    expect(t('fenol', 'fecl3')).toBe(true); expect(t('acido-salicilico', 'fecl3')).toBe(true); expect(t('aspirina', 'fecl3')).toBe(false); expect(t('etanol', 'fecl3')).toBe(false);
    expect(labTest(getFunc('2-metilpropan-2-ol'), 'lucas').time).toMatch(/inmediato/);
    expect(labTest(getFunc('propan-2-ol'), 'lucas').time).toMatch(/5 minutos/);
    expect(t('etanol', 'lucas')).toBe(false);
    expect(t('acido-etanoico', 'bicarbonato')).toBe(true); expect(t('fenol', 'bicarbonato')).toBe(false);
  });
  it('todo el banco tiene resultado para las cinco pruebas', () => {
    for (const id of TEST_BANK) for (const k of ['tollens', 'fehling', 'fecl3', 'lucas', 'bicarbonato'] as const) expect(labTest(getFunc(id), k).observation.length).toBeGreaterThan(5);
  });
});

describe('geometría de amidas y aminas en los confórmeros de PubChem', () => {
  it('la amida es plana y su C–N es más corto que el de una amina', () => {
    const am = amideGeometry(funcSpecies('acetamida'))!;
    const nma = amideGeometry(funcSpecies('n-metilacetamida'))!;
    const amine = amineGeometry(funcSpecies('metanamina'))!;
    expect(am.sumN).toBeGreaterThan(355);
    expect(nma.sumN).toBeGreaterThan(355);
    expect(am.planarity).toBeLessThan(0.1);
    expect(am.dCN).toBeLessThan(amine.dCN - 0.05);
    expect(amine.sumN).toBeLessThan(340);
    expect(am.dCN).toBeGreaterThan(1.3); expect(am.dCN).toBeLessThan(1.42);
  });
});

describe('control de calidad: ΔcH° de la serie de alcoholes', () => {
  it('marca el etanol de PubChem (1336,8 kJ/mol) como incoherente con la serie (residuo < −25 kJ/mol); el resto encaja', () => {
    const rows = homologousCheck(ALCOHOL_COMBUSTION_SERIES);
    const et = rows.find((r) => r.id === 'etanol')!;
    expect(et.flagged).toBe(true);
    expect(et.residual).toBeLessThan(-25);
    expect(rows.filter((r) => r.flagged).map((r) => r.id)).toEqual(['etanol']);
  });
});

describe('reacciones: balanceo (balancing.ts), estequiometría, Hess y equilibrio', () => {
  it('coeficientes calculados por el método algebraico', () => {
    expect(equationOf(reactionById('combustion-metano'))).toBe('CH₄ + 2 O₂ → CO₂ + 2 H₂O');
    expect(equationOf(reactionById('combustion-etanol'))).toBe('C₂H₆O + 3 O₂ → 2 CO₂ + 3 H₂O');
    expect(equationOf(reactionById('combustion-metanol'))).toBe('2 CH₄O + 3 O₂ → 2 CO₂ + 4 H₂O');
    expect(equationOf(reactionById('combustion-incompleta'))).toBe('2 CH₄ + 3 O₂ → 2 CO + 4 H₂O');
    expect(equationOf(reactionById('fermentacion'))).toBe('C₆H₁₂O₆ → 2 C₂H₆O + 2 CO₂');
    expect(equationOf(reactionById('esterificacion'))).toBe('C₂H₄O₂ + C₂H₆O ⇌ C₄H₈O₂ + H₂O');
    expect(equationOf(reactionById('enlace-peptidico'))).toBe('2 C₂H₅NO₂ → C₄H₈N₂O₃ + H₂O');
    expect(equationOf(reactionById('oxidacion-etanol'))).toBe('2 C₂H₆O + O₂ → 2 C₂H₄O + 2 H₂O');
  });
  it('estequiometría: 1 mol de etanol → 2 mol de CO₂ (88,02 g); la masa se conserva', () => {
    const s = stoichiometry(reactionById('combustion-etanol'), 46.069, 100);
    const co2 = s.rows.find((r) => r.formula === 'CO2')!;
    expect(co2.mass).toBeCloseTo(2 * 44.009, 2);
    expect(Math.abs(s.massIn - s.massOut)).toBeLessThan(1e-9);
    expect(stoichiometry(reactionById('combustion-etanol'), 46.069, 80).actualProduct).toBeCloseTo(0.8 * 88.018, 2);
  });
  it('ley de Hess con ΔcH° citados', () => {
    expect(hessEnthalpy(reactionById('combustion-metano')).dH).toBeCloseTo(-890.8, 6);
    expect(hessEnthalpy(reactionById('hidrogenacion-ciclohexeno')).dH).toBeCloseTo(-(3751.7 + 285.8) + 3919.6, 6);
    expect(hessEnthalpy(reactionById('oxidacion-metanol')).dH).toBeCloseTo(2 * (-726.1 + 570.7), 6);
    expect(hessEnthalpy(reactionById('amida')).dH).toBeCloseTo(-874.2 - 382.8 + 1198.7, 6);
    const ester = hessEnthalpy(reactionById('esterificacion'));
    expect(ester.dH).toBeCloseTo(-874.2 - 1336.8 + 2238.1, 6);
    expect(hessEnthalpy(reactionById('fermentacion')).available).toBe(false); // sin ΔcH° de la glucosa en PubChem/HSDB
    expect(hessEnthalpy(reactionById('halogenacion')).available).toBe(false);
  });
  it('equilibrio de esterificación con K = 4', () => {
    expect(esterEquilibrium(1, 1).conversion).toBeCloseTo(2 / 3, 10);
    expect(esterEquilibrium(1, 3).conversion).toBeCloseTo((16 - Math.sqrt(112)) / 6, 10);
    const e = esterEquilibrium(1, 1, 0, 1);
    expect((e.ester * e.water) / (e.acid * e.alcohol)).toBeCloseTo(4, 9);
    const h = esterEquilibrium(0, 0, 1, 1);
    expect(h.ester).toBeCloseTo(2 / 3, 10); // la hidrólisis llega al mismo equilibrio desde el otro lado
    expect(h.direction).toBe('hacia los reactivos');
  });
  it('Markovnikov y oxidación de alcoholes sobre el grafo (nombrados por el motor)', () => {
    const p = markovnikovAddition('C=CC', 'HBr');
    expect(p.major.name).toBe('2-bromopropano'); expect(p.minor?.name).toBe('1-bromopropano');
    expect(markovnikovAddition('C=C(C)C', 'H2O').major.name).toBe('2-metilpropan-2-ol');
    expect(oxidizeAlcohol('CCO').steps.map((s) => s.name)).toEqual(['acetaldehído', 'ácido acético']);
    expect(oxidizeAlcohol('CC(C)O').steps.map((s) => s.name)).toEqual(['propan-2-ona']);
    expect(oxidizeAlcohol('CC(C)(C)O').steps).toEqual([]);
  });
  it('cada reacción construye su escena 3D con conservación de átomos', () => {
    for (const r of ORG_REACTIONS) {
      const def: Reaction3DDef = reaction3dDef(r);
      expect(checkBalanced(def).balanced, r.id).toBe(true);
      const scene = buildReactionScene(def);
      expect(scene.atoms.length, r.id).toBeGreaterThan(0);
    }
    void moleculeSpecies; void atomSpecies;
    expect(ORG_REACTIONS.length).toBe(24);
  });
});
