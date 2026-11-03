// Presupuesto de rendimiento (npm run perf): revisa la compilación de dist/ contra límites de tamaño escritos.
// Es determinista: solo mide bytes de la salida de `vite build` (gzip nivel 9), nunca tiempos, así que no falla por
// una máquina lenta o una red ruidosa. Los límites tienen holgura sobre lo medido el 2026-11-01; el método, las
// mediciones con Lighthouse y la razón de cada límite están en docs/v2/RENDIMIENTO.md.
//
// Uso: npm run build && npm run perf   (o `node scripts/presupuesto-rendimiento.mjs --json` para la tabla en JSON)
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

const DIST = process.env.PERF_DIST ?? 'dist'; // otra carpeta de compilación con PERF_DIST=...
const MANIFEST = join(DIST, '.vite', 'manifest.json');
const KB = 1024;

/**
 * Límites en KB comprimidos (gzip nivel 9) salvo que se indique otra cosa: ~15 % sobre lo medido el 2026-11-01 (entre
 * paréntesis). Si un cambio legítimo los supera, se sube el límite en el mismo cambio y se anota en RENDIMIENTO.md.
 */
const BUDGETS = {
  entradaJs: 140, // fragmento principal (React, catálogo liviano, inicio): 122,6
  entradaCss: 30, // hoja de estilos única, bloquea el pintado: 25,6
  rutas: {
    inicio: 140, // 122,6
    catalogo: 145, // 126,0
    'practica liviana (densidad)': 335, // 291,2 (página + ficha + laboratorio)
    'practica 3D (oxidos-hidroxidos)': 430, // 374,5 (el visor 3Dmol se carga aparte, solo si se abre)
    'practica con escena 3D (pendulo)': 350, // 303,7 (página + ficha + laboratorio + <Scene3D>; three.js va aparte)
    'banco Saber 11': 200, // 172,4 (antes 860,7: cargaba el currículo completo)
    'banco avanzado: página': 160, // 139,3 (antes 373,0 con los ítems, el banco Saber y los datos de prácticas)
    'banco avanzado: con los 180 ítems': 365, // 316,5
    'panel docente': 330, // 286,9 (2026-11-03): abre sin las fichas completas, que pide en segundo plano (antes 1106,3 con 79 fichas)
    'panel docente: con las fichas completas': 1250, // 1093,6 con 79 fichas (~6 KB más por práctica nueva); ver RENDIMIENTO.md
  },
  mayorFragmento: 185, // ningún archivo JS debería pasar de esto: 158,4 (modelo AlphaFold de la práctica de proteínas)
  motorThree: 155, // fragmento diferido con three.js r186 (kit de escenas 3D): 135,0
  precargaInstalacionMB: 6.4, // MB crudos que el service worker descarga al instalarse: 5,43 (antes 9,6)
};

/** Rutas: módulos fuente (claves del manifiesto) que la ruta pide al abrirse, además de la entrada. */
const ROUTES = {
  inicio: [],
  catalogo: ['src/pages/CatalogPages.tsx'],
  'practica liviana (densidad)': ['src/pages/PracticePage.tsx', 'src/curriculum/practices/densidad.ts', 'src/labs/DensityLab.tsx'],
  'practica 3D (oxidos-hidroxidos)': ['src/pages/PracticePage.tsx', 'src/curriculum/practices/oxidos-hidroxidos.ts', 'src/labs/OxidesHydroxidesLab.tsx'],
  'practica con escena 3D (pendulo)': ['src/pages/PracticePage.tsx', 'src/curriculum/practices/pendulo.ts', 'src/labs/PendulumLab.tsx'],
  'banco Saber 11': ['src/pages/BankPage.tsx'],
  'banco avanzado: página': ['src/pages/AdvancedBankPage.tsx'],
  'banco avanzado: con los 180 ítems': ['src/pages/AdvancedBankPage.tsx', ...['A', 'B', 'C', 'D', 'E', 'F'].map((b) => `src/assessment/avanzado/bloque${b}.ts`)],
  'panel docente': ['src/pages/TeacherPage.tsx'],
  'panel docente: con las fichas completas': ['src/pages/TeacherPage.tsx', 'src/curriculum/index.ts'],
};

/** Módulos que una ruta NO debe arrastrar (regresiones de división de código ya corregidas). */
const FORBIDDEN = {
  'banco Saber 11': ['src/curriculum/index.ts'],
  'banco avanzado: página': ['src/curriculum/index.ts', ...['A', 'B', 'C', 'D', 'E', 'F'].map((b) => `src/assessment/avanzado/bloque${b}.ts`)],
  catalogo: ['src/curriculum/index.ts'],
  inicio: ['src/curriculum/index.ts', 'src/pages/CatalogPages.tsx', 'src/three/renderer.ts'],
  // three.js (kit de escenas 3D, docs/v2/KIT-3D.md) solo se descarga con import() diferido al montar una escena con WebGL.
  'practica liviana (densidad)': ['src/three/renderer.ts'],
  'practica con escena 3D (pendulo)': ['src/three/renderer.ts'],
  'practica 3D (oxidos-hidroxidos)': ['src/three/renderer.ts'],
  'panel docente': ['src/three/renderer.ts', 'src/curriculum/index.ts'],
  'panel docente: con las fichas completas': ['src/three/renderer.ts'],
};
/** Nombres de fragmentos compartidos que una ruta no debe incluir (p. ej. el banco tipo Saber o los datos de prácticas). */
const FORBIDDEN_NAMES = {
  'banco avanzado: página': ['bank', 'report', 'datasets'],
  'banco avanzado: con los 180 ítems': ['bank', 'report', 'datasets'],
};

