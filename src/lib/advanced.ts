/**
 * Modo avanzado (U6): ecuaciones del modelo con los valores actuales, parámetros editables del modelo
 * y utilidades para la curva del modelo en el cuaderno. Funciones puras (sin React) para probarlas con Vitest.
 *
 * Notación de las ecuaciones (subconjunto pequeño inspirado en LaTeX, sin dependencias):
 *   \frac{a}{b}   fracción            \sqrt{a}   raíz cuadrada
 *   x^{2}, x^2    superíndice         v_{0}, v_0 subíndice
 *   \text{...}    texto normal        {...}      agrupación (no se dibuja)
 *   [clave]       variable publicada por el laboratorio: en la forma simbólica se escribe su símbolo y en la
 *                 sustitución su valor actual con unidad.
 *   \cdot · \times × \approx ≈ \pi π \Delta Δ \,  (espacio fino); operadores = + − - · × / ≈ < > ≤ ≥ ( ).
 * Entre factores se escribe «·» explícito ([m]·[g]·[h]) para que la sustitución numérica sea legible.
 */
import { fmt, fmtSig } from './format';

/* ------------------------------------------------------------------ árbol de la notación */

export type MathNode =
  | { k: 'id'; v: string }
  | { k: 'num'; v: string }
  | { k: 'op'; v: string }
  | { k: 'text'; v: string }
  | { k: 'unit'; v: string }
  | { k: 'space' }
  | { k: 'row'; a: MathNode[] }
  | { k: 'frac'; n: MathNode[]; d: MathNode[] }
  | { k: 'sqrt'; a: MathNode[] }
  | { k: 'sup'; b: MathNode; e: MathNode[] }
  | { k: 'sub'; b: MathNode; s: MathNode[] }
  | { k: 'subsup'; b: MathNode; s: MathNode[]; e: MathNode[] }
  | { k: 'var'; key: string };

const COMMANDS: Record<string, MathNode> = {
  cdot: { k: 'op', v: '·' }, times: { k: 'op', v: '×' }, approx: { k: 'op', v: '≈' }, pi: { k: 'id', v: 'π' },
  Delta: { k: 'id', v: 'Δ' }, rho: { k: 'id', v: 'ρ' }, theta: { k: 'id', v: 'θ' }, lambda: { k: 'id', v: 'λ' },
  mu: { k: 'id', v: 'μ' }, varepsilon: { k: 'id', v: 'ε' }, omega: { k: 'id', v: 'ω' }, Sigma: { k: 'op', v: 'Σ' },
  sin: { k: 'id', v: 'sen' }, cos: { k: 'id', v: 'cos' }, ln: { k: 'id', v: 'ln' }, to: { k: 'op', v: '→' },
  le: { k: 'op', v: '≤' }, prime: { k: 'op', v: '′' }, ge: { k: 'op', v: '≥' }, pm: { k: 'op', v: '±' },
};
const OPERATORS = new Set(['=', '+', '−', '-', '·', '×', '/', '≈', '<', '>', '≤', '≥', '(', ')', ',', ';', '→', '⇒', '±', '|', '∥', '%']);
const isLetter = (c: string) => /\p{L}/u.test(c);
const isDigit = (c: string) => c >= '0' && c <= '9';

