# Entrega 2 — Bloque B: Ecología, ambiente y sostenibilidad (ítems 31–60)

**Archivo de ítems:** `src/assessment/avanzado/bloqueB.ts` (`BLOQUE_B`, ids `SN-B-031` … `SN-B-060`).
**Pruebas de la matriz:** `tests/unit/bloqueB.test.ts`. **Registro:** `src/assessment/avanzado/bloques.ts` (`[BLOQUE_A, BLOQUE_B]`).

> **Carácter del material.** Son ítems originales de práctica tipo Saber 11.°. **No** son preguntas oficiales del ICFES ni están avalados por el ICFES o el MEN. Las afirmaciones y evidencias son **formulaciones operativas propias del banco**, no transcripciones ni códigos oficiales. La distribución por competencias y niveles es una **decisión metodológica** del banco, no la ponderación oficial del examen. El bloque se revisó con criterios técnicos (15 criterios de la sección 13 del encargo), pero **no está validado psicométricamente**: no hubo aplicación piloto, así que no se informan índices de dificultad, discriminación ni funcionamiento de distractores.
>
> **Datos.** Todo dato numérico de los contextos es **ficticio, con fines didácticos**, y así se rotula en el contexto o en la tabla de cada ítem (`simulatedData: true`, 20 ítems). No se usan estadísticas oficiales, estudios, autores ni mediciones reales de ningún lugar de Colombia: los lugares (ciénagas, páramos, manglares, bosque seco, arrecifes del Caribe) solo dan contexto y no exigen conocimiento regional. El ítem 48 usa un modelo geométrico (no datos) y no se rotula como simulado. Solo se citan dos fuentes externas reales y verificables, únicamente como fundamento conceptual: Streeter y Phelps (1925), *Public Health Bulletin* n.º 146 (curva de oxígeno, ítem 49), e IPCC (2021), *Climate Change 2021: The Physical Science Basis* (efecto invernadero, ítem 50). Los hechos de texto que se usan sin cita (pH ≈ 5,6 de la lluvia natural, fijación de N₂ por *Rhizobium*, carácter invasor del pez león en el Caribe, función aislante de las hojas marcescentes de los frailejones, regulación hídrica del páramo, metanogénesis anaerobia) son contenidos consolidados de manual.
>
> **Limitación.** Durante esta entrega no se consultaron en línea los documentos oficiales del ICFES ni del MEN. La correspondencia con las competencias sigue la descripción del encargo.

## 1. Matriz del bloque

Recurso «texto» significa que basta con el contexto y el enunciado. Los demás recursos exigen interpretar una tabla, una gráfica (`chart` con ejes, unidades y descripción textual), un esquema (`schemeDescription`), un experimento o un modelo.

