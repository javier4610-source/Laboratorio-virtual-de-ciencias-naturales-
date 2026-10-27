# Entrega 4 — Bloque D: Física y fenómenos mecánicos (ítems 91–120)

**Archivo de ítems:** `src/assessment/avanzado/bloqueD.ts` (`BLOQUE_D`, ids `SN-D-091` … `SN-D-120`), registrado en `src/assessment/avanzado/bloques.ts` después de `BLOQUE_C`.
**Pruebas de la matriz:** `tests/unit/bloqueD.test.ts`.

> **Carácter del material.** Son ítems originales de práctica tipo Saber 11.°. **No** son preguntas oficiales del ICFES ni están avalados por el ICFES o el MEN. Las afirmaciones y evidencias son **formulaciones operativas propias del banco**, no transcripciones ni códigos oficiales. La distribución por competencias y niveles es una **decisión metodológica** del banco, no la ponderación oficial del examen. El bloque se revisó con criterios técnicos (15 criterios de la sección 13 del encargo), pero **no está validado psicométricamente**: no hubo aplicación piloto, así que no se informan índices de dificultad, discriminación ni funcionamiento de distractores.
>
> **Datos.** Los datos de 15 ítems (92, 93, 94, 96, 99, 102, 103, 105, 106, 110, 112, 113, 116, 119 y 120) son **ficticios, con fines didácticos**, y así se rotulan en el contexto o en la tabla (`simulatedData: true`); varios se calcularon con un modelo físico ideal (96, 103, 113, 116, 119 y 120) y el contexto lo dice. Los demás ítems plantean situaciones hipotéticas con valores supuestos (no presentados como mediciones) o hechos consolidados de manual: rapidez del sonido en el agua (≈ 1 480 m/s) y en el aire (≈ 340 m/s), índice de refracción del acrílico (≈ 1,49). La única fuente externa citada es el *CRC Handbook of Chemistry and Physics* (densidades de referencia del ítem 112), sin URL inventadas. Se usa g = 9,8 m/s², declarado en cada ítem que lo necesita. No se usan datos reales de lugares, empresas ni sistemas de transporte de Colombia: los contextos (bus alimentador, ciclismo, fútbol, obras de construcción, embalses, ciénagas, pesca, tractomulas de montaña) no exigen conocimiento regional.
>
> **Límites con el bloque E.** Para no invadir la entrega 5 (electricidad, magnetismo, ondas y energía), el bloque D no incluye carga, circuitos, magnetismo, transferencia de calor ni fuentes de energía. Ondas, sonido y óptica se tratan como fenómenos mecánicos y de óptica geométrica, como los lista el bloque D del encargo (ver sección 6).
>
> **Limitación.** Durante esta entrega no se consultaron en línea los documentos oficiales del ICFES ni del MEN. La correspondencia con las competencias sigue la descripción del encargo.

## 1. Matriz del bloque

Recurso «texto» significa que basta con el contexto y el enunciado. Los demás recursos exigen interpretar una tabla, una gráfica (`chart` con ejes, unidades y descripción textual), un esquema (`schemeDescription`, p. ej. diagramas de cuerpo libre descritos en texto), un experimento o un modelo.

