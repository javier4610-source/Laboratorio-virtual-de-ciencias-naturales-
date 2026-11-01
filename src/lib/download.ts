/**
 * Utilidades de descarga y portapapeles sin dependencias. Viven aparte de ./report.ts para que las páginas que solo
 * descargan o copian (banco avanzado, gráficas, QR, registro de datos) no arrastren el banco de preguntas ni los
 * conjuntos de datos de todas las prácticas (ver docs/v2/RENDIMIENTO.md). ./report.ts las reexporta.
 */
/** Descarga un archivo generado en el navegador. Devuelve false si el entorno lo bloquea. */
export function downloadText(filename: string, text: string, mime = 'text/plain'): boolean {
  try {
    return downloadBlob(filename, new Blob(['﻿' + text], { type: `${mime};charset=utf-8` }));
  } catch {
    return false;
  }
}

/** Descarga un archivo binario (p. ej. una imagen PNG o SVG). Devuelve false si el entorno lo bloquea. */
export function downloadBlob(filename: string, blob: Blob): boolean {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch {
    return false;
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function slug(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'informe';
}