| N.º | Id | Tema | Competencia | Afirmación (operativa) | Evidencia (operativa) | Nivel | Contexto | Recurso | Datos ficticios | Clave |
|---|---|---|---|---|---|---|---|---|---|---|
| 31 | SN-B-031 | Ecosistemas: factores bióticos y abióticos | Uso comprensivo | Usa los conceptos de factor biótico y abiótico para analizar cómo el ambiente condiciona los procesos de los organismos. | Identifica, entre varios cambios de un ecosistema acuático, el que altera un factor abiótico y reduce directamente la fotosíntesis de los productores. | 1 | ecosistema-colombiano | texto | No | **B** |
| 32 | SN-B-032 | Redes tróficas: niveles tróficos y omnivoría | Uso comprensivo | Usa el modelo de red trófica para ubicar a los organismos en niveles tróficos. | Identifica en una red trófica el organismo que ocupa más de un nivel trófico a partir de lo que consume. | 1 | ecosistema-colombiano | esquema | No | **D** |
| 33 | SN-B-033 | Flujo de energía: eficiencia de transferencia entre niveles tróficos | Explicación | Explica la estructura de los ecosistemas a partir del flujo de energía y de las leyes de la termodinámica. | Calcula la eficiencia de transferencia entre niveles tróficos y la usa para explicar por qué hay pocos depredadores tope. | 2 | estudio-ecologico | tabla | Sí | **A** |
| 34 | SN-B-034 | Contaminación por mercurio: bioacumulación y biomagnificación | Explicación | Explica la distribución de un contaminante en una red trófica a partir de procesos biológicos y de evidencias experimentales. | Relaciona el aumento de la concentración de mercurio en los niveles tróficos superiores con su retención en los tejidos y su transferencia por la alimentación. | 2 | ecosistema-colombiano | tabla | Sí | **C** |
| 35 | SN-B-035 | Ciclo del carbono: balance de un bosque como sumidero o fuente | Uso comprensivo | Usa el modelo del ciclo del carbono para analizar el intercambio de carbono entre un ecosistema y la atmósfera. | Calcula el balance neto de carbono de un bosque a partir de los flujos de fotosíntesis y de respiración y decide si actúa como sumidero o como fuente. | 2 | ecosistema-colombiano | esquema | Sí | **C** |
| 36 | SN-B-036 | Ciclo del nitrógeno: fijación biológica en leguminosas | Indagación | Obtiene conclusiones a partir de los resultados de un experimento con varios tratamientos. | Compara tratamientos con y sin inoculación de bacterias y con y sin fertilizante nitrogenado para concluir sobre el aporte de nitrógeno de los nódulos. | 2 | agricola-ambiental | tabla | Sí | **B** |
| 37 | SN-B-037 | Ciclo del agua: regulación hídrica en el páramo | Explicación | Compara explicaciones alternativas sobre el funcionamiento de un ecosistema y determina cuál se sustenta mejor en la evidencia. | Interpreta los caudales de dos microcuencas con la misma lluvia para explicar el papel del suelo y la vegetación del páramo en la regulación del agua. | 3 | ecosistema-colombiano | grafica | Sí | **D** |
| 38 | SN-B-038 | Dinámica de poblaciones: crecimiento logístico | Uso comprensivo | Usa los modelos de crecimiento poblacional para interpretar datos de poblaciones con recursos limitados. | Identifica en una curva de crecimiento el intervalo de mayor aumento absoluto y lo relaciona con la limitación de recursos que frena el crecimiento. | 2 | experimento-escolar | grafica | Sí | **A** |
| 39 | SN-B-039 | Dinámica de poblaciones: estimación por captura y recaptura | Indagación | Reconoce limitaciones metodológicas de un procedimiento de muestreo y propone ajustes que las reduzcan. | Determina el sentido del sesgo que produce la pérdida de marcas en una estimación por captura y recaptura y elige el cambio de procedimiento que lo corrige. | 3 | ecosistema-colombiano | experimento | Sí | **C** |
| 40 | SN-B-040 | Relaciones ecológicas: mutualismo en las micorrizas | Uso comprensivo | Usa los criterios de clasificación de las relaciones ecológicas para interpretar interacciones entre especies. | Clasifica la relación entre un hongo y una planta a partir de los beneficios o perjuicios que recibe cada uno. | 1 | agricola-ambiental | texto | No | **D** |
| 41 | SN-B-041 | Relaciones ecológicas: competencia interespecífica | Indagación | Interpreta los resultados de experimentos con varios tratamientos para establecer el tipo de interacción entre especies. | Compara la biomasa de dos especies creciendo solas, juntas y juntas con nutrientes añadidos para concluir que compiten y por qué recurso. | 2 | experimento-escolar | tabla | Sí | **B** |
| 42 | SN-B-042 | Sucesión ecológica: reemplazo de especies pioneras | Explicación | Explica los cambios en la composición de las comunidades durante la sucesión ecológica. | Relaciona la sombra que generan las especies pioneras con su reemplazo por especies tolerantes a la sombra. | 1 | ecosistema-colombiano | texto | No | **A** |
| 43 | SN-B-043 | Sucesión primaria y secundaria | Uso comprensivo | Usa los conceptos de sucesión primaria y secundaria para predecir la recuperación de áreas perturbadas. | Clasifica dos perturbaciones según el tipo de sucesión que inician y predice cuál área se recupera más rápido a partir de la presencia de suelo y de semillas. | 1 | ecosistema-colombiano | texto | No | **D** |
| 44 | SN-B-044 | Biodiversidad: riqueza y equidad de especies | Uso comprensivo | Usa los componentes de la diversidad de especies para comparar comunidades a partir de datos. | Evalúa una afirmación sobre la biodiversidad de dos sitios considerando la riqueza y la equidad en la abundancia de las especies. | 2 | ecosistema-colombiano | tabla | Sí | **C** |
| 45 | SN-B-045 | Adaptaciones: hojas muertas del frailejón y temperatura del tallo | Explicación | Explica la función de una adaptación a partir de datos sobre las condiciones del ambiente. | Interpreta las temperaturas del aire y del tallo cubierto por hojas muertas durante un día para explicar la función aislante de esas hojas. | 2 | ecosistema-colombiano | grafica | Sí | **B** |
| 46 | SN-B-046 | Distribución de especies: rango de tolerancia a la salinidad en el manglar | Uso comprensivo | Usa el concepto de rango de tolerancia para predecir la distribución de las especies en un gradiente ambiental. | Lee en curvas de tolerancia qué especie puede crecer en una condición ambiental dada. | 1 | ecosistema-colombiano | grafica | Sí | **A** |
| 47 | SN-B-047 | Alteración de ecosistemas: especie invasora en arrecifes | Explicación | Determina cuál de varias explicaciones de un cambio en un ecosistema está mejor sustentada por la evidencia. | Compara arrecifes con y sin remoción de una especie invasora para atribuir la disminución de peces nativos a la depredación y descartar explicaciones alternativas. | 3 | ecosistema-colombiano | tabla | Sí | **C** |
| 48 | SN-B-048 | Fragmentación del hábitat: efecto de borde | Explicación | Explica las consecuencias de alterar un ecosistema mediante modelos cuantitativos sencillos. | Calcula el hábitat de interior de bosque en un paisaje continuo y en uno fragmentado y lo usa para explicar el efecto de la fragmentación sobre especies de interior. | 3 | ecosistema-colombiano | modelo | No | **A** |
| 49 | SN-B-049 | Contaminación del agua: materia orgánica y oxígeno disuelto aguas abajo | Explicación | Explica la variación espacial de un indicador de calidad del agua a partir de procesos biológicos y físicos. | Relaciona la forma de la curva de oxígeno disuelto aguas abajo de un vertimiento con la descomposición de la materia orgánica y la reaireación del río. | 2 | ecosistema-colombiano | grafica | Sí | **B** |
| 50 | SN-B-050 | Cambio climático: mecanismo del efecto invernadero | Explicación | Explica el calentamiento global con el modelo del balance de radiación de la Tierra y lo diferencia de otros fenómenos atmosféricos. | Usa un esquema del balance de radiación para explicar cómo el aumento de CO₂ eleva la temperatura de la superficie y distingue este mecanismo del de la capa de ozono. | 1 | datos-investigacion | esquema | No | **D** |
| 51 | SN-B-051 | Análisis de datos ambientales: tendencia y ciclo estacional del CO₂ | Indagación | Selecciona procedimientos de análisis de datos adecuados para responder una pregunta de investigación. | Elige un procedimiento que separa la tendencia de largo plazo de la oscilación estacional en una serie de concentraciones de CO₂. | 3 | datos-investigacion | grafica | Sí | **D** |
| 52 | SN-B-052 | Contaminación del aire: lluvia ácida | Uso comprensivo | Usa conceptos de química ambiental para interpretar mediciones de la calidad del aire y de la lluvia. | Interpreta valores de pH de la lluvia en la escala logarítmica y relaciona la acidez con los óxidos de azufre y de nitrógeno emitidos por una fuente. | 2 | industrial | tabla | Sí | **C** |
| 53 | SN-B-053 | Degradación del suelo: erosión en cultivos de ladera | Indagación | Reconoce las variables que deben controlarse en un diseño experimental. | Identifica las condiciones que deben ser iguales en parcelas experimentales para que la diferencia en la pérdida de suelo se atribuya al manejo del cultivo. | 1 | agricola-ambiental | experimento | No | **A** |
| 54 | SN-B-054 | Impactos de actividades productivas: sobrepesca en una ciénaga | Indagación | Evalúa la validez de afirmaciones a partir del análisis de varios indicadores en una serie de datos. | Usa la captura total, el esfuerzo y la captura por unidad de esfuerzo para evaluar si la disminución de las capturas se explica solo por el aumento de pescadores. | 3 | ecosistema-colombiano | tabla | Sí | **B** |
| 55 | SN-B-055 | Gestión de residuos: compostaje y emisión de metano | Explicación | Explica las consecuencias ambientales de distintas formas de gestionar los residuos a partir de los procesos de descomposición. | Relaciona la presencia de oxígeno durante la descomposición con el tipo de gas que se produce en un relleno y en una compostera. | 1 | cotidiano | texto | No | **D** |
| 56 | SN-B-056 | Recursos y producción de alimentos: eficiencia energética de las cadenas tróficas | Uso comprensivo | Usa el modelo del flujo de energía en las cadenas tróficas para analizar decisiones sobre la producción de alimentos. | Calcula cuántas raciones diarias de energía aporta un cultivo cuando se consume directamente y cuando se usa para alimentar animales, y evalúa el resultado con el principio de conservación de la energía. | 3 | agricola-ambiental | texto | Sí | **B** |
| 57 | SN-B-057 | Conservación de la biodiversidad: corredores biológicos | Indagación | Determina qué evidencia adicional se necesita para sustentar una conclusión causal en un estudio observacional. | Reconoce variables de confusión en un estudio con cámaras trampa y elige el diseño de comparación que permitiría atribuir el efecto al corredor biológico. | 2 | estudio-ecologico | tabla | Sí | **C** |
| 58 | SN-B-058 | Ciencia, tecnología, sociedad y ambiente: evaluación de un plástico «biodegradable» | Indagación | Evalúa el alcance de una afirmación tecnológica a partir de resultados experimentales con controles. | Usa la degradación de un material en tres ambientes y un control positivo para determinar en qué condiciones se sostiene una afirmación publicitaria. | 3 | tecnologico | tabla | Sí | **A** |
| 59 | SN-B-059 | Indagación ambiental: polinizadores y bosques cerca de los cultivos | Indagación | Identifica preguntas que pueden responderse mediante la investigación científica. | Distingue una pregunta investigable, con variables observables y medibles, de preguntas valorativas, normativas o con supuestos no verificados. | 1 | agricola-ambiental | texto | No | **B** |
| 60 | SN-B-060 | Contaminación del aire: material particulado y tráfico urbano | Indagación | Interpreta gráficas de datos ambientales para evaluar conclusiones y reconocer sus límites. | Compara el PM2,5 a lo largo de un día hábil y de un día sin carro para evaluar si los carros particulares son la única fuente del contaminante. | 2 | datos-investigacion | grafica | Sí | **D** |


