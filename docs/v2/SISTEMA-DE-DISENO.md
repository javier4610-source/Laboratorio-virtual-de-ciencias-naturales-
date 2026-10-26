# Sistema de diseño del Laboratorio Virtual

Versión 2.6.0 (octubre de 2026). Decisión: [ADR 0007](adr/0007-sistema-de-diseno-y-espacio-de-trabajo.md).
Diagnóstico que lo motivó: [REDISENO-2026-10.md](REDISENO-2026-10.md).

## 1. Principios

1. **Precisión antes que adorno.** Lo que se lee primero es el instrumento, la lectura y su unidad. El color de dato
   (naranja) solo marca valores medidos, el paso actual y la acción «Guardar ensayo».
2. **Una sola fuente de valores.** Todo color, tamaño, radio, sombra, duración y capa sale de `src/tokens.css`. Los
   componentes usan tokens **semánticos** (`--surface`, `--accent`, `--data`), nunca valores sueltos.
3. **Dos temas con la misma calidad.** El oscuro no es una inversión: tiene sus propios neutros, sombras y escala de
   datos, verificados con el mismo criterio que el claro.
4. **Nada solo con color.** Estados en texto («En pausa», «fuera de rango»), series con forma de marcador distinta,
   etapas con número o ✓, avisos con ícono y título.
5. **Movimiento breve y opcional.** 120–320 ms; todo pasa a 0 con «Reducir animaciones» o la preferencia del sistema.

## 2. Capas de estilo

| Archivo | Contenido | Regla |
|---|---|---|
| `src/tokens.css` | Valores: color, tipografía, espaciado, radios, elevación, movimiento, capas | Solo variables. El bloque oscuro se repite dos veces con el mismo contenido (preferencia del sistema y elección manual); `tests/unit/plataforma.test.ts` verifica que coinciden. |
| `src/styles.css` | Estructura y componentes base (botones, campos, tablas, laboratorios, cuaderno) | Usa tokens. No declara valores de tema. |
| `src/theme-2026.css` | Acabado visual (elevación en capas, degradados, héroe) | Usa tokens. |
| `src/plataforma.css` | Cascarón, espacio de trabajo de la práctica y componentes experimentales del rediseño 2026-10 | Usa tokens. |

## 3. Color

### 3.1 Roles

| Rol | Token | Claro | Oscuro | Uso |
|---|---|---|---|---|
| Fondo | `--bg` | `#f4f6f9` | `#0d131c` | Lienzo de la página |
| Superficie | `--surface` | `#ffffff` | `#141c28` | Tarjetas, paneles, campos |
| Superficie 2 / 3 | `--surface-2`, `--surface-3` | `#eef2f6` / `#e2e8ef` | `#1b2534` / `#243042` | Encabezados de tabla, segmentos, pistas |
| Texto | `--ink` | `#0f1b2d` | `#e8eef6` | Texto principal |
| Texto secundario | `--ink-2` | `#4a586b` | `#a7b3c4` | Ayudas, rótulos |
| Línea / control | `--line`, `--line-strong` | `#d5dde6` / `#8796a8` | `#2a3647` / `#5f718a` | Separadores / bordes de controles (≥ 3:1) |
| **Primario institucional** | `--accent` | `#0a5a73` azul petróleo | `#5cc6dc` | Acción principal, enlaces, selección |
| Primario suave | `--accent-soft` | `#e1eff4` | `#12323d` | Fondos de selección |
| **Secundario** | `--secondary`, `--secondary-soft` | `#26405f` / `#e6ecf4` | `#c9d6e8` / `#1e2a3b` | Acciones secundarias y navegación |
| Éxito | `--ok`, `--ok-soft` | `#13703c` / `#e0f2e7` | `#5bd389` / `#11301f` | Correcto, completado |
| Advertencia | `--warn`, `--warn-soft` | `#8a5300` / `#fbf0d9` | `#f5c35b` / `#352a10` | Revisar condición |
| Error | `--bad`, `--bad-soft` | `#b42318` / `#fde6e3` | `#ff8a80` / `#3a1815` | Condición no válida, acción destructiva |
| Información | `--info`, `--info-soft` | `#1d4fa8` / `#e5eefb` | `#8ab4ff` / `#172a46` | Notas |
| Dato medido | `--data`, `--data-soft` | `#b23a0a` / `#fdebe1` | `#fb923c` / `#3a2416` | Lecturas, paso actual, «Guardar ensayo» |
| Foco | `--focus` | `#1a56db` | `#8ab4ff` | Anillo de foco (distinto del dato) |
| Áreas | `--bio`, `--qui`, `--fis`, `--amb` | `#256d2a`, `#8b3aa3`, `#1e5fae`, `#7a5800` | `#7bc97f`, `#d29be3`, `#7fb2f0`, `#e0b44f` | Identidad de cada asignatura |

