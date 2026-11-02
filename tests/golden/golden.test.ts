/**
 * Línea base de regresión («valores dorados»), Fase 1 del programa v2.
 *
 * Un caso por práctica con entrada fija y salida esperada. Cada caso declara su origen:
 *  - «independiente»: el valor esperado se obtuvo a mano con la fórmula o la convención citada, sin usar el modelo.
 *  - «referencia»: valor de tabla o de los casos de referencia del prompt maestro (secciones 9.1 y 9.2).
 *  - «línea base»: no hay un cálculo independiente sencillo (simulaciones con muchos pasos); se protege la salida
 *    actual del modelo con una instantánea. Si cambia, la prueba falla y el cambio debe justificarse.
 * La última prueba exige que toda práctica del catálogo tenga su caso.
 */
import { forge, type ForgeInput } from '../../src/models/compoundForge';
import { closestApproachFm, rutherfordAngle, rutherfordRate, rutherfordSetup, transition } from '../../src/models/atomicModels';
import { periodicElement, slaterZeff, trend, periodMembers } from '../../src/models/periodicTrends';
import { checkLewis, classifyBond, lewisById } from '../../src/models/chemicalBonding';
import { chargesFrom, coulombStation, fieldAt, PRESETS } from '../../src/models/electrostatics';
import { analyzeBoxes, aufbauOccupancy, groundState, hundBoxes, nobleGasString, tablePlace } from '../../src/models/electronConfiguration';
import { cell as galvanicCell, discharge as galvanicDischarge, FARADAY } from '../../src/models/electrochemicalCell';
import { expectedFrequencies, gameteCombinations, meiosisGametes, stageCounts } from '../../src/models/meiosis';
import { describe, expect, test } from 'vitest';
import { CATALOG } from '../../src/curriculum/catalog';
import { solvePH } from '../../src/models/acidbase';
import { molarMass } from '../../src/models/chemistry';
import { buoyantForce } from '../../src/models/buoyancy';
import { solveCircuit } from '../../src/models/circuits';
import { finalVelocities } from '../../src/models/collisions';
import { diffusivity } from '../../src/models/conduction';
import { sampleResistance } from '../../src/models/conductors';
import { decayConstant, DECOMP_DEFAULTS } from '../../src/models/decomposition';
import { simulateDensity } from '../../src/models/density';
import { reverseComplement } from '../../src/models/dna';
import { bromothymolName } from '../../src/models/ecosystem';
import { simulateTrack } from '../../src/models/energy';
import { DRIFT_TOLERANCE, simulateFall } from '../../src/models/energyTime';
import { findEnzyme, initialRate } from '../../src/models/enzyme';
import { vantHoff } from '../../src/models/equilibrium';
import { carryingCapacity, K_NORMAL } from '../../src/models/foodweb';
import { simulateGas } from '../../src/models/gases';
import { relativeToTss, TSS } from '../../src/models/geneExpression';
import { burn, dissolve, molar } from '../../src/models/oxidesHydroxides';
import { saltSolution, titrationPH } from '../../src/models/acidsSalts';
import { buildCompound } from '../../src/models/inorganicNomenclature';
import { combustionEquation, combustionEnergy, monohalogenation } from '../../src/models/hydrocarbons';
import { getOrganic } from '../../src/data/quimica/organica';
import { huckelAnalysis, symmetricEigenvalues } from '../../src/models/aromaticity';
import { parseSmiles } from '../../src/models/organicGraph';
import { nameSmiles } from '../../src/models/organicNomenclature';
import { weakAcidPH, ionizedFraction } from '../../src/models/functionalProperties';
import { nameFunctionalSmiles } from '../../src/models/functionalNomenclature';
import { detectGroups } from '../../src/models/functionalGroups';
import { weakBasePH, pKaH, amideGeometry, amineGeometry } from '../../src/models/functionalProperties';
import { funcSpecies, getFunc } from '../../src/data/quimica/funcionales';
import { esterEquilibrium, equationOf, hessEnthalpy, reactionById } from '../../src/models/organicReactions';
import { kineticEnergy, simulateDrop } from '../../src/models/kineticPotential';
import { REFERENCE_CONDITION, runFba } from '../../src/models/metabolism';
import { heat } from '../../src/models/heat';
import { dipoleField } from '../../src/models/induction';
import { fringeSpacingSmallAngle } from '../../src/models/interference';
import { brakingStopTime } from '../../src/models/kinematics';
import { molarVolume } from '../../src/models/kinetics';
import { airDensity } from '../../src/models/massConservation';
import { findOrganism, phenotypeDistribution, ratioString } from '../../src/models/mendel';
import { totalMagnification } from '../../src/models/microscope';
import { expectedFractions, findTissue } from '../../src/models/mitosis';
import { evaporationMinutes } from '../../src/models/mixtures';
import { findMover, stopDistance, timeToReach } from '../../src/models/motion';
import { positionAt } from '../../src/models/newton';
import { criticalAngle } from '../../src/models/optics';
import { osmoticPressureKPa } from '../../src/models/osmosis';
import { smallAnglePeriod } from '../../src/models/pendulum';
import { irradiance } from '../../src/models/photosynthesis';
import { hardyWeinberg } from '../../src/models/popgen';
import { logisticAt } from '../../src/models/population';
import { hydrostaticGauge } from '../../src/models/pressure';
import { idealRange } from '../../src/models/projectile';
import { rqFromFormula } from '../../src/models/respiration';
import { survival } from '../../src/models/selection';
import { lampResistanceAt } from '../../src/models/simpleCircuits';
import { leverEffort } from '../../src/models/simpleMachines';
import { dilute } from '../../src/models/solutions';
import { speedOfSound } from '../../src/models/soundResonance';
import { doSaturation } from '../../src/models/waterQuality';
import { normalizeSequence, wallaceTm } from '../../src/models/dnaExtraction';
import { AVOGADRO, countEntities } from '../../src/models/mole';
import { analyze, collect } from '../../src/models/inquiry';
import { angleTable, parseSdf } from '../../src/models/geometry';
import { BUNDLED_CONFORMERS } from '../../src/data/conformers';
import { translateSeq } from '../../src/models/sequences';
import { consequenceFromHgvs, geneByKey } from '../../src/models/geneTrace';
import { findAtom, measureDistance, parseStructure } from '../../src/models/protein';
import { readFileSync } from 'node:fs';
import biopython from '../fixtures/biopython-secuencias.json';
import { ropeSpeed } from '../../src/models/waves';
import { idealAdvantage } from '../../src/models/workPower';