## 2. Distribución del bloque

### 2.1 Competencia × nivel

| Competencia | Nivel 1 | Nivel 2 | Nivel 3 | Total |
|---|---|---|---|---|
| Uso comprensivo del conocimiento científico | 5 | 4 | 1 | **10** |
| Explicación de fenómenos | 3 | 4 | 3 | **10** |
| Indagación | 2 | 4 | 4 | **10** |
| **Total** | **10** | **12** | **8** | **30** |

Siguiendo la recomendación de la entrega 1, el nivel 3 se repartió entre las tres competencias: un ítem de uso comprensivo (56, cálculo de varios pasos y evaluación con el principio de conservación de la energía), tres de explicación (37, 47 y 48: comparar explicaciones con evidencia y explicar con un modelo cuantitativo) y cuatro de indagación (39, 51, 54 y 58: limitaciones metodológicas, elección de un procedimiento de análisis, evaluación de afirmaciones con varios indicadores y alcance de una afirmación tecnológica con control positivo).

### 2.2 Recursos

| Recurso | Ítems | Cantidad |
|---|---|---|
| Tabla | 33, 34, 36, 41, 44, 47, 52, 54, 57, 58 | 10 |
| Gráfica | 37 (líneas, 2 series), 38 (líneas), 45 (líneas, 2 series), 46 (líneas, 2 series), 49 (líneas), 51 (líneas), 60 (líneas, 2 series) | 7 |
| Esquema | 32 (red trófica), 35 (flujos de carbono), 50 (balance de radiación) | 3 |
| Experimento | 39 (captura y recaptura), 53 (parcelas de erosión) | 2 |
| Modelo | 48 (fragmentación y efecto de borde) | 1 |
| Solo texto | 31, 40, 42, 43, 55, 56, 59 | 7 |

