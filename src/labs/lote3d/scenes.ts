/**
 * Escenas 3D del lote 1 a partir del estado de cada laboratorio (funciones puras; se prueban en
 * tests/unit/lote3d.test.ts). Solo deciden QUÉ copias de cada especie se dibujan y dónde; las geometrías son las del
 * kit (src/chem) y las cantidades, las de los modelos de cada práctica.
 */
import { blockSize, boxEdges, buildScene, defaultCols, rowCenters, sceneCounts, type Block, type BuiltScene, type SceneLine } from '../../chem/sceneLayout';
import type { Species3D, V3 } from '../../chem/species';
import { prettyFormula } from '../../models/balancing';
import { atomsMass, boxPositions, hydrationShell, unitsAt, unitsWithYield, type Packets } from './mappings';

const coefText = (n: number, formula: string) => `${n === 1 ? '' : `${n} `}${prettyFormula(formula)}`;

/* ------------------------------------------------------------------ balanceo */

export interface BalanceScene extends BuiltScene { reactantBlocks: number[]; productBlocks: number[]; arrow: V3 }

/**
 * Balanceo: cada sustancia es un bloque con tantas copias 3D como su coeficiente (reactivos a la izquierda, productos
 * a la derecha). El conteo de átomos de la escena es, por construcción, el de countSides(reacción, coeficientes).
 */
export function balanceScene(species: Species3D[], formulas: string[], nR: number, coefs: number[], mark: string | null): BalanceScene {
  if (species.length !== coefs.length || formulas.length !== coefs.length) throw new RangeError('Faltan especies o coeficientes.');
  const sizes = species.map((s, i) => blockSize(s, coefs[i]));
  const GAP = 1.6, ARROW = 5;
  const rc = rowCenters(sizes.slice(0, nR), 0, GAP);
  const rEnd = rc.length ? rc[rc.length - 1] + sizes[nR - 1].w / 2 : 0;
  const pc = rowCenters(sizes.slice(nR), rEnd + ARROW, GAP);
  const centers = [...rc, ...pc];
  const blocks: Block[] = species.map((s, i) => ({ species: s, count: coefs[i], center: [centers[i], 0, 0], markElement: mark, label: coefText(coefs[i], formulas[i]) }));
  const scene = buildScene(blocks);
  return { ...scene, reactantBlocks: species.slice(0, nR).map((_, i) => i), productBlocks: species.slice(nR).map((_, i) => nR + i), arrow: [rEnd + ARROW / 2, 0, 0] };
}

/** Átomos por elemento de cada lado de la escena de balanceo. */
export function balanceSceneCounts(s: BalanceScene): { left: Record<string, number>; right: Record<string, number> } {
  return { left: sceneCounts(s, s.reactantBlocks), right: sceneCounts(s, s.productBlocks) };
}

/* ------------------------------------------------------------------ estequiometría (antes / después) */

export interface StoichTerm { species: Species3D; formula: string; coef: number }
export interface StoichScene extends BuiltScene { before: number[]; after: number[]; formedUnits: number; lostUnits: number }

/**
 * Antes (izquierda): las partículas de A y B de los paquetes. Después (derecha): productos de las unidades que llegaron
 * a producto (rendimiento), reactivo en exceso que sobra y, ATENUADO, el reactivo que no llegó a producto por el
 * rendimiento. Los átomos de antes y de después son los mismos (se conservan).
 */
export function stoichScene(A: StoichTerm, B: StoichTerm, products: StoichTerm[], p: Packets, yieldPercent: number): StoichScene {
  const formed = unitsWithYield(p.units, yieldPercent);
  const lost = p.units - formed;
  const afterA = p.leftA + lost * A.coef, afterB = p.leftB + lost * B.coef;
  const beforeSpecs = [{ t: A, n: p.a, dim: 0 }, { t: B, n: p.b, dim: 0 }];
  const afterSpecs = [...products.map((t) => ({ t, n: formed * t.coef, dim: 0 })), { t: A, n: afterA, dim: lost * A.coef }, { t: B, n: afterB, dim: lost * B.coef }];
  const GAP = 3, ARROW = 6;
  const bs = beforeSpecs.map((x) => blockSize(x.t.species, Math.max(1, x.n)));
  const bc = rowCenters(bs, 0, GAP);
  const bEnd = bc[bc.length - 1] + bs[bs.length - 1].w / 2;
  const as = afterSpecs.map((x) => blockSize(x.t.species, Math.max(1, x.n)));
  const ac = rowCenters(as, bEnd + ARROW, GAP);
  const lbl = (x: { t: StoichTerm; n: number; dim: number }) => (x.n === 0 ? '' : `${x.n} ${prettyFormula(x.t.formula)}`);
  const blocks: Block[] = [
    ...beforeSpecs.map((x, i): Block => ({ species: x.t.species, count: x.n, center: [bc[i], 0, 0], label: lbl(x) })),
    ...afterSpecs.map((x, i): Block => ({ species: x.t.species, count: x.n, center: [ac[i], 0, 0], dimCopies: x.dim, label: lbl(x) })),
  ];
  const scene = buildScene(blocks);
  return { ...scene, before: [0, 1], after: afterSpecs.map((_, i) => 2 + i), formedUnits: formed, lostUnits: lost };
}

