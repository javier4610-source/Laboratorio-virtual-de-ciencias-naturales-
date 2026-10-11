// Genera dist-single/laboratorio.html: una sola página con CSS y JS incrustados.
// Útil para publicar en servicios que aceptan un único archivo HTML o para
// abrir el laboratorio sin servidor (doble clic en el archivo).
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist-single';
let html = readFileSync(join(dir, 'index.html'), 'utf8');

html = html.replace(/<link rel="stylesheet" crossorigin href="\.\/(assets\/[^"]+\.css)">/g, (_, file) => {
  const css = readFileSync(join(dir, file), 'utf8');
  return `<style>\n${css}\n</style>`;
});
html = html.replace(/<script type="module" crossorigin src="\.\/(assets\/[^"]+\.js)"><\/script>/g, (_, file) => {
  const js = readFileSync(join(dir, file), 'utf8').replace(/<\/script/gi, '<\\/script');
  return `<script type="module">\n${js}\n</script>`;
});
// La aplicación se monta en #root: el script debe ejecutarse después de crear el nodo.
html = html.replace(/(<script type="module">[\s\S]*?<\/script>)([\s\S]*?)(<div id="root"><\/div>)/, '$2$3\n$1');
if (/src="\.\/assets|href="\.\/assets/.test(html)) {
  console.error('Quedaron referencias a archivos externos en el HTML.');
  process.exit(1);
}
writeFileSync(join(dir, 'laboratorio.html'), html);

// Variante sin <html>/<head>/<body> para plataformas que agregan su propio esqueleto.
const head = html.match(/<head>([\s\S]*)<\/head>/)[1].replace(/<meta charset="UTF-8" \/>/, '').replace(/<meta name="viewport"[^>]*>/, '');
const body = html.match(/<body>([\s\S]*)<\/body>/)[1];
writeFileSync(join(dir, 'fragmento.html'), `${head}\n${body}`);
console.log(`laboratorio.html: ${(html.length / 1024).toFixed(0)} KB`);