**23 de 30 ítems** exigen interpretar de forma sustantiva datos, representaciones o diseños experimentales (mínimo del bloque: 8). Las gráficas tienen ejes con unidad entre paréntesis y una descripción textual completa con todos los valores.

### 2.3 Cobertura temática

| Subtema del bloque B | Ítems |
|---|---|
| Ecosistemas y factores bióticos y abióticos | 31 |
| Redes tróficas y flujo de energía | 32, 33 (y 56, aplicación a la producción de alimentos) |
| Ciclos biogeoquímicos | 35 (carbono), 36 (nitrógeno), 37 (agua) |
| Dinámica de poblaciones | 38, 39 |
| Relaciones ecológicas | 40, 41 |
| Sucesión ecológica y biodiversidad | 42, 43, 44 |
| Adaptaciones y distribución de especies | 45, 46 |
| Alteraciones de los ecosistemas | 47 (especie invasora), 48 (fragmentación) |
| Contaminación del agua, el aire y el suelo | 34 (mercurio), 49 (agua), 52 y 60 (aire), 53 (erosión del suelo) |
| Cambio climático y sus mecanismos | 50, 51 (efecto invernadero frente a capa de ozono como material de distractores en 50 y 52) |
| Conservación de la biodiversidad | 57 (y 48) |
| Impactos de actividades productivas | 54 (pesca), 34 (minería), 37 (ganadería y cultivos), 53 (agricultura de ladera), 52 (termoeléctrica) |
| Gestión de residuos y recursos | 55, 58 (y 56) |
| Análisis de datos ambientales | 51, 54, 60 |
| Ciencia, tecnología, sociedad y ambiente | 58, 59 (y 56, 57) |

