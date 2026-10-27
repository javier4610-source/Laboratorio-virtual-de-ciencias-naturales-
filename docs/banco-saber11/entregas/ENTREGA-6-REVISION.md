# Entrega 6 — Bloque F: Indagación científica, integración y ciencia, tecnología y sociedad (ítems 151–180)

**Archivo de ítems:** `src/assessment/avanzado/bloqueF.ts` (`BLOQUE_F`, ids `SN-F-151` … `SN-F-180`).
**Pruebas de la matriz:** `tests/unit/bloqueF.test.ts` (incluye la validación del banco completo de 180 ítems). **Registro:** `src/assessment/avanzado/bloques.ts` (`[BLOQUE_A, BLOQUE_B, BLOQUE_C, BLOQUE_D, BLOQUE_E, BLOQUE_F]`). Con los seis bloques registrados, el validador aplica por primera vez las metas globales del banco.

> **Carácter del material.** Son ítems originales de práctica tipo Saber 11.°. **No** son preguntas oficiales del ICFES ni están avalados por el ICFES o el MEN. Las afirmaciones y evidencias son **formulaciones operativas propias del banco**, no transcripciones ni códigos oficiales. La distribución por competencias y niveles es una **decisión metodológica** del banco, no la ponderación oficial del examen. El bloque se revisó con criterios técnicos (15 criterios de la sección 13 del encargo), pero **no está validado psicométricamente**: no hubo aplicación piloto, así que no se informan índices de dificultad, discriminación ni funcionamiento de distractores.
>
> **Datos.** Todo dato numérico medido u observado en los contextos es **ficticio, con fines didácticos**, y así se rotula en el contexto o en la tabla (`simulatedData: true`, 20 ítems). Los programas, colegios, fundaciones, empresas, municipios y grupos de investigación que aparecen se presentan como **situaciones hipotéticas**: no describen estudios, controversias ni casos reales, y **no se usan estadísticas oficiales** de salud, de calidad del agua, de cobertura forestal ni de clima. Hechos consolidados que se usan sin cita: transmisión de la malaria por *Anopheles* y del dengue por *Aedes aegypti*, ciclo de vida del mosquito y tiempos de incubación aproximados, feromonas de rastro en hormigas, solubilidad del oxígeno en el agua según la temperatura (≈ 7,6 mg/L a 30 °C y ≈ 8,1 mg/L a 26 °C), pH del jugo gástrico y de la sangre, calor de vaporización y enfriamiento por sudor, relación entre presión atmosférica y temperatura de ebullición, desnaturalización de enzimas, oxidación de la pirita y precipitación del hierro al subir el pH, papel del bosque en la infiltración y la intercepción de la lluvia. Se cita una sola fuente externa real, en los ítems 174 y 179: las *Guidelines for drinking-water quality* de la OMS (4.ª edición con el primer y el segundo addendum, 2022), para el valor guía del nitrato (50 mg/L como ion nitrato) y para las características generales de los métodos de tratamiento del agua.
>
> **Límites con los bloques A–E.** El encargo pide que el bloque F no sea «una repetición mecánica de los demás». Las tareas de control de variables, variables de confusión y pruebas justas ya están en los bloques A–E (6, 30, 53, 89, 99, 109, 137, 141, 150, entre otros); aquí el control de variables solo aparece en formas nuevas: prueba a ciegas y orden aleatorio (152), grupo con imitación del producto (153), asignación al azar por bloques con réplicas (165), sitio de control en una evaluación antes-después (177). El resto del bloque se centra en la naturaleza de la indagación (observación, inferencia, predicción, teoría, reproducibilidad, revisión por pares), la calidad e integración de la evidencia (incertidumbre, promedio y dispersión, cifras significativas, muestreo, gráficas engañosas, selección interesada de datos), la correlación frente a la causalidad (causalidad inversa, tercera variable, desfase temporal, correlación lineal nula con relación fuerte), la evaluación de modelos (rango de validez, supuestos que dejan de cumplirse) y la integración disciplinar en problemas socioambientales.
>
> **Prudencia en salud pública.** Los ítems 156, 166 y 167 tratan temas de salud (malaria, «agua alcalina», dengue) solo como objeto de razonamiento sobre la evidencia; ninguno da indicaciones médicas. El 166 recuerda que las dudas sobre alimentación se consultan con profesionales y el 179 que la dosis de cloro sigue las indicaciones de las autoridades sanitarias y que la calidad del agua se verifica con análisis.
>
> **Limitación.** Durante esta entrega no se consultaron en línea los documentos oficiales del ICFES ni del MEN. La correspondencia con las competencias sigue la descripción del encargo.

## 1. Matriz del bloque

Recurso «texto» significa que basta con el contexto y el enunciado. Los demás recursos exigen interpretar una tabla, una gráfica (`chart` con ejes, unidades entre paréntesis y descripción textual con todos los valores), un esquema (`schemeDescription`) o un experimento descrito en el contexto.

