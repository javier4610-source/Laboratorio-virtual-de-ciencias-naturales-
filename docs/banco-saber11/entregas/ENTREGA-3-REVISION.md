# Entrega 3 — Bloque C: Química y transformaciones de la materia (ítems 61–90)

**Archivo de ítems:** `src/assessment/avanzado/bloqueC.ts` (`BLOQUE_C`, ids `SN-C-061` … `SN-C-090`), registrado en `src/assessment/avanzado/bloques.ts` después de `BLOQUE_A`.
**Pruebas de la matriz:** `tests/unit/bloqueC.test.ts`.

> **Carácter del material.** Son ítems originales de práctica tipo Saber 11.°. **No** son preguntas oficiales del ICFES ni están avalados por el ICFES o el MEN. Las afirmaciones y evidencias son **formulaciones operativas propias del banco**, no transcripciones ni códigos oficiales. La distribución por competencias y niveles es una **decisión metodológica** del banco, no la ponderación oficial del examen. El bloque se revisó con criterios técnicos (15 criterios de la sección 13 del encargo), pero **no está validado psicométricamente**: no hubo aplicación piloto, así que no se informan índices de dificultad, discriminación ni funcionamiento de distractores.
>
> **Datos.** Los datos experimentales de 18 ítems (61, 66, 68, 70, 72, 73, 76, 78, 79, 80, 81, 82, 83, 84, 85, 87, 89 y 90) son **ficticios, con fines didácticos**, y así se rotulan en el contexto o en la tabla (`simulatedData: true`); varios se construyeron cerca de valores de referencia y lo dicen. Los ítems con datos reales citan solo fuentes verificables, sin URL inventadas: CIAAW/IUPAC (62), Brown, LeMay et al., *Química: la ciencia central* (63, fundamento conceptual), NIST Atomic Spectra Database y CRC Handbook (64), CRC Handbook (67 y 88) y Harris, *Quantitative Chemical Analysis* (79, rangos de viraje). Las constantes y masas molares se dan en cada ítem (R = 0,082 atm·L/(mol·K); masas molares redondeadas a partir de los pesos atómicos de la IUPAC).
>
> **Limitación.** Durante esta entrega no se consultaron en línea los documentos oficiales del ICFES ni del MEN. La correspondencia con las competencias sigue la descripción del encargo.

## 1. Matriz del bloque

Recurso «texto» significa que basta con el contexto y el enunciado. Los demás recursos exigen interpretar una tabla, una gráfica (`chart` con ejes, unidades y descripción textual), un esquema (`schemeDescription`), un experimento o un modelo.