| N.º | Id | Tema | Competencia | Afirmación (operativa) | Evidencia (operativa) | Nivel | Contexto | Recurso | Datos ficticios | Clave |
|---|---|---|---|---|---|---|---|---|---|---|
| 91 | SN-D-091 | Magnitudes físicas y unidades: análisis dimensional de una fórmula | Uso comprensivo | Usa las magnitudes físicas y sus unidades del Sistema Internacional para evaluar la coherencia de expresiones matemáticas. | Identifica, mediante el análisis de unidades, la única expresión que puede representar una distancia a partir de una rapidez y una aceleración. | 1 | cotidiano | texto | No | **C** |
| 92 | SN-D-092 | Movimiento rectilíneo: lectura de una gráfica de posición contra tiempo | Uso comprensivo | Usa las representaciones gráficas del movimiento rectilíneo para describir la rapidez de un móvil en distintos intervalos. | Identifica en una gráfica posición–tiempo el intervalo de mayor rapidez a partir de la pendiente de cada tramo. | 1 | cotidiano | grafica | Sí | **A** |
| 93 | SN-D-093 | Gráficas de velocidad contra tiempo: área, distancia y rapidez media | Uso comprensivo | Usa la relación entre el área bajo la gráfica velocidad–tiempo y el desplazamiento para analizar un movimiento con varias fases. | Calcula la distancia recorrida como el área bajo una gráfica v–t por tramos y obtiene la rapidez media como distancia total entre tiempo total. | 2 | cotidiano | grafica | Sí | **D** |
| 94 | SN-D-094 | Movimiento uniformemente acelerado: análisis de datos de posición | Indagación | Selecciona procedimientos de análisis de datos adecuados para responder una pregunta sobre el tipo de movimiento. | Elige el análisis de distancias en intervalos iguales que permite decidir si la aceleración es constante y estimar su valor. | 2 | laboratorio | tabla | Sí | **B** |
| 95 | SN-D-095 | Modelación matemática del movimiento: encuentro de un bus y una ciclista | Uso comprensivo | Usa modelos matemáticos del movimiento rectilíneo uniforme y uniformemente acelerado para resolver problemas con dos móviles. | Plantea e iguala las ecuaciones de posición de dos móviles para hallar el instante y el lugar del encuentro, y lo distingue del instante en que tienen igual rapidez. | 3 | cotidiano | modelo | No | **B** |
| 96 | SN-D-096 | Velocidad y aceleración: lanzamiento vertical y punto más alto | Explicación | Explica el movimiento de un cuerpo en caída libre a partir de la relación entre velocidad, aceleración y fuerza. | Usa la pendiente constante de una gráfica v–t para refutar la idea de que la aceleración es nula en el punto más alto de un lanzamiento vertical. | 2 | cotidiano | grafica | Sí | **D** |
| 97 | SN-D-097 | Primera ley de Newton: la idea de que el movimiento requiere una fuerza | Explicación | Explica el movimiento de los cuerpos con las leyes de Newton y las distingue de concepciones intuitivas. | Atribuye la detención de un balón a las fuerzas que se oponen a su movimiento y no al agotamiento de una fuerza recibida. | 1 | cotidiano | texto | No | **A** |
| 98 | SN-D-098 | Segunda ley de Newton: fuerza neta a partir de un diagrama de cuerpo libre | Uso comprensivo | Usa la segunda ley de Newton y los diagramas de cuerpo libre para calcular la aceleración de un cuerpo. | Obtiene la fuerza neta sumando con signo las fuerzas de un diagrama de cuerpo libre y la divide entre la masa. | 1 | industrial | esquema | No | **C** |
| 99 | SN-D-099 | Fuerza de rozamiento: control de variables en un experimento | Indagación | Reconoce las comparaciones experimentales que permiten aislar el efecto de una variable. | Selecciona en una tabla los ensayos que difieren solo en el área de contacto para evaluar si esta influye en la fuerza de rozamiento. | 1 | experimento-escolar | tabla | Sí | **D** |
| 100 | SN-D-100 | Tercera ley de Newton: fuerzas entre dos vehículos que aceleran juntos | Explicación | Explica interacciones entre cuerpos con la tercera ley de Newton y la integra con la segunda ley. | Calcula la fuerza de interacción entre dos vehículos, reconoce que es igual en ambos sentidos aunque haya aceleración e identifica la fuerza externa que acelera el sistema. | 3 | cotidiano | texto | No | **A** |
| 101 | SN-D-101 | Equilibrio y diagramas de fuerzas: cuerpo en reposo sobre un plano inclinado | Uso comprensivo | Usa la condición de equilibrio y la descomposición de fuerzas para analizar cuerpos en reposo. | Descompone el peso en componentes paralela y perpendicular a un plano inclinado y determina la magnitud y el sentido del rozamiento estático y de la normal. | 2 | industrial | esquema | No | **B** |
| 102 | SN-D-102 | Leyes de Newton: tensión de un cable en un montacargas | Explicación | Explica la relación entre fuerza neta y cambio de velocidad a partir de datos de un sistema mecánico. | Relaciona las diferencias entre la tensión y el peso con las fases de aceleración, velocidad constante y frenado de un montacargas. | 2 | industrial | tabla | Sí | **C** |
| 103 | SN-D-103 | Fuerzas de resistencia del aire: velocidad terminal y comparación de modelos | Indagación | Evalúa modelos alternativos a partir de la comparación entre sus predicciones y los resultados de un experimento. | Compara la velocidad terminal medida para distintas masas con la que predicen un modelo lineal y uno cuadrático de la fuerza del aire, y reconoce los límites de la conclusión. | 3 | experimento-escolar | grafica | Sí | **A** |
| 104 | SN-D-104 | Potencia mecánica: relación entre potencia, fuerza y velocidad | Explicación | Explica el comportamiento de sistemas mecánicos con la relación entre trabajo, potencia, fuerza y velocidad. | Usa P = F·v con la potencia máxima fija para explicar por qué un vehículo sube una pendiente con menor velocidad constante y descarta explicaciones que confunden fuerza y potencia. | 3 | tecnologico | texto | No | **D** |
| 105 | SN-D-105 | Conservación de la energía con rozamiento: un ciclista en bajada | Indagación | Interpreta datos de energía para evaluar conclusiones sobre la conservación y la transformación de la energía. | Calcula la energía mecánica en varios puntos a partir de una gráfica de barras y decide qué conclusión sobre la energía disipada se apoya en los datos. | 2 | cotidiano | grafica | Sí | **C** |
| 106 | SN-D-106 | Impulso y cantidad de movimiento: gráfica de fuerza contra tiempo | Uso comprensivo | Usa el teorema del impulso y la cantidad de movimiento para analizar interacciones de corta duración. | Calcula el impulso como el área bajo una gráfica fuerza–tiempo y lo relaciona con la velocidad final de un cuerpo. | 2 | cotidiano | grafica | Sí | **B** |
| 107 | SN-D-107 | Impulso: duración de la interacción y fuerza media | Explicación | Explica fenómenos cotidianos con la relación entre impulso, cantidad de movimiento y fuerza media. | Explica por qué alargar el tiempo de frenado de un balón reduce la fuerza sobre las manos con el mismo cambio de cantidad de movimiento. | 1 | cotidiano | texto | No | **D** |
| 108 | SN-D-108 | Conservación de la cantidad de movimiento y de la energía: el salto desde una canoa | Uso comprensivo | Usa los principios de conservación de la cantidad de movimiento y de la energía para analizar interacciones entre cuerpos. | Calcula la velocidad de retroceso de una canoa con la conservación de la cantidad de movimiento y reconoce que la energía cinética del sistema no se conserva en esa interacción. | 3 | cotidiano | texto | No | **A** |
| 109 | SN-D-109 | Densidad y flotación: diseño de una prueba de hipótesis | Indagación | Selecciona procedimientos experimentales que permitan poner a prueba una hipótesis controlando variables de confusión. | Elige el conjunto de objetos en el que solo cambia la masa para poner a prueba la idea de que los objetos pesados se hunden. | 1 | experimento-escolar | experimento | No | **C** |
| 110 | SN-D-110 | Presión hidrostática: presión contra profundidad en un embalse | Indagación | Interpreta datos de presión en fluidos para evaluar conclusiones y reconocer relaciones lineales. | Obtiene de una tabla el aumento de presión por metro, lo relaciona con la densidad del agua y la presión atmosférica del lugar, y descarta conclusiones de proporcionalidad. | 2 | experimento-escolar | tabla | Sí | **B** |
| 111 | SN-D-111 | Principio de Pascal: elevador hidráulico y conservación de la energía | Explicación | Explica el funcionamiento de máquinas hidráulicas con el principio de Pascal y la conservación de la energía. | Relaciona la multiplicación de la fuerza en un elevador hidráulico con el mayor desplazamiento del émbolo pequeño y la igualdad de trabajos de entrada y de salida. | 2 | tecnologico | esquema | No | **A** |
| 112 | SN-D-112 | Densidad y principio de Arquímedes: ¿una figura de oro macizo? | Indagación | Evalúa la validez de conclusiones a partir de mediciones, considerando su incertidumbre y las hipótesis alternativas. | Calcula la densidad media de un objeto con el método de Arquímedes, descarta una hipótesis y reconoce que los datos no permiten identificar el material. | 3 | materiales | tabla | Sí | **D** |
| 113 | SN-D-113 | Movimiento ondulatorio: amplitud, longitud de onda y rapidez en una cuerda | Uso comprensivo | Usa las magnitudes que describen una onda mecánica y la relación v = λ·f para interpretar representaciones de ondas. | Lee la amplitud y la longitud de onda en una gráfica de la forma de una cuerda y calcula la rapidez de propagación con la frecuencia de la fuente. | 1 | experimento-escolar | grafica | Sí | **B** |
| 114 | SN-D-114 | Ondas mecánicas: transporte de energía sin transporte de materia | Explicación | Explica fenómenos ondulatorios con el modelo de onda como perturbación que transporta energía. | Explica que un objeto que flota oscile sin avanzar con las olas porque la onda transporta energía y no el medio. | 1 | cotidiano | texto | No | **C** |
| 115 | SN-D-115 | Sonido: eco y ecosonda en un embalse | Uso comprensivo | Usa las propiedades de propagación del sonido en distintos medios para resolver problemas tecnológicos. | Calcula profundidades a partir de los tiempos de eco de una ecosonda, considerando el recorrido de ida y vuelta y la rapidez del sonido en el agua. | 2 | tecnologico | texto | No | **D** |
| 116 | SN-D-116 | Sonido: tono, intensidad y longitud de la cuerda que vibra | Explicación | Explica las cualidades del sonido a partir de las características de la onda que lo produce. | Relaciona el período y la amplitud de dos registros de presión con el tono y la intensidad, y explica el cambio de frecuencia al acortar la cuerda. | 2 | experimento-escolar | grafica | Sí | **B** |
| 117 | SN-D-117 | Sonido: necesidad de un medio material para su propagación | Indagación | Obtiene conclusiones de un experimento a partir de la variable que se modifica y de las observaciones registradas. | Concluye a partir del experimento de la campana de vacío que el sonido necesita un medio material y descarta conclusiones contradichas por las observaciones. | 1 | laboratorio | experimento | No | **A** |
| 118 | SN-D-118 | Óptica geométrica: altura mínima de un espejo plano | Explicación | Explica la formación de imágenes en espejos planos con la ley de la reflexión y el modelo de rayos. | Usa la ley de la reflexión para mostrar que la parte del espejo necesaria para verse de cuerpo entero es la mitad de la estatura y no depende de la distancia. | 3 | cotidiano | esquema | No | **C** |
| 119 | SN-D-119 | Refracción de la luz: comparación de modelos con datos (ley de Snell) | Indagación | Evalúa modelos alternativos a partir de datos experimentales e identifica qué mediciones permiten distinguirlos. | Calcula y compara las razones i/r y sen i / sen r en una tabla de ángulos para decidir qué modelo de la refracción se ajusta a los datos. | 3 | laboratorio | tabla | Sí | **A** |
| 120 | SN-D-120 | Óptica geométrica: imágenes formadas por una lente convergente | Indagación | Interpreta resultados experimentales con lentes para identificar regularidades y estimar parámetros. | Identifica en una tabla de distancias de objeto e imagen la relación 1/d_o + 1/d_i constante, estima la distancia focal y descarta relaciones no apoyadas por los datos. | 2 | laboratorio | tabla | Sí | **D** |

