import type { ModelSpec } from './types';

/**
 * Clasificación de los seres vivos con claves dicotómicas (grado 6.º).
 *
 * Una CLAVE DICOTÓMICA es una serie de pares de afirmaciones opuestas (dilemas): cada par pregunta por UN carácter
 * observable y manda a otro par o a un nombre. Este archivo guarda:
 *  · 25 organismos reales con su nombre científico (varios de Urabá y de Colombia), su dominio (sistema de tres dominios
 *    de Woese, Kandler y Wheelis, 1990), su reino en el sistema de seis reinos (Eubacterias, Arqueobacterias, Protistas,
 *    Hongos, Plantas, Animales) y en el de cinco (Whittaker, 1969: Monera reúne a bacterias y arqueas), su grupo
 *    (clase o división) y sus caracteres como sí/no;
 *  · tres claves (reinos, animales y plantas) y el motor que las recorre;
 *  · el constructor de claves del estudiante: elige un carácter para cada grupo hasta separar a todos; una clave
 *    dicotómica que separa n organismos tiene siempre n − 1 dilemas y una profundidad de al menos ⌈log₂ n⌉.
 * Los nombres científicos y los lugares donde viven son de la literatura y de los catálogos de biodiversidad (p. ej.,
 * Catálogo de la Biodiversidad de Colombia del SiB Colombia y GBIF); las formas 3D son simplificadas. Este archivo no
 * depende de React ni del navegador.
 */

export type TraitId =
  | 'nucleo' | 'eter' | 'unicelular' | 'quitina' | 'fotosintesis'
  | 'vertebras' | 'pelo' | 'plumas' | 'aletas' | 'escamasSecas'
  | 'patasArticuladas' | 'seisPatas' | 'ochoPatas' | 'antenas' | 'segmentado'
  | 'vasos' | 'semillas' | 'flores' | 'nervParalelas';

export interface Trait { id: TraitId; yes: string; no: string; how: string }
/** Cada carácter con sus dos afirmaciones opuestas y cómo se observa. */
export const TRAITS: Trait[] = [
  { id: 'nucleo', yes: 'Sus células tienen núcleo (eucariota)', no: 'Sus células no tienen núcleo (procariota)', how: 'Microscopio con tinción: el núcleo se ve como un cuerpo oscuro dentro de la célula.' },
  { id: 'eter', yes: 'Su membrana tiene lípidos con enlaces éter y su ARN ribosómico es de arquea', no: 'Su membrana tiene lípidos con enlaces éster y su ARN ribosómico es de bacteria', how: 'No se ve al microscopio: se analiza en un laboratorio de microbiología (lípidos y secuencia del ARN ribosómico 16S).' },
  { id: 'unicelular', yes: 'Es un organismo de una sola célula', no: 'Está formado por muchas células', how: 'Microscopio: se ve una célula sola o un cuerpo con muchas células.' },
  { id: 'quitina', yes: 'Tiene pared celular de quitina y se alimenta absorbiendo sustancias', no: 'No tiene pared de quitina', how: 'Se ve que crece sobre su alimento y lo descompone (moho, levadura, seta).' },
  { id: 'fotosintesis', yes: 'Hace fotosíntesis: tiene clorofila (es verde)', no: 'No hace fotosíntesis', how: 'Color verde de la clorofila y cloroplastos al microscopio.' },
  { id: 'vertebras', yes: 'Tiene columna vertebral (vertebrado)', no: 'No tiene columna vertebral (invertebrado)', how: 'Esqueleto interno con vértebras que se palpan en la espalda.' },
  { id: 'pelo', yes: 'Tiene pelo y las crías maman leche', no: 'No tiene pelo', how: 'Pelo en la piel; glándulas mamarias.' },
  { id: 'plumas', yes: 'Tiene plumas', no: 'No tiene plumas', how: 'Plumas en el cuerpo y pico sin dientes.' },
  { id: 'aletas', yes: 'Tiene aletas y respira por branquias toda la vida', no: 'No tiene aletas', how: 'Aletas y opérculo que cubre las branquias.' },
  { id: 'escamasSecas', yes: 'Su piel es seca y está cubierta de escamas', no: 'Su piel es húmeda y sin escamas', how: 'Toca la piel (con guantes): seca y escamosa o húmeda y lisa.' },
  { id: 'patasArticuladas', yes: 'Tiene patas articuladas y un exoesqueleto duro', no: 'No tiene patas articuladas', how: 'Patas con articulaciones y caparazón o cubierta dura.' },
  { id: 'seisPatas', yes: 'Tiene 3 pares de patas (6) y el cuerpo en cabeza, tórax y abdomen', no: 'No tiene 6 patas', how: 'Cuenta las patas con la lupa.' },
  { id: 'ochoPatas', yes: 'Tiene 4 pares de patas (8) y no tiene antenas', no: 'Tiene más de 8 patas y dos pares de antenas', how: 'Cuenta las patas y busca antenas.' },
  { id: 'antenas', yes: 'Tiene antenas', no: 'No tiene antenas', how: 'Lupa sobre la cabeza.' },
  { id: 'segmentado', yes: 'Su cuerpo blando está dividido en anillos', no: 'Su cuerpo blando no tiene anillos (puede tener concha)', how: 'Mira el cuerpo con la lupa: anillos o una concha.' },
  { id: 'vasos', yes: 'Tiene vasos conductores (raíz, tallo y hojas verdaderos)', no: 'No tiene vasos conductores (es pequeña y vive en lugares húmedos)', how: 'Corte del tallo con la lupa: hacecillos de vasos.' },
  { id: 'semillas', yes: 'Se reproduce por semillas', no: 'Se reproduce por esporas (puntos debajo de las hojas)', how: 'Busca semillas o soros con esporas en el envés de las hojas.' },
  { id: 'flores', yes: 'Tiene flores y sus semillas están dentro de un fruto', no: 'No tiene flores: sus semillas están desnudas en conos', how: 'Busca flores, frutos o conos (piñas).' },
  { id: 'nervParalelas', yes: 'Sus hojas tienen nervaduras paralelas', no: 'Sus hojas tienen nervaduras ramificadas en red', how: 'Mira la hoja a contraluz.' },
];
export function findTrait(id: TraitId): Trait {
  const t = TRAITS.find((x) => x.id === id);
  if (!t) throw new RangeError(`Carácter desconocido: ${id}`);
  return t;
}

