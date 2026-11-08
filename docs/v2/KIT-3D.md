# Kit de escenas 3D (física, biología y ambiente)

Fecha: 2026-11-01 · Código: `src/three/` · Pilotos: péndulo (`pendulo`) y microscopio (`celulas`).

El docente pidió que **todas** las prácticas tengan un visor 3D. Química ya tiene su kit (`src/chem/`, 3Dmol.js,
moléculas y redes cristalinas). Este kit cubre lo demás: escenas hechas de primitivas simples (flechas, resortes,
péndulos, partículas, planos y superficies de agua, células y organelos) que se mueven con **el mismo estado del
laboratorio**, sin física ni biología nueva.

## 1. Arquitectura

```
src/three/
  scene.ts        Tipos de las primitivas y funciones PURAS: vectores, escala de flechas, órbita de la cámara,
                  teclado, proyecciones (perspectiva = la de three.js; ortográfica = respaldo), rótulos, descripción.
  colors.ts       Tokens de diseño → colores (claro/oscuro/alto contraste), lector de variables CSS. Puras.
  renderer.ts     ÚNICO módulo que importa 'three'. Crea el lienzo WebGL, reutiliza mallas por id, dibuja, elige
                  con un rayo y libera la GPU. Se carga con import() diferido.
  FallbackSvg.tsx Vista de respaldo: las MISMAS primitivas con la misma cámara, en SVG (proyección ortográfica).
  Scene3D.tsx     Componente React: carga diferida, detección de WebGL, órbita (ratón, toque, teclado, botones),
                  rótulos HTML, leyenda, estatus, descripción accesible, giro opcional y ganchos de prueba.
  index.ts        Exporta Scene3D y lo puro. NO importa three.js.
```

- **Motor:** three.js **r186** (`three@0.186.1`, MIT, publicado el 2026-09-24), fijado sin `^`. Importaciones con nombre
  (tree shaking) y **sin complementos** de `three/examples`: la órbita, el teclado, los rótulos y la selección son del
  kit (todo `src/three/` son unas 1000 líneas). Tipos: `@types/three@0.186.0` (desarrollo).
- **Fragmento propio:** `renderer-*.js`, 549 KB crudos / **135 KB gzip**. Solo se pide al montar una escena en un equipo
  con WebGL; nunca entra en la entrada, en el catálogo ni en las prácticas sin escena (`npm run perf` lo verifica). El
  service worker lo guarda en la **segunda fase** (archivos > 150 KB), así que no aumenta la precarga inicial.
- **Dibujo bajo demanda:** no hay bucle de animación propio. Se dibuja un cuadro cuando cambian las primitivas (el
  laboratorio vuelve a renderizar), la cámara, el tamaño, el tema o la selección. Si la simulación está en pausa, la
  escena no gasta CPU ni GPU. El único bucle es el «Girar sola» opcional.
- **Liberación:** al desmontar se liberan geometrías, materiales y mallas instanciadas, `renderer.dispose()` y
  `forceContextLoss()` (los navegadores limitan los contextos WebGL abiertos). La prueba de WebGL crea un contexto y lo
  libera enseguida con `WEBGL_lose_context`.
- **Pérdida del contexto** (`webglcontextlost`, p. ej. un celular que libera la GPU): pasa a la vista de respaldo con el
  botón «Reintentar la vista 3D».

### Primitivas (`SceneItem`)

| `kind` | Campos | Para qué |
|---|---|---|
| `sphere` | `center`, `radius` | lenteja, partícula grande, núcleo |
| `ellipsoid` | `center`, `radii` | células, organelos, gotas |
| `box` | `center`, `size`, `edges?`, `rotationZ?` | pared celular, recipientes, bloques; con `rotationZ` (rad, de +x hacia +y alrededor de un eje paralelo a z por su centro), tablas de un plano inclinado y barras de palanca (lote 3D-3). Las aristas (`edges`) son siempre opacas, aunque la caja sea translúcida (desde el lote 3D-4: así el primer cuadro y «Restablecer vista» dan la misma imagen) |
| `rod` | `from`, `to`, `radius` | hilos, varillas, soportes |
| `arrow` | `from`, `vector`, `radius?` | vectores (velocidad, fuerza, campo) |
| `spring` | `from`, `to`, `coils`, `radius`, `wire?` | resortes (ley de Hooke, osciladores) |
| `plane` | `center`, `size: [x, z]` | mesa, superficie del agua, suelo |
| `particles` | `points`, `radius` | gases, cloroplastos, poblaciones |