## 2. Distribución del bloque

### 2.1 Competencia × nivel

| Competencia | Nivel 1 | Nivel 2 | Nivel 3 | Total |
|---|---|---|---|---|
| Uso comprensivo del conocimiento científico | 4 (91, 92, 98, 113) | 4 (93, 101, 106, 115) | 2 (95, 108) | **10** |
| Explicación de fenómenos | 3 (97, 107, 114) | 4 (96, 102, 111, 116) | 3 (100, 104, 118) | **10** |
| Indagación | 3 (99, 109, 117) | 4 (94, 105, 110, 120) | 3 (103, 112, 119) | **10** |
| **Total** | **10** | **12** | **8** | **30** |

El nivel 3 se reparte entre las tres competencias. Los dos de uso comprensivo (95 y 108) son problemas de modelación de varios pasos: encuentro de dos móviles con dos ecuaciones de posición, y conservación de la cantidad de movimiento combinada con el balance de energía cinética. Los de explicación (100, 104 y 118) exigen integrar dos leyes o un razonamiento geométrico general (tercera y segunda ley con dos cuerpos; P = F·v con potencia fija; ley de la reflexión y triángulos semejantes). Los de indagación (103, 112 y 119) piden comparar modelos con datos o reconocer los límites de una conclusión con su incertidumbre.

