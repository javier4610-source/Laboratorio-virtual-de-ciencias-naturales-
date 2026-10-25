# Rediseño integral de la plataforma (octubre de 2026)

Pedido del docente: elevar la interfaz completa del laboratorio (arquitectura visual, navegación, interacción,
claridad de la información y percepción de calidad) sin perder funciones ni tocar los modelos científicos.
Decisiones de arquitectura: [ADR 0007](adr/0007-sistema-de-diseno-y-espacio-de-trabajo.md). Sistema de diseño:
[SISTEMA-DE-DISENO.md](SISTEMA-DE-DISENO.md).

## 1. Cómo se auditó

- Recorrido con Playwright (Chromium) de la versión 2.4.0 compilada: inicio, catálogo, página de grado, la práctica de
  densidad en sus cinco etapas con cuatro ensayos guardados, el cuaderno de datos, el informe, el panel docente, el
  banco Saber y la ayuda, más el experimento de una práctica de cada área (ósmosis, soluciones, población, péndulo).
  Tema claro y oscuro, 1280 y 390 px: 68 capturas en `scratchpad/plataforma/antes/` (fuera del repositorio).
- Lectura de `src/styles.css`, `src/theme-2026.css`, `App.tsx`, las páginas y los componentes compartidos.
- Medición del paquete (`npm run build`, tamaño por módulo del bloque de entrada) y de la carga con CPU ×4 y red
  «4G lenta» simulada (FCP, LCP, tiempo de bloqueo; mediana de 3 cargas en 390 px).
- Contraste WCAG y separación de la escala de colores de datos bajo protanopía, deuteranopía y tritanopía
  (simulación de Machado et al., 2009; diferencia de color ΔE2000).

## 2. Diagnóstico

| # | Área | Problema real observado | Evidencia |
|---|---|---|---|
| 1 | Arquitectura de información | El inicio repite el catálogo completo: 65 tarjetas debajo de grados, áreas, ciclo y modos. No hay entrada por perfil ni «continuar donde quedé». | Inicio de 13 620 px de alto a 1280 px y 36 535 px a 390 px |
| 2 | Arquitectura de información | El banco Saber pinta todas las preguntas a la vez; el panel docente abre en un catálogo de 65 filas y deja asignar, informes y seguimiento detrás de pestañas. | Banco de 52 474 px; panel docente de 9 838 px (23 987 px en teléfono) |
| 3 | Navegación | Sin navegación entre prácticas (anterior/siguiente del grado), sin atajos de teclado documentados más allá de Tab y flechas, filtros del catálogo que no quedan en la dirección (no se pueden compartir) y área duplicada (botones del encabezado + lista «Asignatura»). | Catálogo, `App.tsx` |
| 4 | Navegación (teléfono) | Las cinco etapas no caben y la barra no indica que se desplaza: a 390 px solo se ven «Preparación» y «Experimento». | Captura de densidad a 390 px |
| 5 | Jerarquía y densidad | En el experimento hay cuatro bandas apiladas antes del instrumento (paso del procedimiento, modo de medición, modo avanzado y procedencia). La escena empieza a ~770 px en escritorio y ~1350 px en teléfono. El encabezado mezcla el modo de trabajo con acciones de documento y la acción destructiva «Reiniciar práctica» al mismo nivel. | Capturas del experimento |
| 6 | Consistencia visual | Dos hojas de estilo superpuestas: `theme-2026.css` redefine botones, foco, radios y sombras de `styles.css` (foco de 3 px y de 2 px; radios de botón 9 y 11 px). Tokens incompletos: sin escala tipográfica nombrada, sin tokens de movimiento ni de capas; `--shadow` y `--shadow-1…3` conviven. El foco usa el mismo naranja que los datos medidos. La animación `pulse` está definida dos veces y la segunda anula la del héroe. | `src/styles.css` (l. 405 y 849), `src/theme-2026.css` |
| 7 | Error visual | La fila recién guardada del cuaderno se interpola entre colores saturados (amarillo en claro, rojo intenso en oscuro) durante 3 s. | Capturas del cuaderno y del informe |
| 8 | Datos experimentales | La escala de 8 colores de series no es distinguible con daltonismo: ΔE2000 mínimo 0,9 (deuteranopía) y 2,6 (protanopía) en claro; 2,7–2,8 en oscuro. Los marcadores de las gráficas solo se distinguen por color. | `--series-1…8`, `Chart.tsx` |
| 9 | Flujo experimental | Cada laboratorio implementa sus propios botones iniciar/pausar/reiniciar (18 variantes de «Reiniciar…»), las advertencias de condiciones inválidas son una lista genérica y el cuaderno no permite comparar ensayos ni exportar los datos en JSON (solo CSV y el registro completo). | `src/labs/*`, `DataPanel.tsx` |
| 10 | Miniaturas | Seis prácticas de física (máquinas, calor, movimiento, circuitos simples, presión, flotación) muestran la misma ilustración de onda, lo que confunde en el catálogo. | `Thumbnails.tsx` |
| 11 | Rendimiento | Abrir cualquier práctica descarga las 65 fichas completas (≈ 2,5 MB sin comprimir): `PracticeSections.tsx` y `lib/report.ts` importan `questionById` del currículo completo para resolver dos preguntas de transferencia del banco. El bloque inicial incluye el sintetizador de sonidos (21 kB) aunque el sonido esté apagado. LCP de la práctica: 14,4 s con red lenta. | `npm run build`, medición de carga |
| 12 | Accesibilidad | axe WCAG 2.2 AA pasa, pero el foco naranja se confunde con el color de dato; las tablas de etapas en teléfono ocultan pestañas sin pista; el aviso «Ensayo guardado» tapa el pie de la página en teléfono. | Capturas, `styles.css` |