if (!existsSync(MANIFEST)) {
  console.error(`No existe ${MANIFEST}. Ejecuta primero «npm run build».`);
  process.exit(2);
}
const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
const gz = new Map();
const gzipKb = (file) => {
  if (!gz.has(file)) gz.set(file, gzipSync(readFileSync(join(DIST, file)), { level: 9 }).length / KB);
  return gz.get(file);
};
const entryKey = Object.keys(manifest).find((k) => manifest[k].isEntry);
if (!entryKey) { console.error('El manifiesto no tiene entrada.'); process.exit(2); }

/**
 * Clave del manifiesto para un módulo fuente. Un módulo que además se importa de forma estática desde otro fragmento
 * aparece como «_Nombre-hash.js» en lugar de su ruta fuente: se busca entonces por el nombre del fragmento.
 */
function resolve(src) {
  if (manifest[src]) return src;
  const name = src.replace(/^.*\//, '').replace(/\.[^.]+$/, '');
  const hits = Object.keys(manifest).filter((k) => k.startsWith('_') && manifest[k].name === name);
  if (hits.length === 1) return hits[0];
  throw new Error(`El manifiesto no tiene «${src}»: ¿cambió el nombre del archivo? Actualiza scripts/presupuesto-rendimiento.mjs.`);
}

/** Cierre de importaciones estáticas (lo que el navegador descarga antes de ejecutar el módulo). */
function closure(keys) {
  const seen = new Set();
  const visit = (k) => {
    if (seen.has(k)) return;
    seen.add(k);
    for (const i of manifest[k].imports ?? []) visit(i);
  };
  keys.map(resolve).forEach(visit);
  return seen;
}
const jsKb = (keys) => [...keys].reduce((s, k) => s + gzipKb(manifest[k].file), 0);

const rows = [];
const fails = [];
const check = (name, value, limit, unit = 'KB gzip', extra = '') => {
  const ok = value <= limit;
  rows.push({ name, value: +value.toFixed(1), limit, unit, ok, extra });
  if (!ok) fails.push(`${name}: ${value.toFixed(1)} ${unit} supera el límite de ${limit} ${unit}`);
};

check('JS de entrada', gzipKb(manifest[entryKey].file), BUDGETS.entradaJs);
const css = (manifest[entryKey].css ?? []).reduce((s, f) => s + gzipKb(f), 0);
check('CSS de entrada', css, BUDGETS.entradaCss);

for (const [route, keys] of Object.entries(ROUTES)) {
  const set = closure([entryKey, ...keys]);
  check(`ruta: ${route}`, jsKb(set), BUDGETS.rutas[route], 'KB gzip', `${set.size} archivos JS`);
  for (const bad of FORBIDDEN[route] ?? []) {
    if (set.has(resolve(bad))) fails.push(`ruta ${route}: no debería cargar ${bad}`);
  }
  for (const name of FORBIDDEN_NAMES[route] ?? []) {
    const hit = [...set].find((k) => manifest[k].name === name);
    if (hit) fails.push(`ruta ${route}: no debería cargar el fragmento «${name}» (${manifest[hit].file})`);
  }
}

const biggest = Object.values(manifest).filter((c) => c.file.endsWith('.js')).map((c) => [c.file, gzipKb(c.file)]).sort((a, b) => b[1] - a[1])[0];
check('mayor archivo JS', biggest[1], BUDGETS.mayorFragmento, 'KB gzip', biggest[0]);

const threeKey = resolve('src/three/renderer.ts');
check('motor 3D diferido (three.js)', gzipKb(manifest[threeKey].file), BUDGETS.motorThree, 'KB gzip', manifest[threeKey].file);

const sw = readFileSync(join(DIST, 'sw.js'), 'utf8');
const precache = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
const precacheMb = precache.reduce((s, f) => s + statSync(join(DIST, f.replace(/^\.\//, ''))).size, 0) / KB / KB;
check('precarga del service worker al instalar', precacheMb, BUDGETS.precargaInstalacionMB, 'MB crudos', `${precache.length} archivos`);

if (process.argv.includes('--json')) {
  console.log(JSON.stringify(rows, null, 2));
} else {
  const w = Math.max(...rows.map((r) => r.name.length));
  console.log('Presupuesto de rendimiento (dist/, gzip nivel 9):\n');
  for (const r of rows) console.log(`${r.ok ? 'ok ' : 'MAL'} ${r.name.padEnd(w)}  ${String(r.value).padStart(7)} / ${String(r.limit).padStart(5)} ${r.unit}${r.extra ? `  (${r.extra})` : ''}`);
}
if (fails.length) {
  console.error(`\nSe excedió el presupuesto de rendimiento:\n- ${fails.join('\n- ')}\nVer docs/v2/RENDIMIENTO.md antes de subir un límite.`);
  process.exit(1);
}
console.log('\nDentro del presupuesto.');