### 2.2 Recursos

| Recurso | Ítems | Cantidad |
|---|---|---|
| Gráfica | 92 (posición–tiempo), 93 (velocidad–tiempo), 96 (velocidad–tiempo), 103 (velocidad–tiempo, 3 series), 105 (barras agrupadas, 2 series), 106 (fuerza–tiempo), 113 (forma de una onda), 116 (presión–tiempo, 2 series) | 8 |
| Tabla | 94, 99, 102, 110, 112, 119, 120 | 7 |
| Esquema | 98 y 101 (diagramas de cuerpo libre), 111 (elevador hidráulico), 118 (diagrama de rayos) | 4 |
| Experimento | 109 (diseño para probar una hipótesis de flotación), 117 (campana de vacío) | 2 |
| Modelo | 95 (ecuaciones de posición de dos móviles) | 1 |
| Solo texto | 91, 97, 100, 104, 107, 108, 114, 115 | 8 |

**22 de 30 ítems** exigen interpretar de forma sustantiva datos, representaciones, diseños experimentales o modelos (mínimo del bloque: 8; meta pedida para esta entrega: ≈ 15). Cinco gráficas tienen el tiempo en el eje horizontal (posición, velocidad y fuerza contra tiempo; además, presión contra tiempo), y la prueba del bloque lo comprueba. Todas las gráficas tienen ejes con unidad entre paréntesis y una descripción textual con los valores necesarios para responder sin ver el dibujo.

### 2.3 Cobertura temática

| Subtema del bloque D | Ítems |
|---|---|
| Magnitudes físicas y unidades | 91 (análisis dimensional); conversiones y unidades en 92, 106 (ms → s), 110 (kPa, Pa/m) y 111 (cm², N/cm²) |
| Movimiento rectilíneo | 92, 94, 95 |
| Velocidad y aceleración | 94, 96 |
| Gráficas de posición, velocidad y tiempo (pendiente y área) | 92 (pendiente x–t), 93 (área v–t), 96 (pendiente v–t), 103 (velocidad terminal en v–t), 106 (área F–t) |
| Fuerzas y leyes de Newton | 97 (primera ley y la idea de que el movimiento requiere fuerza), 98 (segunda ley), 100 (tercera ley), 102 (fuerza neta y movimiento), 103 (resistencia del aire) |
| Equilibrio y diagramas de fuerzas | 98, 101 (plano inclinado), 102 (fase de velocidad constante) |
| Rozamiento | 99 (control de variables), 101 (rozamiento estático) |
| Trabajo, energía y potencia | 104 (P = F·v), 111 (trabajo de entrada y de salida) |
| Conservación de la energía (con rozamiento) | 105 (y 108, energía cinética que no se conserva) |
| Cantidad de movimiento e impulso | 106 (impulso como área), 107 (fuerza media y duración), 108 (retroceso) |
| Presión y fluidos | 110 (presión hidrostática y atmosférica), 111 (principio de Pascal) |
| Densidad y flotación | 109 (diseño experimental), 112 (principio de Arquímedes y densidad media) |
| Movimiento ondulatorio | 113 (amplitud, λ y v = λ·f en una cuerda), 114 (transporte de energía sin transporte de materia) |
| Sonido | 115 (eco y medio), 116 (tono e intensidad), 117 (medio material) |
| Óptica geométrica | 118 (espejo plano), 119 (refracción, ley de Snell), 120 (lente convergente) |
| Modelación matemática de situaciones mecánicas | 95, 103, 104, 119, 120 |

