# Pruebas de regresión visual

Comparan capturas de pantalla de la versión compilada con imágenes de referencia guardadas en el repositorio. Detectan
cambios visuales que nadie pidió: un token de color alterado, un espaciado distinto, una tarjeta que se sale de la
pantalla a 390 px, un tema oscuro con un fondo claro olvidado. Complementan, no reemplazan, las pruebas de interfaz
(`tests/e2e`) y la auditoría de accesibilidad.

## Cómo correrlas

```bash
npm run build              # las pruebas sirven dist/ con «vite preview»
npm run test:visual        # compara (unos 30–60 s)
npm run test:visual:update # vuelve a generar las capturas que cambiaron
```

- Configuración propia: `playwright.visual.config.ts` (carpeta `tests/visual/`). La suite principal
  (`npx playwright test`, `testDir: 'tests/e2e'`) **no** las recoge, y Vitest tampoco.
- Puerto de la vista previa: 4386 por defecto; se cambia con `VISUAL_WEB_PORT`. No usa el servidor institucional.
- Chromium en otra ruta: `PW_CHROMIUM_PATH=/ruta/a/chrome npm run test:visual`.
- Si una captura falla, Playwright deja en `test-results/` la imagen esperada, la obtenida y la de diferencias
  (`*-expected.png`, `*-actual.png`, `*-diff.png`). `npx playwright show-report` no aplica (el informe es de lista).

## Qué se captura

Nueve pantallas en cuatro proyectos = **36 capturas**:

| Pantalla | Captura |
|---|---|
| Inicio | página completa |
| Catálogo de prácticas | primera pantalla (la lista completa mide hasta 28 000 px) |
| Banco Saber 11 | primera pantalla |
| Banco avanzado, práctica guiada, pregunta SN-A-003 (gráfica de líneas) | página completa |
| La misma pregunta con la retroalimentación abierta | página completa |
| Densidad (práctica 2D), etapa de experimento | página completa |
| Geometría molecular (química con visor 3D), etapa de experimento | página completa, visor enmascarado |
| Panel docente → Moodle y Classroom | página completa |
| Ayuda y accesibilidad | página completa |

Proyectos: `escritorio-claro`, `escritorio-oscuro` (1280 × 800) y `movil-claro`, `movil-oscuro` (390 × 844, táctil);
todos con `deviceScaleFactor: 1`. El tema sale de `prefers-color-scheme` (preferencia «automático» por defecto).

Las referencias se guardan en `tests/visual/__screenshots__/{plataforma}/{proyecto}/{nombre}.png`; hoy solo hay
`linux/` (unos 20 MB).

## Qué se fija, oculta o enmascara, y por qué

| Medida | Motivo |
|---|---|
| Hora fija (`page.clock.setFixedTime`, 2 de marzo de 2026, 10:00 en Bogotá) y zona horaria `America/Bogota` | fechas, «hace N minutos» y temporizadores no cambian entre ejecuciones; los temporizadores siguen corriendo |
| `Math.random` con semilla fija (generador mulberry32 inyectado antes de cargar la página) | la aplicación solo lo usa para barajar el simulacro y en los sonidos, pero así ninguna pantalla depende del azar |
| Movimiento reducido, `animations: 'disabled'` y `tests/visual/estable.css` (sin transiciones ni animaciones, cursor de texto transparente) | una captura no puede quedar a mitad de una transición |
| Se espera `document.fonts.ready`, las imágenes, dos cuadros de animación y que no quede ningún «Cargando…» (secciones diferidas) | las tipografías vienen incluidas (@fontsource), pero se cargan después del primer pintado |
| Service worker bloqueado y `.pwa-toast` oculto | los avisos «el laboratorio ya funciona sin conexión» y «versión nueva» aparecen según el estado del navegador |
| 3Dmol.js bloqueado y el recuadro del visor **enmascarado** (rectángulo magenta) | WebGL dibuja distinto según la tarjeta gráfica y el motor disponible; al bloquear 3Dmol siempre aparece la vista de respaldo, así que el texto y los botones que la rodean son estables y sí se comparan |
| Desplazamiento al principio antes de capturar | la cabecera fija (`position: sticky`) aparecería a media página en la captura completa |