### 3.2 Escala de datos experimentales

Ocho series (`--series-1` … `--series-8`). La 1 coincide con el color de dato; la 8 es neutra (los laboratorios la
usan para «total» o «referencia»). Elegidas con una búsqueda sobre candidatos con contraste suficiente que maximiza la
diferencia mínima ΔE2000 tras simular las tres dicromacias (Machado et al., 2009). Además, **cada serie tiene una
forma de marcador** en las gráficas: círculo, cuadrado, triángulo, rombo, triángulo invertido y hexágono
(`SeriesMarker` en `src/components/Chart.tsx`).

| Serie | Claro | Oscuro |
|---|---|---|
| 1 | `#c2410c` | `#ff9a4d` |
| 2 | `#2554c7` | `#6fa8ff` |
| 3 | `#117a4b` | `#2fbf85` |
| 4 | `#99307d` | `#f7a6dc` |
| 5 | `#0b87a8` | `#9fe3ff` |
| 6 | `#6b4200` | `#f0d264` |
| 7 | `#1b2b4d` | `#8b7cf6` |
| 8 | `#64748b` | `#8d9bb0` |

| Visión simulada | ΔE2000 mínimo (claro) | ΔE2000 mínimo (oscuro) | Antes del rediseño (claro / oscuro) |
|---|---|---|---|
| Normal | 14,6 | 13,5 | 14,6 / 11,1 |
| Protanopía | 7,4 | 9,6 | 2,6 / 2,8 |
| Deuteranopía | 6,2 | 6,9 | 0,9 / 2,7 |
| Tritanopía | 10,3 | 9,4 | 2,7 / 8,8 |

Contraste de cada serie sobre la superficie: 4,16:1 a 14,01:1 (claro) y 5,15:1 a 12,15:1 (oscuro); WCAG 1.4.11
pide 3:1 para elementos gráficos.

### 3.3 Contraste verificado

`python3 scripts/diseno/verificar_paleta.py` lee `src/tokens.css` y falla si un texto queda por debajo de 4,5:1, un
control, el foco o una serie por debajo de 3:1, o si dos series quedan con ΔE2000 < 5. Resultado actual: **todo
cumple** en ambos temas (texto secundario 5,87–8,06:1; texto sobre primario 7,71:1 y 8,33:1; foco 5,71–8,92:1;
semánticos sobre su fondo suave 5,18–8,62:1). Además axe (WCAG 2.2 AA) recorre las páginas y las 65 prácticas en
ambos temas y en teléfono.

## 4. Tipografía

Familias (sin CDN, empaquetadas con `@fontsource`): **Bricolage Grotesque** (títulos), **Atkinson Hyperlegible**
(lectura; diseñada para baja visión), **JetBrains Mono** (datos, con cifras tabulares).

Escala modular de razón 1,2 sobre 1 rem; los títulos de página son fluidos con `clamp()`:

| Token | Tamaño | Uso |
|---|---|---|
| `--fs-xs` | 0,75 rem | Rótulos de eje, sobretítulos |
| `--fs-sm` | 0,875 rem | Ayudas, chips, tablas densas |
| `--fs-base` | 1 rem | Lectura |
| `--fs-md` | 1,2 rem | Títulos de tarjeta |
| `--fs-lg` | 1,44 rem | h2 |
| `--fs-xl` | 1,728 rem | h1 compacto (práctica en curso) |
| `--fs-2xl` | 1,85 → 2,49 rem | h1 de página |
| `--fs-3xl` | 2,15 → 3,58 rem | Titular del inicio |