Concepciones alternativas trabajadas explícitamente en los distractores: el movimiento requiere una fuerza (97, 102), el ímpetu que se agota (96, 97), la aceleración nula cuando v = 0 (96), la acción y la reacción que se anulan o el cuerpo que «gana» que empuja más (100), la normal igual al peso y el rozamiento nulo en reposo (101), «la energía se destruye» (105), confundir cantidad de movimiento con energía (107, 108), los objetos pesados se hunden (109), la presión depende del volumen de agua (110), una máquina multiplica la energía (111), la onda transporta el medio (114), tono e intensidad (116, 117), la imagen de un espejo plano se encoge (118).

## 3. Distribución de claves

| Letra | Ítems | Cantidad |
|---|---|---|
| A | 92, 97, 100, 103, 108, 111, 117, 119 | 8 |
| B | 94, 95, 101, 106, 110, 113, 116 | 7 |
| C | 91, 98, 102, 105, 109, 114, 118 | 7 |
| D | 93, 96, 99, 104, 107, 112, 115, 120 | 8 |

Secuencia (91–120): C A D B B D A C D A B C A D C B D A C B A D B C D B A C A D.

- Cada letra aparece entre 6 y 9 veces. La racha más larga es de 2 (94–95: B B). El bloque C termina en B (ítem 90) y el D empieza en C, así que no hay rachas entre bloques.
- **Ciclo de claves.** `findKeyCycle` no encuentra ciclos (periodos 2, 3 y 4), y los cuartetos consecutivos (CADB, BDAC, DABC, ADCB, DACB, ADBC, DBAC) son todos distintos. En la planificación, la secuencia tenía repetido el cuarteto D A B C (99–102 y 115–118); se corrigió asignando la clave B al ítem 116 y la A al 117 antes de redactar sus opciones.
- **Longitud de la clave.** En el primer borrador la clave era estrictamente la opción más larga en 11 de 30 ítems (93, 94, 95, 100, 103, 104, 105, 108, 111, 112 y 116; la prueba del bloque admite como máximo 10). Se ajustó la redacción de 6 ítems sin cambiar su contenido: 93 (formato uniforme con una cifra decimal: «12,0 m/s»), 94 (clave acortada y distractor D alargado), 100, 103 y 108 (claves acortadas) y 112 (clave acortada y distractor A alargado). Versión final: la clave es estrictamente la más larga en 6 de 30 ítems (91, 95, 104, 105, 111 y 116; 20 %, por debajo de lo esperable por azar, ≈ 7,5). Por longitud, la clave queda 12 veces 1.ª (empates incluidos), 11 veces 2.ª, 4 veces 3.ª y 3 veces 4.ª.

## 4. Registro de revisión (segunda y tercera pasada)

Proceso: (1) matriz y primer borrador de los 30 ítems, con todos los cálculos en un guion auxiliar (`bloqueD-check/calc.py`: cinemática, dinámica, energía, impulso, presión, Arquímedes, ondas, sonido y óptica); (2) revisión independiente de cada ítem: precisión física, intento de refutar la clave buscando una segunda opción defendible, pistas (longitud, repetición literal, precisión diferente), ajuste entre nivel y competencia, redundancia con los bloques A–C, con `src/assessment/bank.ts` y con las preguntas de las prácticas; (3) comprobación programática (`tests/unit/bloqueD.test.ts`, validador del bloque sin errores ni avisos, `npm run banco`, `npx tsc -b`). El estado final de los 15 criterios es «Cumple» en los 30 ítems; la tabla registra lo que no cumplía antes de corregirse y las decisiones de la revisión.

