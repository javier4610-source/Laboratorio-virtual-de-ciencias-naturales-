# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versión semántica
([SemVer](https://semver.org/lang/es/)): MAYOR cuando cambia un contrato existente (rutas, identificadores,
formato de datos guardados), MENOR cuando se agregan prácticas o funciones, PARCHE para correcciones.
Cada versión se puede revertir con `git revert` sin afectar las anteriores.

## [Sin publicar]

## [2.24.0] · 2026-11-08

Prácticas nuevas, ola 2b (82 prácticas): clasificación de los seres vivos, homeostasis de la glucosa y efecto invernadero.

### Añadido
- **Ola 2b de prácticas nuevas** (las tres de prioridad 2 que faltaban del análisis curricular; 82 prácticas en total),
  con el mismo patrón de la ola 2a: modelo en `src/models` con pruebas y caso dorado, conjuntos de datos con relaciones,
  cinco preguntas tipo Saber originales y una de transferencia en el banco, ideas erróneas, avisos con «Cómo corregirlo»,
  procedencia, vínculo curricular (formulación propia, por verificar), miniatura, guía en PDF y vista 3D con respaldo SVG:
  - `clasificacion-seres-vivos` (6.º, biología): 25 organismos reales con nombre científico (muchos de Urabá: hormiga
    arriera, bocachico, mangle rojo, hongo de la sigatoka negra, Plasmodium vivax), claves de reinos, animales y plantas
    recorridas dilema a dilema, constructor de claves (n − 1 dilemas, profundidad ≥ ⌈log₂ n⌉), tres dominios (Woese y
    otros, 1990) frente a cinco y seis reinos; 3D: ejemplares simplificados dibujados con los caracteres del modelo
    (patas, antenas, aletas, flores, esporas) y bandeja del grupo que falta separar.
  - `homeostasis-glucosa` (10.º, biología): modelo mínimo de Bergman (1979) con parámetros de un sujeto normal (Furler
    y otros, 1985) y extensiones ilustrativas rotuladas (secreción de insulina, glucagón, absorción, ejercicio, ejemplos
    de diabetes tipo 1 y 2, insulina rápida); prueba de tolerancia de 75 g con los criterios de la ADA 2025, insulina o
    glucagón bloqueados, hipoglucemia con aviso; barra común de simulación; 3D: partículas de glucosa, insulina y
    glucagón en número proporcional a la concentración y flechas de los flujos. No diagnostica.
  - `efecto-invernadero` (11.º, ambiental): balance de energía con S₀ = 1361 W/m² (Kopp y Lean, 2011), σ de CODATA
    2018 y α = 0,30 (T_e = 254,6 K), Marte y Venus de la NASA Planetary Fact Sheet, modelo de una capa (ε = 0,78 → 288 K),
    forzamiento ΔF = 5,35·ln(C/C₀) (Myhre, 1998) y sensibilidad climática del IPCC AR6; 3D: la sombra de la Tierra es un
    disco, la Tierra emite por la esfera y las flechas miden los flujos del modelo.
  Pruebas: `tests/unit/ola2bModelos.test.ts`, `tests/unit/escenas3dOla2b.test.ts`, casos dorados y
  `tests/e2e/ola2b*.spec.ts` (flujo, valor dorado en la interfaz, 3D con y sin WebGL, axe claro/oscuro, 390 px).

### Cambiado
- **Service worker**: los modelos de proteínas (estructuras del PDB y de AlphaFold) van siempre a la segunda fase; la
  insulina 3I40 (85 KB) era el único en la precarga. Así la precarga queda en 6,37 de 6,4 MB con las 82 prácticas
  (docs/v2/RENDIMIENTO.md).
- **Service worker**: los seis bloques del banco avanzado (≈ 580 KB, una sola página) también van a la segunda fase;
  con el lote 3D-5 y la ola 2b juntos la precarga pasaba de 6,4 MB. Queda en 5,9 MB.

## [2.23.0] · 2026-11-08

Lote 3D-5: vista 3D en ondas, sonido, óptica, interferencia, presión, flotación y densidad.

### Añadido
- **Lote 3D-5 «ondas, luz y fluidos»** (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas `src/three`: tarjeta
  «Vista 3D» que se abre a pedido (carga diferida; three.js sigue fuera de las rutas), respaldo SVG sin WebGL, teclado,
  tacto, descripción textual viva y estatus «Modelo calculado» en `ondas` (la cuerda con la onda del modelo en el mismo
  instante del generador, regla y marcadores A y B), `sonido` (tubo de resonancia con capas de aire que vibran con la
  onda estacionaria del banco, presión coloreada, nodos y vientres), `optica` (rayos de Snell y Fresnel en el plano de
  incidencia; ángulos tras medir), `interferencia` (riel con la pantalla a la distancia L y el patrón del modelo
  ampliado: franjas separadas λ·L/d; crestas de cada rendija), `presion` (sonda en el tanque con capas coloreadas por
  ρ·g·h y manómetro en U; botella con los chorros del modelo), `flotacion` (línea de flotación, peso, empuje y tensión,
  líquido desalojado y densímetro) y `densidad` (balanza, probeta a escala en volumen y cubos de 50 g de cada material).
  Las ondas de `sonido` e `interferencia` se mueven solo con «Mover el aire / las ondas», se pausan y quedan quietas con
  movimiento reducido. Pruebas: `tests/unit/lote3d5.test.ts` y `tests/e2e/visor3d-lote5.spec.ts`.

### Cambiado
- `sonido`: la envolvente en vivo de la fuente pasa a `src/labs/soundEnvelope.ts` (la usan el banco y la vista 3D).
- Regresión visual: la referencia de `densidad` cambia solo por la tarjeta cerrada «Vista 3D» (+144 px de alto).

### Corregido
- Paginador de prácticas: con un título vecino largo (p. ej., en `optica`) desbordaba 2 px a 390 px; ahora el texto se parte.

## [2.22.0] · 2026-11-03

Prácticas nuevas, ola 2a (79 prácticas): estados de la materia, cambios químicos, movimiento circular, lentes y magnetismo; el panel docente abre sin descargar todas las fichas.

### Añadido
- **Ola 2a de prácticas nuevas** (prioridad 2 del análisis curricular; 79 prácticas en total), cada una con cinco etapas,
  modelo en `src/models` con pruebas y valores dorados, conjuntos de datos con relaciones, cinco preguntas tipo Saber
  originales y una de transferencia en el banco, ideas erróneas con retroalimentación, avisos con «Cómo corregirlo»,
  procedencia, vínculo curricular (formulación propia, por verificar), miniatura y vista 3D con respaldo SVG:
  - `estados-de-la-materia` (6.º, química): curva de calentamiento del agua con dos mesetas (c de Serway; L_f = 334 y
    L_v = 2256 J/g de las entalpías del NIST WebBook), L = P·Δt/m, ebullición con la presión (IAPWS-IF97 + ISA: Apartadó
    99,9 °C, Bogotá 91,2 °C, olla a presión ≈ 120 °C); 3D: caja de 27 partículas (red, líquido, vapor) sincronizada con
    la curva, cuya agitación sigue a √T y no cambia en las mesetas.
  - `cambios-quimicos` (7.º, química): siete procesos (vinagre + bicarbonato con globo, CaCO₃, lana de acero en la
    probeta, vela, azúcar disuelta y carbonizada, agua que hierve) con evidencias calculadas (estequiometría, gases
    ideales, Henry, entalpías del NBS: ΔT = −3,4 °C), reactivo límite, prueba de recuperación y clasificación del
    estudiante; 3D: `Reaction3D` con átomos conservados (confórmeros de PubChem del ácido acético y el acetato
    descargados el 2026-11-03) y `SpeciesScene3D` con moléculas que solo se separan según el avance del modelo.
  - `movimiento-circular` (10.º, física): mesa de aire con sensor de fuerza (v = 2πr/T, a = v²/r, F = m·v²/r; caso
    3,95 N), cuerda que se corta y el disco sale por la tangente, curva plana v_máx = √(μgr) (μ de Serway y valores
    ilustrativos); 3D: velocidad tangente, aceleración y tensión hacia el eje.
  - `lentes` (9.º, física): banco óptico (1/f = 1/d_o + 1/d_i, M = −d_i/d_o, mancha borrosa, lupa, divergente, lente
    misteriosa) y ojo reducido con miopía (−2,0 D) e hipermetropía (+2,67 D); 3D: tres rayos principales y la imagen.
  - `magnetismo-imanes` (7.º, física): imán de dos polos (tiende al dipolo), brújula con el campo de la Tierra en
    Apartadó del Modelo Magnético Mundial WMM2025 (H = 26 967 nT, declinación −7,5°), fuerzas entre polos, materiales,
    Oersted y bobina (tan θ = B/H); 3D: líneas de campo integradas en el espacio y brújulas alineadas.
  Pruebas: `tests/unit/ola2aModelos.test.ts`, `tests/unit/escenas3dOla2a.test.ts`, casos dorados y
  `tests/e2e/ola2a*.spec.ts` (flujo, valor dorado en la interfaz, 3D con y sin WebGL, axe claro/oscuro, 390 px).

### Cambiado
- **Panel docente**: ya no importa las fichas completas de forma estática; abre con 287 KB comprimidos (antes 1 106) y
  descarga el currículo en segundo plano. Las pestañas que lo necesitan muestran «Cargando las prácticas…» y, sin
  conexión, «Reintentar». `npm run perf` mide aparte «panel docente: con las fichas completas» (docs/v2/RENDIMIENTO.md).

## [2.21.0] · 2026-11-03

Lote 3D-4: vista 3D en circuitos simples, circuitos, conductores, inducción, gases, cinética, equilibrio y pH; el kit 3D pinta las aristas de las cajas siempre opacas.

### Añadido
- **Lote 3D-4 «electricidad, campos y partículas»** (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas
  `src/three`: tarjeta «Vista 3D» que se abre a pedido (carga diferida; three.js sigue fuera de las rutas), respaldo SVG
  sin WebGL, teclado, tacto, descripción textual viva y estatus «Modelo calculado» en `circuitos-simples` (la mesa de
  bornes con electrones cuya rapidez sigue la corriente de cada tramo y bombillos que brillan según su potencia),
  `circuitos` (paisaje de potencial: la altura de cada cable es su voltaje), `conductores` (electrones libres, ligados o
  iones según la clasificación del modelo), `induccion` (ley de Faraday: líneas de campo que cruzan la bobina en número
  proporcional al flujo y corriente inducida sincronizada con la fem), `gases` (caja de partículas con émbolo; rapidez ∝
  √T), `cinetica` (reactivo, barrera Eₐ, catalizador y gas producido mL a mL), `equilibrio` (Fe³⁺/SCN⁻/FeSCN²⁺ y
  NO₂/N₂O₄ en las proporciones del equilibrio, con Le Châtelier) y `ph` (H₃O⁺ y OH⁻ en escala logarítmica explicada).
  Los electrones de circuitos y conductores se mueven solo con «Mover los electrones», se pausan y quedan quietos con
  movimiento reducido. Pruebas: `tests/unit/lote3d4.test.ts` y `tests/e2e/visor3d-lote4.spec.ts`.

### Corregido
- Kit 3D: las aristas de una caja translúcida (`edges: true`) se dibujan opacas desde el primer cuadro; antes cambiaban
  de opacidad en el segundo dibujo y «Restablecer vista» no devolvía la misma imagen que la inicial.
- Pruebas: la E2E del lote 3D-2 espera 800 ms tras cambiar de tema antes de axe (falsos contrastes durante la
  transición) y la prueba de prácticas enlazadas del bloque B tiene 20 s (importación diferida lenta con la suite completa).

## [2.20.0] · 2026-11-03

Lote 3D-3: vista 3D en proyectiles, Newton, choques, energía, trabajo, máquinas y energía cinética y potencial.

## [2.19.0] · 2026-11-02

Prácticas nuevas, ola 1b (74 prácticas): configuración electrónica, pila electroquímica, meiosis, sistema nervioso y
sistema circulatorio, todas con visor 3D. Kit 3D: en pantallas angostas con muchos rótulos, la escena muestra solo el del
elemento elegido.

### Añadido
- **Lote 3D-3 «mecánica»** (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas `src/three`: tarjeta «Vista 3D»
  que se abre a pedido (carga diferida; three.js sigue fuera de las rutas), respaldo SVG sin WebGL, teclado, tacto,
  descripción textual viva y estatus «Modelo calculado» en `proyectiles` (trayectoria, sombra y vectores v, vx y vy del
  mismo instante), `newton` (diagrama de cuerpo libre 3D y aceleración), `choques` (cantidad de movimiento de cada
  deslizador y total sobre el centro de masa, antes y después), `energia` (montaña rusa con barras de Ep, Ec y disipada),
  `trabajo` (rampa con fuerzas, desplazamiento y el área F·d frente a m·g·h), `maquinas` (palanca con brazos y fuerzas;
  poleas con la cuerda jalada y la subida de la carga) y `cinetica-potencial` (riel, torre de caída y resorte con las
  barras de energía). El kit admite cajas giradas (`rotationZ`). Pruebas: `tests/unit/lote3d3.test.ts` y
  `tests/e2e/visor3d-lote3.spec.ts`.
- **Ola 1b de prácticas nuevas** (las prioridad 1 que faltaban del análisis curricular; 74 prácticas en total), con el
  mismo estándar de la ola 1a: modelo probado en `src/models`, valores dorados, conjuntos de datos con relaciones,
  5 preguntas tipo Saber originales por práctica y 1 de transferencia en el banco, ideas erróneas con retroalimentación,
  avisos con «Cómo corregirlo», procedencia de los datos, guía en PDF y vista 3D (kit `src/three`):
  - `configuracion-electronica` (10.º): diagrama de cajas de Z = 1 a 54 con Aufbau (Madelung), Pauli y Hund verificados,
    llenado paso a paso (SimControls), comparación con los estados fundamentales medidos de PubChem (8 excepciones hasta
    el xenón) y período, grupo y valencia deducidos (coinciden con la IUPAC en los 54). 3D: nubes |ψ|² hidrogenoides de
    los orbitales s, p y d ocupados (ilustración cualitativa calculada).
  - `pila-electroquimica` (11.º): seis semiceldas con E° del CRC Handbook (Vanýsek), voltímetro (Daniell 1,104 V),
    Nernst a 25 °C, puente salino (aviso de precipitado con KCl y Ag⁺/Pb²⁺), descarga con corriente constante y balanza
    (Faraday: 50 mA × 120 min → −0,1220 g de Zn, +0,1186 g de Cu). 3D: electrones por el cable, iones por el puente,
    electrodos cuyo grosor sigue la masa.
  - `meiosis` (8.º): diez etapas con cromosomas, cromátidas y ADN frente a la mitosis, orientación y entrecruzamiento
    elegibles, no disyunción, muestreo de gametos (r = d/100) y 2ⁿ (2²³ = 8 388 608). 3D: homólogos, quiasma y gametos.
  - `sistema-nervioso` (8.º): regla que cae con datos propios (t = √(2d/g), aviso de anticipación), potencial de acción
    de umbral (todo o nada), fibras Aα/Aδ/C y arco reflejo. 3D: impulso saltatorio y arco reflejo.
  - `sistema-circulatorio` (7.º): ciclo cardíaco y válvulas, gasto cardíaco (5,04 L/min), ejercicio con Tanaka y
    Karvonen (modelo educativo prudente, sin consejo médico), pulso propio opcional. 3D: corazón con circulación doble.
- 5 preguntas de transferencia en el banco y 5 casos dorados; pruebas unitarias (modelos y escenas 3D) y E2E (flujo,
  valor de referencia en la interfaz, 3D con y sin WebGL, axe en claro y oscuro, 390 px).

### Cambiado
- Contadores del catálogo (74 prácticas; 25 de química) y referencias de la regresión visual que muestran conteos.
- La prueba «las prácticas enlazadas existen» del banco avanzado tiene un límite de 20 s (importa el currículo completo).

## [2.18.0] · 2026-11-02

Lote 3D-2: vista 3D en ósmosis, mitosis, ADN, extracción de ADN, Mendel, fotosíntesis y respiración.

### Añadido
- **Lote 3D-2 «biología invisible»** (docs/v2/ANALISIS-CURRICULAR.md, §6.3) con el kit de escenas `src/three`: tarjeta
  «Vista 3D» que se abre a pedido (carga diferida; three.js sigue fuera de las rutas), respaldo SVG sin WebGL, teclado,
  tacto, descripción textual viva y estatus epistémico en `osmosis` (célula cuyo volumen y flujo de agua por las
  acuaporinas siguen el modelo), `mitosis` (16 cromosomas, huso y placa celular en la etapa elegida), `adn` (doble hélice
  de ADN-B con 10,5 pb por vuelta y 3,4 Å por paso con la secuencia del estudiante y sus puentes de hidrógeno),
  `extraccion-adn` (tubo con las capas y el ADN precipitado según el paso, y la doble hebra que arma el estudiante),
  `mendel` (homólogos con los loci y los gametos del cuadro de Punnett), `fotosintesis` (cloroplasto con flechas de luz,
  CO₂ y O₂ del modelo y burbujas al ritmo del banco) y `respiracion` (mitocondria con crestas elegibles, balance de ATP
  por etapa y gases sincronizados con el respirómetro). Pruebas: `tests/unit/lote3d2.test.ts` y
  `tests/e2e/visor3d-lote2.spec.ts`.

## [2.17.0] · 2026-11-02

Prácticas nuevas, ola 1a (69 prácticas): modelos atómicos, tabla periódica, enlace químico y electrostática, todas con visor 3D.

### Añadido
- **Ola 1a de prácticas nuevas** del análisis curricular (69 prácticas en total), cada una con su modelo probado, valores
  dorados, conjuntos de datos con relaciones, evaluación tipo Saber original, ideas erróneas con retroalimentación,
  procedencia de los datos, guía en PDF y vista 3D (kit `src/three` o kit de química):
  - `modelos-atomicos` (7.º): experimento de la lámina de oro con detector de centelleo (conteo de Poisson, barra de
    simulación), predicciones de Thomson y de Rutherford en una gráfica logarítmica con los datos de Geiger y Marsden
    (1913), aviso de la fuerza nuclear con su corrección y átomo de Bohr con las líneas de Balmer del NIST. 3D: montaje
    con las alfas desviadas en el espacio, trayectorias hiperbólicas exactas cerca del núcleo y los cuatro modelos.
  - `tabla-periodica` (8.º): tabla de 118 elementos navegable con el teclado y datos reales de PubChem (consulta del
    2026-11-01, `scripts/validacion/tabla_periodica_pubchem.mjs`) y de Pyykkö; carga nuclear efectiva de Slater;
    tendencias con sus excepciones (Mg → Al, P → S). 3D: relieve periódico con esferas a escala del radio covalente.
  - `enlace-quimico` (9.º): ΔEN y carácter iónico, estructuras de Lewis verificadas, polaridad por suma de dipolos sobre
    la geometría de PubChem, y pruebas de fusión, solubilidad y conductividad de cinco sustancias con datos de PubChem.
    3D: cargas parciales y dipolos (three.js), visor molecular, redes del NaCl y del cuarzo, sacarosa y cobre.
  - `electrostatica` (11.º): ley de Coulomb con dinamómetro (modo «Instrumento real»), aviso de fuera de escala con su
    corrección, campo y potencial de 1 a 3 cargas con líneas y equipotenciales. 3D: líneas de campo en el espacio,
    superficie equipotencial y fuerza sobre la carga de prueba.
- 4 preguntas de transferencia en el banco tipo Saber 11 y 4 casos dorados; pruebas unitarias (modelos y escenas 3D) y
  E2E (flujo, valor de referencia en la interfaz, 3D con y sin WebGL, axe en claro y oscuro, 390 px).

### Cambiado
- Contadores del catálogo (69 prácticas; 23 de química) y referencias de la regresión visual que muestran conteos.

## [2.16.0] · 2026-11-02

Programa curricular y 3D (pedido del docente): análisis de la malla, kit de escenas 3D y primer lote de visores 3D.

### Añadido
- Análisis curricular de las 65 prácticas frente a la estructura de los Estándares del MEN (entornos) y la malla
  institucional de `grades.ts`, con brechas por área y grado, 26 prácticas nuevas propuestas (8 de química, 8 de física,
  8 de biología y 2 de ambiente), 14 mejoras y el plan de visor 3D en 7 lotes para las 54 prácticas sin 3D
  (`docs/v2/ANALISIS-CURRICULAR.md` y `docs/v2/plan-curricular.json`). Los DBA no se pudieron leer en el documento
  oficial: todos los anclajes quedan como formulación propia por verificar.
- Kit de escenas 3D para física, biología y ambiente (`src/three/`, `docs/v2/KIT-3D.md`) con three.js r186
  (`three@0.186.1`, MIT) cargado aparte solo cuando una escena se abre con WebGL (135 KB gzip; la entrada no cambia).
  `<Scene3D>` dibuja primitivas (flechas, resortes, esferas, elipsoides, cajas, varillas, planos y partículas) con los
  colores del tema, gira con ratón, toque, teclado (flechas, + y −, Inicio) y botones («Restablecer vista»), dibuja solo
  cuando algo cambia, respeta el movimiento reducido, libera la GPU al salir y, sin WebGL, muestra la misma escena en
  una vista de respaldo en 2D (SVG) con las mismas posiciones, vectores, rótulos y selección.
- Pilotos: en el **péndulo**, vista 3D del movimiento con los vectores de velocidad, tensión y peso calculados con la
  misma corrida del laboratorio (se congela con «Pausar»); en el **microscopio**, modelo 3D de una célula de la muestra
  con sus estructuras elegibles, su función y si se ven con la preparación actual. Pruebas unitarias y de extremo a
  extremo con y sin WebGL; `npm run perf` vigila que three.js no entre en ninguna ruta.
- **Lote 3D-1** del plan de visor 3D: tarjeta «Vista 3D» (se descarga solo al abrirla) en `balanceo` (copias 3D por
  coeficiente con el conteo de átomos de la escena y la reacción animada cuando está balanceada), `conservacion`
  (recipiente abierto o cerrado con las partículas, el gas que sale o entra y la masa de adentro), `estequiometria`
  (paquetes antes y después: limitante, exceso y lo que no llegó a producto por el rendimiento), `mol` (la entidad que
  se cuenta y la ecuación en moles), `soluciones` (capa de hidratación y partículas en un cubo de 5 nm con la
  concentración del laboratorio), `enzimas` (lisozima 2LZM con el sitio activo Glu11/Asp20 y la fracción nativa del
  modelo), `expresion` (hemoglobina 2HHB con el codón marcado en las cadenas β) y `rastreo` (2HHB, 3I40 o el modelo de
  AlphaFold de OCA2 con la variante marcada). Solo con el kit químico y las estructuras ya incluidas; sin WebGL, respaldo
  SVG con las mismas posiciones. Nuevo en el kit: `SpeciesScene3D` y `sceneLayout`. Desviaciones del plan en
  `docs/v2/ANALISIS-CURRICULAR.md` (§6.3). Pruebas: `tests/unit/lote3d.test.ts` y `tests/e2e/visor3d-lote1.spec.ts`.

### Cambiado
- `massConservation.ts` expone `reactantAmounts` y `enzyme.ts` expone `nativeFraction` (los mismos cálculos de antes,
  ahora reutilizados por las vistas 3D; sin cambios en los resultados).

## [2.15.0] · 2026-11-01

Mejoras: rendimiento en equipos modestos (medido con Lighthouse) y pruebas de regresión visual.

### Mejorado
- Rendimiento en equipos modestos, medido con Lighthouse (móvil, CPU 4×, «Slow 4G»; detalle en
  `docs/v2/RENDIMIENTO.md`): el banco Saber 11 ya no descarga el currículo completo (JS inicial de 917 a 180 KB, LCP de
  9,8 a 3,2 s); el banco avanzado se pinta antes de recibir los 180 ítems, que llegan en seis archivos por bloque, y no
  trae el banco tipo Saber ni los datos de las prácticas (LCP de 4,6 a 3,6 s); el pie de página ya no salta al cargar
  (CLS de 0,21–0,50 a 0–0,06); el service worker se registra cuando la página está desocupada y precarga primero el
  núcleo (5,4 MB en vez de 9,6 MB) y después, en segundo plano, los archivos grandes de visores 3D, proteínas, taller de
  compuestos y química orgánica (no lo hace si el navegador pide ahorro de datos).
- Presupuesto de rendimiento en CI: `npm run perf` falla si la entrada o el JS inicial de una ruta superan los límites
  escritos (solo tamaños de la compilación, sin tiempos).
### Añadido
- Pruebas de regresión visual (`npm run test:visual`, configuración aparte en `playwright.visual.config.ts`): 36 capturas
  de nueve pantallas (inicio, catálogo, banco Saber 11, banco avanzado con gráfica y con retroalimentación, densidad,
  geometría molecular con el visor 3D enmascarado, panel docente → Moodle y Classroom, ayuda) en escritorio y celular,
  tema claro y oscuro. Hora fija, azar con semilla, sin animaciones y tolerancia de 250 píxeles por captura. Se corren
  antes de cada versión, no en la integración continua (las capturas dependen de las fuentes del sistema); ver
  `docs/v2/REGRESION-VISUAL.md`.

## [2.14.1] · 2026-10-27

### Corregido
- Banco avanzado en el celular (390 px): 19 preguntas con gráfica y la pregunta 64 (dirección web larga en la fuente) se
  salían de la pantalla al abrir la retroalimentación. Las gráficas y sus tablas de datos ya no ensanchan la página y las
  palabras largas se parten. Nueva prueba que recorre las 180 preguntas a 390 px (antes solo se revisaban 10 al azar).
- Solucionario del simulacro en el celular: las tablas de 50 preguntas ensanchaban la página; ahora se desplazan dentro
  de su marco. La prueba nueva también abre el solucionario con las 180 preguntas.

## [2.14.0] · 2026-10-27

Banco avanzado tipo Saber 11.° completo: entrega 6 y 180 ítems validados con las metas globales.

### Añadido
- **Entrega 6 (ítems 151–180, indagación científica, integración y ciencia, tecnología y sociedad):** 10/10/10, niveles
  10/12/8, 23 ítems con datos. Va más allá del control de variables: prueba a ciegas, grupo con producto simulado,
  asignación al azar por bloques, observación e inferencia, significado de «teoría», replicación y revisión por pares,
  resolución e incertidumbre, ejes truncados, correlación y causalidad (inversa, tercera variable, desfase, relación no
  lineal), límites de los modelos, selección interesada de datos y decisiones tecnológicas.
- **Banco completo:** 180 ítems, 60/60/60 por competencia, 60/72/48 por nivel, 134 con datos, claves A 45 · B 44 · C 44 ·
  D 47, sin rachas de más de dos ni ciclos. Documentos 02–06 regenerados.

## [2.13.0] · 2026-10-27

Banco avanzado tipo Saber 11.°: entregas 4 y 5 (150 de 180 ítems).

### Añadido
- **Entrega 4 (ítems 91–120, física y fenómenos mecánicos):** 10/10/10 por competencia, niveles 10/12/8, 22 ítems con
  gráficas de posición y velocidad, diagramas de cuerpo libre descritos, tablas y experimentos (movimiento, leyes de
  Newton, energía con rozamiento, impulso, presión, Arquímedes, sonido, espejos, ley de Snell y lentes).
- **Entrega 5 (ítems 121–150, electricidad, magnetismo, ondas y energía):** 10/10/10, niveles 10/12/8, 22 ítems con
  datos (inducción electrostática, circuitos en serie y en paralelo, consumo en kWh con tarifas ficticias, inducción
  electromagnética, ondas, calor y eficiencia de centrales).

### Cambiado
- Ítem 17: enunciado propio (antes era igual al del ítem 7); el validador ya no da avisos.

## [2.12.0] · 2026-10-27

Banco avanzado tipo Saber 11.°: entregas 2 y 3 (90 de 180 ítems).

### Añadido
- **Entrega 2 (ítems 31–60, ecología, ambiente y sostenibilidad):** 10/10/10 por competencia, niveles 10/12/8, 23 ítems
  con tablas, gráficas, esquemas, experimentos o modelos (páramo, manglar, ciénagas, minería, pesca, cambio climático,
  calidad del aire). Revisión en `docs/banco-saber11/entregas/ENTREGA-2-REVISION.md`.
- **Entrega 3 (ítems 61–90, química y transformaciones de la materia):** 10/10/10 por competencia, niveles 10/12/8, 23
  ítems con datos; todos los cálculos verificados con un guion (estequiometría, gases, diluciones, titulación,
  solubilidad). Revisión en `docs/banco-saber11/entregas/ENTREGA-3-REVISION.md`.

### Cambiado
- Gráficas del banco: marcas enteras en ejes de datos enteros (meses), rótulos de barras en dos líneas y más margen
  inferior para que no se encimen en el celular.

## [2.11.0] · 2026-10-27

Banco avanzado tipo Saber 11.° de Ciencias Naturales (pedido del docente): infraestructura completa y entrega 1 de 6.
Material original de práctica: no es oficial del ICFES ni está avalado por el ICFES o el MEN; revisado con criterios
técnicos y no validado psicométricamente.

### Añadido
- **Banco avanzado** (`#/banco/avanzado`, desde «Banco Saber 11»): práctica guiada con retroalimentación comentada
  (por qué cada distractor es incorrecto, error que conviene evitar y estrategia), simulacro sin claves hasta terminar
  (cronómetro opcional rotulado como no oficial; resultados por competencia y bloque, CSV y solucionario) y refuerzo
  personalizado por competencia, bloque y nivel, con sugerencias tras el simulacro. Gráficas SVG accesibles con su
  descripción textual y sus datos en tabla.
- **Entrega 1 (ítems 1–30, biología):** 10 de uso comprensivo, 10 de explicación y 10 de indagación; niveles 10/12/8;
  21 con tablas, gráficas, esquemas, experimentos o modelos; claves 7/7/8/8 sin rachas de más de 2 ni ciclos. Revisión
  de 15 criterios ítem por ítem en `docs/banco-saber11/entregas/ENTREGA-1-REVISION.md`.
- **Fundamentación y documentos del banco** (`docs/banco-saber11/`): Parte I escrita a mano (documentos oficiales y su
  estado de consulta, matriz global, criterios) y Partes II a VI generadas con `npm run banco` desde los mismos datos
  de la aplicación (cuadernillo sin claves, clave, solucionario, instrumentos docentes, referencias y datos simulados).
- **Validador del banco** (`src/assessment/avanzado/validate.ts`): estructura de cada ítem, matriz por bloque, claves,
  rachas y ciclos, enunciados y contextos repetidos y rótulo de datos ficticios; la prueba unitaria exige cero errores.
- **Panel docente → Moodle y Classroom:** exportación del banco avanzado a Moodle XML y GIFT y plantilla CSV para
  registrar respuestas por estudiante.

## [2.10.0] · 2026-10-27

Mejoras: exportación para Moodle y Google Classroom y pista de control de variables al guardar ensayos.

### Añadido
- **Exportación para Moodle y Google Classroom** (panel docente → «Moodle y Classroom», todo en el navegador): preguntas
  del banco Saber 11 y de las evaluaciones de las prácticas en **Moodle XML** y **GIFT**, filtradas por origen, grado,
  área y práctica, con la opción correcta marcada, retroalimentación por opción, explicación y enlace a la práctica como
  retroalimentación general, categorías por grado y práctica, y etiquetas. Para Classroom, el enlace oficial
  «Compartir en Classroom» de cada práctica, el texto de la tarea para pegar y un CSV de enlaces por grado. Generadores
  puros en `src/lib/lmsExport.ts` con pruebas (escape XML y GIFT, una correcta por pregunta, XML bien formado),
  prueba E2E `tests/e2e/exportar-lms.spec.ts` y guía [docs/EXPORTAR-LMS.md](docs/EXPORTAR-LMS.md). Sin SCORM ni IMS
  Common Cartridge.
- **Pista de control de variables al guardar un ensayo** (todas las prácticas): si respecto al ensayo anterior
  cambiaron dos o más variables de entrada a la vez, una nota debajo de «Guardar ensayo en la tabla» dice cuáles
  cambiaron, por qué así no se sabe cuál causó el efecto y qué hacer («vuelve la arista a 3,0 cm y guarda otro
  ensayo»). No bloquea el registro, se cierra con «Entendido» y no se repite para la misma combinación. Los diseños
  que cambian varias entradas a propósito (talleres, ejercicios, reto de indagación, metabolismo, secuencias…) y las
  entradas que dependen de otra se declaran en las tablas de datos (`multiInput`, `notIndependent`);
  `src/lib/controlVariables.ts` con pruebas unitarias y `tests/e2e/control-variables.spec.ts`.

## [2.9.0] · 2026-10-26

Rediseño, paso siguiente (ADR 0007): cada aviso de condición dice su causa y cómo corregirla, y las lecturas directas
de instrumentos muestran su resolución. Los textos de las advertencias de los modelos, las rutas, los datos guardados y
los valores dorados no cambian.

### Añadido
- **«Cómo corregirlo» propio en cada advertencia de 19 prácticas** (circuitos, circuitos simples, gases, enzimas,
  densidad, calidad del agua, cinemática, movimiento, cinética química, conservación de la masa, equilibrio químico,
  ecosistema, soluciones, fotosíntesis, interferencia, extracción de ADN, metabolismo, secuencias y reto de
  indagación): qué control cambiar y en qué sentido («Sube el «Volumen de la jeringa» a 40 mL o más», «Baja la
  «Distancia de la lámpara» a 19 cm o menos»), calculado con el mismo umbral del modelo que produjo la advertencia.
  Cada aviso tiene su nivel: **Condición no válida** (la medición no vale así), **Atención** (vale, pero conviene
  revisarla) o **Nota** (para interpretar el resultado).
- `src/models/conditions.ts` (`classifyWarnings`, `sortConditions`) y una función `…Conditions` por modelo, pura y
  probada; `Warnings` acepta textos (como antes) o condiciones `{ text, level, fix }`.
- **Resolución del instrumento** en las lecturas directas de 17 prácticas más, tomada de la ficha de incertidumbre
  (`src/labs/instruments.ts`) o de la constante del modelo: gases, densidad, circuitos, circuitos simples, calidad del
  agua, equilibrio químico, soluciones, extracción de ADN, ecosistema, movimiento, interferencia, máquinas simples,
  presión, flotación, conductores, mol y óptica (en modo real). **Estado** («en rango» o «fuera de rango») solo donde
  el modelo define el intervalo: presión de la jeringa (300 kPa), capacidad de la balanza y de la probeta, corriente
  del fusible (3 A), OD y pH frente al Decreto 1076 de 2015, absorbancia de los colorímetros, presión de la jeringa de
  NO₂ (2,5 bar), validez de la regla de Wallace y OD mínimo para los peces.
- Pruebas: `tests/unit/conditions.test.ts` (34 casos: cada advertencia tiene nivel y corrección, y la corrección
  propuesta, aplicada al modelo, hace desaparecer la advertencia; render de `Warnings`) y `tests/e2e/avisos.spec.ts`
  (gases, enzimas, densidad y circuitos en claro y oscuro: aviso con su corrección, una sola región de estado, axe
  WCAG 2.2 AA y sin desbordamiento a 390 px).

### Cambiado
- Con condiciones, `Warnings` muestra un aviso por causa (ordenados: no válida, atención, nota) en lugar de una lista
  con un aviso común. Los avisos de fotosíntesis, interferencia, metabolismo, secuencias y reto de indagación se arman
  ahora en el modelo, con los mismos textos.
- Densidad: el volumen final dice «se desborda» en lugar de «—» cuando el agua no cabe en la probeta. Equilibrio
  químico y soluciones: la absorbancia fuera del intervalo se lee «> 3» o «> 2,00» con el estado «fuera de rango»; la
  Tm de Wallace fuera de su intervalo, igual.
- `NO2_MAX_PRESSURE` (equilibrio) y `COLORIMETER_RES` (soluciones) nombran umbrales que antes estaban escritos como
  números sueltos; los valores no cambian.

### Accesibilidad
- Todos los avisos de una práctica van en **una sola región `role="status"`** (`ConditionAlert` con `live={false}`
  dentro de `Warnings`): el lector de pantalla no anuncia varias regiones a la vez. El nivel se dice en texto, no solo
  con color.

## [2.8.0] · 2026-10-26

Nota de integridad: los parámetros de red de Li₂O, Na₂O, K₂O, BaO y ZnS se muestran «por verificar» contra Wyckoff (1963), porque la obra no se pudo consultar al incorporarlos.

Taller de compuestos, siguiente paso (hoja de ruta): más redes cristalinas con estructura publicada, sales de amonio,
binarios entre no metales y revisión de los registros de PubChem hallados solo por la fórmula. Versión **MENOR**
(funciones nuevas; los identificadores, rutas y datos guardados no cambian).

### Añadido
- **Redes cristalinas de 8 sólidos más** (`src/chem/crystal.ts`): Li₂O, Na₂O y K₂O (antifluorita), BaO (halita),
  ZnS (blenda), TiO₂ (rutilo), α-Al₂O₃ (corindón) y el cuarzo α (SiO₂, **red covalente**, dibujada con todos sus
  enlaces y el estilo común de palitos, `applyMolStyle`). El generador es general: aplica las operaciones de simetría
  del grupo espacial (escritas como en los CIF) a la unidad asimétrica, en celdas cúbicas, tetragonales y hexagonales.
  Fuentes: Wyckoff (1963) para las cúbicas; CRC Handbook 60.ª ed. (a y c del rutilo, texto citado en PubChem) y
  Abrahams y Bernstein (1971) para x(O); CIF de la AMCSD 0009325 (Lewis, Schwarzenbach y Flack, 1982) para el corindón;
  Levien, Prewitt y Weidner (1980) para el cuarzo.
- **Densidades publicadas con su fuente original** (`scripts/validacion/cristales_pubchem.mjs` →
  `src/data/quimica/cristales-pubchem.json`): CRC Handbook (vía la HSDB), base PAC del DOE, fichas ICSC o IARC, todas
  leídas de PubChem con una regla de elección declarada. Confirma también las 6 densidades que ya tenía el kit.
- **Visor de redes** (`Crystal3D`): grupo espacial, parámetros a y c, todas las distancias del poliedro de coordinación
  con su multiplicidad (Ti–O 1,950 Å ×4 y 1,980 Å ×2; Al–O 1,855 Å ×3 y 1,972 Å ×3), ángulo Si–O–Si, nota cuando la
  densidad medida difiere más de 3 % y panel «Fuentes de la estructura y de la densidad». Las celdas no cúbicas se
  muestran con el eje c vertical.
- **Taller: ruta «NH₃ + ácido → sal de amonio»** (cloruro, fluoruro, bromuro, yoduro, sulfuro, nitrato, nitrito,
  sulfato, hidrogenosulfato, carbonato, hidrogenocarbonato, fosfatos DAP y MAP, perclorato, dicromato…) con su vía de
  obtención y notas de seguridad; el ion **NH₄⁺ se dibuja con sus cuatro enlaces N–H** junto al oxoanión.
- **Taller: ruta «No metal + no metal → compuesto molecular»** (BF₃, BCl₃, BBr₃, CF₄, CCl₄, CBr₄, CS₂, SiF₄, SiCl₄,
  NF₃, NCl₃, PF₃, PF₅, PCl₃, PCl₅, PBr₃, PBr₅, SF₄, SF₆) con orden de electronegatividad explicado, vía de obtención
  y molécula VSEPR; los óxidos de los no metales (CO, CO₂, NO, N₂O, SO₂…) siguen en «No metal + O₂», ahora con la vía
  real del N₂O (NH₄NO₃), del NO₂, del N₂O₃ y del N₂O₅.
- 3 retos nuevos (humo blanco de NH₄Cl, nitrato de amonio, PCl₃) y 22 casos de nomenclatura de referencia nuevos
  (316 en total), validados con los sinónimos de PubChem (`nomenclatura_pubchem.mjs`, 2026-10-26: 312 de 316 con CID de
  la misma fórmula y en todos algún nombre del motor entre los sinónimos).
- **Revisión de los registros de PubChem hallados solo por la fórmula** con una regla documentada y probada
  (`src/models/pubchemNameMatch.ts`): se comparan el título, el nombre IUPAC y los sinónimos de los 10 CID de menor
  número con los nombres del motor en forma canónica; los registros que describen otra clase de sustancia (hidróxido,
  peróxido, hidrato, hidruro) se descartan.
- Pruebas: `tests/unit/crystals.test.ts`, `tests/unit/pubchemNameMatch.test.ts`, bloques nuevos en
  `compoundForge.test.ts` y 8 pruebas E2E nuevas (amonio, PCl₃, corindón y cuarzo, claro y oscuro, axe y 390 px).

### Cambiado
- Registro del taller regenerado con el script existente (`scripts/validacion/compuestos_pubchem.mjs`, 2026-10-26):
  3397 compuestos (68 nuevos): **1995 registrados** (1449 hallados por su nombre y 546 por la fórmula con un sinónimo
  que coincide), **587 fórmulas registradas sin coincidencia de nombre** y 815 fórmulas formales. De los 1129 que en la
  v2.5.0 se habían hallado solo por la fórmula, 545 pasan a «registrado», 5 quedan como fórmula formal (todos sus CID
  describían otra sustancia) y 579 siguen sin coincidencia de nombre; 9 compuestos tienen registros descartados.
- La práctica de óxidos e hidróxidos ofrece 9 redes (antes 2) y la de ácidos y sales suma la blenda (ZnS).
- El SiO₂ ya no queda «sin geometría» en el taller: se dibuja la red covalente del cuarzo.

### Corregido
- Neutralidad de cargas de las sales de amonio con N en el anión (NH₄NO₃, NH₄NO₂): el conteo de oxoaniones se hace
  por el oxígeno (antes contaba 2 aniones y 0 cationes).
- La práctica de nomenclatura inorgánica solo encontraba la red de los compuestos 1:1 y 1:2 (calculaba la fórmula de la
  red con una regla fija); ahora usa la composición de cada cristal.

### No incluido (declarado)
- CaSO₄ (anhidrita): su estructura necesita las coordenadas de un refinamiento que no se pudo consultar (AMCSD, COD e
  ICSD no accesibles desde el entorno); no se construye de memoria. SrO: PubChem no trae una densidad publicada.
  Sales de amonio como red: el NH₄⁺ gira o se desordena en el cristal.

## [2.7.0] · 2026-10-26

Rediseño, siguiente paso (ADR 0007): la barra común de simulación llega a todas las prácticas con dinámica temporal.
Sin cambios en rutas, datos guardados ni modelos científicos (los valores dorados no cambian).

### Añadido
- **`SimControls` en 21 prácticas más** (23 en total con ósmosis y ondas): proyectiles, péndulo, choques, energía
  mecánica (pista y caída), cinemática, movimiento, leyes de Newton, cinética y potencial (tres estaciones),
  conducción, calor, ecosistema, redes tróficas, respiración, reto de indagación, expresión génica, conservación de la
  masa, cinética química, trabajo y potencia, inducción (Faraday), leyes de los gases y fotosíntesis. Todas tienen
  **pausa real**: Iniciar → Pausar → Reanudar, Reiniciar y Repetir, con el estado anunciado (`role="status"`) y,
  cuando el total no es la respuesta, la barra de avance («Tiempo simulado = 12,0 de 30,0 min»).
- `simStatusOf`, `simPrimaryAction`, `simStatusText` y `resolutionText` (`src/components/Experiment.tsx`), y las
  opciones `repeatLabel` y `resetDisabled` de `SimControls`.
- `Readout.resolution` en proyectiles, péndulo, choques, cinemática, conservación de la masa y cinética química;
  `ConditionAlert` con «cómo corregirlo» cuando los deslizadores de los choques no se alcanzan.
- Pruebas: `tests/unit/simControls.test.ts` (estados, acciones, marcado accesible, avance, adopción) y
  `tests/e2e/simulacion.spec.ts` (iniciar → pausar → reanudar → reiniciar con axe en 6 prácticas, teclado, resultado
  igual tras pausar, animaciones continuas y movimiento reducido).

### Cambiado
- Los botones de inicio conservan su nombre («Disparar», «Soltar el péndulo», «Lanzar»…) y al terminar ofrecen
  repetir («Disparar de nuevo», «Lanzar de nuevo»…). Los pasos de preparación (pesar el sistema, subir con el torno)
  quedan como botón aparte antes de la barra.
- Al cambiar la velocidad de la animación a mitad de una corrida (péndulo, cinemática, caída), el reloj sigue desde el
  tiempo ya recorrido en lugar de reiniciarse.

### Accesibilidad
- Las animaciones continuas de gases y fotosíntesis ya se pueden pausar (WCAG 2.2.2) y, con movimiento reducido,
  arrancan detenidas; el estudiante puede iniciarlas a voluntad.
- El botón principal es el mismo elemento en todos los estados: el foco no se pierde al pasar de «Iniciar» a «Pausar».

## [2.6.0] · 2026-10-26

Versión **MENOR**: rediseño integral de la interfaz sin cambiar rutas, identificadores de práctica,
formato de los datos guardados, contrato del servidor ni modelos científicos (los valores dorados no cambian).

### Añadido
- **Sistema de diseño formal** (`src/tokens.css`, `docs/v2/SISTEMA-DE-DISENO.md`, ADR 0007): primario institucional
  azul petróleo, secundario pizarra, semánticos (éxito, advertencia, error, información), foco propio, escala de datos
  de 8 series distinguible con protanopía, deuteranopía y tritanopía (ΔE2000 mínimo 6,2 en claro y 6,9 en oscuro;
  antes 0,9 y 2,7), tipografía modular, espaciado, radios, elevación, movimiento y capas; verificador
  `scripts/diseno/verificar_paleta.py`.
- **Inicio orientado a tareas** por perfil (estudiante, docente, investigador o curioso) con «Continuar mi práctica».
- **Catálogo** con filtros en la dirección, filtro por avance, orden, chips de filtros activos y estado vacío con salida.
- **Espacio de trabajo de la práctica**: encabezado compacto con migas de grado y área, franja única de ajustes del
  banco, práctica anterior y siguiente del grado, etapa activa siempre visible en teléfonos.
- **Atajos de teclado** (`?`, `/`, `1`–`5`, `C`, `F`, `I`, `N`, `P`) con lista accesible y opción para desactivarlos.
- **Componentes experimentales compartidos**: `SimControls` (ósmosis y ondas), `ConditionAlert` (todas las
  advertencias del modelo y el control de variables), `Readout` con resolución y estado, explicación de la relación
  entre variables con gráfica en el análisis, **comparación de ensayos** y **Descargar JSON** (`lvcn-datos-v1`) en el
  cuaderno.
- Marcadores con forma distinta por serie en todas las gráficas.
- Panel docente con pestaña «Inicio» de tareas y enlaces directos `#/docente?seccion=…`; banco Saber en tandas de 10.
- Miniaturas propias para las 28 prácticas que usaban la ilustración genérica de su área.
- Estados de carga con esqueleto y mensajes de error que explican qué hacer.
- Pruebas: `tests/unit/plataforma.test.ts` (tokens, preguntas de transferencia, filtros, comparación, JSON, atajos) y
  `tests/e2e/plataforma.spec.ts` (inicio, catálogo, atajos, paginador, cuaderno, simulación, análisis con axe).

### Cambiado
- Abrir una práctica ya no descarga las 65 fichas: las preguntas de transferencia se resuelven desde el banco.
- JavaScript inicial de 407,86 kB a 391,3 kB (126,50 → 123,5 kB comprimido): catálogo, grado, escena del héroe y
  definiciones del kit bajo demanda. El CSS crece de 115,1 a 130,6 kB (22,4 → 25,4 kB comprimido).
- Colores de interfaz y de series en ambos temas (nuevos tokens); las escenas de los laboratorios no cambian de forma.
- `styles.css` y `theme-2026.css` ya no declaran valores: los consumen de `tokens.css`.

### Corregido
- La fila recién guardada del cuaderno parpadeaba en amarillo o rojo intenso (interpolación de colores).
- `@keyframes pulse` estaba definida dos veces y anulaba el pulso del héroe.
- «en función de el volumen» → «en función del volumen» en el análisis.

## [2.5.0] · 2026-10-26

Versión MENOR: corrección de los visores 3D y ampliación del taller, sin cambiar rutas, identificadores ni el formato
de los datos guardados.

### Corregido
- **Palitos (enlaces) que no se veían en los visores 3D** (pedido del docente). Causa raíz: los visores 3Dmol
  (Molecule3D, visores orgánicos y de grupos funcionales y la práctica de geometría molecular) dejaban la esfera por
  defecto de la biblioteca en «esferas y palitos», 0,28 × radio de van der Waals de Bondi. Esos radios son 2,4–3,8 veces
  los covalentes (H: 1,20 frente a 0,32 Å): en los enlaces con hidrógeno las dos esferas tapaban el 70–90 % del enlace
  (N–H, O–H, H–H) y, al girar la molécula, el palito desaparecía (NH₃, H₂O₂, OH⁻, H₂O, H₂SO₄, ácidos, orgánicas…). Los
  datos no tenían errores: se comprobó la conectividad de las 2940 especies que se pueden dibujar (biblioteca, prácticas
  orgánicas y funcionales, VSEPR, iones, ensamblados iónicos y las 3D del taller) y el SDF V2000 que lee 3Dmol.
  Corrección: un solo modelo de «esferas y palitos» para todos los visores (`ballRadius` en `src/chem/elements.ts` y
  `applyMolStyle` en `src/chem/molStyle.ts`): esfera = máx(0,20 Å; 0,42 × radio covalente de Pyykkö), la misma escala en
  3Dmol, en la reacción 3D y en la vista SVG de respaldo; queda a la vista al menos el 38 % de cada palito (antes, 9 %
  en H₂). Dobles y triples algo más gruesos.
- Leyenda en la reacción 3D y en el taller: en los sólidos iónicos no hay palitos entre iones (es correcto) y sí dentro
  de los iones poliatómicos (OH⁻, SO₄²⁻, NO₃⁻, CO₃²⁻…).

### Añadido
- **Taller de formación de compuestos con 77 elementos** (antes 31; pedido del docente): Rb, Cs, Be, Sr; Sc, Y, La y los
  lantánidos (salvo Pm); Ti, Zr, Hf, V, Nb, Ta, Mo, W, Re, Ru, Os, Rh, Ir, Pd, Pt, Cd; Ga, In, Tl, Ge, Sb, Bi, Po; As, Se y
  Te. Estados habituales y raros (con ejemplo) según Greenwood y Earnshaw (1997) y la IUPAC; nombres tradicionales solo
  donde son de uso habitual (titanoso/titánico, ceroso/cérico, talioso/tálico, platinoso/platínico, germanoso/germánico,
  antimonioso; los demás se nombran con Stock y la ficha lo dice); Stock con romanos en Os, Rh, Pd, Nb, Ta y Bi; «r» doble
  tras prefijo (dirrubidio, dirrenio). Oxácidos nuevos: arsenioso, arsénico, antimónico, selenioso, selénico, teluroso,
  telúrico, vanádico (orto y meta), molíbdico, wolfrámico y perrénico; hidrácidos H₂Se y H₂Te; arsano; peróxidos e
  hidruros de Rb, Cs y Sr. Estados sin hidróxido u oxisal definidos (Ti(IV), V(IV), Ge, Mo, W, Nb, Ta, Ru, Os, Ir, Po…) se
  rechazan con explicación, igual que las sales que no existen (CeCl₄, PbI₄, TlI₃ como Tl⁺I₃⁻…).
- Los 41 elementos que siguen fuera explican por qué al tocarlos: gases nobles, Fr, Ra, Tc, Pm, At, actínidos y
  superpesados (radiactivos, sintéticos o sin química escolar).
- Masas atómicas estándar (CIAAW) de 45 elementos en `balancing.ts` y radios covalentes de Pyykkö (Z = 1–86) en el kit.
- Registro en PubChem del nuevo conjunto (`compuestos_pubchem.mjs`, 2026-10-25): 3756 combinaciones y 3329 compuestos;
  1391 hallados por su nombre, 1129 solo por la fórmula y 809 fórmulas formales.
- Referencia del motor de nomenclatura: 294 compuestos (los 149 anteriores sin cambios + 145 de los elementos nuevos,
  verificados con los sinónimos de PubChem; se descartaron 11 candidatos sin CID de la misma fórmula o sin nombre).
- Pruebas: `tests/unit/chemBonds.test.ts` (conectividad y palitos visibles de todas las especies),
  `tests/e2e/visores-palitos.spec.ts` (píxeles de los palitos en 3Dmol para H₂SO₄, CaSO₄, Ca(OH)₂, NaNO₃, H₂O₂, CO₂,
  HClO₄, NH₃, una orgánica y las reacciones del taller al 0, 30, 70 y 100 %; respaldo SVG) y el E2E del taller ampliado.

## [2.4.0] · 2026-10-25

Versión **MENOR**: se agrega una estación nueva sin cambiar rutas, identificadores ni datos guardados.

### Añadido
- **Taller de formación de compuestos** (pedido del docente), estación nueva en las prácticas `oxidos-hidroxidos`,
  `acidos-sales` y `nomenclatura-inorganica` (cada una abre con su ruta: metal + O₂, ácido + hidróxido y metal + no
  metal; las nueve rutas están disponibles en las tres). El estudiante elige los elementos en una tabla periódica
  completa de 118 elementos (accesible con teclado: foco itinerante con flechas, Inicio y Fin) y su número de oxidación;
  el taller calcula la fórmula por neutralidad de cargas (motor de nomenclatura existente), balancea la ecuación con el
  método algebraico de `balancing.ts`, clasifica la función, da los nombres sistemático, Stock y tradicional, rotula la
  vía de obtención (reacción directa, condiciones especiales o relación formal) y muestra el modelo 2D de cargas, el
  compuesto en 3D (confórmero de PubChem, VSEPR rotulada, red cristalina o «sin geometría fiable») y la reacción en 3D.
- Validación pedagógica de combinaciones imposibles: gases nobles, elementos fuera del taller, estados de oxidación que
  el elemento no presenta (o solo en compuestos raros), metales que no forman oxácidos (salvo Cr y Mn en estados altos),
  óxidos neutros, dos metales (aleación), dos no metales, etc.
- Registro en PubChem de las 1066 sustancias que puede generar el taller (1196 combinaciones):
  `scripts/validacion/compuestos_pubchem.mjs` → `src/data/quimica/compuestos-pubchem.json` (2026-10-25): 583 halladas por su nombre
  con su CID, 337 con un registro de la misma fórmula pero sin coincidencia de nombre (rotuladas aparte: pueden ser otra
  estructura) y 146 fórmulas formales. La interfaz dice «Compuesto registrado en PubChem (CID …)», «Fórmula registrada en
  PubChem (CID …), sin coincidencia de nombre» o «Fórmula formal por neutralidad de cargas…».
- Tablas nuevas del cuaderno en las tres prácticas: «Taller de compuestos» y «Retos del taller» (10 retos opcionales).
- `tests/unit/compoundForge.test.ts`, valor dorado del taller y `tests/e2e/taller-compuestos.spec.ts`.

### Cambiado
- `ATOMIC_MASS` de `balancing.ts` incluye Au y Hg (para balancear los compuestos de oro y mercurio del taller).

## [2.3.0] · 2026-10-25

### Añadido
- Prácticas 63 a 65 (química, 11.º): funciones orgánicas oxigenadas; aminas y amidas; reacciones orgánicas en 3D
  (24 reacciones con estequiometría, ley de Hess y equilibrio de esterificación).
- Motor de nomenclatura de grupos funcionales validado contra PubChem en 176 estructuras (156 idénticas y 20 diferencias
  de convención clasificadas). Propiedades con fuente: Tₑb de 96 compuestos, solubilidad de 102, pKa/pKb de 57 y ΔcH° de 42.
- Procedencia propia para las tres prácticas.

## [2.2.0] · 2026-10-19

### Añadido
- Prácticas 60 a 62 (química, 11.º): hidrocarburos (alcanos, alquenos y alquinos); hidrocarburos aromáticos;
  nomenclatura orgánica IUPAC (motor propio validado contra los nombres de PubChem en 188 estructuras: 173 idénticas y
  15 diferencias clasificadas y explicadas).
- Módulos reutilizables de química orgánica (`src/models/ORGANICA.md`): lector y escritor SMILES, motor de nomenclatura,
  constructor, dibujo 2D y visor 3D con localizadores.
- Procedencia «Evidencia experimental» para las propiedades publicadas de hidrocarburos y aromáticos.

### Cambiado
- El módulo `src/chem/reaction3d.ts` se renombró `reactionScene.ts` para no confundirse con `Reaction3D.tsx` al generar
  el catálogo.

## [2.1.0] · 2026-10-19

### Añadido
- Kit 3D de química (`src/chem/`): visor de moléculas con confórmeros 3D de PubChem (38 especies con CID, URL, fecha y
  SHA-256), reacciones en 3D con átomos mapeados, ecuación balanceada y conteo de átomos (rotuladas como ilustración
  educativa), redes cristalinas iónicas (NaCl, KCl, MgO, CaO, CaF₂, CsCl) calculadas desde parámetros de red publicados y
  respaldo en SVG sin WebGL.
- Prácticas 57 a 59 (química, 10.º): óxidos e hidróxidos; ácidos y sales (titulación e hidrólisis de sales); nomenclatura
  química inorgánica (sistemática, Stock y tradicional; motor validado con 149 compuestos y sinónimos de PubChem).

### Corregido
- Visores 3D y chips de texto largo que ensanchaban la página en teléfonos.
- Tiempo máximo de las pruebas de accesibilidad y de teléfono que recorren todas las prácticas (de 5 a 10 minutos).

## [2.0.0] · 2026-10-19

Cambio **MAYOR**: cambia el flujo de todas las prácticas y contratos existentes — el formato
de las fichas `PracticeDef`, los identificadores de etapa y el esquema del registro de experimento —, aunque los datos
guardados siguen siendo legibles. Decisión y consecuencias en [ADR 0006](docs/v2/adr/0006-retiro-etapa-hipotesis.md).

### Eliminado
- Etapa «Hipótesis» de las 56 prácticas, a pedido del docente. Las etapas quedan Preparación → Experimento →
  Análisis y conclusión → Evaluación → Modelo y referencias (1 a 5); la práctica abre en Preparación y su botón lleva al
  Experimento. La «Práctica guiada» ya no exige una hipótesis antes de medir (solo ensayos antes de analizar).
- En «Análisis y conclusión»: «Compara tus resultados con tu hipótesis», la predicción y el veredicto «apoya / refuta /
  no concluyente». Se conservan la tendencia detectada en los datos, el control de variables, las preguntas de
  interpretación y la conclusión afirmación-evidencia-razonamiento.
- La hipótesis y la comparación en el informe, en el detalle y la línea de tiempo del seguimiento del curso y en los CSV
  del panel docente y del servidor (columna «Hipótesis»); el criterio «Formulación de hipótesis» de la rúbrica.
- La actividad «Mi hipótesis» y la pregunta «¿Tus datos apoyan o refutan tu hipótesis?» de las guías en PDF.

### Cambiado
- Fichas: `hypothesis: { prompt, pairs }` se reemplaza por `relations?: RelationPair[]` (mismo formato que los `pairs`).
  Es opcional: sin relaciones, el análisis muestra solo la interpretación y la conclusión.
- El progreso se calcula sobre cuatro etapas principales (25 % cada una).
- Textos del inicio, la ayuda, el modo guiado, los procedimientos (metabolismo, proteínas, reto, secuencias), el banco
  de preguntas y las guías, sin la etapa de hipótesis.
- Registro `lvcn-registro-experimento/1`: `hipotesis` pasa a opcional y obsoleta; los registros nuevos no la incluyen.

### Compatibilidad
- Las sesiones guardadas con hipótesis se siguen cargando (campos `hypothesis` y `comparison` opcionales y obsoletos;
  no se muestran).
- El servidor no cambia su contrato: acepta la etapa `hipotesis` y los campos antiguos de clientes anteriores; el
  cliente actual ya no los envía.
- El informe `lvcn-informe-v1` conserva los campos vacíos para que paneles de versiones anteriores lo abran.
- Los registros de experimento antiguos con `hipotesis` se siguen importando.

## [1.7.0] · 2026-10-19

### Añadido
- Práctica 56, energía cinética y energía potencial (8.º): riel de aire con fotopuerta (Ec = ½·m·v² y linealización
  Ec–v²), torre de caída de hasta 10 m con torno, sensor de fuerza y fotopuerta, con gravedad de la Tierra, la Luna
  o Marte (F·h = m·g·h = ½·m·v²), y lanzador de resorte (½·k·x²). Incluye barras de energía en vivo, rozamiento y aire en
  el modo avanzado (energía térmica), modo de instrumento real con semilla, panel de ideas erróneas con
  retroalimentación calculada y 6 preguntas más una tipo Saber 11. Reproduce el caso de referencia del programa: 1 kg a
  10 m da 98,1 J y 14,0 m/s.

### Cambiado
- Rediseño visual de la interfaz (`src/theme-2026.css`):
  - encabezado translúcido al desplazarse;
  - portada con fondo de malla de color, un átomo en SVG animado con los colores de las áreas y el título en degradado;
  - tarjetas con relieve y brillo del área, catálogo, pestañas, lecturas, tablas, diálogos y pie de página renovados;
  - modo oscuro propio;
  - animaciones desactivadas con «reducir movimiento»; impresión sin decoración.

  No cambia textos, accesibilidad ni el interior de los laboratorios.

## [1.6.0] · 2026-10-18

Programa v2 · Fase 6: metabolismo con análisis de balance de flujos.

### Añadido
- Práctica 55, metabolismo celular con FBA (11.º): modelo E. coli core (e_coli_core, 72 metabolitos, 95 reacciones,
  137 genes; archivo `textbook.xml.gz` de COBRApy 0.32.1; Orth, Fleming y Palsson, 2010) resuelto en el navegador
  (Nivel 0) con un símplex de dos fases propio. Fuente de carbono, captación, límite de oxígeno, eliminación de genes
  (reglas GPR) y de reacciones; mapa de flujos; curva de crecimiento frente al oxígeno; variabilidad de flujos (FVA);
  búsqueda de genes esenciales; tabla de las 95 reacciones.
- Validación contra COBRApy con GLPK (`scripts/validacion/cobra_fba.py`, archivo de referencia
  `tests/fixtures/cobra-fba.json`): 439 casos con error relativo máximo 3×10⁻¹²; FVA con error ≤ 4,8×10⁻¹⁰; genes
  esenciales iguales en aerobiosis y anaerobiosis. Valor dorado 0,8739 h⁻¹ (aerobio) y 0,2117 h⁻¹ (anaerobio).
- Procedencia: «Predicción computacional» con aviso explícito de que es un óptimo posible, no una medición.

## [1.5.0] · 2026-10-18

Programa v2 · Fase 5: visor de estructuras de proteínas.

### Añadido
- Práctica 54, estructura 3D de proteínas (11.º): estructuras experimentales del PDB (3I40, 2HHB, 2LZM, 1EMA; rayos X
  con método, resolución y fecha) y el modelo AF-Q04671-F1 de AlphaFold DB (v6, pLDDT y resumen del PAE), incluidos
  con URL, fecha y SHA-256; carga en vivo desde RCSB y AlphaFold con estados reales; estilos, colores por estructura
  secundaria, cadena, tipo de residuo o pLDDT; mediciones de distancia; ligandos; exportación de imagen. Lector mmCIF y
  PDB validado contra Biopython 1.85 (cadenas, residuos, átomos y 20 distancias con tolerancia 10⁻³ Å).
- Traza de carbonos alfa de respaldo (SVG) cuando no hay WebGL o no se puede cargar el visor 3D.

## [1.4.1] · 2026-10-18

### Corregido
- Geometría molecular: el visor 3D dejaba solo un aviso cuando el equipo no ofrece WebGL (frecuente en computadores
  escolares) o cuando no se podía descargar 3Dmol.js (conexión intermitente), y cualquier error interno lo apagaba sin
  registro. Ahora aparece una vista de respaldo en SVG con las mismas coordenadas del archivo, que se gira con el
  ratón, el dedo o las flechas del teclado y permite elegir átomos y medir; los errores quedan en la consola.
- El visor 3D se incluye en la descarga para uso sin conexión.

## [1.4.0] · 2026-10-18

Programa v2 · Fase 4: secuencias, BLAST y rastreo génico.

### Añadido
- Práctica 52, secuencias biológicas (11.º): lectura FASTA/GenBank con límites, composición y %GC, complemento,
  transcripción, traducción con las tablas NCBI 1, 2 y 11, ORF en seis marcos y alineamiento global y local
  (Gotoh, BLOSUM62). 39 pruebas, entre ellas 16 alineamientos con puntaje idéntico al de Biopython 1.85
  (`scripts/validacion/biopython_secuencias.py`). Catálogo con 8 registros reales (NCBI RefSeq y UniProt) consultados
  el 2026-10-18.
- BLAST real del NCBI (prompt 10.1): proxy de Nivel 1 en el servidor del colegio (`server/blast.mjs`) que respeta las
  reglas publicadas por el NCBI (una consulta cada 10 s, un sondeo por RID por minuto, `tool` y `email`), cliente con
  estados reales y panel accesible. Sin servidor: «Servicio no disponible», enlace al formulario oficial y un resultado
  grabado de una búsqueda real (RID D9HJG79C016, blastn 2.17.0+, refseq_select_rna, 2026-10-18) rotulado como tal.
  Pruebas con respuestas grabadas. Indicador `blast`.
- Práctica 53, rastreo génico (11.º): 5 genes con datos de NCBI Gene/Nucleotide, UniProt, RCSB PDB y ClinVar,
  comparados con los registros en vivo por `scripts/validacion/genes_fetch.mjs` (67/67; informe en
  `docs/v2/validacion-genes.md`); cada afirmación con su tipo de evidencia (ECO); variantes calculadas sobre el CDS.

## [1.3.0] · 2026-10-18

Programa v2 · Fase 3: física y química ampliadas con 3D y QR.

### Añadido
- Práctica 51: geometría molecular en 3D y modelo VSEPR (10.º). Coordenadas de confórmeros calculados por PubChem
  (12 moléculas, con CID, URL, fecha y SHA-256), visor 3Dmol.js 2.5.5 cargado solo en esta práctica y fuera de la
  precarga sin conexión, mediciones accesibles por teclado y descripción textual de la escena 3D.
- Energía: actividad «Caída y lanzamiento vertical» con integración RK4 de paso controlado, gráficas de Ec, Ep y Em
  frente al tiempo y la altura, aire opcional y control de deriva con tolerancia declarada (10⁻⁶). Caso de referencia
  del prompt 9.1: 98,1 J, 14,007 m/s y 1,4278 s.
- Código QR con el enlace permanente de cada práctica, en la aplicación («Compartir (QR)») y en las 100 guías PDF;
  verificado decodificando el QR y abriendo el enlace en un teléfono.
- Indicadores `energiaTemporal` y `qrPracticas`.

### Cambiado
- Gases: en la ley de Charles la presión exterior es un parámetro del modo avanzado (por defecto 101,3 kPa); con
  101,325 kPa, 0 °C y 1 mol el modelo da 22,414 L (prompt 9.2).

### Corregido
- La ley de Charles ignoraba la presión que se le pasaba (usaba siempre 101,3 kPa); ahora la recibe en un campo nuevo
  y opcional (`externalPressure`) sin cambiar el contrato anterior.

## [1.2.0] · 2026-10-18

Programa v2 · Fase 2: procedencia, registro reproducible y privacidad.

### Añadido
- Etiquetas de estatus epistémico (ADR 0002): franja «Lecturas y datos: Modelo calculado · Escena: Ilustración
  educativa» sobre cada laboratorio, etiqueta en el cuaderno y columna «Estatus del dato» en el CSV. El modo
  «Instrumento real» y los datos sintéticos del reto lo dicen explícitamente.
- Registro reproducible del experimento (ADR 0003): exportar e importar un JSON con la pregunta, la hipótesis, el
  modelo, la versión de la aplicación, el modo de medición con su regla de semilla y cada ensayo con su estatus; sin
  datos personales. Esquema en `docs/v2/esquema-registro-experimento.json`.
- Cada ensayo nuevo guarda la versión de la aplicación y el modo de medición.
- Indicadores de característica (`src/lib/flags.ts`): `procedencia` y `registroExperimento`, activados por defecto.
- ADR 0001–0005, plantillas de actividad y de ficha de enriquecimiento, y tabla de licencias (`docs/v2`).

### Cambiado
- Seguimiento de curso: el estudiante se une con un alias o código, no con su nombre completo (ADR 0004). El informe
  pide «Nombre o alias del estudiante».

## [1.1.0] · 2026-10-18

### Añadido
- Tres prácticas (50 en total): modelo interactivo de ADN y complementariedad con extracción de ADN (8.º),
  cálculos estequiométricos básicos con el mol y la balanza (9.º) y reto de indagación con datos sintéticos
  reproducibles y crítica del diseño (11.º). Ya no quedan prácticas «Próximamente».
- Valores dorados de las tres prácticas nuevas.

## [1.0.0] · 2026-10-18

Primera versión con número semántico. Línea base de regresión del programa v2 (Fase 1).

### Añadido
- Valores dorados: un caso por práctica con entrada fija, salida esperada y origen declarado
  (independiente, referencia o línea base) en `tests/golden/golden.test.ts`; la prueba falla si una práctica
  del catálogo no tiene su caso. Incluye los casos de referencia del prompt maestro (pH de HCl y de ácido
  acético 0,100 M, volumen molar 22,414 L, energía potencial y rapidez de caída).
- Prueba de navegación y carga en teléfono (390 × 844 px) para cada práctica: sin errores de consola, sin
  desbordamiento horizontal y sin fallos de accesibilidad (`tests/e2e/movil.spec.ts`).
- Las revisiones de accesibilidad usan ahora las reglas de WCAG 2.2 AA y toman la lista de prácticas del catálogo.
- Inventario automático (`node scripts/inventario.mjs` → `docs/v2/INVENTARIO.md`) y diagnóstico de la Fase 0.

### Corregido
- En teléfonos, el banco de trabajo y las tablas que se desplazan a lo ancho no se podían mover con el teclado
  en 18 prácticas; ahora reciben el foco solo mientras se desbordan (`initScrollRegionFocus`).

### Estado previo
- 47 prácticas publicadas (6.º a 11.º), 615 pruebas unitarias y 83 pruebas de interfaz. Historia detallada en
  `docs/AUDITORIA.md` y en el historial de git.
