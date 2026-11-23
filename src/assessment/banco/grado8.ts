import type { Question } from '../../core/types';
import { balanceQuestion } from '../balance';

/**
 * Banco tipo Saber 11: preguntas con grado recomendado 8.º. Son preguntas ORIGINALES de práctica, elaboradas para este
 * laboratorio: NO son preguntas oficiales del ICFES ni reproducen ítems liberados. Cada grado es un archivo aparte para
 * que la página del banco y cada práctica descarguen solo lo que usan (ver ./cargar.ts y docs/v2/RENDIMIENTO.md).
 * Una pregunta nueva va en el archivo de SU grado (una prueba unitaria lo verifica).
 */
const RAW: Question[] = [
  {
    id: 'saber-men-1', grade: 8, topic: 'Genética', competency: 'uso', component: 'biologico', skill: 'Aplicar probabilidades en la herencia', difficulty: 'media', practiceId: 'mendel',
    context: 'El albinismo oculocutáneo tipo 1 se hereda como carácter autosómico recesivo. Una pareja con pigmentación normal tiene un hijo con albinismo.',
    stem: '¿Cuál es la probabilidad de que su siguiente hijo también tenga albinismo?',
    options: [
      { id: 'a', text: '0, porque ya tuvieron un hijo con albinismo.', feedback: 'Cada fecundación es independiente: la probabilidad no cambia con los hijos anteriores.' },
      { id: 'b', text: '1/4', feedback: 'Correcto: ambos padres deben ser heterocigotos (Aa × Aa).' },
      { id: 'c', text: '1/2', feedback: '1/2 es la probabilidad de que un hijo sea portador heterocigoto.' },
      { id: 'd', text: '3/4', feedback: '3/4 es la probabilidad de pigmentación normal.' },
    ],
    correct: 'b',
    explanation: 'Si dos personas sin albinismo tienen un hijo aa, ambas son Aa. Para cada hijo, P(aa) = 1/2 × 1/2 = 1/4, independientemente de los hijos anteriores.',
    review: 'Simula Yy × Yy y observa la fracción del fenotipo recesivo.',
  },
  {
    id: 'saber-men-2', grade: 8, topic: 'Genética', competency: 'indagacion', component: 'biologico', skill: 'Evaluar una conclusión a partir de datos', difficulty: 'alta', practiceId: 'mendel',
    context: 'En un cruce dihíbrido de plantas heterocigotas para dos genes (AaBb × AaBb) se obtuvieron 160 descendientes: 92 con ambos rasgos dominantes, 29 solo con A dominante, 31 solo con B dominante y 8 con ambos recesivos.',
    stem: '¿Qué conclusión es más coherente con los datos?',
    options: [
      { id: 'a', text: 'Los datos son compatibles con la proporción 9:3:3:1 esperada para genes que se transmiten de forma independiente.', feedback: 'Correcto: lo esperado es 90:30:30:10, muy cercano a lo observado.' },
      { id: 'b', text: 'Los genes están ligados porque no se obtuvo exactamente 90:30:30:10.', feedback: 'Pequeñas diferencias son esperables por azar; el ligamiento produciría desviaciones grandes y sistemáticas.' },
      { id: 'c', text: 'Los rasgos dominantes son más frecuentes porque son más fuertes.', feedback: 'Dominancia no significa mayor "fuerza" ni ventaja.' },
      { id: 'd', text: 'Se necesitan exactamente 16 descendientes para comprobar la proporción.', feedback: 'Entre más descendientes, mejor se aprecia la proporción; 16 sería muy poco.' },
    ],
    correct: 'a',
    explanation: 'Con 160 descendientes se esperan 90:30:30:10. Los valores observados (92:29:31:8) son muy cercanos (χ² ≈ 0,5; p > 0,9).',
    review: 'Simula el cruce dihíbrido con N = 160 y compara.',
  },
  {
    id: 'saber-ond-1', grade: 8, topic: 'Ondas', competency: 'explicacion', component: 'fisico', skill: 'Distinguir propiedades de la onda y del medio', difficulty: 'media', practiceId: 'ondas',
    context: 'Durante una tormenta en Urabá, una persona ve el relámpago y 3 segundos después oye el trueno. La luz llega prácticamente al instante.',
    stem: '¿A qué distancia aproximada cayó el rayo (rapidez del sonido ≈ 345 m/s)?',
    options: [
      { id: 'a', text: '115 m', feedback: 'Se dividió la rapidez entre el tiempo; la distancia es rapidez × tiempo.' },
      { id: 'b', text: 'Cerca de 1 km', feedback: 'Correcto: 345 m/s × 3 s ≈ 1035 m.' },
      { id: 'c', text: '3 km', feedback: 'Eso supondría una rapidez del sonido de 1000 m/s.' },
      { id: 'd', text: 'No se puede calcular sin conocer la frecuencia del trueno.', feedback: 'La rapidez del sonido en el aire no depende de su frecuencia.' },
    ],
    correct: 'b',
    explanation: 'd = v·t = 345 m/s × 3 s ≈ 1,0 km. La rapidez depende del medio (aire y su temperatura), no de la frecuencia del sonido.',
    review: 'En la práctica de ondas, comprueba que la rapidez del sonido no cambia con la frecuencia.',
  },
  {
    id: 'saber-opt-1', grade: 8, topic: 'Luz', competency: 'explicacion', component: 'fisico', skill: 'Explicar un fenómeno cotidiano con la refracción', difficulty: 'media', practiceId: 'optica',
    context: 'Una moneda en el fondo de una taza vacía no se ve desde cierta posición. Al llenar la taza con agua, sin mover la cabeza, la moneda aparece.',
    stem: '¿Qué explica este fenómeno?',
    options: [
      { id: 'a', text: 'El agua refleja la luz de la moneda hacia arriba como un espejo.', feedback: 'El fenómeno principal no es la reflexión en la superficie sino el cambio de dirección de la luz que sale.' },
      { id: 'b', text: 'La luz que sale de la moneda se desvía al pasar del agua al aire y llega al ojo.', feedback: 'Correcto: refracción.' },
      { id: 'c', text: 'El agua aumenta el tamaño de la moneda.', feedback: 'El tamaño aparente cambia poco; lo importante es el cambio de dirección.' },
      { id: 'd', text: 'La moneda sube porque flota.', feedback: 'Una moneda metálica no flota.' },
    ],
    correct: 'b',
    explanation: 'Al pasar del agua (n ≈ 1,33) al aire (n ≈ 1,00) la luz se aleja de la normal. Ese cambio de dirección permite que rayos que antes no llegaban al ojo ahora lo hagan.',
    review: 'En la práctica de óptica, observa la refracción del agua al aire.',
  },
  {
    id: 'saber-cms-1', grade: 8, topic: 'Conservación de la masa', competency: 'explicacion', component: 'quimico', skill: 'Explicar cambios de masa según el intercambio de materia con el entorno', difficulty: 'media', practiceId: 'conservacion',
    context: 'En un colegio de Apartadó, un grupo realizó tres reacciones en recipientes abiertos sobre una balanza de 0,01 g y registró la masa de todo lo que estaba sobre el plato.',
    table: {
      caption: 'Masa del sistema antes y después de cada reacción (recipiente abierto)',
      headers: ['Reacción', 'm inicial (g)', 'm final (g)'],
      rows: [
        ['Bicarbonato de sodio + vinagre', '218,50', '217,45'],
        ['Cloruro de calcio + carbonato de sodio (precipitado)', '222,20', '222,20'],
        ['Lana de acero que arde en una cápsula', '43,30', '43,68'],
      ],
    },
    stem: '¿Cuál explicación es coherente con la ley de conservación de la masa?',
    options: [
      { id: 'a', text: 'Solo la segunda reacción cumple la ley; en las otras dos se destruyó o se creó materia.', feedback: 'La ley se cumple en las tres: lo que cambia es si un gas sale o entra del recipiente abierto.' },
      { id: 'b', text: 'En la primera escapó un gas, en la segunda no hubo intercambio de gases y en la tercera el hierro se combinó con oxígeno del aire; en recipientes cerrados las tres masas no cambiarían.', feedback: 'Correcto: la masa total de un sistema cerrado se conserva; en uno abierto cambia lo que entra o sale.' },
      { id: 'c', text: 'La masa aumentó en la tercera porque el calor del fuego tiene masa.', feedback: 'El calor es energía, no materia; el aumento (0,38 g) corresponde al oxígeno que se fijó en el óxido.' },
      { id: 'd', text: 'La masa disminuyó en la primera porque los líquidos pierden masa cuando reaccionan.', feedback: 'Los líquidos no pierden masa por reaccionar; la disminución (1,05 g) es el CO₂ que salió al aire.' },
    ],
    correct: 'b',
    explanation: 'En la primera reacción se forma CO₂ que sale al aire (−1,05 g); en la precipitación todos los productos quedan en el vaso (0,00 g); en la combustión del hierro entra O₂ del aire y queda en el óxido (+0,38 g). Si los tres sistemas estuvieran cerrados, la masa total no cambiaría: los átomos solo se reorganizan.',
    review: 'En la práctica de conservación de la masa, repite las tres reacciones en el sistema abierto y en el frasco sellado.',
  },
  {
    id: 'saber-bal-1', grade: 8, topic: 'Balanceo y conservación de la masa', competency: 'uso', component: 'quimico', skill: 'Usar una ecuación balanceada y la ley de Lavoisier para predecir masas', difficulty: 'media', practiceId: 'balanceo',
    context: 'En una clase de Apartadó se balanceó la ecuación global de la respiración celular, C₆H₁₂O₆ + 6 O₂ → 6 CO₂ + 6 H₂O, y se contaron los átomos de cada lado.',
    table: {
      caption: 'Átomos de cada elemento en la ecuación balanceada',
      headers: ['Elemento', 'Reactivos', 'Productos'],
      rows: [
        ['Carbono (C)', 6, 6],
        ['Hidrógeno (H)', 12, 12],
        ['Oxígeno (O)', 18, 18],
      ],
    },
    stem: 'Si 180 g de glucosa reaccionan por completo con 192 g de oxígeno, ¿qué masa total de dióxido de carbono y agua se forma?',
    options: [
      { id: 'a', text: '180 g, porque los productos vienen de la glucosa.', feedback: 'Los productos también contienen los átomos del oxígeno que reaccionó; su masa debe sumarse a la de la glucosa.' },
      { id: 'b', text: '372 g, porque los átomos de cada elemento son los mismos a los dos lados y la masa total se conserva.', feedback: 'Correcto: 180 g + 192 g = 372 g. Como cada elemento tiene el mismo número de átomos a los dos lados, la masa de los productos es igual a la de los reactivos.' },
      { id: 'c', text: 'Menos de 372 g, porque el CO₂ es un gas y los gases casi no tienen masa.', feedback: 'Los gases tienen masa: 6 mol de CO₂ pesan unos 264 g. Que un producto sea gas no cambia la masa total.' },
      { id: 'd', text: '2 232 g, porque hay que multiplicar la masa por los 6 de cada coeficiente.', feedback: 'Los coeficientes ya están considerados en las masas dadas (192 g son 6 mol de O₂); no se vuelve a multiplicar.' },
    ],
    correct: 'b',
    explanation: 'La tabla muestra que la ecuación está balanceada: 6 C, 12 H y 18 O a cada lado. Por la ley de Lavoisier, la masa de los productos es igual a la de los reactivos: 180 g + 192 g = 372 g (6 CO₂ ≈ 264 g y 6 H₂O ≈ 108 g).',
    review: 'En la práctica de balanceo, balancea la respiración de la glucosa, verifica la ecuación y compara las masas de los dos platos de la balanza.',
  },
  {
    id: 'saber-son-1', grade: 8, topic: 'Resonancia en un tubo y rapidez del sonido', competency: 'indagacion', component: 'fisico', skill: 'Usar datos de resonancias sucesivas para calcular la rapidez del sonido y reconocer el efecto de la corrección de extremo', difficulty: 'alta', practiceId: 'sonido',
    context: 'En un colegio de Carepa, a 30 °C, un grupo sostiene un diapasón de 512 Hz sobre un tubo de vidrio con agua y baja el nivel del agua lentamente. Con un micrófono conectado a un celular registran la amplitud del sonido y encuentran tres máximos (datos simulados).',
    table: {
      caption: 'Longitud de la columna de aire en cada máximo de sonido (diapasón de 512 Hz)',
      headers: ['Máximo', 'Longitud de la columna de aire (cm)'],
      rows: [['Primero', '16,0'], ['Segundo', '50,1'], ['Tercero', '84,2']],
    },
    stem: 'Uno de los estudiantes calcula la rapidez del sonido con v = 4·L₁·f y obtiene unos 328 m/s, menos de lo que dice el libro para 30 °C (≈ 349 m/s). ¿Qué procedimiento con los mismos datos es más adecuado?',
    options: [
      { id: 'a', text: 'Usar v = 4·L₃·f con el tercer máximo, porque la columna más larga se mide con menos error.', feedback: 'El tercer máximo corresponde a cinco cuartos de onda (L₃ + e = 5λ/4), no a un cuarto: 4·L₃·f daría unos 1724 m/s.' },
      { id: 'b', text: 'Usar v = 2·(L₂ − L₁)·f, porque entre dos máximos seguidos la columna crece media longitud de onda y la parte de la onda que queda fuera de la boca se cancela.', feedback: 'Correcto: L₂ − L₁ = 34,1 cm = λ/2, λ = 68,2 cm y v ≈ 0,682 × 512 ≈ 349 m/s; lo mismo da con L₃ − L₂.' },
      { id: 'c', text: 'Repetir con un tubo más ancho, porque así el sonido se oye más fuerte y el cálculo 4·L₁·f queda exacto.', feedback: 'En un tubo más ancho la corrección de extremo (≈ 0,6·r) es mayor, así que 4·L₁·f se aleja aún más del valor real.' },
      { id: 'd', text: 'Promediar las tres longitudes y usar v = 4·L·f con el promedio.', feedback: 'Cada máximo corresponde a un número distinto de cuartos de onda; promediarlos no tiene sentido físico.' },
    ],
    correct: 'b',
    explanation: 'En un tubo cerrado por agua hay resonancia cuando L + e = (2n − 1)·λ/4, donde e ≈ 0,6·r es la corrección del extremo abierto (el vientre de la onda queda un poco por fuera de la boca). Por eso 4·L₁·f subestima la rapidez. La diferencia entre dos resonancias seguidas es exactamente λ/2 y no depende de e: λ = 2·(50,1 − 16,0) cm = 68,2 cm, v = λ·f ≈ 349 m/s, de acuerdo con v = 331,3·√(1 + 30/273,15).',
    review: 'En la práctica de sonido, marca L₁ y L₂ con el diapasón de 512 Hz y compara la rapidez calculada con 4·L₁·f y con 2·(L₂ − L₁)·f.',
  },
  {
    id: 'saber-xad-1', grade: 8, topic: 'Extracción de ADN', competency: 'indagacion', component: 'biologico', skill: 'Identificar comparaciones controladas en una tabla de ensayos y sacar conclusiones válidas sobre la extracción de ADN', difficulty: 'media', practiceId: 'extraccion-adn',
    context: 'Un grupo de Apartadó extrajo ADN con un tampón casero de 100 mL con 10 mL de detergente, machacando 2 min, y comparó la cantidad de precipitado con una escala visual (índice relativo de 0 a 100). Los valores provienen de un modelo calculado del simulador, no de mediciones reales.',
    table: {
      caption: 'Índice de rendimiento de la extracción (modelo calculado)',
      headers: ['Ensayo', 'Material', 'Sal (g)', 'Temperatura del alcohol (°C)', 'Índice (u.a.)'],
      rows: [['1', 'Fresa', '1,5', '25', '21'], ['2', 'Fresa', '1,5', '4', '43'], ['3', 'Fresa', '0', '4', '6'], ['4', 'Cebolla', '0', '−18', '2']],
    },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'Comparando los ensayos 3 y 4, enfriar más el alcohol disminuye el precipitado.', feedback: 'Entre los ensayos 3 y 4 cambiaron dos variables (el material y la temperatura): la comparación no está controlada y no permite atribuir el cambio al alcohol.' },
      { id: 'b', text: 'Comparando los ensayos 1 y 2, el alcohol frío probablemente aumenta el precipitado; y comparando 2 y 3, la sal también lo aumenta.', feedback: 'Correcto: en cada par cambia una sola variable, y en ambos el índice sube con el alcohol frío o con la sal.' },
      { id: 'c', text: 'La sal no influye, porque el ensayo 4 tampoco tiene sal y su índice es parecido al del ensayo 3.', feedback: 'Los ensayos 3 y 4 no tienen sal ninguno de los dos, así que no sirven para evaluar la sal. La comparación 2–3 muestra que quitar la sal bajó el índice de 43 a 6.' },
      { id: 'd', text: 'La cebolla no tiene ADN, porque en el ensayo 4 casi no se observó precipitado.', feedback: 'Todas las células con núcleo tienen ADN. El ensayo 4 se hizo sin sal y con otro material; un precipitado escaso no demuestra ausencia de ADN.' },
    ],
    correct: 'b',
    explanation: 'Una conclusión es válida cuando compara ensayos que difieren en una sola variable. Del 1 al 2 solo cambia la temperatura del alcohol (25 → 4 °C) y el índice sube de 21 a 43: el ADN es menos soluble en alcohol frío. Del 2 al 3 solo se quita la sal y el índice baja de 43 a 6: sin iones Na⁺ que neutralicen los fosfatos, el ADN se agrega mucho menos. El ensayo 4 cambia dos variables a la vez.',
    review: 'En la práctica «Modelo interactivo de ADN y complementariedad», repite la extracción de fresa cambiando solo la sal y luego solo la temperatura del alcohol, y grafica el índice.',
  },
  {
    id: 'saber-ecp-1', grade: 8, topic: 'Energía potencial gravitatoria y energía cinética', competency: 'indagacion', component: 'fisico',
    skill: 'Analizar datos de caída para relacionar la altura con la energía y con la rapidez', difficulty: 'media', practiceId: 'cinetica-potencial',
    context: 'En un semillero de física de Carepa, un grupo soltó desde el reposo un objeto de 0,50 kg desde distintas alturas sobre una fotopuerta, en un montaje donde la resistencia del aire es despreciable. La fotopuerta midió el tiempo que una bandera de 5,00 cm tardó en cruzar el haz y con él calcularon la rapidez (datos simulados; g = 9,81 m/s²).',
    table: {
      caption: 'Caída de un objeto de 0,50 kg (datos simulados)',
      headers: ['Altura h (m)', 'Ep = m·g·h (J)', 'Tiempo de bloqueo (ms)', 'Rapidez v (m/s)'],
      rows: [['1,0', '4,9', '11,29', '4,43'], ['2,0', '9,8', '7,98', '6,27'], ['4,0', '19,6', '5,64', '8,87'], ['8,0', '39,2', '3,99', '12,5']],
    },
    stem: '¿Cuál de las siguientes conclusiones se apoya en los datos?',
    options: [
      { id: 'a', text: 'Al duplicar la altura se duplica la rapidez, porque la energía potencial también se duplica.', feedback: 'La Ep sí se duplica, pero la rapidez pasa de 4,43 a 6,27 m/s: se multiplica por 1,41 ≈ √2, no por 2.' },
      { id: 'b', text: 'Al duplicar la altura se duplican la energía potencial y la energía cinética al llegar, pero la rapidez solo se multiplica por √2 ≈ 1,41, porque la energía cinética depende de v².', feedback: 'Correcto: ½ · 0,50 · 6,27² ≈ 9,8 J = Ep; con el cuádruple de altura (4 m) la rapidez se duplica (8,87 ≈ 2 · 4,43).' },
      { id: 'c', text: 'La rapidez no depende de la altura, porque el tiempo de bloqueo disminuye cuando la altura aumenta.', feedback: 'Que el tiempo de bloqueo disminuya significa justamente que la rapidez aumenta (v = L/Δt).' },
      { id: 'd', text: 'Con un objeto de 1,0 kg, la rapidez desde 2,0 m sería el doble, porque tendría el doble de energía potencial.', feedback: 'Tendría el doble de Ep, pero también necesitaría el doble de energía para cada rapidez: sin aire la masa se cancela y llegaría a 6,27 m/s.' },
    ],
    correct: 'b',
    explanation: 'Sin aire, m·g·h = ½·m·v², de modo que la energía cinética al llegar es proporcional a la altura y la rapidez a √h: v = √(2·g·h). Duplicar h duplica Ep y Ec, pero multiplica v por √2; para duplicar la rapidez hay que cuadruplicar la altura. La masa se cancela.',
    review: 'En la práctica «Energía cinética y energía potencial», estación 2, suelta 1,00 kg desde 1, 2, 4 y 8 m, guarda las caídas y compara la gráfica de Ec frente a Ep.',
    transfer: 'Si repitieran el experimento en Marte (g = 3,71 m/s²), ¿cómo cambiarían la energía potencial y la rapidez desde 8,0 m? Calcúlalas.',
  },
  {
    id: 'saber-tpe-1', grade: 8, topic: 'Propiedades periódicas', competency: 'indagacion', component: 'quimico',
    skill: 'Identificar una tendencia periódica en datos reales y explicarla', difficulty: 'media', practiceId: 'tabla-periodica',
    context: 'Una estudiante de Carepa consultó en PubChem el radio covalente y la primera energía de ionización de los elementos del grupo 2 (metales alcalinotérreos).',
    table: {
      caption: 'Grupo 2: radio covalente (Pyykkö y Atsumi, 2009) y primera energía de ionización (NIST, vía PubChem)',
      headers: ['Elemento', 'Be', 'Mg', 'Ca', 'Sr', 'Ba'],
      rows: [['Radio covalente (pm)', '102', '139', '171', '185', '196'], ['1.ª energía de ionización (eV)', '9,323', '7,646', '6,113', '5,695', '5,212']],
    },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'Al bajar en el grupo el radio aumenta y la energía de ionización disminuye, porque el electrón de valencia está en una capa cada vez más alejada del núcleo.', feedback: 'Correcto: cada período agrega una capa; el electrón de valencia está más lejos y se arranca con menos energía.' },
      { id: 'b', text: 'Al bajar en el grupo el radio aumenta porque aumenta la carga nuclear efectiva.', feedback: 'Una carga nuclear efectiva mayor contraería el átomo; en el grupo Z_ef casi no cambia y lo que crece es el número de capas.' },
      { id: 'c', text: 'El radio y la energía de ionización no están relacionados.', feedback: 'Los datos muestran que cuando el radio crece la energía de ionización baja: hay una relación inversa.' },
      { id: 'd', text: 'El bario tiene la mayor energía de ionización porque tiene más protones.', feedback: 'Tiene más protones, pero su electrón de valencia está en la capa 6, muy apantallado: tiene la menor energía de ionización del grupo.' },
    ],
    correct: 'a',
    explanation: 'En un grupo, cada elemento tiene una capa más que el anterior. Los electrones internos apantallan los protones adicionales y la carga nuclear efectiva sobre el electrón de valencia casi no cambia, pero ese electrón está más lejos: el átomo es más grande y se ioniza con más facilidad.',
    review: 'En la práctica «Tabla periódica», guarda los elementos del grupo 2 y elige la serie «Grupo 2» con las propiedades de radio y de energía de ionización.',
    transfer: 'Predice si el radio del radio (Ra, debajo del bario) será mayor o menor que 196 pm y si su energía de ionización será mayor o menor que 5,212 eV. Compruébalo en la tabla.',
  },
  {
    id: 'saber-mei-1', grade: 8, topic: 'Meiosis y variabilidad genética', competency: 'indagacion', component: 'biologico',
    skill: 'Interpretar datos de cromosomas para comparar la variabilidad que produce la meiosis', difficulty: 'media', practiceId: 'meiosis',
    context: 'Un grupo de 8.º de Necoclí comparó con una calculadora cuántas combinaciones de cromosomas pueden tener los gametos de tres especies, sin contar el entrecruzamiento.',
    table: {
      caption: 'Número de cromosomas (2n) y combinaciones por segregación independiente',
      headers: ['Especie', '2n', 'Combinaciones de gametos'],
      rows: [['Mosca de la fruta', '8', '16'], ['Arveja', '14', '128'], ['Ser humano', '46', '8 388 608']],
    },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'Las combinaciones son el doble del número de cromosomas.', feedback: 'En el ser humano 8 388 608 es mucho más que 2 × 46.' },
      { id: 'b', text: 'Las combinaciones son 2ⁿ, con n = número de pares: cada par agregado duplica la variedad de gametos.', feedback: 'Correcto: 2⁴ = 16, 2⁷ = 128 y 2²³ = 8 388 608.' },
      { id: 'c', text: 'La mosca no tiene variabilidad porque tiene pocos cromosomas.', feedback: 'Tiene 16 combinaciones por segregación y además el entrecruzamiento.' },
      { id: 'd', text: 'Las combinaciones dependen del tamaño del organismo.', feedback: 'Dependen del número de pares de cromosomas, no del tamaño.' },
    ],
    correct: 'b',
    explanation: 'En la metafase I cada par de homólogos se orienta al azar, de forma independiente: con n pares hay 2ⁿ combinaciones. A esto se suma el entrecruzamiento y la unión al azar de dos gametos en la fecundación.',
    review: 'En la práctica «Meiosis, entrecruzamiento y variabilidad genética», usa la calculadora de 2ⁿ con n = 4, 7 y 23.',
    transfer: '¿Cuántas combinaciones tendría un organismo con 2n = 12? ¿Cuántos cigotos distintos podría formar una pareja de esa especie solo por segregación independiente?',
  },
  {
    id: 'saber-ner-1', grade: 8, topic: 'Respuesta voluntaria y reflejo', competency: 'explicacion', component: 'biologico',
    skill: 'Explicar la diferencia de tiempo entre un reflejo y una respuesta voluntaria', difficulty: 'media', practiceId: 'sistema-nervioso',
    context: 'En la clase de ciencias de un colegio de Chigorodó, los estudiantes midieron su tiempo de reacción con una regla que cae y lo compararon con el tiempo de un reflejo de retirada calculado con las velocidades de conducción de los nervios.',
    table: {
      caption: 'Tiempos medidos y calculados',
      headers: ['Respuesta', 'Tiempo'],
      rows: [['Atrapar la regla (media del grupo, t = √(2d/g))', '0,21 s'], ['Reflejo de retirada (cálculo con 0,8 m de recorrido)', '0,066 s']],
    },
    stem: '¿Por qué atrapar la regla tarda unas tres veces más que el reflejo?',
    options: [
      { id: 'a', text: 'Porque los nervios de la mano conducen más lento cuando la persona está atenta.', feedback: 'La velocidad de las fibras no depende de la atención.' },
      { id: 'b', text: 'Porque la respuesta voluntaria necesita que la información llegue al encéfalo, se procese y se decida el movimiento; el reflejo se coordina en la médula espinal.', feedback: 'Correcto: el procesamiento en el encéfalo es la mayor parte del tiempo de reacción.' },
      { id: 'c', text: 'Porque el reflejo usa impulsos más altos que la respuesta voluntaria.', feedback: 'Los potenciales de acción tienen siempre la misma altura (todo o nada).' },
      { id: 'd', text: 'Porque la regla cae más rápido que la mano.', feedback: 'El tiempo de reacción mide cuánto tarda la persona en responder, no la rapidez de la regla.' },
    ],
    correct: 'b',
    explanation: 'En el reflejo la vía es corta (receptor → médula → músculo) y tiene pocas sinapsis. En la respuesta voluntaria, la señal visual va al encéfalo, donde intervienen muchas neuronas y sinapsis antes de enviar la orden a los músculos.',
    review: 'En la práctica «Sistema nervioso: neurona, arco reflejo y tiempo de reacción», compara tu tiempo de reacción con el arco reflejo de la vista 3D.',
    transfer: 'Si el estímulo del reflejo lo detectaran fibras C (1 m/s) en lugar de Aδ, ¿cuánto tardaría el reflejo con 0,8 m de recorrido? ¿Seguiría siendo más rápido que atrapar la regla?',
  },
];

/** Con la posición de la respuesta correcta repartida entre A–D (ver balance.ts). */
export const BANCO_GRADO_8: Question[] = RAW.map(balanceQuestion);