| N.º | Problema detectado en la revisión | Corrección aplicada / decisión |
|---|---|---|
| 91 | El validador marcó «opciones repetidas»: al normalizar el texto, «d = v/(2a)» y «d = v²/(2a)» quedaban iguales (se pierde el exponente). | Cada opción se acompaña de su lectura en palabras («el cuadrado de la rapidez…»), lo que además evita que la diferencia dependa solo de un superíndice. La justificación aclara que el análisis de unidades no comprueba el factor ½. |
| 92 | Riesgo de que el tramo 0–2 min (mayor distancia) se defendiera como «más rápido». | El enunciado pide la mayor rapidez; la justificación calcula las cinco pendientes (36, 0, 60, 18 y 0 km/h). |
| 93 | La clave era la opción más larga por un solo carácter («8,8» frente a «12»). | Formato uniforme con una cifra decimal en las rapideces («12,0 m/s»). C usa un error coherente (triángulo único y promedio 0–12 m/s). |
| 94 | Con datos sin ruido el ítem era trivial; con ruido había que comprobar que el análisis siguiera siendo concluyente. | Se añadió ruido de lectura de ±0,2 cm; las diferencias sucesivas (5,7; 6,5; 5,3; 6,7 cm) y el ajuste por mínimos cuadrados (a = 1,50 m/s²) coinciden. A se refuta con x/t creciente de forma lineal. |
| 95 | Había que asegurar que el instante de igual rapidez (5 s) no fuera defendible y que los números fueran plausibles para un bus. | Se eligió a = 1,2 m/s² (el bus llega a 12 m/s ≈ 43 km/h). La justificación calcula la separación máxima (15 m a los 5 s) y señala que olvidar el ½ también lleva a 5 s. |
| 96 | La gráfica es un modelo y no una medición; sin rótulo, el validador pediría fuente. | Se rotula como datos ficticios calculados con un modelo sin aire. B (fuerza del lanzamiento) y C (la aceleración cambia de signo) son concepciones documentadas en la enseñanza de la mecánica. |
| 97 | D (el peso frena) parecía poco plausible. | Se mantuvo como error de dirección de fuerzas frecuente cuando no se dibuja el diagrama; la justificación precisa que el frenado es por resistencia a la rodadura y del aire. |
| 98 | Ninguno sustantivo. | D (dividir entre el peso en N) se prefirió a una opción de «cero» poco plausible. |
| 99 | Se verificó la coherencia interna de los datos. | F/(m·g) = 0,41 en madera (ensayos 1, 2 y 3) y 0,71 en lija (4 y 5): los datos son coherentes con un coeficiente constante por superficie. |
| 100 | La clave inicial era la opción más larga y podía leerse como que la camioneta no tiene resistencias propias. | Se acortó la clave; la justificación da F_piso = 1 800 N «sin contar sus propias resistencias». C confunde la reacción con el rozamiento de 300 N. |
| 101 | Con cos 30° = 0,866 la normal es 424 N y con 0,87 es 426 N. | El contexto fija cos 30° ≈ 0,87 y las opciones usan «≈ 426 N»; la justificación menciona los dos valores. |
| 102 | Ninguno sustantivo. | Datos coherentes: a = +1,0; 0 y −1,0 m/s², la rapidez llega a 2,0 m/s y vuelve a 0 en 2 s. |
| 103 | En el borrador, el distractor C decía que «la aceleración inicial es mayor con 4 filtros»; con los puntos a 0,1 s (0,78; 0,87 y 0,92 m/s) esa afirmación es **verdadera** para la aceleración media del primer intervalo: había dos opciones defendibles. | C se reescribió como «cuatro veces mayor durante toda la caída», refutada por la gráfica. La clave se acortó y dice «crece casi con v²»; la justificación declara los límites (tres masas, una forma). Las curvas se calcularon con v(t) = v_t·tanh(g·t/v_t). |
| 104 | Las fuerzas de 12 000 N y 30 000 N son supuestos del modelo; se revisó que fueran plausibles para una tractomula de unas 40 t (≈ 7 % de pendiente). | Se declaran como «unos» y la justificación advierte que es un modelo simplificado. A se refuta con el propio contexto (potencia máxima en los dos tramos). |
| 105 | B («se destruyen 38 kJ») tenía el número correcto y podía atraer por eso. | Es incorrecta por el concepto (la energía no se destruye), y la justificación lo explica. Se verificó que 16 m/s es coherente con una velocidad terminal de ≈ 16 m/s en una pendiente del 8 %. Enunciado individualizado para no repetir uno genérico del bloque C. |
| 106 | Riesgo de pista: las opciones son solo números. | Cada distractor corresponde a un error identificable (impulso como velocidad, área de rectángulo, área hasta el máximo). Se verificó la conversión de ms a s. |
| 107 | Ninguno sustantivo. | La clave quedó como la opción más corta; no es una pista sistemática (ver sección 3). |
| 108 | La clave era la opción más larga. | Se acortó. Se verificó que las energías (140 J y 196 J) desmienten C y que D invierte la razón de masas. |
| 109 | El borrador de este número trataba presión en sólidos (ladrillo sobre arena); se cambió por flotación para cubrir «densidad y flotación» con un ítem de diseño experimental. La justificación afirmaba que «esa madera» flota, sin que el contexto lo dijera. | La justificación ahora dice que, sea cual sea la madera, los tres bloques se comportan igual, lo que refuta la idea. A (cubos del mismo tamaño) es una variable de confusión plausible, no un absurdo. |
| 110 | C podía confundirse con la regla correcta «10 m de agua ≈ 1 atm». | C afirma que la presión «se duplica a 10 m… como en cualquier embalse», lo que los datos refutan (173,0 kPa); la justificación explica cuándo vale la regla. Enunciado individualizado. |
| 111 | D mezclaba dos errores. | Se dejó como un único modelo erróneo coherente (la máquina transmite fuerza y desplazamiento sin cambios). Trabajos verificados: 980 J = 980 J. |
| 112 | A (latón) coincide con el valor medido y podía defenderse. | El enunciado pide la conclusión «válida»; la clave descarta el oro macizo y declara que el material no queda identificado (cobre, latón, piezas huecas cerradas o recubiertas). Se calculó el intervalo con la resolución del dinamómetro (7,8–9,6 g/cm³). Se ajustaron longitudes. |
| 113 | Ninguno sustantivo. | Distractores con errores clásicos: pico a pico, media onda, λ/f. |
| 114 | En el borrador el objeto era una boya de pesca, que está atada al hilo: el hilo podía explicar que no avanzara (explicación alternativa no controlada). | Se cambió por una pelota de icopor «suelta». La justificación reconoce el pequeño desplazamiento neto de las partículas de agua. |
| 115 | Ninguno sustantivo. | C corresponde a medir el segundo eco desde el primero (17,8 m). |
| 116 | Clave reasignada (A → B) para romper un cuarteto repetido. | Se verificó que la nota 2 tenga menor amplitud, para que D (más frecuente = más fuerte) sea refutable con la gráfica. |
| 117 | Clave reasignada (B → A). En la realidad el sonido no se apaga del todo. | El contexto dice «cada vez más débil» y la justificación explica la transmisión por los soportes. |
| 118 | La primera descripción del esquema decía dónde se reflejan los rayos («a la mitad de la altura»), lo que regalaba la respuesta. | La descripción solo da la ley de la reflexión y la normal horizontal; el estudiante debe deducir la mitad. |
| 119 | Con los ángulos de refracción redondeados a grados enteros, sen i / sen r variaba entre 1,42 y 1,52 y la comparación entre modelos perdía claridad a ángulos pequeños. | Se dan los ángulos con una cifra decimal: sen i / sen r ≈ 1,49 en todas las filas e i/r de 1,49 a 1,79. Enunciado individualizado. |
| 120 | A (proporcionalidad inversa) debía refutarse con los datos y no solo con la teoría. | d_o·d_i = 720, 532, 450, 400 y 450 cm². Se verificó 1/d_o + 1/d_i = 0,100 cm⁻¹ en todas las filas (40 cm: 0,1002). |

