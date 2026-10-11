/** Formato numérico colombiano: coma decimal (es-CO). */
const cache = new Map<string, Intl.NumberFormat>();

export function fmt(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (!Number.isFinite(value)) return value > 0 ? '∞' : '−∞';
  const key = String(decimals);
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat('es-CO', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    cache.set(key, f);
  }
  return f.format(value);
}

/** Formato con cifras significativas, útil para concentraciones muy pequeñas. */
export function fmtSig(value: number | null | undefined, sig = 3): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  if (value === 0) return '0';
  const abs = Math.abs(value);
  if (abs >= 1e-3 && abs < 1e5) {
    const decimals = Math.max(0, sig - 1 - Math.floor(Math.log10(abs)));
    return fmt(value, Math.min(decimals, 8));
  }
  const exp = Math.floor(Math.log10(abs));
  const mant = value / 10 ** exp;
  return `${fmt(mant, sig - 1)} × 10${toSuperscript(exp)}`;
}

function toSuperscript(n: number): string {
  const map: Record<string, string> = { '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' };
  return String(n).split('').map((c) => map[c] ?? c).join('');
}

/** Interpreta números escritos con coma o punto decimal. */
export function parseLocaleNumber(text: string): number {
  const t = text.trim().replace(/\s/g, '');
  if (t === '') return NaN;
  // Si hay coma, la tratamos como separador decimal y quitamos puntos de miles.
  const normalized = t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t;
  return Number(normalized);
}

export function fmtDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('es-CO', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return new Date(ts).toISOString();
  }
}
