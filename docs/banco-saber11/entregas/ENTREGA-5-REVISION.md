# Entrega 5 — Bloque E: Electricidad, magnetismo, ondas y energía (ítems 121–150)

**Archivo de ítems:** `src/assessment/avanzado/bloqueE.ts` (`BLOQUE_E`, ids `SN-E-121` … `SN-E-150`).
**Pruebas de la matriz:** `tests/unit/bloqueE.test.ts`. **Registro:** `src/assessment/avanzado/bloques.ts` (`[BLOQUE_A, BLOQUE_B, BLOQUE_C, BLOQUE_E]`; el bloque D, entrega 4, está en elaboración por separado y se insertará en su lugar).

> **Carácter del material.** Son ítems originales de práctica tipo Saber 11.°. **No** son preguntas oficiales del ICFES ni están avalados por el ICFES o el MEN. Las afirmaciones y evidencias son **formulaciones operativas propias del banco**, no transcripciones ni códigos oficiales. La distribución por competencias y niveles es una **decisión metodológica** del banco, no la ponderación oficial del examen. El bloque se revisó con criterios técnicos (15 criterios de la sección 13 del encargo), pero **no está validado psicométricamente**: no hubo aplicación piloto, así que no se informan índices de dificultad, discriminación ni funcionamiento de distractores.
>
> **Datos.** Todo dato numérico medido u observado en los contextos es **ficticio, con fines didácticos**, y así se rotula en el contexto o en la tabla (`simulatedData: true`, 16 ítems). Las tarifas de energía ($ 850 y $ 800 por kWh en los ítems 132 y 133) y los precios de los bombillos son ficticios; el ítem 132 advierte que las tarifas reales dependen de la empresa y del estrato. Las tres centrales del ítem 149 son hipotéticas y no representan ninguna central real; **no se usan estadísticas oficiales** de generación, cobertura o emisiones. Los ítems sin datos rotulados (121, 122, 123, 125, 129, 130, 135, 136, 138, 140, 141, 146, 147) plantean situaciones o modelos con valores redondos de manual. Hechos consolidados que se usan sin cita: voltaje residencial nominal de 120 V en Colombia, electrocución de aves grandes que tocan dos conductores o un conductor y la cruceta a tierra, experimento de Oersted, frenado de un imán en un tubo conductor (ley de Lenz), aumento de la resistencia de un filamento con la temperatura, funcionamiento del termo. Solo se cita una fuente externa real, para la rapidez de la luz (ítem 145: NIST, valores CODATA; c = 299 792 458 m/s es exacta por definición del metro).
>
> **Límites con el bloque D.** Para no solaparse con la entrega 4 (mecánica), este bloque no trata cinemática, leyes de Newton, cantidad de movimiento, fluidos y flotación, sonido como fenómeno mecánico ni lentes. Las ondas se abordan como propiedades ondulatorias (frecuencia, periodo, amplitud, longitud de onda, v = λ·f, reflexión, refracción y espectro electromagnético).
>
> **Limitación.** Durante esta entrega no se consultaron en línea los documentos oficiales del ICFES ni del MEN. La correspondencia con las competencias sigue la descripción del encargo.

## 1. Matriz del bloque

Recurso «texto» significa que basta con el contexto y el enunciado. Los demás recursos exigen interpretar una tabla, una gráfica (`chart` con ejes, unidades y descripción textual), un esquema (`schemeDescription`: elementos en serie o en paralelo y ubicación de los medidores descritos con precisión), un experimento o un modelo.