**Redundancia.** Se revisaron las preguntas físicas de `src/assessment/bank.ts`: `saber-den-1` y `saber-den-2` (densidad), `saber-ond-1` (distancia al rayo), `saber-opt-1` (moneda en la taza), `saber-nwt-1` (carrito y control de variables), `saber-ene-1` (energía disipada en un tobogán), `saber-cin-1` (distancia de frenado como área v–t), `saber-pry-1` (proyectiles), `saber-pen-1` (péndulo), `saber-cho-1` (choques en riel de aire), `saber-maq-1` (poleas), `saber-pre-1` (presión atmosférica y altitud), `saber-son-1` (tubo de resonancia), `saber-tpp-1` (trabajo y potencia en una escalera), `saber-flo-1` (calado en agua dulce), `saber-mov-1` (rapidez media) y `saber-ecp-1` (caída y √h). Los cruces y las decisiones: 93 usa el área v–t como `saber-cin-1`, pero con tres fases y la rapidez media (error del promedio de velocidades); 105 comparte el concepto de energía disipada con `saber-ene-1`, pero con datos en varios puntos, la velocidad terminal y el error «la energía se destruye»; 108 comparte con `saber-cho-1` que la energía cinética no se conserva, pero en un retroceso en el que aumenta; 110 trata la presión hidrostática y no la atmosférica de `saber-pre-1`; 112 usa el método de Arquímedes de la práctica de flotación, pero la tarea es evaluar los límites de una conclusión; 115 trata el eco de ida y vuelta y el medio, no la distancia al rayo; 119 compara dos modelos de la refracción, mientras la pregunta de la práctica de óptica obtiene un parámetro de una gráfica. Se descartaron en la planificación un ítem que comparaba el trabajo y la potencia de dos grúas (demasiado cercano a `saber-tpp-1`) y otro de carga máxima de una balsa (cercano a `saber-flo-1` y a la práctica de flotación). Con los bloques A–C no hay contextos ni enunciados repetidos (verificado por prueba, que también exige enunciados distintos dentro del bloque); el único cruce conceptual es el principio de conservación de la energía (B-056), en otro dominio.

## 5. Comprobaciones de cierre de la entrega (sección 16)

1. **Números presentes.** Están los ítems 91 a 120, con ids `SN-D-091` … `SN-D-120` en orden y sin duplicados (verificado por prueba).
2. **Correspondencia con la matriz.** Son 30 ítems: 10 de uso, 10 de explicación y 10 de indagación; 10, 12 y 8 de los niveles 1, 2 y 3, con nivel 3 en las tres competencias (2, 3 y 3); 22 con datos o representaciones (mínimo 8). Verificado por `tests/unit/bloqueD.test.ts` y por el validador (`npm run banco`: 120 ítems, 0 errores; el único aviso es anterior y corresponde al bloque A, ítems 7 y 17; el bloque D no tiene avisos).
3. **Claves y justificaciones revisadas.** Hay una sola clave por ítem, con justificación que muestra el procedimiento y las unidades cuando hay cálculo. Cada distractor tiene su razón (`why`) y el error que lo originaría (`misconception`). Los cálculos de los ítems 92–96, 98–106, 108, 110–113, 115, 116 y 118–120 se verificaron con el guion auxiliar; los demás no tienen cálculos.
4. **Sin duplicaciones sustanciales.** Ni dentro del bloque ni con los bloques A–C ni con el banco existente (sección 4).
5. **Estado de revisión.** Los 30 ítems quedan «Cumple» en los 15 criterios, después de las correcciones de la sección 4. Son material revisado con criterios técnicos y no validado psicométricamente.
6. **Balance global actualizado (entregas terminadas: 1 a 4).**

