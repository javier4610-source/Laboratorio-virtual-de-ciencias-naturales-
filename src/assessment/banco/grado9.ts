import type { Question } from '../../core/types';
import { balanceQuestion } from '../balance';

/**
 * Banco tipo Saber 11: preguntas con grado recomendado 9.º. Son preguntas ORIGINALES de práctica, elaboradas para este
 * laboratorio: NO son preguntas oficiales del ICFES ni reproducen ítems liberados. Cada grado es un archivo aparte para
 * que la página del banco y cada práctica descarguen solo lo que usan (ver ./cargar.ts y docs/v2/RENDIMIENTO.md).
 * Una pregunta nueva va en el archivo de SU grado (una prueba unitaria lo verifica).
 */
const RAW: Question[] = [
  {
    id: 'saber-adn-1', grade: 9, topic: 'Síntesis de proteínas', competency: 'uso', component: 'biologico', skill: 'Usar el código genético', difficulty: 'media', practiceId: 'adn',
    context: 'Un fragmento de ARNm tiene la secuencia 5′-AUG UUU GGC UAA-3′. Según el código genético: AUG = Met, UUU = Phe, GGC = Gly, UAA = terminación.',
    stem: '¿Qué péptido se produce?',
    options: [
      { id: 'a', text: 'Met-Phe-Gly', feedback: 'Correcto: UAA detiene la traducción.' },
      { id: 'b', text: 'Met-Phe-Gly-Stop como cuarto aminoácido', feedback: 'Los codones de terminación no codifican aminoácidos.' },
      { id: 'c', text: 'Phe-Gly', feedback: 'AUG codifica metionina y es el primer aminoácido.' },
      { id: 'd', text: 'Tyr-Lys-Pro-Ile', feedback: 'Se tradujeron los codones complementarios, no los del ARNm.' },
    ],
    correct: 'a',
    explanation: 'La traducción inicia en AUG (Met), continúa con UUU (Phe) y GGC (Gly) y termina en UAA.',
    review: 'Traduce el gen de práctica en el simulador.',
  },
  {
    id: 'saber-adn-2', grade: 9, topic: 'Mutaciones', competency: 'explicacion', component: 'biologico', skill: 'Relacionar mutación y fenotipo', difficulty: 'alta', practiceId: 'adn',
    context: 'En la anemia falciforme, el codón GAG del gen de la β-globina cambia a GTG, lo que reemplaza ácido glutámico (con carga negativa) por valina (no polar).',
    stem: '¿Por qué un único cambio de aminoácido puede alterar el funcionamiento de la hemoglobina?',
    options: [
      { id: 'a', text: 'Porque la proteína pierde todos sus aminoácidos siguientes.', feedback: 'Eso ocurriría con una mutación sin sentido o un corrimiento del marco, no con esta sustitución.' },
      { id: 'b', text: 'Porque cambian las propiedades químicas en la superficie de la proteína, lo que favorece que las moléculas se agrupen y deformen el glóbulo rojo.', feedback: 'Correcto.' },
      { id: 'c', text: 'Porque la valina es tóxica para la célula.', feedback: 'La valina es un aminoácido normal en las proteínas.' },
      { id: 'd', text: 'Porque la mutación impide que se produzca ARNm.', feedback: 'El gen se transcribe y se traduce; la proteína se produce con un aminoácido distinto.' },
    ],
    correct: 'b',
    explanation: 'La forma y las interacciones de una proteína dependen de las propiedades de sus aminoácidos. La valina hidrofóbica en la superficie permite que la hemoglobina desoxigenada forme fibras que deforman los glóbulos rojos.',
    review: 'Aplica la mutación en el fragmento HBB del simulador.',
  },
  {
    id: 'saber-ind-3', grade: 9, topic: 'Análisis de datos', competency: 'indagacion', component: 'cts', skill: 'Reconocer la importancia de la repetición', difficulty: 'media',
    context: 'Dos grupos midieron el tiempo de caída de una pelota desde 2 m. El grupo A hizo una medición (0,58 s). El grupo B hizo cinco (0,66; 0,62; 0,63; 0,65; 0,64 s).',
    stem: '¿Por qué el resultado del grupo B es más confiable?',
    options: [
      { id: 'a', text: 'Porque sus valores son mayores.', feedback: 'La confiabilidad no depende de que el valor sea mayor.' },
      { id: 'b', text: 'Porque al repetir se puede promediar y estimar la variabilidad de la medición.', feedback: 'Correcto.' },
      { id: 'c', text: 'Porque el grupo B usó otra pelota.', feedback: 'No hay información que lo indique; además sería otra variable.' },
      { id: 'd', text: 'Porque un solo dato siempre es incorrecto.', feedback: 'Un dato puede ser correcto, pero no permite saber cuánto varía la medición.' },
    ],
    correct: 'b',
    explanation: 'Repetir mediciones permite calcular un promedio (0,64 s) y estimar la dispersión, reduciendo el efecto de errores aleatorios.',
    review: 'En cada práctica, realiza varios ensayos en las mismas condiciones cuando el instrumento tenga resolución limitada.',
  },
  {
    id: 'saber-nwt-1', grade: 9, topic: 'Dinámica', competency: 'indagacion', component: 'fisico', skill: 'Identificar la variable que causa un cambio', difficulty: 'media', practiceId: 'newton',
    context: 'Se tiró de un carrito con distintas fuerzas y se midió su aceleración. En el ensayo 3 también se le agregaron pesas.',
    table: { caption: 'Ensayos con el carrito', headers: ['Ensayo', 'F (N)', 'm (kg)', 'a (m/s²)'], rows: [[1, 1, 0.5, 2.0], [2, 2, 0.5, 4.0], [3, 3, 1.5, 2.0]] },
    stem: '¿Qué conclusión es válida?',
    options: [
      { id: 'a', text: 'Al aumentar la fuerza de 2 a 3 N la aceleración disminuyó, así que más fuerza produce menos aceleración.', feedback: 'Entre los ensayos 2 y 3 también cambió la masa: no es una comparación controlada.' },
      { id: 'b', text: 'Comparando los ensayos 1 y 2 (misma masa), duplicar la fuerza duplicó la aceleración.', feedback: 'Correcto.' },
      { id: 'c', text: 'La masa no influye en la aceleración.', feedback: 'El ensayo 3 muestra que con más masa la aceleración es menor para una fuerza dada.' },
      { id: 'd', text: 'Los datos son contradictorios y no permiten concluir nada.', feedback: 'Los ensayos 1 y 2 sí permiten una conclusión; el 3 cambió dos variables.' },
    ],
    correct: 'b',
    explanation: 'Solo se pueden comparar ensayos en los que cambia una variable. En 1 y 2 la masa es igual y la aceleración es proporcional a la fuerza (a = F/m).',
    review: 'En la práctica de Newton, cambia una sola variable por ensayo.',
  },
  {
    id: 'saber-cin-1', grade: 9, topic: 'Cinemática', competency: 'indagacion', component: 'fisico', skill: 'Interpretar datos de velocidad y tiempo para calcular una distancia de frenado', difficulty: 'media', practiceId: 'cinematica',
    context: 'Un mototaxista de Turbo frena en línea recta al ver a un peatón. Un estudiante registró su velocidad cada segundo desde que empezó a frenar.',
    table: { caption: 'Velocidad del mototaxi durante el frenado', headers: ['t (s)', '0', '1', '2', '3', '4'], rows: [['v (m/s)', 10, 7.5, 5, 2.5, 0]] },
    stem: '¿Qué distancia recorrió el mototaxi desde que empezó a frenar hasta detenerse?',
    options: [
      { id: 'a', text: '40 m, porque recorrió 10 m/s durante 4 s.', feedback: 'Eso supone que mantuvo 10 m/s todo el tiempo; como la velocidad bajó de manera uniforme, debe usarse la velocidad media (5 m/s).' },
      { id: 'b', text: '20 m, porque es el área bajo la gráfica v–t (un triángulo de base 4 s y altura 10 m/s).', feedback: 'Correcto: d = ½·4 s·10 m/s = 20 m, que también es la velocidad media (5 m/s) por el tiempo (4 s).' },
      { id: 'c', text: '2,5 m, porque la velocidad baja 2,5 m/s cada segundo.', feedback: '2,5 m/s² es la magnitud de la aceleración de frenado, no una distancia; la distancia es el área bajo la gráfica v–t.' },
      { id: 'd', text: '0 m, porque al final la velocidad es cero.', feedback: 'Que termine en reposo no significa que no se haya movido: mientras frenaba seguía avanzando.' },
    ],
    correct: 'b',
    explanation: 'La velocidad disminuye 2,5 m/s cada segundo (aceleración constante de −2,5 m/s²). El desplazamiento es el área bajo la gráfica v–t: ½·(4 s)·(10 m/s) = 20 m, igual a v₀²/(2|a|) = 100/5 = 20 m.',
    review: 'En la práctica de cinemática, frena desde 8 m/s con −2 m/s² y compara la distancia con el área bajo la gráfica v–t.',
  },
  {
    id: 'saber-sel-1', grade: 9, topic: 'Evolución', competency: 'indagacion', component: 'biologico', skill: 'Identificar las condiciones necesarias para un cambio a partir de ensayos controlados', difficulty: 'media', practiceId: 'seleccion',
    context: 'Unos estudiantes simularon durante 10 generaciones una población de escarabajos de color claro (color medio 0,30, en una escala de 0 claro a 1 oscuro) que vive sobre un suelo volcánico oscuro. En todos los ensayos la variación del color fue la misma.',
    table: {
      caption: 'Cambio del color medio después de 10 generaciones',
      headers: ['Ensayo', 'Heredabilidad h²', 'Depredación por aves (%)', 'Cambio del color medio'],
      rows: [[1, '0', 60, '0,000'], [2, '0,5', 60, '0,157'], [3, '1,0', 60, '0,293'], [4, '0,5', 0, '0,000']],
    },
    stem: '¿Qué conclusión se apoya en estos datos?',
    options: [
      { id: 'a', text: 'Basta con que las aves cacen escarabajos para que la población se oscurezca.', feedback: 'El ensayo 1 tiene depredación pero, con heredabilidad 0, el color medio no cambió.' },
      { id: 'b', text: 'Basta con que el color sea heredable para que la población se oscurezca.', feedback: 'El ensayo 4 tiene heredabilidad 0,5 pero, sin depredación (sin selección), no hubo cambio.' },
      { id: 'c', text: 'La población solo cambió cuando hubo a la vez depredación según el color y herencia del color, y cambió más cuanto mayor fue la heredabilidad.', feedback: 'Correcto.' },
      { id: 'd', text: 'Los escarabajos se oscurecieron porque el suelo oscuro les cambió el color durante su vida.', feedback: 'Si el suelo cambiara el color de cada individuo, los ensayos 1 y 4 también mostrarían cambio; los datos muestran que el cambio depende de la selección y la herencia.' },
    ],
    correct: 'c',
    explanation: 'Los ensayos 1, 2 y 3 solo difieren en h²: el cambio aumenta con la heredabilidad y es cero si h² = 0. Los ensayos 2 y 4 solo difieren en la depredación: sin selección no hay cambio. La evolución por selección natural necesita variación, supervivencia diferencial y herencia (R = h²·S).',
    review: 'En la práctica de selección natural, cambia una sola variable por ensayo y compara el cambio del color medio.',
    transfer: 'Si un insecticida mata más a los insectos con poca cutícula, ¿qué información necesitarías para predecir si la población se volverá resistente?',
  },
  {
    id: 'saber-tpp-1', grade: 9, topic: 'Trabajo y potencia', competency: 'indagacion', component: 'fisico', skill: 'Analizar datos para diferenciar trabajo y potencia', difficulty: 'media', practiceId: 'trabajo',
    context: 'En un colegio de Apartadó, cuatro estudiantes subieron corriendo o caminando la misma escalera hasta el segundo piso (altura: 3,06 m). Se midió la masa de cada uno con una báscula y el tiempo con un cronómetro (datos simulados; g = 9,8 m/s²).',
    table: {
      caption: 'Subida de la escalera del colegio (h = 3,06 m)',
      headers: ['Estudiante', 'Masa (kg)', 'Tiempo (s)'],
      rows: [['Ana', 45, '6,0'], ['Luis', 60, '10,0'], ['Sofía', 52, '7,5'], ['Juan', 70, '16,0']],
    },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'Juan desarrolló la mayor potencia, porque es el de mayor masa y por eso hizo más trabajo.', feedback: 'Juan sí hizo el mayor trabajo (70 · 9,8 · 3,06 ≈ 2 099 J), pero tardó 16 s: su potencia es la menor (≈ 131 W). La potencia depende también del tiempo.' },
      { id: 'b', text: 'Todos desarrollaron la misma potencia, porque subieron la misma altura.', feedback: 'La altura es la misma, pero cambian la masa y el tiempo; las potencias van de unos 131 W a unos 225 W.' },
      { id: 'c', text: 'Juan hizo el mayor trabajo, pero Ana desarrolló la mayor potencia, porque fue quien hizo más trabajo por cada segundo.', feedback: 'Correcto.' },
      { id: 'd', text: 'Ana hizo el mayor trabajo, porque fue la más rápida.', feedback: 'El trabajo para subir el cuerpo es m·g·h y no depende de la rapidez: Ana, con la menor masa, hizo el menor trabajo (≈ 1 349 J). La rapidez influye en la potencia, no en el trabajo.' },
    ],
    correct: 'c',
    explanation: 'Trabajo W = m·g·h: Ana ≈ 1 349 J, Luis ≈ 1 799 J, Sofía ≈ 1 559 J, Juan ≈ 2 099 J. Potencia P = W/t: Ana ≈ 225 W, Luis ≈ 180 W, Sofía ≈ 208 W, Juan ≈ 131 W. Quien hace más trabajo no es necesariamente quien desarrolla más potencia: la potencia mide qué tan rápido se hace el trabajo.',
    review: 'En la práctica de trabajo y potencia, usa el reto de la escalera: cambia solo la masa y luego solo el ritmo, y compara el trabajo y la potencia.',
  },
  {
    id: 'saber-mlr-1', grade: 9, topic: 'El mol y la masa molar', competency: 'indagacion', component: 'quimico', skill: 'Comparar cantidades de sustancia y de átomos en masas iguales de sustancias distintas', difficulty: 'media', practiceId: 'mol',
    context: 'En un colegio de Chigorodó, un grupo pesó 10,00 g de cuatro sustancias y calculó, con las masas atómicas estándar, la masa molar y la cantidad de sustancia de cada una (datos calculados).',
    table: {
      caption: 'Muestras de 10,00 g',
      headers: ['Sustancia', 'Fórmula', 'Masa molar (g/mol)', 'Cantidad de sustancia (mol)', 'Átomos por fórmula'],
      rows: [
        ['Agua', 'H₂O', '18,015', '0,5551', 3],
        ['Sal de cocina', 'NaCl', '58,44', '0,1711', 2],
        ['Azúcar (sacarosa)', 'C₁₂H₂₂O₁₁', '342,30', '0,02921', 45],
        ['Hierro', 'Fe', '55,845', '0,1791', 1],
      ],
    },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'Como las cuatro muestras tienen la misma masa, todas tienen el mismo número de partículas.', feedback: 'A igual masa, la cantidad de sustancia es n = m/M: cambia con la masa molar, y por eso la tabla muestra moles distintos.' },
      { id: 'b', text: 'La sacarosa tiene más moléculas que las demás porque su masa molar es la mayor.', feedback: 'Es al revés: con la masa fija, cuanto mayor es M, menos moles hay (n = m/M). La sacarosa es la que tiene menos entidades.' },
      { id: 'c', text: 'El agua tiene la mayor cantidad de moléculas y de átomos; la sacarosa tiene menos moléculas que la sal, pero más átomos, porque cada molécula tiene 45 átomos.', feedback: 'Correcto: los átomos son n × N_A × (átomos por fórmula): 0,02921 × 45 ≈ 1,31 mol de átomos en la sacarosa frente a 0,1711 × 2 ≈ 0,34 mol en la sal, y 0,5551 × 3 ≈ 1,67 mol en el agua.' },
      { id: 'd', text: 'El hierro tiene más átomos que el agua porque es un metal y los metales son más densos.', feedback: 'La densidad no interviene: con 10 g hay 0,1791 mol de átomos de hierro, mientras que el agua tiene 0,5551 × 3 ≈ 1,67 mol de átomos.' },
    ],
    correct: 'c',
    explanation: 'La cantidad de sustancia es n = m/M, así que con la misma masa hay menos moles de la sustancia de mayor masa molar. Para comparar átomos se multiplica por los átomos de cada fórmula: agua 1,665 mol de átomos, sacarosa 1,315, sal 0,342 y hierro 0,179. Multiplicando por N_A = 6,022 × 10²³ mol⁻¹, el agua tiene unos 1,00 × 10²⁴ átomos.',
    review: 'En la práctica de cálculos estequiométricos básicos, pesa masas parecidas de agua, sal, azúcar y una puntilla y compara la tabla de átomos de cada elemento.',
  },
  {
    id: 'saber-enl-1', grade: 9, topic: 'Enlace químico y propiedades', competency: 'explicacion', component: 'quimico',
    skill: 'Explicar la conductividad de disoluciones con el tipo de enlace', difficulty: 'media', practiceId: 'enlace-quimico',
    context: 'En una feria de ciencias de Turbo, un grupo armó un circuito con una pila, un LED y dos clavos sumergidos en vasos con distintas mezclas de agua destilada.',
    table: {
      caption: 'Resultado de las pruebas con el LED',
      headers: ['Vaso', 'Contenido', '¿Enciende el LED?'],
      rows: [['1', 'Agua destilada', 'No'], ['2', 'Agua con sal (NaCl)', 'Sí'], ['3', 'Agua con azúcar (sacarosa)', 'No'], ['4', 'Agua con arena de cuarzo (SiO₂)', 'No']],
    },
    stem: '¿Qué explica por qué solo enciende el LED en el vaso 2?',
    options: [
      { id: 'a', text: 'La sal es un compuesto iónico: al disolverse se separa en iones Na⁺ y Cl⁻ que se mueven y transportan la carga; el azúcar se disuelve como moléculas sin carga y la arena no se disuelve.', feedback: 'Correcto: para conducir hacen falta cargas que se muevan.' },
      { id: 'b', text: 'La sal tiene electrones libres como los metales.', feedback: 'Los electrones libres son propios de los metales; en el agua salada la carga la llevan los iones.' },
      { id: 'c', text: 'El azúcar no conduce porque no se disuelve en agua.', feedback: 'El azúcar sí se disuelve (unos 200 g en 100 g de agua), pero sus moléculas no forman iones.' },
      { id: 'd', text: 'La arena no conduce porque su enlace es iónico.', feedback: 'El cuarzo es una red covalente (ΔEN = 1,54 entre dos no metales) y además no se disuelve.' },
    ],
    correct: 'a',
    explanation: 'La conductividad de una mezcla depende de que haya partículas cargadas que se puedan mover. Los compuestos iónicos disueltos liberan iones; las sustancias moleculares se disuelven sin formar iones; las redes covalentes como el cuarzo no se disuelven.',
    review: 'En la práctica «Enlace químico», estación 3, haz la prueba de conductividad con la sal, el azúcar y el cuarzo.',
    transfer: '¿Encendería el LED si se pusiera sal sólida, sin agua, entre los clavos? ¿Y si se fundiera la sal (a 800,7 °C)? Explica.',
  },
  {
    id: 'saber-len-1', grade: 9, topic: 'Lentes y formación de imágenes', competency: 'uso', component: 'fisico',
    skill: 'Usar la ecuación de las lentes para ubicar una imagen', difficulty: 'media', practiceId: 'lentes',
    context: 'En la feria de ciencias del colegio, un grupo construye una cámara oscura con una lupa de f = 20 cm como objetivo y una hoja de papel mantequilla como pantalla. Quieren fotografiar con el celular la imagen de una ventana que está a 2,0 m de la lupa.',
    stem: '¿A qué distancia de la lupa deben poner el papel para ver la imagen nítida y cómo se verá?',
    options: [
      { id: 'a', text: 'A unos 22 cm, invertida y mucho más pequeña que la ventana.', feedback: 'Correcto: 1/d_i = 1/20 − 1/200 → d_i = 22,2 cm; M = −0,11.' },
      { id: 'b', text: 'A 20 cm exactos, derecha y del mismo tamaño.', feedback: 'Solo un objeto muy lejano forma la imagen en el foco, y nunca derecha con una imagen real.' },
      { id: 'c', text: 'A 2,0 m, del mismo tamaño que la ventana.', feedback: 'Eso solo pasa si el objeto está en 2f = 40 cm.' },
      { id: 'd', text: 'En ningún lugar: una lupa no forma imágenes en una pantalla.', feedback: 'Con el objeto más allá del foco, una lupa forma una imagen real.' },
    ],
    correct: 'a',
    explanation: 'Con d_o = 200 cm y f = 20 cm, 1/d_i = 1/20 − 1/200 = 9/200 → d_i = 22,2 cm. El aumento es M = −22,2/200 = −0,11: la imagen es real, invertida y unas nueve veces más pequeña.',
    review: 'En la práctica «Lentes…», usa la lente de +20 cm con la vela lejos y busca la imagen nítida.',
    transfer: 'Si la ventana estuviera a 40 cm de la lupa, ¿dónde iría el papel y de qué tamaño sería la imagen? Compruébalo en el banco óptico.',
  },
];

/** Con la posición de la respuesta correcta repartida entre A–D (ver balance.ts). */
export const BANCO_GRADO_9: Question[] = RAW.map(balanceQuestion);