| N.º | Id | Tema | Competencia | Afirmación (operativa) | Evidencia (operativa) | Nivel | Contexto | Recurso | Datos ficticios | Clave |
|---|---|---|---|---|---|---|---|---|---|---|
| 121 | SN-E-121 | Carga eléctrica: electrización por inducción | Uso comprensivo | Usa el modelo de cargas eléctricas móviles en los conductores para predecir el resultado de un proceso de electrización. | Predice el signo y la magnitud de la carga final de dos conductores separados en presencia de un cuerpo cargado, sin contacto con él. | 1 | laboratorio | esquema | No | **C** |
| 122 | SN-E-122 | Carga eléctrica: polarización y atracción de cuerpos neutros | Explicación | Explica fenómenos electrostáticos cotidianos con el modelo de cargas y de interacción eléctrica. | Explica la atracción entre un cuerpo cargado y un cuerpo neutro mediante la separación de cargas (polarización) y la dependencia de la fuerza con la distancia. | 1 | cotidiano | texto | No | **A** |
| 123 | SN-E-123 | Potencial eléctrico: diferencia de potencial y seguridad en las redes de distribución | Explicación | Explica situaciones de riesgo eléctrico con los conceptos de diferencia de potencial y de corriente. | Explica por qué un ave posada en un solo cable no sufre descarga y una persona en contacto con el cable y con el suelo sí, usando la diferencia de potencial entre los puntos de contacto. | 2 | cotidiano | texto | No | **D** |
| 124 | SN-E-124 | Campo y potencial eléctrico: mapeo del potencial entre dos placas | Indagación | Obtiene conclusiones sobre el campo eléctrico a partir de mediciones de potencial. | Interpreta una tabla de potenciales medidos entre dos placas para inferir la uniformidad, la magnitud y el sentido del campo eléctrico. | 2 | laboratorio | tabla | Sí | **B** |
| 125 | SN-E-125 | Corriente y voltaje: conexión del amperímetro y del voltímetro | Uso comprensivo | Usa los conceptos de corriente y diferencia de potencial para seleccionar procedimientos de medición en circuitos. | Identifica la conexión correcta del amperímetro y del voltímetro en un circuito y la justifica con lo que mide cada instrumento. | 1 | laboratorio | esquema | No | **B** |
| 126 | SN-E-126 | Ley de Ohm y elementos no óhmicos: curvas corriente-voltaje | Indagación | Interpreta gráficas de resultados experimentales para clasificar materiales y dispositivos según su comportamiento eléctrico. | Compara las curvas corriente-voltaje de un resistor y de un bombillo de filamento y calcula el cociente V/I para decidir cuál cumple la ley de Ohm. | 2 | laboratorio | grafica | Sí | **D** |
| 127 | SN-E-127 | Resistencia eléctrica: dependencia de la longitud y del área del conductor | Uso comprensivo | Usa relaciones de proporcionalidad entre variables para predecir propiedades eléctricas de los conductores. | Deduce de una tabla que la resistencia de un alambre es proporcional a su longitud e inversamente proporcional a su área transversal, y predice la resistencia de un alambre nuevo. | 2 | laboratorio | tabla | Sí | **A** |
| 128 | SN-E-128 | Circuito en serie: la corriente no se «gasta» | Explicación | Explica el comportamiento de los circuitos con el modelo de corriente eléctrica y de transformación de energía. | Explica, a partir de mediciones de corriente en varios puntos de un circuito en serie, por qué dos bombillos iguales brillan igual. | 1 | experimento-escolar | esquema | Sí | **C** |
| 129 | SN-E-129 | Circuitos en paralelo: instalación eléctrica de una vivienda | Uso comprensivo | Usa las características de los circuitos en paralelo para interpretar el funcionamiento de las instalaciones eléctricas. | Relaciona la conexión en paralelo de los aparatos de una vivienda con el voltaje que recibe cada uno y con el cambio de la corriente total al encender más aparatos. | 1 | cotidiano | texto | No | **A** |
| 130 | SN-E-130 | Circuito mixto: predicción de brillos al retirar un bombillo | Explicación | Explica y predice las consecuencias de modificar un circuito con el modelo de resistencia equivalente y de reparto del voltaje. | Predice cómo cambia el brillo de dos bombillos de un circuito mixto al retirar un tercero, y lo explica con el cambio de la resistencia total y del reparto del voltaje. | 3 | laboratorio | esquema | No | **D** |
| 131 | SN-E-131 | Circuitos en paralelo: reparto de la corriente entre ramas | Indagación | Obtiene conclusiones a partir de las mediciones de un experimento con circuitos. | Interpreta las corrientes y los voltajes medidos en un circuito en paralelo para establecer cómo se reparte la corriente según la resistencia de cada rama. | 2 | laboratorio | tabla | Sí | **C** |
| 132 | SN-E-132 | Potencia y energía eléctrica: consumo mensual en kWh de una vivienda | Uso comprensivo | Usa la relación entre potencia, tiempo y energía para analizar el consumo eléctrico de una vivienda. | Calcula la energía mensual de varios aparatos a partir de su potencia y su tiempo de uso, y distingue la potencia de un aparato de la energía que consume. | 2 | cotidiano | tabla | Sí | **B** |
| 133 | SN-E-133 | Eficiencia energética: costo total de bombillos incandescentes y LED | Uso comprensivo | Usa los conceptos de potencia, energía y eficiencia para resolver problemas de decisión tecnológica con varios pasos. | Calcula el costo total (compra y energía) de dos tecnologías de iluminación durante un mismo tiempo de uso, teniendo en cuenta la vida útil de cada una. | 3 | tecnologico | tabla | Sí | **D** |
| 134 | SN-E-134 | Consumo eléctrico: estimación del consumo de una nevera con el medidor de la casa | Indagación | Evalúa procedimientos de medición y reconoce sus limitaciones para responder una pregunta de investigación. | Reconoce que una medición incluye el consumo de otros aparatos y que unas condiciones de medición no representan todo el día, y elige el procedimiento que corrige ambas limitaciones. | 3 | cotidiano | tabla | Sí | **A** |
| 135 | SN-E-135 | Seguridad eléctrica: sobrecarga de una multitoma | Explicación | Explica situaciones de riesgo eléctrico en el hogar con las relaciones entre potencia, voltaje y corriente. | Explica el calentamiento de una multitoma y la apertura del interruptor automático por el aumento de la corriente total de aparatos en paralelo, y lo distingue de un cortocircuito. | 2 | cotidiano | texto | No | **A** |
| 136 | SN-E-136 | Electromagnetismo: campo magnético de una corriente (experimento de Oersted) | Indagación | Selecciona procedimientos experimentales que permitan distinguir entre hipótesis alternativas. | Elige la modificación del experimento de Oersted cuyos resultados esperados son distintos según la desviación de la brújula se deba a la corriente o al calentamiento del alambre. | 2 | experimento-escolar | experimento | No | **C** |
| 137 | SN-E-137 | Electromagnetismo: variables que influyen en la fuerza de un electroimán | Indagación | Reconoce variables independientes, dependientes y controladas en un experimento. | Selecciona en una tabla de resultados el par de ensayos que permite evaluar el efecto del número de vueltas manteniendo constante la corriente. | 1 | experimento-escolar | tabla | Sí | **B** |
| 138 | SN-E-138 | Ondas: reflexión y propiedades que se conservan | Explicación | Explica fenómenos ondulatorios con la relación entre la fuente, el medio y las propiedades de una onda. | Explica qué propiedades de una onda cambian y cuáles se conservan al reflejarse en un obstáculo dentro del mismo medio. | 1 | laboratorio | esquema | No | **D** |
| 139 | SN-E-139 | Inducción electromagnética: imán que cae dentro de tubos metálicos | Explicación | Compara explicaciones alternativas de un fenómeno y determina cuál se sustenta mejor en la evidencia. | Usa los tiempos de caída de un imán y de un cilindro no magnético en tubos de distintos materiales para descartar explicaciones y sustentar la de las corrientes inducidas. | 3 | laboratorio | tabla | Sí | **C** |
| 140 | SN-E-140 | Transformadores y transmisión de energía eléctrica a alto voltaje | Uso comprensivo | Usa las relaciones entre potencia, voltaje, corriente y resistencia para analizar sistemas tecnológicos de transmisión de energía. | Calcula la potencia disipada en una línea de transmisión para dos voltajes y explica por qué se eleva el voltaje con transformadores. | 3 | tecnologico | texto | No | **A** |
| 141 | SN-E-141 | Inducción electromagnética: diseño de un experimento con un generador de manivela | Indagación | Diseña procedimientos experimentales que permitan poner a prueba una hipótesis. | Selecciona el procedimiento que varía solo la variable independiente de la hipótesis, mide la variable dependiente y mantiene constantes las demás. | 1 | experimento-escolar | experimento | No | **D** |
| 142 | SN-E-142 | Ondas: frecuencia, periodo, longitud de onda y rapidez (v = λ·f) | Uso comprensivo | Usa la relación entre longitud de onda, frecuencia y rapidez para calcular propiedades de una onda. | Calcula la frecuencia de una onda a partir del número de oscilaciones en un tiempo dado y la usa con la longitud de onda para obtener la rapidez. | 1 | cotidiano | texto | Sí | **B** |
| 143 | SN-E-143 | Ondas: lectura del periodo, la frecuencia y la amplitud en una gráfica | Uso comprensivo | Usa representaciones gráficas de las ondas para obtener sus propiedades. | Lee el periodo y la amplitud en una gráfica de desplazamiento contra tiempo y los usa, con la longitud de onda, para calcular la frecuencia y la rapidez. | 2 | laboratorio | grafica | Sí | **C** |
| 144 | SN-E-144 | Ondas: refracción al cambiar la profundidad del agua | Explicación | Explica la refracción como un cambio en la rapidez de una onda al pasar de un medio a otro. | Explica el cambio de longitud de onda y de dirección de una onda que pasa a una zona de menor profundidad, a partir de la conservación de la frecuencia. | 2 | laboratorio | esquema | Sí | **A** |
| 145 | SN-E-145 | Espectro electromagnético: rapidez, frecuencia y longitud de onda | Explicación | Evalúa explicaciones sobre fenómenos ondulatorios a partir de datos y del modelo de las ondas electromagnéticas. | Usa el producto λ·f de varias ondas electromagnéticas para refutar la idea de que las de mayor frecuencia viajan más rápido en el vacío. | 2 | tecnologico | tabla | No | **B** |
| 146 | SN-E-146 | Transferencia de calor: conducción, convección y radiación en un termo | Explicación | Explica el funcionamiento de dispositivos tecnológicos con los mecanismos de transferencia de calor. | Relaciona cada elemento del diseño de un termo con el mecanismo de transferencia de calor que reduce. | 1 | tecnologico | texto | No | **D** |
| 147 | SN-E-147 | Temperatura y equilibrio térmico: mezcla de agua a distintas temperaturas | Uso comprensivo | Usa el principio de conservación de la energía para predecir la temperatura de equilibrio de un sistema. | Calcula la temperatura final de una mezcla de agua igualando la energía que cede la porción caliente con la que gana la fría. | 2 | laboratorio | texto | No | **B** |
| 148 | SN-E-148 | Calorimetría: calor específico de un metal y fuentes de error | Indagación | Evalúa la validez de conclusiones experimentales considerando las fuentes de error y los resultados de ensayos modificados. | Interpreta la diferencia entre un calor específico medido y el valor de referencia a partir de las pérdidas de energía, usando la mejora obtenida en un segundo ensayo. | 3 | laboratorio | tabla | Sí | **C** |
| 149 | SN-E-149 | Fuentes de energía y eficiencia: centrales hidroeléctrica, solar y térmica | Indagación | Evalúa el alcance de conclusiones sobre decisiones tecnológicas a partir de datos y de los criterios que esos datos no incluyen. | Calcula la eficiencia de tres centrales y reconoce que la eficiencia, por sí sola, no basta para concluir cuál fuente es la mejor opción. | 3 | tecnologico | tabla | Sí | **A** |
| 150 | SN-E-150 | Energía solar: inclinación de un panel fotovoltaico y diseño del experimento | Indagación | Reconoce limitaciones metodológicas que impiden atribuir un efecto a la variable estudiada. | Identifica que la hora de medición varía junto con la inclinación del panel y propone un procedimiento que separe los dos efectos. | 3 | experimento-escolar | grafica | Sí | **D** |