## Tolerancia

`maxDiffPixels: 250` por captura y `threshold: 0.05` (diferencia de color por píxel, escala 0–1).

- Entre ejecuciones en el mismo equipo cambian como mucho unas 50 píxeles (suavizado de bordes y desenfoques del
  vidrio de la cabecera); 250 deja margen sin tapar cambios reales.
- Se descartó una proporción del 1 % (`maxDiffPixelRatio: 0.01`) con el umbral por defecto (0,2): **se comprobó que
  dejaba pasar** un cambio del token `--accent` del tema claro (`#0a5a73` → `#0a7a5a`): ninguna de las 36 capturas
  falló. En una captura completa de 1280 × 4000 px, el 1 % son más de 50 000 píxeles.
- Comprobaciones con la tolerancia elegida (cambio introducido a propósito, compilado y revertido):
  - `--accent` del tema claro `#0a5a73` → `#0a7a5a`: fallan las 18 capturas del tema claro; las 18 del oscuro pasan.
  - Relleno de `.btn` de `8px 16px` a `8px 18px`: fallan 26 de 36 (las que no tienen botones de ese tipo en el área
    capturada, como el catálogo, pasan).

## Cuándo se actualizan las referencias

Solo cuando el cambio visual es **intencional**: abrir las imágenes `*-diff.png` de `test-results/`, confirmar que
lo distinto es justo lo que se cambió, correr `npm run test:visual:update` y revisar en `git diff --stat` que solo
cambiaron las capturas esperadas. Las referencias nuevas van en el mismo commit que el cambio de diseño.

## Por qué no corren en la integración continua

La integración continua usa `ubuntu-24.04` con la misma versión de Playwright (1.56.1), pero las capturas de referencia
se generaron en otro Linux (el contenedor de desarrollo). Aunque las tipografías de la interfaz vienen incluidas, el
dibujo del texto (hinting, suavizado), los símbolos que caen en fuentes del sistema y la versión exacta de las
bibliotecas gráficas pueden diferir. No se puede garantizar una imagen idéntica allí, y una prueba que falla por el
entorno enseña a ignorar fallos. Por eso **no** están en `.github/workflows/deploy.yml`.

Si en el futuro se quiere correrlas en la integración continua, el camino es generar las referencias **en el mismo
entorno** (por ejemplo, en la imagen Docker oficial `mcr.microsoft.com/playwright:v1.56.1-noble`, tanto en el equipo
como en el flujo de trabajo) y empezar con un paso no bloqueante.

## Antes de publicar una versión

Lista de comprobación (además de lo que ya corre la integración continua):

1. `npm run typecheck && npm test && npm run build`.
2. `npm run test:e2e`.
3. `npm run test:visual` en Linux. Si falla: revisar las diferencias; actualizar las referencias solo si el cambio
   fue intencional y anotarlo en el CHANGELOG.
4. Entrada en `CHANGELOG.md` y versión en `package.json`.

## Limitaciones

- Solo hay referencias para Linux. En macOS o Windows la primera ejecución falla por falta de referencias y las
  genera con el sufijo de esa plataforma (`darwin/`, `win32/`); sirven para comparar en ese equipo, pero no conviene
  subirlas sin acordarlo.
- Solo Chromium. Firefox y Safari dibujan distinto y no se cubren.
- El visor 3D real (WebGL) no se compara: está enmascarado y se fuerza la vista de respaldo. Las pruebas de
  `tests/e2e/organica-webgl.spec.ts` y `visores-palitos.spec.ts` comprueban que el visor funcione.
- El catálogo y el banco Saber 11 solo se comparan en su primera pantalla; un problema más abajo en esas listas no se
  detecta aquí (la prueba de 390 px sin desbordamiento de `tests/e2e/movil.spec.ts` sí revisa el ancho).
- En las capturas de página completa, la columna lateral fija (`position: sticky`) de algunas prácticas se ve
  recortada a la altura de la ventana; es un efecto de la captura, estable entre ejecuciones.
- Cubre nueve pantallas de más de 65 prácticas: es una red de seguridad para el sistema de diseño compartido
  (tokens, componentes, plantillas), no una revisión de cada práctica.
