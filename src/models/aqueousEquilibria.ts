import { KW, solvePH } from './acidbase';

/**
 * pH de disoluciones acuosas con ácidos polipróticos, bases fuertes y sales (grado 10.º), por balance de cargas exacto.
 *
 * Generaliza el método de src/models/acidbase.ts (que resuelve un ácido monoprótico con NaOH) a varios solutos con
 * varias disociaciones sucesivas. Para cada soluto de concentración analítica C, con su forma más protonada de carga z₀
 * y constantes Ka₁…Kaₙ (null = disociación fuerte), la fracción de la especie que perdió j protones es
 *   αⱼ = (Ka₁·…·Kaⱼ·[H⁺]ⁿ⁻ʲ) / Σₖ (Ka₁·…·Kaₖ·[H⁺]ⁿ⁻ᵏ)
 * y el balance de cargas es
 *   [H⁺] + Σ cationes espectadores = [OH⁻] + Σ aniones espectadores + Σ C·Σⱼ αⱼ·(j − z₀),   [OH⁻] = Kw/[H⁺].
 * Se resuelve por bisección en log[H⁺] (la función es monótona). Con un solo soluto monoprótico y NaOH coincide con
 * solvePH de acidbase.ts (lo comprueban las pruebas unitarias).
 * Supuestos: 25 °C, Kw = 1,0 × 10⁻¹⁴, actividades = concentraciones (disoluciones diluidas), sin CO₂ del aire.
 */

/** Constante de una disociación «fuerte» (prácticamente completa) en el cálculo. */
const STRONG = 1e12;

export interface Solute {
  /** Concentración analítica (mol/L). */
  c: number;
  /** Constantes de acidez sucesivas; null = disociación fuerte. */
  ka: (number | null)[];
  /** Carga de la forma más protonada (0 para H₂CO₃, +1 para NH₄⁺). */
  z0?: number;
}

export interface Mixture {
  solutes: Solute[];
  /** Σ carga·concentración de cationes espectadores (Na⁺, K⁺, Ca²⁺…), en mol/L de carga. */
  cations?: number;
  /** Σ |carga|·concentración de aniones espectadores (Cl⁻, NO₃⁻…), en mol/L de carga. */
  anions?: number;
}

/** Fracciones α₀…αₙ de un soluto a una [H⁺] dada. */
export function alphas(ka: (number | null)[], h: number): number[] {
  const k = ka.map((x) => (x === null ? STRONG : x));
  const n = k.length;
  const terms: number[] = [];
  let prod = 1;
  for (let j = 0; j <= n; j++) {
    if (j > 0) prod *= k[j - 1];
    terms.push(prod * h ** (n - j));
  }
  // Escalado para evitar desbordes con constantes muy grandes o muy pequeñas.
  const max = Math.max(...terms);
  const sum = terms.reduce((s, t) => s + t / max, 0);
  return terms.map((t) => t / max / sum);
}

function chargeImbalance(m: Mixture, h: number): number {
  let neg = KW / h + (m.anions ?? 0);
  for (const s of m.solutes) {
    const a = alphas(s.ka, h);
    const z0 = s.z0 ?? 0;
    neg += s.c * a.reduce((t, aj, j) => t + aj * (j - z0), 0);
  }
  return h + (m.cations ?? 0) - neg;
}

/** pH de la mezcla por balance de cargas (bisección en log[H⁺] entre −16 y 1). */
export function mixturePHGeneral(m: Mixture): number {
  for (const s of m.solutes) if (!(s.c >= 0) || !Number.isFinite(s.c)) throw new RangeError('Las concentraciones deben ser números no negativos.');
  let lo = -16, hi = 1;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (chargeImbalance(m, 10 ** mid) > 0) hi = mid; else lo = mid;
  }
  return -(lo + hi) / 2;
}

/** pH de una base fuerte de concentración de OH⁻ dada (usa solvePH de acidbase.ts). */
export function strongBasePH(cOH: number): number {
  return solvePH(0, cOH, null);
}

/* ------------------------------------------------------------------ constantes citadas */

/**
 * Constantes a 25 °C. pKa: Harris, D. C. (2010). Quantitative Chemical Analysis (8.ª ed.). Nueva York: W. H. Freeman,
 * apéndice G. Ka del ácido acético: el valor 1,8 × 10⁻⁵ de src/models/acidbase.ts (prompt maestro, sección 9.2).
 * Kps: Haynes (ed.) (2016), CRC Handbook of Chemistry and Physics (97.ª ed.), «Solubility Product Constants».
 * Henry del CO₂: Sander, R. (2015). Atmospheric Chemistry and Physics, 15, 4399–4981 (Hᶜᵖ ≈ 3,4 × 10⁻² mol/(L·atm)).
 */
export const PKA = {
  H2CO3: [6.351, 10.329],
  H2SO3: [1.857, 7.172],
  HSO4: 1.987,
  H3PO4: [2.148, 7.198, 12.375],
  HClO: 7.53,
  HF: 3.17,
  NH4: 9.245,
} as const;
export const KA_ACETIC = 1.8e-5;
export const KSP = { CaOH2: 5.02e-6, MgOH2: 5.61e-12 } as const;
export const HENRY_CO2 = 3.4e-2; // mol/(L·atm)

const k = (pka: number) => 10 ** -pka;

/** Ácidos y bases conjugados frecuentes como solutos (forma más protonada). */
export const SOLUTES = {
  H2CO3: (c: number): Solute => ({ c, ka: PKA.H2CO3.map(k) }),
  H2SO3: (c: number): Solute => ({ c, ka: PKA.H2SO3.map(k) }),
  H2SO4: (c: number): Solute => ({ c, ka: [null, k(PKA.HSO4)] }),
  H3PO4: (c: number): Solute => ({ c, ka: PKA.H3PO4.map(k) }),
  HNO3: (c: number): Solute => ({ c, ka: [null] }),
  HCl: (c: number): Solute => ({ c, ka: [null] }),
  HClO: (c: number): Solute => ({ c, ka: [k(PKA.HClO)] }),
  CH3COOH: (c: number): Solute => ({ c, ka: [KA_ACETIC] }),
  NH4: (c: number): Solute => ({ c, ka: [k(PKA.NH4)], z0: 1 }),
} as const;

/** Solubilidad molar de un hidróxido M(OH)₂ a partir de su Kps: s = (Kps/4)^(1/3). */
export function hydroxide2Solubility(ksp: number): number {
  return Math.cbrt(ksp / 4);
}
