# Rendimiento en equipos modestos

Auditoría del 2026-11-01 (versión 2.14.1 → cambios sin publicar). Atiende dos puntos de la hoja de ruta: «Rediseño,
paso siguiente: medir con Lighthouse» y «Mejoras: auditoría de rendimiento en equipos modestos».

## 1. Método

- **Herramienta:** Lighthouse 12.8.2 (paquete npm, instalado fuera del repositorio; no es dependencia del proyecto)
  con Chromium 141 de Playwright (`/opt/pw-browsers/chromium-1194`), sin interfaz (`--headless=new`).
- **Perfil (el predeterminado de Lighthouse para móvil):** teléfono Moto G Power emulado (412 × 823 px, densidad
  1,75), **CPU 4× más lenta** y red **«Slow 4G»** (150 ms de latencia, 1,6 Mbit/s de bajada, 750 kbit/s de subida).
  El estrangulamiento es **simulado** (Lantern): Lighthouse carga la página sin límites y estima los tiempos con ese
  perfil. Es el método de PageSpeed Insights; es reproducible, pero no es una medición en un equipo real.
- **Servidor:** `vite preview` de la compilación de producción (`npm run build`), con compresión gzip como GitHub
  Pages. Caché y almacenamiento limpios en cada corrida (primera visita, sin service worker previo).
- **Páginas:** inicio, catálogo, una práctica 2D liviana (`densidad`), dos prácticas con visores 3D
  (`oxidos-hidroxidos`, `hidrocarburos`), el banco Saber 11 (`#/banco`), el banco avanzado en práctica guiada
  (`#/banco/avanzado`) y en simulacro (`#/banco/avanzado?modo=simulacro`), y el panel docente (`#/docente`).
- **Repeticiones:** 3 por página y versión, **intercaladas** (antes, después, antes, después…) para que la carga de la
  máquina afecte por igual a las dos versiones. Se informa la **mediana**.
- **Tamaños:** `npm run perf` (gzip nivel 9 de cada archivo de `dist/` y cierre de importaciones estáticas de cada
  ruta según el manifiesto de Vite). Son bytes exactos, sin ruido.

**Advertencia sobre el ruido.** El TBT (tiempo de bloqueo) simulado multiplica el tiempo de CPU observado en esta
máquina, que comparte procesador con otras tareas: la misma versión dio TBT de 364 a 620 ms en el inicio entre
corridas, y el catálogo pasó de 1 660 ms (primera serie) a 1 551 ms (segunda serie) sin ningún cambio. Diferencias de
TBT menores a ~200 ms y de LCP menores a ~0,3 s no deben leerse como mejoras ni como retrocesos. El CLS también varía:
el salto del pie de página aparecía en unas corridas y en otras no, según el orden en que llegaban los archivos.

## 2. Resultados (mediana de 3, perfil móvil 4× CPU, Slow 4G)

FCP, LCP y TTI en segundos; TBT en milisegundos; JS y total en KB transferidos (comprimidos) en la carga inicial, con
el número de archivos JS entre paréntesis.