export type Domain = 'Bacteria' | 'Archaea' | 'Eukarya';
export type Kingdom = 'Eubacterias' | 'Arqueobacterias' | 'Protistas' | 'Hongos' | 'Plantas' | 'Animales';
export const KINGDOM_DOMAIN: Record<Kingdom, Domain> = { Eubacterias: 'Bacteria', Arqueobacterias: 'Archaea', Protistas: 'Eukarya', Hongos: 'Eukarya', Plantas: 'Eukarya', Animales: 'Eukarya' };
/** Reino en el sistema de cinco reinos de Whittaker (1969). */
export const fiveKingdoms = (k: Kingdom): string => (k === 'Eubacterias' || k === 'Arqueobacterias' ? 'Monera' : k);

export type BodyPlan =
  | 'bacilo' | 'arquea' | 'ciliado' | 'parasito' | 'levadura' | 'moho' | 'seta'
  | 'musgo' | 'helecho' | 'conifera' | 'monocot' | 'dicot' | 'mangle'
  | 'insecto' | 'aracnido' | 'crustaceo' | 'anelido' | 'molusco' | 'pez' | 'anfibio' | 'reptil' | 'ave' | 'mamifero';

export interface Organism {
  id: string; common: string; scientific: string; kingdom: Kingdom; group: string;
  where: string; body: BodyPlan; legs: number; color: `#${string}`; traits: TraitId[];
}
const EU: TraitId[] = ['nucleo'];
const ANIMAL: TraitId[] = [...EU];
const PLANT: TraitId[] = [...EU, 'fotosintesis', 'vasos'];
export const ORGANISMS: Organism[] = [
  { id: 'ecoli', common: 'Bacteria del intestino', scientific: 'Escherichia coli', kingdom: 'Eubacterias', group: 'Bacterias', where: 'Intestino de las personas y de otros mamíferos.', body: 'bacilo', legs: 0, color: '#7fa86b', traits: ['unicelular'] },
  { id: 'lactobacilo', common: 'Bacteria del yogur', scientific: 'Lactobacillus delbrueckii subsp. bulgaricus', kingdom: 'Eubacterias', group: 'Bacterias', where: 'Leche fermentada (yogur y kumis).', body: 'bacilo', legs: 0, color: '#a9b86b', traits: ['unicelular'] },
  { id: 'halobacteria', common: 'Arquea de las salinas', scientific: 'Halobacterium salinarum', kingdom: 'Arqueobacterias', group: 'Arqueas', where: 'Salmueras muy saladas de las salinas; le dan color rosado al agua.', body: 'arquea', legs: 0, color: '#d77a8f', traits: ['unicelular', 'eter'] },
  { id: 'metanogena', common: 'Arquea del rumen', scientific: 'Methanobrevibacter ruminantium', kingdom: 'Arqueobacterias', group: 'Arqueas', where: 'Rumen de las vacas, donde produce metano (gas de efecto invernadero).', body: 'arquea', legs: 0, color: '#c98f5a', traits: ['unicelular', 'eter'] },
  { id: 'paramecio', common: 'Paramecio', scientific: 'Paramecium caudatum', kingdom: 'Protistas', group: 'Ciliados', where: 'Charcos y aguas estancadas con materia orgánica.', body: 'ciliado', legs: 0, color: '#8fb8c9', traits: [...EU, 'unicelular'] },
  { id: 'plasmodio', common: 'Parásito de la malaria', scientific: 'Plasmodium vivax', kingdom: 'Protistas', group: 'Apicomplejos', where: 'Lo transmite el mosquito Anopheles; Urabá es una de las regiones de Colombia con casos de malaria.', body: 'parasito', legs: 0, color: '#b48ac9', traits: [...EU, 'unicelular'] },
  { id: 'levadura', common: 'Levadura del pan', scientific: 'Saccharomyces cerevisiae', kingdom: 'Hongos', group: 'Ascomicetos', where: 'Pan, chicha y otras bebidas fermentadas.', body: 'levadura', legs: 0, color: '#e2cf9c', traits: [...EU, 'unicelular', 'quitina'] },
  { id: 'sigatoka', common: 'Hongo de la sigatoka negra', scientific: 'Pseudocercospora fijiensis', kingdom: 'Hongos', group: 'Ascomicetos', where: 'Hojas del banano: causa la sigatoka negra, la enfermedad más costosa de las bananeras de Urabá.', body: 'moho', legs: 0, color: '#3d3d3d', traits: [...EU, 'quitina'] },
  { id: 'champinon', common: 'Champiñón', scientific: 'Agaricus bisporus', kingdom: 'Hongos', group: 'Basidiomicetos', where: 'Se cultiva sobre compost; se vende en los supermercados.', body: 'seta', legs: 0, color: '#e8dccb', traits: [...EU, 'quitina'] },
  { id: 'musgo', common: 'Musgo de los troncos', scientific: 'Bryophyta (división; varias especies)', kingdom: 'Plantas', group: 'Briofitas (musgos)', where: 'Troncos y piedras húmedas a la sombra.', body: 'musgo', legs: 0, color: '#4f8a2e', traits: [...EU, 'fotosintesis'] },
  { id: 'helecho', common: 'Helecho arborescente (palma boba)', scientific: 'Cyathea sp.', kingdom: 'Plantas', group: 'Helechos (pteridofitas)', where: 'Bosques húmedos de montaña de Antioquia.', body: 'helecho', legs: 0, color: '#3f7f3a', traits: PLANT },
  { id: 'pino', common: 'Pino pátula', scientific: 'Pinus patula', kingdom: 'Plantas', group: 'Gimnospermas', where: 'Plantaciones forestales de las montañas de Antioquia (es originario de México).', body: 'conifera', legs: 0, color: '#2f5f3a', traits: [...PLANT, 'semillas'] },
  { id: 'banano', common: 'Banano', scientific: 'Musa acuminata (grupo AAA, «Cavendish»)', kingdom: 'Plantas', group: 'Angiospermas monocotiledóneas', where: 'Las bananeras del eje Apartadó–Carepa–Chigorodó–Turbo.', body: 'monocot', legs: 0, color: '#5a9a3a', traits: [...PLANT, 'semillas', 'flores', 'nervParalelas'] },
  { id: 'cacao', common: 'Cacao', scientific: 'Theobroma cacao', kingdom: 'Plantas', group: 'Angiospermas dicotiledóneas', where: 'Cultivos de cacao de Urabá y del Bajo Cauca.', body: 'dicot', legs: 0, color: '#3e7a32', traits: [...PLANT, 'semillas', 'flores'] },
  { id: 'mangle', common: 'Mangle rojo', scientific: 'Rhizophora mangle', kingdom: 'Plantas', group: 'Angiospermas dicotiledóneas', where: 'Manglares del golfo de Urabá (raíces en zancos dentro del agua salobre).', body: 'mangle', legs: 0, color: '#2f6a3a', traits: [...PLANT, 'semillas', 'flores'] },
  { id: 'perezoso', common: 'Perezoso de tres dedos', scientific: 'Bradypus variegatus', kingdom: 'Animales', group: 'Mamíferos', where: 'Copas de los árboles de los bosques de Urabá.', body: 'mamifero', legs: 4, color: '#8a7a5f', traits: [...ANIMAL, 'vertebras', 'pelo'] },
  { id: 'garza', common: 'Garza blanca', scientific: 'Ardea alba', kingdom: 'Animales', group: 'Aves', where: 'Ciénagas, potreros y orillas del golfo.', body: 'ave', legs: 2, color: '#f2f2ee', traits: [...ANIMAL, 'vertebras', 'plumas'] },
  { id: 'bocachico', common: 'Bocachico', scientific: 'Prochilodus magdalenae', kingdom: 'Animales', group: 'Peces', where: 'Ríos y ciénagas de las cuencas del Magdalena, el Sinú y el Atrato.', body: 'pez', legs: 0, color: '#9aa7b0', traits: [...ANIMAL, 'vertebras', 'aletas'] },
  { id: 'iguana', common: 'Iguana verde', scientific: 'Iguana iguana', kingdom: 'Animales', group: 'Reptiles', where: 'Árboles cerca de los ríos y en los barrios de Apartadó.', body: 'reptil', legs: 4, color: '#5f9a46', traits: [...ANIMAL, 'vertebras', 'escamasSecas'] },
  { id: 'sapo', common: 'Sapo común', scientific: 'Rhinella horribilis', kingdom: 'Animales', group: 'Anfibios', where: 'Patios y potreros húmedos; sale de noche (antes se incluía en Rhinella marina).', body: 'anfibio', legs: 4, color: '#8a6f45', traits: [...ANIMAL, 'vertebras'] },
  { id: 'arriera', common: 'Hormiga arriera', scientific: 'Atta cephalotes', kingdom: 'Animales', group: 'Insectos', where: 'Corta hojas en las fincas y huertas de Urabá.', body: 'insecto', legs: 6, color: '#8a3b1f', traits: [...ANIMAL, 'patasArticuladas', 'seisPatas', 'antenas', 'segmentado'] },
  { id: 'arana', common: 'Araña plateada', scientific: 'Argiope argentata', kingdom: 'Animales', group: 'Arácnidos', where: 'Telarañas en los jardines y matorrales.', body: 'aracnido', legs: 8, color: '#c9c9b8', traits: [...ANIMAL, 'patasArticuladas', 'ochoPatas', 'segmentado'] },
  { id: 'cangrejo', common: 'Cangrejo azul', scientific: 'Cardisoma guanhumi', kingdom: 'Animales', group: 'Crustáceos', where: 'Manglares y playas del Caribe colombiano.', body: 'crustaceo', legs: 10, color: '#4a6fa8', traits: [...ANIMAL, 'patasArticuladas', 'antenas', 'segmentado'] },
  { id: 'lombriz', common: 'Lombriz de tierra', scientific: 'Pontoscolex corethrurus', kingdom: 'Animales', group: 'Anélidos', where: 'Suelos de potreros y cultivos del trópico.', body: 'anelido', legs: 0, color: '#c98a7a', traits: [...ANIMAL, 'segmentado'] },
  { id: 'caracol', common: 'Caracol gigante africano (invasor)', scientific: 'Lissachatina fulica', kingdom: 'Animales', group: 'Moluscos', where: 'Especie invasora registrada en muchos municipios de Colombia; no se debe tocar sin guantes.', body: 'molusco', legs: 0, color: '#a07a4f', traits: [...ANIMAL] },
];
export function findOrganism(id: string): Organism {
  const o = ORGANISMS.find((x) => x.id === id);
  if (!o) throw new RangeError(`Organismo desconocido: ${id}`);
  return o;
}
export const has = (o: Organism, t: TraitId) => o.traits.includes(t);
export const domainOf = (o: Organism): Domain => KINGDOM_DOMAIN[o.kingdom];

