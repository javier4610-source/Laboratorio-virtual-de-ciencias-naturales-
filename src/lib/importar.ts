import { createElement, lazy, type ComponentProps, type ComponentType } from 'react';

/**
 * Reintento de un `import()` que falló (sin conexión, red inestable) sin recargar la página.
 *
 * Chromium guarda en su mapa de módulos el resultado de un `import()` fallido: volver a importar la MISMA dirección
 * devuelve el mismo error sin pedir nada a la red, hasta que se recarga la página. Por eso el reintento importa la
 * dirección del fragmento con un parámetro distinto (`?reintento=1`, `?reintento=2`…): para el navegador es otro
 * módulo y lo vuelve a pedir. El servidor estático (GitHub Pages, `vite preview`) ignora el parámetro y el service
 * worker busca en su caché sin él (`ignoreSearch`), así que sin conexión también sirve lo ya guardado.
 *
 * La dirección se lee del mensaje del error, que Chromium («Failed to fetch dynamically imported module: URL») y
 * Firefox («error loading dynamically imported module: URL») incluyen; Vite pasa el error original tal cual. Si el
 * mensaje no trae la dirección (Safari), se repite el `import()` original y, si vuelve a fallar, la interfaz ofrece
 * «Recargar la página». Ver docs/v2/RENDIMIENTO.md.
 */

const PARAM = 'reintento';

/** Dirección del módulo que no se pudo descargar, si el navegador la incluye en el mensaje del error. */
export function failedModuleUrl(error: unknown): string | null {
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : '';
  if (!/dynamically imported module|importing a module script failed|module script/i.test(message)) return null;
  const m = message.match(/(https?:\/\/[^\s'"]+|\/[^\s'"]+\.m?js(?:\?[^\s'"]*)?)/);
  return m ? m[1] : null;
}

/** ¿Es un error de descarga de un fragmento (y no un error del código del módulo)? */
export function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : '';
  return /dynamically imported module|importing a module script failed|unable to preload/i.test(message);
}

/** La misma dirección con `?reintento=n` (reemplaza un valor anterior y conserva los demás parámetros). */
export function withRetryParam(url: string, n: number): string {
  const base = typeof location === 'undefined' ? 'http://localhost/' : location.href;
  const u = new URL(url, base);
  u.searchParams.set(PARAM, String(n));
  return /^https?:/.test(url) ? u.href : `${u.pathname}${u.search}${u.hash}`;
}

/** La dirección sin el parámetro de reintento. */
function withoutRetryParam(url: string): string {
  const base = typeof location === 'undefined' ? 'http://localhost/' : location.href;
  const u = new URL(url, base);
  u.searchParams.delete(PARAM);
  return /^https?:/.test(url) ? u.href : `${u.pathname}${u.search}${u.hash}`;
}

/** Importación real con una dirección calculada en tiempo de ejecución (sustituible en las pruebas unitarias). */
let importUrl = (url: string): Promise<unknown> => import(/* @vite-ignore */ url);
export function setImportUrlForTests(fn: (url: string) => Promise<unknown>) { importUrl = fn; }

/**
 * Envuelve un `() => import('./x')`: la primera vez lo llama tal cual (Vite precarga sus dependencias); si falló y se
 * conoce la dirección del fragmento, cada llamada siguiente la importa con `?reintento=n` hasta que llegue.
 */
export function retryableImport<M>(load: () => Promise<M>): () => Promise<M> {
  let failedUrl: string | null = null;
  let retries = 0;
  let loaded: Promise<M> | null = null;
  return () => {
    // Lo que ya llegó se reutiliza: otro `?reintento=n` crearía una segunda copia del módulo.
    if (loaded) return loaded;
    const p = failedUrl ? (importUrl(withRetryParam(failedUrl, ++retries)) as Promise<M>) : load();
    return p.then((m) => { loaded = p; return m; }, (e: unknown) => {
      const url = failedModuleUrl(e);
      if (url) failedUrl = withoutRetryParam(url);
      throw e;
    });
  };
}

/** `retryableImport` seguido de un `.then(pick)`: para los cargadores `() => import('./x').then((m) => m.X)`. */
export function retryableThen<M, T>(load: () => Promise<M>, pick: (m: M) => T): () => Promise<T> {
  const retry = retryableImport(load);
  return () => retry().then(pick);
}

/** Componentes diferidos cuya descarga falló: se renuevan solo cuando la persona pide reintentar. */
const failedLazies = new Set<() => void>();

/**
 * Renueva los componentes de `lazyWithRetry` que fallaron, para que el próximo render los vuelva a descargar. Lo llama
 * el botón «Reintentar» del ErrorBoundary. (Renovarlos en el mismo momento del fallo no sirve: React vuelve a
 * renderizar enseguida y, sin conexión, reintentaría sin parar en vez de mostrar el aviso.)
 */
export function resetFailedLazies(): void {
  for (const reset of failedLazies) reset();
  failedLazies.clear();
}

/**
 * Como `React.lazy`, pero reintentable: `lazy` guarda para siempre el error de su primera carga, así que tras un fallo
 * `resetFailedLazies()` crea uno nuevo, que vuelve a descargar con `retryableImport`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithRetry<T extends ComponentType<any>>(load: () => Promise<{ default: T }>) {
  const retry = retryableImport(load);
  const make = () => lazy(() => retry().catch((e: unknown) => { failedLazies.add(() => { current = make(); }); throw e; }));
  let current = make();
  function LazyWithRetry(props: ComponentProps<T>) {
    return createElement(current, props);
  }
  return LazyWithRetry;
}
