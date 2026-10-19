# Plantillas pedagógicas del programa v2

Fecha: 2026-10-18 · Estado: **borrador para aprobación del docente** (criterio de salida de la Fase 2: «plantillas de
actividad y de ficha de enriquecimiento aprobadas»).

Fuentes: prompt maestro, secciones 8 y 9; estructura `PracticeDef` (`src/core/types.ts`); modos de la práctica
(`src/pages/PracticePage.tsx`); modo avanzado (`src/components/Advanced.tsx`, `src/lib/advanced.ts`); escala de
desempeño de las guías en PDF (`scripts/guias/generar_guias.py`).

---

## A. Plantilla de actividad (sección 8.1)

Cada práctica o módulo nuevo se describe con esta plantilla antes de programarlo. Los campos marcados con
`PracticeDef.…` ya existen en el código y se reutilizan; los demás son nuevos o se documentan aparte.

### A.1 Identificación

| Campo | Contenido | Dónde vive hoy |
|---|---|---|
| Identificador | Ruta estable de la práctica (no cambia entre versiones; base del QR) | `PracticeDef.id` |
| Título, grado, área, tema, duración | | `title`, `grade`, `area`, `topic`, `durationMin` |
| Pregunta problema | Situación cotidiana o de la región | `problemQuestion` |

### A.2 Objetivo de aprendizaje como competencia

- Redactado con un verbo observable: **explicar, calcular, comparar, argumentar, predecir, diseñar**. Ejemplo de forma:
  «El estudiante calcula … y explica por qué … usando datos de su experimento».
- Competencias Saber 11 implicadas: uso comprensivo del conocimiento científico, explicación de fenómenos, indagación
  (`PracticeDef.competencies`).
- Referencia curricular (`PracticeDef.curricularLink`):
  - **EBC (MEN, 2006)** y **DBA de Ciencias Naturales (MEN, 2016, v1)**, según los referentes que cita el README.
  - Toda correspondencia se escribe con la marca: **«Propuesta: … Validar número y enunciado con el documento
    oficial del MEN.»** No se escribe un número de DBA ni un enunciado textual que no se haya verificado en el
    documento oficial. La validación se registra en el panel docente (pestaña de validación curricular).
  - La vigencia de esas versiones de los documentos del MEN está **por verificar** (el entorno de desarrollo no pudo
    descargarlos).
- Marcos internacionales: solo si aplican y con referencia verificable.

### A.3 Ciclo de indagación

| Etapa | Qué hace el estudiante | Apoyo existente |
|---|---|---|
| Pregunta | Lee la pregunta problema | `problemQuestion` |
| Diseño | Clasifica variables independiente, dependiente y controladas; planea los ensayos | `variables`, actividad de clasificación; `procedure` |
| Recolección | Ejecuta ensayos y los guarda en el cuaderno | Área interactiva, `api.addTrial` |
| Análisis | Grafica, linealiza, ajusta un modelo, calcula incertidumbre; revisa la tendencia detectada y el control de variables | Cuaderno de datos (`DataPanel`), `relations` (`RelationPair`, opcional), `interpretation` |
| Conclusión | Afirmación, evidencia y razonamiento | `conclusionGuide` |
| Comunicación | Informe para el docente; registro de experimento exportable (ADR 0003) | `src/lib/report.ts` |

### A.4 Tres niveles de mediación (guiado, semiguiado, abierto)

Correspondencia con los modos que ya tiene la aplicación (`Mode = 'guiada' | 'libre' | 'evaluacion'`):

| Nivel del prompt | Modo actual | Correspondencia | Qué falta |
|---|---|---|---|
| Guiado | **Práctica guiada** | Completa: etapas en orden y ensayos antes de analizar | — |
| Semiguiado | No existe | — | Un modo intermedio: etapas abiertas, pero con pistas; o un procedimiento con pasos que el estudiante completa. **Por diseñar** |
| Abierto | **Exploración libre** (parcial) | Todas las etapas abiertas, sin calificación | Es exploración, no indagación abierta: el estudiante no formula su propia pregunta ni diseña el experimento. La práctica `reto` sí lo hace (diseño con niveles, réplicas, presupuesto y semilla) y es el modelo a seguir |
| — | **Evaluación** | No es un nivel de mediación: cambia la forma de calificar (cuenta solo el primer intento de cada pregunta) | Se mantiene como modo aparte |

### A.5 Tres capas de profundidad (básica, media, avanzada)

Regla: la capa cambia la presentación y la explicación, **nunca el resultado del cálculo**.

| Capa del prompt | Hoy | Qué falta |
|---|---|---|
| Educativa básica | Vista normal de la práctica | — |
| Media | Sin separación explícita: la vista normal mezcla contenido básico y medio | Definir qué se oculta o se simplifica en la capa básica (por ejemplo, la rodadura en `energia` está marcada como extensión para 11.º en `curricularLink.note`) |
| Avanzada | **Modo avanzado** (interruptor por práctica, disponible en 19 prácticas según `INVENTARIO.md`): ecuaciones del modelo con los valores actuales, constantes editables en algunas prácticas, curva del modelo con residuos | Extender a más prácticas donde se justifique |

