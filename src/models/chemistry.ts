/**
 * Utilidades de química: masas atómicas y analizador de fórmulas.
 * Masas atómicas estándar abreviadas (IUPAC), con 3–4 cifras significativas útiles en el aula.
 */
export const ATOMIC_MASSES: Record<string, number> = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, Na: 22.99, Mg: 24.305, Al: 26.982, S: 32.06,
  Cl: 35.45, K: 39.098, Ca: 40.078, Mn: 54.938, Fe: 55.845, Cu: 63.546, Zn: 65.38, Ag: 107.87,
};

export type Composition = Record<string, number>;

function addInto(target: Composition, src: Composition, mult = 1) {
  for (const [el, n] of Object.entries(src)) target[el] = (target[el] ?? 0) + n * mult;
}

/**
 * Analiza fórmulas como "H2O", "Ca(OH)2", "CH3COOH", "CuSO4·5H2O".
 * Lanza un error si encuentra símbolos desconocidos.
 */
export function parseFormula(formula: string): Composition {
  const parts = formula.replace(/\s/g, '').split(/[·.*]/);
  const total: Composition = {};
  for (const part of parts) {
    const m = part.match(/^(\d*)(.*)$/)!;
    const coef = m[1] ? parseInt(m[1], 10) : 1;
    addInto(total, parseGroup(m[2]), coef);
  }
  return total;
}

function parseGroup(s: string): Composition {
  const stack: Composition[] = [{}];
  let i = 0;
  const readNumber = () => {
    let num = '';
    while (i < s.length && /\d/.test(s[i])) num += s[i++];
    return num ? parseInt(num, 10) : 1;
  };
  while (i < s.length) {
    const ch = s[i];
    if (ch === '(' || ch === '[') { stack.push({}); i++; }
    else if (ch === ')' || ch === ']') {
      i++;
      const n = readNumber();
      const group = stack.pop();
      if (!group || stack.length === 0) throw new Error(`Paréntesis desbalanceados en ${s}`);
      addInto(stack[stack.length - 1], group, n);
    } else if (/[A-Z]/.test(ch)) {
      let el = ch; i++;
      while (i < s.length && /[a-z]/.test(s[i])) el += s[i++];
      if (!(el in ATOMIC_MASSES)) throw new Error(`Elemento desconocido: ${el}`);
      const n = readNumber();
      stack[stack.length - 1][el] = (stack[stack.length - 1][el] ?? 0) + n;
    } else {
      throw new Error(`Carácter no válido en la fórmula: "${ch}"`);
    }
  }
  if (stack.length !== 1) throw new Error(`Paréntesis desbalanceados en ${s}`);
  return stack[0];
}

export function molarMass(formula: string): number {
  const comp = parseFormula(formula);
  return Object.entries(comp).reduce((sum, [el, n]) => sum + ATOMIC_MASSES[el] * n, 0);
}

/** Formatea una fórmula con subíndices Unicode para la interfaz. */
export function prettyFormula(formula: string): string {
  const sub = '₀₁₂₃₄₅₆₇₈₉';
  return formula.replace(/(?<=[A-Za-z)\]])(\d+)/g, (d) => [...d].map((c) => sub[+c]).join(''));
}