La «regla del 10 %» aparece solo como aproximación: en el ítem 33 las eficiencias son 8 %, 7,5 % y 6 %, y el distractor C castiga tomarla como ley exacta; en el ítem 56 se da una eficiencia supuesta del 15 %.

## 3. Distribución de claves

| Letra | Ítems | Cantidad |
|---|---|---|
| A | 33, 38, 42, 46, 48, 53, 58 | 7 |
| B | 31, 36, 41, 45, 49, 54, 56, 59 | 8 |
| C | 34, 35, 39, 44, 47, 52, 57 | 7 |
| D | 32, 37, 40, 43, 50, 51, 55, 60 | 8 |

Secuencia (31–60): B D A C C B D A C D B A D C B A C A B D D C A B D B C A B D.

- Cada letra aparece entre 6 y 9 veces. La racha más larga es de 2 (34–35: C C; 50–51: D D). El bloque A termina en C (ítem 30) y el B empieza en B, así que no hay rachas entre bloques.
- **Ciclo de claves.** `findKeyCycle` no encuentra ciclos (periodos 2, 3 y 4). En el primer borrador, la prueba de cuartetos detectó dos patrones repetidos: C D B A en 39–42 y 47–50, y D C B A en 43–46 y 51–54 (una secuencia «descendente» casi mecánica). Se rompieron reordenando opciones, sin cambiar su contenido: ítem 48 (A↔D, clave D → A), ítem 50 (A↔D, clave A → D), ítem 53 (A↔B, clave B → A) e ítem 54 (A↔B, clave A → B). Los cuartetos quedan todos distintos.
- **Longitud de la clave.** En el primer borrador la clave era estrictamente la opción más larga en 14 de 30 ítems (47 %, aviso del validador). Se acortaron claves o se alargaron distractores en 10 ítems (34, 36, 37, 40, 42, 43, 44, 45, 55, 58). La corrección dejó la clave como la **más corta** en 11 ítems, una pista inversa; se alargaron entonces las claves de 7 ítems (38, 39, 41, 47, 51, 52, 56). Versión final: la clave es estrictamente la más larga en 8 de 30 ítems (27 %; lo esperable por azar es ≈ 7,5). Por longitud, la clave queda 9 veces 1.ª (empates incluidos), 11 veces 2.ª, 5 veces 3.ª y 5 veces 4.ª.

## 4. Registro de revisión (segunda y tercera pasada)

Proceso: (1) primer borrador de los 30 ítems con cálculos verificados en un guion auxiliar; (2) revisión independiente de cada ítem: precisión científica, intento de refutar la clave, búsqueda de una segunda opción defendible, pistas, ajuste entre nivel y competencia, redundancia con el bloque A, con `src/assessment/bank.ts` y con las prácticas; (3) comprobación programática (`tests/unit/bloqueB.test.ts`, validador del bloque sin errores ni avisos, `npm run banco`). El estado final de los 15 criterios es «Cumple» en los 30 ítems; la tabla registra lo que **no** cumplía antes de corregirse y las decisiones de la revisión.

