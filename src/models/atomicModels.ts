import { assertInRange, seededRandom } from './math';
import type { ModelSpec } from './types';

/**
 * Modelos atómicos (grado 7.º): del átomo macizo de Dalton al átomo nuclear de Rutherford y a los niveles de Bohr.
 *
 * 1) Experimento de la lámina de oro (Geiger y Marsden, 1909–1913; interpretación de Rutherford, 1911).
 *    Un haz de partículas alfa (carga z = 2) con energía cinética E atraviesa una lámina metálica de espesor t. Un
 *    detector de centelleo (pantalla de ZnS con microscopio) que subtiende un ángulo sólido ΔΩ se gira a un ángulo θ.
 *
 *    · Distancia de máximo acercamiento en un choque de frente:  d = k·z·Z·e²/E  (k·e² = 1,439964 MeV·fm).
 *    · Átomo NUCLEAR (Rutherford): un solo choque con un núcleo puntual. Trayectoria hiperbólica (órbita repulsiva):
 *        1/r(φ) = sen φ / b + (d / (2·b²))·(cos φ − 1)       (φ medido desde la dirección de llegada)
 *      y desviación  tan(θ/2) = d / (2·b).  Sección eficaz diferencial: dσ/dΩ = (d/4)² / sen⁴(θ/2).
 *      Conteo esperado en el detector:  N(θ) = Ṅ·T·n·t·ΔΩ·(d/4)²/sen⁴(θ/2)  con n = ρ·N_A/M (átomos por m³).
 *    · Átomo de THOMSON: carga positiva Z·e repartida en una esfera de radio R (el tamaño del átomo; aquí el radio de
 *      Wigner–Seitz R = (3/(4πn))^(1/3)), con los electrones incrustados. Para un parámetro de impacto b < R la desviación
 *      (impulso transversal en línea recta) es  θ₁(b) = (d/b)·[1 − (1 − b²/R²)^(3/2)]  y es como mucho ≈ 1,02·d/R
 *      (unas décimas de milésima de radián). Al cruzar N = n·t·π·R² átomos, los empujones al azar se suman como una
 *      caminata aleatoria: distribución gaussiana con ⟨θ²⟩ = N·⟨θ₁²⟩, y  N(θ) = Ṅ·T·ΔΩ·exp(−θ²/⟨θ²⟩)/(π·⟨θ²⟩).
 *
 * 2) Átomo de Bohr (hidrógeno): Eₙ = −E_I/n², con E_I = 13,598 eV (primera energía de ionización del H, NIST, en la
 *    tabla de PubChem); fotón emitido en la transición nᵢ → n_f: E = E_I·(1/n_f² − 1/nᵢ²), λ = h·c/E (vacío) y
 *    λ_aire = λ/n_aire con n_aire = 1,000277 (aire seco a 15 °C, valor medio en el visible). Se compara con las líneas
 *    de Balmer del NIST ASD (en aire).
 *
 * Este archivo no depende de React ni del navegador.
 */

/** k·e² en MeV·fm (CODATA: 1,439964 MeV·fm). */
export const KE2_MEV_FM = 1.439964;
export const AVOGADRO = 6.02214076e23;
/** Carga de la partícula alfa (en unidades de e). */
export const Z_ALPHA = 2;
/** Radio de la partícula alfa (fm), para el aviso de alcance de la fuerza nuclear (r ≈ 1,68 fm, radio de carga del ⁴He). */
export const R_ALPHA_FM = 1.68;
/** Constante del radio nuclear R = r₀·A^(1/3) (fm), valor de manual (r₀ ≈ 1,2 fm). */
export const R0_NUCLEAR_FM = 1.2;

/**
 * Láminas disponibles. Z, masa atómica (u) y densidad (g/cm³): las de la tabla de PubChem
 * (src/data/quimica/tabla-periodica-pubchem.json; la prueba unitaria comprueba que coinciden). A = número másico del
 * isótopo más abundante (para el radio nuclear del aviso).
 */
