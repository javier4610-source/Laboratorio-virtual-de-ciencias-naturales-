# Entrega 1 — Bloque A: Biología y organización de los seres vivos (ítems 1–30)

**Archivo de ítems:** `src/assessment/avanzado/bloqueA.ts` (`BLOQUE_A`, ids `SN-A-001` … `SN-A-030`).
**Pruebas de la matriz:** `tests/unit/bloqueA.test.ts`.

> **Carácter del material.** Son ítems originales de práctica tipo Saber 11.°. **No** son preguntas oficiales del ICFES ni están avalados por el ICFES o el MEN. Las afirmaciones y evidencias son **formulaciones operativas propias del banco**, no transcripciones ni códigos oficiales. La distribución por competencias y niveles es una **decisión metodológica** del banco, no la ponderación oficial del examen. El bloque se revisó con criterios técnicos (15 criterios de la sección 13 del encargo), pero **no está validado psicométricamente**: no hubo aplicación piloto, así que no se informan índices de dificultad, discriminación ni funcionamiento de distractores.
>
> **Datos.** Todo dato numérico de los contextos es **ficticio, con fines didácticos**, y así se rotula en el contexto o en la tabla de cada ítem (`simulatedData: true`). Solo se citan dos fuentes externas reales y verificables, únicamente como fundamento conceptual: *Campbell Biology* (Pearson, capítulo «A Tour of the Cell») en el ítem 3 y Lederberg y Lederberg (1952), *Journal of Bacteriology*, 63(3), 399–406, en el ítem 17.
>
> **Limitación.** Durante esta entrega no se consultaron en línea los documentos oficiales del ICFES ni del MEN. La correspondencia con las competencias (uso comprensivo, explicación de fenómenos, indagación) sigue la descripción del encargo; las afirmaciones y evidencias no pretenden reproducir las especificaciones oficiales.

## 1. Matriz del bloque

Recurso «texto» significa que basta con el contexto y el enunciado. Los demás recursos exigen interpretar una tabla, una gráfica (`chart` con ejes, unidades y descripción textual), un esquema (`schemeDescription`), un experimento o un modelo.