/** Convierte la notación en un árbol. Lanza un error descriptivo si las llaves no están balanceadas. */
export function parseMath(src: string): MathNode[] {
  let i = 0;
  const readGroup = (): MathNode[] => {
    // Lee {…} o un único símbolo (para x^2 o v_0).
    while (src[i] === ' ') i++;
    if (src[i] === '{') {
      i++;
      const inner = parseUntil('}');
      if (src[i] !== '}') throw new Error(`Falta «}» en «${src}»`);
      i++;
      return inner;
    }
    const one = parseAtom();
    return one ? [one] : [];
  };
  const parseAtom = (): MathNode | null => {
    const c = src[i];
    if (c === undefined) return null;
    if (c === '\\') {
      i++;
      if (src[i] === ',') { i++; return { k: 'space' }; }
      let name = '';
      while (i < src.length && /[A-Za-z]/.test(src[i])) name += src[i++];
      if (name === 'frac') { const n = readGroup(); const d = readGroup(); return { k: 'frac', n, d }; }
      if (name === 'sqrt') return { k: 'sqrt', a: readGroup() };
      if (name === 'text') {
        while (src[i] === ' ') i++;
        if (src[i] !== '{') throw new Error('\\text necesita llaves');
        const end = src.indexOf('}', i);
        if (end < 0) throw new Error(`Falta «}» en «${src}»`);
        const v = src.slice(i + 1, end); i = end + 1;
        return { k: 'text', v };
      }
      const cmd = COMMANDS[name];
      if (!cmd) throw new Error(`Comando desconocido: \\${name}`);
      return { ...cmd };
    }
    if (c === '{') { i++; const a = parseUntil('}'); if (src[i] !== '}') throw new Error(`Falta «}» en «${src}»`); i++; return { k: 'row', a }; }
    if (c === '[') {
      const end = src.indexOf(']', i);
      if (end < 0) throw new Error(`Falta «]» en «${src}»`);
      const key = src.slice(i + 1, end).trim(); i = end + 1;
      return { k: 'var', key };
    }
    if (isDigit(c)) {
      let v = '';
      while (i < src.length && (isDigit(src[i]) || ((src[i] === ',' || src[i] === '.') && isDigit(src[i + 1] ?? '')))) v += src[i++];
      return { k: 'num', v: v.replace('.', ',') };
    }
    if (isLetter(c)) {
      let v = '';
      while (i < src.length && isLetter(src[i])) v += src[i++];
      return { k: 'id', v };
    }
    i++;
    if (c === '-') return { k: 'op', v: '−' };
    if (OPERATORS.has(c)) return { k: 'op', v: c };
    return { k: 'op', v: c };
  };
  const parseUntil = (close: string | null): MathNode[] => {
    const out: MathNode[] = [];
    while (i < src.length) {
      const c = src[i];
      if (close && c === close) break;
      if (c === ' ') { i++; continue; }
      if (c === '}' ) throw new Error(`«}» sobrante en «${src}»`);
      if ((c === '^' || c === '_') && out.length > 0) {
        i++;
        const g = readGroup();
        const prev = out.pop()!;
        if (c === '^') out.push(prev.k === 'sub' ? { k: 'subsup', b: prev.b, s: prev.s, e: g } : { k: 'sup', b: prev, e: g });
        else out.push(prev.k === 'sup' ? { k: 'subsup', b: prev.b, s: g, e: prev.e } : { k: 'sub', b: prev, s: g });
        continue;
      }
      const a = parseAtom();
      if (a) out.push(a);
    }
    return out;
  };
  const nodes = parseUntil(null);
  if (i < src.length) throw new Error(`Notación inválida: «${src}»`);
  return nodes;
}

/* ------------------------------------------------------------------ magnitudes publicadas */

/** Magnitud del modelo publicada por un laboratorio: símbolo (en la notación), valor actual y unidad. */
export interface ModelQuantity {
  sym: string;
  value: number | null;
  unit?: string;
  /** Decimales fijos; si se omite se usan `sig` cifras significativas (3 por defecto). */
  decimals?: number;
  sig?: number;
  /** Nombre en palabras (lectores de pantalla y leyenda de variables). */
  name?: string;
}

/** Ecuación del modelo: `lhs` (clave de la magnitud que se calcula) = `expr` (con variables [clave]). */
export interface ModelEquation {
  /** Título breve (p. ej. «Densidad»). */
  title?: string;
  lhs: string;
  expr: string;
  /** Nota que acompaña a la ecuación (supuesto o condición de validez). */
  note?: string;
}

export interface ModelState {
  vars: Record<string, ModelQuantity>;
  equations: ModelEquation[];
  /** Observación general (p. ej. «el circuito está abierto»). */
  note?: string;
}