/* ------------------------------------------------------------------ claves dicotómicas */

export type Next = { couplet: string } | { result: string };
export interface Couplet { id: string; trait: TraitId; yes: Next; no: Next }
export interface DichotomousKey { id: string; name: string; start: string; couplets: Couplet[]; members: (o: Organism) => boolean; resultOf: (o: Organism) => string }

const c = (id: string, trait: TraitId, yes: Next, no: Next): Couplet => ({ id, trait, yes, no });
const to = (couplet: string): Next => ({ couplet });
const res = (result: string): Next => ({ result });

export const KEYS: DichotomousKey[] = [
  {
    id: 'reinos', name: 'Clave de dominios y reinos (todos los organismos)', start: '1', members: () => true, resultOf: (o) => o.kingdom,
    couplets: [
      c('1', 'nucleo', to('3'), to('2')),
      c('2', 'eter', res('Arqueobacterias'), res('Eubacterias')),
      c('3', 'unicelular', to('4'), to('5')),
      c('4', 'quitina', res('Hongos'), res('Protistas')),
      c('5', 'fotosintesis', res('Plantas'), to('6')),
      c('6', 'quitina', res('Hongos'), res('Animales')),
    ],
  },
  {
    id: 'animales', name: 'Clave de animales (vertebrados e invertebrados)', start: '1', members: (o) => o.kingdom === 'Animales', resultOf: (o) => o.group,
    couplets: [
      c('1', 'vertebras', to('2'), to('6')),
      c('2', 'pelo', res('Mamíferos'), to('3')),
      c('3', 'plumas', res('Aves'), to('4')),
      c('4', 'aletas', res('Peces'), to('5')),
      c('5', 'escamasSecas', res('Reptiles'), res('Anfibios')),
      c('6', 'patasArticuladas', to('7'), to('9')),
      c('7', 'seisPatas', res('Insectos'), to('8')),
      c('8', 'ochoPatas', res('Arácnidos'), res('Crustáceos')),
      c('9', 'segmentado', res('Anélidos'), res('Moluscos')),
    ],
  },
  {
    id: 'plantas', name: 'Clave de plantas', start: '1', members: (o) => o.kingdom === 'Plantas', resultOf: (o) => o.group,
    couplets: [
      c('1', 'vasos', to('2'), res('Briofitas (musgos)')),
      c('2', 'semillas', to('3'), res('Helechos (pteridofitas)')),
      c('3', 'flores', to('4'), res('Gimnospermas')),
      c('4', 'nervParalelas', res('Angiospermas monocotiledóneas'), res('Angiospermas dicotiledóneas')),
    ],
  },
];
export function findKey(id: string): DichotomousKey {
  const k = KEYS.find((x) => x.id === id);
  if (!k) throw new RangeError(`Clave desconocida: ${id}`);
  return k;
}
export const keyMembers = (k: DichotomousKey) => ORGANISMS.filter(k.members);