| N.º | Id | Tema | Competencia | Afirmación (operativa) | Evidencia (operativa) | Nivel | Contexto | Recurso | Datos ficticios | Clave |
|---|---|---|---|---|---|---|---|---|---|---|
| 151 | SN-F-151 | Naturaleza de la indagación: observación, inferencia y predicción | Uso comprensivo | Usa las nociones de observación, inferencia, hipótesis y predicción para analizar registros de una indagación. | Distingue, en las notas de campo de una estudiante, el enunciado que registra lo percibido del que propone una causa, y reconoce que una predicción no es una observación. | 1 | estudio-ecologico | texto | No | **B** |
| 152 | SN-F-152 | Diseño experimental: prueba a ciegas y orden aleatorio en una prueba de sabor | Indagación | Selecciona procedimientos experimentales que reducen los sesgos de quienes participan en una prueba. | Reconoce que saber qué muestra se prueba sesga el juicio y elige el enmascaramiento de las muestras con orden al azar como la mejora del procedimiento. | 1 | experimento-escolar | experimento | No | **C** |
| 153 | SN-F-153 | Control con pulsera simulada: expectativa y práctica frente al efecto de un producto | Explicación | Determina qué explicación está mejor sustentada por los resultados de un experimento con grupos de comparación. | Usa un grupo sin pulsera y un grupo con una pulsera simulada para separar el efecto de la práctica, el de llevar la pulsera y el atribuido al holograma. | 2 | datos-investigacion | tabla | Sí | **A** |
| 154 | SN-F-154 | Incertidumbre de medición: resolución del instrumento y cifras significativas | Uso comprensivo | Usa las nociones de resolución, variación de mediciones repetidas y cifras significativas para informar resultados. | Expresa el promedio de mediciones repetidas con las cifras que permiten la resolución de la balanza y la variación de los datos. | 1 | laboratorio | tabla | Sí | **D** |
| 155 | SN-F-155 | Gráficas engañosas: eje vertical truncado en una publicidad | Indagación | Evalúa la validez de conclusiones presentadas mediante gráficas, considerando su escala. | Calcula el cambio real a partir de los valores rotulados en una gráfica con el eje truncado y reconoce que la diferencia de alturas exagera el efecto. | 2 | tecnologico | esquema | Sí | **C** |
| 156 | SN-F-156 | Correlación y causalidad: causalidad inversa en la evaluación de una medida de salud pública | Explicación | Identifica los límites de una conclusión causal a partir de datos de observación. | Explica que una correlación positiva entre toldillos y casos de malaria se origina en la forma de repartir los toldillos (según los casos previos) y no en un efecto de estos. | 2 | salud-publica | tabla | Sí | **B** |
| 157 | SN-F-157 | Naturaleza de la ciencia: significado de «teoría científica» | Uso comprensivo | Diferencia el significado científico de teoría, hipótesis y ley de su uso cotidiano. | Reconoce que una teoría científica es una explicación amplia, sustentada por muchas evidencias y revisable, y no una suposición sin comprobar. | 1 | cotidiano | texto | No | **B** |
| 158 | SN-F-158 | Integración biología-química-física: ciclo diario del oxígeno disuelto en un estanque de peces | Explicación | Explica fenómenos integrando procesos biológicos, químicos y físicos, y descarta explicaciones incompatibles con los datos. | Relaciona el máximo de oxígeno en la tarde con la fotosíntesis y el mínimo al amanecer con la respiración nocturna, y descarta la temperatura como causa del mínimo. | 2 | agricola-ambiental | grafica | Sí | **A** |
| 159 | SN-F-159 | Correlación y causalidad: tercera variable en un estudio de campo | Indagación | Evalúa la validez de conclusiones causales obtenidas a partir de datos de observación. | Reconoce que la humedad se relaciona con los hongos y con las ranas, y usa parcelas de humedad parecida para examinar la relación entre hongos y ranas sin ese efecto. | 2 | estudio-ecologico | tabla | Sí | **D** |
| 160 | SN-F-160 | Evaluación de modelos: rango de validez de un modelo lineal (resorte) | Uso comprensivo | Usa modelos científicos reconociendo las condiciones en que son válidos y sus limitaciones. | Identifica en una gráfica el intervalo en que un modelo de proporcionalidad describe los datos y el sentido del error del modelo fuera de ese intervalo. | 2 | laboratorio | grafica | Sí | **C** |
| 161 | SN-F-161 | Integración biología-física: el sudor, la evaporación y la humedad del aire | Explicación | Explica procesos de regulación del cuerpo humano integrando conceptos de transferencia de energía y cambios de estado. | Explica que el sudor enfría al evaporarse y que la humedad del aire reduce la evaporación y, con ella, el enfriamiento. | 1 | cotidiano | texto | No | **A** |
| 162 | SN-F-162 | Muestreo: sesgo de selección al estimar el ataque de la broca del café | Indagación | Reconoce limitaciones metodológicas en la obtención de muestras y propone cómo corregirlas. | Identifica que una muestra tomada por comodidad puede no representar el lote y elige el muestreo al azar en todo el lote. | 1 | agricola-ambiental | texto | Sí | **D** |
| 163 | SN-F-163 | Incertidumbre de medición: tiempo de reacción y medición de muchas oscilaciones | Uso comprensivo | Usa el concepto de incertidumbre para comparar procedimientos de medición. | Calcula la incertidumbre absoluta y relativa del periodo de un péndulo medido con una y con veinte oscilaciones, y elige el procedimiento más preciso. | 2 | laboratorio | experimento | Sí | **B** |
| 164 | SN-F-164 | Reproducibilidad y revisión por pares en la construcción del conocimiento científico | Explicación | Explica el papel de la replicación independiente y de la revisión por pares en la validación de los resultados científicos. | Explica por qué la repetición por grupos independientes, siguiendo el método publicado, reduce la probabilidad de que un resultado se deba a un error o a una condición particular. | 1 | datos-investigacion | texto | No | **C** |
| 165 | SN-F-165 | Diseño experimental en el campo: asignación al azar, bloques y réplicas | Indagación | Selecciona diseños experimentales adecuados cuando no es posible igualar todas las condiciones. | Elige un diseño que reparte por sorteo los tratamientos dentro de cada zona del terreno y usa varias parcelas por tratamiento. | 2 | agricola-ambiental | esquema | No | **C** |
| 166 | SN-F-166 | Análisis crítico de afirmaciones publicitarias: «agua alcalina» y pH de la sangre | Uso comprensivo | Diferencia explicaciones científicas de afirmaciones sin fundamento, integrando conocimientos de química y de biología. | Usa los conceptos de pH, neutralización y regulación homeostática para evaluar un anuncio sobre el efecto del agua alcalina en la sangre. | 2 | salud-publica | texto | No | **A** |
| 167 | SN-F-167 | Relaciones con desfase temporal: lluvias, mosquitos y casos de dengue | Explicación | Explica relaciones entre variables ambientales y de salud mediante mecanismos biológicos con escalas de tiempo. | Explica el retraso entre las temporadas de lluvia y los picos de casos de dengue a partir del ciclo de vida del mosquito y de los tiempos de incubación del virus. | 2 | salud-publica | grafica | Sí | **B** |
| 168 | SN-F-168 | Hipótesis y predicción: el rastro químico de las hormigas arrieras | Indagación | Deduce las predicciones que se derivan de una hipótesis para ponerla a prueba. | Identifica el resultado que se espera de una manipulación experimental si la hipótesis del rastro químico es correcta. | 1 | estudio-ecologico | experimento | No | **D** |
| 169 | SN-F-169 | Representación de datos: elección de la gráfica adecuada para una relación entre variables | Uso comprensivo | Usa las características de las representaciones gráficas para comunicar relaciones entre variables. | Selecciona el diagrama de dispersión para mostrar la relación entre dos variables cuantitativas medidas en los mismos objetos. | 1 | estudio-ecologico | texto | No | **A** |
| 170 | SN-F-170 | Resultados contradictorios: comparación de métodos entre dos grupos que repiten un experimento | Explicación | Compara explicaciones alternativas de resultados contradictorios y determina cuál está mejor sustentada. | Usa las condiciones de los dos estudios y un ensayo adicional para atribuir la discrepancia al tiempo de almacenamiento del extracto, y descarta explicaciones de autoridad o de una sola repetición. | 3 | experimento-escolar | tabla | Sí | **C** |
| 171 | SN-F-171 | Análisis de datos: promedio y dispersión al comparar dos estufas eficientes de leña | Indagación | Evalúa conclusiones a partir de mediciones repetidas, considerando el promedio y la variación de los datos. | Compara la diferencia entre promedios con la dispersión de los ensayos y reconoce que, si los rangos se superponen casi por completo, la diferencia no sustenta la conclusión. | 2 | tecnologico | tabla | Sí | **B** |
| 172 | SN-F-172 | Integración física-química-biología: presión atmosférica, temperatura de ebullición y cocción | Uso comprensivo | Integra conocimientos de física, química y biología para interpretar situaciones cotidianas. | Relaciona la menor presión atmosférica en la altura con una menor temperatura de ebullición y esta con una menor rapidez de los cambios que ablandan los alimentos. | 2 | cotidiano | tabla | Sí | **D** |
| 173 | SN-F-173 | Evaluación de modelos: un modelo hidrológico que falla después de la deforestación | Explicación | Explica por qué un modelo científico deja de predecir bien cuando cambian las condiciones que supone. | Relaciona el aumento de los caudales medidos respecto al modelo con la pérdida de infiltración causada por la tala, y descarta explicaciones incompatibles con los datos. | 3 | ecosistema-colombiano | grafica | Sí | **A** |
| 174 | SN-F-174 | Incertidumbre y decisiones: nitrato en el agua de un pozo cerca de un valor guía | Indagación | Evalúa la validez de conclusiones que comparan mediciones con un valor de referencia, considerando su incertidumbre. | Reconoce que un promedio muy cercano al valor guía, con mediciones que varían alrededor de él, no permite concluir que el agua cumple, y propone obtener mejor evidencia. | 3 | agricola-ambiental | tabla | Sí | **B** |
| 175 | SN-F-175 | Estadística básica: coeficiente de correlación lineal y relaciones no lineales (actividad enzimática) | Uso comprensivo | Usa conocimientos de biología y de análisis de datos para evaluar la interpretación de una medida estadística. | Reconoce que un coeficiente de correlación lineal cercano a cero no implica ausencia de relación cuando la relación tiene un máximo, y lo explica con el modelo de la actividad enzimática. | 3 | laboratorio | grafica | Sí | **C** |
| 176 | SN-F-176 | Problema socioambiental: drenaje ácido de una mina y recuperación de una quebrada | Explicación | Explica un problema ambiental integrando reacciones químicas, mezcla de corrientes y efectos sobre los seres vivos. | Usa el cambio de pH y de hierro disuelto, comparado con lo esperado por simple dilución, para sustentar que hubo neutralización y precipitación del hierro. | 3 | ecosistema-colombiano | tabla | Sí | **D** |
| 177 | SN-F-177 | Evaluación de impactos: comparación antes y después con un sitio de control (planta de tratamiento de aguas residuales) | Indagación | Evalúa conclusiones sobre el efecto de una intervención ambiental usando sitios de control y mediciones antes y después. | Usa el cambio en un sitio de control para reconocer qué parte de la mejora del sitio intervenido no puede atribuirse a la planta de tratamiento. | 3 | agricola-ambiental | tabla | Sí | **B** |
| 178 | SN-F-178 | Análisis crítico de afirmaciones en redes: variación entre años frente a tendencia | Explicación | Identifica los límites de una conclusión basada en un dato aislado frente a una tendencia de largo plazo. | Explica, con una serie de 20 años, que un año más frío que el anterior es parte de la variación natural y no contradice una tendencia de aumento. | 1 | datos-investigacion | grafica | Sí | **A** |
| 179 | SN-F-179 | Decisiones tecnológicas fundamentadas: tratamiento del agua de consumo en una escuela rural | Uso comprensivo | Usa conocimientos científicos para tomar decisiones tecnológicas que consideran varios criterios a la vez. | Combina métodos de tratamiento según la turbidez del agua, la necesidad de desinfección, la protección durante el almacenamiento y los recursos disponibles, respetando el orden de los procesos. | 3 | tecnologico | tabla | No | **C** |
| 180 | SN-F-180 | Uso responsable de la evidencia: selección de datos favorables en la publicidad de un biofertilizante | Indagación | Evalúa afirmaciones basadas en datos considerando si se usó toda la evidencia disponible. | Compara los promedios de todas las parcelas de un ensayo al azar y reconoce que un folleto seleccionó solo los resultados favorables. | 3 | agricola-ambiental | tabla | Sí | **D** |