/** Valor con el formato colombiano (coma decimal) según los decimales o cifras significativas de la magnitud. */
export function formatValue(q: Pick<ModelQuantity, 'value' | 'decimals' | 'sig'>): string {
  if (q.value === null || !Number.isFinite(q.value)) return '—';
  const t = q.decimals !== undefined ? fmt(q.value, q.decimals) : fmtSig(q.value, q.sig ?? 3);
  // Signo menos tipográfico; un valor que se redondea a cero no lleva signo («−0,000» → «0,000»).
  return /^-0(,0*)?$/.test(t) ? t.slice(1) : t.replace(/^-/, '−');
}

export function formatQuantity(q: ModelQuantity): string {
  const v = formatValue(q);
  return q.unit && v !== '—' ? `${v} ${q.unit}` : v;
}

/** Nodos de una magnitud con su valor (número, espacio fino y unidad; entre paréntesis si es negativa). */
function quantityNodes(q: ModelQuantity): MathNode[] {
  const text = formatValue(q);
  const neg = text.startsWith('−');
  const numText = neg ? text.slice(1) : text;
  const core: MathNode[] = [{ k: 'num', v: numText }];
  if (q.unit) core.push({ k: 'space' }, { k: 'unit', v: q.unit });
  return neg ? [{ k: 'op', v: '(' }, { k: 'op', v: '−' }, ...core, { k: 'op', v: ')' }] : core;
}

/** Sustituye las variables [clave] por su símbolo (`'symbol'`) o por su valor con unidad (`'value'`). */
export function resolveVars(nodes: MathNode[], vars: Record<string, ModelQuantity>, mode: 'symbol' | 'value'): MathNode[] {
  const one = (n: MathNode): MathNode => {
    switch (n.k) {
      case 'var': {
        const q = vars[n.key];
        if (!q) return { k: 'text', v: `[${n.key}]` };
        return { k: 'row', a: mode === 'symbol' ? parseMath(q.sym) : quantityNodes(q) };
      }
      case 'row': return { k: 'row', a: n.a.map(one) };
      case 'frac': return { k: 'frac', n: n.n.map(one), d: n.d.map(one) };
      case 'sqrt': return { k: 'sqrt', a: n.a.map(one) };
      case 'sup': return { k: 'sup', b: powerBase(n.b), e: n.e.map(one) };
      case 'sub': return { k: 'sub', b: one(n.b), s: n.s.map(one) };
      case 'subsup': return { k: 'subsup', b: powerBase(n.b), s: n.s.map(one), e: n.e.map(one) };
      default: return n;
    }
  };
  // Una magnitud con unidad elevada a una potencia va entre paréntesis: (2,25 m/s)², no 2,25 m/s².
  const powerBase = (b: MathNode): MathNode => {
    const r = one(b);
    if (mode !== 'value' || b.k !== 'var' || r.k !== 'row') return r;
    const q = vars[b.key];
    const wrapped = r.a[0]?.k === 'op' && r.a[0].v === '(';
    return q?.unit && !wrapped ? { k: 'row', a: [{ k: 'op', v: '(' }, ...r.a, { k: 'op', v: ')' }] } : r;
  };
  return nodes.map(one);
}

/** Claves de las variables que aparecen en una expresión. */
export function varsIn(expr: string): string[] {
  const out: string[] = [];
  const walk = (ns: MathNode[]) => ns.forEach((n) => {
    if (n.k === 'var') out.push(n.key);
    else if (n.k === 'row' || n.k === 'sqrt') walk(n.a);
    else if (n.k === 'frac') { walk(n.n); walk(n.d); }
    else if (n.k === 'sup') { walk([n.b]); walk(n.e); }
    else if (n.k === 'sub') { walk([n.b]); walk(n.s); }
    else if (n.k === 'subsup') { walk([n.b]); walk(n.s); walk(n.e); }
  });
  walk(parseMath(expr));
  return [...new Set(out)];
}

/* ------------------------------------------------------------------ texto plano (respaldo) */