Comunes: `id` (único; es la clave para reutilizar la malla entre cuadros), `color` (token de diseño o `#rrggbb` solo
para colores reales del objeto), `opacity?`, `label?` (rótulo y entrada de la leyenda), `selectable?`.

Unidades libres por escena (m, cm, µm), eje **y hacia arriba**. `extent` es el radio que debe caber en el lienzo:
**fíjalo por corrida** (no lo recalcules cada cuadro) para que la cámara no salte.

### Vectores

`arrowScale(magnitudMáxima, longitudEnEscena)` da una escala **fija por corrida**; `physicalArrow(desde, vectorFísico,
escala)` devuelve la flecha o `null` si mediría casi cero (no se dibujan flechas de longitud cero). Así las flechas son
proporcionales entre sí y entre cuadros. Usa escalas separadas para magnitudes de distinta unidad (m/s y N) y dilo en
`statusNote`.

## 2. Cómo añadir una escena 3D a una práctica (plantilla)

1. **Funciones puras de la escena** en `src/labs/<practica>3d.ts` (ver `pendulum3d.ts` y `cell3d.ts`):

   ```ts
   import { arrowScale, physicalArrow, type SceneItem, type Vec3 } from '../three/scene';
   export function miEscena(estado: EstadoDelLab): { items: SceneItem[]; extent: number; target: Vec3; description: string } {
     // 1) Lee el MISMO estado/modelo del laboratorio (nada de física o biología nueva).
     // 2) Construye primitivas con ids estables; colores con tokens ('series-1', 'bio', 'data', 'ink'…).
     // 3) Escala fija de flechas por corrida; extent fijo por corrida.
     // 4) Descripción en español con fmt(): qué se ve, valores actuales y direcciones («hacia abajo», «tangente…»).
   }
   ```

2. **En el laboratorio**, memoriza la escena con las mismas variables que dibuja el banco 2D y colócala en una tarjeta:

   ```tsx
   import { Scene3D } from '../three';
   const escena = useMemo(() => miEscena({ ... }), [/* el mismo estado que usa el banco */]);
   <section className="card" aria-labelledby="xyz-3d-h">
     <h3 id="xyz-3d-h">Vista 3D: …</h3>
     <Scene3D idPrefix="xyz" title="… en 3D" items={escena.items} extent={escena.extent} target={escena.target}
       description={escena.description} status="modelo" statusNote="Qué es cálculo y qué es dibujo." />
   </section>
   ```

   - Si la simulación tiene `SimControls`, **no** añadas otra pausa: la escena sigue al tiempo del laboratorio y queda
     quieta en pausa (dibujo bajo demanda). Con movimiento reducido, el laboratorio salta al resultado y la escena también.
   - Para elementos elegibles: `selectable: true` + `selectedId`/`onSelect`; muestra la ficha como `children` de
     `<Scene3D>` dentro de un contenedor `aria-live="polite"` y enlázala con contenido que la práctica ya tiene.
   - `status`: `'modelo'` si posiciones y vectores salen del cálculo; `'ilustracion'` si es un dibujo de referencia.

3. **Pruebas**:
   - Unitarias de las funciones puras (posiciones = modelo, flechas tangentes/proporcionales, descripción) en
     `tests/unit/` (ver `tests/unit/kit3d.test.ts`).
   - E2E con WebGL (`--use-angle=swiftshader --enable-unsafe-swiftshader`) y sin WebGL (`--disable-webgl
     --disable-webgl2 --disable-3d-apis`): copia `tests/e2e/escenas-3d-webgl.spec.ts` y `escenas-3d-sin-webgl.spec.ts`
     con sus utilidades `tests/e2e/escenas-3d-comun.ts` (`pixels()` cuenta píxeles pintados con el gancho
     `snapshot()`; `description()` lee la descripción accesible; `waitEngine()` espera `data-engine`).
   - axe claro y oscuro, sin desbordamiento a 390 px, teclado (→ cambia la imagen; «Restablecer vista» la devuelve
     idéntica).
