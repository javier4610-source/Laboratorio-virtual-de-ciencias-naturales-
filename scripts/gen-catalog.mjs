// Regenera src/curriculum/catalog.ts (catálogo liviano) a partir de las definiciones completas.
// Uso: node scripts/gen-catalog.mjs   (la prueba de currículo verifica que coincidan)
import { build } from 'esbuild';
import { readFileSync, writeFileSync } from 'node:fs';

const out = await build({
  stdin: { contents: "export { PRACTICES } from './src/curriculum/index.ts';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, platform: 'node', format: 'esm', write: false, logLevel: 'error',
});
const { PRACTICES } = await import(`data:text/javascript;base64,${Buffer.from(out.outputFiles[0].text).toString('base64')}`);
const q = (s) => `'${String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const arr = (a) => `[${a.map(q).join(', ')}]`;
const entries = PRACTICES.map((p) => `  { id: ${q(p.id)}, title: ${q(p.title)}, grade: ${p.grade}, area: ${q(p.area)}, topic: ${q(p.topic)}, durationMin: ${p.durationMin},
    summary: ${q(p.summary)},
    competencies: ${arr(p.competencies)}, keywords: ${arr(p.keywords)} },`).join('\n');
const file = 'src/curriculum/catalog.ts';
const src = readFileSync(file, 'utf8');
const start = src.indexOf('export const CATALOG: PracticeMeta[] = [');
const end = src.indexOf('];', start);
writeFileSync(file, `${src.slice(0, start)}export const CATALOG: PracticeMeta[] = [\n${entries}\n${src.slice(end)}`);
console.log(`catalog.ts: ${PRACTICES.length} prácticas`);
