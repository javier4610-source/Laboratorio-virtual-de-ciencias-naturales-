// Genera dist/sw.js con la lista de archivos de la compilación (precarga para uso sin conexión).
// La versión es un hash del contenido: cada compilación distinta produce un service worker nuevo.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const dist = 'dist';
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : [p];
});

const files = walk(dist)
  .map((p) => relative(dist, p).split('\\').join('/'))
  // .woff es el respaldo de .woff2 para navegadores antiguos: no hace falta guardarlo. .vite/ es el manifiesto de
  // fragmentos que usa `npm run perf` (no lo pide la aplicación).
  .filter((f) => f !== 'sw.js' && !f.endsWith('.woff') && !f.endsWith('.map') && !f.startsWith('.vite/'))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

// Segunda fase (ver scripts/sw-template.js y docs/v2/RENDIMIENTO.md): los archivos JS de más de DEFERRED_MIN_BYTES que
// no son la entrada de la aplicación. Son datos y bibliotecas de pocas prácticas (visores 3D, proteínas, taller de
// compuestos, química orgánica); el núcleo, con todas las demás prácticas, queda listo sin conexión mucho antes.
const DEFERRED_MIN_BYTES = 150 * 1024;
const entry = new Set([...readFileSync(join(dist, 'index.html'), 'utf8').matchAll(/(?:src|href)="\.\/([^"]+)"/g)].map((m) => m[1]));
const size = (f) => statSync(join(dist, f)).size;
const isDeferred = (f) => f.endsWith('.js') && !entry.has(f) && size(f) > DEFERRED_MIN_BYTES;

const precache = files.filter((f) => !isDeferred(f)).map((f) => `./${f}`);
const deferred = files.filter(isDeferred).map((f) => `./${f}`);
const template = readFileSync('scripts/sw-template.js', 'utf8');
writeFileSync(join(dist, 'sw.js'), template
  .replace('__VERSION__', version)
  .replace('__PRECACHE__', JSON.stringify(precache, null, 2))
  .replace('__DEFERRED__', JSON.stringify(deferred, null, 2)));
const kb = (list) => (list.reduce((s, f) => s + size(f.slice(2)), 0) / 1024).toFixed(0);
console.log(`sw.js: ${precache.length} archivos (${kb(precache)} KB) al instalar + ${deferred.length} grandes (${kb(deferred)} KB) en segundo plano, versión ${version}`);
