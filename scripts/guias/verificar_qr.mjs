// Verifica el QR impreso en las guías en PDF: renderiza la primera página con pdftoppm (poppler-utils),
// decodifica el QR con jsQR y comprueba que coincide con el enlace permanente de la práctica
// (src/lib/permalink.ts). Uso: node scripts/guias/verificar_qr.mjs [id ...]   (tras `npm run guias`)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import jsQR from 'jsqr';

/** Lee un PGM binario (P5, 8 bits) y lo convierte a RGBA para jsQR. */
function leerPgm(buf) {
  const cab = buf.subarray(0, 64).toString('latin1').match(/^P5\s+(?:#.*\s+)*(\d+)\s+(\d+)\s+(\d+)\s/);
  if (!cab) throw new Error('PGM no reconocido');
  const [, w, h] = cab.map(Number);
  const px = buf.subarray(cab[0].length);
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) { rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = px[i]; rgba[i * 4 + 3] = 255; }
  return { w, h, rgba };
}

const PUBLIC_BASE = 'https://javier4610-source.github.io/Laboratorio-virtual-de-ciencias-naturales-/';
const solo = new Set(process.argv.slice(2));
const tmp = mkdtempSync(join(tmpdir(), 'qr-guias-'));
let ok = 0, fallos = 0;
try {
  for (const carpeta of ['estudiante', 'docente']) {
    for (const f of readdirSync(join('guias-pdf', carpeta)).filter((x) => x.endsWith('.pdf')).sort()) {
      const id = f.replace(/^(guia|clave)-\d\d-/, '').replace(/\.pdf$/, '');
      if (solo.size && !solo.has(id)) continue;
      const base = join(tmp, `${carpeta}-${id}`);
      execFileSync('pdftoppm', ['-f', '1', '-l', '1', '-r', '150', '-gray', '-singlefile', join('guias-pdf', carpeta, f), base]);
      const { w, h, rgba } = leerPgm(readFileSync(`${base}.pgm`));
      const code = jsQR(rgba, w, h);
      const esperado = `${PUBLIC_BASE}#/practica/${id}`;
      if (code?.data === esperado) { ok++; console.log(`✓ ${carpeta}/${f} → ${code.data}`); }
      else { fallos++; console.error(`✗ ${carpeta}/${f}: se leyó ${JSON.stringify(code?.data ?? null)}, se esperaba ${esperado}`); }
    }
  }
} finally {
  rmSync(tmp, { recursive: true, force: true });
}
console.log(`${ok} QR correctos, ${fallos} con error.`);
process.exit(fallos ? 1 : 0);