export interface KeyStep { couplet: Couplet; answer: boolean }
export interface KeyWalk { steps: KeyStep[]; result: string | null; next: Couplet | null }
/** Recorre la clave con las respuestas dadas (true = primera afirmación). Se detiene al llegar a un nombre. */
export function walkKey(k: DichotomousKey, answers: boolean[]): KeyWalk {
  const byId = new Map(k.couplets.map((x) => [x.id, x]));
  let cur = byId.get(k.start)!;
  const steps: KeyStep[] = [];
  for (const a of answers) {
    steps.push({ couplet: cur, answer: a });
    const nx = a ? cur.yes : cur.no;
    if ('result' in nx) return { steps, result: nx.result, next: null };
    cur = byId.get(nx.couplet)!;
  }
  return { steps, result: null, next: cur };
}
/** Las respuestas correctas de un organismo en la clave (lo que se observa en el ejemplar). */
export function correctAnswers(k: DichotomousKey, o: Organism): boolean[] {
  const out: boolean[] = [];
  for (;;) {
    const w = walkKey(k, out);
    if (w.result !== null) return out;
    out.push(has(o, w.next!.trait));
    if (out.length > k.couplets.length) throw new Error(`La clave «${k.id}» tiene un ciclo.`);
  }
}
export const identify = (k: DichotomousKey, o: Organism): string => walkKey(k, correctAnswers(k, o)).result!;