type Origin = 'independiente' | 'referencia' | 'línea base';
interface GoldenCase { id: string; origin: Origin; what: string; run: () => void }

const close = (got: number, want: number, tol: number) => expect(Math.abs(got - want)).toBeLessThanOrEqual(tol);
const nm = 1e-9, um = 1e-6;

export const GOLDEN: GoldenCase[] = [
  // 6.º
  { id: 'densidad', origin: 'independiente', what: 'cubo de corcho (ρ = 0,24 g/cm³) de 2 cm: V = 8 cm³, m = 1,92 g', run: () => {
    const r = simulateDensity({ materialId: 'corcho', side: 2, initialWater: 50, pushUnder: false });
    close(r.trueVolume, 8, 1e-12); close(r.trueMass, 1.92, 1e-12); expect(r.floats).toBe(true);
  } },
  { id: 'mezclas', origin: 'línea base', what: 'tiempo para evaporar 50 g de agua con 300 W', run: () => {
    expect(+evaporationMinutes(50, 300).toFixed(6)).toMatchSnapshot();
  } },
  { id: 'celulas', origin: 'independiente', what: 'aumento total = ocular 10× · objetivo 40× = 400×', run: () => {
    expect(totalMagnification(40)).toBe(400);
  } },
  { id: 'redes', origin: 'línea base', what: 'capacidad de carga con 40 % de la lluvia normal (definición del modelo: proporcional)', run: () => {
    close(carryingCapacity(40), 0.4 * K_NORMAL, 1e-9);
  } },
  { id: 'maquinas', origin: 'independiente', what: 'palanca: F·dF = R·dR → 100 N · 0,2 m / 0,4 m = 50 N', run: () => {
    close(leverEffort(100, 0.2, 0.4), 50, 1e-12);
  } },
  { id: 'calor', origin: 'independiente', what: 'Q = m·c·ΔT = 0,2 · 4186 · 10 = 8372', run: () => {
    close(heat(0.2, 4186, 10), 8372, 1e-9);
  } },
  { id: 'movimiento', origin: 'independiente', what: 'corredor a 4,5 m/s recorre 20 m en 20/4,5 = 4,444 s; balón (6 m/s, frena 0,4 m/s²) se detiene a v²/2a = 45 m', run: () => {
    close(timeToReach(findMover('corredor'), 20)!, 20 / 4.5, 1e-9);
    close(stopDistance(findMover('balon')), 45, 1e-9);
  } },
  { id: 'ecosistema', origin: 'referencia', what: 'azul de bromotimol: amarillo a pH 6,0, verde a 7,0 y azul a 7,6 (intervalo de viraje 6,0–7,6)', run: () => {
    expect([6, 7, 7.6].map(bromothymolName)).toEqual(['amarillo', 'verde', 'azul']);
  } },
  // 7.º
  { id: 'osmosis', origin: 'independiente', what: 'π = c·R·T = 0,3 osmol/L · 8,314 · 298,15 K = 743,69 kPa', run: () => {
    close(osmoticPressureKPa(0.3, 25), 743.687, 0.01);
  } },
  { id: 'presion', origin: 'independiente', what: 'p = ρ·g·h = 1000 · 9,8 · 10 = 98 000 Pa', run: () => {
    close(hydrostaticGauge(1000, 10, 9.8), 98000, 1e-6);
  } },
  { id: 'flotacion', origin: 'independiente', what: 'E = ρ·g·V = 1000 · 9,8 · 100 cm³ = 0,98 N', run: () => {
    close(buoyantForce(1000, 100, 9.8), 0.98, 1e-12);
  } },
  { id: 'conduccion', origin: 'independiente', what: 'difusividad del cobre α = k/(ρ·c) = 400/(8960·385) = 1,1596×10⁻⁴ m²/s', run: () => {
    close(diffusivity({ k: 400, rho: 8960, c: 385 }), 1.15955e-4, 1e-9);
  } },
  { id: 'mitosis', origin: 'línea base', what: 'fracciones esperadas de fases en el meristemo (deben sumar 1)', run: () => {
    const f = expectedFractions(findTissue('meristemo'));
    close(Object.values(f).reduce((s, x) => s + x, 0), 1, 1e-9);
    expect(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, +v.toFixed(6)]))).toMatchSnapshot();
  } },
  { id: 'conductores', origin: 'independiente', what: 'R = ρ·L/A = 1,68×10⁻⁸ Ω·m · 1 m / 1 mm² = 0,0168 Ω', run: () => {
    close(sampleResistance(1.68e-8, 1, 1e-6), 0.0168, 1e-12);
  } },
  { id: 'descomposicion', origin: 'línea base', what: 'constante de descomposición de la cáscara de banano en las condiciones iniciales', run: () => {
    const { weeks: _w, ...rest } = DECOMP_DEFAULTS;
    expect(+decayConstant(rest).toFixed(8)).toMatchSnapshot();
  } },
  { id: 'circuitos-simples', origin: 'independiente', what: 'bombillo nominal 2,5 V / 0,3 A → R = 8,333 Ω', run: () => {
    close(lampResistanceAt(2.5), 2.5 / 0.3, 1e-6);
  } },
  // 8.º
  { id: 'mendel', origin: 'independiente', what: 'cruce monohíbrido Yy × Yy → 3 : 1 (Mendel)', run: () => {
    const pea = findOrganism('guisante');
    expect(ratioString(phenotypeDistribution(['Yy'], ['Yy'], [pea.genes[0]]))).toBe('3 : 1');
  } },
  { id: 'ondas', origin: 'independiente', what: 'v = √(T/μ) = √(10 N / 0,01 kg/m) = 31,62 m/s', run: () => {
    close(ropeSpeed(10, 0.01), 31.6228, 1e-4);
  } },
  { id: 'sonido', origin: 'independiente', what: 'v = 331,3·√(1 + t/273,15) a 20 °C = 343,21 m/s', run: () => {
    close(speedOfSound(20), 343.2146, 1e-4);
  } },
  { id: 'optica', origin: 'independiente', what: 'ángulo crítico vidrio-aire: arcsen(1/1,5) = 41,81°', run: () => {
    close(criticalAngle(1.5, 1)!, 41.8103, 1e-3);
  } },
  { id: 'adn', origin: 'independiente', what: 'reverso complementario de 5′-ATGCGT-3′ = 5′-ACGCAT-3′', run: () => {
    expect(reverseComplement('ATGCGT')).toBe('ACGCAT');
  } },
  { id: 'conservacion', origin: 'referencia', what: 'densidad del aire seco a 25 °C y 1 atm ≈ 1,184 kg/m³ (el modelo la da en g/mL)', run: () => {
    close(airDensity() * 1000, 1.184, 0.002);
  } },
  // 9.º
  { id: 'balanceo', origin: 'referencia', what: 'masa molar del agua H₂O = 18,015 g/mol (pesos atómicos IUPAC abreviados)', run: () => {
    close(molarMass('H2O'), 18.015, 0.002);
  } },
  { id: 'newton', origin: 'independiente', what: 'x = ½·a·t² con a = 0,5 m/s², t = 1 s → 0,25 m (pista de 1 m)', run: () => {
    close(positionAt(0.5, 1), 0.25, 1e-12);
  } },
  { id: 'cinematica', origin: 'independiente', what: 'tiempo de frenado t = v₀/|a| = 10/2 = 5 s', run: () => {
    close(brakingStopTime(10, -2)!, 5, 1e-12);
  } },
  { id: 'trabajo', origin: 'independiente', what: 'ventaja mecánica ideal del plano a 30°: 1/sen 30° = 2', run: () => {
    close(idealAdvantage(30), 2, 1e-12);
  } },
  { id: 'seleccion', origin: 'línea base', what: 'supervivencia de una presa de tono 0,5 sobre fondo 0,5 con depredación 0,6', run: () => {
    expect(+survival(0.5, 0.5, 0.6).toFixed(8)).toMatchSnapshot();
  } },
  // 10.º
  { id: 'soluciones', origin: 'independiente', what: 'dilución C₁V₁ = C₂V₂: 1 M · 10 mL / 100 mL = 0,1 M', run: () => {
    close(dilute(1, 10, 100), 0.1, 1e-12);
  } },
  { id: 'enzimas', origin: 'línea base', what: 'velocidad inicial de la catalasa a 37 °C, pH 7, sustrato 1, enzima 1', run: () => {
    expect(+initialRate(findEnzyme('catalasa'), 37, 7, 1, 1).toFixed(8)).toMatchSnapshot();
  } },
  { id: 'fotosintesis', origin: 'independiente', what: 'ley del inverso del cuadrado: I(10 cm)/I(20 cm) = 4', run: () => {
    close(irradiance(10) / irradiance(20), 4, 1e-9);
  } },
  { id: 'gases', origin: 'referencia', what: '1 mol de gas ideal a 0 °C y 101,325 kPa (presión exterior editable): V = nRT/P = 22 413,97 mL ≈ 22,414 L (prompt 9.2); con la presión por defecto de la jeringa (101,3 kPa), 22 419,5 mL', run: () => {
    const g = simulateGas({ law: 'charles', volume: 100, temperature: 0, pressure: 0, externalPressure: 101.325, moles: 1 });
    close(g.volume, 22413.97, 0.01);
    const app = simulateGas({ law: 'charles', volume: 100, temperature: 0, pressure: 0, moles: 1 });
    close(app.volume, (8.314462618 * 273.15 / 101300) * 1e6, 1e-6);
  } },
  { id: 'cinetica', origin: 'referencia', what: 'volumen molar a 0 °C y 101,325 kPa = 22 413,97 mL (prompt 9.2: ≈ 22,414 L)', run: () => {
    close(molarVolume(0, 101.325), 22413.97, 0.01);
  } },
  { id: 'energia', origin: 'referencia', what: 'Ep = m·g·h = 1 · 9,81 · 2 = 19,62 J y v = √(2gh) = 6,264 m/s sin fricción en la pista; y caso del prompt 9.1 con integración RK4: m = 1 kg, h = 10 m → Ep = 98,1 J, v = √(2gh) = 14,007 m/s, t = 1,4278 s, deriva de Em < 10⁻⁶', run: () => {
    const t = simulateTrack({ mass: 1, startHeight: 2, hillHeight: 0, mu: 0, rolling: false, g: 9.81 });
    close(t.totalEnergy, 19.62, 1e-9); close(t.speedBottom, Math.sqrt(2 * 9.81 * 2), 1e-6);
    const f = simulateFall({ mass: 1, height: 10, v0: 0, g: 9.81, dt: 0.01 });
    close(f.ep0, 98.1, 1e-9); close(f.vGround!, Math.sqrt(2 * 9.81 * 10), 1e-6); close(f.tGround!, Math.sqrt(2 * 10 / 9.81), 1e-6);
    expect(f.maxDrift).toBeLessThan(DRIFT_TOLERANCE);
  } },
  { id: 'proyectiles', origin: 'independiente', what: 'alcance ideal a 45° desde el suelo: v²/g = 100/9,81 = 10,194 m', run: () => {
    close(idealRange(10, 45, 0, 9.81), 10.1937, 1e-4);
  } },
  { id: 'pendulo', origin: 'independiente', what: 'T = 2π√(L/g) con L = 1 m, g = 9,81 → 2,0061 s', run: () => {
    close(smallAnglePeriod(1, 9.81), 2.00607, 1e-5);
  } },
  { id: 'choques', origin: 'independiente', what: 'choque elástico de masas iguales (0,5 kg a 1 m/s contra 0,5 kg en reposo): se intercambian las velocidades', run: () => {
    const v = finalVelocities(0.5, 0.5, 1, 0, 1);
    close(v.v1f, 0, 1e-12); close(v.v2f, 1, 1e-12);
  } },
  { id: 'respiracion', origin: 'independiente', what: 'cociente respiratorio de la glucosa C₆H₁₂O₆ = 1,0', run: () => {
    close(rqFromFormula(6, 12, 6), 1, 1e-12);
  } },
  // 11.º
  { id: 'circuitos', origin: 'independiente', what: 'serie de 3 × 10 Ω con 6 V ideal: I = 6/30 = 0,2 A', run: () => {
    const r = solveCircuit({ topology: 'serie', emf: 6, internalResistance: 0, resistances: [10, 10, 10], closed: [true, true, true], mainSwitch: true });
    close(r.totalCurrent, 0.2, 1e-9);
  } },
  { id: 'estequiometria', origin: 'referencia', what: 'masa molar de la sacarosa C₁₂H₂₂O₁₁ = 342,30 g/mol', run: () => {
    close(molarMass('C12H22O11'), 342.30, 0.02);
  } },
  { id: 'equilibrio', origin: 'independiente', what: 'Van ’t Hoff con ΔH = 0: K no depende de la temperatura', run: () => {
    close(vantHoff(250, 0, 60), 250, 1e-9);
  } },
  { id: 'ph', origin: 'referencia', what: 'pH de HCl 0,100 M ≈ 1,00 y de ácido acético 0,100 M (Ka = 1,8×10⁻⁵) ≈ 2,87 (prompt 9.2)', run: () => {
    close(solvePH(0.1, 0, null), 1.0, 0.005); close(solvePH(0.1, 0, 1.8e-5), 2.87, 0.01);
  } },
  { id: 'poblacion', origin: 'independiente', what: 'logística N(t) = K/(1 + ((K−N₀)/N₀)·e^(−rt)) con N₀ = 10, r = 0,5, K = 100, t = 2 → 23,197', run: () => {
    close(logisticAt(10, 0.5, 100, 0, 2), 23.1969, 1e-3);
  } },
  { id: 'popgen', origin: 'independiente', what: 'Hardy-Weinberg con p = 0,6: AA = 0,36, Aa = 0,48, aa = 0,16', run: () => {
    const h = hardyWeinberg(0.6);
    close(h.AA, 0.36, 1e-12); close(h.Aa, 0.48, 1e-12); close(h.aa, 0.16, 1e-12);
  } },
  { id: 'agua', origin: 'referencia', what: 'oxígeno disuelto de saturación a 25 °C y nivel del mar ≈ 8,26 mg/L (tablas de solubilidad de Benson y Krause)', run: () => {
    close(doSaturation(25, 0), 8.26, 0.02);
  } },
  { id: 'expresion', origin: 'independiente', what: 'convención de numeración: el sitio de inicio de la transcripción es +1 y no existe la posición 0', run: () => {
    expect(relativeToTss(TSS)).toBe(1); expect(relativeToTss(TSS - 1)).toBe(-1);
  } },
  { id: 'interferencia', origin: 'independiente', what: 'interfranja de Young Δy = λ·L/d = 650 nm · 1 m / 250 µm = 2,6 mm', run: () => {
    close(fringeSpacingSmallAngle(650 * nm, 1, 250 * um), 2.6e-3, 1e-12);
  } },
  { id: 'induccion', origin: 'independiente', what: 'campo axial de un dipolo B = (μ₀/4π)·2m/r³ con m = 1 A·m², r = 0,1 m → 2,0×10⁻⁴ T', run: () => {
    close(dipoleField(1, 0.1, 0).b, 2e-4, 1e-12);
  } },
  { id: 'extraccion-adn', origin: 'independiente', what: 'regla de Wallace para 5′-GATTACAGGA-3′: Tm = 2·(A+T) + 4·(G+C) = 2·6 + 4·4 = 28 °C', run: () => {
    expect(wallaceTm(normalizeSequence('GATTACAGGA'))).toEqual({ tm: 28, valid: true });
  } },
  { id: 'mol', origin: 'independiente', what: '1,250 g de NaCl (58,44 g/mol): n = 0,021389 mol y N = n·N_A = 1,2881×10²² unidades fórmula', run: () => {
    const c = countEntities(1.25, 'NaCl');
    close(c.moles, 1.25 / 58.44, 2e-6); close(c.entities / 1e22, (1.25 / 58.44) * AVOGADRO / 1e22, 2e-4);
  } },
  { id: 'reto', origin: 'línea base', what: 'diseño del río con semilla 123 (3 niveles, 0–10 km, 2 réplicas, sin controlar la temperatura): datos sintéticos reproducibles', run: () => {
    const d = { system: 'rio', levels: 3, min: 0, max: 10, replicates: 2, confound: 'sin-control', seed: 123 } as const;
    const a = analyze(collect(d));
    expect(analyze(collect(d)).slope).toBe(a.slope);
    expect({ slope: +a.slope.toFixed(4), intercept: +a.intercept.toFixed(3), r: +a.r.toFixed(3) }).toMatchSnapshot();
  } },
  { id: 'geometria', origin: 'independiente', what: 'tetraedro regular: los seis ángulos H–C–H del confórmero 3D de metano (PubChem CID 297) valen arccos(−1/3) = 109,47° ± 0,5°', run: () => {
    const ch4 = BUNDLED_CONFORMERS.find((c) => c.cid === 297)!;
    const angles = angleTable(parseSdf(ch4.sdf)).map((r) => r.angle);
    expect(angles).toHaveLength(6);
    for (const a of angles) close(a, (Math.acos(-1 / 3) * 180) / Math.PI, 0.5);
  } },
  { id: 'secuencias', origin: 'referencia', what: 'código genético estándar (NCBI tabla 1): ATG → M, codones de parada → *, y los 64 codones iguales a Biopython (versión registrada en el archivo de referencia)', run: () => {
    expect(translateSeq('ATGTAATAGTGA', 1)).toBe('M***');
    expect(biopython.biopython).toBe('1.85');
    const table = (biopython.geneticCodes['1'] as { codons: Record<string, string> }).codons;
    expect(Object.keys(table)).toHaveLength(64);
    for (const [codon, aa] of Object.entries(table)) expect(translateSeq(codon, 1)).toBe(aa);
  } },
  { id: 'rastreo', origin: 'referencia', what: 'anemia falciforme: NM_000518.5(HBB):c.20A>T es de sentido erróneo p.Glu7Val (ClinVar 15333), calculado al traducir el CDS real (codón 7 GAG → GTG)', run: () => {
    const r = consequenceFromHgvs(geneByKey('HBB')!, 'c.20A>T');
    expect(r).toMatchObject({ consequence: 'sentido-erroneo', hgvsP: 'p.Glu7Val', refCodon: 'GAG', altCodon: 'GTG', aaPosition: 7 });
  } },
  { id: 'proteinas', origin: 'referencia', what: 'puente disulfuro de la insulina humana (PDB 3I40): distancia SG(Cys A6)–SG(Cys A11) = 2,027 Å, igual a Biopython 1.85 con tolerancia 10⁻³ Å', run: () => {
    const s = parseStructure(readFileSync(new URL('../../src/data/proteinas/3I40.cif', import.meta.url), 'utf8'));
    const a = findAtom(s, 'A', 6, 'SG')!, b = findAtom(s, 'A', 11, 'SG')!;
    close(measureDistance(s, a.index, b.index), 2.027, 1e-3);
  } },
  { id: 'cinetica-potencial', origin: 'referencia', what: 'caso del prompt 9.1: m = 1 kg, h = 10 m, g = 9,81 m/s² → Ep = m·g·h = 98,1 J = F·h, v = √(2gh) = 14,007 m/s; fotopuerta (bandera de 5,00 cm centrada en el haz) Δt = √(2·10,025/g) − √(2·9,975/g) = 3,5696 ms; y Ec ∝ v²: doble rapidez → 4 × Ec', run: () => {
    const d = simulateDrop({ mass: 1, height: 10, place: 'tierra' });
    close(d.ep0, 98.1, 1e-9); close(d.liftWork, 98.1, 1e-9); close(d.ekGate, 98.1, 1e-9);
    close(d.vGate, 14.00714, 1e-5); close(d.dtGate * 1000, Math.sqrt(2 * 10.025 / 9.81) * 1000 - Math.sqrt(2 * 9.975 / 9.81) * 1000, 1e-9);
    close(kineticEnergy(0.5, 2) / kineticEnergy(0.5, 1), 4, 1e-12);
  } },
  { id: 'oxidos-hidroxidos', origin: 'independiente', what: '2 Mg + O₂ → 2 MgO: m(MgO)/m(Mg) = 40,304/24,305 = 1,6583 (0,50 g → 0,83 g); Mg(OH)₂ saturado con Kps = 5,61×10⁻¹² → pH = 14 + log(2·(Kps/4)^(1/3)) = 10,35; 0,310 g de Na₂O en 100 mL → NaOH 0,100 M → pH 13,00', run: () => {
    const b = burn('mg', 0.5);
    close(b.ratio, 40.304 / 24.305, 1e-12); expect(b.massReading).toBe(0.83);
    close(dissolve('mg', b.molesOxide, 100).pH, 14 + Math.log10(2 * Math.cbrt(5.61e-12 / 4)), 1e-6);
    close(dissolve('na2o', 0.31 / molar('Na2O'), 100).pH, 14 + Math.log10((2 * 0.31) / molar('Na2O') / 0.1), 1e-4);
  } },
  { id: 'acidos-sales', origin: 'independiente', what: 'neutralización HCl 0,100 M (25,00 mL) + NaOH 0,100 M: pH 7,00 en V_eq = 25,00 mL; NaHCO₃ 0,100 M → pH ≈ (pKa₁ + pKa₂)/2 = (6,351 + 10,329)/2 = 8,34; NH₄Cl 0,100 M → pH ≈ ½(pKa − log C) = 5,12', run: () => {
    close(titrationPH('hcl', 0.1, 25, 0.1, 25), 7, 1e-6);
    close(saltSolution('nahco3', 0.1).pH, (6.351 + 10.329) / 2, 0.01);
    close(saltSolution('nh4cl', 0.1).pH, (9.245 + 1) / 2, 0.01);
  } },
  { id: 'nomenclatura-inorganica', origin: 'independiente', what: 'neutralidad de cargas Fe³⁺/O²⁻ → Fe₂O₃ (trióxido de dihierro, óxido de hierro(III), óxido férrico); Hg₂²⁺/Cl⁻ → Hg₂Cl₂; H₂SO₄ = dihidrogeno(tetraoxidosulfato) (IUPAC 2005); taller: 2 Ca + O₂ → 2 CaO, CaO + H₂O → Ca(OH)₂, 2 S + 3 O₂ → 2 SO₃, SO₃ + H₂O → H₂SO₄, H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2 H₂O', run: () => {
    const fe = buildCompound({ kind: 'oxido', el: 'Fe', ox: 3 });
    expect([fe.formula, fe.names.sistematica, fe.names.stock, fe.names.tradicional]).toEqual(['Fe2O3', 'trióxido de dihierro', 'óxido de hierro(III)', 'óxido férrico']);
    expect(buildCompound({ kind: 'sal-binaria', cation: { el: 'Hg', ox: 1 }, anion: 'Cl' }).formula).toBe('Hg2Cl2');
    expect(buildCompound({ kind: 'oxacido', el: 'S', ox: 6 }).names.sistematica).toBe('dihidrogeno(tetraoxidosulfato)');
    // Taller de formación de compuestos (v2.4.0): ecuaciones balanceadas por el método algebraico.
    const eq = (i: ForgeInput) => { const r = forge(i); if (!r.ok) throw new Error(r.message); return r.equation; };
    expect([eq({ route: 'metal-o2', a: 'Ca', oxA: 2 }), eq({ route: 'oxido-agua', a: 'Ca', oxA: 2 }), eq({ route: 'nometal-o2', a: 'S', oxA: 6 }), eq({ route: 'anhidrido-agua', a: 'S', oxA: 6 }), eq({ route: 'neutralizacion', a: 'Ca', oxA: 2, b: 'S', oxB: 6 })])
      .toEqual(['2 Ca + O₂ → 2 CaO', 'CaO + H₂O → Ca(OH)₂', '2 S + 3 O₂ → 2 SO₃', 'SO₃ + H₂O → H₂SO₄', 'H₂SO₄ + Ca(OH)₂ → CaSO₄ + 2 H₂O']);
  } },
  { id: 'hidrocarburos', origin: 'referencia', what: 'CH₄ + 2 O₂ → CO₂ + 2 H₂O; ΔcH° del metano 890,8 kJ/mol (CRC 94.ª ed. vía HSDB/PubChem) → 890,8/16,043 = 55,53 kJ/g; cloración estadística del propano 6 H : 2 H = 75 % : 25 %', run: () => {
    expect(combustionEquation('CH₄', 1, 4, 'completa')).toBe('CH₄ + 2 O₂ → CO₂ + 2 H₂O');
    expect(combustionEquation('C₃H₈', 3, 8, 'completa')).toBe('C₃H₈ + 5 O₂ → 3 CO₂ + 4 H₂O');
    const e = combustionEnergy(getOrganic('metano'))!; close(e.kJmol, 890.8, 1e-9); close(e.kJg, 55.526, 1e-3);
    expect(monohalogenation('CCC', 'Cl').map((p) => [p.nombre, p.percent])).toEqual([['1-cloropropano', 75], ['2-cloropropano', 25]]);
  } },
  { id: 'aromaticos', origin: 'referencia', what: 'Hückel (1931): orbitales π del benceno x = 2, 1, 1, −1, −1, −2 (β); 6 e⁻ π = 4·1 + 2 → aromático; ciclobutadieno 4 e⁻ π (4n) → antiaromático', run: () => {
    const ben = huckelAnalysis(parseSmiles('c1ccccc1'));
    ben.levels!.map((l) => l.x).forEach((x, i) => close(x, [2, 1, 1, -1, -1, -2][i], 1e-9));
    expect([ben.piElectrons, ben.verdict]).toEqual([6, 'aromático']);
    expect(huckelAnalysis(parseSmiles('C1=CC=C1')).verdict).toBe('antiaromático');
    symmetricEigenvalues([[0, 1], [1, 0]]).forEach((x, i) => close(x, [1, -1][i], 1e-12));
  } },
  { id: 'nomenclatura-organica', origin: 'referencia', what: 'nombres IUPAC iguales a los de PubChem (LexiChem): CC(C)CC(C)(C)C → 2,2,4-trimethylpentane, C=C(CC)CCC → 3-methylidenehexane (cadena más larga, regla 2013), C/C=C/C → (E)-but-2-ene; en español 2,2,4-trimetilpentano y 2-metil-1-yodobutano (orden alfabético en español)', run: () => {
    const n = (s: string) => { const r = nameSmiles(s); if (!r.ok) throw new Error(r.motivo); return r; };
    expect(n('CC(C)CC(C)(C)C').en).toBe('2,2,4-trimethylpentane');
    expect(n('C=C(CC)CCC').en).toBe('3-methylidenehexane');
    expect(n('C/C=C/C').en).toBe('(E)-but-2-ene');
    expect(n('CC(C)CC(C)(C)C').es).toBe('2,2,4-trimetilpentano');
    expect(n('CCC(C)CI').es).toBe('2-metil-1-yodobutano');
  } },
  { id: 'grupos-oxigenados', origin: 'referencia', what: 'ácido acético 0,100 M con pKa 4,76 (PubChem/HSDB) → pH 2,88; α(pH = pKa) = 0,5; CC(O)C(O)=O → ácido 2-hidroxipropanoico; (CH₃)₃COH es terciario', run: () => {
    close(weakAcidPH(4.76, 0.1).pH, 2.88, 0.005); close(ionizedFraction(4.76, 4.76), 0.5, 1e-12);
    const n = nameFunctionalSmiles('CC(O)C(O)=O'); expect(n.ok && n.es).toBe('ácido 2-hidroxipropanoico');
    expect(detectGroups(parseSmiles('CC(C)(C)O'))[0].degree).toBe('terciario');
  } },
  { id: 'grupos-nitrogenados', origin: 'referencia', what: 'metanamina 0,10 M (pKaH 10,66, PubChem/HSDB) → pH 11,82; amoníaco pKb 4,751 → pKaH 9,249; acetamida plana (Σθ(N) = 360°) frente a metanamina piramidal (326°) en los confórmeros de PubChem', run: () => {
    close(weakBasePH(10.66, 0.1).pH, 11.82, 0.005); close(pKaH(getFunc('amoniaco'))!.value, 9.249, 1e-9);
    expect(amideGeometry(funcSpecies('acetamida'))!.sumN).toBeGreaterThan(359); expect(amineGeometry(funcSpecies('metanamina'))!.sumN).toBeLessThan(330);
  } },
  { id: 'reacciones-organicas', origin: 'referencia', what: 'esterificación K = 4: 1 + 1 mol → X = 2/3, 1 + 3 mol → 0,9028; C₂H₆O + 3 O₂ → 2 CO₂ + 3 H₂O (balanceo algebraico); ΔrH°(ciclohexeno + H₂) = −(3751,7 + 285,8) + 3919,6 = −117,9 kJ con ΔcH° de PubChem/HSDB', run: () => {
    close(esterEquilibrium(1, 1).conversion, 2 / 3, 1e-10); close(esterEquilibrium(1, 3).conversion, (16 - Math.sqrt(112)) / 6, 1e-10);
    expect(equationOf(reactionById('combustion-etanol'))).toBe('C₂H₆O + 3 O₂ → 2 CO₂ + 3 H₂O');
    close(hessEnthalpy(reactionById('hidrogenacion-ciclohexeno')).dH!, -117.9, 1e-9);
  } },
  { id: 'metabolismo', origin: 'referencia', what: 'FBA de E. coli core (glucosa 10 mmol/gDW/h): crecimiento 0,8739 h⁻¹ con O₂ sin límite y 0,2117 h⁻¹ sin O₂, iguales a COBRApy 0.32.1 con GLPK (tolerancia relativa 10⁻⁶)', run: () => {
    close(runFba(REFERENCE_CONDITION).growth, 0.873921506968, 1e-6);
    close(runFba({ ...REFERENCE_CONDITION, oxygen: 0 }).growth, 0.211662949735, 1e-6);
  } },
  { id: 'modelos-atomicos', origin: 'referencia', what: 'oro y alfas de 5 MeV: d = 1,439964·2·79/5 = 45,50 fm; b = d/2 → θ = 90°; N(30°)/N(150°) = sen⁴(75°)/sen⁴(15°) = 194,0; Hα (3 → 2) = 656,30 nm en aire frente a 656,279 nm del NIST y Hβ = 486,14 frente a 486,135 nm', run: () => {
    close(closestApproachFm(79, 5), (1.439964 * 158) / 5, 1e-12); close((rutherfordAngle(0.5, 1) * 180) / Math.PI, 90, 1e-9);
    const s = rutherfordSetup({ foilId: 'oro', energyMeV: 5, thicknessUm: 0.4 });
    close(rutherfordRate(s, 30) / rutherfordRate(s, 150), Math.sin((75 * Math.PI) / 180) ** 4 / Math.sin((15 * Math.PI) / 180) ** 4, 1e-9);
    expect(Math.abs(transition(3, 2).lambdaAirNm - 656.279)).toBeLessThan(0.05); expect(Math.abs(transition(4, 2).lambdaAirNm - 486.135)).toBeLessThan(0.05);
  } },
  { id: 'tabla-periodica', origin: 'referencia', what: 'datos de PubChem: χ(F) = 3,98, EI₁(Na) = 5,139 eV, EI₁(Cl) = 12,968 eV; Slater (cálculo a mano): Z_ef(Na) = 11 − (8·0,85 + 2) = 2,20, Z_ef(Cl) = 17 − (6·0,35 + 8·0,85 + 2) = 6,10; en el período 3 el radio covalente disminuye (Na 155 → Cl 99 pm)', run: () => {
    expect(periodicElement('F').en).toBe(3.98); expect(periodicElement('Na').ei).toBe(5.139); expect(periodicElement('Cl').ei).toBe(12.968);
    close(slaterZeff(11).zef, 2.2, 1e-12); close(slaterZeff(17).zef, 6.1, 1e-12);
    expect(trend(periodMembers(3), 'radioCov').direction).toBe('disminuye');
  } },
  { id: 'enlace-quimico', origin: 'independiente', what: 'ΔEN(Na–Cl) = 3,16 − 0,93 = 2,23 → iónico, carácter iónico de Pauling 100·(1 − e^(−2,23²/4)) = 71,2 %; ΔEN(H–Cl) = 0,96 → covalente polar; Lewis del CO₂: 16 electrones = 4 pares de enlace + 4 libres', run: () => {
    const b = classifyBond('Na', 'Cl'); expect(b.type).toBe('iónico'); close(b.dEN, 2.23, 1e-12); close(b.ionicPct, 100 * (1 - Math.exp(-(2.23 ** 2) / 4)), 1e-9);
    expect(classifyBond('H', 'Cl').type).toBe('covalente polar');
    expect(checkLewis(lewisById('co2'))).toMatchObject({ valenceTotal: 16, bondingPairs: 4, lonePairs: 4, ok: true });
  } },
  { id: 'electrostatica', origin: 'independiente', what: 'ley de Coulomb con k = 8,99 × 10⁹ N·m²/C²: 2 µC y −3 µC a 30 cm → F = 8,99e9·6e-12/0,09 = 0,5993 N de atracción; dos cargas de +2 µC a ±10 cm → E = 0 en el punto medio', run: () => {
    const r = coulombStation({ q1uC: 2, q2uC: -3, rCm: 30 }); close(r.magnitude, (8.99e9 * 6e-12) / 0.09, 1e-12); expect(r.kind).toBe('atracción');
    const E = fieldAt(chargesFrom(PRESETS.find((p) => p.id === 'iguales')!.charges), [0, 0, 0]); expect(Math.hypot(...E)).toBeLessThan(1e-6);
  } },
  { id: 'configuracion-electronica', origin: 'referencia', what: 'Fe (Z = 26) por Madelung: [Ar] 4s² 3d⁶, 4 desapareados, período 4, grupo 8 (cálculo a mano); Cr y Cu: el estado fundamental medido (PubChem, 2026-11-01) es [Ar] 4s¹ 3d⁵ (6 desapareados) y [Ar] 4s¹ 3d¹⁰ (1), distinto de la predicción [Ar] 4s² 3d⁴ y [Ar] 4s² 3d⁹', run: () => {
    expect(nobleGasString(aufbauOccupancy(26))).toBe('[Ar] 4s² 3d⁶'); expect(analyzeBoxes(hundBoxes(aufbauOccupancy(26)), 26).unpaired).toBe(4);
    expect(tablePlace(26)).toMatchObject({ period: 4, group: 8, block: 'd' });
    expect(nobleGasString(groundState(24))).toBe('[Ar] 4s¹ 3d⁵'); expect(analyzeBoxes(hundBoxes(groundState(24)), 24).unpaired).toBe(6);
    expect(nobleGasString(aufbauOccupancy(24))).toBe('[Ar] 4s² 3d⁴'); expect(nobleGasString(groundState(29))).toBe('[Ar] 4s¹ 3d¹⁰'); expect(nobleGasString(aufbauOccupancy(29))).toBe('[Ar] 4s² 3d⁹');
  } },
  { id: 'pila-electroquimica', origin: 'referencia', what: 'pila de Daniell con E° del CRC (Vanýsek): 0,3419 − (−0,7618) = 1,1037 V; [Cu²⁺] = 0,010 M → 1,1037 − 0,05916 = 1,0445 V; 50 mA durante 120 min → 360 C, Zn −360·65,4/(2·96 485) = −0,1220 g, Cu +360·63,55/(2·96 485) = +0,1186 g', run: () => {
    const d = { left: 'zn', right: 'cu', cLeft: 1, cRight: 1, bridge: 'KNO3' as const };
    close(galvanicCell(d).E, 1.1037, 1e-12); close(galvanicCell({ ...d, cRight: 0.01 }).E, 1.1037 - (8.314462618 * 298.15 * Math.LN10) / FARADAY, 1e-12);
    const r = galvanicDischarge({ ...d, volumeML: 100, currentMA: 50, timeMin: 120 });
    close(r.dLeft, -(360 * 65.4) / (2 * 96485.33212), 1e-12); close(r.dRight, (360 * 63.55) / (2 * 96485.33212), 1e-12);
  } },
  { id: 'meiosis', origin: 'referencia', what: 'humano n = 23: 2²³ = 8 388 608 combinaciones de gametos; 2n = 4: telofase I 2 células con 2 cromosomas y 2c, gametos con 1c; d = 20 cM → AB = ab = 0,40 y Ab = aB = 0,10 (Morgan); un cruce entre A y B → 2 de 4 gametos recombinantes', run: () => {
    expect(gameteCombinations(23)).toBe(8388608);
    expect(stageCounts(5, 4)).toMatchObject({ cells: 2, chromosomes: 2, dnaC: 2 }); expect(stageCounts(9, 4)).toMatchObject({ cells: 4, chromosomes: 2, dnaC: 1 });
    expect(expectedFrequencies(1, 20)).toEqual({ AB: 0.4, ab: 0.4, Ab: 0.1, aB: 0.1 });
    expect(meiosisGametes({ pairs: 1, crossover: 0.5, orientation: [true], nondisjunction: 'ninguna' }).filter((g) => g.recombinant)).toHaveLength(2);
  } },
];

describe('valores dorados por práctica', () => {
  for (const c of GOLDEN) test(`${c.id} [${c.origin}]: ${c.what}`, c.run);

  test('cada práctica del catálogo tiene exactamente un caso dorado', () => {
    const ids = GOLDEN.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
    const missing = CATALOG.map((p) => p.id).filter((id) => !ids.includes(id));
    expect(missing).toEqual([]);
  });
});
