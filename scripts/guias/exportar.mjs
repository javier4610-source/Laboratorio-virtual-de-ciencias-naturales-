// Compila scripts/guias/contenido.ts con esbuild y escribe guias-pdf/contenido.json.
import { build } from 'esbuild';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = await build({
  stdin: { contents: "export { contenido } from './scripts/guias/contenido.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error',
});
const mod = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
mkdirSync('guias-pdf', { recursive: true });
const data = mod.contenido();
writeFileSync('guias-pdf/contenido.json', JSON.stringify(data, null, 1));
console.log(`contenido.json: ${data.length} prácticas`);