## 2. Distribución del bloque

### 2.1 Competencia × nivel

| Competencia | Nivel 1 | Nivel 2 | Nivel 3 | Total |
|---|---|---|---|---|
| Uso comprensivo del conocimiento científico | 4 (121, 125, 129, 142) | 4 (127, 132, 143, 147) | 2 (133, 140) | **10** |
| Explicación de fenómenos | 4 (122, 128, 138, 146) | 4 (123, 135, 144, 145) | 2 (130, 139) | **10** |
| Indagación | 2 (137, 141) | 4 (124, 126, 131, 136) | 4 (134, 148, 149, 150) | **10** |
| **Total** | **10** | **12** | **8** | **30** |

El nivel 3 se reparte entre las tres competencias, siguiendo la recomendación de las entregas anteriores: dos ítems de uso comprensivo (133, costo total con vida útil; 140, pérdidas en la transmisión con la trampa de V²/R), dos de explicación (130, predicción en un circuito mixto; 139, comparación de cuatro explicaciones del frenado de un imán con ensayos de control) y cuatro de indagación (134, línea de base y representatividad de una medición; 148, fuentes de error en calorimetría; 149, alcance de una conclusión sobre fuentes de energía; 150, variable de confusión en un experimento con un panel solar).

### 2.2 Recursos

