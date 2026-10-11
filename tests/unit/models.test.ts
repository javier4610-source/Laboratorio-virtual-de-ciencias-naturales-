import { describe, expect, it } from 'vitest';
import { chiSquarePValue, linearRegression, roundToResolution, seededRandom } from '../../src/models/math';
import { closestMaterial, simulateDensity } from '../../src/models/density';
import {
  equilibriumVolume, naclOsmolarity, osmoticPressureKPa, simulateDiffusion, simulateOsmosis, BAG_VOLUME_ML, BEAKER_VOLUME_ML,
} from '../../src/models/osmosis';
import {
  chiSquareTest, findOrganism, genotypeDistribution, MENDEL_HISTORICAL, phenotypeDistribution, punnettSquare, ratioString, sampleOffspring,
} from '../../src/models/mendel';
import {
  analyzeMutation, complement, DNA_PRESETS, GENETIC_CODE, replicate, transcribe, translate, validateDNA,
} from '../../src/models/dna';
import { molarMass, parseFormula } from '../../src/models/chemistry';
import { dilute, prepareSolution, solutionColor, findSolute } from '../../src/models/solutions';
import { findEnzyme, initialRate, optimalTemperature, simulateEnzyme } from '../../src/models/enzyme';
import { solveCircuit, type CircuitInput } from '../../src/models/circuits';
import { checkBalance, REACTIONS, simulateStoichiometry } from '../../src/models/stoichiometry';
import { simulatePopulation, logisticAt } from '../../src/models/population';