Interlineados `--lh-tight` 1,1 · `--lh-snug` 1,3 · `--lh-body` 1,55; medida de lectura `--measure` 72ch. El tamaño
de texto del usuario (Normal, Grande, Muy grande) escala todo con `--font-scale`.

## 5. Espaciado, radios, elevación, movimiento y capas

- **Espaciado** (base 4 px): `--sp-1` 4 · `--sp-2` 8 · `--sp-3` 12 · `--sp-4` 16 · `--sp-5` 20 · `--sp-6` 24 ·
  `--sp-7` 28 · `--sp-8` 32 · `--sp-10` 40 · `--sp-12` 56 · `--sp-16` 72 px.
- **Radios**: `--radius-xs` 6 · `--radius-sm` 8 · `--radius` 12 · `--radius-lg` 16 · `--radius-xl` 24 ·
  `--radius-pill`.
- **Elevación**: `--shadow-1` (reposo), `--shadow-2` (flotante, al pasar el puntero), `--shadow-3` (diálogos y
  avisos); `--edge-hi` da el brillo de borde superior.
- **Movimiento**: `--dur-1` 120 ms (color), `--dur-2` 200 ms (elevación), `--dur-3` 320 ms (entradas);
  curvas `--ease`, `--ease-out`, `--ease-in-out`. Con «reducir movimiento» las duraciones valen 0 y las animaciones
  decorativas se apagan.
- **Capas**: `--z-stage` 15 (barra de etapas) · `--z-header` 20 · `--z-popover` 30 · `--z-toast` 40 ·
  `--z-dialog` 50 · `--z-skip` 100.
- **Controles**: altura `--control-h` 42 px y `--control-h-sm` 34 px (objetivo táctil ≥ 24 px de WCAG 2.5.8).

## 6. Arquitectura de la interfaz

- **Inicio** (`HomePage.tsx`): héroe con dos acciones; «¿Qué quieres hacer hoy?» con tres perfiles (estudiante,
  docente, investigador o curioso) que muestran cuatro tareas cada uno y se recuerdan; «Continuar mi práctica»;
  grados; asignaturas; una práctica por grado; ciclo de trabajo y código del docente.
- **Catálogo** (`CatalogPages.tsx`): búsqueda (tecla `/`), grado, asignatura, competencia, avance y orden; los
  filtros viven en la dirección (`#/catalogo?area=quimica&grado=10…`), se muestran como chips removibles y el estado
  vacío ofrece quitarlos.
- **Práctica** (`PracticePage.tsx`): encabezado compacto (migas Inicio / grado / área / práctica; acciones Ver
  informe, Compartir, Atajos y Reiniciar en una barra pequeña; modo de trabajo junto al título; pregunta problema),
  barra de etapas fija, y en el experimento: paso del procedimiento → franja de ajustes del banco → laboratorio
  (escena + controles) → cuaderno → registro reproducible. Al pie, práctica anterior y siguiente del grado.
- **Panel docente**: pestaña «Inicio» con las ocho tareas y sus contadores; enlaces directos
  `#/docente?seccion=asignaciones|informes|seguimiento|validacion|…`.
- **Banco Saber**: tandas de 10 preguntas con «Mostrar más».

### Atajos de teclado

| Tecla | Acción | Dónde |
|---|---|---|
| `?` | Lista de atajos | Toda la plataforma |
| `/` | Buscar en el catálogo | Toda la plataforma |
| `1` … `5` | Ir a la etapa | Práctica |
| `C` | Ir al cuaderno | Experimento |
| `F` | Pantalla completa | Experimento |
| `I` | Informe | Práctica |
| `N` / `P` | Siguiente / anterior práctica del grado | Práctica |

No actúan dentro de campos, gráficas, diálogos ni del laboratorio (`.lab-layout`), donde las teclas manejan los
instrumentos; se desactivan en «Ayuda y accesibilidad» (WCAG 2.1.4). Implementación: `src/lib/shortcuts.ts`.

## 7. Experiencia experimental: componentes compartidos y guía de adopción

Ninguno calcula nada del modelo científico: reciben el estado del laboratorio y lo presentan de forma uniforme.

### `SimControls` (`src/components/Experiment.tsx`)