| N.º | Id | Tema | Competencia | Afirmación (operativa) | Evidencia (operativa) | Nivel | Contexto | Recurso | Datos ficticios | Clave |
|---|---|---|---|---|---|---|---|---|---|---|
| 61 | SN-C-061 | Propiedades físicas y químicas de la materia: el magnesio | Uso comprensivo | Diferencia las propiedades físicas de las propiedades químicas de una sustancia. | Clasifica observaciones de laboratorio según impliquen o no la transformación de la sustancia en otras sustancias. | 1 | laboratorio | tabla | Sí | **B** |
| 62 | SN-C-062 | Estructura atómica: isótopos e iones | Uso comprensivo | Usa el modelo de la estructura del átomo para establecer la identidad de los elementos y las relaciones entre partículas. | A partir del número de protones, neutrones y electrones, reconoce isótopos de un elemento e identifica la carga de un ion. | 1 | datos-investigacion | tabla | No | **D** |
| 63 | SN-C-063 | Estructura atómica: niveles de energía y ensayo a la llama | Explicación | Evalúa explicaciones alternativas de un fenómeno a partir de su coherencia con un conjunto de evidencias. | Selecciona, entre cuatro explicaciones, la única compatible con todas las observaciones del ensayo a la llama y con el espectro de líneas. | 3 | laboratorio | experimento | No | **A** |
| 64 | SN-C-064 | Tabla periódica: primera energía de ionización | Uso comprensivo | Usa el modelo de la estructura electrónica para interpretar propiedades periódicas representadas en gráficas. | Reconoce en una gráfica de energía de ionización contra número atómico la tendencia en los períodos y las caídas al iniciar un nivel nuevo. | 2 | datos-investigacion | grafica | No | **C** |
| 65 | SN-C-065 | Propiedades periódicas: radio atómico en un período | Explicación | Explica la variación de las propiedades periódicas con el modelo de la estructura del átomo. | Explica por qué el radio atómico disminuye a lo largo de un período a partir de la carga nuclear y del nivel que ocupan los electrones externos. | 1 | laboratorio | texto | No | **A** |
| 66 | SN-C-066 | Enlace químico: propiedades de sustancias iónicas, metálicas y covalentes | Indagación | Interpreta datos experimentales para inferir el tipo de enlace de una sustancia. | Usa la conductividad en distintos estados, la solubilidad y la temperatura de fusión para identificar el sólido iónico y la evidencia decisiva. | 1 | laboratorio | tabla | Sí | **D** |
| 67 | SN-C-067 | Estructura molecular y polaridad: momento dipolar de los clorometanos | Explicación | Explica la polaridad de las moléculas a partir de la polaridad de los enlaces y de la geometría molecular. | Explica, con datos de momento dipolar, por qué una molécula con enlaces polares puede ser apolar. | 2 | datos-investigacion | tabla | No | **B** |
| 68 | SN-C-068 | Sustancias puras y mezclas: curvas de calentamiento | Indagación | Interpreta gráficas de resultados experimentales para obtener conclusiones sobre la composición de la materia. | Distingue una sustancia pura de una mezcla por el comportamiento de la temperatura durante la ebullición. | 2 | laboratorio | grafica | Sí | **C** |
| 69 | SN-C-069 | Soluciones: concentración porcentual y dilución | Uso comprensivo | Usa relaciones de concentración para resolver problemas de preparación de soluciones. | Calcula el volumen de una solución concentrada necesario para preparar una solución diluida y elige el procedimiento correcto. | 1 | salud-publica | texto | No | **D** |
| 70 | SN-C-070 | Soluciones: curvas de solubilidad y purificación por cristalización | Uso comprensivo | Usa modelos y representaciones de la solubilidad para resolver problemas de separación de mezclas. | Combina la lectura de dos curvas de solubilidad con cálculos de masa para predecir qué sustancia cristaliza y en qué cantidad. | 3 | laboratorio | grafica | Sí | **A** |
| 71 | SN-C-071 | Cambios físicos y químicos: la elaboración de la panela | Explicación | Explica transformaciones de la materia diferenciando los cambios físicos de los químicos. | Identifica, en un proceso productivo, la observación que evidencia la formación de sustancias nuevas. | 1 | industrial | texto | No | **C** |
| 72 | SN-C-072 | Reacciones químicas: precipitación e identificación de iones | Indagación | Usa resultados de pruebas experimentales para discriminar entre hipótesis alternativas. | Combina los resultados de tres pruebas químicas para identificar una sal y representar con una ecuación la reacción observada. | 2 | laboratorio | tabla | Sí | **B** |
| 73 | SN-C-073 | Conservación de la masa en la combustión de una vela | Explicación | Evalúa explicaciones de resultados experimentales con base en la ley de conservación de la masa. | Explica, con ayuda de un control, por qué un montaje que retiene los productos de una combustión gana más masa de la que pierde el combustible. | 3 | laboratorio | experimento | Sí | **D** |
| 74 | SN-C-074 | Balanceo de ecuaciones: reducción del óxido de hierro | Uso comprensivo | Usa la conservación de los átomos para representar reacciones químicas con ecuaciones balanceadas. | Reconoce la ecuación que conserva los átomos de cada elemento sin alterar las fórmulas de las sustancias. | 1 | industrial | texto | No | **A** |
| 75 | SN-C-075 | Estequiometría: fermentación alcohólica del jugo de caña | Uso comprensivo | Usa relaciones estequiométricas para resolver problemas de cantidades en procesos químicos. | Calcula, a partir de un porcentaje de composición y de una ecuación balanceada, la masa de producto que se puede obtener. | 2 | industrial | texto | No | **A** |
| 76 | SN-C-076 | Estequiometría: reactivo limitante a partir de datos experimentales | Indagación | Interpreta gráficas de resultados experimentales para establecer relaciones cuantitativas en una reacción. | Relaciona el cambio de pendiente de una gráfica de producto contra reactivo agregado con el cambio de reactivo limitante. | 2 | laboratorio | grafica | Sí | **C** |
| 77 | SN-C-077 | Gases ideales y estequiometría: el biogás de un biodigestor | Uso comprensivo | Integra el modelo del gas ideal y la estequiometría para resolver problemas en contextos tecnológicos. | Calcula la cantidad de un gas con la ecuación PV = nRT, la usa en una relación estequiométrica y obtiene la masa de un producto. | 3 | agricola-ambiental | texto | No | **D** |
| 78 | SN-C-078 | Gases: teoría cinética y difusión | Explicación | Explica el comportamiento de los gases con el modelo cinético-molecular. | Relaciona la posición en que se encuentran dos gases que se difunden con la diferencia de rapidez media de sus moléculas a igual temperatura. | 2 | laboratorio | experimento | Sí | **B** |
| 79 | SN-C-079 | Ácidos y bases: estimación del pH con indicadores | Indagación | Interpreta resultados experimentales presentados en tablas para obtener conclusiones. | Combina los colores de tres indicadores con sus rangos de viraje para acotar el pH de una muestra. | 1 | experimento-escolar | tabla | Sí | **C** |
| 80 | SN-C-080 | Ácidos y bases: neutralización de un suelo ácido con cal agrícola | Indagación | Evalúa el alcance de las conclusiones que se pueden obtener de un experimento. | Selecciona la conclusión que describe la tendencia de los datos sin extrapolar ni afirmar más de lo que el diseño permite. | 3 | agricola-ambiental | grafica | Sí | **D** |
| 81 | SN-C-081 | Oxidación y reducción: zinc en solución de sulfato de cobre(II) | Uso comprensivo | Usa los conceptos de oxidación y reducción para interpretar reacciones y calcular cantidades. | Identifica la especie que se oxida y la que se reduce, y relaciona por estequiometría la masa de metal disuelto con la de metal depositado. | 2 | laboratorio | experimento | Sí | **A** |
| 82 | SN-C-082 | Oxidación y reducción: serie de actividad de los metales | Indagación | Analiza resultados experimentales sistemáticos para establecer un orden y hacer predicciones. | Ordena metales por su tendencia a oxidarse a partir de una tabla de reacciones de desplazamiento y predice un procedimiento de recuperación. | 2 | laboratorio | tabla | Sí | **B** |
| 83 | SN-C-083 | Velocidad de reacción: efecto de la temperatura | Indagación | Interpreta gráficas de resultados experimentales para identificar el efecto de una variable. | Relaciona el tiempo de reacción medido con la velocidad y describe cuantitativamente el efecto de la temperatura. | 1 | experimento-escolar | grafica | Sí | **D** |
| 84 | SN-C-084 | Velocidad de reacción: catalizadores y energía de activación | Explicación | Explica el efecto de los catalizadores con el modelo de la energía de activación. | Interpreta un diagrama de energía con y sin catalizador para explicar el aumento de la velocidad sin cambio de la energía de reacción. | 2 | laboratorio | esquema | Sí | **C** |
| 85 | SN-C-085 | Equilibrio químico: descomposición de la caliza en sistema cerrado y abierto | Explicación | Explica el comportamiento de sistemas en equilibrio con el modelo de equilibrio dinámico y el principio de Le Châtelier. | Compara explicaciones de por qué una descomposición se detiene en un recipiente cerrado y se completa cuando se retira continuamente un producto gaseoso. | 3 | industrial | experimento | Sí | **A** |
| 86 | SN-C-086 | Química del carbono: grupos funcionales en la fermentación del café | Uso comprensivo | Usa la estructura de los compuestos orgánicos para clasificarlos y relacionarlos mediante reacciones. | Identifica los grupos funcionales alcohol, ácido carboxílico y éster en fórmulas semidesarrolladas y reconoce la reacción química (esterificación) que relaciona los tres compuestos. | 2 | agricola-ambiental | texto | No | **B** |
| 87 | SN-C-087 | Química del carbono: solubilidad de los alcoholes y longitud de la cadena | Explicación | Explica propiedades de las sustancias orgánicas a partir de su estructura molecular y de las interacciones entre moléculas. | Explica la disminución de la solubilidad en agua de los alcoholes al crecer la cadena, con la relación entre la parte polar y la parte apolar de la molécula. | 2 | laboratorio | grafica | Sí | **D** |
| 88 | SN-C-088 | Separación de mezclas y propiedades físicas: mercurio y oro en la minería | Explicación | Explica procesos tecnológicos y sus implicaciones a partir de propiedades físicas de las sustancias. | Explica la separación de una amalgama por calentamiento con la diferencia de temperaturas de ebullición y reconoce cómo una retorta reduce las emisiones de mercurio. | 1 | industrial | esquema | No | **A** |
| 89 | SN-C-089 | Interpretación de experimentos químicos: extracción del café y control de variables | Indagación | Evalúa diseños experimentales y propone modificaciones que permiten poner a prueba una hipótesis. | Identifica una variable no controlada en un diseño de extracción y selecciona la modificación que permite atribuir el efecto a la variable estudiada. | 3 | experimento-escolar | experimento | Sí | **C** |
| 90 | SN-C-090 | Interpretación de experimentos químicos: titulación del vinagre, precisión y exactitud | Indagación | Evalúa la validez de conclusiones a partir de datos experimentales repetidos, distinguiendo precisión de exactitud. | Calcula la concentración a partir de una titulación y juzga qué conclusión se sostiene cuando un grupo obtiene resultados repetibles pero desplazados. | 3 | laboratorio | tabla | Sí | **B** |