const SUP: Record<string, string> = { '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '−': '⁻', '+': '⁺', n: 'ⁿ' };
const SUB: Record<string, string> = { '0': '₀', '1': '₁', '2': '₂', '3': '₃', '4': '₄', '5': '₅', '6': '₆', '7': '₇', '8': '₈', '9': '₉', e: 'ₑ', k: 'ₖ', m: 'ₘ', s: 'ₛ', i: 'ᵢ', r: 'ᵣ' };
const hasOp = (ns: MathNode[]): boolean => ns.some((n) => (n.k === 'op' && n.v !== '(' && n.v !== ')') || (n.k === 'row' && hasOp(n.a)));
const mapChars = (s: string, map: Record<string, string>) => ([...s].every((c) => map[c]) ? [...s].map((c) => map[c]).join('') : null);

/** Texto plano equivalente (para lectores de pantalla, copiar y navegadores sin MathML). */
export function mathToText(nodes: MathNode[]): string {
  let out = '';
  const push = (s: string, spaced = false) => {
    if (spaced) out = `${out.replace(/ $/, '')} ${s} `;
    else out += s;
  };
  const wrap = (ns: MathNode[]) => (hasOp(ns) ? `(${mathToText(ns)})` : mathToText(ns));
  nodes.forEach((n, idx) => {
    const prev = nodes[idx - 1];
    switch (n.k) {
      case 'id': case 'num':
        if (prev && (prev.k === 'id' || prev.k === 'unit') && n.k === 'id' && !out.endsWith(' ')) push(' ');
        push(n.v); break;
      case 'unit': push(n.v); break;
      case 'text': push(n.v); break;
      case 'space': push(' '); break;
      case 'op':
        if (n.v === '(') push('(');
        else if (n.v === '′') { out = out.replace(/ $/, ''); push('′'); }
        else if (n.v === ')') { out = out.replace(/ $/, ''); push(')'); }
        else if (n.v === ',' || n.v === ';') { out = out.replace(/ $/, ''); push(`${n.v} `); }
        else if (n.v === '−' && (!prev || (prev.k === 'op' && prev.v !== ')'))) push('−');
        else push(n.v, true);
        break;
      case 'row': if (prev && prev.k === 'id' && !out.endsWith(' ')) push(' '); push(mathToText(n.a)); break;
      case 'frac': push(`${wrap(n.n)} / ${wrap(n.d)}`); break;
      case 'sqrt': push(`√${n.a.length === 1 && (n.a[0].k === 'id' || n.a[0].k === 'num') ? mathToText(n.a) : `(${mathToText(n.a)})`}`); break;
      case 'sup': { const e = mathToText(n.e); push(`${mathToText([n.b])}${mapChars(e, SUP) ?? `^(${e})`}`); break; }
      case 'sub': { if (prev && prev.k === 'id' && !out.endsWith(' ')) push(' '); const s = mathToText(n.s); push(`${mathToText([n.b])}${mapChars(s, SUB) ?? `_${s}`}`); break; }
      case 'subsup': { const s = mathToText(n.s), e = mathToText(n.e); push(`${mathToText([n.b])}${mapChars(s, SUB) ?? `_${s}`}${mapChars(e, SUP) ?? `^(${e})`}`); break; }
      case 'var': push(`[${n.key}]`); break;
    }
  });
  return out.replace(/\s+/g, ' ').trim();
}

/* ------------------------------------------------------------------ ecuación paso a paso */

export interface EquationSteps {
  /** Lado izquierdo (símbolo de la magnitud calculada). */
  lhs: MathNode[];
  /** Pasos a la derecha del signo igual: forma simbólica, sustitución numérica y resultado. */
  steps: MathNode[][];
  /** Faltan valores para sustituir (p. ej. aún no se ha pesado la muestra). */
  missing: string[];
  text: string;
}

/**
 * Construye «ρ = m / V = 21,6 g / 8,00 cm³ = 2,70 g/cm³»: símbolo, forma simbólica, sustitución y resultado.
 * Se omite la sustitución cuando coincide con la forma simbólica (p. ej. si la expresión es un solo número).
 */
export function equationSteps(eq: ModelEquation, vars: Record<string, ModelQuantity>): EquationSteps {
  const lhsQ = vars[eq.lhs];
  const lhs = lhsQ ? parseMath(lhsQ.sym) : parseMath(eq.lhs);
  const expr = parseMath(eq.expr);
  const symbolic = resolveVars(expr, vars, 'symbol');
  const used = varsIn(eq.expr);
  const missing = used.filter((k) => !vars[k] || vars[k].value === null || !Number.isFinite(vars[k].value as number));
  const steps: MathNode[][] = [symbolic];
  if (missing.length === 0) {
    const values = resolveVars(expr, vars, 'value');
    if (used.length > 0) steps.push(values);
    if (lhsQ && lhsQ.value !== null && Number.isFinite(lhsQ.value)) steps.push(quantityNodes(lhsQ));
  }
  const text = [mathToText(lhs), ...steps.map(mathToText)].join(' = ');
  return { lhs, steps, missing, text };
}

/** Texto de la ecuación con los valores actuales (atajo de `equationSteps`). */
export const equationText = (eq: ModelEquation, vars: Record<string, ModelQuantity>) => equationSteps(eq, vars).text;

/* ------------------------------------------------------------------ parámetros editables */

/** Constante del modelo que el estudiante puede modificar en el modo avanzado, dentro de un rango seguro. */
export interface ModelParamSpec {
  key: string;
  /** Símbolo en la notación (p. ej. «g» o «μ_{k}»). */
  sym: string;
  label: string;
  unit?: string;
  /** Valor de referencia del modelo. */
  value: number;
  min: number;
  max: number;
  step: number;
  decimals: number;
  hint?: string;
}

export const clampParam = (spec: ModelParamSpec, v: number) => {
  if (!Number.isFinite(v)) return spec.value;
  const c = Math.max(spec.min, Math.min(spec.max, v));
  return Number((Math.round(c / spec.step) * spec.step).toFixed(Math.max(spec.decimals, 6)));
};

/** Valores efectivos: los de referencia, salvo los modificados (acotados a su rango). Sin modo avanzado, siempre los de referencia. */
export function effectiveParams(specs: ModelParamSpec[], overrides: Record<string, number>, enabled = true): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of specs) {
    const o = overrides[s.key];
    out[s.key] = enabled && o !== undefined ? clampParam(s, o) : s.value;
  }
  return out;
}