| N.º | Problema detectado en la revisión | Corrección aplicada / decisión |
|---|---|---|
| 31 | Riesgo de que D (nitrato) se defienda: el exceso de nutrientes produce floraciones que enturbian el agua. | El enunciado pide el cambio que «reduce **directamente**» la fotosíntesis; el nitrato es un nutriente que la estimula y el efecto de sombra sería indirecto. La justificación lo explica. |
| 32 | En el primer diseño de la red, el depredador del omnívoro también ocupaba dos niveles (dos respuestas defendibles). | Se rediseñó la red: nadie se come al cangrejo (el omnívoro) y el martín pescador solo come sardinatas (nivel 4). Se verificó que el cangrejo es el único con dos niveles. |
| 33 | Distractor sobre el tamaño corporal de los depredadores era en parte verdadero (menor gasto por kilogramo en animales grandes). | Se sustituyó por «la energía se destruye» (error de conservación). C castiga la regla del 10 % como ley exacta con los datos (8 %, 7,5 %, 6 %). |
| 34 | La vía branquial (D) no podía refutarse solo con los datos de campo; el contexto decía «las dos especies» sin nombrarlas. | Se añadió el ensayo de laboratorio con alimento libre de mercurio y se precisó «peces planctívoros y carnívoros». A se refuta porque los datos son concentraciones (µg/kg). |
| 35 | Ninguno sustantivo. | Se añadieron los supuestos del modelo (sin incendios, cosechas ni exportación por ríos) y la conversión 3 t C ≈ 11 t CO₂. |
| 36 | D (sustituir el fertilizante) podía parecer razonable para el fríjol. | D generaliza a «cualquier cultivo»; los datos muestran además 6,5 g frente a 7,0 g. Se verificó que el tratamiento 4 (menos nódulos con fertilizante) es coherente con la inhibición de la nodulación por nitrato. |
| 37 | C (el páramo aporta más agua) es una creencia común; había que hacerla refutable con los datos. | Las series se construyeron con volúmenes anuales casi iguales (sumas 588 y 603) y distinta variación (1,7 frente a 14 veces). Nivel 3 porque exige comparar total y variabilidad y descartar explicaciones. La justificación declara que dos microcuencas no bastan para confirmar. La clave se acortó. |
| 38 | Ambigüedad entre aumento absoluto y relativo (el mayor crecimiento relativo es 0–4 días). | El enunciado pide «el mayor número de frondas añadidas»; C usa precisamente la confusión con el crecimiento relativo. D (8–12 días, 240) obliga a comparar con 280. |
| 39 | Se revisó si D (esperar más para que se mezclen) es defendible, porque la mezcla también es un supuesto del método. | El enunciado pide el cambio que reduce el error por pérdida de marcas; esperar más aumenta la muda. Se calculó el ejemplo de sesgo (800 frente a 400). |
| 40 | Ninguno sustantivo. La clave era la más larga. | Se alargó C. La justificación limita la clasificación a la micorriza «descrita». |
| 41 | C (competencia por luz) es plausible en la naturaleza. | El experimento solo varió nutrientes, y al añadirlos casi desaparece el efecto; la clave dice «sobre todo por los nutrientes» y la justificación reconoce el efecto residual (espacio). |
| 42 | La clave era la más larga y contenía «sombra» dos veces. | Se reformuló y se alargó B. C (orden de llegada) se mantuvo como concepción alternativa plausible. |
| 43 | Ninguno sustantivo. La clave era la más larga. | Se alargó B. |
| 44 | La clave era la más larga (120 caracteres) y repetía «más diversa». | Se acortó; el índice de Simpson (0,27 frente a 0,80) queda solo en la justificación, para no exigir una fórmula. |
| 45 | Había que evitar que «aislante» se infiriera sin datos y que A (fuente de calor) fuera irrefutable. | Las curvas muestran el tallo más frío que el aire al mediodía (8 frente a 14 °C), lo que refuta una fuente de calor. Se descartó citar un estudio específico sobre frailejones por no poder verificar la referencia exacta. |
| 46 | Ninguno sustantivo. | La justificación advierte que la distribución real depende también de inundación, sedimento y competencia. |
| 47 | Riesgo de afirmar causalidad con cuatro arrecifes no asignados al azar; nivel inicial 2. | Se eligió la competencia de explicación con nivel 3 (comparar explicaciones) y la justificación declara la limitación. D se descarta por falta de evidencia, no por contradicción, y así se explica. |
| 48 | C (9 ha) debía ser un error de cálculo inequívoco. | C usa el interior de un solo fragmento; la justificación muestra el cálculo completo (64 ha frente a 36 ha) y declara las simplificaciones del modelo. Reordenado (clave D → A) para romper el ciclo. |
| 49 | A (agua vertida pobre en oxígeno) podía ser plausible. | El dato de 0 km (7,5 mg/L) la refuta; se añadió que la temperatura del vertimiento es similar a la del río para descartar el efecto de la temperatura sobre la solubilidad. |
| 50 | Se revisó la frase «sale menos energía al espacio de la que entra». | Es correcta para el desequilibrio transitorio; la justificación aclara que se alcanza un nuevo balance a mayor temperatura. Distractores B y D usan la confusión con la capa de ozono. Reordenado (clave A → D). |
| 51 | La resta del primer y último valor (borrador de B) daba un resultado aproximado defendible (≈ 1,9 ppm/año). | Se sustituyó por comparar mayo con noviembre del mismo año, que mezcla fases del ciclo de forma inequívoca. La descripción precisa «mínimo estacional» porque en 2021 el valor de enero es menor que el de noviembre. |
| 52 | «En contra del viento» era ambiguo. | Se cambió a «viento arriba / viento abajo». D atribuye la lluvia ácida al CO₂ (confusión con el efecto invernadero). Se verificó 10^1,3 ≈ 20. |
| 53 | El distractor A del borrador («cultivos distintos») era débil. | Se sustituyó por «el mismo manejo del cultivo», que confunde la variable independiente con una controlada. Reordenado (clave B → A). |
| 54 | D exige comprobar una proporcionalidad inversa (no simétrica); se verificó que no sea defendible. | Si fuera solo reparto, la captura por faena bajaría a ≈ 33 kg (−33 %), no a 24 kg (−52 %). Datos coherentes (faenas × captura por faena = captura total). Se evitó nombrar una especie real para no sugerir datos reales. Reordenado (clave A → B). |
| 55 | Ninguno sustantivo. | La justificación reconoce que una pila mal aireada también emite algo de metano; el enunciado dice «puede reducir». |
| 56 | Redundancia parcial con el 33 (flujo de energía). | El 33 explica la forma de la pirámide con datos; el 56 aplica el modelo a una decisión productiva con cálculo de varios pasos. La justificación aclara que solo se compara energía (no proteínas). |
| 57 | Redundancia de habilidad con `saber-rti-1` (variable de confusión) y con el ítem 30. | La tarea es distinta: elegir el diseño de comparación que controla la confusión (no identificarla), en un contexto de conservación. |
| 58 | C del borrador («es falsa porque en el mar se degradó 2 %») podía defenderse: la afirmación sin condiciones es engañosa. | Se reescribió como «no se sostiene en ningún ambiente… ningún tipo de plástico», refutada por el 92 % en compostaje. Se añadió el papel de celulosa como control positivo, que sube el ítem a nivel 3. |
| 59 | Ninguno sustantivo. | D presupone un hecho no verificado («prefieren siempre»), lo que la hace distinguible de la clave sin ser absurda. |
| 60 | La clave inicial («el tráfico no es la única fuente») no se podía sostener, porque en el día sin carro circulaban buses. | La afirmación del concejal y la clave se refieren a los **carros particulares**; los valores de madrugada y los picos residuales sustentan la clave. La justificación pide más días comparables. |