| Indicador | Bloque A | Bloque B | Bloque C | Bloque D | Acumulado A–D | Meta del banco (180) | Pendiente (E, F) |
|---|---|---|---|---|---|---|---|
| Uso comprensivo | 10 | 10 | 10 | 10 | 40 | 60 | 20 |
| Explicación de fenómenos | 10 | 10 | 10 | 10 | 40 | 60 | 20 |
| Indagación | 10 | 10 | 10 | 10 | 40 | 60 | 20 |
| Nivel 1 | 10 | 10 | 10 | 10 | 40 | 60 | 20 |
| Nivel 2 | 12 | 12 | 12 | 12 | 48 | 72 | 24 |
| Nivel 3 | 8 | 8 | 8 | 8 | 32 | 48 | 16 |
| Ítems con datos o representaciones | 21 | 23 | 23 | 22 | 89 | ≥ 45 (encargo) / ≥ 48 (6 × 8) | Meta del encargo ya superada; mantener al menos 8 por bloque |
| Claves A / B / C / D | 7 / 7 / 8 / 8 | 7 / 8 / 7 / 8 | 8 / 7 / 7 / 8 | 8 / 7 / 7 / 8 | 30 / 29 / 29 / 32 | Equilibradas | E y F pueden compensar un poco la D |
| Uso comprensivo de nivel 3 | 0 | 1 | 2 | 2 | 5 | — | Conviene incluir alguno en E y F |

Pendientes: entregas 5 (E, electricidad, magnetismo, ondas y energía) y 6 (F, indagación e integración). Se mantienen los criterios: matriz 10/10/10 y 10/12/8, datos ficticios rotulados, claves entre 6 y 9 por letra sin rachas de más de 3 ni ciclos, enunciados distintos de los de bloques anteriores y control de la longitud de la clave.

## 6. Dudas científicas declaradas

- **Ítem 97.** El frenado de un balón que rueda se debe sobre todo a la resistencia a la rodadura (deformación del balón y de la grama) y al aire; el análisis detallado de la fuerza de contacto en un cuerpo que rueda excede el nivel. La clave solo afirma que hay fuerzas opuestas al avance.
- **Ítem 99.** Que la fuerza de rozamiento no dependa del área de contacto es una ley empírica aproximada (leyes de Amontons-Coulomb); falla con superficies blandas, adhesivas o muy pulidas. Los datos son ficticios y el ítem solo evalúa el control de variables.
- **Ítem 103.** El modelo F = k·v² describe bien la caída de filtros de café en el aire (número de Reynolds alto), pero los filtros encajados no tienen exactamente la misma forma, y tres masas no bastan para descartar modelos intermedios; la clave dice «crece casi con v²» y la justificación declara los límites. Las curvas son ideales.
- **Ítem 104.** Los valores de fuerza (12 000 N y 30 000 N) y de potencia (300 kW) son supuestos simplificados del orden de una tractomula cargada; en la realidad las resistencias dependen de la velocidad, y el conductor cambia de marcha. El ítem solo usa P = F·v.
- **Ítem 105.** La rapidez de 16 m/s al final de la bajada se eligió cerca de la velocidad terminal estimada para un ciclista en una pendiente del 8 % (área frontal y coeficiente de arrastre típicos); los datos son ficticios.
- **Ítem 110.** La presión atmosférica de 75,0 kPa a unos 2 500 m es un valor aproximado coherente con la atmósfera estándar (≈ 74,7 kPa); no corresponde a ningún embalse real.
- **Ítem 112.** Las densidades de referencia están redondeadas; la del latón varía con su composición (≈ 8,4 a 8,7 g/cm³). El ítem no afirma de qué está hecha la figura.
- **Ítem 114.** En las olas reales las partículas de agua tienen un pequeño desplazamiento neto (deriva de Stokes); por eso el contexto dice que la pelota «casi no se desplaza».
- **Ítem 115.** La rapidez del sonido en agua dulce depende de la temperatura (≈ 1 480 m/s a unos 20 °C); el valor se da en el contexto.
- **Ítem 116.** Las señales son sinusoides ideales; una cuerda real produce armónicos y la forma de onda no es una sinusoide pura. El ítem solo usa el período y la amplitud de la componente dominante.
- **Ítems 113, 116, 118, 119 y 120 frente al bloque E.** El encargo incluye «movimiento ondulatorio», «sonido» y «óptica geométrica» en el bloque D, y «ondas y sus propiedades» y «reflexión y refracción» en el bloque E. El bloque D trata las ondas como fenómeno mecánico (cuerda, olas, sonido) y la óptica como óptica geométrica (espejos, ley de Snell y lentes). Conviene que la entrega 5 evite repetir estas tareas (cálculo de v = λ·f en una cuerda, ley de Snell con datos, espejo plano y lente convergente) y se centre en ondas electromagnéticas, interferencia u otras propiedades.