| Página | Versión | Puntaje | FCP | LCP | TBT | CLS | TTI | JS (archivos) | Total |
|---|---|---|---|---|---|---|---|---|---|
| Inicio | antes | 81 | 2,5 | 2,8 | 459 | 0,034 | 3,6 | 144 (4) | 312 |
| | después | 84 | 2,5 | 2,8 | 337 | 0,034 | 3,4 | 144 (4) | 312 |
| Catálogo | antes | 64 | 1,8 | 3,4 | 1 551 | 0,000* | 4,4 | 145 (4) | 245 |
| | después | 64 | 2,2 | 3,5 | 1 361 | 0,000 | 4,2 | 146 (4) | 271 |
| Densidad (2D) | antes | 69 | 1,8 | 4,5 | 182 | 0,212 | 4,7 | 293 (25) | 483 |
| | después | 81 | 1,8 | 4,4 | 137 | 0,000 | 4,6 | 293 (26) | 484 |
| Óxidos e hidróxidos (3D) | antes | 54 | 2,0 | 4,9 | 260 | 0,500 | 4,9 | 328 (30) | 519 |
| | después | 80 | 1,8 | 4,9 | 56 | 0,057 | 4,9 | 329 (31) | 520 |
| Hidrocarburos (3D) | antes | 66 | 1,8 | 4,7 | 212 | 0,006* | 4,8 | 315 (28) | 506 |
| | después | 78 | 1,7 | 4,8 | 194 | 0,000 | 4,8 | 316 (29) | 507 |
| Banco Saber 11 | antes | 40 | 2,8 | **9,8** | 826 | 0,206 | 9,8 | **917 (141)** | 1 086 |
| | después | **87** | 2,4 | **3,2** | 194 | 0,000 | 3,5 | **180 (5)** | 348 |
| Banco avanzado · guiada | antes | 60 | 2,4 | 4,6 | 487 | 0,206 | 4,6 | 382 (8) | 550 |
| | después | 85 | 1,9 | 3,6 | 247 | 0,000 | 3,6 | 327 (13) | 495 |
| Banco avanzado · simulacro | antes | 66 | 2,9 | 4,5 | 175 | 0,206 | 4,5 | 382 (8) | 503 |
| | después | 84 | 2,0 | 4,2 | 97 | 0,000 | 4,2 | 327 (13) | 448 |
| Panel docente | antes | 50 | 2,8 | **9,9** | 471 | 0,206 | 9,9 | **991 (146)** | 1 134 |
| | después | 57 | 2,9 | 10,0 | 560 | 0,000 | 10,0 | 993 (147) | 1 136 |

\* En la primera serie de mediciones (sin intercalar) el catálogo dio CLS 0,206 y hidrocarburos 0,425 con la versión
anterior: el salto del pie de página dependía del orden de llegada de los archivos.

Lectura:

- **Banco Saber 11:** el cambio más grande. Cargaba el currículo completo (las 65 fichas y sus modelos: 141 archivos,
  ~860 KB comprimidos) solo para la opción «Todas, incluidas las de las prácticas» y para mostrar el título de la
  práctica relacionada. LCP de 9,8 s a 3,2 s.
- **Banco avanzado:** la página ya no trae el banco tipo Saber ni los datos de todas las prácticas (~66 KB comprimidos
  que no usaba) y se pinta antes de que lleguen los 180 ítems. LCP de 4,6 s a 3,6 s (guiada) y de 4,5 s a 4,2 s
  (simulacro).
- **CLS:** el pie de página saltaba hacia abajo al llegar el contenido (0,21 a 0,50 en varias páginas). Ahora 0 en todas
  menos óxidos e hidróxidos (0,057, por debajo del umbral «bueno» de 0,1; ver pendientes).
- **Prácticas:** LCP y JS sin cambios apreciables (diferencias dentro del ruido). El puntaje sube por el CLS.
- **Inicio y catálogo:** sin cambios de código que los afecten; las diferencias de TBT son ruido de la máquina.
- **Panel docente:** sin cambios (sigue cargando las 65 fichas completas; ver pendientes).

## 3. Tamaños de la compilación (`npm run perf`)

KB comprimidos con gzip nivel 9; «ruta» = entrada + todo lo que la ruta importa de forma estática al abrirse.