| N.º | Id | Tema | Competencia | Afirmación (operativa) | Evidencia (operativa) | Nivel | Contexto | Recurso | Datos ficticios | Clave |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | SN-A-001 | Organización celular: células procariotas y eucariotas | Uso comprensivo | Usa las características estructurales de las células para clasificarlas como procariotas o eucariotas. | Identifica en una tabla de observaciones el rasgo estructural que permite clasificar de forma concluyente una célula como procariota. | 1 | laboratorio | tabla | Sí | **C** |
| 2 | SN-A-002 | Organelos y función: células secretoras de proteínas | Uso comprensivo | Relaciona la estructura de los organelos con la función que cumple un tipo de célula. | Predice qué organelos serán abundantes en una célula a partir de la función que desempeña en el organismo. | 1 | laboratorio | texto | No | **A** |
| 3 | SN-A-003 | Organelos: ruta de las proteínas de secreción | Explicación | Explica el funcionamiento coordinado de los organelos celulares a partir de evidencias experimentales. | Interpreta la secuencia temporal de una marca radiactiva en distintos compartimientos para explicar la ruta de secreción de las proteínas. | 2 | datos-investigacion | grafica | Sí | **B** |
| 4 | SN-A-004 | Membrana y transporte: absorción de iones en raíces | Indagación | Evalúa conclusiones a partir de los resultados de un experimento con varios tratamientos. | Selecciona la conclusión que se sostiene al comparar tratamientos que separan el efecto del oxígeno, de la producción de ATP y de la temperatura sobre el transporte de iones. | 3 | laboratorio | tabla | Sí | **D** |
| 5 | SN-A-005 | Membrana y transporte: relación superficie/volumen y tamaño celular | Explicación | Explica fenómenos biológicos con modelos e identifica qué relaciones del modelo sustentan la explicación. | Calcula la fracción del volumen alcanzada por difusión en cubos de distinto tamaño y la usa para explicar por qué el tamaño de las células es limitado. | 3 | experimento-escolar | modelo | Sí | **B** |
| 6 | SN-A-006 | Fotosíntesis: controles experimentales | Indagación | Identifica los controles experimentales necesarios para poner a prueba una hipótesis. | Selecciona los tratamientos de control que permiten atribuir un resultado a la fotosíntesis y no a otros factores. | 2 | experimento-escolar | experimento | Sí | **C** |
| 7 | SN-A-007 | Respiración celular y fermentación en levaduras | Indagación | Evalúa la validez de conclusiones a partir de datos experimentales comparativos. | Selecciona la conclusión que se sostiene al comparar un cultivo cerrado y uno aireado, y descarta explicaciones refutadas por los datos o por las variables controladas. | 3 | laboratorio | tabla | Sí | **A** |
| 8 | SN-A-008 | Fotosíntesis y respiración en plantas: intercambio de gases | Uso comprensivo | Usa los modelos de fotosíntesis y respiración celular para interpretar intercambios de gases en los seres vivos. | Relaciona el aumento de CO₂ en oscuridad con la respiración continua de la planta y la ausencia de fotosíntesis. | 1 | experimento-escolar | texto | No | **D** |
| 9 | SN-A-009 | División celular: cantidad de ADN en mitosis y meiosis | Uso comprensivo | Usa los modelos de la división celular para interpretar representaciones gráficas. | Identifica el tipo de división celular a partir de los cambios en la cantidad de ADN por célula. | 2 | laboratorio | grafica | Sí | **D** |
| 10 | SN-A-010 | Mitosis: función del huso mitótico | Explicación | Explica las consecuencias de alterar una estructura celular sobre un proceso biológico. | Relaciona la inhibición del huso mitótico con la detención de la separación de las cromátidas observada al microscopio. | 2 | laboratorio | experimento | Sí | **B** |
| 11 | SN-A-011 | Meiosis y variabilidad genética: distribución independiente | Explicación | Explica cómo la meiosis genera variabilidad genética en los gametos. | Usa un esquema de la metafase I para explicar el número de combinaciones de gametos que produce la distribución independiente de dos pares de cromosomas. | 2 | laboratorio | esquema | No | **C** |
| 12 | SN-A-012 | Genética: herencia ligada al sexo | Indagación | Interpreta resultados de cruces experimentales para obtener conclusiones sobre patrones de herencia. | Reconoce, en una tabla de descendencia separada por sexo, que un carácter recesivo se asocia con el sexo de los individuos. | 1 | laboratorio | tabla | Sí | **A** |
| 13 | SN-A-013 | Genética mendeliana: segregación independiente y variación por azar | Indagación | Evalúa si los datos experimentales sustentan o refutan una afirmación, considerando la variación debida al azar. | Compara frecuencias observadas y esperadas en un cruce dihíbrido y juzga si las diferencias justifican rechazar la segregación independiente. | 3 | agricola-ambiental | tabla | Sí | **C** |
| 14 | SN-A-014 | Expresión génica y diferenciación celular | Explicación | Explica la diferenciación celular a partir de la regulación de la expresión génica. | Explica por qué células de un mismo organismo, con el mismo ADN, producen proteínas diferentes. | 1 | datos-investigacion | texto | No | **B** |
| 15 | SN-A-015 | Estructura del ADN: complementariedad de bases | Uso comprensivo | Usa el modelo de la doble hélice para interpretar datos sobre la composición del material genético. | Aplica la regla de apareamiento A–T y G–C para identificar en una tabla la muestra que no corresponde a un ADN de doble cadena. | 2 | datos-investigacion | tabla | Sí | **D** |
| 16 | SN-A-016 | Mutaciones cromosómicas: no disyunción en la meiosis | Explicación | Explica el origen de alteraciones en el número de cromosomas a partir de errores en la meiosis. | Usa un esquema de no disyunción para explicar cómo se origina un cigoto con una trisomía. | 2 | salud-publica | esquema | No | **A** |
| 17 | SN-A-017 | Mutaciones y selección: origen de la resistencia a antibióticos | Indagación | Evalúa qué hipótesis está mejor sustentada por los resultados de un diseño experimental. | Usa los resultados de un experimento de réplica en placa para distinguir entre mutaciones preexistentes y mutaciones inducidas por el antibiótico. | 3 | laboratorio | experimento | Sí | **C** |
| 18 | SN-A-018 | Evolución: selección natural y adaptación | Explicación | Explica cambios en las poblaciones mediante el modelo de selección natural. | Usa la distribución de un rasgo heredable en dos ambientes para identificar la explicación coherente con la selección natural. | 2 | ecosistema-colombiano | grafica | Sí | **B** |
| 19 | SN-A-019 | Adaptación: variación heredable frente a respuesta al ambiente | Indagación | Selecciona procedimientos experimentales que permiten distinguir entre hipótesis alternativas. | Elige un diseño de «jardín común» que separa el efecto del ambiente del efecto de las diferencias heredables entre poblaciones. | 3 | ecosistema-colombiano | texto | No | **B** |
| 20 | SN-A-020 | Clasificación y relaciones evolutivas: lectura de cladogramas | Uso comprensivo | Usa representaciones de relaciones evolutivas para establecer el parentesco entre grupos de organismos. | Interpreta un cladograma para identificar qué grupos comparten un ancestro común más reciente. | 2 | datos-investigacion | esquema | No | **D** |
| 21 | SN-A-021 | Clasificación de los seres vivos: organismos con rasgos mixtos | Uso comprensivo | Usa criterios de clasificación biológica para ubicar organismos en grupos taxonómicos. | Clasifica un organismo a partir de su organización celular y de sus formas de nutrición y de movimiento. | 1 | ecosistema-colombiano | texto | No | **A** |
| 22 | SN-A-022 | Homeostasis: regulación de la glucosa en sangre | Explicación | Explica mecanismos de regulación fisiológica mediante el modelo de retroalimentación negativa. | Relaciona los cambios de la glucosa y la insulina después de una comida con un mecanismo de retroalimentación negativa. | 2 | salud-publica | grafica | Sí | **C** |
| 23 | SN-A-023 | Homeostasis: regulación de la temperatura corporal | Uso comprensivo | Usa conceptos de regulación fisiológica para interpretar las respuestas del organismo ante cambios del ambiente. | Identifica las respuestas fisiológicas que favorecen la pérdida de calor durante el ejercicio en un ambiente cálido. | 1 | cotidiano | texto | No | **D** |
| 24 | SN-A-024 | Sistemas del cuerpo humano: integración respiratoria, circulatoria y renal en la altura | Explicación | Explica respuestas del organismo integrando el funcionamiento de varios sistemas y compara explicaciones con base en evidencias. | Selecciona, entre explicaciones alternativas, la que integra los cambios respiratorios, cardíacos y sanguíneos observados al pasar a vivir en la altura. | 3 | salud-publica | tabla | Sí | **B** |
| 25 | SN-A-025 | Sistema nervioso: arco reflejo | Explicación | Explica el funcionamiento del sistema nervioso a partir de la organización de sus vías. | Explica por qué un reflejo de retirada ocurre antes de la percepción consciente del dolor. | 1 | cotidiano | texto | No | **D** |
| 26 | SN-A-026 | Reproducción en plantas: polinización y formación de frutos | Indagación | Interpreta resultados experimentales para obtener conclusiones sustentadas en los datos. | Compara tratamientos de polinización para concluir sobre el origen del polen necesario para la formación de frutos. | 2 | agricola-ambiental | tabla | Sí | **C** |
| 27 | SN-A-027 | Reproducción humana y desarrollo: origen de los gemelos | Uso comprensivo | Usa conceptos de fecundación y desarrollo embrionario para interpretar situaciones de la reproducción humana. | Relaciona el origen de gemelos de distinto sexo con la fecundación de dos óvulos distintos. | 1 | cotidiano | texto | No | **D** |
| 28 | SN-A-028 | Microorganismos: fermentación láctica | Indagación | Interpreta resultados experimentales con controles para establecer conclusiones sobre procesos biológicos. | Usa un control con cultivo hervido y la comparación entre temperaturas para atribuir el descenso del pH a la actividad de microorganismos vivos. | 2 | experimento-escolar | tabla | Sí | **A** |
| 29 | SN-A-029 | Microorganismos y salud: antibióticos, bacterias y virus | Uso comprensivo | Usa conocimientos sobre la estructura de bacterias y virus para fundamentar decisiones relacionadas con la salud. | Relaciona el modo de acción de los antibióticos con estructuras propias de las bacterias para justificar por qué no son eficaces contra los virus. | 1 | salud-publica | texto | No | **A** |
| 30 | SN-A-030 | Salud desde la evidencia: evaluación de una intervención escolar | Indagación | Evalúa la validez de conclusiones en estudios de salud, distinguiendo asociación de causalidad y reconociendo limitaciones del diseño. | Juzga el alcance de una conclusión sobre el efecto de una intervención a partir de datos de dos colegios que no se asignaron al azar. | 3 | salud-publica | tabla | Sí | **C** |


