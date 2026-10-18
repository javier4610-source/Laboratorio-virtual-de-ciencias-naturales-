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
  // .woff es el respaldo de .woff2 para navegadores antiguos: no hace falta guardarlo.
  .filter((f) => f !== 'sw.js' && !f.endsWith('.woff') && !f.endsWith('.map'))
  // El visor 3D (3Dmol.js, ~545 KB) solo lo usa la práctica de geometría molecular: no se precarga al instalar;
  // se descarga al abrirla y queda en la caché de ejecución para usarlo sin conexión después.
  .filter((f) => !/3Dmol/i.test(f))
  .sort();

const hash = createHash('sha256');
for (const f of files) hash.update(f).update(readFileSync(join(dist, f)));
const version = hash.digest('hex').slice(0, 12);

const precache = files.map((f) => `./${f}`);
const template = readFileSync('scripts/sw-template.js', 'utf8');
writeFileSync(join(dist, 'sw.js'), template.replace('__VERSION__', version).replace('__PRECACHE__', JSON.stringify(precache, null, 2)));
const kb = files.reduce((s, f) => s + statSync(join(dist, f)).size, 0) / 1024;
console.log(`sw.js: ${files.length} archivos (${kb.toFixed(0)} KB) en la versión ${version}`);