## 2. Distribución del bloque

### 2.1 Competencia × nivel

| Competencia | Nivel 1 | Nivel 2 | Nivel 3 | Total |
|---|---|---|---|---|
| Uso comprensivo del conocimiento científico | 4 (151, 154, 157, 169) | 4 (160, 163, 166, 172) | 2 (175, 179) | **10** |
| Explicación de fenómenos | 3 (161, 164, 178) | 4 (153, 156, 158, 167) | 3 (170, 173, 176) | **10** |
| Indagación | 3 (152, 162, 168) | 4 (155, 159, 165, 171) | 3 (174, 177, 180) | **10** |
| **Total** | **10** | **12** | **8** | **30** |

El nivel 3 se reparte entre las tres competencias: dos de uso comprensivo (175, correlación lineal nula frente a una relación con máximo, integrada con la desnaturalización de enzimas; 179, decisión tecnológica con varios criterios y orden de procesos), tres de explicación (170, resultados contradictorios entre dos grupos; 173, modelo hidrológico que falla tras la deforestación; 176, drenaje ácido de mina comparado con la predicción de la dilución) y tres de indagación (174, incertidumbre frente a un valor guía; 177, antes-después con sitio de control; 180, selección interesada de datos).

### 2.2 Recursos

| Recurso | Ítems | Cantidad |
|---|---|---|
| Tabla | 153, 154, 156, 159, 170, 171, 172, 174, 176, 177, 179, 180 | 12 |
| Gráfica | 158 (línea, oxígeno en 24 h), 160 (dispersión, 2 series, modelo y datos del resorte), 167 (línea, casos por mes), 173 (dispersión, 3 series, modelo y caudales antes y después de la tala), 175 (línea, actividad enzimática), 178 (línea, temperatura media anual de 20 años) | 6 |
| Esquema | 155 (gráfica publicitaria con eje truncado, descrita con alturas y escala), 165 (plano de la finca por zonas) | 2 |
| Experimento | 152 (prueba de sabor), 163 (medición del periodo con 1 y con 20 oscilaciones), 168 (rastro de las hormigas) | 3 |
| Solo texto | 151, 157, 161, 162, 164, 166, 169 | 7 |