| Recurso | Ítems | Cantidad |
|---|---|---|
| Tabla | 124, 127, 131, 132, 133, 134, 137, 139, 145, 148, 149 | 11 |
| Gráfica | 126 (líneas, 2 series, I-V), 143 (líneas, desplazamiento-tiempo), 150 (líneas, potencia-inclinación) | 3 |
| Esquema | 121 (inducción en dos esferas), 125 (circuito para conectar medidores), 128 (serie con tres amperímetros), 130 (circuito mixto), 138 (reflexión en la cubeta), 144 (refracción en la cubeta) | 6 |
| Experimento | 136 (Oersted, dos hipótesis), 141 (generador de manivela) | 2 |
| Solo texto | 122, 123, 129, 135, 140, 142, 146, 147 | 8 |

**22 de 30 ítems** exigen interpretar de forma sustantiva datos, representaciones o diseños experimentales (mínimo del bloque: 8; meta de trabajo: unos 15). Las gráficas tienen ejes con unidad entre paréntesis y una descripción textual con todos los valores; los esquemas de circuitos dicen qué elementos están en serie y cuáles en paralelo y dónde está cada medidor.

### 2.3 Cobertura temática

| Subtema del bloque E | Ítems |
|---|---|
| Carga eléctrica e inducción electrostática | 121, 122 |
| Campo y potencial eléctrico | 123 (diferencia de potencial y seguridad), 124 (mapeo del potencial) |
| Corriente, voltaje y resistencia; medición | 125, 127 |
| Ley de Ohm y elementos no óhmicos | 126 |
| Circuitos en serie y en paralelo (incluidas las concepciones sobre el brillo) | 128, 129, 130, 131 |
| Potencia y consumo eléctrico (kWh, factura con tarifa ficticia) | 132, 133, 134, 135 |
| Magnetismo y electromagnetismo | 136, 137 |
| Inducción electromagnética (generadores, transformadores) | 139, 140, 141 |
| Ondas: frecuencia, periodo, amplitud, longitud de onda, v = λ·f | 142, 143 |
| Reflexión y refracción como fenómenos ondulatorios | 138, 144 |
| Espectro electromagnético | 145 |
| Transferencia de calor | 146 (y 148) |
| Temperatura y equilibrio térmico | 147, 148 |
| Conservación y transformación de la energía | 133, 140, 147, 148, 149 |
| Fuentes de energía y eficiencia | 149, 150 (y 140, central hidroeléctrica) |
| Aplicaciones tecnológicas y sus implicaciones | 133, 135, 140, 145, 146, 149, 150 |

