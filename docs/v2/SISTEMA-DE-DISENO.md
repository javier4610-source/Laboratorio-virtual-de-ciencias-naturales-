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
  status={running ? 'en-curso' : finished ? 'terminado' : t > 0 ? 'en-pausa' : 'listo'}
  onStart={start} onPause={() => setRunning(false)} onResume={() => setRunning(true)} onReset={reset}
  progress={{ value: t, max: duration, unit: 's', label: 't' }} />
```

Adoptado en: ósmosis y ondas. Para adoptarlo en otra práctica: reemplazar la fila de botones
iniciar/pausar/reiniciar por el componente, conservando las mismas funciones del laboratorio; si una prueba E2E usa
el nombre de un botón («Soltar el péndulo», «Lanzar»), pasar ese texto en `startLabel`.

### `ConditionAlert` (`src/components/ConditionAlert.tsx`)

Aviso de condición experimental con nivel (`invalido`, `advertencia`, `nota`), título, causa y **cómo corregirlo**.
`Warnings` (lista de advertencias del modelo, usada por 19 laboratorios) ya lo usa, así que todas las prácticas las
muestran igual. El análisis lo usa para el control de variables.

```tsx
<ConditionAlert level="invalido" title="la muestra flota"
  cause="El volumen desplazado no es el de la muestra completa."
  fix="Marca «Hundir la muestra con un alfiler» y vuelve a sumergir." />
```

### `Readout` con resolución y estado (`src/components/ui.tsx`)

Cada lectura admite `resolution` («± 0,1 g») y `state` (`ok`, `warn`, `bad`, dicho en texto: «en rango», «en el
límite», «fuera de rango»). Retrocompatible: los 65 laboratorios siguen funcionando sin cambios.

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