/** Revisión de una clave: cada dilema se alcanza, ninguno se repite en un camino y los nombres finales no se repiten sin motivo. */
export function validateKey(k: DichotomousKey): { ok: boolean; problems: string[]; results: string[] } {
  const problems: string[] = [];
  const byId = new Map(k.couplets.map((x) => [x.id, x]));
  const reached = new Set<string>();
  const results: string[] = [];
  const visit = (id: string, path: string[]) => {
    if (path.includes(id)) { problems.push(`Ciclo en el dilema ${id}.`); return; }
    const cp = byId.get(id);
    if (!cp) { problems.push(`El dilema ${id} no existe.`); return; }
    reached.add(id);
    for (const nx of [cp.yes, cp.no]) {
      if ('result' in nx) results.push(nx.result);
      else visit(nx.couplet, [...path, id]);
    }
  };
  visit(k.start, []);
  for (const cp of k.couplets) if (!reached.has(cp.id)) problems.push(`El dilema ${cp.id} no se alcanza.`);
  return { ok: problems.length === 0, problems, results };
}

/* ------------------------------------------------------------------ construir una clave */

export interface BuildGroup { id: string; name: string; members: string[]; traits: TraitId[] }
export const BUILD_GROUPS: BuildGroup[] = [
  { id: 'animales', name: 'Diez animales de Urabá y Colombia', members: ORGANISMS.filter((o) => o.kingdom === 'Animales').map((o) => o.id), traits: ['vertebras', 'pelo', 'plumas', 'aletas', 'escamasSecas', 'patasArticuladas', 'seisPatas', 'ochoPatas', 'antenas', 'segmentado'] },
  { id: 'plantas', name: 'Cinco plantas', members: ['musgo', 'helecho', 'pino', 'banano', 'cacao'], traits: ['vasos', 'semillas', 'flores', 'nervParalelas', 'fotosintesis'] },
  { id: 'microbios', name: 'Cinco microorganismos y hongos', members: ['ecoli', 'halobacteria', 'paramecio', 'levadura', 'champinon'], traits: ['nucleo', 'eter', 'unicelular', 'quitina', 'fotosintesis'] },
];
export function findGroup(id: string): BuildGroup {
  const g = BUILD_GROUPS.find((x) => x.id === id);
  if (!g) throw new RangeError(`Grupo desconocido: ${id}`);
  return g;
}