Barra de control para prácticas con dinámica temporal. El botón principal cambia según el estado: **Iniciar →
Pausar → Reanudar**, y **Repetir** al terminar; **Reiniciar** aparte; el estado se dice en texto (`role="status"`) y
el avance es una barra con `aria-valuetext` («t = 12 s de 60 s»).

```tsx
<SimControls title="Observación al microscopio"
  status={simStatusOf(running, t > 0, finished)}
  onStart={start} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset}
  progress={{ value: t, max: duration, unit: 's', label: 't' }} />
```

Para adoptarlo en otra práctica: reemplazar la fila de botones iniciar/pausar/reiniciar por el componente,
conservando las mismas funciones del laboratorio; si una prueba E2E usa el nombre de un botón («Soltar el péndulo»,
«Lanzar»), pasar ese texto en `startLabel` (y uno propio en `repeatLabel`, que por defecto es «Repetir»). Reglas que
siguen todas las prácticas adoptadas:

- **El estado sale de lo que ya lleva el laboratorio**: `simStatusOf(corriendo, yaEmpezó, terminó)`. Pausar no borra
  nada: deja de pedir cuadros (`cancelAnimationFrame`) y conserva el tiempo; al reanudar, el reloj se reconstruye
  desde el tiempo ya recorrido (`start = performance.now() − t`), de modo que **ninguna lectura cambia por pausar**
  y los valores dorados siguen iguales. Donde hay un cronómetro de mano (movimiento), el arranque del cronómetro se
  corre lo que duró la pausa.
- **Barra de avance solo si el total no es la respuesta**: se muestra cuando la duración la fija el estudiante o el
  protocolo (30 min de calentamiento, 180 s de reacción, años simulados); se omite cuando la duración es lo que se
  mide (tiempo de vuelo, período, tiempo en 1 m), porque la barra lo revelaría.
- **Preparación previa** (subir con el torno, pesar el sistema): el paso queda como botón aparte antes de la barra;
  `disabled` bloquea el inicio hasta completarlo y `resetDisabled={false}` permite reiniciar desde la preparación.
- **Movimiento reducido**: las corridas siguen saltando al resultado final; las animaciones continuas (gases,
  fotosíntesis) arrancan detenidas y el estudiante puede iniciarlas a voluntad.
- **Teclado y lector de pantalla**: el botón principal es el mismo elemento en todos los estados (el foco no se
  pierde al pasar de «Iniciar» a «Pausar»), el estado se anuncia con `role="status"` y el grupo tiene nombre propio
  (p. ej. «Riel de aire»), que es el que usan las pruebas.

#### Tabla de adopción por práctica (v2.6.0, sin publicar)