4. **Regresión visual:** si la práctica está en `tests/visual/pantallas.spec.ts`, enmascara la tarjeta de la escena
   (`figure.scene3d`) igual que el visor de química: su dibujo depende de la GPU.
5. **Presupuesto:** `npm run perf` debe seguir verde; el motor no debe aparecer en la ruta de la práctica (va aparte).

## 3. Accesibilidad (WCAG 2.2 AA)

- **Nombre y descripción:** el contenedor de la escena es `role="img"` enfocable, con nombre (título + cómo girar) y
  `aria-describedby` hacia una descripción que se actualiza con el estado y la cámara («vista girada 38° e inclinada
  13°, acercamiento 1,0×»). No es una región viva (no interrumpe al lector cada cuadro); los valores importantes
  siguen en las lecturas del laboratorio.
- **Teclado:** ← → giran 15°, ↑ ↓ inclinan, + y − acercan y alejan, Inicio (o 0) restablece. Foco visible (borde de
  3 px con `--focus`). Botones equivalentes (↺ ↻ ↑ ↓ + − «Restablecer vista»), así **ningún gesto de arrastre es
  imprescindible** (2.5.7) y los objetivos miden ≥ 34 px (2.5.8).
- **Táctil:** un dedo en horizontal gira; en vertical desplaza la página (`touch-action: pan-y`, para no atrapar el
  desplazamiento en el celular); pellizco acerca. La rueda solo acerca con la escena enfocada (clic o Tab).
- **Movimiento (2.2.2):** nada se mueve solo al abrir. «Girar sola» lo inicia la persona, se detiene con «Pausar el
  giro» y está desactivado con movimiento reducido (sistema o preferencia de la app).
- **Rótulos:** superpuestos en HTML (texto real, nítido, con el tamaño de letra de la app), `aria-hidden` porque la
  misma información está en la **leyenda** (lista con nombre accesible; botones con `aria-pressed` si se pueden elegir).
  Se colocan sin taparse ni salirse del lienzo (`spreadLabels`).
- **Color:** todo con tokens de diseño; el tema claro/oscuro/alto contraste cambia la escena sin recargarla. El color
  nunca es la única pista: cada flecha y estructura tiene rótulo.
- **Estatus epistémico** (ADR 0002): chip «Escena 3D: Modelo calculado / Ilustración educativa» y una frase sobre qué es
  cálculo y qué es dibujo (p. ej., «la lenteja se dibuja con un radio mínimo para que se vea»).

## 4. Rendimiento

- three.js solo en `renderer.ts` y con `import()`; `index.ts` no lo importa. Comprobado por `npm run perf`: la entrada,
  el inicio, la práctica liviana, la práctica 3D de química, el panel docente y la propia práctica del péndulo **no**
  cargan el motor (lista `FORBIDDEN`), y el motor tiene su propio límite (155 KB gzip; mide 135).
- Mallas unitarias compartidas (esfera, cilindro, cono, caja, plano) que se escalan; materiales por primitiva; resortes
  y nubes de partículas se reconstruyen solo si cambian su número de espiras/puntos o su largo.
- `devicePixelRatio` máximo 2, `powerPreference: 'low-power'`, antialias, fondo transparente.
- Sin sombras ni posprocesado. Una luz hemisférica y una direccional que acompaña a la cámara.

## 5. Política de respaldo

| Situación | Qué se ve |
|---|---|
| Sin WebGL (equipos viejos, navegador con WebGL apagado) | **Vista de respaldo en 2D**: las mismas primitivas, posiciones, flechas, rótulos y selección, en proyección ortográfica, con el mismo teclado, botones y arrastre. Aviso: «este equipo no ofrece WebGL». three.js **no se descarga**. |
| WebGL, pero no se pudo descargar el motor (sin conexión antes de la 2.ª fase del service worker) | La misma vista de respaldo; aviso «no se pudo cargar el motor 3D» y botón «Reintentar la vista 3D». |
| Se pierde el contexto WebGL | Igual que el caso anterior. |
| Pruebas | `window.__lvSinWebgl = true` (con `page.addInitScript`) fuerza el respaldo aunque haya WebGL. |