**Redundancia.** Se revisaron las preguntas ambientales de `src/assessment/bank.ts`: `saber-eco-1` (oxígeno y eutrofización en una ciénaga), `saber-red-1` (efecto en cascada en una red trófica), `saber-pob-1` (modelo logístico y deforestación), `saber-agu-1` (índice BMWP/Col), `saber-des-1` (compostaje y temperatura), `saber-ind-4` (vertimiento y límite permitido) y `saber-rti-1` (variable de confusión). Los ítems 32, 38, 49, 55 y 57 tocan esos contenidos con otra tarea: identificar omnivoría (no efectos en cascada), leer el intervalo de mayor crecimiento absoluto (no el efecto sobre K), explicar la forma espacial de la curva de oxígeno (no el ciclo día-noche), explicar el gas producido según el oxígeno (no la temperatura óptima) y elegir un diseño de comparación (no señalar la variable de confusión). Con el bloque A no hay solapamiento de contextos ni enunciados (verificado por prueba); el ítem A-008 (CO₂ de día y de noche en una planta) y el B-035 (balance de carbono de un bosque) comparten el modelo de fotosíntesis y respiración, pero a distinta escala y con distinta tarea.

## 5. Comprobaciones de cierre de la entrega (sección 16)

1. **Números presentes.** Están los ítems 31 a 60, con ids `SN-B-031` … `SN-B-060` en orden y sin duplicados (verificado por prueba).
2. **Correspondencia con la matriz.** Son 30 ítems: 10 de uso, 10 de explicación y 10 de indagación; 10, 12 y 8 de los niveles 1, 2 y 3, con nivel 3 en las tres competencias; 23 con datos o representaciones (mínimo 8). Todo verificado por prueba.
3. **Claves y justificaciones revisadas.** Hay una sola clave por ítem, con justificación que muestra el procedimiento y las unidades cuando hay cálculo. Cada distractor tiene su razón (`why`) y el error que lo originaría (`misconception`). Los cálculos se verificaron con un guion auxiliar: ítems 33, 34, 35, 36, 37, 38, 39, 41, 44, 45, 47, 48, 51, 52, 54, 56 y 60.
4. **Sin duplicaciones sustanciales.** Ni dentro del bloque ni con el bloque A o con el banco existente (sección 4). El validador del banco completo (60 ítems) no da errores; el único aviso es del bloque A (enunciado genérico repetido en A-007 y A-017), anterior a esta entrega.
5. **Estado de revisión.** Los 30 ítems quedan «Cumple» en los 15 criterios, después de las correcciones de la sección 4. Son material revisado con criterios técnicos y no validado psicométricamente.
6. **Balance global actualizado (entregas terminadas: 2 de 6).**