| Práctica | Componente | Barra (título · inicio) | Avance | Además |
|---|---|---|---|---|
| Ósmosis | `OsmosisLab` | Observación al microscopio · Iniciar | t de la observación | (adopción inicial) |
| Ondas | `WavesLab` | Generador de ondas · Iniciar | — (onda continua) | (adopción inicial) |
| Proyectiles | `ProjectileLab` | Lanzador · Disparar | — (el tiempo de vuelo es una lectura) | Resolución de fotopuerta, cronómetro, estroboscopía y cinta |
| Péndulo | `PendulumLab` | Péndulo · Soltar el péndulo (+ cronómetro y fotopuerta) | — (el período es la lectura) | Resolución 0,01 s / 0,001 s |
| Choques | `CollisionsLab` | Riel de aire · Lanzar | t del registro | Resolución de fotopuertas (0,1 ms) y balanza; `ConditionAlert` «los deslizadores no se alcanzan» |
| Energía mecánica | `EnergyLab` | Pista · Soltar la esfera; Caída de la pelota · Soltar la pelota | — | Gráficas visibles en pausa |
| Cinemática | `KinematicsLab` | Recorrido del ciclista · Iniciar recorrido | — | Resolución de cronómetro y cinta |
| Movimiento | `MotionLab` | Salida y recorrido · Dar la salida (+ cronómetro de mano) | — | La pausa corre el arranque del cronómetro de mano |
| Leyes de Newton | `NewtonLab` | Carrito · Soltar el carrito | — | — |
| Cinética y potencial | `KineticPotentialLab` | Riel de aire · Lanzar el carrito; Torre de caída · Soltar; Lanzador de resorte · Soltar el pestillo | — | «Subir con el torno» como preparación |
| Conducción | `ConductionLab` | Calentamiento de la varilla · Encender y medir | Tiempo simulado (30 min) | — |
| Calor | `HeatLab` | Calorímetro · Mezclar y medir | Tiempo de registro (10 min) | — |
| Ecosistema | `EcosystemLab` | Acuario · Simular y medir | Horas simuladas | — |
| Redes tróficas | `FoodWebLab` | Simulación de la red trófica · Simular | Años simulados | — |
| Respiración | `RespirationLab` | Respirómetro · Iniciar medición | Minutos de medición | — |
| Reto de indagación | `InquiryLab` | Recolección de muestras · Recolectar datos (Reiniciar = «Rediseñar») | Muestras recolectadas | — |
| Expresión génica | `ExpressionLab` | Expresión del gen · Expresar el gen (+ Omitir la animación) | — | — |
| Conservación de la masa | `ConservationLab` | Reacción en la balanza · 2. Mezclar los reactivos | — | «1. Pesar» como preparación; resolución 0,01 g |
| Cinética química | `KineticsLab` | Reacción y cronómetro · Iniciar reacción y cronómetro | t (180 s) | Resolución de jeringa (1 mL) y cronómetro (1 s) |
| Trabajo y potencia | `WorkLab` | Subida por la rampa / por la escalera | — (el tiempo es la lectura) | — |
| Inducción (Faraday) | `InductionLab` | Imán a velocidad constante · Introducir el imán (+ Sacar) | — | — |
| Leyes de los gases | `GasLab` | Movimiento de las partículas · Animar las partículas | — | Antes no se podía detener (WCAG 2.2.2) |
| Fotosíntesis | `PhotoLab` | Burbujeo de la elodea · Animar las burbujas | — | Antes no se podía detener (WCAG 2.2.2) |

**Prácticas con animación pero sin dinámica que pausar** (no se inventan controles):

| Práctica | Componente | Motivo |
|---|---|---|
| Microscopio (células) | `MicroscopeLab` | Conteo a lo largo del diámetro: barrido de 1,4 s del procedimiento, no un fenómeno en el tiempo. |
| Máquinas simples | `MachinesLab` | Animación de 1,7 s del levantamiento al medir; la lectura no depende del tiempo. |
| Presión | `PressureLab` | Chorros (1,5 s) y oscilación transitoria del manómetro al mover la sonda: respuesta del instrumento. |
| Flotación | `BuoyancyLab` | La aguja del dinamómetro se asienta y la sal se disuelve: transiciones del instrumento. |
| Conductores | `ConductorsLab` | Cierre del circuito de 0,9 s antes de leer el amperímetro: transición del instrumento. |
| Descomposición | `DecompositionLab` | Pesaje de las bolsas (1,6 s); las semanas se eligen con un control deslizante, no transcurren. |
| Balanceo | `BalancingLab` | La balanza de átomos se inclina hasta su posición: transición, sin tiempo. |
| Modelo de ADN | `DnaExtractionLab` | Etapas del procedimiento con un botón cada una (verter, filtrar, enrollar). |
| Mol | `MoleLab` | Reacción de 3,2 s como paso entre «Pesar antes» y «Pesar después»; se mide la diferencia de masas. |
| Equilibrio químico | `EquilibriumLab` | Relajación de 3 s que dispara cada perturbación; no hay corrida que iniciar y el estado ya se anuncia («El sistema está respondiendo…»). |
| Selección natural | `SelectionLab` | Generaciones discretas con «Avanzar 1 / 10 generaciones» (transición de 0,7 s). |
| Calidad del agua | `WaterQualityLab` | Toma de la muestra (2,4 s) antes de leer los instrumentos. |
| Interferencia | `InterferenceLab` | Barrido automático del sensor (instrumento) sobre un patrón estacionario; el sensor también se mueve a mano. |
| Sonido | `SoundLab` | Fuente sonora real: «Golpear el diapasón», «Encender/Apagar el generador» y «Detener el sonido» ya controlan la dinámica. |
| Circuitos simples | `SimpleCircuitsLab` | El giro del motor es el estado del circuito; se detiene con el interruptor. |
| Inducción (generador) | `InductionLab` | La bobina gira según las rpm elegidas (0 = detenida); la lectura es instantánea. |
| Mitosis, población, genética de poblaciones, enzimas | `MitosisLab`, `PopulationLab`, `PopGenLab`, `EnzymeLab` | Sin animación temporal: el modelo se calcula completo y se muestra como gráfica o resultado. |

