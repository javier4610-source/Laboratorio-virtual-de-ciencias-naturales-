/**
 * Estilos de dibujo de moléculas en 3Dmol.js, comunes a todos los visores del kit (Molecule3D, visores orgánicos y de
 * grupos funcionales, práctica de geometría molecular).
 *
 * «Esferas y palitos» NO usa el radio por defecto de 3Dmol (0,28 × radio de van der Waals de Bondi), que tapaba los
 * enlaces con hidrógeno: cada elemento recibe una esfera proporcional a su radio covalente (ballRadius en
 * src/chem/elements.ts), la misma escala que usan la reacción 3D y la vista de respaldo en SVG.
 */
import type { GLViewer } from '3dmol';
import { ballRadius, STICK_RADIUS } from './elements';

export type MolStyle = 'bs' | 'esf' | 'pal';

/** Enlaces dobles y triples algo más gruesos que los de 3Dmol por defecto (0,4 y 0,25 del palito) para que se lean. */
const MULTIPLE = { doubleBondScaling: 0.55, tripleBondScaling: 0.4 };

/** Especificación 3Dmol del palito en cada estilo con palitos. */
export const stickSpec = (style: 'bs' | 'pal') => ({ radius: STICK_RADIUS[style], ...MULTIPLE });

/**
 * Aplica el estilo a todo el modelo cargado en el visor. `elements` son los símbolos presentes (para fijar el radio de
 * la esfera de cada uno); `fillScale` es la escala de van der Waals del «espacio lleno».
 */
export function applyMolStyle(v: GLViewer, style: MolStyle, elements: Iterable<string>, fillScale = 1): void {
  if (style === 'esf') { v.setStyle({}, { sphere: { scale: fillScale } }); return; }
  if (style === 'pal') { v.setStyle({}, { stick: stickSpec('pal') }); return; }
  v.setStyle({}, { stick: stickSpec('bs') });
  for (const el of new Set(elements)) v.setStyle({ elem: el }, { stick: stickSpec('bs'), sphere: { radius: ballRadius(el) } });
}