Seguridad eléctrica: los ítems 123 (no acercarse a cables), 125 (nunca conectar un amperímetro en paralelo) y 135 (no sobrecargar multitomas, no cambiar el breaker por uno de mayor capacidad, diferencia entre sobrecarga y cortocircuito) incluyen la indicación de seguridad en la justificación.

## 3. Distribución de claves

| Letra | Ítems | Cantidad |
|---|---|---|
| A | 122, 127, 129, 134, 135, 140, 144, 149 | 8 |
| B | 124, 125, 132, 137, 142, 145, 147 | 7 |
| C | 121, 128, 131, 136, 139, 143, 148 | 7 |
| D | 123, 126, 130, 133, 138, 141, 146, 150 | 8 |

Secuencia (121–150): C A D B B D A C A D C B D A A C B D C A D B C A B D B C A D.

- Cada letra aparece entre 6 y 9 veces. La racha más larga es de 2 (124–125: B B; 134–135: A A). El bloque C termina en B (ítem 90) y el E empieza en C; con el bloque D aún ausente, el validador del banco compara 90 con 121 y no hay racha.
- **Ciclo de claves.** La secuencia se fijó antes de redactar y se revisó contra ciclos. En el plan inicial, 137–146 formaba B D C A B D C A B D (ciclo de periodo 4); se cambió el orden de opciones planeado para 141 y 142 (D y B) antes de redactar. `findKeyCycle` no encuentra ciclos (periodos 2, 3 y 4) y los cuartetos de la prueba unitaria son todos distintos.
- **Longitud de la clave.** En el primer borrador la clave era estrictamente la opción más larga en 14 de 30 ítems (47 %; aviso del validador). Se acortaron claves en 123, 140, 144, 149 y 150, y se alargaron distractores en 130, 135 y 147, sin cambiar su contenido. Versión final: la clave es estrictamente la más larga en 6 de 30 ítems (20 %; lo esperable por azar es ≈ 7,5); en los ítems numéricos (127, 133, 137, 142, 143) las opciones tienen longitudes casi iguales.

## 4. Registro de revisión (segunda y tercera pasada)

Proceso: (1) matriz fijada de antemano (competencia, nivel, recurso, clave y tema); (2) borrador de los 30 ítems; (3) verificación de todos los cálculos y de cada distractor numérico con un guion (`bloqueE-check/calc.py` en el área de trabajo: campo entre placas, cocientes V/I, R = ρL/A, reparto del voltaje en el circuito mixto, corrientes en paralelo, kWh y costos, costo total de la iluminación, línea de base del medidor, corriente de la multitoma, caída libre de 1 m, pérdidas I²R, v = λ·f, puntos de la gráfica sinusoidal, λ·f de las ondas electromagnéticas, mezcla de agua, calorimetría y eficiencias); (4) revisión independiente de cada ítem: precisión física, intento de refutar la clave, búsqueda de una segunda opción defendible, pistas, ajuste de nivel y competencia y redundancia con los bloques A–C, con `src/assessment/bank.ts` y con las prácticas; (5) comprobación programática con el validador y con `tests/unit/bloqueE.test.ts`. La tabla registra lo que no cumplía antes de corregirse y las decisiones de la revisión; el estado final es «Cumple» en los 15 criterios de los 30 ítems.

