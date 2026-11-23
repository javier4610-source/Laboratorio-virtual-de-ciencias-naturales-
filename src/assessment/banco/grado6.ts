import type { Question } from '../../core/types';
import { balanceQuestion } from '../balance';

/**
 * Banco tipo Saber 11: preguntas con grado recomendado 6.º. Son preguntas ORIGINALES de práctica, elaboradas para este
 * laboratorio: NO son preguntas oficiales del ICFES ni reproducen ítems liberados. Cada grado es un archivo aparte para
 * que la página del banco y cada práctica descarguen solo lo que usan (ver ./cargar.ts y docs/v2/RENDIMIENTO.md).
 * Una pregunta nueva va en el archivo de SU grado (una prueba unitaria lo verifica).
 */
const RAW: Question[] = [
  {
    id: 'saber-den-1', grade: 6, topic: 'Densidad y flotación', competency: 'explicacion', component: 'fisico', skill: 'Explicar un fenómeno cotidiano con la densidad', difficulty: 'media', practiceId: 'densidad',
    context: 'En un vaso se vierten con cuidado miel, agua y aceite de cocina. Después de unos minutos se forman tres capas: la miel abajo, el agua en el medio y el aceite arriba.',
    stem: '¿Cuál es la explicación de este orden?',
    options: [
      { id: 'a', text: 'Los líquidos más viscosos siempre quedan abajo.', feedback: 'La viscosidad influye en la rapidez con la que se separan, no en el orden final.' },
      { id: 'b', text: 'Los líquidos se ordenan de mayor a menor densidad, de abajo hacia arriba.', feedback: 'Correcto.' },
      { id: 'c', text: 'El líquido que se vierte primero queda abajo.', feedback: 'El orden final no depende del orden de vertido.' },
      { id: 'd', text: 'El aceite queda arriba porque tiene más masa.', feedback: 'Lo que importa es la masa por unidad de volumen, no la masa total.' },
    ],
    correct: 'b',
    explanation: 'La miel (≈ 1,4 g/cm³) es más densa que el agua (≈ 1,0 g/cm³), y esta más que el aceite (≈ 0,92 g/cm³). Los líquidos inmiscibles se ordenan por densidad.',
    review: 'Práctica de densidad: compara qué materiales flotan en agua.',
    transfer: 'Si dejas caer un cubo de hielo (0,92 g/cm³) en el vaso, ¿en qué capa quedará? Justifica.',
  },
  {
    id: 'saber-den-2', grade: 6, topic: 'Medición', competency: 'indagacion', component: 'fisico', skill: 'Seleccionar un procedimiento de medición', difficulty: 'baja', practiceId: 'densidad',
    context: 'Un grupo necesita calcular la densidad de una piedra de forma irregular.',
    stem: '¿Qué procedimiento les permite obtener el volumen de la piedra?',
    options: [
      { id: 'a', text: 'Medir su largo, ancho y alto con una regla y multiplicarlos.', feedback: 'Ese método solo sirve para cuerpos con forma de prisma.' },
      { id: 'b', text: 'Pesarla dos veces y promediar.', feedback: 'Pesar da la masa, no el volumen.' },
      { id: 'c', text: 'Sumergirla en una probeta con agua y medir cuánto sube el nivel.', feedback: 'Correcto: método de desplazamiento.' },
      { id: 'd', text: 'Compararla con otra piedra de densidad conocida.', feedback: 'Así no se mide su volumen.' },
    ],
    correct: 'c',
    explanation: 'El volumen de un sólido irregular se mide por el agua que desplaza: V = V_final − V_inicial.',
    review: 'Práctica de densidad, pasos 4 y 5.',
  },
  {
    id: 'saber-mez-1', grade: 6, topic: 'Mezclas', competency: 'indagacion', component: 'quimico', skill: 'Diseñar un procedimiento de separación', difficulty: 'media', practiceId: 'mezclas',
    context: 'En una salina artesanal de La Guajira se obtiene sal a partir de agua de mar, que además contiene arena y restos de algas.',
    stem: '¿Cuál procedimiento permite obtener sal más limpia?',
    options: [
      { id: 'a', text: 'Evaporar el agua de mar y luego retirar la arena con la mano.', feedback: 'Después de evaporar, la arena queda mezclada con los cristales de sal.' },
      { id: 'b', text: 'Dejar reposar, filtrar el agua para retirar arena y algas, y luego evaporar.', feedback: 'Correcto: primero se separan los sólidos insolubles y después se recupera lo disuelto.' },
      { id: 'c', text: 'Usar un imán para atraer la sal.', feedback: 'La sal no es magnética.' },
      { id: 'd', text: 'Filtrar para retener la sal en el papel.', feedback: 'La sal disuelta atraviesa el filtro.' },
    ],
    correct: 'b',
    explanation: 'La sal está disuelta: atraviesa el filtro, mientras la arena y las algas quedan retenidas. Al evaporar el agua filtrada se obtiene la sal.',
    review: 'Compara en la práctica de mezclas el orden filtrar → evaporar con el orden inverso.',
  },
  {
    id: 'saber-cel-1', grade: 6, topic: 'La célula', competency: 'indagacion', component: 'biologico', skill: 'Identificar la variable que explica una observación', difficulty: 'media', practiceId: 'celulas',
    context: 'En un colegio de Apartadó, un grupo observó al microscopio células de la mejilla de un compañero. En cada ensayo anotaron el objetivo, la tinción y si lograban ver el núcleo. La imagen estaba enfocada en todos los ensayos.',
    table: { caption: 'Observaciones de células de la mucosa bucal (ocular de 10×)', headers: ['Ensayo', 'Objetivo', 'Tinción', '¿Se ve el núcleo?'], rows: [[1, '10×', 'Ninguna', 'No'], [2, '40×', 'Ninguna', 'No'], [3, '40×', 'Azul de metileno', 'Sí'], [4, '10×', 'Azul de metileno', 'Sí']] },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'El núcleo solo se ve con el objetivo de 40×, porque es muy pequeño.', feedback: 'En el ensayo 4 el núcleo se ve con el objetivo de 10×; y en el ensayo 2, a 40× sin teñir, no se ve.' },
      { id: 'b', text: 'Lo que permite ver el núcleo es la tinción: al comparar los ensayos 2 y 3, solo cambió el colorante.', feedback: 'Correcto.' },
      { id: 'c', text: 'Las células de la mejilla no tienen núcleo, porque en los ensayos 1 y 2 no apareció.', feedback: 'Que no se vea no significa que no exista: en los ensayos 3 y 4 sí se ve, porque el colorante le dio contraste.' },
      { id: 'd', text: 'No se puede concluir nada, porque en los ensayos cambiaron dos variables a la vez.', feedback: 'Los ensayos 1 y 4 (y también 2 y 3) difieren en una sola variable, la tinción, así que sí permiten concluir.' },
    ],
    correct: 'b',
    explanation: 'Para saber qué causa un cambio se comparan ensayos que difieren en una sola variable. Entre 2 y 3 (y entre 1 y 4) solo cambia la tinción y el núcleo pasa de no verse a verse; entre 1 y 2 cambia el aumento y el núcleo sigue sin verse. El núcleo es casi transparente: el azul de metileno le da contraste.',
    review: 'En la práctica del microscopio, observa la mucosa bucal con y sin azul de metileno a distintos aumentos.',
  },
  {
    id: 'saber-red-1', grade: 6, topic: 'Redes alimentarias', competency: 'indagacion', component: 'biologico', skill: 'Interpretar datos de una red trófica y reconocer efectos indirectos', difficulty: 'media', practiceId: 'redes',
    context: 'En un potrero de Urabá, los gavilanes comen ratones y serpientes; las serpientes comen ranas y ratones; los ratones comen semillas y pastos. Durante varios años se cazaron gavilanes y se midió la biomasa de algunas poblaciones.',
    table: {
      caption: 'Biomasa promedio (kg por hectárea) antes y después de la caza de gavilanes',
      headers: ['Población', 'Antes de la caza', 'Después de 30 años de caza intensa'],
      rows: [['Gavilanes', 0.30, 0.03], ['Serpientes', 2.0, 2.5], ['Ratones', 8.0, 9.7], ['Pastos y semillas', 4000, 3680]],
    },
    stem: '¿Qué explicación es coherente con los datos?',
    options: [
      { id: 'a', text: 'Al haber menos gavilanes, sobreviven más ratones y serpientes; los ratones, más numerosos, consumen más pastos y semillas.', feedback: 'Correcto: es un efecto en cascada que baja por la red alimentaria.' },
      { id: 'b', text: 'Los pastos disminuyeron porque los gavilanes se alimentaban de ellos.', feedback: 'Los gavilanes son carnívoros; el pasto bajó por un efecto indirecto, no porque los gavilanes lo comieran.' },
      { id: 'c', text: 'La caza de gavilanes no afecta a las otras poblaciones, porque cada una depende solo de su alimento.', feedback: 'Los datos muestran cambios en todas las poblaciones: en una red, los depredadores también regulan a sus presas.' },
      { id: 'd', text: 'Las serpientes aumentaron porque comen pasto y ahora hay más.', feedback: 'Las serpientes son carnívoras y además el pasto disminuyó; aumentaron porque perdieron a su depredador.' },
    ],
    correct: 'a',
    explanation: 'Quitar al depredador tope libera a sus presas (ratones y serpientes). Más ratones consumen más productores, así que la biomasa de pastos baja: es una cascada trófica.',
    review: 'En la práctica de redes alimentarias, sube la caza de gavilanes y compara la biomasa final con el escenario base.',
  },
  {
    id: 'saber-maq-1', grade: 6, topic: 'Máquinas simples y trabajo', competency: 'indagacion', component: 'fisico', skill: 'Analizar datos para relacionar fuerza, distancia y trabajo en un sistema de poleas', difficulty: 'media', practiceId: 'maquinas',
    context: 'En una finca bananera de Carepa, unos estudiantes subieron un racimo de 30 kg (peso: 294 N) hasta la plataforma de un camión, a 1,2 m de altura, con tres montajes de garruchas. Con un dinamómetro midieron la fuerza y con una cinta métrica la cuerda que tuvieron que jalar (datos simulados).',
    table: {
      caption: 'Subida del racimo 1,2 m con distintos montajes',
      headers: ['Montaje', 'Tramos que sostienen el racimo', 'Fuerza medida (N)', 'Cuerda jalada (m)'],
      rows: [['Polea fija', 1, 300, '1,2'], ['Polea móvil y polea fija', 2, 152, '2,4'], ['Polipasto', 4, 78, '4,8']],
    },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'El polipasto reduce a la cuarta parte el trabajo necesario para subir el racimo, porque la fuerza es cuatro veces menor.', feedback: 'La fuerza baja, pero hay que jalar cuatro veces más cuerda: 78 N · 4,8 m ≈ 374 J, que no es menor que 300 N · 1,2 m = 360 J.' },
      { id: 'b', text: 'La fuerza disminuye casi en proporción al número de tramos, pero la cuerda jalada aumenta en la misma proporción; el trabajo de entrada no disminuye y hasta crece un poco por el rozamiento y el peso de las poleas.', feedback: 'Correcto.' },
      { id: 'c', text: 'Con el polipasto el racimo sube más alto, porque se jala más cuerda.', feedback: 'En los tres montajes el racimo sube lo mismo (1,2 m); la cuerda extra es el precio de usar menos fuerza.' },
      { id: 'd', text: 'Las poleas crean energía, porque con menos fuerza levantan el mismo racimo.', feedback: 'Ninguna máquina crea energía: el trabajo que se hace sobre la cuerda (≈ 360 a 374 J) es mayor que el que recibe el racimo (294 N · 1,2 m ≈ 353 J).' },
    ],
    correct: 'b',
    explanation: 'Trabajo de entrada = F · cuerda jalada: 300 · 1,2 = 360 J; 152 · 2,4 ≈ 365 J; 78 · 4,8 ≈ 374 J. Trabajo útil = 294 N · 1,2 m ≈ 353 J. Las máquinas simples cambian la fuerza por distancia, pero no ahorran trabajo; con más poleas hay más rozamiento y más masa móvil, así que la eficiencia baja un poco (98 %, 97 % y 94 %).',
    review: 'En la práctica de máquinas simples, compara el trabajo de entrada y el de salida con la polea fija, la polea móvil y el polipasto.',
  },
  {
    id: 'saber-cal-1', grade: 6, topic: 'Calor y equilibrio térmico', competency: 'indagacion', component: 'fisico', skill: 'Interpretar una tabla de temperatura contra tiempo para comparar aislantes térmicos', difficulty: 'media', practiceId: 'calor',
    context: 'Para un paseo a Necoclí, unos estudiantes de Apartadó quieren saber qué recipiente conserva mejor fría una bebida. Ponen 300 g de agua de la nevera en un vaso de icopor con tapa y la misma cantidad en una lata de aluminio con tapa, los dejan a la sombra con el aire a 30 °C y miden la temperatura del agua cada 10 minutos.',
    table: {
      caption: 'Temperatura del agua (°C); aire a 30 °C',
      headers: ['Tiempo (min)', '0', '10', '20', '30'],
      rows: [['Vaso de icopor', '8,0', '9,9', '11,5', '13,1'], ['Lata de aluminio', '8,0', '14,3', '18,8', '22,0']],
    },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'La lata enfría menos porque el metal deja escapar el frío del agua más rápido que el icopor.', feedback: 'El frío no es algo que «escapa»: lo que pasa es calor, del aire caliente al agua fría. La lata deja entrar ese calor más rápido.' },
      { id: 'b', text: 'En los dos recipientes el agua gana calor del aire; en la lata lo gana más rápido porque aísla peor, y en ambos la temperatura sube cada vez más despacio a medida que se acerca a 30 °C.', feedback: 'Correcto: la lata sube 6,3; 4,5 y 3,2 °C en cada intervalo (cada vez menos, porque la diferencia con el aire disminuye) y el icopor solo 1,9; 1,6 y 1,6 °C.' },
      { id: 'c', text: 'El icopor fabrica frío, por eso el agua sube menos de temperatura en él.', feedback: 'El icopor no produce frío ni calor: es un aislante que deja pasar muy poco calor porque tiene aire atrapado en sus burbujas.' },
      { id: 'd', text: 'Si se espera suficiente tiempo, el agua de la lata llegará a más de 30 °C porque se sigue calentando.', feedback: 'El calor solo pasa mientras el aire está más caliente que el agua; al llegar a 30 °C se alcanza el equilibrio térmico y la temperatura deja de subir.' },
    ],
    correct: 'b',
    explanation: 'El calor pasa del cuerpo más caliente (aire, 30 °C) al más frío (agua). Según la ley de enfriamiento de Newton, la rapidez es proporcional a la diferencia de temperatura y a qué tan bien conduce el recipiente: por eso cada intervalo la temperatura sube menos, y en el icopor (buen aislante) sube mucho más despacio que en la lata. Ninguna de las dos superará 30 °C.',
    review: 'En la práctica de calor y equilibrio térmico, compara las curvas de temperatura contra tiempo del vaso de icopor y de la lata.',
  },
  {
    id: 'saber-eco-1', grade: 6, topic: 'Oxígeno disuelto y eutrofización en una ciénaga', competency: 'indagacion', component: 'biologico', skill: 'Interpretar datos de oxígeno disuelto a distintas horas y relacionarlos con la fotosíntesis, la respiración y la descomposición', difficulty: 'media', practiceId: 'ecosistema',
    context: 'Estudiantes de Turbo midieron el oxígeno disuelto en dos sitios de una ciénaga del golfo de Urabá (datos simulados): el sitio A, rodeado de manglar conservado, y el sitio B, cerca de la descarga de aguas residuales de un caserío, donde el agua es verde por la cantidad de algas. Al amanecer encontraron peces muertos flotando en el sitio B.',
    table: {
      caption: 'Oxígeno disuelto (mg/L) medido con un oxímetro',
      headers: ['Sitio', '6:00 (amanecer)', '15:00 (tarde)', 'Aspecto del agua'],
      rows: [['A: manglar conservado', '4,8', '7,1', 'transparente'], ['B: cerca de la descarga', '0,9', '13,4', 'verde (muchas algas)']],
    },
    stem: '¿Qué explicación es coherente con los datos?',
    options: [
      { id: 'a', text: 'En el sitio B el agua tiene más oxígeno, así que los peces murieron por otra causa que no tiene que ver con el oxígeno.', feedback: 'El oxígeno del sitio B es alto solo en la tarde. Al amanecer cae a 0,9 mg/L, muy por debajo de lo que necesitan los peces (unos 2 a 3 mg/L).' },
      { id: 'b', text: 'Los nutrientes de las aguas residuales hicieron crecer muchas algas: de día su fotosíntesis produce mucho oxígeno, pero de noche las algas, los animales y los descomponedores solo respiran y lo agotan antes del amanecer.', feedback: 'Correcto: la diferencia entre la tarde (13,4) y el amanecer (0,9) muestra mucha fotosíntesis de día y mucha respiración y descomposición de noche; los peces mueren de madrugada.' },
      { id: 'c', text: 'En el sitio A el manglar consume todo el oxígeno con su respiración, por eso tiene menos oxígeno que el sitio B en la tarde.', feedback: 'El sitio A nunca baja a niveles peligrosos: su oxígeno varía poco porque no hay exceso de algas ni de materia orgánica. Tener menos oxígeno en la tarde no lo hace un sitio peor.' },
      { id: 'd', text: 'Las algas del sitio B respiran solo de noche y hacen fotosíntesis solo de día, así que no afectan el oxígeno total de la ciénaga.', feedback: 'Las algas respiran día y noche, y cuando hay tantas su efecto es enorme: el oxígeno cambia más de 12 mg/L entre la tarde y el amanecer.' },
    ],
    correct: 'b',
    explanation: 'El exceso de nutrientes (eutrofización) hace proliferar las algas. Con luz, la fotosíntesis supera a la respiración y el agua llega a estar sobresaturada de oxígeno; de noche no hay fotosíntesis y la respiración de algas, animales y descomponedores (que además descomponen la materia orgánica de las aguas residuales) agota el oxígeno. Por eso el valor crítico se mide al amanecer, cuando mueren los peces. En el manglar conservado el oxígeno varía mucho menos.',
    review: 'En la práctica del ecosistema en un frasco, elige «Exceso» de alimento y compara el oxígeno al amanecer y a las 18:00 en los días 3, 7 y 14.',
  },
  {
    id: 'saber-mov-1', grade: 6, topic: 'Rapidez media y conversión de unidades', competency: 'indagacion', component: 'fisico', skill: 'Calcular y comparar rapideces medias a partir de una tabla de datos y convertirlas a km/h', difficulty: 'media', practiceId: 'movimiento',
    context: 'Para planear la ruta al colegio, tres estudiantes de Apartadó midieron cuánto tardan en recorrer el mismo tramo de 1,2 km de la vía que llega a la I.E. Campo Alegre. En la zona escolar el límite de velocidad es de 30 km/h.',
    table: {
      caption: 'Tiempo para recorrer el mismo tramo de vía',
      headers: ['Forma de viajar', 'Distancia (m)', 'Tiempo (s)'],
      rows: [['Caminando', '1200', '900'], ['En bicicleta', '1200', '240'], ['En mototaxi', '1200', '100']],
    },
    stem: '¿Qué conclusión se apoya en los datos?',
    options: [
      { id: 'a', text: 'La bicicleta va a 5 m/s (18 km/h) y el mototaxi a 12 m/s (43,2 km/h): el mototaxi supera el límite de la zona escolar.', feedback: 'Correcto: v = d/t; 1200/240 = 5 m/s y 1200/100 = 12 m/s. Al multiplicar por 3,6 se obtienen 18 km/h y 43,2 km/h, más que el límite de 30 km/h.' },
      { id: 'b', text: 'Caminando se va a 0,75 m/s, porque 900 ÷ 1200 = 0,75.', feedback: 'Se dividió el tiempo entre la distancia. La rapidez es distancia entre tiempo: 1200 m / 900 s ≈ 1,33 m/s (unos 4,8 km/h).' },
      { id: 'c', text: 'El mototaxi es el más lento, porque en su fila está el número de segundos más pequeño.', feedback: 'Para la misma distancia, quien tarda menos tiempo va más rápido: el mototaxi, con 100 s, es el más rápido.' },
      { id: 'd', text: 'La bicicleta va a 5 km/h, porque 1200 ÷ 240 = 5.', feedback: 'El cociente 1200 m / 240 s da 5 m/s, no 5 km/h. Para pasar a km/h hay que multiplicar por 3,6: 18 km/h.' },
    ],
    correct: 'a',
    explanation: 'La rapidez media es la distancia dividida entre el tiempo. Caminando: 1200/900 ≈ 1,33 m/s ≈ 4,8 km/h; en bicicleta: 1200/240 = 5 m/s = 18 km/h; en mototaxi: 1200/100 = 12 m/s = 43,2 km/h. Como 1 m/s = 3,6 km/h, solo el mototaxi supera los 30 km/h (8,3 m/s) de la zona escolar.',
    review: 'En la práctica de movimiento, cronometra la bicicleta y el caminante en el mismo tramo y compara la rapidez media en m/s y en km/h.',
  },
  {
    id: 'saber-edm-1', grade: 6, topic: 'Curva de calentamiento y calor latente', competency: 'indagacion', component: 'quimico',
    skill: 'Interpretar una curva de calentamiento con mesetas', difficulty: 'media', practiceId: 'estados-de-la-materia',
    context: 'En la cocina de una finca de Urabá se calientan 500 g de hielo a 0 °C en una estufa que entrega siempre la misma energía por segundo (500 W). Un estudiante anota la temperatura cada dos minutos.',
    table: {
      caption: 'Temperatura del agua con hielo al calentarla (registro del estudiante)',
      headers: ['Tiempo (min)', '0', '2', '4', '6', '8', '10', '12'],
      rows: [['Temperatura (°C)', '0,0', '0,0', '0,0', '6,2', '34,9', '63,6', '92,3']],
    },
    stem: '¿Qué explica que la temperatura se quede en 0 °C durante los primeros minutos?',
    options: [
      { id: 'a', text: 'La estufa todavía no calienta lo suficiente.', feedback: 'La estufa entrega la misma energía desde el principio.' },
      { id: 'b', text: 'Mientras queda hielo, la energía se usa para fundirlo (calor latente) y no para subir la temperatura.', feedback: 'Correcto: es la meseta de fusión.' },
      { id: 'c', text: 'El termómetro tarda en calentarse.', feedback: 'Un termómetro tarda segundos, no varios minutos.' },
      { id: 'd', text: 'El agua con hielo nunca puede pasar de 0 °C.', feedback: 'Cuando se funde todo el hielo, la temperatura sube.' },
    ],
    correct: 'b',
    explanation: 'Durante la fusión coexisten hielo y agua a 0 °C; la energía separa las partículas de la red del hielo (334 J por gramo). Cuando se acaba el hielo, la temperatura sube a razón constante (calor sensible, Q = m·c·ΔT).',
    review: 'En la práctica «Estados de la materia», calienta hielo y pausa en la meseta de fusión.',
    transfer: 'Si se repitiera con el doble de hielo, ¿cuánto duraría la meseta? Compruébalo cambiando la masa en la práctica.',
  },
  {
    id: 'saber-cla-1', grade: 6, topic: 'Clasificación con claves dicotómicas', competency: 'indagacion', component: 'biologico',
    skill: 'Usar caracteres observables para clasificar organismos', difficulty: 'media', practiceId: 'clasificacion-seres-vivos',
    context: 'En una salida de campo a una finca de Apartadó, un grupo de 6.º anota lo que observa en cuatro organismos.',
    table: {
      caption: 'Observaciones del grupo',
      headers: ['Organismo', '¿Células con núcleo?', '¿Hace fotosíntesis?', '¿Pared de quitina y absorbe su alimento?', '¿Tiene columna vertebral?'],
      rows: [['W', 'Sí', 'Sí', 'No', 'No'], ['X', 'Sí', 'No', 'Sí', 'No'], ['Y', 'Sí', 'No', 'No', 'Sí'], ['Z', 'No', 'No', 'No', 'No']],
    },
    stem: '¿Qué clasificación es coherente con las observaciones?',
    options: [
      { id: 'a', text: 'W es un hongo, X una planta, Y un animal y Z un protista.', feedback: 'W hace fotosíntesis (planta) y Z no tiene núcleo (no es un protista).' },
      { id: 'b', text: 'W es una planta, X un hongo, Y un animal vertebrado y Z un procariota (bacteria o arquea).', feedback: 'Correcto.' },
      { id: 'c', text: 'Los cuatro son animales porque viven en la finca.', feedback: 'El lugar no define el reino.' },
      { id: 'd', text: 'Z es un animal invertebrado porque no tiene columna vertebral.', feedback: 'Z no tiene núcleo: es un procariota, no un animal.' },
    ],
    correct: 'b',
    explanation: 'Sin núcleo: dominio Bacteria o Archaea (Z). Con núcleo y fotosíntesis: planta (W). Con pared de quitina y nutrición por absorción: hongo (X), como el de la sigatoka negra. Con columna vertebral: animal vertebrado (Y). Para saber si Z es bacteria o arquea hace falta analizar su ARN ribosómico.',
    review: 'En la práctica «Clasificación de los seres vivos…», recorre la clave de dominios y reinos con un organismo de cada reino.',
    transfer: '¿Qué carácter agregarías a la tabla para decidir si Y es un pez, un anfibio, un reptil, un ave o un mamífero? Compruébalo con la clave de animales.',
  },
];

/** Con la posición de la respuesta correcta repartida entre A–D (ver balance.ts). */
export const BANCO_GRADO_6: Question[] = RAW.map(balanceQuestion);
