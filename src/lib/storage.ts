/**
 * Acceso seguro a localStorage. El almacenamiento puede no estar disponible
 * (modo privado, políticas del colegio, vistas incrustadas); en ese caso la
 * aplicación sigue funcionando y los datos viven solo mientras la pestaña esté abierta.
 */
const memory = new Map<string, string>();
let available: boolean | null = null;

export function storageAvailable(): boolean {
  if (available !== null) return available;
  try {
    const k = '__lab_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    available = true;
  } catch {
    available = false;
  }
  return available;
}

export function loadJSON<T>(key: string, fallback: T): T {
  try {
    const raw = storageAvailable() ? window.localStorage.getItem(key) : memory.get(key) ?? null;
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  const raw = JSON.stringify(value);
  try {
    if (storageAvailable()) window.localStorage.setItem(key, raw);
    else memory.set(key, raw);
  } catch {
    memory.set(key, raw);
  }
}

export function removeKey(key: string): void {
  try {
    if (storageAvailable()) window.localStorage.removeItem(key);
  } catch { /* sin acción */ }
  memory.delete(key);
}

export function keysWithPrefix(prefix: string): string[] {
  const keys: string[] = [];
  try {
    if (storageAvailable()) {
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith(prefix)) keys.push(k);
      }
    }
  } catch { /* sin acción */ }
  for (const k of memory.keys()) if (k.startsWith(prefix) && !keys.includes(k)) keys.push(k);
  return keys;
}