export interface Foil { id: string; name: string; sym: string; Z: number; molarMass: number; density: number; A: number }
export const FOILS: Foil[] = [
  { id: 'oro', name: 'Oro', sym: 'Au', Z: 79, molarMass: 196.96657, density: 19.282, A: 197 },
  { id: 'plata', name: 'Plata', sym: 'Ag', Z: 47, molarMass: 107.868, density: 10.501, A: 107 },
  { id: 'cobre', name: 'Cobre', sym: 'Cu', Z: 29, molarMass: 63.55, density: 8.933, A: 63 },
  { id: 'aluminio', name: 'Aluminio', sym: 'Al', Z: 13, molarMass: 26.981538, density: 2.7, A: 27 },
];
export const foilById = (id: string): Foil => {
  const f = FOILS.find((x) => x.id === id);
  if (!f) throw new RangeError(`Lámina desconocida: ${id}`);
  return f;
};

/** Montaje fijo del experimento (valores de diseño del laboratorio virtual, del orden de los de Geiger y Marsden). */
export const SETUP = {
  /** Partículas alfa por segundo que llegan a la lámina (fuente colimada). */
  beamRate: 1.0e8,
  /** Ángulo sólido del detector (sr): pantalla de ZnS de 1 mm² … vista a 3,2 cm ≈ 1,0 × 10⁻³ sr. */
  detectorSolidAngle: 1.0e-3,
};

export const RF_LIMITS = {
  energy: [3, 9] as [number, number], // MeV
  thickness: [0.1, 2] as [number, number], // µm
  angle: [10, 170] as [number, number], // grados
  time: [10, 120] as [number, number], // s de conteo
};

export interface RutherfordInput { foilId: string; energyMeV: number; thicknessUm: number }

/** Distancia de máximo acercamiento d = k·z·Z·e²/E (fm). */
export function closestApproachFm(Z: number, energyMeV: number): number {
  return (KE2_MEV_FM * Z_ALPHA * Z) / energyMeV;
}

/** Átomos por m³: n = ρ·N_A/M (ρ en g/cm³, M en g/mol). */
export function numberDensity(f: Foil): number {
  return ((f.density * 1e6) / f.molarMass) * AVOGADRO;
}

/** Desviación de Rutherford para un parámetro de impacto b (misma unidad que d): θ = 2·atan(d/(2b)), en rad. */
export function rutherfordAngle(b: number, d: number): number {
  if (b <= 0) return Math.PI;
  return 2 * Math.atan(d / (2 * b));
}
/** Parámetro de impacto que produce la desviación θ (rad): b = (d/2)·cot(θ/2). */
export function impactForAngle(theta: number, d: number): number {
  return (d / 2) / Math.tan(theta / 2);
}
/** Distancia mínima al núcleo en una órbita con desviación θ: r_min = (d/2)·(1 + 1/sen(θ/2)). */
export function minDistance(theta: number, d: number): number {
  return (d / 2) * (1 + 1 / Math.sin(theta / 2));
}
/** dσ/dΩ de Rutherford (m²/sr), con d en m. */
export function rutherfordCrossSection(theta: number, dM: number): number {
  const s = Math.sin(theta / 2);
  return (dM / 4) ** 2 / s ** 4;
}

/**
 * Trayectoria hiperbólica (plano de la órbita) de una alfa con parámetro de impacto b en el campo de un núcleo
 * puntual en el origen. La alfa llega desde x = −∞ moviéndose hacia +x, desplazada b en +y. Unidades: las de b y d.
 * Devuelve puntos con |r| ≤ rMax.
 */