describe('utilidades numéricas', () => {
  it('redondea a la resolución del instrumento sin errores de coma flotante', () => {
    expect(roundToResolution(21.6000001, 0.1)).toBe(21.6);
    expect(roundToResolution(0.0316, 0.001)).toBe(0.032);
    expect(roundToResolution(57.26, 0.5)).toBe(57.5);
  });
  it('el generador con semilla es reproducible', () => {
    const a = seededRandom(42), b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
  it('regresión lineal exacta en datos perfectos', () => {
    const r = linearRegression([1, 2, 3, 4], [3, 5, 7, 9])!;
    expect(r.slope).toBeCloseTo(2, 10);
    expect(r.intercept).toBeCloseTo(1, 10);
    expect(r.r2).toBeCloseTo(1, 10);
  });
  it('valor p de chi-cuadrado coincide con valores críticos de tabla', () => {
    expect(chiSquarePValue(3.841, 1)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(5.991, 2)).toBeCloseTo(0.05, 3);
    expect(chiSquarePValue(7.815, 3)).toBeCloseTo(0.05, 3);
  });
});

describe('densidad (6.º)', () => {
  it('cubo de aluminio de 2 cm', () => {
    const r = simulateDensity({ materialId: 'aluminio', side: 2, initialWater: 50, pushUnder: false });
    expect(r.massReading).toBe(21.6);
    expect(r.geometricVolume).toBeCloseTo(8, 6);
    expect(r.displacedVolume).toBe(8);
    expect(r.densityDisplacement).toBeCloseTo(2.7, 2);
    expect(r.floats).toBe(false);
  });
  it('la densidad no depende del tamaño de la muestra', () => {
    const d = [1.5, 2, 2.5, 3].map((a) => simulateDensity({ materialId: 'hierro', side: a, initialWater: 40, pushUnder: false }).densityGeometric!);
    d.forEach((x) => expect(x).toBeCloseTo(7.87, 1));
  });
  it('un objeto que flota desplaza menos agua que su volumen salvo que se hunda con alfiler', () => {
    const libre = simulateDensity({ materialId: 'corcho', side: 3, initialWater: 50, pushUnder: false });
    const hundido = simulateDensity({ materialId: 'corcho', side: 3, initialWater: 50, pushUnder: true });
    expect(libre.floats).toBe(true);
    expect(libre.displacedVolume!).toBeLessThan(27);
    expect(hundido.displacedVolume).toBe(27);
    expect(hundido.densityDisplacement!).toBeCloseTo(0.24, 1);
  });
  it('detecta el desbordamiento de la probeta', () => {
    const r = simulateDensity({ materialId: 'plomo', side: 3.4, initialWater: 70, pushUnder: false });
    expect(r.finalWaterReading).toBeNull();
    expect(r.warnings.join(' ')).toMatch(/desborda/);
  });
  it('muestras pequeñas tienen mayor error relativo por la resolución de la probeta', () => {
    const small = simulateDensity({ materialId: 'vidrio', side: 1.3, initialWater: 50, pushUnder: false });
    const big = simulateDensity({ materialId: 'vidrio', side: 3.1, initialWater: 50, pushUnder: false });
    const err = (x: number) => Math.abs(x - 2.5) / 2.5;
    expect(err(small.densityDisplacement!)).toBeGreaterThan(err(big.densityDisplacement!));
  });
  it('rechaza valores fuera de rango', () => {
    expect(() => simulateDensity({ materialId: 'vidrio', side: 10, initialWater: 50, pushUnder: false })).toThrow(RangeError);
  });
  it('identifica las muestras misteriosas por su densidad', () => {
    const r = simulateDensity({ materialId: 'misterio-b', side: 2, initialWater: 50, pushUnder: false });
    expect(closestMaterial(r.densityGeometric!).id).toBe('cobre');
  });
});

describe('ósmosis y difusión (7.º)', () => {
  it('NaCl 0,9 % ≈ 0,308 Osm/L (solución fisiológica)', () => {
    expect(naclOsmolarity(0.9)).toBeCloseTo(0.308, 3);
  });
  it('presión osmótica de 0,3 Osm/L a 25 °C ≈ 744 kPa', () => {
    expect(osmoticPressureKPa(0.3, 25)).toBeCloseTo(743.7, 0);
  });
  it('solución isotónica: cambio de volumen menor al 2 %', () => {
    const r = simulateOsmosis({ cellType: 'animal', naclPercent: 0.9, temperature: 25, duration: 120 });
    expect(Math.abs(r.finalChangePercent)).toBeLessThan(2);
    expect(r.lysedAt).toBeNull();
  });
  it('agua destilada: la célula animal se lisa y la vegetal queda turgente', () => {
    const a = simulateOsmosis({ cellType: 'animal', naclPercent: 0, temperature: 25, duration: 120 });
    const v = simulateOsmosis({ cellType: 'vegetal', naclPercent: 0, temperature: 25, duration: 180 });
    expect(a.state).toBe('lisis');
    expect(v.state).toBe('turgente');
    expect(v.finalVolume).toBeLessThan(1.2);
    expect(v.series[v.series.length - 1].turgor).toBeGreaterThan(300);
  });
  it('NaCl 3 %: crenación (animal) y plasmólisis (vegetal)', () => {
    expect(simulateOsmosis({ cellType: 'animal', naclPercent: 3, temperature: 25, duration: 120 }).state).toBe('crenada');
    expect(simulateOsmosis({ cellType: 'vegetal', naclPercent: 3, temperature: 25, duration: 120 }).state).toBe('plasmólisis');
  });
  it('regresión: tonicidad, dirección del agua y estado son coherentes', () => {
    for (const cellType of ['animal', 'vegetal'] as const) {
      for (let pct = 0; pct <= 3; pct += 0.05) {
        const r = simulateOsmosis({ cellType, naclPercent: Number(pct.toFixed(2)), temperature: 25, duration: 180 });
        if (r.tonicity === 'isotónica') {
          expect(r.waterDirection, `${cellType} ${pct}`).toBe('sin flujo neto');
          expect(['isotónica', 'normal']).toContain(r.state);
        }
        if (r.tonicity === 'hipertónica') expect(r.waterDirection, `${cellType} ${pct}`).toBe('sale');
        if (r.tonicity === 'hipotónica') expect(r.waterDirection, `${cellType} ${pct}`).toBe('entra');
      }
    }
    const fisio = simulateOsmosis({ cellType: 'animal', naclPercent: 0.9, temperature: 25, duration: 60 });
    expect(fisio.tonicity).toBe('isotónica');
    expect(fisio.state).toBe('isotónica');
  });
  it('el volumen final tiende al equilibrio analítico', () => {
    const r = simulateOsmosis({ cellType: 'animal', naclPercent: 2, temperature: 25, duration: 180 });
    expect(r.finalVolume).toBeCloseTo(equilibriumVolume('animal', naclOsmolarity(2)), 2);
  });
  it('mayor temperatura → equilibrio más rápido', () => {
    const at = (T: number) => simulateOsmosis({ cellType: 'animal', naclPercent: 2, temperature: T, duration: 10 }).finalVolume;
    expect(at(37)).toBeLessThan(at(5)); // a 37 °C ya se encogió más en 10 s
  });
  it('la difusión conserva la masa y tiende al equilibrio', () => {
    const r = simulateDiffusion({ temperature: 25, area: 10, glucoseInside0: 20, iodineOutside0: 1, starchInside: true, duration: 60 });
    for (const p of r.series) {
      expect(p.glucoseIn * BAG_VOLUME_ML + p.glucoseOut * BEAKER_VOLUME_ML).toBeCloseTo(20 * BAG_VOLUME_ML, 6);
    }
    const ceq = (20 * BAG_VOLUME_ML) / (BAG_VOLUME_ML + BEAKER_VOLUME_ML);
    expect(r.final.glucoseOut).toBeLessThanOrEqual(ceq + 1e-9);
    expect(r.halfTimeGlucose).toBeGreaterThan(5);
    expect(r.halfTimeGlucose).toBeLessThan(15);
    expect(r.bagTurnsBlue).toBe(true);
  });
  it('la difusión es más rápida a mayor temperatura y con mayor área', () => {
    const base = { area: 10, glucoseInside0: 20, iodineOutside0: 1, starchInside: true, duration: 10 };
    const cold = simulateDiffusion({ ...base, temperature: 5 });
    const hot = simulateDiffusion({ ...base, temperature: 50 });
    const big = simulateDiffusion({ ...base, temperature: 5, area: 20 });
    expect(hot.halfTimeGlucose).toBeLessThan(cold.halfTimeGlucose);
    expect(big.halfTimeGlucose).toBeCloseTo(cold.halfTimeGlucose / 2, 6);
  });
});

describe('genética mendeliana (8.º)', () => {
  const pea = findOrganism('guisante');
  const snap = findOrganism('boca-dragon');
  it('monohíbrido Yy × Yy → 1:2:1 y 3:1', () => {
    const g = genotypeDistribution(['Yy'], ['Yy'], [pea.genes[0]]);
    expect(g.find((c) => c.key === 'Yy')!.probability).toBeCloseTo(0.5);
    expect(g.find((c) => c.key === 'YY')!.probability).toBeCloseTo(0.25);
    const p = phenotypeDistribution(['Yy'], ['Yy'], [pea.genes[0]]);
    expect(ratioString(p)).toBe('3 : 1');
  });
  it('dihíbrido → 9:3:3:1 con 16 casillas', () => {
    const genes = pea.genes.slice(0, 2);
    const sq = punnettSquare(['Yy', 'Rr'], ['Yy', 'Rr'], genes);
    expect(sq.rows.length * sq.cols.length).toBe(16);
    expect(ratioString(phenotypeDistribution(['Yy', 'Rr'], ['Yy', 'Rr'], genes))).toBe('9 : 3 : 3 : 1');
  });
  it('cruce de prueba → 1:1', () => {
    expect(ratioString(phenotypeDistribution(['Yy'], ['yy'], [pea.genes[0]]))).toBe('1 : 1');
  });
  it('dominancia incompleta → 1:2:1 fenotípico', () => {
    const p = phenotypeDistribution(['Rr'], ['Rr'], [snap.genes[0]]);
    expect(p.find((c) => c.key === 'rosada')!.probability).toBeCloseTo(0.5);
  });
  it('la muestra se acerca a lo esperado con N grande y es reproducible', () => {
    const genes = [pea.genes[0]];
    const big = sampleOffspring(['Yy'], ['Yy'], genes, 20000, 7);
    expect(big.get('amarilla')! / 20000).toBeCloseTo(0.75, 1);
    expect(sampleOffspring(['Yy'], ['Yy'], genes, 50, 3)).toEqual(sampleOffspring(['Yy'], ['Yy'], genes, 50, 3));
  });
  it('los datos de Mendel (5474:1850) son compatibles con 3:1', () => {
    const obs = new Map(Object.entries(MENDEL_HISTORICAL.monohybridShape));
    const res = chiSquareTest(obs, [{ key: 'lisa', probability: 0.75 }, { key: 'rugosa', probability: 0.25 }]);
    expect(res.chi2).toBeCloseTo(0.263, 2);
    expect(res.consistent).toBe(true);
  });
  it('datos muy alejados se rechazan', () => {
    const res = chiSquareTest(new Map([['lisa', 50], ['rugosa', 50]]), [{ key: 'lisa', probability: 0.75 }, { key: 'rugosa', probability: 0.25 }]);
    expect(res.consistent).toBe(false);
  });
});

describe('dogma central (9.º)', () => {
  it('complementariedad y transcripción', () => {
    expect(complement('ATGC')).toBe('TACG');
    expect(transcribe('ATGGCC')).toBe('AUGGCC');
    expect(validateDNA('ATGX')).toMatch(/no es una base/);
    const rep = replicate('ATGC');
    expect(rep.daughter1.new).toBe('TACG');
    expect(rep.daughter2.old).toBe('TACG');
    expect(rep.daughter2.new).toBe('ATGC');
  });
  it('código genético estándar', () => {
    expect(Object.keys(GENETIC_CODE)).toHaveLength(64);
    expect(GENETIC_CODE.AUG).toBe('M');
    expect(['UAA', 'UAG', 'UGA'].map((c) => GENETIC_CODE[c])).toEqual(['*', '*', '*']);
    expect(GENETIC_CODE.UGG).toBe('W');
    expect(GENETIC_CODE.GAG).toBe('E');
    expect(GENETIC_CODE.GUG).toBe('V');
    expect(GENETIC_CODE.AGA).toBe('R');
    expect(Object.values(GENETIC_CODE).filter((a) => a === 'L')).toHaveLength(6);
  });
  it('traduce el gen de práctica', () => {
    const t = translate(transcribe(DNA_PRESETS[0].coding));
    expect(t.protein).toBe('MAKFGWH');
    expect(t.stopFound).toBe(true);
  });
  it('β-globina: inicio MVHLTPEEK y mutación falciforme Glu→Val', () => {
    const hbb = DNA_PRESETS[1].coding;
    expect(hbb.length).toBe(93);
    expect(translate(transcribe(hbb)).protein).toBe('MVHLTPEEKSAVTALWGKVNVDEVGGEALGR');
    const a = analyzeMutation(hbb, { type: 'sustitucion', position: 20, base: 'T' });
    expect(a.effect).toBe('de sentido erróneo');
    expect(a.mutated.protein[6]).toBe('V');
    expect(a.changedPositions).toEqual([7]);
  });
  it('clasifica mutaciones silenciosas, sin sentido y de corrimiento', () => {
    const seq = DNA_PRESETS[0].coding; // ATG GCC AAA TTT GGC TGG CAT TAA
    expect(analyzeMutation(seq, { type: 'sustitucion', position: 6, base: 'A' }).effect).toBe('silenciosa'); // GCC→GCA
    expect(analyzeMutation(seq, { type: 'sustitucion', position: 7, base: 'T' }).effect).toBe('sin sentido'); // AAA→TAA
    expect(analyzeMutation(seq, { type: 'delecion', position: 8 }).effect).toBe('corrimiento del marco de lectura');
    expect(analyzeMutation(seq, { type: 'sustitucion', position: 2, base: 'C' }).effect).toBe('afecta el codón de inicio');
  });
});

describe('química y soluciones (10.º)', () => {
  it('masas molares', () => {
    expect(molarMass('H2O')).toBeCloseTo(18.015, 3);
    expect(molarMass('NaCl')).toBeCloseTo(58.44, 2);
    expect(molarMass('CuSO4·5H2O')).toBeCloseTo(249.68, 1);
    expect(molarMass('Ca(OH)2')).toBeCloseTo(74.09, 1);
    expect(parseFormula('CH3COOH')).toEqual({ C: 2, H: 4, O: 2 });
    expect(() => parseFormula('Xx2')).toThrow();
  });
  it('5,844 g de NaCl en 100 mL → ~1,000 mol/L', () => {
    const r = prepareSolution({ soluteId: 'nacl', mass: 5.844, flaskVolume: 100 });
    expect(r.molarity).toBeCloseTo(1.0, 3);
    expect(r.percentMV).toBeCloseTo(5.844, 3);
  });
  it('dilución C1V1 = C2V2', () => {
    expect(dilute(1, 10, 100)).toBeCloseTo(0.1);
    expect(() => dilute(1, 200, 100)).toThrow();
    const r = prepareSolution({ soluteId: 'cuso4', mass: 2.5, flaskVolume: 100, dilution: { aliquot: 10, dilutionFlask: 100 } });
    expect(r.dilutionFactor).toBe(10);
    expect(r.finalMolarity).toBeCloseTo(r.molarity / 10, 10);
  });
  it('Beer-Lambert: absorbancia proporcional a la concentración', () => {
    const a1 = prepareSolution({ soluteId: 'kmno4', mass: 0.01, flaskVolume: 250 }).absorbance!;
    const a2 = prepareSolution({ soluteId: 'kmno4', mass: 0.02, flaskVolume: 250 }).absorbance!;
    expect(a2 / a1).toBeCloseTo(2, 6);
  });
  it('saturación: la concentración deja de aumentar', () => {
    const r1 = prepareSolution({ soluteId: 'kmno4', mass: 10, flaskVolume: 100 });
    const r2 = prepareSolution({ soluteId: 'kmno4', mass: 20, flaskVolume: 100 });
    expect(r1.saturated).toBe(true);
    expect(r1.molarity).toBeCloseTo(r2.molarity, 10);
  });
  it('color visual más intenso a mayor concentración', () => {
    const s = findSolute('cuso4');
    expect(solutionColor(s, 0.01)).not.toBe(solutionColor(s, 0.4));
  });
});

describe('enzimas (10.º)', () => {
  const amy = findEnzyme('amilasa');
  it('[S] = Km → v = Vmax/2', () => {
    const vmaxApprox = initialRate(amy, 25, amy.pHopt, 1e6, 1);
    expect(initialRate(amy, 25, amy.pHopt, amy.km, 1)).toBeCloseTo(vmaxApprox / 2, 3);
  });
  it('óptimos de temperatura y pH coherentes', () => {
    const tOpt = optimalTemperature(amy);
    expect(tOpt).toBeGreaterThan(35);
    expect(tOpt).toBeLessThan(45);
    expect(initialRate(amy, 70, 7, 10, 1)).toBeLessThan(0.05 * initialRate(amy, tOpt, 7, 10, 1));
    const pep = findEnzyme('pepsina');
    expect(initialRate(pep, 37, 2, 10, 1)).toBeGreaterThan(10 * initialRate(pep, 37, 7, 10, 1));
    expect(initialRate(amy, 37, 7, 10, 1)).toBeGreaterThan(10 * initialRate(amy, 37, 2, 10, 1));
  });
  it('duplicar la enzima duplica la velocidad inicial', () => {
    expect(initialRate(amy, 37, 7, 10, 2)).toBeCloseTo(2 * initialRate(amy, 37, 7, 10, 1), 10);
  });
  it('el producto nunca supera el sustrato inicial', () => {
    const r = simulateEnzyme({ enzymeId: 'catalasa', temperature: 37, pH: 7, substrate: 5, enzyme: 2, duration: 20 });
    expect(r.productFinal).toBeLessThanOrEqual(5);
    r.series.forEach((p) => expect(p.product + p.substrate).toBeCloseTo(5, 6));
  });
});

describe('circuitos (11.º)', () => {
  const base: CircuitInput = { topology: 'serie', emf: 6, internalResistance: 0, resistances: [10, 10, 10], closed: [true, true, true], mainSwitch: true };
  it('serie', () => {
    const r = solveCircuit(base);
    expect(r.equivalentResistance).toBeCloseTo(30);
    expect(r.totalCurrent).toBeCloseTo(0.2);
    r.elements.forEach((e) => expect(e.voltage).toBeCloseTo(2));
  });
  it('paralelo', () => {
    const r = solveCircuit({ ...base, topology: 'paralelo' });
    expect(r.equivalentResistance).toBeCloseTo(10 / 3);
    expect(r.totalCurrent).toBeCloseTo(1.8);
    expect(r.elements.reduce((s, e) => s + e.current, 0)).toBeCloseTo(r.totalCurrent, 10);
  });
  it('mixto y leyes de Kirchhoff con resistencia interna', () => {
    const r = solveCircuit({ ...base, topology: 'mixto', internalResistance: 1, resistances: [5, 20, 30] });
    expect(r.equivalentResistance).toBeCloseTo(17);
    const [e1, e2, e3] = r.elements;
    expect(e1.voltage + e2.voltage + r.totalCurrent * 1).toBeCloseTo(6, 10); // malla
    expect(e2.voltage).toBeCloseTo(e3.voltage, 10);
    expect(e2.current + e3.current).toBeCloseTo(e1.current, 10); // nodo
    expect(r.totalPower + r.internalLoss).toBeCloseTo(6 * r.totalCurrent, 10); // energía
  });
  it('interruptores: serie se apaga, paralelo sigue', () => {
    expect(solveCircuit({ ...base, closed: [true, false, true] }).totalCurrent).toBe(0);
    const p = solveCircuit({ ...base, topology: 'paralelo', closed: [true, false, true] });
    expect(p.elements[1].current).toBe(0);
    expect(p.elements[0].current).toBeCloseTo(0.6);
    expect(solveCircuit({ ...base, mainSwitch: false }).open).toBe(true);
  });
  it('ley de Ohm: I proporcional a V', () => {
    const i1 = solveCircuit({ ...base, emf: 3 }).totalCurrent;
    const i2 = solveCircuit({ ...base, emf: 6 }).totalCurrent;
    expect(i2 / i1).toBeCloseTo(2, 10);
  });
});

describe('estequiometría (11.º)', () => {
  it('todas las reacciones del catálogo están balanceadas', () => {
    for (const r of REACTIONS) {
      expect(checkBalance(r, r.reactants.map((s) => s.coef), r.products.map((s) => s.coef)).balanced, r.id).toBe(true);
    }
  });
  it('detecta ecuaciones no balanceadas', () => {
    const agua = REACTIONS.find((r) => r.id === 'agua')!;
    expect(checkBalance(agua, [1, 1], [1]).balanced).toBe(false);
    expect(checkBalance(agua, [4, 2], [4]).balanced).toBe(true);
  });
  it('conservación de la masa y proporciones exactas', () => {
    const r = simulateStoichiometry({ reactionId: 'agua', massA: 4.032, massB: 31.998, yieldPercent: 100 });
    expect(r.theoreticalProducts[0]).toBeCloseTo(36.03, 2);
    expect(r.excess[0]).toBeCloseTo(0, 6);
    expect(r.excess[1]).toBeCloseTo(0, 6);
    for (const id of REACTIONS.map((x) => x.id)) {
      const s = simulateStoichiometry({ reactionId: id, massA: 13, massB: 27, yieldPercent: 100 });
      expect(s.massAfterTheoretical).toBeCloseTo(s.massBefore, 6);
    }
  });
  it('el reactivo en exceso no cambia el producto', () => {
    const a = simulateStoichiometry({ reactionId: 'bicarbonato-vinagre', massA: 8.4, massB: 20, yieldPercent: 100 });
    const b = simulateStoichiometry({ reactionId: 'bicarbonato-vinagre', massA: 8.4, massB: 40, yieldPercent: 100 });
    expect(a.limiting).toBe(0);
    expect(a.theoreticalProducts[2]).toBeCloseTo(b.theoreticalProducts[2], 10);
    expect(a.theoreticalProducts[2]).toBeCloseTo(4.4, 1); // 0,1 mol de CO2
  });
});

describe('población (11.º)', () => {
  it('logístico tiende a K; con cosecha a K(1 − h/r)', () => {
    expect(simulatePopulation({ n0: 20, r: 0.5, k: 1000, h: 0, years: 100, model: 'logistico' }).finalN).toBeCloseTo(1000, 0);
    expect(simulatePopulation({ n0: 20, r: 0.5, k: 1000, h: 0.2, years: 100, model: 'logistico' }).finalN).toBeCloseTo(600, 0);
    expect(simulatePopulation({ n0: 200, r: 0.5, k: 1000, h: 0.6, years: 100, model: 'logistico' }).extinct).toBe(true);
  });
  it('exponencial duplica cada ln2/r', () => {
    const r = simulatePopulation({ n0: 10, r: 0.5, k: 1000, h: 0, years: 10, model: 'exponencial' });
    expect(r.doublingTime).toBeCloseTo(Math.LN2 / 0.5);
    expect(r.finalN).toBeCloseTo(10 * Math.exp(5), 6);
  });
  it('la solución analítica coincide con integración numérica', () => {
    let n = 20; const dt = 0.001;
    for (let t = 0; t < 10; t += dt) n += dt * (0.5 * n * (1 - n / 1000) - 0.1 * n);
    expect(logisticAt(20, 0.5, 1000, 0.1, 10)).toBeCloseTo(n, 0);
  });
});