## 2. Distribución del bloque

### 2.1 Competencia × nivel

| Competencia | Nivel 1 | Nivel 2 | Nivel 3 | Total |
|---|---|---|---|---|
| Uso comprensivo del conocimiento científico | 7 | 3 | 0 | **10** |
| Explicación de fenómenos | 2 | 6 | 2 | **10** |
| Indagación | 1 | 3 | 6 | **10** |
| **Total** | **10** | **12** | **8** | **30** |

Los ítems de nivel 3 se concentran en indagación (evaluar conclusiones, diseños y limitaciones). En los bloques siguientes conviene incluir algún ítem de uso comprensivo de nivel 3 (por ejemplo, comparar modelos) para equilibrar el cruce.

### 2.2 Recursos

| Recurso | Ítems | Cantidad |
|---|---|---|
| Tabla | 1, 4, 7, 12, 13, 15, 24, 26, 28, 30 | 10 |
| Gráfica | 3 (líneas, 3 series), 9 (líneas), 18 (barras agrupadas), 22 (líneas) | 4 |
| Esquema | 11, 16, 20 | 3 |
| Experimento | 6, 10, 17 | 3 |
| Modelo | 5 (cubos de agar, con tabla) | 1 |
| Solo texto | 2, 8, 14, 19, 21, 23, 25, 27, 29 | 9 |