export function rutherfordTrajectory(b: number, d: number, rMax: number, n = 80): { x: number; y: number }[] {
  // Ángulo polar del punto de llegada (−∞ en x, +b en y) es π; φ crece desde 0 en la llegada.
  const phiEnd = Math.PI - rutherfordAngle(b, d); // φ final (asíntota de salida)
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= n; i++) {
    const phi = (phiEnd * i) / n;
    const u = Math.sin(phi) / b + (d / (2 * b * b)) * (Math.cos(phi) - 1);
    if (u <= 1e-12) continue;
    const r = 1 / u;
    if (r > rMax) continue;
    // Ángulo polar real: la llegada está en π (lado izquierdo, y > 0) y el punto gira en sentido horario.
    const ang = Math.PI - phi;
    pts.push({ x: r * Math.cos(ang), y: r * Math.sin(ang) });
  }
  return pts;
}

/** Desviación de Thomson para un solo átomo (rad): θ₁(b) = (d/b)·[1 − (1 − b²/R²)^(3/2)] si b < R; 0 si b ≥ R. */
export function thomsonSingleAngle(b: number, d: number, R: number): number {
  if (b >= R || b <= 0) return 0;
  return (d / b) * (1 - (1 - (b * b) / (R * R)) ** 1.5);
}
/** ⟨θ₁²⟩ para b uniforme en el disco de radio R (integración de Simpson). */
export function thomsonMeanSquare(d: number, R: number, steps = 400): number {
  // ⟨θ²⟩ = (2/R²)·∫₀ᴿ θ(b)²·b db
  const f = (b: number) => thomsonSingleAngle(b, d, R) ** 2 * b;
  const h = R / steps;
  let s = f(1e-9 * R) + f(R * (1 - 1e-9));
  for (let i = 1; i < steps; i++) s += (i % 2 ? 4 : 2) * f(i * h);
  return ((2 / (R * R)) * s * h) / 3;
}

export interface RutherfordSetup {
  foil: Foil;
  d_fm: number;
  d_m: number;
  n: number; // átomos/m³
  nt: number; // átomos/m² de lámina
  /** Radio del átomo de Thomson (Wigner–Seitz), m. */
  R_atom: number;
  /** Átomos que cruza cada alfa en el modelo de Thomson. */
  atomsCrossed: number;
  /** Desviación típica de un solo átomo de Thomson (rad, raíz de ⟨θ₁²⟩). */
  thomsonSingleRms: number;
  /** Desviación máxima de un solo átomo de Thomson (rad). */
  thomsonSingleMax: number;
  /** Desviación cuadrática media a la salida de la lámina (rad). */
  thomsonRms: number;
  /** Fracción de alfas desviadas más de 90° (Rutherford): n·t·π·(d/2)²·cot²(45°). */
  fractionBack: number;
  /** Radio del núcleo (fm) y si la alfa llega a tocarlo a 170° (el modelo de Coulomb deja de valer). */
  nucleusFm: number;
  rMinBackFm: number;
  warnings: string[];
}

export function rutherfordSetup(input: RutherfordInput): RutherfordSetup {
  assertInRange('La energía de las alfas', input.energyMeV, RF_LIMITS.energy[0], RF_LIMITS.energy[1]);
  assertInRange('El espesor de la lámina', input.thicknessUm, RF_LIMITS.thickness[0], RF_LIMITS.thickness[1]);
  const foil = foilById(input.foilId);
  const d_fm = closestApproachFm(foil.Z, input.energyMeV);
  const d_m = d_fm * 1e-15;
  const n = numberDensity(foil);
  const nt = n * input.thicknessUm * 1e-6;
  const R_atom = Math.cbrt(3 / (4 * Math.PI * n));
  const atomsCrossed = nt * Math.PI * R_atom * R_atom;
  const ms1 = thomsonMeanSquare(d_m, R_atom);
  // máximo de θ₁(b) en (0, R): búsqueda fina
  let thomsonSingleMax = 0;
  for (let i = 1; i < 2000; i++) thomsonSingleMax = Math.max(thomsonSingleMax, thomsonSingleAngle((R_atom * i) / 2000, d_m, R_atom));
  const thomsonRms = Math.sqrt(atomsCrossed * ms1);
  const fractionBack = nt * Math.PI * (d_m / 2) ** 2; // cot²(45°) = 1
  const nucleusFm = R0_NUCLEAR_FM * Math.cbrt(foil.A);
  const rMinBackFm = minDistance((170 * Math.PI) / 180, d_fm);
  const warnings: string[] = [];
  if (rMinBackFm < nucleusFm + R_ALPHA_FM) warnings.push(`A ${input.energyMeV.toFixed(1)} MeV las alfas que rebotan hacia atrás llegan a ${rMinBackFm.toFixed(1)} fm del centro del núcleo de ${foil.name.toLowerCase()}, casi tocándolo: allí actúa la fuerza nuclear y la ley de Coulomb (el modelo de Rutherford) deja de describir la dispersión.`);
  return { foil, d_fm, d_m, n, nt, R_atom, atomsCrossed, thomsonSingleRms: Math.sqrt(ms1), thomsonSingleMax, thomsonRms, fractionBack, nucleusFm, rMinBackFm, warnings };
}

