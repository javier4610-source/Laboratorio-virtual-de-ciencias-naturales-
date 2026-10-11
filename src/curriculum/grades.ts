import type { Area, Competency, GradeId, GradeInfo, PlannedPractice, SaberComponent } from '../core/types';

export const AREA_LABEL: Record<Area, string> = {
  biologia: 'Biología',
  quimica: 'Química',
  fisica: 'Física',
  ambiental: 'Ciencias ambientales',
};

export const COMPETENCY_LABEL: Record<Competency, string> = {
  uso: 'Uso comprensivo del conocimiento científico',
  explicacion: 'Explicación de fenómenos',
  indagacion: 'Indagación',
};

export const COMPETENCY_SHORT: Record<Competency, string> = {
  uso: 'Uso comprensivo',
  explicacion: 'Explicación',
  indagacion: 'Indagación',
};

export const COMPONENT_LABEL: Record<SaberComponent, string> = {
  biologico: 'Biológico',
  quimico: 'Químico',
  fisico: 'Físico',
  cts: 'Ciencia, tecnología y sociedad',
};

export const GRADES: GradeInfo[] = [
  {
    id: 6, name: 'Sexto', title: 'Introducción a la experimentación científica',
    description: 'Observar, medir y formular preguntas: el punto de partida de toda indagación.',
    standardsGroup: '6.º a 7.º',
    topics: ['Método científico, observación, hipótesis, variables y medición', 'Uso de instrumentos de laboratorio', 'Célula y organización de los seres vivos', 'Diferencias entre células animales y vegetales', 'Clasificación básica de los seres vivos', 'Ecosistemas: factores bióticos y abióticos', 'Materia, propiedades físicas, mezclas y métodos de separación', 'Fuerza, movimiento y máquinas simples', 'Temperatura, calor, luz y sonido', 'Cuidado del agua y del ambiente'],
  },
  {
    id: 7, name: 'Séptimo', title: 'Estructura, funcionamiento y transformación',
    description: 'Cómo funcionan las células y los sistemas, y cómo se transforman la materia y la energía.',
    standardsGroup: '6.º a 7.º',
    topics: ['Membrana celular, difusión y ósmosis', 'Nutrición, circulación, respiración y excreción', 'Reproducción celular: introducción a mitosis y meiosis', 'Relaciones ecológicas y ciclos biogeoquímicos', 'Estructura del átomo y tabla periódica', 'Enlaces químicos introductorios', 'Densidad, presión, temperatura y transferencia de calor', 'Electricidad básica y circuitos simples'],
  },
  {
    id: 8, name: 'Octavo', title: 'Reproducción, genética y transformaciones químicas',
    description: 'La herencia, la variación de los seres vivos y las reacciones que conservan la masa.',
    standardsGroup: '8.º a 9.º',
    topics: ['Reproducción sexual y asexual', 'ADN, genes y cromosomas', 'Leyes de Mendel: cruces monohíbridos y dihíbridos', 'Sistemas nervioso y endocrino', 'Selección natural e introducción a la evolución', 'Tabla periódica y propiedades periódicas', 'Enlaces químicos y reacciones', 'Conservación de la masa', 'Ondas, sonido y óptica'],
  },
  {
    id: 9, name: 'Noveno', title: 'Biología molecular, evolución y mecánica',
    description: 'Del gen a la proteína, de la población a la evolución, de la fuerza al movimiento.',
    standardsGroup: '8.º a 9.º',
    topics: ['Replicación del ADN', 'Transcripción y traducción', 'Síntesis de proteínas', 'Mutaciones y su efecto en las proteínas', 'Genética mendeliana y variación genética', 'Evolución y selección natural', 'Dinámica de poblaciones y ecología', 'Mol, masa molar y estequiometría introductoria', 'Cinemática, leyes de Newton, trabajo y energía'],
  },
  {
    id: 10, name: 'Décimo', title: 'Metabolismo, química y física',
    description: 'Relaciones cuantitativas: concentraciones, velocidades de reacción y energía.',
    standardsGroup: '10.º a 11.º',
    topics: ['Biomoléculas y enzimas', 'Fotosíntesis y respiración celular', 'Metabolismo y transformación de energía', 'Biotecnología y aplicaciones de la biología molecular', 'Fisiología humana', 'Configuración electrónica y periodicidad química', 'Soluciones, concentración, molaridad y gases', 'Reacciones químicas y relaciones cuantitativas', 'Movimiento, dinámica, energía y conservación'],
  },
  {
    id: 11, name: 'Undécimo', title: 'Integración científica y preparación para Saber 11',
    description: 'Integrar biología, química, física y ambiente para interpretar evidencias y argumentar.',
    standardsGroup: '10.º a 11.º',
    topics: ['Genética molecular y regulación de la expresión génica', 'Biotecnología, ingeniería genética y bioética', 'Evolución y genética de poblaciones', 'Fisiología humana, inmunología y homeostasis', 'Ecología, biodiversidad, contaminación y cambio climático', 'Estequiometría avanzada', 'Equilibrio químico introductorio', 'Ácidos, bases y pH', 'Oxidación-reducción', 'Electricidad, circuitos y magnetismo', 'Ondas, óptica y fenómenos físicos', 'Diseño experimental, análisis de datos e interpretación de evidencias'],
  },
];