Las 23 prácticas restantes (densidad, mezclas, óptica, soluciones, química inorgánica y orgánica, genómica, etc.)
no tienen dinámica temporal (a lo sumo una transición breve de interfaz). Total: 23 adoptadas + 19 sin dinámica que pausar + 23 sin
animación = 65.

### `ConditionAlert` (`src/components/ConditionAlert.tsx`)

Aviso de condición experimental con nivel (`invalido`, `advertencia`, `nota`), título, causa y **cómo corregirlo**.
El análisis lo usa para el control de variables y los choques, para la condición imposible «los deslizadores no se
alcanzan» (nivel `invalido`, con el inicio bloqueado). Con `live={false}` no crea su propia región de estado (lo usa
`Warnings` para agrupar varios avisos en una sola).

```tsx
<ConditionAlert level="invalido" title="la muestra flota"
  cause="El volumen desplazado no es el de la muestra completa."
  fix="Marca «Hundir la muestra con un alfiler» y vuelve a sumergir." />
```

### `Warnings` con una corrección por advertencia (`src/components/ui.tsx`, `src/models/conditions.ts`)

`Warnings` recibe textos simples (como antes: un aviso «Atención» con la lista) o condiciones del modelo
`{ text, level, fix }`. Con condiciones dibuja **un aviso por causa**, cada uno con su «Cómo corregirlo» al lado,
ordenados por gravedad (no válida → atención → nota) y **dentro de una sola región `role="status"`**, para que el
lector de pantalla los anuncie juntos y no como regiones que compiten (las notas conservan `role="note"`).

- **Los modelos no cambian sus textos**: siguen devolviendo `warnings: string[]` (pruebas, registros y valores
  dorados dependen de ellos). Cada modelo exporta una función pura `…Conditions` que asocia a cada texto su nivel y su
  corrección con `classifyWarnings(textos, reglas)`; donde la práctica armaba los avisos (fotosíntesis, interferencia,
  metabolismo, secuencias, indagación), la función del modelo los arma ya con nivel y corrección.
- **La corrección sale del umbral del modelo**, no de un número inventado: el volumen mínimo de Boyle con
  P_máx = 300 kPa, ε/I_máx en el circuito, la arista máxima con la capacidad de la balanza, el caudal de vertimiento
  (búsqueda sobre el mismo modelo de Streeter–Phelps), la distancia de la lámpara con el punto de compensación, la L
  mínima con el número de Fresnel 0,3, la dilución con A_máx del colorímetro… Las pruebas unitarias
  (`tests/unit/conditions.test.ts`) aplican la corrección propuesta y comprueban que la advertencia desaparece.
- **Niveles**: `invalido` si la medición no vale con esas condiciones (fuera del intervalo del modelo o del
  instrumento, o el montaje real fallaría); `advertencia` si vale pero conviene revisarla; `nota` para interpretar el
  resultado (puede no tener corrección: seguridad, límites declarados del simulador, sucesos de la simulación).

```tsx
<Warnings list={gasConditions(res.warnings, gasInput)} />
// → «Condición no válida · La presión supera 300 kPa… · Cómo corregirlo: Sube el «Volumen de la jeringa» a 40 mL o más…»
```

#### Avisos por práctica (sin publicar)

