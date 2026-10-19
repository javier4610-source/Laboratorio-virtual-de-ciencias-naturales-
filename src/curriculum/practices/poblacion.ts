import type { PracticeDef } from '../../core/types';
import { populationModelSpec } from '../../models/population';

export const poblacion: PracticeDef = {
  id: 'poblacion',
  title: 'Crecimiento poblacional y capacidad de carga',
  grade: 11,
  area: 'ambiental',
  topic: 'Ecología: dinámica de poblaciones, capacidad de carga y aprovechamiento sostenible',
  durationMin: 45,
  status: 'disponible',
  summary: 'Simula una población de peces en una ciénaga: compara el crecimiento exponencial y el logístico y evalúa cuánta pesca es sostenible.',
  problemQuestion: '¿Cuánto se puede pescar en una ciénaga sin que la población de peces colapse?',
  objectives: [
    'Comparar los modelos de crecimiento exponencial y logístico.',
    'Interpretar la capacidad de carga como un límite impuesto por los recursos del ambiente.',
    'Analizar el efecto de la extracción (pesca) o de la mortalidad por contaminación sobre el equilibrio de una población.',
    'Argumentar decisiones de manejo ambiental con base en datos.',
  ],
  competencies: ['explicacion', 'indagacion'],
  curricularLink: {
    standards: 'EBC (MEN, 2006), grados 10.º–11.º, entorno vivo y CTS: analizar dinámicas de poblaciones y el impacto de la acción humana sobre los ecosistemas (paráfrasis; validar con el documento oficial).',
    dba: 'Propuesta: DBA de Ciencias Naturales de 11.º relacionado con ecología y sostenibilidad. Validar número y enunciado con el documento oficial del MEN.',
    note: 'Práctica complementaria para el área de ciencias ambientales; puede trabajarse también en 9.º de forma cualitativa.',
  },
  materials: ['Modelo de población de peces de una ciénaga', 'Controles de tasa de crecimiento, capacidad de carga y tasa de pesca', 'Gráfica N(t)'],
  background: [
    'Si los recursos fueran ilimitados, una población crecería exponencialmente: dN/dt = r·N. El tiempo de duplicación sería constante (ln 2 / r).',
    'En la realidad, el alimento, el espacio y el oxígeno son limitados. La capacidad de carga (K) es el tamaño máximo que el ambiente puede sostener. El modelo logístico, dN/dt = r·N·(1 − N/K), describe un crecimiento que se frena al acercarse a K.',
    'La pesca o la mortalidad causada por contaminación agregan una pérdida proporcional a la población (h·N). El nuevo equilibrio es K·(1 − h/r): si h ≥ r, la población disminuye hasta desaparecer.',
  ],
  relations: [
    { x: 'h', y: 'nfinal', xLabel: 'la tasa de pesca', yLabel: 'la población final', datasetId: 'escenarios' },
    { x: 'k', y: 'nfinal', xLabel: 'la capacidad de carga', yLabel: 'la población final', datasetId: 'escenarios' },
  ],
  variables: {
    independent: ['Modelo (exponencial o logístico)', 'Tasa de crecimiento r', 'Capacidad de carga K', 'Tasa de pesca h'],
    dependent: ['Tamaño de la población en el tiempo', 'Población de equilibrio'],
    controlled: ['Población inicial', 'Tiempo simulado'],
  },
  procedure: [
    'Simula 50 años con el modelo exponencial y luego con el logístico, con los mismos parámetros. Compara las curvas.',
    'Con el modelo logístico, cambia K y observa la población final. Guarda cada escenario.',
    'Fija r = 0,5 y K = 1000. Aumenta la tasa de pesca h de 0 a 0,6 en pasos de 0,1 y guarda cada escenario.',
    'Identifica la tasa de pesca a partir de la cual la población colapsa.',
    'Calcula la captura anual en equilibrio (h·N*) para cada h y busca cuál es la máxima.',
  ],
  interpretation: [
    '¿En qué se diferencian las curvas exponencial y logística? ¿Cuál es más realista y por qué?',
    '¿Qué relación encontraste entre la tasa de pesca y la población de equilibrio?',
    '¿Qué tasa de pesca produce la mayor captura sostenible según tus cálculos? ¿Por qué no es buena idea pescar justo en ese límite en la realidad?',
  ],
  assessment: [
    {
      id: 'pob-1', grade: 11, topic: 'Crecimiento poblacional', competency: 'explicacion', component: 'biologico', skill: 'Explicar la capacidad de carga', difficulty: 'baja',
      stem: '¿Por qué en el modelo logístico el crecimiento se hace más lento al acercarse a K?',
      options: [
        { id: 'a', text: 'Porque los individuos dejan de reproducirse cuando envejecen.', feedback: 'El modelo no representa edades; el freno se debe a la escasez de recursos.' },
        { id: 'b', text: 'Porque los recursos por individuo disminuyen y aumenta la competencia, reduciendo la tasa de crecimiento neta.', feedback: 'Correcto.' },
        { id: 'c', text: 'Porque la tasa r disminuye con el tiempo.', feedback: 'r es constante; lo que disminuye es el factor (1 − N/K).' },
        { id: 'd', text: 'Porque la población ya alcanzó su tamaño máximo genético.', feedback: 'El límite es ambiental, no genético.' },
      ],
      correct: 'b',
      explanation: 'El factor (1 − N/K) reduce la tasa neta de crecimiento a medida que N se acerca a K, representando la competencia por recursos limitados.',
      review: 'Compara las curvas exponencial y logística con los mismos parámetros.',
    },
    {
      id: 'pob-2', grade: 11, topic: 'Aprovechamiento sostenible', competency: 'indagacion', component: 'cts', skill: 'Usar evidencia para tomar decisiones', difficulty: 'alta',
      table: { caption: 'Equilibrio de una población de peces (r = 0,5/año; K = 1000)', headers: ['Tasa de pesca h', '0', '0,1', '0,2', '0,25', '0,3', '0,4'], rows: [['Población de equilibrio', 1000, 800, 600, 500, 400, 200], ['Captura anual (h·N)', 0, 80, 120, 125, 120, 80]] },
      stem: 'Una comunidad pesquera quiere obtener la mayor captura anual sin agotar la población. ¿Qué recomendación se apoya mejor en los datos?',
      options: [
        { id: 'a', text: 'Usar h = 0,4, porque es la mayor tasa de pesca.', feedback: 'La captura con h = 0,4 es menor (80) y la población queda muy reducida.' },
        { id: 'b', text: 'Usar una tasa cercana a 0,2–0,25, donde la captura es máxima, preferiblemente algo menor por precaución.', feedback: 'Correcto: el máximo sostenible está cerca de h = r/2.' },
        { id: 'c', text: 'No pescar, porque cualquier pesca reduce la población.', feedback: 'La pesca moderada es sostenible: la población se estabiliza en un valor positivo.' },
        { id: 'd', text: 'La captura siempre aumenta con h.', feedback: 'La tabla muestra que la captura aumenta y luego disminuye.' },
      ],
      correct: 'b',
      explanation: 'La captura en equilibrio h·K(1 − h/r) es máxima en h = r/2 = 0,25. Como los parámetros reales son inciertos, se recomienda pescar por debajo de ese máximo (principio de precaución).',
      review: 'Realiza el paso 5 del procedimiento.',
    },
    {
      id: 'pob-3', grade: 11, topic: 'Crecimiento exponencial', competency: 'uso', component: 'biologico', skill: 'Aplicar el tiempo de duplicación', difficulty: 'media',
      stem: 'Una población de bacterias crece exponencialmente con r = 0,693 por hora. Si hay 100 bacterias, ¿cuántas habrá en 3 horas?',
      options: [
        { id: 'a', text: '300', feedback: 'Eso sería crecimiento lineal (sumar 100 cada hora).' },
        { id: 'b', text: '800', feedback: 'Correcto: t₂ = ln 2 / 0,693 = 1 h; en 3 h se duplica tres veces: 100 × 2³.' },
        { id: 'c', text: '600', feedback: 'Se multiplicó por 2 y por 3; la población se duplica en cada intervalo.' },
        { id: 'd', text: '169', feedback: 'Se sumó 0,693 × 100 por hora, como si fuera lineal.' },
      ],
      correct: 'b',
      explanation: 'N(t) = N₀·e^(rt) = 100·e^(0,693·3) ≈ 100·2³ = 800.',
      review: 'Usa el modelo exponencial con r = 0,69 y observa el tiempo de duplicación.',
    },
  ],
  application: {
    situation: 'En las ciénagas del Magdalena y del Atrato, la pesca artesanal sostiene a muchas familias, y la contaminación por mercurio y sedimentos afecta a los peces.',
    question: 'Usando el modelo, explica cómo la contaminación y la sobrepesca podrían combinarse para causar un colapso. ¿Qué medidas propondrías?',
    guidance: 'La contaminación puede reducir K (menos hábitat) o aumentar la mortalidad (como h). Considera vedas, tallas mínimas y control de vertimientos. Recuerda las limitaciones del modelo.',
  },
  transferQuestionIds: ['saber-pob-1'],
  conclusionGuide: 'Responde la pregunta problema con un valor de pesca sostenible justificado por tus escenarios y menciona las limitaciones del modelo.',
  model: populationModelSpec,
  references: [
    'Verhulst, P.-F. (1838). Notice sur la loi que la population suit dans son accroissement.',
    'Textos de ecología de poblaciones: modelo logístico y rendimiento máximo sostenible.',
  ],
  keywords: ['población', 'ecología', 'capacidad de carga', 'logístico', 'exponencial', 'pesca', 'sostenible', 'ambiente'],
};