export function gradeInfo(id: GradeId): GradeInfo {
  return GRADES.find((g) => g.id === id)!;
}

/** Prácticas de la malla propuesta que todavía no están implementadas. */
export const PLANNED: PlannedPractice[] = [
  { title: 'Separación de mezclas: filtración, decantación y evaporación', grade: 6, area: 'quimica', status: 'planificada' },
  { title: 'Microscopio virtual: células animales y vegetales', grade: 6, area: 'biologia', status: 'planificada' },
  { title: 'Cadenas y redes alimentarias', grade: 6, area: 'ambiental', status: 'planificada' },
  { title: 'Ecosistema: agua, luz y alimento', grade: 6, area: 'ambiental', status: 'planificada' },
  { title: 'Movimiento y distancia recorrida', grade: 6, area: 'fisica', status: 'planificada' },
  { title: 'Secuencia interactiva de la mitosis', grade: 7, area: 'biologia', status: 'planificada' },
  { title: 'Circuitos simples con baterías, interruptores y bombillas', grade: 7, area: 'fisica', status: 'planificada' },
  { title: 'Materiales conductores y aislantes', grade: 7, area: 'fisica', status: 'planificada' },
  { title: 'Factores de la descomposición de materia orgánica', grade: 7, area: 'ambiental', status: 'planificada' },
  { title: 'Densidad y flotación', grade: 7, area: 'fisica', status: 'planificada' },
  { title: 'Modelo interactivo de ADN y complementariedad', grade: 8, area: 'biologia', status: 'planificada' },
  { title: 'Conservación de la masa', grade: 8, area: 'quimica', status: 'planificada' },
  { title: 'Balanceo visual de ecuaciones químicas', grade: 8, area: 'quimica', status: 'planificada' },
  { title: 'Laboratorio de ondas: frecuencia, amplitud y longitud de onda', grade: 8, area: 'fisica', status: 'planificada' },
  { title: 'Reflexión y refracción de la luz', grade: 8, area: 'fisica', status: 'planificada' },
  { title: 'Selección natural con cambios ambientales', grade: 9, area: 'biologia', status: 'planificada' },
  { title: 'Velocidad, aceleración y movimiento', grade: 9, area: 'fisica', status: 'planificada' },
  { title: 'Leyes de Newton', grade: 9, area: 'fisica', status: 'planificada' },
  { title: 'Cálculos estequiométricos básicos', grade: 9, area: 'quimica', status: 'planificada' },
  { title: 'Fotosíntesis: luz, CO₂ y temperatura', grade: 10, area: 'biologia', status: 'planificada' },
  { title: 'Respiración celular y balance energético', grade: 10, area: 'biologia', status: 'planificada' },
  { title: 'Leyes de los gases', grade: 10, area: 'quimica', status: 'planificada' },
  { title: 'Conservación de la energía mecánica', grade: 10, area: 'fisica', status: 'planificada' },
  { title: 'Factores que afectan la velocidad de reacción', grade: 10, area: 'quimica', status: 'planificada' },
  { title: 'Expresión génica y efecto de mutaciones', grade: 11, area: 'biologia', status: 'planificada' },
  { title: 'Genética de poblaciones y frecuencias alélicas', grade: 11, area: 'biologia', status: 'planificada' },
  { title: 'pH, dilución y neutralización ácido-base', grade: 11, area: 'quimica', status: 'planificada' },
  { title: 'Equilibrio químico con cambios controlados', grade: 11, area: 'quimica', status: 'planificada' },
  { title: 'Contaminación del agua e indicadores', grade: 11, area: 'ambiental', status: 'planificada' },
  { title: 'Reto de indagación con interpretación de datos', grade: 11, area: 'ambiental', status: 'planificada' },
];