/**
 * Energía máxima (MeV, múltiplo de 0,5 hacia abajo) con la que las alfas que rebotan a 170° no llegan a tocar el núcleo
 * (r_min ≥ R_núcleo + R_alfa): corrección del aviso de la fuerza nuclear.
 */
export function maxEnergyForCoulomb(f: Foil): number {
  const reach = R0_NUCLEAR_FM * Math.cbrt(f.A) + R_ALPHA_FM;
  const e = (KE2_MEV_FM * Z_ALPHA * f.Z * (1 + 1 / Math.sin((170 * Math.PI) / 360))) / (2 * reach);
  return Math.floor(e * 2 + 1e-9) / 2;
}

/** Conteos esperados por segundo en el detector a θ (grados) según el modelo de Rutherford. */
export function rutherfordRate(s: RutherfordSetup, thetaDeg: number): number {
  const th = (thetaDeg * Math.PI) / 180;
  return SETUP.beamRate * s.nt * SETUP.detectorSolidAngle * rutherfordCrossSection(th, s.d_m);
}
/**
 * Conteos esperados por segundo según el modelo de Thomson (dispersión múltiple gaussiana). Devuelve también el
 * logaritmo decimal, porque a ángulos grandes el número es tan pequeño que no cabe en un número de coma flotante.
 */
export function thomsonRate(s: RutherfordSetup, thetaDeg: number): { rate: number; log10: number } {
  const th = (thetaDeg * Math.PI) / 180;
  const v = s.thomsonRms ** 2;
  const log10 = Math.log10(SETUP.beamRate * SETUP.detectorSolidAngle / (Math.PI * v)) - (th * th) / v / Math.LN10;
  return { rate: log10 < -300 ? 0 : 10 ** log10, log10 };
}

/** Muestra de Poisson con media λ (generador con semilla; Knuth para λ pequeña, normal con corrección para λ grande). */
export function poisson(lambda: number, rand: () => number): number {
  if (lambda <= 0) return 0;
  if (lambda < 30) {
    const L = Math.exp(-lambda);
    let k = 0, p = 1;
    do { k++; p *= rand(); } while (p > L);
    return k - 1;
  }
  const u1 = Math.max(1e-12, rand()), u2 = rand();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return Math.max(0, Math.round(lambda + Math.sqrt(lambda) * z));
}

export interface CountRun {
  thetaDeg: number;
  timeS: number;
  /** Conteo esperado (Rutherford) en el tiempo T. */
  expected: number;
  /** Conteo esperado según Thomson. */
  thomsonExpected: number;
  thomsonLog10: number;
  /** Conteo «observado» (Poisson con semilla). */
  counts: number;
  /** Instantes de llegada de cada centelleo (s), para animar el contador; como mucho 400 (el resto se reparte). */
  arrivals: number[];
  rate: number; // observado por minuto
  sin4: number; // sen⁴(θ/2)
  invSin4: number; // 1/sen⁴(θ/2)
  /** N·sen⁴(θ/2): constante si se cumple el modelo de Rutherford. */
  product: number;
}