## 2. Distribución del bloque

### 2.1 Competencia × nivel

| Competencia | Nivel 1 | Nivel 2 | Nivel 3 | Total |
|---|---|---|---|---|
| Uso comprensivo del conocimiento científico | 4 | 4 | 2 | **10** |
| Explicación de fenómenos | 3 | 4 | 3 | **10** |
| Indagación | 3 | 4 | 3 | **10** |
| **Total** | **10** | **12** | **8** | **30** |

Siguiendo la recomendación de la entrega 1, el nivel 3 se repartió entre las tres competencias. Los dos ítems de uso comprensivo de nivel 3 son problemas de varios pasos: la predicción de una cristalización fraccionada con dos curvas de solubilidad (70) y la integración del gas ideal con la estequiometría (77).

### 2.2 Recursos

| Recurso | Ítems | Cantidad |
|---|---|---|
| Tabla | 61, 62, 66, 67, 72, 79, 82, 90 | 8 |
| Gráfica | 64 (líneas, datos de referencia), 68 (líneas, 2 series), 70 (líneas, 2 series), 76 (líneas), 80 (líneas), 83 (líneas), 87 (barras) | 7 |
| Experimento | 63, 73 (con tabla y control), 78, 81, 85, 89 (con tabla) | 6 |
| Esquema | 84 (diagrama de energía), 88 (montaje con retorta) | 2 |
| Solo texto | 65, 69, 71, 74, 75, 77, 86 | 7 |