**21 de 30 ítems** exigen interpretar de forma sustantiva datos, representaciones o diseños experimentales (el mínimo del bloque es 8).

### 2.3 Cobertura temática (como máximo 3 ítems por subtema)

| Subtema del bloque A | Ítems |
|---|---|
| Organización celular y tipos de células | 1 |
| Organelos y funciones celulares | 2, 3 |
| Membrana plasmática y transporte | 4, 5 |
| Metabolismo, respiración y fotosíntesis | 6, 7, 8 |
| Mitosis y meiosis | 9, 10, 11 |
| Genética mendeliana y herencia | 12, 13 |
| ADN, ARN, síntesis de proteínas y expresión génica | 14, 15 |
| Mutaciones y variabilidad | 16, 17 (y 11, variabilidad meiótica) |
| Evolución, selección natural y adaptación | 18, 19 |
| Clasificación y relaciones evolutivas | 20, 21 |
| Homeostasis y regulación | 22, 23 |
| Sistemas del cuerpo humano | 24, 25 |
| Reproducción y desarrollo | 26, 27 |
| Microorganismos | 28, 29 |
| Salud desde la evidencia | 30 (y 29, uso de antibióticos) |

## 3. Distribución de claves

| Letra | Ítems | Cantidad |
|---|---|---|
| A | 2, 7, 12, 16, 21, 28, 29 | 7 |
| B | 3, 5, 10, 14, 18, 19, 24 | 7 |
| C | 1, 6, 11, 13, 17, 22, 26, 30 | 8 |
| D | 4, 8, 9, 15, 20, 23, 25, 27 | 8 |