/**
 * Corrida de conteo: la naturaleza del laboratorio es el átomo nuclear (el modelo que describe los datos de Geiger y
 * Marsden). El número de centelleos sigue una distribución de Poisson con media Ṅ(θ)·T.
 */
export function countScintillations(s: RutherfordSetup, thetaDeg: number, timeS: number, seed: number): CountRun {
  assertInRange('El ángulo del detector', thetaDeg, RF_LIMITS.angle[0], RF_LIMITS.angle[1]);
  assertInRange('El tiempo de conteo', timeS, RF_LIMITS.time[0], RF_LIMITS.time[1]);
  const rand = seededRandom(seed);
  const expected = rutherfordRate(s, thetaDeg) * timeS;
  const th = thomsonRate(s, thetaDeg);
  const counts = poisson(expected, rand);
  // Llegadas ordenadas (proceso de Poisson: dado el número, los instantes son uniformes).
  const shown = Math.min(400, counts);
  const arrivals = Array.from({ length: shown }, () => rand() * timeS).sort((a, b) => a - b);
  const sin4 = Math.sin((thetaDeg * Math.PI) / 360) ** 4;
  return {
    thetaDeg, timeS, expected, thomsonExpected: th.rate * timeS, thomsonLog10: th.log10 + Math.log10(timeS), counts, arrivals,
    rate: (counts / timeS) * 60, sin4, invSin4: 1 / sin4, product: (counts / timeS) * 60 * sin4,
  };
}
/** Centelleos contados hasta el instante t de una corrida (para el contador animado). */
export function countsUntil(run: CountRun, t: number): number {
  if (t >= run.timeS) return run.counts;
  if (run.counts <= run.arrivals.length) return run.arrivals.filter((a) => a <= t).length;
  return Math.floor((run.counts * t) / run.timeS);
}

/**
 * Desviaciones de una muestra de alfas que cruzan la lámina (para la vista 3D): ángulo polar θ y azimut φ. Con
 * probabilidad igual a la fracción de Rutherford para θ > θ_min se muestrea una desviación grande (distribución
 * ∝ 1/sen⁴(θ/2) por inversión de σ(>θ) ∝ cot²(θ/2)); el resto sigue casi recto (gaussiana de la dispersión múltiple).
 * `boost` multiplica la probabilidad de las desviaciones grandes para que se vean en un dibujo de pocas trayectorias.
 */
export function sampleDeflections(s: RutherfordSetup, count: number, seed: number, thetaMinDeg = 10, boost = 1): { theta: number; phi: number; large: boolean }[] {
  const rand = seededRandom(seed);
  const tmin = (thetaMinDeg * Math.PI) / 180;
  const cot2min = 1 / Math.tan(tmin / 2) ** 2;
  const pLarge = Math.min(0.5, s.nt * Math.PI * (s.d_m / 2) ** 2 * cot2min * boost);
  const out: { theta: number; phi: number; large: boolean }[] = [];
  for (let i = 0; i < count; i++) {
    const phi = 2 * Math.PI * rand();
    if (rand() < pLarge) {
      // σ(>θ) ∝ cot²(θ/2): u = cot²(θ/2)/cot²(θmin/2) uniforme en (0, 1].
      const u = Math.max(1e-6, rand());
      const theta = 2 * Math.atan(1 / Math.sqrt(u * cot2min));
      out.push({ theta, phi, large: true });
    } else {
      const g = Math.sqrt(-Math.log(Math.max(1e-12, rand()))) * s.thomsonRms; // |θ| de una gaussiana 2D
      out.push({ theta: g, phi, large: false });
    }
  }
  return out;
}