### A.6 Concepciones erróneas frecuentes

Para cada tema: la concepción, la pregunta o el experimento que la confronta y dónde aparece en la práctica (las
opciones de respuesta ya llevan un `feedback` por opción en `PracticeDef.assessment`, que puede asociarse a la
concepción).

| Concepción errónea | Cómo se confronta | Dónde |
|---|---|---|
| … | … | Pregunta `id` / etapa / experimento |

### A.7 Evidencia de aprendizaje

Producto evaluable que deja cada actividad: tabla de datos con incertidumbre, gráfica interpretada, conclusión
afirmación–evidencia–razonamiento, respuestas por competencia e informe o registro exportado.

### A.8 Rúbrica por competencia

El prompt pide los niveles **inicial, básico, alto, superior**. Las guías en PDF de la institución usan **Bajo
(1,0 – 2,9), Básico (3,0 – 3,9), Alto (4,0 – 4,5), Superior (4,6 – 5,0)** (`scripts/guias/generar_guias.py`).
Propuesta: usar la escala institucional (Bajo en lugar de «inicial»). **El docente debe confirmar** la escala y los
rangos vigentes en el sistema institucional de evaluación.

| Competencia | Bajo | Básico | Alto | Superior |
|---|---|---|---|---|
| Uso comprensivo del conocimiento científico | | | | |
| Explicación de fenómenos | | | | |
| Indagación | | | | |

---

## B. Ficha de enriquecimiento por práctica (sección 9)

Se llena **antes** de modificar una práctica existente. Si una ampliación no pasa la prueba de inclusión, no se
implementa (o queda como material opcional de profundización).

### B.1 Prueba de inclusión (regla anti-adorno, sección 8.3)

> «El estudiante aprende **X** al manipular **Y** y observar **Z**.»

Cada ampliación propuesta debe completar la frase con un concepto (X), una variable que el estudiante controla (Y) y
una salida observable calculada por el modelo (Z). Si no se puede, se descarta.

### B.2 Formato de la ficha

```markdown
## Ficha de enriquecimiento · `<id>` · <título>

- Fecha · Responsable · Estado (borrador / aprobada / implementada)

### 1. Estado actual (verificado en el código)
- Modelo: archivo, ecuaciones, unidades, rangos de entrada, supuestos y límites (ModelSpec)
- Laboratorio: controles, salidas, gráficas, modo instrumento real (sí/no), modo avanzado (sí/no)
- Pruebas: unitarias, valores dorados (tests/golden), E2E
- Procedencia (ADR 0002): estatus de los datos y de la escena

### 2. Brechas frente al prompt (sección 9 y subsección del área)

### 3. Ampliaciones propuestas
| Ampliación | «Aprende X al manipular Y y observar Z» | Justificación científica | ¿Se incluye? |

### 4. Pruebas de referencia (valores y tolerancias)

### 5. Riesgos para lo existente y transición (sección 4.1)
```

### B.3 Lista de comprobación

- [ ] Las afirmaciones del «estado actual» se verificaron en el código (rutas de archivo citadas).
- [ ] Cada ampliación completa la frase de inclusión.
- [ ] Panel de fundamentos y variables editables **con unidades**.
- [ ] Gráficas que se actualizan tras cada cálculo; tabla y registro de condiciones; comparación entre experimentos.
- [ ] Incertidumbre: si hay ruido, rotulado como **sintético** y con semilla reproducible.
- [ ] Exportación con metadatos (ADR 0003) y estatus epistémico (ADR 0002).
- [ ] Fuentes científicas verificables; ningún identificador ni referencia inventados.
- [ ] Conexión con conceptos moleculares solo si hay justificación real.
- [ ] Prueba de referencia con valor esperado y tolerancia declarada.
- [ ] El procedimiento original de la práctica sigue intacto y accesible; cambios detrás de un indicador de
      característica.
- [ ] Accesibilidad: teclado, texto alternativo de la escena, no depender solo del color, movimiento reducible.
- [ ] Guía del estudiante y clave del docente actualizadas (`npm run guias`).

---

## C. Ejemplo: ficha de enriquecimiento de `energia`

### Ficha de enriquecimiento · `energia` · Conservación de la energía mecánica

- Fecha: 2026-10-18 · Estado: **borrador** (ampliación prevista para la Fase 3)

#### 1. Estado actual (verificado en el código)

- **Modelo** (`src/models/energy.ts`, `simulateTrack`): esfera soltada **desde el reposo** en una pista de 4 m
  horizontales (rampa inicial hasta x = 1,5 m, colina entre 1,5 y 3 m, tramo final plano).
  - Ecuaciones: Ep = m·g·h; Ec = E₀ − Ep − Ef; v = √(2·Ec/(m·k)); k = 1 (desliza) o 7/5 (esfera maciza que rueda);
    Ef = μ·m·g·(distancia horizontal).
  - Rangos: m de 0,05 a 2 kg; h₀ de 0,2 a **2 m**; colina de 0 a 2 m; μ de 0 a 0,1. g = 9,8 m/s² por defecto,
    editable de 1 a 25 m/s² en el modo avanzado (`src/labs/modelParams.ts`).
  - Método: la pista se discretiza en 800 tramos **por posición**; la energía se reparte punto a punto. **No hay
    integración en el tiempo**: la conservación sin fricción es exacta por construcción.
  - Límites declarados: no representa el despegue de la pista ni la normal variable; si la esfera no supera la
    colina, indica dónde se detiene, sin simular el regreso.