## 3. Plan priorizado

Prioridad: primero lo que corrige errores o ahorra tiempo a todos (rendimiento, errores visuales, flujo del
experimento), después la arquitectura y por último el acabado.

1. **Rendimiento sin riesgo** (hallazgo 11): resolver las preguntas de transferencia desde el banco, sin cargar el
   currículo; sintetizador de sonidos bajo demanda. Medir antes y después.
2. **Sistema de diseño formal** (hallazgos 6–8): `src/tokens.css` como única fuente de tokens (color con primario
   institucional, secundario de navegación, semánticos y escala de datos validada para daltonismo; tipografía modular;
   espaciado; radios; elevación; movimiento; capas), modo claro y oscuro con la misma calidad, foco propio, marcadores
   con forma en las gráficas, corrección de la fila nueva y de `pulse`. `styles.css` y `theme-2026.css` consumen los
   tokens.
3. **Espacio de trabajo de la práctica** (hallazgos 4, 5, 9): encabezado compacto con contexto y acciones agrupadas
   (menú «Más» para QR y reinicio), barra de etapas desplazable con indicación y la etapa activa siempre visible,
   barra única de ajustes del banco de trabajo (procedimiento, modo de medición, modo avanzado, procedencia),
   navegación anterior/siguiente, atajos de teclado con diálogo de ayuda (`?`).
4. **Componentes experimentales compartidos** (hallazgo 9): `SimControls` (iniciar/pausar/reanudar/reiniciar con
   estado), `ConditionAlert` (condiciones inválidas con causa y cómo corregir), `Readout` con unidad y resolución,
   comparación de ensayos y exportación JSON en el cuaderno, explicación de la relación entre variables en el
   análisis. Adopción en los laboratorios con dinámica temporal sin tocar sus modelos; guía de adopción para el resto.
5. **Arquitectura y navegación** (hallazgos 1–3, 10): inicio por tareas y perfiles (estudiante, docente,
   investigador o curioso) con «continuar», catálogo con filtros en la dirección, filtro de estado y orden, banco
   paginado, panel docente con resumen de inicio, miniaturas específicas donde hoy se repiten.
6. **Calidad**: axe WCAG 2.2 AA en ambos temas y teléfono, movimiento reducido, impresión, capturas después, métricas.

## 4. Resultado

Ver la sección «Rediseño integral de la plataforma (versión 2.5.0)» de `docs/AUDITORIA.md` y el CHANGELOG.