/** Nodo de la clave del estudiante: ruta '' (raíz), 'a' (primera afirmación), 'b', 'aa'… */
export interface BuildNode { path: string; members: Organism[]; trait: TraitId | null; useless: boolean; yes: BuildNode | null; no: BuildNode | null }
export interface BuildResult { root: BuildNode; couplets: number; depth: number; resolved: boolean; pending: BuildNode[]; useless: BuildNode[]; leaves: BuildNode[]; n: number; minDepth: number }

/** Arma la clave con el carácter que el estudiante eligió para cada ruta. Un carácter que no separa se marca inútil. */
export function buildKey(groupId: string, choices: Record<string, TraitId>): BuildResult {
  const g = findGroup(groupId);
  const members = g.members.map(findOrganism);
  const pending: BuildNode[] = [], useless: BuildNode[] = [], leaves: BuildNode[] = [];
  let couplets = 0, depth = 0;
  const make = (path: string, ms: Organism[]): BuildNode => {
    const node: BuildNode = { path, members: ms, trait: null, useless: false, yes: null, no: null };
    if (ms.length <= 1) { leaves.push(node); depth = Math.max(depth, path.length); return node; }
    const t = choices[path];
    if (!t) { pending.push(node); depth = Math.max(depth, path.length); return node; }
    node.trait = t;
    const yes = ms.filter((o) => has(o, t)), no = ms.filter((o) => !has(o, t));
    if (yes.length === 0 || no.length === 0) { node.useless = true; useless.push(node); pending.push(node); depth = Math.max(depth, path.length); return node; }
    couplets++;
    node.yes = make(`${path}a`, yes);
    node.no = make(`${path}b`, no);
    return node;
  };
  const root = make('', members);
  return { root, couplets, depth, resolved: pending.length === 0, pending, useless, leaves, n: members.length, minDepth: Math.ceil(Math.log2(members.length)) };
}

