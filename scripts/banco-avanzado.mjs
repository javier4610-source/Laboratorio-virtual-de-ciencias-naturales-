// Genera docs/banco-saber11/ (partes II a VI del banco avanzado tipo Saber 11) a partir de src/assessment/avanzado.
// Uso: npm run banco                         → valida el banco registrado en bloques.ts y escribe los documentos
//      npm run banco -- --forzar             → escribe aunque el validador encuentre errores
//      npm run banco -- --muestra --salida D → usa la muestra de pruebas (tests/fixtures) y escribe en la carpeta D
// 01-FUNDAMENTACION.md lo escribe el docente a mano: este script nunca lo crea ni lo modifica.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';

const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, def) => { const i = args.indexOf(name); return i >= 0 && args[i + 1] ? args[i + 1] : def; };
const sample = flag('--muestra');
const force = flag('--forzar');
const outDir = resolve(opt('--salida', sample ? join(tmpdir(), 'banco-avanzado-muestra') : 'docs/banco-saber11'));

const entry = `
export { ADVANCED_BANK } from './src/assessment/avanzado/index.ts';
export { validateBank, formatProblems } from './src/assessment/avanzado/validate.ts';
export { renderDocs } from './src/assessment/avanzado/markdown.ts';
${sample ? "export { MUESTRA_AVANZADO } from './tests/fixtures/avanzado-muestra.ts';" : 'export const MUESTRA_AVANZADO = null;'}
`;
const out = await build({ stdin: { contents: entry, resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error' });
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const items = sample ? mod.MUESTRA_AVANZADO : mod.ADVANCED_BANK;

if (!items.length) {
  console.log('El banco avanzado no tiene bloques registrados (src/assessment/avanzado/bloques.ts). No se escribió nada.');
  process.exit(0);
}

const report = mod.validateBank(items);
console.log(`Validación: ${items.length} ítems · ${report.errors} errores · ${report.warnings} avisos${report.complete ? ' · metas globales aplicadas' : ''}.`);
if (report.problems.length) console.log(mod.formatProblems(report.problems));
if (report.errors && !force && !sample) {
  console.error('Hay errores de validación: corrígelos o usa --forzar para escribir los documentos de todos modos.');
  process.exit(1);
}

mkdirSync(outDir, { recursive: true });
for (const [file, text] of Object.entries(mod.renderDocs(items))) {
  writeFileSync(join(outDir, file), text);
  console.log(`  ${join(outDir, file)} (${text.length.toLocaleString('es-CO')} caracteres)`);
}