| N.º | Problema detectado en la revisión | Corrección aplicada / decisión |
|---|---|---|
| 121 | D (signos invertidos) podía confundirse con la clave si no quedaba claro de qué lado se acerca la barra. | El esquema precisa que la barra se acerca a X «por el lado opuesto a Y» y que nada toca las esferas. La justificación usa la conservación de la carga (suma cero). |
| 122 | Sin un dato sobre la carga del papel, D («el papel ya tenía carga opuesta») no era refutable. | Se añadió la prueba previa con el electroscopio (el papel no tenía carga neta). C se redactó con transferencia de carga a distancia, que daría el mismo signo y repulsión. |
| 123 | A (aislamiento de las patas) era indistinguible de la clave solo con la situación del ave. | Se añadió el hecho consolidado de que las aves grandes que tocan dos conductores, o un conductor y la cruceta a tierra, se electrocutan: el cuerpo sí conduce. La clave se acortó (era la más larga). Se añadió la indicación de seguridad. |
| 124 | Riesgo de que «el campo es uniforme» se lea como afirmación absoluta. | La clave dice «casi uniforme» y la tabla incluye variaciones de ±0,1 V; se precisó «entre las placas». Cálculo verificado: 6,0 V / 12 cm = 0,5 V/cm = 50 V/m. |
| 125 | Ítem conceptual muy conocido; riesgo de nivel demasiado bajo. | Se mantuvo en nivel 1 y se pidió la razón de cada conexión, con distractores basados en «el voltaje pasa por los elementos». Se añadió la nota de seguridad del amperímetro en paralelo. |
| 126 | Redundancia con `saber-cir-2` (I-V de un resistor óhmico). | Aquí se comparan un resistor y un bombillo, y los distractores usan el cruce de las curvas en 5 V y la lectura de la pendiente como resistencia. La clave se limita a lo que muestran los datos (V/I de 10 a 22 Ω); el calentamiento del filamento queda en la justificación. |
| 127 | Se revisó que los valores ficticios no contradijeran la resistividad real. | ρ = 1,0 Ω·mm²/m, del orden de la de una aleación de níquel y cromo (≈ 1,1); los datos se rotulan como ficticios. Los tres distractores corresponden a errores distintos (área directa, solo longitud, solo área). |
| 128 | Redundancia parcial con `saber-csi-1` y `saber-cir-1`. | La tarea es explicar con mediciones en tres puntos (0,20 A) la concepción de «la corriente se gasta»; B aborda la variante «según el sentido de los electrones». Se verificó que, en el esquema, Q es el primero que encuentran los electrones. |
| 129 | B y D eran demasiado parecidos. | B usa «la corriente total disminuye al repartirse» y D, «la corriente total es fija»; las dos se refutan con la suma de corrientes. |
| 130 | La respuesta dependía de suponer bombillos óhmicos. | Se declaran los supuestos (resistencia constante, batería ideal) y la justificación muestra que el sentido de los cambios y la igualdad final de brillo se mantienen con bombillos reales idénticos. C se alargó (la clave era la más larga). |
| 131 | Enunciado idéntico al de un ítem anterior del banco (lo detectó la prueba de no repetición). | Se cambió a «¿Qué conclusión permiten obtener estas mediciones?». D se refuta con la suma de corrientes de los datos. |
| 132 | Riesgo de presentar una tarifa como real y de que la pregunta solo pidiera un cálculo mecánico. | Tarifa marcada como ficticia y aviso sobre empresa y estrato. La clave contrasta potencia con energía (nevera 54 kWh frente a ducha 36 kWh), y los distractores cubren tres errores distintos (potencia por energía, olvidar los 30 días, sumar potencias). |
| 133 | La opción C tiene una estructura distinta a las numéricas. | Se mantuvo porque representa el error más frecuente (decidir por el precio de compra); A y B corresponden a olvidar la reposición y a olvidar la compra. Cálculo verificado: $ 153 000 − $ 33 600 = $ 119 400. |
| 134 | D (desconectar la nevera un mes) podía parecer el «experimento más limpio». | La justificación explica que entre dos meses cambian otras variables y que es impráctico. La clave combina las dos limitaciones (línea de base y representatividad de la noche), ambas sustentadas por el contexto. Se aclaró que la nevera estaba vacía la noche en que se desconectó. |
| 135 | D (cortocircuito) podía defenderse si no se sabía cuándo se abrió el breaker. | El contexto dice que todo funcionó «unos minutos» antes de abrirse (sobrecarga, disparo térmico). Cálculo verificado: 3 000 W / 120 V = 25 A; (25/10)² = 6,25. D se alargó (la clave era la más larga). |
| 136 | En el borrador, una opción «calentar el alambre con un encendedor sin corriente» también distinguía las hipótesis (segunda respuesta defendible). | Se eliminó esa opción; los tres distractores (repetir, más corriente, alejar la brújula) producen la misma predicción para las dos hipótesis. Se precisó que el alambre está tendido norte-sur. |
| 137 | El par de ensayos 3 y 4 también es válido. | No se ofrece entre las opciones, y la justificación lo reconoce. |
| 138 | «Solo cambia la dirección» era una afirmación absoluta (la amplitud puede disminuir). | La clave dice «lo que cambia es su dirección» y la justificación aclara que la amplitud puede disminuir sin cambiar v, f ni λ. |
| 139 | Con el tubo con ranura, la hipótesis del aire atrapado (B) parecía apoyada (el aire escapa por la ranura y el imán cae más rápido). | Se añadió el control del cilindro de acero sin imantar del mismo tamaño en el tubo de cobre (0,46 s), que refuta B y D, y la observación de que el imán no se pega al cobre ni al aluminio, que refuta A. Caída libre de 1,0 m verificada: ≈ 0,45 s. |
| 140 | C (V²/R con el voltaje de la línea) debía ser un error inequívoco. | La justificación muestra que, con la caída de voltaje en el cable (500 V y 50 V), V²/R da el mismo resultado que I²R. La clave se acortó (era la más larga). Se añadió por qué los transformadores requieren corriente alterna. |
| 141 | Redundancia con `saber-emi-1` (análisis de datos de un generador). | Aquí la tarea es elegir el diseño (variables independiente, dependiente y controladas), sin datos. |
| 142 | Ambigüedad de conteo: «pasan 12 crestas» puede leerse como 11 intervalos. | Se escribió «12 olas completas (12 periodos)». Se verificó que λ = 15 m y v = 3,0 m/s son coherentes con olas de aguas someras cerca de un muelle (profundidad ≈ 1 m). |
| 143 | Los distractores debían corresponder a lecturas erróneas reales de la gráfica. | A: periodo tomado como frecuencia; B: medio periodo; D: amplitud tomada como longitud de onda. Los 17 puntos se generaron con 3 sen(2πt/0,40) y se redondearon a una décima. |
| 144 | La clave era la más larga (169 caracteres) y explicaba demasiado. | Se acortó; el mecanismo del giro del frente quedó en la justificación. Se verificó el sentido del giro: al frenarse la onda, el frente forma un ángulo menor con la frontera. |
| 145 | Riesgo de datos sin fuente. | Los valores son frecuencias típicas redondeadas y la longitud de onda se calcula con c; se cita la fuente de c (NIST/CODATA). La justificación aclara que la penetración de los rayos X depende de su frecuencia (energía por fotón) y de su interacción con la materia, no de su rapidez. |
| 146 | Distractor sobre el frío como sustancia repetido con el 147 en el borrador. | Se mantiene solo en el 146 (C); en el 147 se reemplazó (ver abajo). La justificación reconoce que el termo no es perfecto (conducción por el cuello y el tapón). |
| 147 | En el borrador, D tenía el mismo valor que la clave (44 °C) con un razonamiento falso («el frío se transfiere»): una opción con resultado correcto puede considerarse parcialmente correcta. | Se reemplazó por 36 °C (confundir el cambio de temperatura del agua caliente con la temperatura final). A se alargó. Cálculo verificado: T = 44 °C; 30 096 J cedidos = 30 096 J ganados. |
| 148 | Enunciado idéntico al de un ítem del bloque C. Varias fuentes de error dan valores bajos, lo que podía abrir varias claves. | Se cambió el enunciado; la clave no elige una sola fuente de error, sino que atribuye la diferencia a pérdidas de energía, apoyada por el segundo ensayo con menos pérdidas (0,70 → 0,84 J/(g·°C)). Se verificó la temperatura esperada sin pérdidas (≈ 29,6 °C). |
| 149 | Riesgo de sugerir cifras reales de centrales colombianas y de juzgar una fuente como «mejor». | Las centrales son hipotéticas y los datos ficticios; la clave solo dice que la conclusión no se sostiene con estos datos y nombra criterios ausentes (renovabilidad, emisiones). La clave se acortó (era la más larga). |
| 150 | La afirmación sobre la inclinación óptima cerca del ecuador podía leerse como dato. | Se dejó en la justificación con lenguaje prudente («suelen convenir inclinaciones pequeñas») y no es necesaria para la clave, que se basa solo en la variable de confusión (hora). La clave se acortó. |

