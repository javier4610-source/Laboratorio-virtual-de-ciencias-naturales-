import type { PracticeDef, Question } from '../core/types';
import { SABER_BANK } from '../assessment/bank';
import { balancePractice } from '../assessment/balance';
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
import { reaccionesOrganicas } from './practices/reacciones-organicas';
import { gruposNitrogenados } from './practices/grupos-nitrogenados';
import { gruposOxigenados } from './practices/grupos-oxigenados';
import { nomenclaturaOrganica } from './practices/nomenclatura-organica';
import { aromaticos } from './practices/aromaticos';
import { hidrocarburos } from './practices/hidrocarburos';
import { nomenclaturaInorganica } from './practices/nomenclatura-inorganica';
import { acidosSales } from './practices/acidos-sales';
import { oxidosHidroxidos } from './practices/oxidos-hidroxidos';
import { cineticaPotencial } from './practices/cinetica-potencial';
import { metabolismo } from './practices/metabolismo';
import { proteinas } from './practices/proteinas';
import { rastreo } from './practices/rastreo';
import { secuencias } from './practices/secuencias';
import { geometria } from './practices/geometria';
import { reto } from './practices/reto';
import { mol } from './practices/mol';
import { extraccionAdn } from './practices/extraccion-adn';
import { circuitosSimples } from './practices/circuitos-simples';
import { induccion } from './practices/induccion';
import { interferencia } from './practices/interferencia';
import { movimiento } from './practices/movimiento';
import { flotacion } from './practices/flotacion';
import { trabajo } from './practices/trabajo';
import { sonido } from './practices/sonido';
import { conduccion } from './practices/conduccion';
import { expresion } from './practices/expresion';
import { balanceo } from './practices/balanceo';
import { ecosistema } from './practices/ecosistema';
import { presion } from './practices/presion';
import { calor } from './practices/calor';
import { maquinas } from './practices/maquinas';
import { agua } from './practices/agua';
import { respiracion } from './practices/respiracion';
import { conservacion } from './practices/conservacion';
import { choques } from './practices/choques';
import { pendulo } from './practices/pendulo';
import { proyectiles } from './practices/proyectiles';
import { equilibrio } from './practices/equilibrio';
import { descomposicion } from './practices/descomposicion';
import { conductores } from './practices/conductores';
import { seleccion } from './practices/seleccion';
import { redes } from './practices/redes';
import { cinetica } from './practices/cinetica';
import { cinematica } from './practices/cinematica';
import { celulas } from './practices/celulas';

/** Catálogo de prácticas implementadas. Para agregar una nueva: definirla aquí y registrar su componente en labs/registry.ts. */
export const PRACTICES: PracticeDef[] = ([densidad, mezclas, celulas, redes, maquinas, calor, movimiento, ecosistema, circuitosSimples, osmosis, presion, flotacion, conduccion, mitosis, conductores, descomposicion, mendel, cineticaPotencial, ondas, sonido, optica, adn, extraccionAdn, conservacion, balanceo, newton, cinematica, trabajo, mol, seleccion, soluciones, geometria, oxidosHidroxidos, acidosSales, nomenclaturaInorganica, enzimas, fotosintesis, gases, cinetica, energia, proyectiles, pendulo, choques, respiracion, circuitos, estequiometria, equilibrio, nomenclaturaOrganica, aromaticos, hidrocarburos, gruposOxigenados, gruposNitrogenados, reaccionesOrganicas, ph, poblacion, popgen, agua, expresion, secuencias, rastreo, proteinas, metabolismo, interferencia, induccion, reto] as PracticeDef[]).map(balancePractice);

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