**23 de 30 ítems** exigen interpretar de forma sustantiva datos, representaciones o diseños experimentales (mínimo del bloque: 8; meta de trabajo: unos 15). Las gráficas tienen ejes con unidad entre paréntesis y una descripción textual con todos los valores. El ítem 155 trata una gráfica engañosa: como el componente de gráficas del banco siempre empieza el eje en cero (para no distorsionar), la gráfica publicitaria se describe como esquema, con las alturas de las barras en centímetros y la escala del eje.

### 2.3 Cobertura temática (lista del bloque F en el encargo)

| Subtema del bloque F | Ítems |
|---|---|
| Diseño experimental | 152 (prueba a ciegas), 153 (grupo con imitación), 165 (bloques, sorteo y réplicas), 168 (manipulación y control) |
| Control de variables (solo en formas nuevas) | 152 (enmascaramiento y orden al azar), 153 (control con pulsera simulada), 165 (asignación al azar dentro de bloques), 177 (sitio de control) |
| Formulación y evaluación de hipótesis | 151 (observación, inferencia y predicción), 157 (hipótesis, teoría y ley), 168 (predicción deducida de una hipótesis) |
| Análisis de datos experimentales | 153, 159, 170, 171, 177, 180 |
| Tablas, gráficas y esquemas (incluidas gráficas engañosas y elección de gráfica) | 155 (eje truncado), 169 (elección de la gráfica), 160, 173, 175, 178 |
| Incertidumbre y limitaciones de medición | 154 (resolución y cifras significativas), 163 (tiempo de reacción e incertidumbre relativa), 171 (promedio y dispersión), 174 (incertidumbre frente a un valor guía) |
| Reproducibilidad de resultados | 164 (replicación independiente y revisión por pares), 170 (repetición que no coincide) |
| Correlación y causalidad | 156 (causalidad inversa), 159 (tercera variable), 167 (desfase temporal con mecanismo), 175 (correlación lineal nula con relación fuerte) |
| Evaluación de modelos científicos | 160 (rango de validez), 173 (supuesto que deja de cumplirse) |
| Integración de biología, química y física | 158, 161, 166, 172, 175, 176 |
| Interpretación de resultados contradictorios | 170 (y 164) |
| Análisis crítico de afirmaciones científicas | 153 (producto «energético»), 155 (publicidad), 166 (anuncio en redes), 178 (publicación en redes), 180 (folleto) |
| Uso responsable de evidencia | 160 (no descartar datos), 174 (no exceder la evidencia), 175 (graficar antes de calcular), 180 (selección interesada de datos) |
| Decisiones tecnológicas fundamentadas | 171 (estufas eficientes de leña), 179 (tratamiento del agua) |
| Problemas socioambientales colombianos analizados científicamente | 156 (malaria), 162 (broca del café), 167 (dengue), 171 (leña), 173 (deforestación y caudales), 174 (nitrato en un pozo veredal), 176 (drenaje ácido de minería de carbón), 177 (planta de tratamiento de aguas residuales), 179 (agua de consumo en una escuela rural) |

Ningún ítem exige conocimiento regional: los datos necesarios (altitudes, presiones, condiciones de cada sitio) están en el contexto.

## 3. Distribución de claves

| Letra | Ítems | Cantidad |
|---|---|---|
| A | 153, 158, 161, 166, 169, 173, 178 | 7 |
| B | 151, 156, 157, 163, 167, 171, 174, 177 | 8 |
| C | 152, 155, 160, 164, 165, 170, 175, 179 | 8 |
| D | 154, 159, 162, 168, 172, 176, 180 | 7 |

Secuencia (151–180): B C A D C B B A D C A D B C C A B D A C B D A B C D B A C D.

