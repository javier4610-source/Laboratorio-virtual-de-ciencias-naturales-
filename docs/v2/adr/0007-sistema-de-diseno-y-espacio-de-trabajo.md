# 0007 · Sistema de diseño formal, espacio de trabajo de la práctica y componentes experimentales compartidos

- **Estado:** Aceptada
- **Fecha:** 2026-10-25
- **Relacionado con:** pedido del docente de rediseño integral (octubre de 2026); `docs/v2/REDISENO-2026-10.md`
  (diagnóstico y plan); `docs/v2/SISTEMA-DE-DISENO.md`; ADR 0001 (primero el navegador), 0002 (procedencia),
  0003 (registro de experimentos), 0006 (sin etapa de hipótesis); `src/tokens.css`, `src/plataforma.css`,
  `src/components/Experiment.tsx`, `src/components/ConditionAlert.tsx`, `src/lib/compare.ts`, `src/lib/shortcuts.ts`.

## Contexto

La auditoría de la versión 2.4.0 (68 capturas con Playwright, medición del paquete y de la carga) encontró problemas
de arquitectura de información (inicio de 13 620 px que repite el catálogo; banco de 52 474 px; panel docente que
abre en una tabla de 65 filas), de jerarquía en el experimento (cuatro bandas antes del instrumento), de consistencia
(dos hojas de estilo que se redefinen entre sí, tokens incompletos, foco del mismo color que los datos), de datos
(escala de 8 colores con ΔE2000 mínimo de 0,9 con deuteranopía; marcadores solo por color) y de rendimiento (abrir
cualquier práctica descargaba las 65 fichas por una importación del currículo completo). Los modelos científicos,
las rutas, los identificadores de práctica, el formato de las sesiones guardadas y el contrato del servidor no
debían cambiar.

## Decisión

1. **Tokens en un solo archivo** (`src/tokens.css`), cargado primero: color (neutros fríos, primario institucional
   azul petróleo `#0a5a73`/`#5cc6dc`, secundario pizarra para acciones secundarias y navegación, semánticos éxito,
   advertencia, error e información, color de dato, foco propio, áreas, escala de 8 series de datos), tipografía
   (escala modular de razón 1,2 con títulos fluidos), espaciado base 4 px, radios, elevación en tres niveles,
   movimiento (duraciones que pasan a 0 con «reducir movimiento») y capas. Se conservan **todos los nombres** que usan
   los laboratorios (`--surface`, `--ink-2`, `--data`, `--series-*`, `--glass-edge`…): ninguna escena se toca. El
   tema oscuro se declara dos veces con contenido idéntico (preferencia del sistema y elección manual); una prueba
   unitaria lo verifica y comprueba que todo token usado por laboratorios, componentes y páginas está definido.
2. **Capas de estilo, no fusión**: `tokens.css` (valores) → `styles.css` (estructura y componentes) →
   `theme-2026.css` (acabado: elevación, degradados) → `plataforma.css` (cascarón, espacio de trabajo y componentes
   experimentales nuevos). Se eliminaron de `styles.css` y `theme-2026.css` todos los bloques de valores.
3. **Escala de datos validada para daltonismo** con un script de búsqueda y verificación (ΔE2000 tras simular
   protanopía, deuteranopía y tritanopía con las matrices de Machado et al., 2009) y contraste ≥ 4,1:1 sobre la
   superficie; además, **cada serie de las gráficas tiene una forma de marcador distinta** (`SeriesMarker`).
4. **Espacio de trabajo de la práctica**: encabezado compacto (migas con grado y área, acciones de documento en una
   barra pequeña, modo de trabajo junto al título, pregunta problema a todo el ancho), barra de etapas que mantiene
   visible la etapa activa y se desplaza en teléfonos, una sola franja de ajustes del banco (modo de medición, modo
   avanzado y procedencia) bajo el paso del procedimiento, navegación anterior/siguiente dentro del grado y atajos de
   teclado de una tecla (`?`, `/`, `1`–`5`, `C`, `F`, `I`, `N`, `P`) que se desactivan en Ayuda (WCAG 2.1.4).
5. **Componentes experimentales compartidos** que no calculan nada del modelo: `SimControls`
   (iniciar/pausar/reanudar/reiniciar con estado en texto y avance), `ConditionAlert` (condición no válida o
   advertencia con causa y cómo corregirla; `Warnings`, usado por 19 laboratorios, ahora la usa), `Readout` con
   resolución y estado opcionales, `RelationExplainer` (qué se cambió, qué se midió y cómo leer la correlación de los
   datos del estudiante), comparación de dos ensayos y exportación JSON en el cuaderno (`lvcn-datos-v1`, formato
   nuevo y separado del informe y del registro). Se adoptan donde ya había soporte (ósmosis y ondas para la
   simulación; todas las prácticas con `Warnings`, análisis y cuaderno) y la guía de adopción queda en el documento
   del sistema de diseño.