| Práctica | Función | Avisos (nivel) |
|---|---|---|
| Circuitos | `circuitConditions` | Circuito abierto (atención: qué interruptores cerrar según serie, paralelo o mixto); corriente > 3 A (no válida: R equivalente + r mínima = ε/3 A) |
| Circuitos simples | `simpleCircuitConditions` | Cortocircuito, bombillo sobre 1,3 × 2,5 V, LED sobre 30 mA, amperímetro en paralelo (no válida); LED, zumbador o pila al revés («Girar … (invertir polaridad)»), circuito abierto (atención); cálculo sin converger (nota) |
| Leyes de los gases | `gasConditions` | Presión > 300 kPa (no válida: volumen mínimo o temperatura máxima); bajo 0 °C (atención) |
| Enzimas | `enzymeConditions` | Desnaturalización (atención: T ≤ T_m de la enzima); pH lejano (atención: intervalo con ≥ 20 % de actividad); sin sustrato (no válida) |
| Densidad | `densityConditions` | Balanza sobrecargada, probeta desbordada (agua inicial máxima), muestra que flota (todas no válidas) |
| Calidad del agua | `waterConditions` | Oxígeno agotado (no válida: caudal de vertimiento máximo); OD < 4 mg/L y dilución < 4:1 (atención); plaguicidas del drenaje bananero (nota) |
| Cinemática | `kinematicsConditions` | Fin de pista y frenado (atención: duración máxima); sin movimiento (no válida) |
| Movimiento | `motionConditions` | Balón que frena, ida y vuelta (notas con la alternativa) |
| Cinética química | `kineticsConditions` | Sin catalizador, catalasa desnaturalizada, reacción de mármol que termina antes de 30 s (atención); H₂O₂ que no llega a 20 mL (no válida: concentración mínima) |
| Conservación de la masa | `conservationConditions` | Presión del frasco > 200 kPa y globo > 3 L (no válida: masa máxima); oxígeno agotado, reactivo sobrante y seguridad (notas) |
| Equilibrio químico | `feConditions`, `no2Conditions` | Absorbancia > 3, presión > 2,5 bar, condensación del N₂O₄ (no válida: volumen o temperatura mínimos); todo el SCN⁻ precipitado (atención); precipitado parcial (nota) |
| Ecosistema | `ecosystemConditions` | Oscuridad, sin elodea, sobrepoblación (caracoles máximos = 1,2·K), sin descomponedores, exceso de alimento (atención); hipoxia y muertes (notas) |
| Soluciones | `solutionConditions` | Solubilidad superada (atención: masa máxima o balón mayor); absorbancia > 2 (no válida: pipeta y balón con el factor de dilución necesario) |
| Fotosíntesis | `photoConditions` | Desnaturalización desde 40 °C y bajo el punto de compensación (atención: distancia máxima de la lámpara) |
| Interferencia | `interferenceConditions` | Fresnel > 0,3, sin primer orden, primer orden fuera de la pantalla (no válida); orden ausente (nota) |
| Extracción de ADN | `extractionConditions` | Espuma, sal en exceso, alcohol tibio, sin machacar (atención) |
| Metabolismo | `metabolismConditions` | No factible (no válida); formiato (atención); óptimos alternativos (nota) |
| Secuencias | `parseConditions`, `alignConditions` | BLOSUM62 con ADN (no válida); matriz simple con proteínas, «*» interno, CDS fuera de la secuencia (atención); códigos ambiguos (nota) |
| Reto de indagación | `designConditions` | Diseño imposible y presupuesto superado (no válida); niveles que coinciden (atención: niveles máximos en el rango) |

### `Readout` con resolución y estado (`src/components/ui.tsx`)

Cada lectura admite `resolution` y `state` (`ok`, `warn`, `bad`, dicho en texto: «en rango», «en el límite», «fuera
de rango»). Retrocompatible: los 65 laboratorios siguen funcionando sin cambios. La resolución se escribe con
`resolutionText(paso, unidad)` («resolución 0,01 s»), tomando el paso de la ficha del instrumento
(`src/labs/instruments.ts`, `PROBE`, `…_INSTRUMENTS`) o de la constante del modelo (`TIMER_RES`, `ABS_RES`,
`COLORIMETER_RES`…); nunca un número nuevo. `state` solo donde el modelo define un intervalo real; si el valor ya dice
«fuera de rango», el estado lo reemplaza en vez de repetirlo.

#### Adopción por práctica (sin publicar)