| Medida | Antes | Después | Límite |
|---|---|---|---|
| JS de entrada | 122,5 | 122,6 | 140 |
| CSS de entrada (bloquea el pintado) | 25,5 | 25,6 | 30 |
| Ruta: inicio | 122,5 | 122,6 | 140 |
| Ruta: catálogo | 125,9 | 126,0 | 145 |
| Ruta: práctica liviana (densidad: página + ficha + laboratorio) | 290,9 | 291,2 | 335 |
| Ruta: práctica 3D (óxidos e hidróxidos; 3Dmol aparte, bajo demanda) | 374,2 | 374,5 | 430 |
| Ruta: banco Saber 11 | 860,7 (140 archivos) | 172,4 (4 archivos) | 200 |
| Ruta: banco avanzado, lo necesario para pintar la página | 373,0 | 139,3 | 160 |
| Ruta: banco avanzado con los 180 ítems | 373,0 | 316,5 | 365 |
| Ruta: panel docente | 932,5 (145 archivos) | 933,8 (146 archivos) | 1 075 |
| Mayor archivo JS | 173,7 (banco avanzado completo) | 158,4 (modelo AlphaFold, proteínas) | 185 |
| Precarga del service worker al instalar (MB crudos) | 9,59 (267 archivos) | 5,43 (265 archivos) | 6,4 |

El script además falla si el banco Saber 11, el catálogo o el inicio vuelven a cargar el currículo completo, o si la
página del banco avanzado vuelve a arrastrar los ítems, el banco tipo Saber o los datos de las prácticas.

**Kit de escenas 3D (2026-11-01, `docs/v2/KIT-3D.md`).** Se añadieron dos medidas sin subir ningún límite existente:

| Medida | Medido | Límite |
|---|---|---|
| Ruta: práctica con escena 3D (péndulo: página + ficha + laboratorio + `<Scene3D>`) | 303,7 (29 archivos) | 350 |
| Motor 3D diferido (three.js r186, fragmento `renderer-*.js`) | 135,0 (549 KB crudos) | 155 |

El motor no cuenta en ninguna ruta porque se pide con `import()` solo al montar una escena con WebGL; el script falla si
aparece en el JS estático del inicio, la práctica liviana, la del péndulo, la 3D de química o el panel docente. Con el
kit, la entrada sigue en 122,6 KB, el CSS de entrada pasó de 25,6 a 25,7 KB (reglas `.scene3d-*`) y la precarga del
service worker de 5,43 a 5,46 MB (el componente y los pilotos; three.js, por pasar de 150 KB, va a la segunda fase).

**Panel docente sin las fichas completas (2026-11-03, ola 2a).** Con las 79 prácticas de la ola 2a, el panel docente
pasó de 1 050 a 1 106,3 KB y superó su límite de 1 075 KB. En lugar de subirlo, `src/pages/TeacherPage.tsx` ya no
importa `src/curriculum/index.ts` de forma estática: el panel pinta su encabezado, el aviso, las pestañas, el inicio
(el número de prácticas sale del catálogo liviano), las asignaciones y la rúbrica sin esperar las fichas, y pide el
currículo con `import()` en segundo plano apenas se abre. Las pestañas que necesitan la ficha completa (catálogo con
DBA, validación curricular, asignaciones y listas, informes, servidor) se envuelven en `CurriculumGate`, que muestra
«Cargando las prácticas…» y, sin conexión, «Reintentar»; «Seguimiento del curso» y «Moodle y Classroom» se cargan con
`lazy()`. El presupuesto se separa en dos medidas:

| Medida | Antes | Después | Límite |
|---|---|---|---|
| Ruta: panel docente (lo que se descarga antes de pintar) | 1 106,3 (176 archivos) | 286,9 (22 archivos) | 330 |
| Panel docente con las fichas completas (panel + `curriculum/index.ts`, en segundo plano) | — | 1 093,6 (174 archivos) | 1 250 |

El límite de 1 250 KB deja margen para unas 25 prácticas más (≈ 6 KB comprimidos por ficha con su modelo) y el script
falla si el panel vuelve a importar el currículo de forma estática (`FORBIDDEN`). Pendiente: una ficha docente liviana
(vínculo curricular y preguntas sin los modelos) bajaría también la segunda medida.

## 4. Cambios

1. **Banco Saber 11 sin el currículo completo** (`src/pages/BankPage.tsx`). El título de la práctica relacionada sale
   del catálogo liviano (`metaById`); las preguntas de las prácticas se descargan solo al elegir «Todas, incluidas las de
   las prácticas» (con aviso de carga y botón «Reintentar» si no hay red). El número de preguntas de esa opción aparece
   cuando ya se descargaron.
