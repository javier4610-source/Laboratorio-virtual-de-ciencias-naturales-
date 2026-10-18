// Inventario automático de prácticas, modelos, laboratorios y pruebas (Fase 0 del prompt maestro v2).
// Uso: node scripts/inventario.mjs  →  escribe docs/v2/INVENTARIO.md
// Todo lo que aparece en el informe se deduce del código; nada se escribe a mano.
import { readFileSync, readdirSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const read = (p) => readFileSync(join(root, p), 'utf8');

const catalog = read('src/curriculum/catalog.ts');
const practices = [...catalog.matchAll(/\{ id: '([^']+)', title: '([^']+)', grade: (\d+), area: '([^']+)'/g)]
  .map(([, id, title, grade, area]) => ({ id, title, grade: +grade, area }));

const registry = read('src/labs/registry.ts');
const labOf = Object.fromEntries([...registry.matchAll(/^\s+'?([\w-]+)'?: lazy\(\(\) => import\('\.\/(\w+)'\)\)/gm)].map(([, id, f]) => [id, f]));

const unitDir = 'tests/unit';
const unitFiles = readdirSync(join(root, unitDir)).filter((f) => f.endsWith('.ts'));
const unitSrc = Object.fromEntries(unitFiles.map((f) => [f, read(join(unitDir, f))]));
const countTests = (src) => (src.match(/^\s*(it|test)\(/gm) ?? []).length;

const e2eDir = 'tests/e2e';
const e2eSrc = readdirSync(join(root, e2eDir)).filter((f) => f.endsWith('.spec.ts')).map((f) => read(join(e2eDir, f))).join('\n');
const a11ySrc = read('tests/e2e/a11y.spec.ts');
const instruments = read('src/labs/instruments.ts');
const modelParams = read('src/labs/modelParams.ts');
const datasets = read('src/labs/datasets.ts');

const rows = [];
for (const p of practices) {
  const lab = labOf[p.id];
  const labSrc = lab && existsSync(join(root, `src/labs/${lab}.tsx`)) ? read(`src/labs/${lab}.tsx`) : '';
  const models = [...new Set([...labSrc.matchAll(/from '\.\.\/models\/(\w+)'/g)].map((m) => m[1]))].filter((m) => m !== 'math' && m !== 'types');
  const tests = unitFiles.filter((f) => models.some((m) => new RegExp(`models/${m}'`).test(unitSrc[f])));
  const nTests = tests.reduce((s, f) => s + countTests(unitSrc[f]), 0);
  const key = p.id.includes('-') ? `'${p.id}'` : p.id;
  const e2e = new RegExp(`openFree\\(page, '${p.id}'\\)|#/practica/${p.id}\\b`).test(e2eSrc);
  const a11y = a11ySrc.includes(`'${p.id}'`);
  const illustrative = /Ilustraci[oó]n|ilustrativ|esquem[aá]tic/i.test(labSrc);
  rows.push({
    ...p, lab: lab ?? '—', models, tests, nTests, e2e, a11y,
    loc: labSrc ? labSrc.split('\n').length : 0,
    measure: /useMeasure\(/.test(labSrc),
    advanced: /usePublishModel\(/.test(labSrc),
    params: new RegExp(`^\\s+${key}: \\[`, 'm').test(modelParams),
    instr: new RegExp(`^\\s+${key}: \\[`, 'm').test(instruments),
    manip: /from '\.\/manipulate'/.test(labSrc) || /onPointerDown/.test(labSrc),
    sound: /playSound\(|startLoop\(|from '\.\.\/lib\/sound'/.test(labSrc),
    datasets: new RegExp(`^\\s+${key}: \\[`, 'm').test(datasets),
    illustrative,
  });
}

const yes = (b) => (b ? 'sí' : 'no');
const total = (k) => rows.filter((r) => r[k]).length;
const out = [];
out.push('# Inventario automático del laboratorio');
out.push('');
out.push(`Generado por \`node scripts/inventario.mjs\` el ${new Date().toISOString().slice(0, 10)}. No editar a mano: se regenera desde el código.`);
out.push('');
out.push(`- Prácticas en el catálogo: **${rows.length}**`);
out.push(`- Con laboratorio registrado: ${total('lab') && rows.filter((r) => r.lab !== '—').length} · con prueba E2E propia: ${total('e2e')} · con revisión axe: ${total('a11y')}`);
out.push(`- Con modo de instrumento real: ${total('measure')} · con modo avanzado: ${total('advanced')} · con parámetros editables: ${total('params')}`);
out.push(`- Con manipulación directa: ${total('manip')} · con sonido: ${total('sound')} · con texto que rotula partes ilustrativas: ${total('illustrative')}`);
out.push(`- Archivos de pruebas unitarias: ${unitFiles.length} (${Object.values(unitSrc).reduce((s, x) => s + countTests(x), 0)} pruebas declaradas)`);
out.push('');
out.push('| Práctica | Grado | Área | Laboratorio (líneas) | Modelos | Pruebas unitarias | E2E | axe | Instr. real | Avanzado | Manipulación | Sonido | Rótulo ilustrativo |');
out.push('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for (const r of rows.sort((a, b) => a.grade - b.grade || a.id.localeCompare(b.id))) {
  out.push(`| \`${r.id}\` ${r.title} | ${r.grade}.º | ${r.area} | ${r.lab} (${r.loc}) | ${r.models.join(', ') || '—'} | ${r.nTests} en ${r.tests.join(', ') || '—'} | ${yes(r.e2e)} | ${yes(r.a11y)} | ${yes(r.measure)} | ${yes(r.advanced)} | ${yes(r.manip)} | ${yes(r.sound)} | ${yes(r.illustrative)} |`);
}
out.push('');
mkdirSync(join(root, 'docs/v2'), { recursive: true });
writeFileSync(join(root, 'docs/v2/INVENTARIO.md'), out.join('\n'));
writeFileSync(join(root, 'docs/v2/inventario.json'), JSON.stringify(rows, null, 2) + '\n');
console.log(`docs/v2/INVENTARIO.md: ${rows.length} prácticas`);
