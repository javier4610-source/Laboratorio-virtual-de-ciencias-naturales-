# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versión semántica
([SemVer](https://semver.org/lang/es/)): MAYOR cuando cambia un contrato existente (rutas, identificadores,
formato de datos guardados), MENOR cuando se agregan prácticas o funciones, PARCHE para correcciones.
Cada versión se puede revertir con `git revert` sin afectar las anteriores.

## [Sin publicar]

Versión **MENOR** prevista (2.5.0): rediseño integral de la interfaz sin cambiar rutas, identificadores de práctica,
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