- **Laboratorio** (`src/labs/EnergyLab.tsx`): controles de altura de salida, altura de la colina, masa, fricción y
  rodadura; gráfica «Energía en función de la posición»; tabla `recorridos` (masa, altura, colina, μ, rueda, rapidez
  en el valle, si supera la colina, energía disipada). Modo avanzado: sí (ecuaciones con valores y g editable).
  Modo instrumento real: no (`INVENTARIO.md`).
- **Escena:** la esfera recorre los puntos calculados (su posición sobre la pista proviene del modelo), pero la
  animación avanza a ritmo uniforme durante 3,5 s, **sin relación con la rapidez calculada**. Procedencia propuesta:
  datos «Modelo calculado»; escena «Modelo calculado» para la posición, con la aclaración de que el ritmo de la
  animación es ilustrativo.
- **Pruebas:** valor dorado en `tests/golden/golden.test.ts` con m = 1 kg, h = 2 m, g = 9,81 m/s² → Ep = 19,62 J y
  v = √(2gh) = 6,264 m/s; unitarias en `tests/unit/advanced.test.ts` y `tests/unit/models3.test.ts` (según
  `INVENTARIO.md`); prueba E2E.

#### 2. Brechas frente al prompt (sección 9.1)

| Pedido del prompt | Estado |
|---|---|
| Caso de referencia m = 1 kg, h = 10 m, g = 9,81 → Ep = 98,1 J; v ≈ 14,0 m/s | **No ejecutable**: h₀ ≤ 2 m |
| Control de velocidad inicial | No existe (salida desde el reposo) |
| Gráficas de energía frente al **tiempo** y a la posición | Solo frente a la posición |
| Integración numérica con paso controlado y deriva menor que una tolerancia declarada | No existe |
| Rozamiento con disipación «solo si se implementa el modelo» | Implementado como μ·m·g por distancia horizontal (aproximación declarada) |

#### 3. Ampliaciones propuestas (Fase 3)

| Ampliación | Prueba de inclusión | ¿Se incluye? |
|---|---|---|
| Integración en el tiempo del movimiento sobre la pista (paso Δt controlado) con gráfica E(t) y medidor de deriva de Em | El estudiante aprende **que un método numérico conserva la energía solo aproximadamente y que la deriva depende del paso** al manipular **Δt** y observar **la deriva de Em(t) frente a la tolerancia declarada** | Sí |
| Altura de salida hasta 10 m (escenario «caída libre» o pista escalada) | El estudiante aprende **que v = √(2gh) no depende de la masa** al manipular **h y m** y observar **la rapidez al llegar al suelo** (caso de referencia 98,1 J y 14,0 m/s) | Sí, sin cambiar la pista actual de 2 m (nuevo escenario) |
| Velocidad inicial | El estudiante aprende **que Em = Ec₀ + Ep₀ fija la altura máxima alcanzable** al manipular **v₀** y observar **si la esfera supera una colina más alta que la salida** | Sí |
| Animación con el ritmo del tiempo calculado | El estudiante aprende **dónde la esfera va más rápido** al manipular **h₀** y observar **el avance de la esfera en el tiempo** | Sí, como consecuencia de la integración temporal |
| Conexión con conceptos moleculares | No completa la frase de forma natural | **No** (sería forzada) |

#### 4. Pruebas de referencia

- m = 1 kg, h = 10 m, g = 9,81 m/s², sin fricción: Ep₀ = 98,1 J; v al llegar al suelo = √(2gh) ≈ 14,0 m/s.
- Escenario ideal: |Em(t) − Em(0)| / Em(0) menor que una tolerancia que se declarará en la ficha técnica del modelo
  (valor **por definir** al elegir el integrador).
- El valor dorado actual (h = 2 m → 19,62 J y 6,264 m/s) debe seguir pasando sin cambios.

#### 5. Riesgos y transición

- La pista actual, sus controles, su tabla `recorridos` y sus preguntas `ene-1` a `ene-4` se conservan; la ampliación
  se añade como escenario nuevo detrás de un indicador de característica.
- Cambiar el método de cálculo de la pista existente alteraría resultados ya registrados por estudiantes: no se hace
  sin transición documentada.

#### Concepciones erróneas que la práctica ya confronta

| Concepción | Dónde |
|---|---|
| «Una esfera más pesada llega más rápido» | Relación masa → rapidez en el análisis; opción `d` de `ene-1`; opción `b` de `ene-2` |
| «La rapidez es proporcional a la altura» | Opción `a` de `ene-3` (v² ∝ h₀, no v ∝ h₀) |
| «La energía se destruye por la fricción» | Opción `a` de `ene-4` |