export const isModified = (spec: ModelParamSpec, value: number) => Math.abs(value - spec.value) > spec.step / 1000;

/** Resumen para la observación del ensayo: «Parámetro del modelo modificado: g = 1,62 m/s² (referencia 9,80)». */
export function modifiedSummary(specs: ModelParamSpec[], values: Record<string, number>): string {
  const mod = specs.filter((s) => values[s.key] !== undefined && isModified(s, values[s.key]));
  if (mod.length === 0) return '';
  const parts = mod.map((s) => `${mathToText(parseMath(s.sym))} = ${fmt(values[s.key], s.decimals)}${s.unit ? ` ${s.unit}` : ''} (referencia ${fmt(s.value, s.decimals)})`);
  return `${mod.length === 1 ? 'Parámetro del modelo modificado' : 'Parámetros del modelo modificados'}: ${parts.join('; ')}`;
}

/* ------------------------------------------------------------------ preferencia del estudiante */

export const ADVANCED_KEY = 'lvcn:modo-avanzado';

/** Lee la preferencia (apagado por defecto). Nunca lanza: el almacenamiento puede estar bloqueado. */
export function loadAdvancedPref(studentKey = ''): boolean {
  try {
    return window.localStorage.getItem(ADVANCED_KEY + (studentKey ? `:${studentKey}` : '')) === '1';
  } catch {
    return false;
  }
}

export function saveAdvancedPref(on: boolean, studentKey = ''): void {
  try {
    const k = ADVANCED_KEY + (studentKey ? `:${studentKey}` : '');
    if (on) window.localStorage.setItem(k, '1'); else window.localStorage.removeItem(k);
  } catch { /* sin almacenamiento: la preferencia dura mientras la página esté abierta */ }
}