/* ------------------------------------------------------------------ conservación de la masa (recipiente) */

export type Exchange = 'sale' | 'entra' | 'ninguno';
export interface ConsTerm { species: Species3D; formula: string; coef: number; gas?: boolean }
export interface ConservationScene extends BuiltScene {
  lines: SceneLine[];
  /** Masa (u) de las partículas DENTRO del sistema: al inicio y en este instante. */
  massInitial: number; massNow: number;
  /** Partículas de gas fuera del sistema (escaparon o aún no entraron). */
  gasOutside: number;
  doneUnits: number;
  /** Puntos que el encuadre debe abarcar en TODO el avance (recipiente y zona del gas de afuera). */
  frame: V3[];
}

/**
 * Recipiente 3D con las partículas de los paquetes. Con el avance del laboratorio, `unitsAt` unidades ya reaccionaron.
 * Gas que se produce: dentro del recipiente (cerrado) o fuera y atenuado (abierto: escapó). Gas que reacciona
 * (oxígeno en la combustión del hierro): en el abierto empieza afuera (aire) y entra al reaccionar; en el sellado
 * está adentro desde el principio. La masa dentro se calcula sumando las masas atómicas de los átomos de adentro.
 */
export function conservationScene(A: ConsTerm, B: ConsTerm, products: ConsTerm[], p: Packets, extent: number, closed: boolean): ConservationScene {
  const done = unitsAt(p.units, extent);
  const outsideReactant = (t: ConsTerm) => !!t.gas && !closed;
  // Disposición fija (con el máximo de copias de cada bloque) para que nada salte mientras avanza la reacción.
  const solids: { t: ConsTerm; max: number; n: number }[] = [
    { t: A, max: p.a, n: p.a - done * A.coef },
    { t: B, max: p.b, n: p.b - done * B.coef },
    ...products.filter((t) => !t.gas).map((t) => ({ t, max: p.units * t.coef, n: done * t.coef })),
  ].filter((x) => x.max > 0 && !outsideReactant(x.t));
  const gasProd = products.find((t) => t.gas);
  const gasReact = [A, B].find((t) => outsideReactant(t));
  const cols = (x: { t: ConsTerm; max: number }) => defaultCols(x.max);
  const sizes = solids.map((x) => blockSize(x.t.species, Math.max(1, x.max), cols(x)));
  const GAP = 1.4;
  const centers = rowCenters(sizes, 0, GAP);
  const width = centers.length ? centers[centers.length - 1] + sizes[sizes.length - 1].w / 2 : 6;
  const floorH = Math.max(4, ...sizes.map((s) => s.h));
  const gasMax = gasProd ? p.units * gasProd.coef : gasReact ? (gasReact === A ? p.a : p.b) : 0;
  const gasT = gasProd ?? gasReact;
  const gasSize = gasT && gasMax ? blockSize(gasT.species, gasMax, Math.max(3, Math.ceil(gasMax / 2))) : { w: 0, h: 0 };
  const headH = gasProd && closed ? gasSize.h + 1.5 : 3;
  const W = Math.max(width, gasSize.w) + 3, H = floorH + headH + 1.5, D = 8;
  const x0 = -1.5, y0 = -floorH / 2 - 0.8;
  const blocks: Block[] = solids.map((x, i) => ({ species: x.t.species, count: Math.max(0, x.n), center: [centers[i], 0, 0], cols: cols(x), label: x.n > 0 ? `${x.n} ${prettyFormula(x.t.formula)}` : '' }));
  let gasOutside = 0;
  if (gasT && gasMax) {
    const gx = x0 + W / 2;
    if (gasProd) {
      const n = done * gasProd.coef;
      const inside = closed;
      const cy = inside ? y0 + floorH + 1.2 + gasSize.h / 2 : y0 + H + 2 + gasSize.h / 2;
      blocks.push({ species: gasProd.species, count: n, center: [gx, cy, 0], cols: Math.max(3, Math.ceil(gasMax / 2)), dim: !inside, label: n ? `${n} ${prettyFormula(gasProd.formula)}${inside ? '' : ' (salió)'}` : '' });
      if (!inside) gasOutside = n;
    } else if (gasReact) {
      const left = (gasReact === A ? p.a : p.b) - done * gasReact.coef;
      blocks.push({ species: gasReact.species, count: left, center: [gx, y0 + H + 2 + gasSize.h / 2, 0], cols: Math.max(3, Math.ceil(gasMax / 2)), dim: true, label: left ? `${left} ${prettyFormula(gasReact.formula)} del aire (afuera)` : '' });
      gasOutside = left;
    }
  }
  const scene = buildScene(blocks);
  const lines = boxEdges([x0, y0, -D / 2], [x0 + W, y0 + H, D / 2], !closed);
  const inside = scene.atoms.filter((a) => !a.dim);
  // Masa inicial dentro: todos los reactivos que están adentro antes de reaccionar.
  const initialInside = [...(outsideReactant(A) ? [] : [{ t: A, n: p.a }]), ...(outsideReactant(B) ? [] : [{ t: B, n: p.b }])];
  const massInitial = initialInside.reduce((s, x) => s + x.n * atomsMass(x.t.species.atoms), 0);
  const frame: V3[] = [[x0, y0, -D / 2], [x0 + W, y0 + H, D / 2]];
  if (gasT && gasMax && !(gasProd && closed)) frame.push([x0 + W / 2 - gasSize.w / 2, y0 + H + 2 + gasSize.h + 1.5, 0], [x0 + W / 2 + gasSize.w / 2, y0 + H + 2, 0]);
  return { ...scene, lines, massInitial, massNow: atomsMass(inside), gasOutside, doneUnits: done, frame };
}