export interface ClassCondition { text: string; level: 'invalido' | 'advertencia' | 'nota'; fix: string }
export function buildConditions(b: BuildResult): ClassCondition[] {
  const out: ClassCondition[] = [];
  for (const u of b.useless) {
    const t = findTrait(u.trait!);
    const all = has(u.members[0], u.trait!);
    out.push({ level: 'invalido', text: `El carácter «${t.yes.toLowerCase()}» no separa este grupo: ${all ? 'todos lo tienen' : 'ninguno lo tiene'} (${u.members.map((o) => o.common).join(', ')}).`, fix: 'Elige un carácter que tengan unos sí y otros no; mira los ejemplares en 3D.' });
  }
  return out;
}
export function walkConditions(k: DichotomousKey, o: Organism, answers: boolean[]): ClassCondition[] {
  const w = walkKey(k, answers);
  const right = correctAnswers(k, o);
  const out: ClassCondition[] = [];
  if (!k.members(o)) out.push({ level: 'invalido', text: `${o.common} no pertenece a los organismos de esta clave (${k.name.toLowerCase()}).`, fix: k.id === 'animales' ? 'Usa la clave de dominios y reinos o elige un animal.' : k.id === 'plantas' ? 'Usa la clave de dominios y reinos o elige una planta.' : 'Elige otro ejemplar.' });
  const wrong = w.steps.findIndex((s, idx) => s.answer !== right[idx]);
  if (k.members(o) && wrong >= 0) {
    const t = findTrait(w.steps[wrong].couplet.trait);
    out.push({ level: 'advertencia', text: `En el dilema ${w.steps[wrong].couplet.id} elegiste «${(w.steps[wrong].answer ? t.yes : t.no).toLowerCase()}», pero el ejemplar no es así.`, fix: `Vuelve al dilema ${w.steps[wrong].couplet.id} y observa: ${t.how}` });
  }
  return out;
}

export const classificationSpec: ModelSpec = {
  name: 'Claves dicotómicas, sistema de tres dominios y reinos con 25 organismos reales',
  inputs: [
    { symbol: 'clave', name: 'Clave de reinos, de animales o de plantas', unit: '—', initial: 'reinos' },
    { symbol: 'ejemplar', name: 'Organismo que se identifica', unit: '—', initial: 'hormiga arriera' },
    { symbol: 'respuestas', name: 'Afirmación elegida en cada dilema', unit: 'sí/no', initial: '—' },
    { symbol: 'caracteres', name: 'Carácter elegido para cada grupo de la clave propia', unit: '—', initial: '—' },
  ],
  outputs: [
    { symbol: 'nombre', name: 'Dominio, reino o grupo al que llega la clave', unit: '—' },
    { symbol: 'n − 1', name: 'Número de dilemas de la clave propia', unit: '—' },
    { symbol: 'profundidad', name: 'Dilemas del camino más largo', unit: '—' },
  ],
  equations: [
    'Cada dilema pregunta por un carácter observable: «sí» → primera afirmación; «no» → segunda.',
    'Una clave dicotómica que separa n organismos tiene n − 1 dilemas y una profundidad ≥ ⌈log₂ n⌉.',
    'Dominio: Bacteria, Archaea o Eukarya (Woese, Kandler y Wheelis, 1990); seis reinos: Eubacterias, Arqueobacterias, Protistas, Hongos, Plantas y Animales.',
  ],
  initialConditions: ['Clave de dominios y reinos con la hormiga arriera (Atta cephalotes) como ejemplar.'],
  assumptions: [
    'Cada carácter es de sí o no y todos los ejemplares de una especie lo tienen (no hay ejemplares jóvenes, dañados o raros).',
    'Los protistas y los «reinos» son grupos de clasificación tradicional; algunos (protistas) no son grupos naturales para la biología actual.',
  ],
  limits: [
    'Las claves de aula usan caracteres visibles; distinguir bacterias de arqueas exige análisis de laboratorio (lípidos de la membrana y ARN ribosómico).',
    'Los modelos 3D son formas simplificadas: sirven para contar patas, ver aletas o flores, no para reconocer la especie.',
    'Una clave solo identifica a los organismos para los que se escribió: un organismo nuevo puede llegar a un nombre equivocado.',
  ],
  testCases: [
    'Los 25 organismos llegan a su reino con la clave de reinos, los 10 animales a su clase y las 6 plantas a su grupo.',
    'Escherichia coli → Bacteria, Halobacterium salinarum → Archaea y Saccharomyces cerevisiae → Eukarya (Woese y otros, 1990).',
    'Clave propia de los 10 animales: si separa a todos, tiene 9 dilemas y una profundidad ≥ 4; un carácter que todos comparten se marca como inútil.',
  ],
};