**Redundancia.** Se revisaron las preguntas de física de `src/assessment/bank.ts` relacionadas con este bloque: `saber-cir-1` (bombillas en serie que se apagan), `saber-cir-2` (resistor óhmico), `saber-csi-1` (serie y paralelo con amperímetro), `saber-con-1` (conductividad de soluciones), `saber-emi-1` (fem de un generador), `saber-ond-1` (distancia a un rayo), `saber-opt-1` (moneda en la taza), `saber-cal-1` (aislantes térmicos), `saber-cdc-1` (conducción en varillas), `saber-itf-1` (red de difracción) y `saber-ene-1` (energía disipada). Los ítems 126, 128, 136, 141 y 147 tocan esos contenidos con tareas distintas (comparar un elemento no óhmico, explicar la concepción de la corriente que se gasta, distinguir hipótesis, diseñar el experimento, balance de energía en una mezcla). Se evitó la comparación metal-madera al tacto porque la trata la práctica `conduccion`. Con los bloques A, B y C no se repiten contextos ni enunciados (verificado por prueba); los temas comunes con el bloque B (efecto invernadero, termoeléctrica en la lluvia ácida) no se retoman: el 149 compara eficiencias y criterios de decisión.

## 5. Comprobaciones de cierre de la entrega (sección 16)

1. **Números presentes.** Están los ítems 121 a 150, con ids `SN-E-121` … `SN-E-150` en orden y sin duplicados (verificado por prueba).
2. **Correspondencia con la matriz.** Son 30 ítems: 10 de uso, 10 de explicación y 10 de indagación; 10, 12 y 8 de los niveles 1, 2 y 3, con nivel 3 en las tres competencias; 22 con datos o representaciones (mínimo 8). Las tablas tienen encabezados con unidades; las gráficas, ejes con unidad entre paréntesis y descripción textual completa. Verificado por `tests/unit/bloqueE.test.ts` y por el validador (`npm run banco`: 120 ítems, 0 errores; el único aviso es anterior y corresponde al bloque A, ítems 7 y 17). El bloque E no genera avisos.
3. **Claves y justificaciones revisadas.** Hay una sola clave por ítem, con justificación que muestra el procedimiento y las unidades cuando hay cálculo, y coma decimal en todos los textos (verificado por prueba). Cada distractor tiene su razón (`why`) y el error que lo originaría (`misconception`). Los cálculos de los ítems 124, 126, 127, 128, 130, 131, 132, 133, 134, 135, 138, 139, 140, 142, 143, 144, 145, 147, 148 y 149 se verificaron con el guion auxiliar.
4. **Sin duplicaciones sustanciales.** No hay contextos ni enunciados repetidos dentro del bloque ni con los bloques A–C (verificado por prueba), ni duplicaciones sustanciales con el banco existente (sección 4).
5. **Estado de revisión.** Los 30 ítems quedan «Cumple» en los 15 criterios, después de las correcciones de la sección 4. Son material revisado con criterios técnicos y no validado psicométricamente.
6. **Balance global actualizado (entregas terminadas: 1, 2, 3 y 5; la entrega 4, bloque D, está en curso por separado).**