| Práctica | Lecturas con resolución | Estado (intervalo del modelo) |
|---|---|---|
| Proyectiles, péndulo, choques, cinemática, conservación de la masa, cinética química | (v2.7.0) | — |
| Leyes de los gases | Manómetro 0,1 kPa, escala de la jeringa 1 mL | Presión: en rango hasta 300 kPa |
| Densidad | Regla 0,1 cm, balanza 0,1 g, probeta 0,5 mL | Masa y volumen final: fuera de rango si se supera la capacidad (600 g, 100 mL) |
| Circuitos | Voltímetro 0,01 V, amperímetro 0,001 A | Corriente total: en rango hasta 3 A |
| Circuitos simples | Multímetro 0,01 V o 0,001 A según el modo | — |
| Calidad del agua | Las 9 sondas y ensayos de la ficha (0,1 °C, 0,01 de pH, 0,01 mg/L de OD…) | OD ≥ 4,0 mg/L y pH 4,5 a 9,0 (Decreto 1076 de 2015, preservación de fauna) |
| Equilibrio químico | Colorímetro 0,001, comparador de color 1 | Absorbancia hasta 3; presión total hasta 2,5 bar |
| Soluciones | Colorímetro 0,001 | Absorbancia hasta 2 |
| Extracción de ADN | Escala del precipitado 1 u.a. | Tm de Wallace: válida hasta 13 nucleótidos |
| Ecosistema | Oxímetro 0,1 mg/L, carta de pH 0,2, conteo 1, biomasa 0,5 g | OD frente al mínimo que tolera un pez (si hay peces) |
| Movimiento | Cinta 0,01 m, fotopuertas y cronómetro 0,01 s | — |
| Interferencia | Riel 0,1 cm, sensor 0,1 %, calibrador 0,05 mm o regla 1 mm según la escala | — |
| Máquinas simples | Dinamómetro 0,1 N, regla 0,1 cm | — |
| Presión | Manómetro en U 1 mm, barómetro 0,1 hPa, cinta 0,5 cm | — |
| Flotación | Dinamómetro 0,05 N, balanza 0,1 g, densímetro 0,002 g/cm³ | — |
| Conductores | Amperímetro 0,1 mA | — |
| Mol | Balanza de precisión 0,001 g | — |
| Óptica | Transportador 1° (solo en modo real: en modo ideal la lectura no se cuantiza) | — |

Sin resolución por no tener instrumento de lectura directa (el valor es del modelo): enzimas, fotosíntesis (las
lecturas del registrador ya llevan su resolución), metabolismo, secuencias e indagación.

### `RelationExplainer` (análisis)

Muestra qué variable se cambió y cuál se midió, describe la tendencia detectada en los datos del estudiante con la
fuerza de la correlación y recuerda que correlación no es causa. Se acompaña de la gráfica de los ensayos incluidos.

### Cuaderno de datos (`DataPanel.tsx`)

Tabla con observación por ensayo, gráfica con zum, PNG/SVG y tabla equivalente, ajuste, linealización, barras de
error, estadística de repeticiones, propagación de incertidumbre y, desde esta versión, **comparación de dos ensayos**
(diferencia B − A, variación relativa y aviso sobre qué variables de entrada cambiaron; `src/lib/compare.ts`) y
**Descargar JSON** (`lvcn-datos-v1`: columnas con unidad y resolución, ensayos numerados, modo de medición).

## 8. Patrones

- **Estados vacíos**: ilustración o ícono, frase que explica qué aparecerá y una acción para salir (cuaderno, catálogo,
  banco).
- **Carga**: textos con `role="status"`; la escena del héroe reserva su espacio (sin saltos de diseño).
- **Errores**: la práctica que no carga ofrece «Reintentar»; el límite de errores muestra un mensaje y permite seguir.
- **Acciones destructivas**: confirmación en la misma página («¿Borrar…? Sí / Cancelar»), en color de error.
- **Impresión**: se ocultan barras de herramientas, paginador, ajustes del banco y controles de simulación.

## 9. Lista de verificación para una pantalla nueva

1. ¿Usa solo tokens? (`grep -n "#[0-9a-f]\{6\}"` en el CSS nuevo debe quedar vacío.)
2. ¿Tiene un h1, migas de pan y un estado vacío?
3. ¿Funciona a 390 px sin desplazamiento horizontal y con «Muy grande»?
4. ¿Todo estado se dice en texto además del color?
5. ¿Pasa axe WCAG 2.2 AA en claro y oscuro? (Agregar la ruta a `tests/e2e/a11y.spec.ts`.)
6. Si agrega colores: `python3 scripts/diseno/verificar_paleta.py`.