**23 de 30 ítems** exigen interpretar de forma sustantiva datos, tablas, gráficas, esquemas o diseños experimentales (mínimo del bloque: 8; meta del encargo: ≈ 15). Las siete gráficas tienen ejes rotulados con unidad entre paréntesis y descripción textual completa.

### 2.3 Cobertura temática

| Subtema del bloque C | Ítems |
|---|---|
| Propiedades físicas y químicas de la materia | 61 (y 88, propiedades físicas en una separación) |
| Estructura atómica | 62, 63 |
| Tabla periódica y propiedades periódicas | 64, 65 |
| Enlaces químicos | 66 |
| Estructura molecular y polaridad | 67 (y 87, parte polar y apolar) |
| Sustancias puras y mezclas | 68 (y 70, 88, separación de mezclas) |
| Soluciones, concentración y diluciones | 69, 70 |
| Cambios físicos y químicos | 71 |
| Reacciones químicas | 72 (y 81, 82) |
| Conservación de la masa | 73 |
| Balanceo de ecuaciones | 74 |
| Relaciones cuantitativas y estequiometría (con reactivo limitante) | 75, 76, 77 |
| Gases y comportamiento de la materia | 77, 78 |
| Ácidos, bases y pH | 79, 80 (y 90, titulación) |
| Oxidación y reducción | 81, 82 |
| Velocidad de reacción | 83, 84 |
| Equilibrio químico (nivel Le Châtelier) | 85 |
| Química del carbono y sustancias orgánicas | 86, 87 |
| Interpretación de experimentos y análisis de resultados químicos | 88, 89, 90 (y 73, 76, 83) |

Contextos colombianos sin exigir conocimiento regional: panela y trapiche (71), etanol de caña (75), biodigestor en una finca (77), cal agrícola en un cafetal (80), fermentación del café (86), preparación de café (89), minería de oro con mercurio, tratada con prudencia (88), y desinfección en el comedor escolar (69).

## 3. Distribución de claves