- Cada letra aparece entre 6 y 9 veces. Se eligieron 7 A, 8 B, 8 C y 7 D para compensar el acumulado de A–E (A 38, B 36, C 36, D 40): el banco completo queda en A 45, B 44, C 44, D 47.
- La racha más larga del bloque es de 2 (156–157: B B; 164–165: C C). En la frontera con el bloque E, el ítem 150 es D y el 151 es B: no hay racha.
- **Ciclo de claves.** La secuencia se fijó antes de redactar y se revisó contra ciclos de periodo 2, 3 y 4; `findKeyCycle` no encuentra ninguno en el bloque ni en el banco completo, y los cuartetos de la prueba unitaria son todos distintos.
- **Longitud de la clave.** En el primer borrador la clave era estrictamente la opción más larga en 14 de 30 ítems (47 %; aviso del validador). Se alargaron distractores en 152, 155, 159, 160, 162, 168, 174 y 179, y se acortó la clave en 169, sin cambiar su contenido. Versión final: la clave es estrictamente la más larga en 5 de 30 ítems (17 %: 158, 167, 170, 171 y 175); lo esperable por azar es ≈ 7,5.

## 4. Registro de revisión (segunda y tercera pasada)

Proceso: (1) matriz fijada de antemano (competencia, nivel, recurso, clave y subtema de la lista del bloque F), revisada contra los 150 ítems de A–E y contra `src/assessment/bank.ts` para no repetir tareas; (2) borrador de los 30 ítems; (3) verificación de todos los cálculos y datos ficticios con un guion (`bloqueF-check/calc.py` en el área de trabajo: cambios por grupo de la pulsera, promedio y error típico de las masas, alturas de las barras con eje truncado, cambios porcentuales de la malaria, sobresaturación de oxígeno, correlaciones de humedad, hongos y ranas, predicciones del modelo del resorte, incertidumbre relativa del péndulo, promedios y rangos de las estufas, temperaturas de ebullición con Clausius-Clapeyron y presiones de la atmósfera estándar, cocientes caudal/lluvia antes y después de la tala, promedio y desviación del nitrato, coeficiente de correlación de la enzima, pH y hierro por dilución pura, cambios absolutos y relativos del diseño antes-después con control, pendiente y promedios por década de la temperatura, promedios del biofertilizante); (4) revisión independiente de cada ítem: precisión científica, intento de refutar la clave, búsqueda de una segunda opción defendible, pistas, ajuste de nivel y competencia y redundancia con A–E y `bank.ts`; (5) comprobación programática con el validador (banco completo) y con `tests/unit/bloqueF.test.ts`. La tabla registra lo que no cumplía antes de corregirse y las decisiones de la revisión; el estado final es «Cumple» en los 15 criterios de los 30 ítems.