6. **Arquitectura**: inicio orientado a tareas por perfil (estudiante, docente, investigador o curioso) con
   «Continuar mi práctica» y una práctica destacada por grado en lugar de las 65; catálogo con filtros en la dirección
   (`#/catalogo?area=…&grado=…&competencia=…&estado=…&orden=…&q=…`), filtro por avance, orden, filtros activos
   removibles y estado vacío con salida; banco paginado de 10 en 10; panel docente con una pestaña «Inicio» de tareas
   y enlaces directos `#/docente?seccion=…`. Las rutas existentes no cambian.
7. **Rendimiento**: las preguntas de transferencia se resuelven desde el banco (`src/assessment/lookup.ts`) sin
   importar el currículo; el catálogo, la página de grado, la escena del héroe y las definiciones SVG del kit se
   cargan bajo demanda.

## Alternativas consideradas

- **Fusionar `styles.css` y `theme-2026.css` en un solo archivo.** Descartada por ahora: son unas 1 700 líneas con
  reglas de 65 laboratorios entrelazadas y el agente de química edita en paralelo la sección del taller; el riesgo de
  regresión visual no compensaba. Se resolvió el problema de mantenimiento real (valores duplicados y conflictivos)
  sacando los valores a `tokens.css`.
- **`light-dark()` de CSS para no duplicar el tema oscuro.** Descartada: exige navegadores de 2024 y los equipos
  escolares suelen tener versiones anteriores. Se mantiene la duplicación con prueba automática de igualdad.
- **Biblioteca de componentes (Radix, MUI, Chakra) o de gráficas (Recharts, Plotly).** Descartada: añade cientos de
  kB, otra capa de estilos y dependencias de ejecución; el proyecto ya tiene componentes accesibles propios y una
  gráfica con exportación, zum y tabla. No se añadió ninguna dependencia.
- **Paleta Okabe-Ito tal cual.** Descartada: varios colores (naranja, amarillo, celeste) no alcanzan 3:1 sobre
  blanco. Se usó una búsqueda sobre candidatos con contraste suficiente y se fijó la serie 8 como neutra porque los
  laboratorios la usan para «total» o «referencia».
- **Atajos con modificadores (Alt + número).** Descartada: en teclados en español AltGr y Alt producen caracteres;
  las teclas sueltas fuera de campos y del laboratorio son más simples y se pueden apagar.

## Consecuencias

- Mejora: inicio de 13 620 → ~4 000 px (escritorio) y de 36 535 → ~9 200 px (teléfono); panel docente de 9 838 →
  ~1 250 px al abrir; banco de 52 474 → ~6 450 px; el instrumento aparece antes en el experimento; abrir una práctica
  ya no descarga las 65 fichas; JavaScript inicial menor que antes (ver la auditoría); datos distinguibles con
  daltonismo y por forma.
- Empeora o cambia: el color primario pasa de verde petróleo a azul petróleo y los neutros pierden el sesgo verde
  (las escenas de los laboratorios no cambian de forma). Los colores de las series cambian de tono en ambos temas.
- Pendiente: adoptar `SimControls` en los demás laboratorios con dinámica temporal (proyectiles, péndulo, choques,
  cinemática, energía…) y `Readout.resolution` en los instrumentos; miniaturas específicas para las seis prácticas
  de física que comparten ilustración; Lighthouse no se pudo ejecutar (no está instalado y no hay red para
  instalarlo): se midió FCP, LCP y tiempo de bloqueo con Chromium y limitación de CPU y red.
- Riesgo aceptado: los atajos de una tecla podrían chocar con tecnologías de apoyo que usan letras sueltas; por eso
  se desactivan en Ayuda y nunca actúan dentro de campos, gráficas ni del laboratorio.

## Costo

Sin dinero ni servicios. Tiempo de desarrollo de una ronda. Peso para el usuario: el JavaScript inicial baja (de
407,86 a ~391 kB sin comprimir); el CSS sube unos 8 kB sin comprimir por `tokens.css` y `plataforma.css`.

## Mantenimiento

Lo mantiene quien desarrolle la interfaz. Reglas: todo valor nuevo va a `tokens.css` (claro y los dos bloques
oscuros); la prueba `tests/unit/plataforma.test.ts` falla si un token usado no está definido o si los bloques oscuros
divergen. Al cambiar un color se vuelve a correr la verificación de contraste y daltonismo descrita en
`docs/v2/SISTEMA-DE-DISENO.md`. Si nadie lo atiende, el sistema sigue funcionando: los componentes solo leen tokens.

## Licencia

Sin dependencias nuevas. Matrices de simulación de daltonismo: Machado, Oliveira y Fernandes (2009), «A
physiologically-based model for simulation of color vision deficiency», IEEE TVCG 15(6) (se usan los coeficientes
publicados; no hay código de terceros). Fórmula ΔE2000: CIE 142-2001.