| Letra | Ítems | Cantidad |
|---|---|---|
| A | 63, 65, 70, 74, 75, 81, 85, 88 | 8 |
| B | 61, 67, 72, 78, 82, 86, 90 | 7 |
| C | 64, 68, 71, 76, 79, 84, 89 | 7 |
| D | 62, 66, 69, 73, 77, 80, 83, 87 | 8 |

Secuencia (61–90): B D A C A D B C D A C B D A A C D B C D A B D C A B D A C B.

- Cada letra aparece entre 6 y 9 veces. Se dieron 8 claves a A y a D para compensar el bloque A (A 7, D 8 allí).
- La racha más larga es de 2 (74–75: A A). No hay más de 3 claves iguales seguidas, ni dentro del bloque ni en la unión con el bloque A (ítem 30: C; ítem 61: B), aunque esa unión depende del bloque B, que va en medio.
- **Sin ciclo mecánico.** `findKeyCycle` del validador (períodos 2, 3 y 4 en ventanas de 2p + 2) devuelve `null`. Ningún cuarteto consecutivo no solapado se repite (BDAC, ADBC, DACB, DAAC, DBCD, ABDC, ABDA y CB). La secuencia se fijó antes de redactar y no se generó por rotación.
- **Longitud de la clave.** En el primer borrador la clave era la opción estrictamente más larga en 9 ítems (63, 65, 71, 80, 83, 84, 85, 86 y 90). Se alargó un distractor en 65 y se acortaron las claves de 63, 83, 85, 86 y 90, que siguen siendo las más largas por pocos caracteres. Versión final: 8 de 30 (27 %; lo esperable por azar es ≈ 7,5; la prueba exige ≤ 10 y el validador ≤ 40 %). En 61, 75, 77 y 79 las opciones tienen la misma estructura y casi la misma longitud (valores numéricos o pares de observaciones).

## 4. Registro de revisión (segunda pasada independiente)

Proceso: (1) borrador de los 30 ítems con una matriz fijada de antemano (competencia, nivel, recurso y clave); (2) todos los cálculos y relaciones verificados con un guion (`bloqueC-check/calc.py` en el área de trabajo: masas, moles, diluciones, gases, cocientes de tiempos, aumentos de pH, titulación, balanceo por conteo de átomos, lógica de las pruebas de identificación y de la serie de actividad); (3) revisión independiente de cada ítem: precisión científica, intento de refutar la clave, búsqueda de una segunda opción defendible, pistas, ajuste de nivel y competencia, y redundancia con `src/assessment/bank.ts`, con las preguntas de las prácticas de química y con el bloque A; (4) comprobación programática con el validador y con `tests/unit/bloqueC.test.ts`. La tabla registra lo que no cumplía antes de corregirse; el estado final es «Cumple» en los 15 criterios de los 30 ítems.