| N.º | Problema detectado en la revisión | Corrección aplicada / decisión |
|---|---|---|
| 151 | En un primer planteamiento las opciones eran enunciados sueltos («¿cuál es una hipótesis comprobable?»), cercanos al ítem 59 (pregunta investigable). | Se cambió la tarea a distinguir observación, inferencia y predicción en cuatro enunciados de una libreta de campo; las opciones son pares paralelos y cortos, y cada distractor corresponde a un error distinto (invertir, tomar la predicción por observación, tomar la predicción por la causa). |
| 152 | A (más catadores) podía parecer una mejora válida. | La justificación explica que un sesgo no desaparece al aumentar la muestra; D se redactó como «fijar el orden», que es justamente el defecto del plan. Se alargó B (la clave era la más larga). |
| 153 | **Clave refutable en el borrador.** La clave decía que la mejora se debía a «creer que se lleva la pulsera»; pero los grupos 2 y 3 también comparten llevar un objeto en la muñeca, así que la expectativa no era la única explicación. | La clave se limitó a lo que el diseño permite concluir (la mejora extra no se debe al holograma); la justificación nombra las dos causas posibles y propone el cuarto grupo que las separaría. |
| 154 | C (12,33 g) podía defenderse con el error típico del promedio (≈ 0,03 g). | C se redactó con un argumento falso explícito («diez veces menor»); la justificación explica la reducción aproximada en √n. Queda como duda declarada (sección 6). |
| 155 | El componente de gráficas del banco empieza el eje en cero y no puede mostrar un eje truncado. | La gráfica publicitaria se describe como esquema, con las alturas en centímetros y la escala; se verificó que 6 cm y 2 cm corresponden a 5,2 y 4,8 NTU con el eje desde 4,6 NTU (1 cm por cada 0,1 NTU). Reducción real: 0,4 / 5,2 ≈ 7,7 %. |
| 156 | D («la malaria se transmite por contacto») podía resultar implausible; C podía confundirse con la clave. | D se mantuvo como error conceptual frecuente sobre enfermedades transmitidas por vectores. La justificación muestra que los casos bajaron en todas las veredas (−25 % a −53 %) y aclara que la tabla tampoco prueba la eficacia (no hay veredas sin toldillos). Se añadió la frase de prudencia sobre las medidas reconocidas por las autoridades de salud. |
| 157 | Riesgo de redundancia con el ítem 18 (selección natural). | La tarea es sobre el significado de «teoría», no sobre el mecanismo evolutivo; los distractores cubren la jerarquía hipótesis-teoría-ley, la autoridad y el dogmatismo. |
| 158 | B (temperatura) necesitaba un dato para refutarse sin depender solo de la memoria. | Se dan en el contexto las solubilidades a 30 °C y 26 °C (7,6 y 8,1 mg/L); la sobresaturación de la tarde (≈ 134 %) evidencia la fotosíntesis. La clave quedó como la más larga; se aceptó porque C y B tienen longitudes cercanas (135–138 caracteres). |
| 159 | Sin parcelas de humedad parecida, la tercera variable solo se podía sospechar, no examinar. | Se añadieron dos pares de parcelas (3–4 y 6–7) con humedad casi igual y hongos muy distintos; la clave dice «puede deberse», por el tamaño de la muestra. r(humedad, ranas) ≈ 0,99; r(hongos, ranas) ≈ 0,71. |
| 160 | El borrador no tenía evidencia independiente de que el resorte cambiara de comportamiento (B, «errores de medición», no era refutable con los datos). | Se añadió la deformación permanente de 1,5 cm al retirar las masas. Se alargó A (la clave era la más larga). |
| 161 | Ítem de nivel 1 cercano al 23 (termorregulación). | El 23 pide las respuestas fisiológicas; este integra la física de la evaporación y la humedad. C se refuta con el dato de la ropa empapada. |
| 162 | B (detección a simple vista) podía ser «la principal limitación». | El contexto aclara que los granos atacados se reconocen sin dificultad. Se alargó A (la clave era la más larga). |
| 163 | Riesgo de que «± 0,2 s en cada intervalo» se leyera como 0,2 s por oscilación. | El contexto dice «sin importar cuánto dure ese intervalo». Cálculos: 0,2/1,4 ≈ 14 %; 0,2/20 = 0,01 s; 0,01/1,40 ≈ 0,7 %. Se enlazó la práctica `pendulo`. |
| 164 | Riesgo de que el anuncio se leyera como un caso real o como una controversia existente. | Se marca como situación hipotética, sin datos ni nombres; A se redactó como una «regla» inventada (tres laboratorios del mismo país) para representar la idea de la validación como trámite. |
| 165 | B (una parcela por variedad, por sorteo) podía parecer correcta por el sorteo. | La justificación separa los tres principios (bloques, sorteo y réplicas) y explica que sin réplicas no se puede comparar con la variación natural. |
| 166 | Riesgo de dar consejo de salud o de sugerir que el pH de la sangre puede cambiar con la dieta en personas sanas. | La justificación se limita a la química y a la regulación homeostática, aclara que salir del rango normal es una alteración que requiere atención médica y que el ítem no es una recomendación. |
| 167 | D (retraso en el registro de casos) era una explicación alternativa legítima del desfase. | El contexto precisa que los casos se cuentan por fecha de inicio de síntomas, lo que refuta D. Los tiempos biológicos se dan como aproximados (una a dos semanas; alrededor de una semana o más). |
| 168 | El efecto del olor del alcohol podía explicar la desorientación. | La justificación propone el control con algodón seco o con agua; B se redactó como efecto en toda la fila (no se deduce de la hipótesis). Se alargó A. |
| 169 | La clave era la opción más larga. | Se acortó la clave sin cambiar su contenido. |
| 170 | En el borrador, la clave nombraba un mecanismo («la sustancia activa se descompone») que los datos no muestran. | La clave dice solo que el efecto disminuye con el almacenamiento; el mecanismo queda abierto en la justificación. Se añadió el número de larvas y de recipientes para que el diseño sea comparable. |
| 171 | La diferencia de promedios debía ser claramente menor que la variación. | Promedios 1,10 y 1,02 kg; desviaciones ≈ 0,18 y 0,15 kg; rangos 0,90–1,30 y 0,85–1,20 kg. D (medir la temperatura) se refuta porque todos los ensayos llevan el agua a ebullición. |
| 172 | Las presiones y temperaturas reales no son ficticias, pero los tiempos de cocción sí. | La tabla se rotula como ficticia con la aclaración «presiones y temperaturas aproximadas»; se verificó que 85 kPa y 75 kPa dan ≈ 95 °C y ≈ 92 °C (Clausius-Clapeyron) y que corresponden a ≈ 1 500 m y ≈ 2 600 m. |
| 173 | C (instrumentos descalibrados) no se podía refutar solo con la gráfica; la justificación hablaba de una «fracción» con unidades. | El contexto indica que los medidores se calibraron en 2021. La justificación se corrigió: el caudal por milímetro de lluvia pasó de ≈ 0,12 a ≈ 0,21 m³/s, lo que indica que escurre una fracción mayor. En el borrador había un distractor sobre la transpiración de los árboles que era parcialmente cierto (intercepción); se reemplazó por «llovió más», que se refuta con el eje horizontal. |
| 174 | C (un valor por encima basta para concluir que no cumple) podía defenderse como principio de precaución. | La clave no afirma que el agua cumpla ni que no cumpla; C se refuta porque concluir «no cumple» también excede la evidencia (52 y 44 mg/L son mediciones de la misma muestra). Se cita la fuente real del valor guía. Se alargó A. |
| 175 | La clave sobre el coeficiente debía ser verificable con los datos. | r = −0,068 calculado con el guion; el contexto informa −0,07. La justificación integra la desnaturalización de la enzima. |
| 176 | A (solo dilución) solo se refutaba si se conocía el caudal del afluente. | Se añadió que el afluente tiene un caudal parecido, pH 8,0 y casi no tiene hierro: la dilución pura daría ≈ 19 mg/L y pH ≈ 3,5, frente a 1,5 mg/L y pH 6,4 medidos. |
| 177 | Enunciado idéntico al del ítem 159 (aviso del validador). Con un cambio solo multiplicativo (por dilución), la comparación absoluta y la relativa podían dar conclusiones opuestas. | Se cambió el enunciado. Los datos se fijaron para que I mejore más que C tanto en mg/L (6,0 frente a 1,0) como en porcentaje (50 % frente a 25 %); la clave es cualitativa y no cuantifica el efecto de la planta. |
| 178 | D («una sola estación no mide el clima») podía defenderse. | El contexto aclara que la publicación habla de su propia ciudad y que la gráfica es de esa estación; D se redactó como «la variabilidad impide ver la tendencia», que los promedios por década refutan. La justificación menciona que el calentamiento global se sustenta en muchos registros. |
| 179 | Una tabla sin datos ficticios necesitaba fuente; la opción D (clorar y después filtrar) debía ser inequívocamente peor. | Se cita la guía de la OMS para las características generales. D pierde el cloro residual que exige el almacenamiento. Se alargó B. Se añadió la nota sobre la dosis y la verificación con análisis. |
| 180 | B (el producto disminuye la cosecha) debía corresponder a la misma falacia, en sentido contrario. | Las dos parcelas menores (3,6 y 3,8) son tratadas, y los promedios son exactamente iguales (27,0/6 = 4,5 t/ha). La clave dice «no muestra un efecto», no «demuestra que no funciona». |