| Indicador | Acumulado tras la entrega 2 (A + B) | Meta del banco (180) | Pendiente |
|---|---|---|---|
| Uso comprensivo | 20 | 60 | 40 |
| Explicación de fenómenos | 20 | 60 | 40 |
| Indagación | 20 | 60 | 40 |
| Nivel 1 | 20 | 60 | 40 |
| Nivel 2 | 24 | 72 | 48 |
| Nivel 3 | 16 | 48 | 32 |
| Ítems con datos o representaciones | 44 (21 + 23) | ≥ 45 (encargo) / ≥ 48 (6 × 8) | Falta 1 para la meta del encargo; mantener al menos 8 por bloque |
| Claves A / B / C / D | 14 / 15 / 15 / 16 | Equilibradas | Las entregas siguientes pueden compensar ligeramente la A |
| Nivel 3 de uso comprensivo | 1 (B-056) | — | Incluir alguno más en C–F |

Pendientes: entregas 3 (C, química), 4 (D, física mecánica), 5 (E, electricidad, ondas y energía) y 6 (F, indagación e integración), con los mismos criterios.

## 6. Dudas científicas declaradas

- **Ítem 37.** La regulación hídrica del páramo está bien establecida en términos cualitativos, pero las series son ficticias y el contraste se simplifica: en cuencas reales influyen también la neblina captada por la vegetación, la evapotranspiración y la geología. El ítem solo afirma que los datos son coherentes con la retención y liberación lenta.
- **Ítem 45.** Que las hojas muertas de los frailejones aíslan el tallo y evitan su congelamiento es la interpretación aceptada en la ecología del páramo, pero no se cita una fuente concreta porque no se pudo verificar la referencia exacta durante la entrega; los valores son ficticios.
- **Ítem 47.** La disminución de peces nativos por el pez león es un efecto documentado en el Caribe, pero el ítem no reproduce ningún estudio real; con cuatro arrecifes sin asignación al azar, la clave se presenta como la explicación «mejor sustentada», no como prueba.
- **Ítem 48.** La profundidad del efecto de borde (100 m) es un supuesto del modelo; en la realidad varía entre decenas y cientos de metros según la variable y la especie.
- **Ítem 51.** Los valores son ficticios aunque de orden de magnitud realista (≈ 410–419 ppm, tendencia de 2,4 ppm/año y amplitud estacional de ≈ 6 ppm); la estación es hipotética y no representa a ninguna estación real.
- **Ítem 52.** La disminución de la acidez a 40 km se atribuye a la dispersión; también podrían influir la deposición seca y otras fuentes. El ítem no depende de ese detalle.
- **Ítem 56.** La eficiencia del 15 % es un supuesto didáctico; la eficiencia real de conversión del alimento en energía comestible varía mucho entre especies y sistemas de producción, y el ítem solo compara energía.
- **Ítem 60.** Un solo día sin carro no permite controlar todas las condiciones meteorológicas; el contexto las declara similares y la justificación pide más días comparables.