Nunca se muestra solo «no disponible»: la escena sigue sirviendo para la clase.

Ganchos de prueba (no cambian lo que se ve): `figure.scene3d[data-engine]` (`cargando | disponible | sin-webgl |
no-disponible`) y, en el contenedor `#<prefijo>-s3d`, `__lvScene3D = { engine, revision, snapshot() }` (`snapshot`
dibuja y devuelve la imagen del lienzo sin `preserveDrawingBuffer`).

## 6. Pilotos

### Péndulo (`src/labs/PendulumLab.tsx`, `src/labs/pendulum3d.ts`)

- Tarjeta «Vista 3D: movimiento, velocidad y fuerzas» bajo las lecturas. Soporte universal, hilo, lenteja (color del
  material), trayectoria (arco de θ₀ a −θ₀) y, al soltar, flechas **v** (tangente), **T** (hacia el punto de
  suspensión) y **P** (hacia abajo) con su valor en el rótulo.
- Misma corrida (`simulatePendulum`) y mismo instante (`angleAt(run, t)`) que el banco 2D; ω(t) interpola las muestras
  de la integración RK4 (`omegaAt`); T = m·(g·cos θ + L·ω²). Escalas fijas por corrida: rapidez máxima √(2gL(1 − cos
  θ₀)) y tensión máxima m·g·(3 − 2 cos θ₀) miden 0,32·L.
- «Pausar» de SimControls congela la escena (probado: la imagen y la descripción no cambian en pausa y el ángulo
  coincide con la descripción del banco).

### Microscopio (`src/labs/MicroscopeLab.tsx`, `src/labs/cell3d.ts`)

- Tarjeta «Vista 3D: la célula y sus estructuras»: una célula de la muestra elegida con los tamaños de la práctica
  (cebolla 250 × 60 µm, elodea 60 × 25 µm, mucosa ≈ 55 µm aplanada, levadura 6 × 5 µm con yema).
- Estructuras = las que la práctica estudia en esa muestra (`STRUCTURES`, con sus nombres) **más la membrana celular**.
  Se eligen tocándolas (rayo de three.js; lo opaco dentro de una envoltura translúcida gana) o con la leyenda.
- La ficha dice la función (redactada a partir del fondo y la evaluación de la práctica) y **si se ve con la
  preparación actual** usando la misma observación del microscopio (`observe` → «no se ve: necesita tinción (lugol o
  azul de metileno)»).
- No dice el reino (vegetal, animal, hongo): clasificar sigue siendo tarea del estudiante.

## 7. Límites conocidos

- Animación sin reloj del laboratorio (lote 3D-4): si la práctica no tiene tiempo propio (circuitos, conductores), la vista
  usa `useFlowClock` y `FlowControls` de `src/labs/lote3d4/flow.tsx`: arranca quieta, la inicia la persona, se pausa
  (WCAG 2.2.2) y queda desactivada con movimiento reducido. No la uses si el laboratorio ya tiene `SimControls`.

- Escenas alargadas (lote 3D-6): `extent` encuadra una esfera, así que en una pantalla ancha (lienzo apaisado) manda
  la altura y en un celular (lienzo casi cuadrado) manda el ancho. Las vistas del lote 3D-6 devuelven dos encuadres
  (`extent`/`target` y `narrow`) y eligen con `useNarrow()` de `src/labs/lote3d6/useNarrow.ts` (≤ 600 px); el contenido
  de la escena no cambia. Una varilla corta y muy ancha se dibuja en el respaldo SVG como una línea gruesa (casi un
  círculo): para discos planos usa una caja delgada.
- La vista de respaldo es ortográfica y ordena por profundidad del objeto (no por píxel): con objetos que se
  cruzan puede dibujar uno delante de otro de forma aproximada. Las cajas y elipsoides translúcidos se tratan como
  recipientes (van detrás de lo que contienen).
- Los rótulos HTML no se ocultan detrás de objetos (siempre visibles, como en el visor de química).
- SwiftShader (pruebas) dibuja sin GPU; en equipos reales el aspecto puede variar un poco (por eso la regresión visual
  enmascara las escenas).
- Formas de célula simplificadas (ladrillo, disco, óvalo): ilustración, no reconstrucción de imágenes reales.