| Indicador | A + B + C | Bloque E | Acumulado A–C + E | Meta del banco (180) | Pendiente (D, F) |
|---|---|---|---|---|---|
| Uso comprensivo | 30 | 10 | 40 | 60 | 20 |
| Explicación de fenómenos | 30 | 10 | 40 | 60 | 20 |
| Indagación | 30 | 10 | 40 | 60 | 20 |
| Nivel 1 | 30 | 10 | 40 | 60 | 20 |
| Nivel 2 | 36 | 12 | 48 | 72 | 24 |
| Nivel 3 | 24 | 8 | 32 | 48 | 16 |
| Ítems con datos o representaciones | 67 (21 + 23 + 23) | 22 | 89 | ≥ 45 (encargo) / ≥ 48 (6 × 8) | Meta global ya superada; mantener al menos 8 por bloque |
| Claves A / B / C / D | 22 / 22 / 22 / 24 | 8 / 7 / 7 / 8 | 30 / 29 / 29 / 32 | Equilibradas | D y F pueden compensar ligeramente la D |
| Uso comprensivo de nivel 3 | 3 (B-056, dos en C) | 2 (133, 140) | 5 | — | Incluir alguno en D y F |

Pendientes: entregas 4 (D, física mecánica, en curso) y 6 (F, indagación e integración), con los mismos criterios: matriz 10/10/10 y 10/12/8, datos ficticios rotulados, claves entre 6 y 9 por letra sin rachas de más de 3 ni ciclos, y control de la longitud de la clave. Al registrar el bloque D en `bloques.ts` conviene revisar la racha de claves entre el ítem 120 y el 121 (la clave del 121 es C).

## 6. Dudas científicas declaradas

- **Ítem 123.** La explicación usa el modelo de la diferencia de potencial entre las patas; en la realidad, con corriente alterna de alto voltaje también hay efectos capacitivos pequeños sobre el ave, que no cambian la conclusión. Las cifras de voltaje de la red se dan solo de forma cualitativa («miles de voltios»).
- **Ítem 124.** En una cubeta con agua real hay caídas de potencial en la interfaz entre el electrodo y el agua, y el campo se deforma cerca de los bordes de las placas; los datos ficticios idealizan esa situación (0 V y 6,0 V exactamente en las placas).
- **Ítem 126.** El comportamiento no óhmico se atribuye al calentamiento del filamento, que es la explicación aceptada; con corriente que cambia rápido, la resistencia del filamento también depende del tiempo de calentamiento. Los valores son ficticios.
- **Ítem 132.** Las potencias son típicas, pero las neveras reales no tienen un «tiempo de compresor» fijo, y las duchas eléctricas en Colombia pueden funcionar a 120 V o 240 V con potencias distintas; el ítem no depende de esos detalles.
- **Ítem 135.** El tiempo de disparo de un breaker por sobrecarga depende de su curva característica; el ítem solo afirma que una sobrecarga moderada lo abre después de un tiempo y un cortocircuito casi de inmediato.
- **Ítem 139.** Los tiempos de caída son ficticios pero del orden de los que se observan con imanes de neodimio en tubos de cobre de pared gruesa; dependen mucho del espesor de la pared y de la fuerza del imán. La ley de Lenz se presenta a nivel cualitativo.
- **Ítem 142.** La rapidez de las olas depende de la profundidad; λ = 15 m con T = 5,0 s solo es coherente en aguas someras (≈ 1 m de profundidad), como cerca de un muelle. El ítem no exige ese conocimiento.
- **Ítem 144.** En una cubeta de ondas a 10 Hz influye también la tensión superficial; la relación «menos profundidad, menor rapidez» es la que se observa y se enseña, y los valores son ficticios.
- **Ítem 145.** «Atravesar el cuerpo» se explica por la energía de los fotones y la interacción con la materia; el ítem no entra en detalles (absorción fotoeléctrica, número atómico) que exceden la media.
- **Ítem 149.** Las eficiencias son de orden de magnitud realista (hidroeléctrica ≈ 85–90 %, térmica de carbón ≈ 35–40 %, paneles comerciales ≈ 15–22 %), pero se presentan como datos ficticios; la «energía que entra» a una central solar se define aquí como la luz que llega a los paneles, que es una convención del ítem.
- **Ítem 150.** La afirmación de que cerca del ecuador convienen inclinaciones pequeñas es cualitativa y no se cuantifica; además, en Apartadó (≈ 8° N) el Sol del mediodía pasa al norte del cenit parte del año, de modo que la orientación al sur no es óptima todo el año. El ítem no depende de ello: su clave es la variable de confusión.