Secuencia: C A B D B C A D D B C A C B D A C B B D A C D B D C D A A C.

- Cada letra aparece entre 6 y 9 veces. La racha más larga es de 2 (8–9: D D; 18–19: B B; 28–29: A A), así que no hay más de 3 claves iguales seguidas.
- No hay un ciclo mecánico. En la revisión del integrador, el validador detectó el ciclo A C D B repetido desde el ítem 21
  (21–30: A C D B A C D B A C); se rompió intercambiando el orden de las opciones en el ítem 25 (clave A → D) y en el
  ítem 28 (clave B → A), sin cambiar su contenido.
- Revisión del integrador, ítem 26: la clave decía «La mayoría de los frutos se forma cuando…», que puede leerse como
  una afirmación sobre el total de frutos; se cambió a «La formación de frutos depende sobre todo de que la flor reciba
  polen de otra planta».
- **Longitud de la clave.** En el primer borrador la clave era la opción más larga en 20 de 30 ítems (pista involuntaria). Se reescribieron opciones en 15 ítems. En la versión final la clave es estrictamente la más larga en 8 de 30 ítems (lo esperable por azar es ≈ 7,5). Su posición por longitud queda así: 9 veces 1.ª (empates incluidos), 7 veces 2.ª, 9 veces 3.ª y 5 veces 4.ª. La prueba unitaria limita a 10 los ítems en que la clave es la opción más larga.

## 4. Registro de revisión (segunda y tercera pasada)

Proceso: (1) primer borrador de los 30 ítems; (2) revisión independiente de cada ítem: precisión científica, intento de refutar la clave, búsqueda de una segunda opción defendible, pistas, ajuste entre nivel y competencia y redundancia con `src/assessment/bank.ts` y con las preguntas de las prácticas; (3) comprobación programática de la matriz (`tests/unit/bloqueA.test.ts`) y de todos los cálculos con un guion auxiliar. El estado final de los 15 criterios es «Cumple» en los 30 ítems; la tabla registra lo que **no** cumplía antes de corregirse.