/* ------------------------------------------------------------------ Geiger y Marsden (1913) */

/**
 * Datos de Geiger y Marsden (1913), Philosophical Magazine 25(148), 604–623, tabla del oro: ángulo (°) y centelleos
 * contados (normalizados por los autores). Transcripción de la tabla tal como se reproduce en los textos de física
 * moderna; cotejar con el artículo original (por verificar).
 */
export const GEIGER_MARSDEN_GOLD: { theta: number; counts: number }[] = [
  { theta: 150, counts: 33.1 }, { theta: 135, counts: 43.0 }, { theta: 120, counts: 51.9 }, { theta: 105, counts: 69.5 },
  { theta: 75, counts: 211 }, { theta: 60, counts: 477 }, { theta: 45, counts: 1435 }, { theta: 37.5, counts: 3300 },
  { theta: 30, counts: 7800 }, { theta: 22.5, counts: 27300 }, { theta: 15, counts: 132000 },
];

/* ------------------------------------------------------------------ Bohr */

/** Primera energía de ionización del hidrógeno (eV): tabla de PubChem (NIST). */
export const H_IONIZATION_EV = 13.598;
/** h·c en eV·nm (CODATA 2018: 1239,841984 eV·nm). */
export const HC_EV_NM = 1239.841984;
/** Índice de refracción del aire seco a 15 °C en el visible (para pasar λ del vacío al aire). */
export const N_AIR = 1.000277;

export const bohrEnergy = (n: number) => -H_IONIZATION_EV / (n * n);
/** Radio de la órbita n de Bohr (pm): rₙ = n²·a₀, a₀ = 52,9177 pm. */
export const BOHR_RADIUS_PM = 52.9177;
export const bohrRadius = (n: number) => n * n * BOHR_RADIUS_PM;

export interface Transition { nUpper: number; nLower: number; energyEV: number; lambdaVacNm: number; lambdaAirNm: number; region: 'ultravioleta' | 'visible' | 'infrarrojo'; series: string; colorName: string }

export const SERIES_NAME: Record<number, string> = { 1: 'Lyman', 2: 'Balmer', 3: 'Paschen' };

export function transition(nUpper: number, nLower: number): Transition {
  if (!Number.isInteger(nUpper) || !Number.isInteger(nLower) || nLower < 1 || nUpper <= nLower || nUpper > 7) throw new RangeError('La transición debe ir de un nivel superior (≤ 7) a uno inferior.');
  const energyEV = H_IONIZATION_EV * (1 / (nLower * nLower) - 1 / (nUpper * nUpper));
  const lambdaVacNm = HC_EV_NM / energyEV;
  const lambdaAirNm = lambdaVacNm / N_AIR;
  const region = lambdaAirNm < 380 ? 'ultravioleta' : lambdaAirNm > 750 ? 'infrarrojo' : 'visible';
  return { nUpper, nLower, energyEV, lambdaVacNm, lambdaAirNm, region, series: SERIES_NAME[nLower] ?? `n = ${nLower}`, colorName: colorName(lambdaAirNm) };
}

/** Nombre del color percibido (aproximado) de una línea espectral. */
export function colorName(nm: number): string {
  if (nm < 380) return 'ultravioleta (invisible)';
  if (nm < 450) return 'violeta';
  if (nm < 495) return 'azul verdoso';
  if (nm < 570) return 'verde';
  if (nm < 590) return 'amarillo';
  if (nm < 620) return 'naranja';
  if (nm <= 750) return 'rojo';
  return 'infrarrojo (invisible)';
}

/**
 * Color de dibujo «#rrggbb» de una longitud de onda visible (aproximación por tramos lineales de Bruton, 1996, con
 * atenuación en los extremos). Solo para dibujar la línea: fuera del visible devuelve un gris.
 */