| N.º | Problema detectado en la revisión | Corrección aplicada |
|---|---|---|
| 61 | Riesgo de que «se dobla sin romperse» se lea como cambio de la sustancia. | Se mantiene como distractor (D) y la justificación explica que cambia la forma, no la sustancia. Opciones de igual estructura y longitud. |
| 62 | Una opción del borrador («II y IV son del mismo elemento») era verdadera aunque incompleta: dos claves defendibles. | Se reescribieron las cuatro opciones como afirmaciones de relación, con una sola verdadera. Se añadió una fuente real (CIAAW) porque la tabla no es ficticia. |
| 63 | **Riesgo científico.** El color verde-azulado del CuCl₂ en la llama se debe en gran parte a especies moleculares (CuCl), y lo mismo ocurre con los alcalinotérreos (SrOH, CaOH); la clave hablaba de los «electrones del metal». | Se usaron solo sales de Li, Na y K, cuyos colores se deben a líneas atómicas. Los pares NaCl/NaNO₃ y LiCl/KCl refutan el distractor del anión y la misma carga +1 refuta el de la carga. La clave se acortó. |
| 64 | Hubo que comprobar los valores. | Valores redondeados de la base del NIST y del CRC; se verificó por guion que los alcalinos son el mínimo de su período y que el grupo 1 decrece (520 > 496 > 419 kJ/mol). |
| 65 | La opción sobre los neutrones debía ser falsa también en los datos. | La justificación indica que el ²³Na tiene 12 neutrones y el ³⁵Cl 18. Se alargó B para que la clave no fuera la más larga. |
| 66 | Que Z (fusión muy alta) pudiera defenderse como iónico. | Z no conduce ni fundido; la clave usa la evidencia decisiva (conduce fundido o disuelto, no en estado sólido). |
| 67 | **Error de diseño evitado.** El borrador usaba la desviación de chorros de líquidos con una barra cargada, demostración clásica cuya interpretación por dipolos permanentes está cuestionada (líquidos apolares también se desvían por inducción de carga). | Se sustituyó por momentos dipolares tabulados (CRC). Se añadió el CH₄ (0 D) para refutar con los datos el distractor «más cloros, menos polar». |
| 68 | Se verificó que B (sustancia pura con otra temperatura de ebullición) no se pueda defender. | La clave usa «probablemente» y la justificación aclara que la gráfica de P es coherente con una sustancia pura pero no la identifica. |
| 69 | Una opción del borrador («mezclar 200 mL con 10 L de agua») daba 0,098 %, casi correcta. | Se eliminó; todos los procedimientos dicen «completar hasta 10 L». Cada distractor corresponde a un error de cálculo distinto, verificado (0,025 %, 0,001 % y 0,25 %). Redundancia: el banco tiene una dilución molar con material volumétrico; este ítem usa % m/v y otra tarea. |
| 70 | La mezcla KNO₃–NaCl es un sistema de sales recíprocas (podría cristalizar KCl o NaNO₃). | El contexto declara la simplificación (solubilidades independientes, sin evaporación). Se declara como duda en la sección 6. |
| 71 | El cambio de color por sí solo no siempre indica reacción. | La clave combina color y aroma nuevos que persisten al enfriar; la justificación nombra la caramelización y el pardeamiento no enzimático. |
| 72 | En el borrador aparecía el AgNO₃, que con carbonato también precipita (Ag₂CO₃) y con sulfato forma una sal poco soluble: dos sales compatibles con la prueba. | Se eliminaron las pruebas con plata; quedan tres pruebas que discriminan una sola sal. D tiene la sal correcta pero el precipitado equivocado, y el enunciado pide ambas cosas. |
| 73 | El primer diseño (descomposición de la caliza) se reservó para el ítem 85. La combustión de la lana de acero y los sistemas abiertos ya están en la práctica `conservacion` y en el banco. | Se usó la vela con tubo absorbente y un control con la vela apagada que refuta la hipótesis de la humedad. Balance verificado con C₂₅H₅₂: 0,50 g de parafina + 1,72 g de O₂ = 1,56 g de CO₂ + 0,66 g de H₂O. |
| 74 | B «balancea» cambiando un subíndice (CO₄): podía considerarse balanceada. | El enunciado pide la ecuación que representa «esta reacción», cuyo producto es CO₂ según el contexto; B queda como error de cambiar fórmulas. |
| 75 | El banco ya calcula la masa de H₂ con el zinc y la glucosa en la respiración. | Se usó la fermentación alcohólica con un paso previo de composición porcentual (15 %). 460 g verificados (460,3 g con masas IUPAC). |
| 76 | El distractor del equilibrio podía parecer razonable. | La justificación calcula el máximo (244 mL), que coincide con la meseta. Enunciado cambiado para no repetir el genérico de los ítems 68 y 83 (aviso del validador). |
| 77 | Ninguno sustantivo. | Se verificaron los cuatro valores (1,76; 0,64; 2,42 y 19,6 kg). |
| 78 | **Riesgo científico.** Un distractor del borrador («salió más gas de un algodón») no se podía refutar: en la realidad la posición del anillo también depende de las concentraciones. | Se sustituyó por la idea de que el gas pesado «cae». La justificación aclara que la difusión en aire no reproduce exactamente la relación de Graham (1,44 frente a 1,47). |
| 79 | Ninguno sustantivo. | Rangos de viraje con fuente real; los colores de la muestra son ficticios y así se rotulan. |
| 80 | B («la mejor dosis») debía quedar refutada por el diseño. | El contexto dice que las macetas no tenían plantas y que hubo una maceta por dosis; la justificación calcula los aumentos por gramo (0,8; 0,5; 0,25; 0,075). |
| 81 | En el borrador la masa perdida (0,65 g) daba 0,0099 mol y un resultado ambiguo (0,63 o 0,64 g). | Se ajustó a 0,654 g → 0,0100 mol → 0,635 g ≈ 0,64 g. |
| 82 | D tenía el orden correcto: debía fallar en la predicción. | La pregunta pide el orden y el metal recuperador; D falla en lo segundo. |
| 83 | Clave más larga; enunciado genérico repetido. | Se acortó la clave y se especificó el enunciado. Cocientes verificados (1,97; 1,97; 1,94) y el 120/31 ≈ 3,9 que refuta A. |
| 84 | Los valores de energía de activación son cercanos a los citados en textos, pero no se verificaron con una fuente primaria. | Se rotulan como datos ficticios «cercanos a valores de referencia». |
| 85 | El NO₂/N₂O₄ con temperatura ya está en el banco; la compresión, el FeSCN²⁺, el amoníaco y la esterificación ya están en la práctica `equilibrio`. | Se eligió un equilibrio heterogéneo (CaCO₃ ⇌ CaO + CO₂) en sistema cerrado y abierto, de nivel Le Châtelier. Cada distractor contradice un dato explícito (ausencia de O₂ en la ecuación, caliza sobrante, misma temperatura). La clave se acortó. |
| 86 | **Error científico del borrador.** La clave decía que el acetato de etilo «se forma» en la fermentación a partir del ácido acético y el etanol; en los microorganismos se forma sobre todo por vía enzimática (acetil-CoA y etanol), no por esterificación directa. | La clave dice ahora que el éster «se puede obtener haciendo reaccionar I con II» (relación química) y la justificación aclara que la ruta biológica es distinta. Se equilibraron las longitudes. |
| 87 | El banco ya tiene ítems de temperatura de ebullición de alcanos e isómeros y de fuerzas intermoleculares con masa molar parecida. | Se eligió la solubilidad en agua frente a la longitud de la cadena. C (más puentes de hidrógeno) se refuta porque todas las moléculas tienen un solo –OH. |
| 88 | Hubo que evitar afirmar que la amalgama no contiene compuestos (hay fases intermetálicas oro-mercurio) y hacer afirmaciones legales que no se verificaron. | La clave se basa en la diferencia de volatilidad y no niega la interacción química; el contexto dice «práctica peligrosa… restringida» sin citar normas. La justificación advierte que la retorta reduce el riesgo pero no lo elimina. |
| 89 | A (repetir) es una buena práctica, pero no corrige la confusión. | La clave combina el control de la molienda con la repetición. |
| 90 | Clave más larga; la palabra «confirman» era demasiado fuerte. | Se reformuló con «coinciden» y «sugiere». Cálculo verificado: 16,7 mL esperados; grupos 1 y 2 → 5,0 % m/v; grupo 3 → 5,7 % m/v. |