/* ------------------------------------------------------------------ soluciones */

export interface SolutionBoxScene extends BuiltScene { lines: SceneLine[]; drawnUnits: number }

/** Cubo de disolución de `sideA` Å con `units` unidades del soluto disueltas (cada una aporta sus partículas). */
export function solutionBoxScene(parts: { species: Species3D; per: number }[], units: number, sideA: number): SolutionBoxScene {
  const per = parts.reduce((s, x) => s + x.per, 0);
  const pos = boxPositions(units * per, sideA, 2.5);
  const blocks: Block[] = [];
  let k = 0;
  for (let u = 0; u < units; u++) for (const part of parts) for (let j = 0; j < part.per; j++) blocks.push({ species: part.species, count: 1, center: pos[k++] });
  const scene = buildScene(blocks);
  const h = sideA / 2;
  return { ...scene, lines: boxEdges([-h, -h, -h], [h, h, h]), drawnUnits: units };
}

/** Capa de hidratación: cada ion con 6 aguas (si el kit tiene su radio iónico); los demás, sin capa. */
export function hydrationScene(parts: { species: Species3D; per: number }[], water: Species3D, shellFor: (s: Species3D) => boolean): BuiltScene & { shells: number } {
  const atoms: BuiltScene['atoms'] = [];
  const bonds: BuiltScene['bonds'] = [];
  const labels: BuiltScene['labels'] = [];
  const boxes: BuiltScene['boxes'] = [];
  const SEP = 10.5;
  let shells = 0;
  parts.forEach((part, i) => {
    const cx = (i - (parts.length - 1) / 2) * SEP;
    const one = buildScene([{ species: part.species, count: 1, center: [cx, 0, 0] }]);
    const start = atoms.length;
    one.atoms.forEach((a) => atoms.push({ ...a, block: i, mark: part.species.atoms.length === 1 }));
    one.bonds.forEach((b) => bonds.push({ ...b, a: b.a + start, b: b.b + start }));
    if (part.species.atoms.length === 1 && shellFor(part.species)) {
      const ion = part.species.atoms[0];
      const sh = hydrationShell(water, ion.el, ion.charge ?? 0, 6, [cx, 0, 0]);
      const s2 = atoms.length;
      sh.atoms.forEach((a) => atoms.push({ ...a, block: i, copy: 1 }));
      sh.bonds.forEach((b) => bonds.push({ ...b, a: b.a + s2, b: b.b + s2 }));
      shells++;
    }
    labels.push({ text: part.species.label, at: [cx, 4.6, 0] });
    boxes.push(one.boxes[0]);
  });
  return { atoms, bonds, labels, boxes, shells };
}