export function wavelengthColor(nm: number): string {
  let r = 0, g = 0, b = 0;
  if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = -(nm - 645) / 65; }
  else if (nm <= 750) { r = 1; }
  else return '#8a8f98';
  if (nm < 380) return '#8a8f98';
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (750 - nm)) / 50 : 1;
  const c = (v: number) => Math.round(255 * (v * f) ** 0.8).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

/** Líneas de Balmer del hidrógeno en aire (nm), NIST Atomic Spectra Database (Kramida y otros), redondeadas. */
export const NIST_BALMER_AIR: Record<number, number> = { 3: 656.279, 4: 486.135, 5: 434.047, 6: 410.174 };

/* ------------------------------------------------------------------ comparación de modelos */

export type AtomModelId = 'dalton' | 'thomson' | 'rutherford' | 'bohr';
export const ATOM_MODELS: { id: AtomModelId; name: string; year: string; idea: string; predicts: string; fails: string }[] = [
  { id: 'dalton', name: 'Dalton', year: '1808', idea: 'Átomos macizos e indivisibles; los de un mismo elemento son iguales y se combinan en proporciones fijas.', predicts: 'Explica las leyes de las proporciones definidas y múltiples.', fails: 'No explica la electricidad de la materia ni los electrones (Thomson, 1897).' },
  { id: 'thomson', name: 'Thomson', year: '1904', idea: 'Esfera de carga positiva uniforme con los electrones incrustados («budín con pasas»).', predicts: 'Las alfas cruzan la lámina casi rectas: desviaciones de menos de un grado.', fails: 'No explica las alfas que rebotan a más de 90° (1 de cada miles) ni los espectros de líneas.' },
  { id: 'rutherford', name: 'Rutherford', year: '1911', idea: 'Casi toda la masa y la carga positiva en un núcleo diminuto; los electrones alrededor y mucho espacio vacío.', predicts: 'La mayoría pasa recta, pero unas pocas se desvían mucho: N ∝ 1/sen⁴(θ/2).', fails: 'Según la física clásica el electrón en órbita radiaría y caería al núcleo; no explica las líneas del espectro.' },
  { id: 'bohr', name: 'Bohr', year: '1913', idea: 'El electrón solo ocupa órbitas con energías permitidas Eₙ = −13,6 eV/n² y emite un fotón al bajar de nivel.', predicts: 'Las líneas del hidrógeno: 656, 486, 434 y 410 nm (serie de Balmer).', fails: 'No funciona bien con átomos de más de un electrón; lo mejora el modelo cuántico (orbitales).' },
];