**Redundancia.** Se revisaron las preguntas químicas de `src/assessment/bank.ts` (suero al 0,9 %, dilución 1,0 → 0,05 M, Zn + HCl, rendimiento de CO₂, pH 2 frente a 4, sal de mar, bolsa de papas en Bogotá, tamaño de partícula del mármol, NO₂/N₂O₄, conservación en recipientes abiertos, glucosa y oxígeno, mol en masas iguales, ángulos VSEPR, óxidos, hidrólisis de sales, nomenclatura, alcanos, xilenos, isooctano, fuerzas intermoleculares, aminas y esterificación) y las preguntas de las prácticas `acidos-sales`, `balanceo`, `cinetica`, `conservacion`, `equilibrio`, `estequiometria`, `gases`, `geometria`, `mezclas`, `mol`, `ph`, `soluciones` e `hidrocarburos`. Se reemplazaron dos borradores por redundancia (73 y 85, que compartían la caliza) y se eligieron tareas distintas en los temas que se cruzan (69, 75, 83, 85, 87).

## 5. Comprobaciones de cierre de la entrega (sección 16)

1. **Números presentes.** Están los ítems 61 a 90, con ids `SN-C-061` … `SN-C-090` en orden y sin duplicados (verificado por prueba).
2. **Correspondencia con la matriz.** Son 30 ítems: 10 de uso, 10 de explicación y 10 de indagación; 10, 12 y 8 de los niveles 1, 2 y 3; 23 con datos o representaciones (mínimo 8). Las tablas tienen encabezados con unidades y las gráficas, ejes con unidad entre paréntesis y descripción textual. Verificado por `tests/unit/bloqueC.test.ts` y por el validador (`npm run banco`: 60 ítems, 0 errores; el único aviso es anterior y corresponde al bloque A, ítems 7 y 17).
3. **Claves y justificaciones revisadas.** Hay una sola clave por ítem, con justificación que muestra el procedimiento y las unidades cuando hay cálculo. Cada distractor tiene su razón (`why`) y el error que lo originaría (`misconception`). Los cálculos de los ítems 62, 64, 69, 70, 72, 73, 74, 75, 76, 77, 78, 80, 81, 82, 83 y 90 se verificaron con el guion auxiliar.
4. **Sin duplicaciones sustanciales.** No hay contextos ni enunciados repetidos en el bloque (el validador no da avisos de este bloque) ni con el banco existente (sección 4).
5. **Estado de revisión.** Los 30 ítems quedan «Cumple» en los 15 criterios, después de las correcciones de la sección 4. Son material revisado con criterios técnicos y no validado psicométricamente.
6. **Balance global actualizado (entregas terminadas: 1 y 3; la entrega 2, bloque B, está en curso por separado).**