| N.º | Problema detectado en la revisión | Corrección aplicada |
|---|---|---|
| 1 | La opción A afirmaba que la muestra 4 era «la única con pared y sin cloroplastos», lo cual era falso porque la muestra 1 también lo es. La clave era la opción más larga y repetía literalmente el encabezado «rodeado de membrana». | Se reescribió A. La clave se acortó y se parafraseó («ADN no delimitado por una membrana»). Se añadió «de manera concluyente» al enunciado para que D (tamaño) sea inequívocamente insuficiente. |
| 2 | Pista por convergencia: dos opciones contenían «retículo endoplasmático» y D (centriolos y cilios) era poco plausible. | Se equilibraron los elementos: cada organelo aparece en dos opciones. D pasó a ser «Golgi y lisosomas», una ruta parcial plausible, y C «REL y peroxisomas», un perfil de hepatocito. |
| 3 | La clave era la opción más larga. | Se acortó. Se comprobó que los máximos de la gráfica (3, 20 y 60 min) sustentan una sola ruta. |
| 4 | En el borrador, el K⁺ interno sin O₂ (0,6 mmol/L) superaba la concentración externa (0,5), lo que contradecía la lógica del transporte pasivo. Sin un tratamiento que separara el O₂ del ATP, la opción C (el O₂ transporta el K⁺) no podía refutarse. | Se cambió el valor a 0,4 mmol/L y se incluyó el tratamiento 3 (inhibidor de la producción de ATP con O₂ presente). Ese tratamiento hace el ítem de nivel 3. |
| 5 | La clave era la más larga. Se revisó si D, que usa un dato verdadero (la misma penetración), podía defenderse. | Se reescribió la clave. D queda refutada porque esa misma distancia abastece una fracción decreciente del volumen (93,6 %, 65,7 % y 48,8 %, verificados). |
| 6 | Se comprobó que A (otras especies) y B (más bicarbonato) no funcionan como controles. | Sin cambios. |
| 7 | **Riesgo científico.** *S. cerevisiae* con glucosa abundante fermenta incluso con O₂ (efecto Crabtree), así que la conclusión «sin O₂ → etanol» no es general. Además, B (la levadura murió) no podía refutarse. | No se nombra la especie («una cepa de levadura»). La conclusión se limita a «en este ensayo» y la justificación declara la limitación. Se añadió el conteo final de células, que refuta B. La clave se acortó. |
| 8 | La opción A del borrador («deja de respirar y libera CO₂ almacenado») era internamente contradictoria. La clave era la más larga. | Se reescribió A (CO₂ «acumulado» en las hojas) y se acortó la clave. |
| 9 | Ninguno sustantivo. La clave es la más larga por pocos caracteres. | Se mantuvo para no hacer que la clave nunca sea la más larga. |
| 10 | En el borrador, solo con texto, D (la colchicina acelera la división) no tenía datos que la volvieran plausible. | Se añadieron porcentajes (38 % frente a 4 %) y la ausencia de anafases. D se convierte en un error de interpretación de datos y el ítem pasa a nivel 2. |
| 11 | La opción B tenía el número correcto (4) con una razón incorrecta (el entrecruzamiento) y podía considerarse defendible. | El contexto excluye explícitamente el entrecruzamiento, de modo que B contradice el supuesto del esquema. |
| 12 | El borrador (interpretar un cruce de prueba) era redundante con la pregunta «Cruce de prueba» de la práctica `mendel`. | Se sustituyó por herencia ligada al sexo con una tabla desagregada. C (3 : 1 global) es plausible, pero se refuta al separar los datos por sexo. |
| 13 | Se verificó que la clave no depende de saber calcular χ² (bastan diferencias de 2–3 granos en 500), para mantener el nivel adecuado a la educación media. | Cálculos verificados (χ² ≈ 0,39 < 7,81). El χ² aparece solo como extensión en la justificación. |
| 14 | La clave era la más larga. «Todas las células conservan el genoma» tiene excepciones (eritrocitos sin núcleo, reordenamientos en linfocitos). | Se acortó la clave y la justificación dice «la gran mayoría de las células». |
| 15 | La clave era la más larga. | Se reescribió. Se comprobó que C (diferencias de 0,4 y 0,2 puntos) es un error plausible pero atribuible a la medición, y que las sumas dan 100 %. |
| 16 | El borrador (mutación silenciosa frente a desplazamiento del marco de lectura) era redundante con las preguntas `adn-2` y `adn-3` de la práctica `adn`. En la nueva versión, un distractor (dos gametos n − 1) era absurdo. | Se sustituyó por la no disyunción en la meiosis. D quedó como confusión entre n − 1 y n + 1. El lenguaje sobre la trisomía 21 es neutro y no estigmatizante. |
| 17 | Hubo que comprobar que la fuente citada es real. | Se cita Lederberg y Lederberg (1952), artículo clásico verificable. Los números del ítem son ficticios y están rotulados. |
| 18 | En caracoles existe plasticidad fenotípica (conchas más gruesas inducidas por señales de depredadores), lo que abría una segunda explicación no genética. | El contexto establece que el grosor es «principalmente heredable». La justificación aclara que confirmar la selección exigiría un seguimiento de varias generaciones. |
| 19 | La clave era la más larga. | Se reformuló. La justificación añade la interpretación de un resultado intermedio y la distribución al azar en el invernadero. |
| 20 | Hubo que precisar «alas análogas»: son análogas como superficies de vuelo, aunque las extremidades anteriores son homólogas. | La justificación lo explica con precisión. |
| 21 | El borrador (hongo descomponedor) era redundante con la clasificación de la levadura en la práctica `celulas`. | Se sustituyó por un organismo parecido a *Euglena*, con rasgos mixtos. El enunciado fija el sistema de cinco reinos y la justificación aclara que «protistas» no es un grupo natural. |
| 22 | La clave era la más larga. La palabra «insulina» aparece en el contexto y en la clave. | Se acortó la clave y se alargó A. Se juzgó que «insulina» no es una pista indebida, porque el contexto aporta el dato de la insulina como evidencia que hay que interpretar y A y D también se refieren a la regulación hormonal. El umbral renal (≈ 180 mg/dL) es un valor de texto. |
| 23 | La opción B incluía «que retienen el calor», lo que la delataba como incorrecta. | Se simplificó. |
| 24 | **Error científico del borrador.** La frecuencia respiratoria bajaba a las 4 semanas y la mejora de la saturación se atribuía a los glóbulos rojos. En la aclimatación, la ventilación permanece elevada y la saturación depende de ella, no del número de glóbulos rojos. | Se rehicieron los datos (FR 14 → 18 → 19; FC 68 → 82 → 72; SatO₂ 98 → 91 → 93 %; GR 4,8 → 4,8 → 5,3 millones/µL), la clave (más glóbulos rojos → más O₂ por litro de sangre → menor frecuencia cardíaca) y el distractor C (lectura incompleta de la tabla). Se verificó que el contenido relativo de O₂ (GR × saturación) sube de 4,37 a 4,93. |
| 25 | El distractor D del borrador («las neuronas motoras conducen más rápido que cualquier otra») era en parte verdadero (las fibras motoras Aα conducen más rápido que las nociceptivas C). | Se sustituyó por un error de secuencia inequívoco: la neurona motora no se activa antes que la sensitiva. |
| 26 | Se comprobó que el diseño aísla el efecto de la bolsa (tratamientos 1, 3 y 4). | Sin cambios de contenido. Porcentajes verificados. |
| 27 | En casos extremadamente raros se han descrito gemelos por dispermia (semiidénticos), lo que podría usarse para defender B. | El enunciado pide el «origen más probable» y la explicación de B dice «casi siempre». |
| 28 | La clave era la más larga. | Se acortó. El control con cultivo hervido refuta A y C. |
| 29 | El contexto del borrador mencionaba el mecanismo (pared celular y ribosomas), que se repetía literalmente en la clave. La clave era la más larga. | Se eliminó el mecanismo del contexto. Se equilibraron las longitudes alargando B y D. |
| 30 | La clave era la más larga. | Se acortó. Se evitó la palabra «demuestra» en la clave y se añadió en la justificación el diseño que fortalecería la evidencia. |

