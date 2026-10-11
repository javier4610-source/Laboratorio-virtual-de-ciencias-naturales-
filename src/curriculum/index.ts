import type { PracticeDef, Question } from '../core/types';
import { SABER_BANK } from '../assessment/bank';
import { densidad } from './practices/densidad';
import { osmosis } from './practices/osmosis';
import { mendel } from './practices/mendel';
import { adn } from './practices/adn';
import { soluciones } from './practices/soluciones';
import { enzimas } from './practices/enzimas';
import { circuitos } from './practices/circuitos';
import { estequiometria } from './practices/estequiometria';
import { poblacion } from './practices/poblacion';
import { popgen } from './practices/popgen';
import { energia } from './practices/energia';
import { gases } from './practices/gases';
import { newton } from './practices/newton';
import { optica } from './practices/optica';
import { mezclas } from './practices/mezclas';
import { ph } from './practices/ph';
import { fotosintesis } from './practices/fotosintesis';
import { ondas } from './practices/ondas';
import { mitosis } from './practices/mitosis';

/** Catálogo de prácticas implementadas. Para agregar una nueva: definirla aquí y registrar su componente en labs/registry.ts. */
export const PRACTICES: PracticeDef[] = [densidad, mezclas, osmosis, mitosis, mendel, ondas, optica, adn, newton, soluciones, enzimas, fotosintesis, gases, energia, circuitos, estequiometria, ph, poblacion, popgen];

export function practiceById(id: string): PracticeDef | undefined {
  return PRACTICES.find((p) => p.id === id);
}

/** Todas las preguntas: banco tipo Saber + evaluaciones de cada práctica. */
export const ALL_QUESTIONS: Question[] = [
  ...SABER_BANK,
  ...PRACTICES.flatMap((p) => p.assessment.map((q) => ({ ...q, practiceId: p.id }))),
];

export function questionById(id: string): Question | undefined {
  return ALL_QUESTIONS.find((q) => q.id === id);
}