2. **Utilidades de descarga aparte** (`src/lib/download.ts`): `downloadText`, `downloadBlob`, `copyText` y `slug` vivían
   en `src/lib/report.ts`, que importa el banco tipo Saber y los datos de todas las prácticas. El banco avanzado, las
   gráficas, el QR, el registro de datos y las pestañas del panel docente las importan ahora del módulo nuevo;
   `report.ts` las reexporta (nada externo cambia).
3. **Banco avanzado por bloques y bajo demanda** (`src/assessment/avanzado/cargar.ts`, `scoring.ts`). La lógica pura
   (puntaje, bloque más débil, refuerzo) se separó de los ítems; la página pinta encabezado, aviso y pestañas mientras
   descarga los seis bloques en paralelo (seis archivos de 28–34 KB comprimidos en lugar de uno de 174 KB; un cambio en
   un bloque solo invalida ese archivo). `ADVANCED_BANK` sigue existiendo para las pruebas, los documentos y el panel
   docente; una prueba unitaria nueva verifica que el banco cargado por bloques es idéntico. Al incorporar un bloque nuevo
   hay que registrarlo en `bloques.ts` y en `cargar.ts` (la prueba lo detecta si falta).
4. **Sin salto del pie de página (CLS)** (`src/plataforma.css`): el estado «Cargando…» ocupa al menos la altura de la
   pantalla, así el pie no aparece arriba para luego bajar cuando llega la página.
5. **Precarga sin conexión en dos fases** (`scripts/build-sw.mjs`, `scripts/sw-template.js`, `src/lib/pwa.ts`):
   - El service worker se registra cuando la página terminó de cargar **y** el navegador está desocupado (o a los 5 s),
     para no competir con los archivos de la práctica que el estudiante abre.
   - Al instalarse guarda el **núcleo** (5,43 MB: la aplicación y todas las prácticas salvo los archivos grandes) y avisa
     «ya funciona sin conexión» con la mitad de descarga que antes (9,59 MB).
   - Los **9 archivos JS de más de 150 KB** que no son la entrada (4,16 MB: 3Dmol.js, modelos de proteínas 1EMA, 2HHB,
     2LZM y AlphaFold, datos de PubChem del taller de compuestos, moléculas de química orgánica, propiedades de grupos
     funcionales y nomenclatura orgánica) se guardan después, en serie, cuando la página avisa que está desocupada.
   - Si el navegador pide **ahorro de datos** (`navigator.connection.saveData`), la segunda fase no se pide: esos archivos
     se guardan solo cuando se abre la práctica que los usa (caché en tiempo de ejecución, como antes).
   - **Compromiso:** si el estudiante cierra el navegador o pierde la conexión antes de que termine la segunda fase, las
     prácticas de proteínas, taller de compuestos, química orgánica y geometría molecular 3D no abrirán sin conexión
     hasta la próxima visita con internet (la segunda fase se reintenta en cada visita y solo descarga lo que falta). El
     resto de prácticas, incluida la de la prueba sin conexión (`tests/e2e/offline.spec.ts`), queda disponible desde la
     instalación. Se actualizaron los textos de Ayuda y del README.
6. **Presupuesto en CI** (`scripts/presupuesto-rendimiento.mjs`, `npm run perf`, paso en `.github/workflows/deploy.yml`
   después de la compilación). Es determinista: mide bytes de `dist/`, nunca tiempos. Usa el manifiesto de Vite
   (`dist/.vite/manifest.json`, activado en `vite.config.ts` y excluido de la precarga).

**Probado y descartado:** adelantar la descarga del componente del laboratorio (y de la página de práctica) en paralelo
con la ficha. En una serie de Lighthouse (sin intercalar) el LCP de las prácticas 3D empeoró (4,6 → 5,5 s en óxidos e
hidróxidos; JS inicial 328 → 390 KB) porque la
práctica abre en «Preparación» y el laboratorio competía por la red con lo que sí se pinta; sin el laboratorio, la
mejora quedó dentro del ruido. Se retiró.