**Redundancia.** Se revisaron los temas y las tareas de las preguntas de biología de `src/assessment/bank.ts` (ósmosis de la papa, probabilidad en genética, código genético, anemia falciforme, enzimas, duración del ciclo celular, factor limitante de la fotosíntesis, insecticidas, cociente respiratorio, expresión génica con ARNm, entre otras) y las preguntas de las prácticas biológicas. Hubo tres sustituciones por redundancia (ítems 12, 16 y 21). Los ítems 8 (CO₂ de día y de noche) y 15 (Chargaff) tocan contenidos presentes en el laboratorio, pero con otra tarea: el banco tiene un ítem sobre oxígeno disuelto en una ciénaga y la práctica `extraccion-adn` pide calcular porcentajes, mientras que el ítem 15 pide detectar una cadena sencilla.

## 5. Comprobaciones de cierre de la entrega (sección 16)

1. **Números presentes.** Están los ítems 1 a 30, con ids `SN-A-001` … `SN-A-030` en orden y sin duplicados (verificado por prueba).
2. **Correspondencia con la matriz.** Son 30 ítems: 10 de uso, 10 de explicación y 10 de indagación; 10, 12 y 8 de los niveles 1, 2 y 3; 21 con datos o representaciones (mínimo 8). Las tablas tienen encabezados con unidades y las gráficas tienen ejes con unidad entre paréntesis y descripción textual. Todo verificado por prueba.
3. **Claves y justificaciones revisadas.** Hay una sola clave por ítem, con justificación que muestra el procedimiento y las unidades cuando hay cálculo. Cada distractor tiene su razón (`why`) y el error que lo originaría (`misconception`). Los cálculos se verificaron con un guion auxiliar: ítems 4, 5, 11, 12, 13, 15, 16, 18, 24, 26 y 30.
4. **Sin duplicaciones sustanciales.** No hay duplicados dentro del bloque y, tras las tres sustituciones de la sección 4, tampoco con el banco existente.
5. **Estado de revisión.** Los 30 ítems quedan «Cumple» en los 15 criterios, después de las correcciones de la sección 4. Son material revisado con criterios técnicos y no validado psicométricamente.
6. **Balance global actualizado (entregas terminadas: 1 de 6).**