export const atomicModelsSpec: ModelSpec = {
  name: 'Dispersión de partículas alfa (Rutherford frente a Thomson) y niveles de energía de Bohr',
  inputs: [
    { symbol: 'Z', name: 'Número atómico del metal de la lámina (Au, Ag, Cu, Al)', unit: '—', initial: 79 },
    { symbol: 'E', name: 'Energía cinética de las alfas', unit: 'MeV', range: RF_LIMITS.energy, initial: 5 },
    { symbol: 't', name: 'Espesor de la lámina', unit: 'µm', range: RF_LIMITS.thickness, initial: 0.4 },
    { symbol: 'θ', name: 'Ángulo del detector', unit: '°', range: RF_LIMITS.angle, initial: 60 },
    { symbol: 'T', name: 'Tiempo de conteo', unit: 's', range: RF_LIMITS.time, initial: 60 },
    { symbol: 'nᵢ → n_f', name: 'Transición del electrón en el átomo de Bohr', unit: '—', initial: '3 → 2' },
  ],
  outputs: [
    { symbol: 'N', name: 'Centelleos contados en el detector', unit: 'cuentas' },
    { symbol: 'N/min', name: 'Centelleos por minuto', unit: 'min⁻¹' },
    { symbol: 'N·sen⁴(θ/2)', name: 'Producto que debe ser constante si vale Rutherford', unit: 'min⁻¹' },
    { symbol: 'd', name: 'Distancia de máximo acercamiento al núcleo', unit: 'fm' },
    { symbol: 'λ', name: 'Longitud de onda del fotón emitido (aire)', unit: 'nm' },
  ],
  equations: [
    'd = k·z·Z·e²/E,  con k·e² = 1,44 MeV·fm y z = 2',
    'tan(θ/2) = d/(2b)   (choque con un núcleo puntual)',
    'N(θ) = Ṅ·T·n·t·ΔΩ·(d/4)² / sen⁴(θ/2),   n = ρ·N_A/M',
    'Thomson: θ₁(b) = (d/b)·[1 − (1 − b²/R²)^(3/2)];  ⟨θ²⟩ = N_átomos·⟨θ₁²⟩;  N(θ) ∝ exp(−θ²/⟨θ²⟩)',
    'Bohr: Eₙ = −13,598 eV/n²;  E_fotón = 13,598 eV·(1/n_f² − 1/nᵢ²);  λ = h·c/E_fotón',
  ],
  initialConditions: [
    'Haz de 1,0 × 10⁸ alfas por segundo sobre la lámina; detector de 1,0 × 10⁻³ sr (pantalla de ZnS vista con un microscopio).',
    'Lámina de oro de 0,4 µm y alfas de 5,0 MeV al abrir la práctica.',
    'Cada conteo es una muestra de Poisson con semilla reproducible (el número de centelleos fluctúa como en el experimento real).',
  ],
  assumptions: [
    'Un solo choque fuerte por alfa con un núcleo puntual (lámina delgada); se ignora el retroceso del núcleo (núcleo mucho más pesado que la alfa).',
    'Los electrones casi no desvían a la alfa (su masa es unas 7300 veces menor) y apantallan el núcleo solo a distancias atómicas: no cambian la dispersión a θ ≥ 10°.',
    'Átomo de Thomson: esfera positiva uniforme del tamaño del átomo (radio de Wigner–Seitz) y desviaciones pequeñas que se suman al azar.',
    'La alfa no pierde energía dentro de la lámina.',
    'Átomo de Bohr: un solo electrón (hidrógeno) en órbitas circulares; masa del núcleo incluida a través de la energía de ionización medida (13,598 eV).',
  ],
  limits: [
    'Si la alfa llega a tocar el núcleo (energías altas y núcleos livianos, como el aluminio a más de 6 MeV), la fuerza nuclear cambia la dispersión: el modelo lo avisa.',
    'Por debajo de unos 10° la dispersión múltiple y el apantallamiento de los electrones cambian la ley 1/sen⁴: el detector no baja de 10°.',
    'El modelo de Bohr no explica la estructura fina de las líneas ni los átomos de varios electrones; λ se da en aire con un índice medio (1,000277).',
    'Los dibujos de los cuatro modelos y de las trayectorias en la lámina no están a escala: el núcleo es unas 10 000 veces más pequeño que el átomo.',
  ],
  testCases: [
    'Distancia de máximo acercamiento del oro con alfas de 5 MeV: d = 1,44·2·79/5 ≈ 45,5 fm; tan(θ/2) = d/(2b) y la trayectoria hiperbólica sale con ese ángulo y conserva la energía.',
    'N·sen⁴(θ/2) es constante en el modelo de Rutherford, y los datos de Geiger y Marsden (1913) lo cumplen dentro de ±25 % (mientras N cambia en un factor de 4000).',
    'N ∝ Z² y ∝ 1/E²: el oro da (79/47)² = 2,83 veces más centelleos que la plata con la misma energía.',
    'Thomson: desviación máxima de un átomo ≈ 1,02·d/R y desviación típica en 0,4 µm de oro de menos de 1°; conteo a 90° prácticamente nulo.',
    'Bohr: Hα = 656,3 nm, Hβ = 486,1 nm, Hγ = 434,0 nm y Hδ = 410,2 nm en aire, a menos de 0,05 nm de los valores del NIST.',
  ],
};
