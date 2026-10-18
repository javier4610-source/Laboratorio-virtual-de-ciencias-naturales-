# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versión semántica
([SemVer](https://semver.org/lang/es/)): MAYOR cuando cambia un contrato existente (rutas, identificadores,
formato de datos guardados), MENOR cuando se agregan prácticas o funciones, PARCHE para correcciones.
Cada versión se puede revertir con `git revert` sin afectar las anteriores.

## [Sin publicar]

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