| Indicador | Acumulado tras la entrega 1 | Meta del banco (180) | Pendiente |
|---|---|---|---|
| Uso comprensivo | 10 | 60 | 50 |
| Explicación de fenómenos | 10 | 60 | 50 |
| Indagación | 10 | 60 | 50 |
| Nivel 1 | 10 | 60 | 50 |
| Nivel 2 | 12 | 72 | 60 |
| Nivel 3 | 8 | 48 | 40 |
| Ítems con datos o representaciones | 21 | ≥ 45 (encargo) / ≥ 48 (6 × 8) | Meta casi alcanzada; mantener al menos 8 por bloque |
| Claves A / B / C / D | 7 / 8 / 8 / 7 | Equilibradas | Las entregas siguientes deben compensar A y D |

Pendientes: entregas 2 (B, ecología), 3 (C, química), 4 (D, física mecánica), 5 (E, electricidad, ondas y energía) y 6 (F, indagación e integración). En todas se mantienen los criterios de esta entrega: matriz 10/10/10 y 10/12/8, datos ficticios rotulados, claves entre 6 y 9 por letra sin rachas de más de 3, y control de la longitud de la clave.

## 6. Dudas científicas declaradas

- **Ítem 7.** La conclusión es válida para los datos ficticios y una cepa no especificada. En levadura de panadería con glucosa abundante habría etanol también en el matraz aireado (efecto Crabtree); la justificación lo advierte.
- **Ítem 24.** Los valores fisiológicos son plausibles, pero simplificados. La aclimatación real varía mucho entre personas, y el volumen de plasma suele disminuir en los primeros días; el contexto lo fija como constante para aislar la variable.
- **Ítem 18.** El ítem depende del supuesto, declarado en el contexto, de que el grosor de la concha es heredable. En la naturaleza también hay respuestas plásticas a los depredadores.
- **Ítem 21.** El sistema de cinco reinos se usa porque es el habitual en la educación media; la sistemática actual no reconoce a los protistas como grupo natural.
- **Ítem 5.** El modelo supone una penetración uniforme de 0,3 cm en todas las caras y en todos los cubos (simplificación didáctica).
- **Ítem 26.** La autoincompatibilidad se menciona como coherente con los datos («algunas especies»), sin afirmar datos reales del cultivo de maracuyá.

- Revisión del integrador (versión 2.13.0), ítem 17: su enunciado era idéntico al del ítem 7 («¿Qué conclusión se sustenta mejor
  en estos resultados?»); se cambió por «¿Cuál de las dos hipótesis apoyan los resultados de la réplica en placa?», que
  además nombra la tarea. Las opciones y la clave no cambian.