**Redundancia.** Se revisaron los 150 ítems de A–E y las preguntas de `src/assessment/bank.ts` relacionadas: `saber-ind-1` (pregunta de investigación), `saber-ind-2` (helados y deshidratación: correlación), `saber-ind-3` (repetición de mediciones de caída), `saber-ind-4` (dilución de un vertimiento), `saber-pen-1` (variables del péndulo), `saber-agu-1` (bioindicadores) y `saber-des-1` (compostaje). Los ítems 156 y 159 tratan formas de la correlación que no aparecen allí (causalidad inversa por asignación; tercera variable examinada con parcelas de humedad parecida); el 163 trata la incertidumbre relativa, no las variables del péndulo; el 176 compara con la predicción de la dilución, en lugar de criticarla en abstracto. Con A–E: el 177 usa un sitio de control, lo que no hacía el 30 (programa escolar sin grupo de comparación); el 178 evalúa una afirmación con la variación entre años, a diferencia del 51 (procedimiento para estimar la tendencia del CO₂); el 158 es un ciclo diario, a diferencia del 49 (perfil río abajo); el 176 trata el drenaje ácido, no el mercurio de los ítems 34 y 88; el 180 trata la selección interesada de datos, no la definición de «biodegradable» del 58. No hay contextos ni enunciados repetidos con A–E ni dentro del bloque (verificado por prueba y por el validador).

## 5. Comprobaciones de cierre de la entrega (sección 16)

1. **Números presentes.** Están los ítems 151 a 180, con ids `SN-F-151` … `SN-F-180` en orden y sin duplicados (verificado por prueba).
2. **Correspondencia con la matriz.** Son 30 ítems: 10 de uso, 10 de explicación y 10 de indagación; 10, 12 y 8 de los niveles 1, 2 y 3, con nivel 3 en las tres competencias; 23 con datos o representaciones (mínimo 8). Verificado por `tests/unit/bloqueF.test.ts` y por el validador (`npm run banco`: 180 ítems, 0 errores, 0 avisos, metas globales aplicadas).
3. **Claves y justificaciones revisadas.** Una sola clave por ítem, con justificación que muestra el procedimiento y las unidades cuando hay cálculo, y coma decimal en todos los textos (verificado por prueba). Cada distractor tiene su razón (`why`) y el error que lo originaría (`misconception`). Los cálculos de los ítems 153, 154, 155, 156, 158, 159, 160, 163, 170, 171, 172, 173, 174, 175, 176, 177, 178 y 180 se verificaron con el guion auxiliar.
4. **Sin duplicaciones sustanciales.** Ver la sección 4 (redundancia).
5. **Estado de revisión.** Los 30 ítems quedan «Cumple» en los 15 criterios, después de las correcciones de la sección 4. Son material revisado con criterios técnicos y no validado psicométricamente.
6. **Balance global actualizado.** Ver la sección 7: con esta entrega el banco queda completo.

## 6. Dudas científicas declaradas

- **Ítem 153.** La tabla da solo promedios. Una diferencia de 0,1 s entre los grupos 2 y 3 es despreciable para cualquier variación razonable entre personas, pero la diferencia de unos 3,8 s con el grupo 1 se interpreta como real sin una medida de dispersión; con 15 personas por grupo y tiempos de equilibrio muy variables, eso es una simplificación didáctica.
- **Ítem 154.** Con criterios estadísticos más avanzados, el promedio podría informarse como 12,33 g ± 0,03 g (error típico). La convención escolar de no superar la resolución del instrumento cuando los datos varían en esa cifra es la que se evalúa; el distractor C se redactó con un argumento falso (factor 10) para que no sea defendible.
- **Ítem 156.** La persistencia de la malaria en las mismas veredas se asume en la justificación; en la realidad, la transmisión también cambia de un año a otro por el clima y por otras intervenciones.
- **Ítem 158.** Las solubilidades son valores aproximados de agua dulce a nivel del mar; en un estanque real el intercambio con el aire, el viento y la turbidez también influyen.
- **Ítem 166.** El pH 9 del agua no se traduce en una cantidad de base relevante frente al ácido gástrico; los valores de pH del jugo gástrico varían entre personas y según la ingesta, y el rango 1,5–3,5 es aproximado.
- **Ítem 167.** Los tiempos del ciclo del mosquito y de incubación son aproximados y dependen de la temperatura; el dengue también puede aumentar en época seca si se almacena agua en recipientes destapados.
- **Ítem 172.** Los tiempos de cocción son ficticios; la cocción real del fríjol depende de la variedad, la edad del grano y el remojo. Las presiones y las temperaturas de ebullición son aproximadas.
- **Ítem 173.** Un modelo de coeficiente fijo es una simplificación extrema; la relación entre lluvia y caudal también depende de la humedad previa del suelo y de la intensidad del aguacero. La intercepción y la infiltración se presentan de forma cualitativa.
- **Ítem 174.** El valor guía de la OMS se usa solo como referencia; la normatividad colombiana sobre agua potable puede fijar valores y procedimientos distintos, que el ítem no cita. La incertidumbre del kit es ficticia.
- **Ítem 176.** La química del drenaje ácido se simplifica (no se distinguen Fe²⁺ y Fe³⁺ ni la oxidación del Fe²⁺, que se acelera al subir el pH); la estimación de pH por dilución pura ignora la capacidad amortiguadora de ambas aguas.
- **Ítem 178.** La pendiente de la serie ficticia (≈ 0,4 °C por década) es mayor que la del promedio mundial; es plausible para una estación local, pero no representa ningún registro real.
- **Ítem 179.** Las características de la tabla son generales; por ejemplo, la desinfección solar se recomienda solo con agua de baja turbidez, y la filtración lenta en arena bien operada sí reduce de manera importante los microorganismos («solo en parte» resume esa variabilidad).

## 7. Balance global del banco completo

