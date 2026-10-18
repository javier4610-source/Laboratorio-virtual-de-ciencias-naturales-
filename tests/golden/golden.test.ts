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
import { findEnzyme, initialRate } from '../../src/models/enzyme';
import { vantHoff } from '../../src/models/equilibrium';
import { carryingCapacity, K_NORMAL } from '../../src/models/foodweb';
import { simulateGas } from '../../src/models/gases';
import { relativeToTss, TSS } from '../../src/models/geneExpression';
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
  { id: 'gases', origin: 'referencia', what: '1 mol de gas ideal a 0 °C: V = nRT/P = 22 420 mL con la presión fija de la jeringa (101,3 kPa); 22 414 mL a 101,325 kPa', run: () => {
    const g = simulateGas({ law: 'charles', volume: 100, temperature: 0, pressure: 101.3, moles: 1 });
    close(g.volume, (8.314462618 * 273.15 / 101300) * 1e6, 1e-6);
    close(g.volume * (101.3 / 101.325), 22413.97, 0.05);
  } },
  { id: 'cinetica', origin: 'referencia', what: 'volumen molar a 0 °C y 101,325 kPa = 22 413,97 mL (prompt 9.2: ≈ 22,414 L)', run: () => {
    close(molarVolume(0, 101.325), 22413.97, 0.01);
  } },
  { id: 'energia', origin: 'referencia', what: 'Ep = m·g·h = 1 · 9,81 · 2 = 19,62 J y v = √(2gh) = 6,264 m/s sin fricción (la pista admite h ≤ 2 m; el caso h = 10 m del prompt queda para la Fase 3)', run: () => {
    const t = simulateTrack({ mass: 1, startHeight: 2, hillHeight: 0, mu: 0, rolling: false, g: 9.81 });
    close(t.totalEnergy, 19.62, 1e-9); close(t.speedBottom, Math.sqrt(2 * 9.81 * 2), 1e-6);
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