## 5. Pendientes recomendados (por impacto)

1. **Panel docente** (en parte resuelto en la ola 2a: abre con 287 KB y descarga las fichas en segundo plano): las 79
   fichas completas con sus modelos siguen pesando ≈ 1,1 MB cuando se abre una pestaña que las usa. Falta una ficha
   docente liviana (vínculo curricular y preguntas, sin los modelos).
2. **Banco tipo Saber en cada práctica** (~44 KB comprimidos por práctica): `report.ts` → `assessment/lookup.ts` importa
   el banco completo para resolver 2–4 preguntas de transferencia. Se podría generar un índice por práctica en la
   compilación o cargar el banco al llegar a «Evaluación».
3. **Costo de pintar el catálogo** (TBT 1,4–1,6 s simulado, 4 400 nodos): 65 tarjetas con miniaturas SVG detalladas.
   Opciones: paginar o virtualizar, `content-visibility: auto` en las tarjetas (revisar antes el efecto en las
   capturas de la regresión visual) o miniaturas más simples.
4. **Modelos de todas las prácticas en el panel de datos** (~25 KB comprimidos): `DataPanel` arrastra los modelos de
   presión, cinética, proyectiles, péndulo, etc. en cualquier práctica.
5. **CSS único de 135 KB (26 KB comprimidos) que bloquea el pintado:** Lighthouse estima 150–900 ms de ahorro. Separar
   los estilos de laboratorios y del panel docente del estilo base.
6. **CLS residual de 0,057 en óxidos e hidróxidos** (pie de página): no se reprodujo con Playwright; falta encontrar
   qué cambia de altura después del primer pintado.
7. **Fuentes:** los cambios de fuente causan desplazamientos pequeños (≈0,01). Precargar Atkinson 400/700 requeriría un
   complemento de Vite para conocer los nombres con hash; no compensa hoy.
8. **Sonido en la entrada** (~8 KB comprimidos de recetas de sonido): podría cargarse con el primer sonido, pero cambia
   el momento del primer sonido; revisar con `tests/e2e/sound.spec.ts`.

## 6. Lo que no se pudo medir

- **Equipos reales del colegio.** Todo es simulación de Lighthouse en un servidor; no se midió en un computador
  escolar ni en un teléfono de gama baja. Recomendado: abrir Lighthouse en Chrome (DevTools → Lighthouse → Móvil) en
  un equipo del colegio con la versión publicada.
- **Interacción** (INP): Lighthouse en modo navegación no mide la respuesta a clics. No se midió el tiempo de cambiar de
  pregunta en el simulacro ni de mover controles en las prácticas.
- **Tiempo de la precarga del service worker** con red lenta: el estrangulamiento de red de Chrome DevTools no se
  aplica a las descargas del service worker, así que solo se informan bytes (5,43 MB + 4,16 MB), no segundos.
- **Visores 3D (WebGL):** Chromium sin interfaz de este entorno no tiene GPU; el costo de 3Dmol.js al girar moléculas
  no se midió. Las cifras de las prácticas 3D corresponden a la etapa inicial («Preparación»).
- **HTTP/2 de GitHub Pages:** `vite preview` sirve HTTP/1.1; con muchas solicitudes pequeñas (panel docente) la cifra
  real puede ser algo mejor.

## 7. Cómo repetir la medición

```bash
npm run build && npm run perf                    # presupuesto de tamaños (lo mismo que corre en CI)
npx vite preview --port 4396 --strictPort &      # servidor de la compilación
npx -y lighthouse@12.8.2 'http://localhost:4396/#/banco' --only-categories=performance \
  --chrome-flags='--headless=new --no-sandbox' --chrome-path="$CHROME_PATH" --view
```

Para comparar dos versiones, repetir cada página al menos 3 veces intercalando versiones y usar la mediana.