| Indicador | Bloque A | Bloque C | Acumulado A + C | Meta del banco (180) | Pendiente (B, D, E, F) |
|---|---|---|---|---|---|
| Uso comprensivo | 10 | 10 | 20 | 60 | 40 |
| Explicación de fenómenos | 10 | 10 | 20 | 60 | 40 |
| Indagación | 10 | 10 | 20 | 60 | 40 |
| Nivel 1 | 10 | 10 | 20 | 60 | 40 |
| Nivel 2 | 12 | 12 | 24 | 72 | 48 |
| Nivel 3 | 8 | 8 | 16 | 48 | 32 |
| Ítems con datos o representaciones | 21 | 23 | 44 | ≥ 45 (encargo) / ≥ 48 (6 × 8) | Se alcanza con la próxima entrega que cumpla su mínimo de 8 |
| Claves A / B / C / D | 7 / 7 / 8 / 8 | 8 / 7 / 7 / 8 | 15 / 14 / 15 / 16 | Equilibradas | Las entregas siguientes pueden compensar un poco B |
| Uso comprensivo de nivel 3 | 0 | 2 | 2 | — | Conviene incluir alguno en D, E y F |

Pendientes: entregas 2 (B, en curso), 4 (D), 5 (E) y 6 (F). Se mantienen los criterios: matriz 10/10/10 y 10/12/8, datos ficticios rotulados, claves entre 6 y 9 por letra sin rachas de más de 3 ni ciclos, y control de la longitud de la clave.

## 6. Dudas científicas declaradas

- **Ítem 70.** KNO₃ + NaCl en agua es un sistema de sales recíprocas (K⁺, Na⁺, NO₃⁻, Cl⁻); en la realidad las solubilidades no son independientes y podría cristalizar algo de KCl. El ítem lo resuelve con un supuesto explícito. Los valores de las curvas son ficticios, cercanos a los de tablas.
- **Ítem 78.** La difusión de NH₃ y HCl a través del aire de un tubo no sigue exactamente la ley de Graham (que describe la efusión), y la posición real del anillo depende también de las concentraciones. La clave solo afirma la relación cualitativa entre masa y rapidez media.
- **Ítem 84.** Las energías de activación (75 y 56 kJ/mol) son cercanas a valores que suelen citar los textos para la descomposición del H₂O₂ sin catalizador y con yoduro, pero no se contrastaron con una fuente primaria; por eso se rotulan como ficticias.
- **Ítem 85.** Que «quede mucha caliza» en el recipiente cerrado depende de su volumen (en un recipiente grande se descompondría más antes de alcanzar la presión de equilibrio del CO₂). El contexto lo da como dato.
- **Ítem 86.** La ecuación de esterificación describe la relación química entre los tres compuestos, no la ruta biológica de su formación durante la fermentación; la justificación lo aclara. La presencia de estas sustancias en la fermentación del café se afirma como posibilidad («pueden formarse»).
- **Ítem 88.** No se citan normas colombianas sobre el mercurio porque no se verificaron durante la entrega; el ítem se limita a la química de la separación y al riesgo del vapor.
- **Ítem 63.** El color violeta del potasio suele quedar oculto por trazas de sodio; en el aula se observa mejor con vidrio de cobalto. No afecta la clave.
- **Ítem 67.** Los valores de momento dipolar están redondeados (CH₃Cl ≈ 1,87 D; CH₂Cl₂ ≈ 1,60 D; CHCl₃ ≈ 1,04 D).