Con esta entrega están desarrollados los seis lotes (ítems 1–180). Los valores se obtuvieron del banco registrado en `bloques.ts` con el validador (`validateBank`, `keyStats`, `findKeyCycle`) y están cubiertos por la prueba «el banco completo (seis bloques, 180 ítems) cumple las metas globales» de `tests/unit/bloqueF.test.ts`.

### 7.1 Competencia × nivel (180 ítems)

| Competencia | Nivel 1 | Nivel 2 | Nivel 3 | Total | Meta |
|---|---|---|---|---|---|
| Uso comprensivo del conocimiento científico | 28 | 23 | 9 | **60** | 60 |
| Explicación de fenómenos | 18 | 26 | 16 | **60** | 60 |
| Indagación | 14 | 23 | 23 | **60** | 60 |
| **Total** | **60** | **72** | **48** | **180** | 60 / 72 / 48 |

Por bloque, cada uno tiene 10/10/10 por competencia y 10/12/8 por nivel. Observación honesta sobre el reparto interno: la indagación concentra el nivel 3 (23 de 48) y el uso comprensivo concentra el nivel 1 (28 de 60); es coherente con la naturaleza de las tareas (evaluar diseños y evidencias suele ser más exigente que aplicar un concepto), pero quien arme un simulacro por competencia debe tenerlo en cuenta. El uso comprensivo de nivel 3 pasó de 7 a 9 ítems con esta entrega.

### 7.2 Ítems con datos o representaciones

| Bloque | A | B | C | D | E | F | Banco |
|---|---|---|---|---|---|---|---|
| Ítems con tabla, gráfica, esquema, experimento o modelo | 21 | 23 | 23 | 22 | 22 | 23 | **134** |
| Ítems con datos ficticios rotulados (`simulatedData`) | 18 | 20 | 18 | 15 | 16 | 20 | **107** |

Meta del encargo: al menos 45 ítems con interpretación sustantiva de datos (≥ 48 si se exigen 8 por bloque). El banco tiene 134 (74 %).

### 7.3 Distribución de claves por bloque y global

| Bloque | A | B | C | D | Racha más larga | Ciclo mecánico | Clave estrictamente más larga |
|---|---|---|---|---|---|---|---|
| A (1–30) | 7 | 7 | 8 | 8 | 2 | No | 9 (30 %) |
| B (31–60) | 7 | 8 | 7 | 8 | 2 | No | 8 (27 %) |
| C (61–90) | 8 | 7 | 7 | 8 | 2 | No | 8 (27 %) |
| D (91–120) | 8 | 7 | 7 | 8 | 2 | No | 6 (20 %) |
| E (121–150) | 8 | 7 | 7 | 8 | 2 | No | 6 (20 %) |
| F (151–180) | 7 | 8 | 8 | 7 | 2 | No | 5 (17 %) |
| **Banco** | **45** | **44** | **44** | **47** | **2** | **No** | **42 (23 %)** |

- **Racha más larga en todo el banco, cruzando bloques:** 2 (la primera, D D en los ítems 8–9). Hay 11 pares de claves iguales consecutivas en los 180 ítems y ninguna terna. Fronteras: 29–30 | 31–32 = A C | B D; 59–60 | 61–62 = B D | B D; 89–90 | 91–92 = C B | C A; 119–120 | 121–122 = A D | C A; 149–150 | 151–152 = A D | B C. Ninguna frontera forma racha.
- **Ciclos.** `findKeyCycle` (periodos 2, 3 y 4) no encuentra ciclos en ningún bloque ni en la secuencia completa de 180 claves.
- **Equilibrio.** Las cuatro letras están entre 44 y 47 (24,4 % a 26,1 %); lo esperado es 45 cada una.

Secuencias por bloque:

- A: C A B D B C A D D B C A C B D A C B B D A C D B D C D A A C
- B: B D A C C B D A C D B A D C B A C A B D D C A B D B C A B D
- C: B D A C A D B C D A C B D A A C D B C D A B D C A B D A C B
- D: C A D B B D A C D A B C A D C B D A C B A D B C D B A C A D
- E: C A D B B D A C A D C B D A A C B D C A D B C A B D B C A D
- F: B C A D C B B A D C A D B C C A B D A C B D A B C D B A C D

### 7.4 Comprobaciones de cierre del banco completo (sección 16)

1. **Números presentes.** Están los 180 ítems, numerados del 1 al 180 en orden, con ids `SN-A-001` … `SN-F-180` únicos (verificado por el validador y por la prueba del banco completo).
2. **Correspondencia con la matriz.** 60/60/60 por competencia, 60/72/48 por nivel, 134 ítems con datos (≥ 45), seis bloques de 30 con la matriz 10/10/10 y 10/12/8 cada uno. `npm run banco`: «180 ítems · 0 errores · 0 avisos · metas globales aplicadas».
3. **Claves y justificaciones.** Cada ítem tiene una sola clave, justificación y análisis de los tres distractores; las claves están equilibradas (sección 7.3), sin rachas de más de 2 ni ciclos.
4. **Sin duplicaciones.** El validador no encuentra contextos repetidos (error) ni enunciados repetidos (aviso) en los 180 ítems; las coincidencias temáticas entre bloques se documentaron en cada entrega.
5. **Estado de revisión.** Los 180 ítems están en «Cumple» en los 15 criterios de la sección 13, después de las revisiones registradas en las entregas 1 a 6 y de las revisiones del integrador. El banco es material **revisado con criterios técnicos y no validado psicométricamente**: no hubo aplicación piloto, y no se informan índices de dificultad, discriminación, confiabilidad ni funcionamiento de distractores.
6. **Balance global.** Completo (secciones 7.1 a 7.3). No quedan lotes pendientes.

**Pendiente para el docente (fuera de este lote):** regenerar las partes II a VI (`npm run banco`) en la integración y actualizar `01-FUNDAMENTACION.md`, que se escribe a mano, para indicar que el banco tiene los seis bloques. Antes de usar el banco con estudiantes conviene una aplicación piloto que permita estimar la dificultad real de los ítems y revisar los distractores que nadie elija.
