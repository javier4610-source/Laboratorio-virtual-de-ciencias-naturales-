/**
 * Enlaces permanentes de las prácticas (programa v2, sección 8.4): cada práctica tiene una URL estable que se
 * imprime en las guías en PDF y se comparte como código QR.
 *
 * CONTRATO ESTABLE: el `id` de cada práctica (src/curriculum/catalog.ts) forma parte de la URL pública. Un id
 * NUNCA se renombra ni se reutiliza para otra práctica, aunque cambie el título, el grado o la versión de la
 * aplicación; de lo contrario los QR ya impresos dejarían de funcionar. Si alguna vez hiciera falta, se añade
 * una práctica nueva y la antigua se conserva (o se redirige). La ruta `#/practica/<id>` (src/lib/router.ts)
 * tampoco cambia. scripts/guias/generar_guias.py usa la misma base y la misma ruta para los QR impresos.
 */
export const PUBLIC_BASE = 'https://javier4610-source.github.io/Laboratorio-virtual-de-ciencias-naturales-/';

/** Formato permitido para los ids: minúsculas, dígitos y guiones (seguro en URL sin codificar). */
export const PRACTICE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** URL permanente y estable de una práctica, p. ej. `…/#/practica/densidad`. */
export function practicePermalink(id: string): string {
  return `${PUBLIC_BASE}#/practica/${encodeURIComponent(id)}`;
}
