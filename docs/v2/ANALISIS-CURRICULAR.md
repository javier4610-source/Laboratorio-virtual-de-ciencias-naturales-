# Análisis curricular de las prácticas y plan de visor 3D

**Fecha del análisis:** 2026-11-01 · **Alcance:** las 65 prácticas del catálogo (`src/curriculum/catalog.ts`), grados 6.º a 11.º ·
**Datos del plan, legibles por máquina:** [`plan-curricular.json`](plan-curricular.json) · **Pedido del docente:** «añade más
prácticas de química y física de acuerdo a la malla curricular establecida por el Ministerio de Educación; analízalas y
compáralas con las prácticas que tenemos y haz el ajuste necesario […] quiero que las prácticas de química, física y biología
tengan visor 3D».

Este documento es **análisis y plan**: no se agregó ninguna práctica ni se cambió código.

## Resumen para el docente

1. Hoy hay 65 prácticas: 23 de física, 20 de química, 16 de biología y 6 de ambiente. Solo 11 tienen visor 3D (todas de química orgánica e inorgánica de 10.º–11.º, más proteínas).
2. **Química está muy cargada en 10.º–11.º (16 prácticas) y casi vacía en 6.º–9.º (4 prácticas; 7.º no tiene ninguna).** Faltan el átomo, la tabla periódica, el enlace químico, la configuración electrónica y la óxido-reducción, que la propia malla del colegio pide.
3. **Física está bien en 6.º–9.º, pero en 10.º–11.º faltan** la electrostática (carga y campo eléctrico), el movimiento circular, la gravitación, las lentes, los fluidos en movimiento, la termodinámica y el efecto Doppler.
4. **Biología no tiene fisiología humana** (circulación, sistema nervioso, digestión, homeostasis, inmunidad), ni meiosis, ni clasificación de los seres vivos.
5. Propuesta: **26 prácticas nuevas** (8 de química, 8 de física, 8 de biología y 2 de ambiente), en tres olas por prioridad; todas nacen con visor 3D.
6. Propuesta de 3D para las **54 prácticas que no lo tienen**, en 7 lotes de 7 u 8 prácticas. El primer lote usa lo que ya existe (kit químico y 3Dmol); los demás usan el kit de escenas 3D que se construye en paralelo. Siempre con vista sin 3D, teclado y descripción en texto.
7. **Ningún DBA ni estándar está verificado con el documento oficial:** las páginas del MEN y de Colombia Aprende no se pudieron abrir desde el entorno. Todos los anclajes son «formulación propia, por verificar». Le pedimos validar los DBA en el panel docente (pestaña de validación curricular) con el documento impreso o descargado.
8. Mejoras más urgentes: unificar la cita de los Estándares, corregir la promesa de «soluciones amortiguadoras» en pH, diferenciar prácticas repetidas (conductores/circuitos simples, ondas/sonido, estequiometría/conservación) y dar manipulación directa a las prácticas que no la tienen.

## 1. Fuentes: qué se pudo y qué no se pudo consultar

| Fuente | Cómo se buscó (2026-11-01) | Resultado |
|---|---|---|
| Estándares Básicos de Competencias en Ciencias Naturales y Educación Ambiental (MEN, 2004; recopilados en 2006 en «Estándares Básicos de Competencias en Lenguaje, Matemáticas, Ciencias y Ciudadanas») | Buscador web; ninguna copia del PDF oficial apareció en los resultados | **No leído.** Solo se confirmó, por fuentes secundarias (encolombia.com, marco de referencia Saber 3.º, 5.º y 9.º del ICFES), la estructura en columnas: «me aproximo al conocimiento como científico(a) natural», «manejo conocimientos propios de las ciencias naturales» (entorno vivo, entorno físico, ciencia, tecnología y sociedad) y «desarrollo compromisos personales y sociales», y que en 10.º–11.º el entorno físico se divide en procesos químicos y procesos físicos (y el entorno vivo se trabaja como procesos biológicos). |
| Derechos Básicos de Aprendizaje de Ciencias Naturales (MEN, 2016, V.1) | Buscador web: aparecen el enlace de Colombia Aprende y una copia en blog.utp.edu.co (portada «V.1», generada en octubre de 2016, según el resumen del buscador) | **No leído.** `colombiaaprende.edu.co` y `blog.utp.edu.co` no resuelven desde el entorno (dominios fuera de la red permitida); `mineducacion.gov.co` ya estaba documentado como inaccesible en `docs/banco-saber11/01-FUNDAMENTACION.md`. |
| Datos del repositorio | `grep` de DBA, estándares y `curricularLink` en `src/` y `docs/` | Leídos: el campo `curricularLink` de las 65 prácticas, la malla institucional de `src/curriculum/grades.ts`, el módulo de validación docente `src/lib/validation.ts` (campos `dbaNumber`, `dbaText`, `standards` que llena el docente) y la política de `docs/v2/PLANTILLAS.md` (A.2). |

**Consecuencias para este documento**

- No se cita ningún enunciado ni número de DBA o de estándar como oficial. Lo que aparece entre comillas «…» y se atribuye
  a la malla institucional se copió literalmente de `src/curriculum/grades.ts` (dato del repositorio, no del MEN).
- Los anclajes de las prácticas nuevas dicen siempre «formulación propia, por verificar con el documento oficial»; en el
  JSON llevan `anchorVerified: false`.
- Para habilitar la consulta en una próxima sesión hay que permitir en la configuración de red del entorno los dominios
  `colombiaaprende.edu.co`, `mineducacion.gov.co` (o una copia institucional del PDF) y volver a ejecutar este análisis.
- **Inconsistencia detectada en el repositorio:** 63 prácticas citan «EBC (MEN, 2006)» y 2 (`pendulo`, `descomposicion`)
  «EBC (MEN, 2004)». Ambas fechas son defendibles (2004 es la publicación de los estándares de ciencias; 2006 la
  recopilación), pero conviene elegir una y explicarla (ver mejoras, M1).

## 2. Inventario de las 65 prácticas

**Todas** las prácticas tienen un anclaje del tipo «EBC (año), grupo de grados, entorno: paráfrasis» y un DBA marcado
«Propuesta: … Validar número y enunciado con el documento oficial del MEN». Ninguna tiene número de DBA. La tabla resume
ese anclaje; el texto completo está en cada `src/curriculum/practices/<id>.ts`. Las notas de calidad salen de la revisión
del código, de `docs/v2/INVENTARIO.md` (2026-10-26) y de `docs/AUDITORIA.md`; solo se anotan debilidades concretas.

| Práctica | Grado | Área | Tema | Anclaje curricular actual (`curricularLink`) | Visor 3D hoy | Nota de calidad |
|---|---|---|---|---|---|---|
| `celulas` | 6.º | Biología | La célula: uso del microscopio, células animales, vegetales y de hongos | EBC (2006) 6.º–7.º · entorno vivo (paráfrasis) · DBA 6.º: propuesta sin número | No | La organización en tejidos y órganos (malla de 6.º) no se trata. |
| `mezclas` | 6.º | Química | Materia: mezclas y métodos de separación | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 6.º: propuesta sin número | No | Laboratorio pequeño (203 líneas), sin manipulación directa ni modo de instrumento real; no incluye cromatografía en papel ni destilación. |
| `calor` | 6.º | Física | Temperatura, calor y energía térmica; equilibrio térmico, calor específico y calorímetro de… | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 6.º: propuesta sin número | No | — |
| `densidad` | 6.º | Física | Materia y sus propiedades: medición, masa, volumen y densidad | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 6.º: propuesta sin número | No | — |
| `maquinas` | 6.º | Física | Máquinas simples: ley de la palanca, ventaja mecánica, poleas y trabajo | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 6.º: propuesta sin número | No | — |
| `movimiento` | 6.º | Física | Movimiento rectilíneo: distancia, tiempo, rapidez media y desplazamiento | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 6.º: propuesta sin número | No | — |
| `ecosistema` | 6.º | Ambiental | Ecosistema cerrado en un frasco: factores bióticos y abióticos, fotosíntesis y respiración… | EBC (2006) 6.º–7.º · entorno vivo (paráfrasis) · DBA 6.º: propuesta sin número | No | — |
| `redes` | 6.º | Ambiental | Ecosistemas: niveles tróficos, flujo de energía y efectos en cascada | EBC (2006) 6.º–7.º · entorno vivo y CTS (paráfrasis) · DBA 6.º: propuesta sin número | No | Sin manipulación directa ni sonido; parámetros ilustrativos (declarados). |
| `mitosis` | 7.º | Biología | Reproducción celular: ciclo celular y mitosis | EBC (2006) 6.º–7.º · entorno vivo (paráfrasis) · DBA 7.º: propuesta sin número | No | Sin manipulación directa; no incluye meiosis (la malla de 7.º la pide como introducción). |
| `osmosis` | 7.º | Biología | Membrana celular, difusión y ósmosis | EBC (2006) 6.º–7.º · entorno vivo (paráfrasis) · DBA 7.º: propuesta sin número | No | — |
| `circuitos-simples` | 7.º | Física | Electricidad: circuito abierto y cerrado, serie y paralelo, conductores y aislantes,… | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 7.º: propuesta sin número | No | Mismo grado que «conductores» y con contenido solapado. |
| `conduccion` | 7.º | Física | Conducción del calor en sólidos: conductividad y difusividad térmica, ley de Fourier,… | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 7.º: propuesta sin número | No | — |
| `conductores` | 7.º | Física | Electricidad: conductores, aislantes y resistencia de los materiales | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 7.º: propuesta sin número | No | Mismo grado que «circuitos-simples» y con contenido solapado (conductores y aislantes). |
| `flotacion` | 7.º | Física | Empuje (E = ρ_líq·g·V_sum), peso aparente, peso del líquido desalojado, condición de… | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 7.º: propuesta sin número | No | — |
| `presion` | 7.º | Física | Presión hidrostática (p = p_atm + ρ·g·h), presión manométrica y absoluta, principio de… | EBC (2006) 6.º–7.º · entorno físico (paráfrasis) · DBA 7.º: propuesta sin número | No | — |
| `descomposicion` | 7.º | Ambiental | Ciclo de la materia: descomponedores y compostaje | EBC (2004) 6.º–7.º · entorno vivo y ciencia, tecnología y sociedad (paráfrasis) · DBA 7.º: propuesta sin número | No | Constantes k ilustrativas (declaradas); cita «EBC (MEN, 2004)» mientras casi todas citan 2006. |
| `extraccion-adn` | 8.º | Biología | Extracción casera de ADN de frutas (lisis, sal y alcohol frío) y estructura de la doble… | EBC (2006) 8.º–9.º · entorno vivo (paráfrasis) · DBA 8.º: propuesta sin número | No | — |
| `mendel` | 8.º | Biología | Leyes de Mendel: cruces monohíbridos y dihíbridos | EBC (2006) 8.º–9.º · entorno vivo (paráfrasis) · DBA 8.º: propuesta sin número | No | Sin manipulación directa; no muestra los cromosomas, así que la relación con la meiosis queda implícita. |
| `balanceo` | 8.º | Química | Reacciones químicas: ecuaciones, coeficientes, conteo de átomos y ley de conservación de la… | EBC (2006) 8.º–9.º · entorno físico (procesos químicos) (paráfrasis) · DBA 8.º: propuesta sin número | No | — |
| `conservacion` | 8.º | Química | Reacciones químicas: ley de conservación de la masa (Lavoisier) y reactivo limitante | EBC (2006) 8.º–9.º · entorno físico (procesos químicos) (paráfrasis) · DBA 8.º: propuesta sin número | No | — |
| `cinetica-potencial` | 8.º | Física | Energía cinética (½·m·v²), energía potencial gravitatoria (m·g·h) y elástica (½·k·x²): de… | EBC (2006) 8.º–9.º · entorno físico (paráfrasis) · DBA 8.º: propuesta sin número | No | — |
| `ondas` | 8.º | Física | Ondas mecánicas y sonido | EBC (2006) 8.º–9.º · entorno físico (paráfrasis) · DBA 8.º: propuesta sin número | No | Sin sonido ni instrumento real; mismo grado que «sonido», con solapamiento parcial. |
| `optica` | 8.º | Física | Óptica: reflexión, refracción y reflexión total interna | EBC (2006) 8.º–9.º · entorno físico (paráfrasis) · DBA 8.º: propuesta sin número | No | No trata lentes, prisma ni dispersión; laboratorio pequeño (200 líneas). |
| `sonido` | 8.º | Física | Rapidez del sonido y temperatura, resonancia en tubos cerrados y abiertos, longitud de… | EBC (2006) 8.º–9.º · entorno físico (paráfrasis) · DBA 8.º: propuesta sin número | No | — |
| `adn` | 9.º | Biología | Dogma central de la biología molecular y mutaciones | EBC (2006) 8.º–9.º · entorno vivo (paráfrasis) · DBA 9.º: propuesta sin número | No | Sin manipulación directa. |
| `seleccion` | 9.º | Biología | Evolución: variación, herencia y selección natural de un rasgo cuantitativo | EBC (2006) 8.º–9.º · entorno vivo (paráfrasis) · DBA 9.º: propuesta sin número | No | Sin manipulación directa; ancho de contraste w = 0,30 ilustrativo (declarado). |
| `mol` | 9.º | Química | El mol, la masa molar, el número de Avogadro y la estequiometría masa–masa con conservación… | EBC (2006) 8.º–9.º · entorno físico (procesos químicos) (paráfrasis) · DBA 9.º: propuesta sin número | No | — |
| `cinematica` | 9.º | Física | Cinemática: movimiento rectilíneo uniforme y uniformemente acelerado | EBC (2006) 8.º–9.º · entorno físico (paráfrasis) · DBA 9.º: propuesta sin número | No | Sin manipulación directa. |
| `newton` | 9.º | Física | Dinámica: leyes de Newton y fricción | EBC (2006) 8.º–9.º · entorno físico (paráfrasis) · DBA 9.º: propuesta sin número | No | — |
| `trabajo` | 9.º | Física | Trabajo mecánico, energía potencial, rozamiento, eficiencia y potencia en un plano inclinado | EBC (2006) 8.º–9.º · entorno físico (paráfrasis) · DBA 9.º: propuesta sin número | No | — |
| `enzimas` | 10.º | Biología | Biomoléculas y enzimas | EBC (2006) 10.º–11.º · entorno vivo (paráfrasis) · DBA 10.º: propuesta sin número | No | — |
| `fotosintesis` | 10.º | Biología | Fotosíntesis, respiración celular y factores limitantes | EBC (2006) 10.º–11.º · entorno vivo (paráfrasis) · DBA 10.º: propuesta sin número | No | Laboratorio pequeño (205 líneas), sin instrumento real. |
| `respiracion` | 10.º | Biología | Respiración aerobia, fermentación, cociente respiratorio y rendimiento de ATP | EBC (2006) 10.º–11.º · entorno vivo (paráfrasis) · DBA 10.º: propuesta sin número | No | — |
| `acidos-sales` | 10.º | Química | Hidrácidos y oxácidos (formación, fuerza y nomenclatura), neutralización ácido + hidróxido… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 10.º: propuesta sin número | Sí · Molecule3D, Crystal3D, Reaction3D + taller de compuestos | — |
| `cinetica` | 10.º | Química | Cinética química: concentración, temperatura, superficie de contacto y catalizadores | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 10.º: propuesta sin número | No | Parámetros ilustrativos (declarados). |
| `gases` | 10.º | Química | Gases: leyes de Boyle, Charles y Gay-Lussac; gas ideal | EBC (2006) 10.º–11.º · entorno físico (paráfrasis) · DBA 10.º: propuesta sin número | No | La jeringa parte siempre de 100 mL, 101,3 kPa y 25 °C (INITIAL fijo); AUDITORIA lo dejó «Pendiente (Fase 3)»: confirmar si se cerró. |
| `geometria` | 10.º | Química | Geometría molecular, ángulos y longitudes de enlace, modelo de repulsión de pares… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 10.º: propuesta sin número | Sí · 3Dmol.js (confórmeros PubChem3D) + respaldo SVG | — |
| `nomenclatura-inorganica` | 10.º | Química | Números de oxidación y neutralidad de cargas; funciones químicas inorgánicas (óxidos,… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 10.º: propuesta sin número | Sí · Molecule3D, Crystal3D + taller de compuestos | — |
| `oxidos-hidroxidos` | 10.º | Química | Funciones químicas inorgánicas: combustión de metales y no metales, óxidos básicos, ácidos,… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 10.º: propuesta sin número | Sí · Molecule3D, Crystal3D, Reaction3D + taller de compuestos | — |
| `soluciones` | 10.º | Química | Soluciones: concentración, molaridad y dilución | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 10.º: propuesta sin número | No | — |
| `choques` | 10.º | Física | Cantidad de movimiento, impulso y choques en una dimensión | EBC (2006) 10.º–11.º · entorno físico (paráfrasis) · DBA 10.º: propuesta sin número | No | Sin manipulación directa. |
| `energia` | 10.º | Física | Trabajo y energía: energía potencial, cinética y su conservación | EBC (2006) 10.º–11.º · entorno físico (paráfrasis) · DBA 10.º: propuesta sin número | No | AUDITORIA anotó que la pista no admite h = 10 m («Pendiente (Fase 3)»): confirmar si se cerró. |
| `pendulo` | 10.º | Física | Movimiento oscilatorio: péndulo simple | EBC (2004) 10.º–11.º · entorno físico (paráfrasis) · DBA 10.º: propuesta sin número | No | Cita «EBC (MEN, 2004)» y las demás «(MEN, 2006)»: unificar la referencia. |
| `proyectiles` | 10.º | Física | Cinemática en dos dimensiones: lanzamiento de proyectiles | EBC (2006) 10.º–11.º · entorno físico (paráfrasis) · DBA 10.º: propuesta sin número | No | — |
| `expresion` | 11.º | Biología | Expresión de un gen eucariota (promotor, transcripción, caperuza 5′, cola de poli-A,… | EBC (2006) 10.º–11.º · entorno vivo (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `metabolismo` | 11.º | Biología | Metabolismo central de Escherichia coli (glucólisis, vía de las pentosas fosfato, ciclo de… | EBC (2006) 10.º–11.º · entorno vivo (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `popgen` | 11.º | Biología | Evolución y genética de poblaciones: Hardy-Weinberg, selección y deriva | EBC (2006) 10.º–11.º · entorno vivo (paráfrasis) · DBA 11.º: propuesta sin número | No | El laboratorio más pequeño del catálogo (179 líneas); sin manipulación, instrumento real ni sonido. |
| `proteinas` | 11.º | Biología | Estructura primaria, secundaria, terciaria y cuaternaria de proteínas; estructuras… | EBC (2006) 10.º–11.º · entorno vivo (paráfrasis) · DBA 11.º: propuesta sin número | Sí · 3Dmol.js (PDB 1EMA, 2HHB, 2LZM, 3I40 y AlphaFold) + respaldo SVG | — |
| `rastreo` | 11.º | Biología | Del genoma al fenotipo con registros reales de bases de datos (NCBI, UniProt, PDB,… | EBC (2006) 10.º–11.º · entorno vivo (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `secuencias` | 11.º | Biología | Representación de la información genética (FASTA y GenBank), composición y %GC, reverso… | EBC (2006) 10.º–11.º · entorno vivo y ciencia, tecnología y sociedad (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `aromaticos` | 11.º | Química | Benceno y aromaticidad: longitudes de enlace, resonancia, regla de Hückel (4n + 2),… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 11.º: propuesta sin número | Sí · Molecule3D, Reaction3D | — |
| `equilibrio` | 11.º | Química | Equilibrio químico: constante de equilibrio, cociente de reacción y principio de Le Châtelier | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `estequiometria` | 11.º | Química | Estequiometría avanzada: reactivo limitante, exceso y rendimiento | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 10.º u 11.º: propuesta sin número | No | Se superpone con «conservacion» (8.º, reactivo limitante) y «mol» (9.º); sin manipulación directa ni sonido. |
| `grupos-nitrogenados` | 11.º | Química | Aminas y amidas: clasificación (1.ª/2.ª/3.ª), nomenclatura IUPAC 2013, basicidad con pKa de… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) y entorno vivo (paráfrasis) · DBA 11.º: propuesta sin número | Sí · FunctionalViewer3D, Reaction3D | — |
| `grupos-oxigenados` | 11.º | Química | Grupos funcionales con oxígeno: identificación en 3D, nomenclatura IUPAC 2013 (sufijos,… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 11.º: propuesta sin número | Sí · FunctionalViewer3D | — |
| `hidrocarburos` | 11.º | Química | Química del carbono: series homólogas de alcanos, alquenos y alquinos, hibridación sp³, sp²… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 11.º: propuesta sin número | Sí · OrganicViewer3D, Molecule3D, Reaction3D | — |
| `nomenclatura-organica` | 11.º | Química | Nomenclatura IUPAC (Recomendaciones 2013) de alcanos, alquenos, alquinos, cicloalcanos,… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 11.º: propuesta sin número | Sí · OrganicViewer3D | — |
| `ph` | 11.º | Química | Ácidos, bases y pH; neutralización y titulación | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 11.º: propuesta sin número | No | La nota de «acidos-sales» anuncia que esta práctica profundiza en soluciones amortiguadoras, pero el modelo (acidbase.ts) las excluye. |
| `reacciones-organicas` | 11.º | Química | Tipos de reacciones orgánicas (combustión, sustitución radicalaria, adición, oxidación,… | EBC (2006) 10.º–11.º · entorno físico (procesos químicos) (paráfrasis) · DBA 11.º: propuesta sin número | Sí · Reaction3D | — |
| `circuitos` | 11.º | Física | Electricidad: ley de Ohm, circuitos en serie, paralelo y mixtos | EBC (2006) 10.º–11.º · entorno físico (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `induccion` | 11.º | Física | Campo magnético de imanes y solenoides, ley de Faraday–Lenz, generador de corriente alterna… | EBC (2006) 10.º–11.º · entorno físico (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `interferencia` | 11.º | Física | Óptica ondulatoria: difracción por una rendija, experimento de Young (doble rendija), redes… | EBC (2006) 10.º–11.º · entorno físico (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `agua` | 11.º | Ambiental | Calidad del agua: oxígeno disuelto, DBO₅, curva de Streeter–Phelps, bioindicadores… | EBC (2006) 10.º–11.º · ciencia, tecnología y sociedad y entorno vivo (paráfrasis) · DBA 11.º: propuesta sin número | No | — |
| `poblacion` | 11.º | Ambiental | Ecología: dinámica de poblaciones, capacidad de carga y aprovechamiento sostenible | EBC (2006) 10.º–11.º · entorno vivo y CTS (paráfrasis) · DBA 11.º: propuesta sin número | No | Sin manipulación directa; está en 11.º aunque la malla institucional pone dinámica de poblaciones en 9.º. |
| `reto` | 11.º | Ambiental | Indagación abierta: pregunta de investigación, diseño experimental (niveles, réplicas,… | EBC (2006) 10.º–11.º · «me aproximo al conocimiento como científico natural» (paráfrasis) · DBA 11.º: propuesta sin número | No | — |

**Observaciones transversales**

- Visor 3D hoy: 11 de 65 (17 %). Todos usan 3Dmol.js con carga diferida y vista de respaldo SVG (`src/chem/engine3d.ts`),
  que es el patrón que debe seguir el resto.
- `ecosistema` y `redes` están en el área «ambiental», pero su contenido es del entorno vivo (ecología); conviene un campo
  `entorno` independiente del área (mejora M2).
- `docs/v2/INVENTARIO.md` reporta «con revisión axe: 0» aunque `docs/AUDITORIA.md` documenta auditorías axe por práctica:
  el detector del script de inventario probablemente no reconoce cómo se escriben esas pruebas (revisar `scripts/inventario.mjs`).

## 3. Cobertura curricular

### 3.1. Prácticas por grado y área

| Grado | Biología | Química | Física | Ambiental | Total |
|---|---|---|---|---|---|
| 6.º | 1 | 1 | 4 | 2 | 8 |
| 7.º | 2 | **0** | 5 | 1 | 8 |
| 8.º | 2 | 2 | 4 | 0 | 8 |
| 9.º | 2 | **1** | 3 | 0 | 6 |
| 10.º | 3 | 7 | 4 | 0 | 14 |
| 11.º | 6 | 9 | 3 | 3 | 21 |
| **Total** | **16** | **20** | **23** | **6** | **65** |

Química: 4 prácticas en 6.º–9.º frente a 16 en 10.º–11.º. Física: 16 en 6.º–9.º frente a 7 en 10.º–11.º. Biología: solo 1 en
6.º y la mitad del área (6) en 11.º, casi toda de biología molecular.

### 3.2. Cobertura por entornos de los Estándares (estructura confirmada; temas en formulación propia)

Los temas de la columna «Qué se espera» son **formulación propia, por verificar con el documento oficial**: resumen el
tipo de contenido de cada entorno y grupo de grados, no transcriben estándares.

| Grupo | Entorno | Qué se espera (formulación propia) | Prácticas actuales | Estado |
|---|---|---|---|---|
| 6.º–7.º | Entorno vivo | Célula y su organización; clasificación de seres vivos; nutrición, circulación, respiración y excreción; reproducción celular; ecosistemas y ciclos | `celulas`, `osmosis`, `mitosis`, `ecosistema`, `redes`, `descomposicion` | **Parcial:** sin clasificación, sin sistemas del cuerpo, sin meiosis, ciclos biogeoquímicos solo vía descomposición |
| 6.º–7.º | Entorno físico (química) | Propiedades de la materia, sustancias puras y mezclas, separación, modelo de partículas, cambios físicos y químicos, estructura del átomo | `mezclas` (y `densidad`) | **Parcial / débil:** sin estados de la materia, sin cambio químico, sin átomo |
| 6.º–7.º | Entorno físico (física) | Masa, peso, densidad; fuerzas y máquinas; movimiento; calor y temperatura; electricidad; fluidos; magnetismo | `densidad`, `maquinas`, `movimiento`, `calor`, `conduccion`, `circuitos-simples`, `conductores`, `flotacion`, `presion` | **Cubierto**, salvo magnetismo (no cubierto) y luz/sonido en 6.º (se ven en 8.º) |
| 6.º–7.º | Ciencia, tecnología y sociedad | Salud, uso de recursos, residuos, seguridad | `descomposicion` (residuos), `circuitos-simples` (riesgo eléctrico) | **Parcial** |
| 8.º–9.º | Entorno vivo | Reproducción; herencia y ADN; sistemas de coordinación (nervioso y endocrino); evolución y biodiversidad | `mendel`, `extraccion-adn`, `adn`, `seleccion` | **Parcial:** sin meiosis/reproducción, sin sistema nervioso ni endocrino |
| 8.º–9.º | Entorno físico (química) | Modelos atómicos y tabla periódica; enlace; reacciones y conservación de la masa; cantidad de sustancia | `balanceo`, `conservacion`, `mol` | **Parcial:** reacciones y mol cubiertos; tabla periódica y enlace **no** |
| 8.º–9.º | Entorno físico (física) | Movimiento y fuerzas; energía y trabajo; ondas, sonido y luz | `cinematica`, `newton`, `trabajo`, `cinetica-potencial`, `ondas`, `sonido`, `optica` | **Cubierto**, salvo lentes e instrumentos ópticos |
| 8.º–9.º | Ciencia, tecnología y sociedad | Salud, sexualidad y reproducción responsable, tecnología y ambiente | — | **No cubierto** como práctica (se toca en contextos de aplicación) |
| 10.º–11.º | Entorno vivo (procesos biológicos) | Biomoléculas y metabolismo; genética molecular y biotecnología; evolución; fisiología, homeostasis e inmunidad; ecología | `enzimas`, `fotosintesis`, `respiracion`, `metabolismo`, `expresion`, `proteinas`, `rastreo`, `secuencias`, `popgen`, `poblacion` | **Parcial:** fuerte en lo molecular; **sin fisiología, homeostasis ni inmunidad**; biotecnología solo bioinformática |
| 10.º–11.º | Entorno físico (procesos químicos) | Estructura atómica y configuración electrónica; enlace y geometría; funciones inorgánicas y orgánicas; estequiometría; soluciones y gases; cinética y equilibrio; ácidos y bases; óxido-reducción; energía en las reacciones | `geometria`, `nomenclatura-inorganica`, `oxidos-hidroxidos`, `acidos-sales`, `soluciones`, `gases`, `cinetica`, `estequiometria`, `equilibrio`, `ph`, `hidrocarburos`, `nomenclatura-organica`, `aromaticos`, `grupos-oxigenados`, `grupos-nitrogenados`, `reacciones-organicas` | **Cubierto en orgánica e inorgánica;** **no cubiertos:** configuración electrónica, óxido-reducción/electroquímica, termoquímica (solo Hess dentro de `reacciones-organicas`) |
| 10.º–11.º | Entorno físico (procesos físicos) | Cinemática y dinámica (incluido el movimiento circular y la gravitación); energía y momento; oscilaciones y ondas; fluidos; termodinámica; electricidad y magnetismo; óptica | `proyectiles`, `choques`, `energia`, `pendulo`, `circuitos`, `induccion`, `interferencia` | **Parcial:** sin electrostática, movimiento circular, gravitación, fluidos en movimiento, termodinámica, Doppler |
| 10.º–11.º | Ciencia, tecnología y sociedad | Ambiente y sostenibilidad, cambio climático, salud pública, tecnología | `agua`, `poblacion`, `reto` (y, en parte, `proteinas`, `secuencias`, `induccion`) | **Parcial:** sin cambio climático ni salud pública |
| 6.º–11.º | Me aproximo al conocimiento como científico natural | Preguntas, hipótesis, control de variables, registro y análisis de datos | Casi todas (registro de ensayos, gráficas, pista de control de variables) y `reto` | **Cubierto** |

**Por DBA:** no es posible hacer la matriz por DBA con rigor porque ningún DBA se pudo leer y ninguna práctica tiene
número de DBA. En su lugar, la sección 3.3 usa la malla institucional del repositorio, que sí es verificable.

### 3.3. Cobertura de la malla institucional (`src/curriculum/grades.ts`)

Los temas se copian literalmente de `grades.ts` (es la malla que usa la plataforma; su correspondencia con el MEN también
está por validar).

| Grado | Tema de la malla institucional | Prácticas | Estado |
|---|---|---|---|
| 6.º | «Método científico, observación, hipótesis, variables y medición» | `densidad`, `movimiento` (y todas) | Cubierto |
| 6.º | «Uso de instrumentos de laboratorio» | `densidad`, `celulas`, `calor` | Cubierto |
| 6.º | «Célula y organización de los seres vivos» | `celulas` | Parcial (sin tejidos ni órganos) |
| 6.º | «Diferencias entre células animales y vegetales» | `celulas` | Cubierto |
| 6.º | «Clasificación básica de los seres vivos» | — | **No cubierto** → `clasificacion-seres-vivos` |
| 6.º | «Ecosistemas: factores bióticos y abióticos» | `ecosistema`, `redes` | Cubierto |
| 6.º | «Materia, propiedades físicas, mezclas y métodos de separación» | `densidad`, `mezclas` | Parcial (sin estados de la materia) → `estados-de-la-materia` |
| 6.º | «Fuerza, movimiento y máquinas simples» | `maquinas`, `movimiento` | Cubierto |
| 6.º | «Temperatura, calor, luz y sonido» | `calor` | Parcial (luz y sonido en 8.º) |
| 6.º | «Cuidado del agua y del ambiente» | `ecosistema` (`agua` en 11.º) | Parcial |
| 7.º | «Membrana celular, difusión y ósmosis» | `osmosis` | Cubierto |
| 7.º | «Nutrición, circulación, respiración y excreción» | — | **No cubierto** → `sistema-circulatorio`, `nutricion-digestion` |
| 7.º | «Reproducción celular: introducción a mitosis y meiosis» | `mitosis` | Parcial → `meiosis` |
| 7.º | «Relaciones ecológicas y ciclos biogeoquímicos» | `descomposicion` (`ecosistema`, `redes` en 6.º) | Parcial → `ciclo-del-carbono` |
| 7.º | «Estructura del átomo y tabla periódica» | — | **No cubierto** → `modelos-atomicos`, `tabla-periodica` (construidas, ola 1a) |
| 7.º | «Enlaces químicos introductorios» | — | **Cubierto en la ola 1a** → `enlace-quimico` |
| 7.º | «Densidad, presión, temperatura y transferencia de calor» | `presion`, `flotacion`, `conduccion` | Cubierto |
| 7.º | «Electricidad básica y circuitos simples» | `circuitos-simples`, `conductores` | Cubierto (con solapamiento) |
| 8.º | «Reproducción sexual y asexual» | — | **No cubierto** → `meiosis` (parcial) |
| 8.º | «ADN, genes y cromosomas» | `extraccion-adn`, `mendel` | Cubierto |
| 8.º | «Leyes de Mendel: cruces monohíbridos y dihíbridos» | `mendel` | Cubierto |
| 8.º | «Sistemas nervioso y endocrino» | — | **No cubierto** → `sistema-nervioso` (endocrino: `homeostasis-glucosa` en 10.º) |
| 8.º | «Selección natural e introducción a la evolución» | `seleccion` (9.º) | Cubierto (en 9.º) |
| 8.º | «Tabla periódica y propiedades periódicas» | — | **No cubierto** → `tabla-periodica` |
| 8.º | «Enlaces químicos y reacciones» | `balanceo`, `conservacion` | Parcial (sin enlace) → `enlace-quimico` |
| 8.º | «Conservación de la masa» | `conservacion`, `balanceo` | Cubierto |
| 8.º | «Ondas, sonido y óptica» | `ondas`, `sonido`, `optica` | Cubierto (sin lentes) → `lentes` |
| 9.º | «Replicación del ADN» · «Transcripción y traducción» · «Síntesis de proteínas» · «Mutaciones y su efecto en las proteínas» | `adn` | Cubierto |
| 9.º | «Genética mendeliana y variación genética» | `mendel` (8.º) | Cubierto |
| 9.º | «Evolución y selección natural» | `seleccion` | Cubierto |
| 9.º | «Dinámica de poblaciones y ecología» | `poblacion` (11.º) | Parcial (no hay práctica en 9.º) |
| 9.º | «Mol, masa molar y estequiometría introductoria» | `mol` | Cubierto |
| 9.º | «Cinemática, leyes de Newton, trabajo y energía» | `cinematica`, `newton`, `trabajo` | Cubierto |
| 10.º | «Biomoléculas y enzimas» | `enzimas` | Cubierto |
| 10.º | «Fotosíntesis y respiración celular» · «Metabolismo y transformación de energía» | `fotosintesis`, `respiracion` (`metabolismo` en 11.º) | Cubierto |
| 10.º | «Biotecnología y aplicaciones de la biología molecular» | `secuencias`, `rastreo` (11.º, bioinformática) | Parcial → `biotecnologia-pcr` |
| 10.º | «Fisiología humana» | — | **No cubierto** → `homeostasis-glucosa` |
| 10.º | «Configuración electrónica y periodicidad química» | — | **No cubierto** → `configuracion-electronica` |
| 10.º | «Soluciones, concentración, molaridad y gases» | `soluciones`, `gases` | Cubierto |
| 10.º | «Reacciones químicas y relaciones cuantitativas» | `cinetica`, `oxidos-hidroxidos`, `acidos-sales` | Cubierto → `termoquimica` amplía |
| 10.º | «Movimiento, dinámica, energía y conservación» | `proyectiles`, `choques`, `energia`, `pendulo` | Parcial (sin movimiento circular ni gravitación) |
| 11.º | «Genética molecular y regulación de la expresión génica» | `expresion`, `rastreo`, `secuencias`, `proteinas` | Cubierto |
| 11.º | «Biotecnología, ingeniería genética y bioética» | `rastreo`, `secuencias` | Parcial |
| 11.º | «Evolución y genética de poblaciones» | `popgen` | Cubierto |
| 11.º | «Fisiología humana, inmunología y homeostasis» | — | **No cubierto** → `sistema-inmune`, `homeostasis-glucosa` |
| 11.º | «Ecología, biodiversidad, contaminación y cambio climático» | `agua`, `poblacion` | Parcial (sin cambio climático) → `efecto-invernadero` |
| 11.º | «Estequiometría avanzada» · «Equilibrio químico introductorio» · «Ácidos, bases y pH» | `estequiometria`, `equilibrio`, `ph` | Cubierto |
| 11.º | «Oxidación-reducción» | — | **No cubierto** → `pila-electroquimica` |
| 11.º | «Electricidad, circuitos y magnetismo» | `circuitos`, `induccion` | Cubierto en la ola 1a → `electrostatica` |
| 11.º | «Ondas, óptica y fenómenos físicos» | `interferencia` | Cubierto → `efecto-doppler` amplía |
| 11.º | «Diseño experimental, análisis de datos e interpretación de evidencias» | `reto` | Cubierto |

### 3.4. Brechas por área

- **Química (prioridad del docente):** la base de 6.º–9.º. Sin práctica de estados de la materia y cambio químico (6.º–7.º),
  átomo y tabla periódica (7.º–8.º), enlace (8.º–9.º). En 10.º–11.º faltan configuración electrónica, óxido-reducción y
  termoquímica. Lo orgánico e inorgánico de 10.º–11.º está muy completo (incluso sobrado).
- **Física (prioridad del docente):** 10.º–11.º. Faltan electrostática, movimiento circular, gravitación, lentes,
  fluidos en movimiento, termodinámica y Doppler; en 6.º–7.º falta magnetismo.
- **Biología:** fisiología humana en todos los grados (circulación, digestión, sistema nervioso, homeostasis, inmunidad),
  meiosis y reproducción, clasificación de los seres vivos y biotecnología de laboratorio.
- **Ambiental / CTS:** cambio climático y ciclos biogeoquímicos.

## 4. Prácticas nuevas propuestas (26)

Criterio: solo se proponen prácticas para brechas reales de las secciones 3.2 y 3.3; no se rellena. Prioridad P1 = cierra
un tema de la malla sin ninguna práctica y con alto valor de la simulación; P2 = cierra una brecha parcial o de menor
peso; P3 = amplía. Las olas `nuevas-1` (9 prácticas, P1), `nuevas-2` (8, P2) y `nuevas-3` (9, P3) son el orden sugerido
de construcción. Cada práctica sigue la plantilla de `docs/v2/PLANTILLAS.md` (modelo validado con pruebas, valores dorados,
procedencia de los datos, ficha con DBA «propuesta», evaluación y pregunta tipo Saber) y **nace con su vista 3D**.

Toda cifra del modelo debe tomarse de la fuente citada y quedar con su procedencia; las que dicen «verificar» no se usan
hasta comprobarlas. Ningún anclaje está verificado (`anchorVerified: false`).


### 4.1. Química (8 prácticas nuevas)

| Prioridad | id | Grado | Título | Ola |
|---|---|---|---|---|
| P1 | `modelos-atomicos` | 7.º | Modelos atómicos: de Dalton a Bohr con el experimento de Rutherford | nuevas-1 · **construida (ola 1a)** |
| P1 | `tabla-periodica` | 8.º | Tabla periódica y propiedades periódicas | nuevas-1 · **construida (ola 1a)** |
| P1 | `enlace-quimico` | 9.º | Enlace iónico, covalente y metálico: estructura y propiedades | nuevas-1 · **construida (ola 1a)** |
| P1 | `configuracion-electronica` | 10.º | Configuración electrónica y orbitales atómicos | nuevas-1 |
| P1 | `pila-electroquimica` | 11.º | Oxidación-reducción: pila de Daniell y electrólisis | nuevas-1 |
| P2 | `estados-de-la-materia` | 6.º | Estados de la materia y curva de calentamiento del agua | nuevas-2 |
| P2 | `cambios-quimicos` | 7.º | Cambios físicos y químicos: evidencias de una reacción | nuevas-2 |
| P3 | `termoquimica` | 10.º | Termoquímica: calor de disolución y de neutralización | nuevas-3 |

**`modelos-atomicos` (construida en la ola 1a; ver `src/curriculum/practices/modelos-atomicos.ts`) · Modelos atómicos: de Dalton a Bohr con el experimento de Rutherford** (7.º, P1)

- **Anclaje:** EBC 6.º–7.º, entorno físico: estructura de la materia y modelos que la explican (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 7.º): «Estructura del átomo y tabla periódica».
- **Meta de aprendizaje:** Explica por qué el modelo de Thomson no predice la dispersión observada por Geiger y Marsden y cómo el modelo nuclear y el de Bohr explican los espectros de líneas del hidrógeno.
- **Modelo científico y validación:** Dispersión de Rutherford (número de partículas por ángulo ∝ 1/sen⁴(θ/2)); niveles de Bohr Eₙ = −13,6 eV/n² y fórmula de Rydberg 1/λ = R·(1/n₁² − 1/n₂²). Validación: líneas de Balmer de la base NIST ASD; Geiger y Marsden (1913).
- **Vista 3D (obligatoria):** Lámina de oro 3D atravesada por un haz de partículas alfa con detector esférico alrededor: el estudiante gira el detector y cuenta rebotes a cada ángulo; luego un átomo de Bohr 3D con transiciones que emiten fotones del color de la línea.

**`tabla-periodica` (construida en la ola 1a; ver `src/curriculum/practices/tabla-periodica.ts`) · Tabla periódica y propiedades periódicas** (8.º, P1)

- **Anclaje:** EBC 8.º–9.º, entorno físico: organización de los elementos y relación entre su estructura y sus propiedades (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 8.º): «Tabla periódica y propiedades periódicas».
- **Meta de aprendizaje:** Predice y comprueba con datos reales las tendencias del radio atómico, la energía de ionización y la electronegatividad en grupos y períodos, y las explica con la carga nuclear efectiva.
- **Modelo científico y validación:** Carga nuclear efectiva (reglas de Slater). Datos de radio, primera energía de ionización y electronegatividad de Pauling de la tabla periódica de PubChem (accesible desde el entorno) y NIST, con fecha de consulta y procedencia visibles.
- **Vista 3D (obligatoria):** Tabla periódica 3D en «relieve»: cada casilla es una columna cuya altura es la propiedad elegida; al girarla se ven a la vez la tendencia del período y la del grupo. Esferas atómicas a escala de radio al seleccionar elementos.

**`enlace-quimico` (construida en la ola 1a; ver `src/curriculum/practices/enlace-quimico.ts`) · Enlace iónico, covalente y metálico: estructura y propiedades** (9.º, P1)

- **Anclaje:** EBC 8.º–9.º, entorno físico: relación entre el tipo de enlace y las propiedades de las sustancias (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts): «Enlaces químicos introductorios» (7.º) y «Enlaces químicos y reacciones» (8.º).
- **Meta de aprendizaje:** Clasifica sustancias (NaCl, sacarosa, cobre, cuarzo, parafina) por pruebas de conductividad, punto de fusión y solubilidad, y justifica el resultado con el tipo de enlace y la diferencia de electronegatividad.
- **Modelo científico y validación:** Diferencia de electronegatividad de Pauling como criterio orientativo (convención de manual, no frontera exacta); propiedades físicas de tablas (CRC Handbook) con procedencia; redes cristalinas del kit (src/chem/crystal.ts).
- **Vista 3D (obligatoria):** Comparador 3D lado a lado: red iónica del NaCl (Crystal3D), red covalente del cuarzo, cristal molecular de sacarosa y metal con «mar de electrones»; al «fundir» o «disolver» se ve qué se separa (iones, moléculas) y qué no.

**`configuracion-electronica` · Configuración electrónica y orbitales atómicos** (10.º, P1)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos químicos): estructura del átomo según la teoría cuántica y su relación con la tabla periódica (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 10.º): «Configuración electrónica y periodicidad química».
- **Meta de aprendizaje:** Construye configuraciones con el principio de Aufbau, Pauli y Hund, reconoce las excepciones (Cr, Cu) y relaciona la capa de valencia con el grupo y el período.
- **Modelo científico y validación:** Regla de Madelung (n + l); configuraciones del estado fundamental de NIST para validar las excepciones; formas de los orbitales a partir de las funciones hidrogenoides de los manuales (Atkins, Química física).
- **Vista 3D (obligatoria):** Orbitales s, p y d como superficies de probabilidad 3D superpuestas en el mismo núcleo; el estudiante los llena electrón por electrón y ve la orientación de pₓ, p_y, p_z y de los d. Aquí el 3D es imprescindible: la forma y orientación no se entienden en 2D.

**`pila-electroquimica` · Oxidación-reducción: pila de Daniell y electrólisis** (11.º, P1)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos químicos): reacciones de óxido-reducción y su aprovechamiento (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 11.º): «Oxidación-reducción».
- **Meta de aprendizaje:** Identifica oxidación y reducción en una pila, predice su voltaje con potenciales estándar, observa el efecto de la concentración (Nernst) y calcula la masa depositada en una electrólisis (Faraday).
- **Modelo científico y validación:** E°celda = E°cátodo − E°ánodo (Zn²⁺/Zn −0,76 V; Cu²⁺/Cu +0,34 V; tablas de Atkins o CRC); ecuación de Nernst; ley de Faraday m = Q·M/(n·F).
- **Vista 3D (obligatoria):** Celda galvánica 3D: electrodos de Zn y Cu, iones que salen o se depositan, electrones por el cable y aniones/cationes migrando por el puente salino; acercamiento a la superficie del electrodo donde se ve el átomo de Zn pasar a Zn²⁺.

**`estados-de-la-materia` · Estados de la materia y curva de calentamiento del agua** (6.º, P2)

- **Anclaje:** EBC 6.º–7.º, entorno físico: modelo de partículas y cambios de estado (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 6.º): «Materia, propiedades físicas, mezclas y métodos de separación».
- **Meta de aprendizaje:** Interpreta la curva de calentamiento del agua (mesetas en la fusión y la ebullición) con el modelo de partículas y calcula la energía de cada tramo.
- **Modelo científico y validación:** Q = m·c·ΔT y Q = m·L con c(hielo) ≈ 2,09, c(agua) ≈ 4,18 J/(g·K), L_f ≈ 334 J/g y L_v ≈ 2257 J/g (CRC Handbook; verificar cifras en la edición usada). Temperatura de ebullición con la altitud de Apartadó.
- **Vista 3D (obligatoria):** Caja 3D de moléculas de agua: red ordenada en el hielo, agregados móviles en el líquido y partículas libres en el vapor; la agitación sigue la temperatura y en las mesetas se ve que la energía rompe interacciones sin aumentar la agitación.

**`cambios-quimicos` · Cambios físicos y químicos: evidencias de una reacción** (7.º, P2)

- **Anclaje:** EBC 6.º–7.º, entorno físico: diferenciar cambios físicos y químicos (formulación propia, por verificar con el documento oficial).
- **Meta de aprendizaje:** Distingue cambios físicos de químicos por sus evidencias (gas, cambio de color, precipitado, cambio de temperatura) y relaciona el volumen de gas producido con la cantidad de reactivo.
- **Modelo científico y validación:** Bicarbonato + ácido acético → CO₂ (estequiometría y gas ideal); CaCl₂ + Na₂CO₃ → CaCO₃↓; solubilidades de tablas (CRC).
- **Vista 3D (obligatoria):** Reaction3D del kit químico: los mismos átomos se reorganizan en sustancias nuevas, frente a un cambio físico (disolver o fundir) en el que las moléculas no cambian; vaso 3D con burbujas o precipitado sincronizados.

**`termoquimica` · Termoquímica: calor de disolución y de neutralización** (10.º, P3)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos químicos): energía en los cambios químicos (formulación propia, por verificar con el documento oficial).
- **Meta de aprendizaje:** Mide con un calorímetro de vaso el calor de disolución de NaOH y NH₄NO₃ y el de neutralización, distingue procesos exotérmicos y endotérmicos y calcula ΔH por mol.
- **Modelo científico y validación:** q = m·c·ΔT; ΔH = −q/n; entalpía de neutralización de ácido y base fuertes del orden de −56 kJ/mol según tablas termoquímicas (verificar el valor en la fuente citada); ley de Hess.
- **Vista 3D (obligatoria):** Calorímetro 3D en corte: sistema (iones que se hidratan o se neutralizan) y entorno (agua) separados; partículas del agua cuya agitación aumenta o disminuye, con la flecha de energía en el sentido correcto.

### 4.2. Física (8 prácticas nuevas)

| Prioridad | id | Grado | Título | Ola |
|---|---|---|---|---|
| P1 | `electrostatica` | 11.º | Carga, ley de Coulomb y campo eléctrico | nuevas-1 · **construida (ola 1a)** |
| P2 | `magnetismo-imanes` | 7.º | Imanes, brújula y campo magnético | nuevas-2 |
| P2 | `lentes` | 9.º | Lentes, formación de imágenes y el ojo humano | nuevas-2 |
| P2 | `movimiento-circular` | 10.º | Movimiento circular uniforme y fuerza centrípeta | nuevas-2 |
| P3 | `gravitacion-orbitas` | 10.º | Gravitación universal, órbitas y leyes de Kepler | nuevas-3 |
| P3 | `fluidos-bernoulli` | 10.º | Fluidos en movimiento: continuidad y Bernoulli | nuevas-3 |
| P3 | `termodinamica` | 11.º | Primera ley de la termodinámica y máquinas térmicas | nuevas-3 |
| P3 | `efecto-doppler` | 11.º | Efecto Doppler y barrera del sonido | nuevas-3 |

**`electrostatica` (construida en la ola 1a; ver `src/curriculum/practices/electrostatica.ts`) · Carga, ley de Coulomb y campo eléctrico** (11.º, P1)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos físicos): interacción entre cargas y campo eléctrico (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 11.º): «Electricidad, circuitos y magnetismo».
- **Meta de aprendizaje:** Calcula fuerzas entre cargas con la ley de Coulomb, representa el campo y el potencial de distribuciones sencillas y explica la electrización por frotamiento e inducción.
- **Modelo científico y validación:** F = k·q₁·q₂/r² (k = 8,99 × 10⁹ N·m²/C²), superposición, E = F/q, V = k·q/r; validación con casos analíticos (dipolo, dos cargas iguales).
- **Vista 3D (obligatoria):** Cargas puntuales en el espacio con líneas de campo 3D y superficies equipotenciales; una carga de prueba que el estudiante mueve con el teclado o el ratón mide la fuerza. El 3D muestra que el campo no es plano y que las equipotenciales son superficies.

**`magnetismo-imanes` · Imanes, brújula y campo magnético** (7.º, P2)

- **Anclaje:** EBC 6.º–7.º, entorno físico: fuerzas a distancia y magnetismo (formulación propia, por verificar con el documento oficial).
- **Meta de aprendizaje:** Describe la interacción entre polos, traza el campo de un imán con una brújula y construye un electroimán cuya fuerza depende del número de espiras y de la corriente.
- **Modelo científico y validación:** Campo de un dipolo magnético (ya implementado y probado en el modelo de «induccion»); campo de un solenoide B = μ₀·n·I.
- **Vista 3D (obligatoria):** Imán de barra 3D con líneas de campo y una brújula que el estudiante mueve alrededor; la Tierra 3D con su campo y la brújula en Apartadó; el 3D muestra que el campo envuelve al imán y no solo el plano de la mesa.

**`lentes` · Lentes, formación de imágenes y el ojo humano** (9.º, P2)

- **Anclaje:** EBC 8.º–9.º, entorno físico: comportamiento de la luz e instrumentos ópticos (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 8.º): «Ondas, sonido y óptica».
- **Meta de aprendizaje:** Encuentra la distancia focal de una lente convergente en un banco óptico, predice posición y tamaño de la imagen y explica la corrección de la miopía y la hipermetropía.
- **Modelo científico y validación:** 1/f = 1/d_o + 1/d_i; aumento M = −d_i/d_o; potencia P = 1/f en dioptrías; validación con casos de manual (Hecht, Óptica).
- **Vista 3D (obligatoria):** Banco óptico 3D con vela, lente y pantalla movibles y los tres rayos principales; ojo 3D seccionado donde la imagen cae antes, sobre o después de la retina y se corrige con una lente.

**`movimiento-circular` · Movimiento circular uniforme y fuerza centrípeta** (10.º, P2)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos físicos): modelar movimientos y sus causas (formulación propia, por verificar con el documento oficial).
- **Meta de aprendizaje:** Mide período, frecuencia y rapidez en un movimiento circular, y comprueba que la fuerza necesaria es m·v²/r.
- **Modelo científico y validación:** v = 2πr/T, a_c = v²/r = ω²·r, F_c = m·v²/r; validación con casos calculados a mano.
- **Vista 3D (obligatoria):** Plataforma giratoria 3D con un objeto sujeto a una cuerda y un dinamómetro; vectores v (tangente) y a_c (hacia el centro); al cortar la cuerda el objeto sale por la tangente. Cámara desde arriba y desde un lado.

**`gravitacion-orbitas` · Gravitación universal, órbitas y leyes de Kepler** (10.º, P3)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos físicos): fuerza gravitacional y movimiento de los astros (formulación propia, por verificar con el documento oficial).
- **Meta de aprendizaje:** Relaciona el período de una órbita con su radio (tercera ley de Kepler), verifica con datos reales de los planetas y calcula la altura de un satélite geoestacionario.
- **Modelo científico y validación:** F = G·m₁·m₂/r²; T² = 4π²·a³/(G·M); datos de la NASA Planetary Fact Sheet con fecha de consulta; integración numérica de la órbita para las áreas barridas.
- **Vista 3D (obligatoria):** Sistema Sol–planeta y Tierra–satélite en 3D con órbitas elípticas, áreas barridas iguales coloreadas y vectores de velocidad y fuerza; inclinación de la órbita visible al girar la cámara.

**`fluidos-bernoulli` · Fluidos en movimiento: continuidad y Bernoulli** (10.º, P3)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos físicos): comportamiento de los fluidos (formulación propia, por verificar con el documento oficial).
- **Meta de aprendizaje:** Comprueba con un tubo de Venturi que la rapidez aumenta y la presión disminuye en un estrechamiento, y explica la sustentación y el atomizador.
- **Modelo científico y validación:** A₁·v₁ = A₂·v₂; p + ½·ρ·v² + ρ·g·h = constante (flujo ideal); validación con casos de manual.
- **Vista 3D (obligatoria):** Tubo de Venturi 3D transparente con líneas de corriente y partículas trazadoras que se aceleran en el estrechamiento; columnas manométricas que bajan donde la rapidez sube.

**`termodinamica` · Primera ley de la termodinámica y máquinas térmicas** (11.º, P3)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos físicos): conservación y transformación de la energía (formulación propia, por verificar con el documento oficial).
- **Meta de aprendizaje:** Aplica ΔU = Q − W a procesos de un gas en un cilindro y explica por qué ninguna máquina térmica alcanza el rendimiento de Carnot.
- **Modelo científico y validación:** ΔU = Q − W; P·V = n·R·T; procesos isotérmico, isobárico, isocórico y adiabático (P·V^γ = constante); η_Carnot = 1 − T_f/T_c.
- **Vista 3D (obligatoria):** Cilindro con émbolo 3D y partículas del gas (reutiliza la caja de «gases»), con fuente caliente y fría; el diagrama P–V se dibuja mientras el émbolo se mueve.

**`efecto-doppler` · Efecto Doppler y barrera del sonido** (11.º, P3)

- **Anclaje:** EBC 10.º–11.º, entorno físico (procesos físicos): fenómenos ondulatorios (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 11.º): «Ondas, óptica y fenómenos físicos».
- **Meta de aprendizaje:** Predice la frecuencia percibida cuando la fuente o el observador se mueven y explica la onda de choque cuando la fuente supera la rapidez del sonido.
- **Modelo científico y validación:** f' = f·(v ± v_o)/(v ∓ v_s); v ≈ 331,3 + 0,606·T m/s (ya en el modelo de «sonido»); ángulo del cono de Mach sen α = v/v_s.
- **Vista 3D (obligatoria):** Fuente móvil 3D que emite frentes de onda esféricos: se apiñan delante y se separan detrás; al superar la rapidez del sonido aparece el cono de Mach. El observador se puede ubicar en cualquier punto.

### 4.3. Biología (8 prácticas nuevas)

| Prioridad | id | Grado | Título | Ola |
|---|---|---|---|---|
| P1 | `sistema-circulatorio` | 7.º | Corazón y circulación: frecuencia cardíaca y ejercicio | nuevas-1 |
| P1 | `meiosis` | 8.º | Meiosis, entrecruzamiento y variabilidad genética | nuevas-1 |
| P1 | `sistema-nervioso` | 8.º | Sistema nervioso: neurona, arco reflejo y tiempo de reacción | nuevas-1 |
| P2 | `clasificacion-seres-vivos` | 6.º | Clasificación de los seres vivos con claves dicotómicas | nuevas-2 |
| P2 | `homeostasis-glucosa` | 10.º | Homeostasis: regulación de la glucosa por insulina y glucagón | nuevas-2 |
| P3 | `nutricion-digestion` | 7.º | Digestión: enzimas y pH a lo largo del tubo digestivo | nuevas-3 |
| P3 | `biotecnologia-pcr` | 10.º | Biotecnología: PCR y electroforesis en gel | nuevas-3 |
| P3 | `sistema-inmune` | 11.º | Sistema inmune, vacunas e inmunidad colectiva | nuevas-3 |

**`sistema-circulatorio` · Corazón y circulación: frecuencia cardíaca y ejercicio** (7.º, P1)

- **Anclaje:** EBC 6.º–7.º, entorno vivo: funciones de nutrición en los seres vivos (circulación) (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 7.º): «Nutrición, circulación, respiración y excreción».
- **Meta de aprendizaje:** Mide la frecuencia cardíaca en reposo y después de ejercicio, calcula el gasto cardíaco y explica la circulación doble y el papel de las válvulas.
- **Modelo científico y validación:** Gasto cardíaco = frecuencia cardíaca × volumen sistólico (≈ 5 L/min en reposo según Guyton y Hall); datos del estudiante con su consentimiento o datos de ejemplo rotulados.
- **Vista 3D (obligatoria):** Corazón 3D seccionable con las cuatro cavidades y válvulas; sangre oxigenada (roja) y desoxigenada (azul) animadas en la circulación pulmonar y sistémica; ritmo sincronizado con la frecuencia elegida.

**`meiosis` · Meiosis, entrecruzamiento y variabilidad genética** (8.º, P1)

- **Anclaje:** EBC 8.º–9.º, entorno vivo: reproducción y transmisión de características hereditarias (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 7.º): «Reproducción celular: introducción a mitosis y meiosis».
- **Meta de aprendizaje:** Compara mitosis y meiosis, explica cómo el entrecruzamiento y la segregación independiente generan variabilidad y relaciona la no disyunción con trisomías.
- **Modelo científico y validación:** 2ⁿ combinaciones por segregación independiente (n = 23 en humanos → 8 388 608); frecuencia de recombinación proporcional a la distancia entre genes (1 cM ≈ 1 %, Morgan).
- **Vista 3D (obligatoria):** Cromosomas homólogos 3D que se aparean, forman quiasmas e intercambian segmentos de color; el estudiante elige el punto de cruce y sigue las cuatro cromátidas hasta los gametos.

**`sistema-nervioso` · Sistema nervioso: neurona, arco reflejo y tiempo de reacción** (8.º, P1)

- **Anclaje:** EBC 8.º–9.º, entorno vivo: sistemas de coordinación y control (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 8.º): «Sistemas nervioso y endocrino».
- **Meta de aprendizaje:** Mide su propio tiempo de reacción con la regla que cae (dato real del estudiante), compara con un reflejo y explica el recorrido del impulso nervioso.
- **Modelo científico y validación:** t = √(2·d/g) para la regla que cae; rapidez de conducción de los axones según el tipo de fibra (rango de manual: Kandel y otros, Principios de neurociencia).
- **Vista 3D (obligatoria):** Neurona 3D (dendritas, soma, axón con mielina) con el potencial de acción viajando por el axón; arco reflejo en la médula con receptor, interneurona y músculo seleccionables.

**`clasificacion-seres-vivos` · Clasificación de los seres vivos con claves dicotómicas** (6.º, P2)

- **Anclaje:** EBC 6.º–7.º, entorno vivo: clasificación de organismos según sus características (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 6.º): «Clasificación básica de los seres vivos».
- **Meta de aprendizaje:** Usa y construye claves dicotómicas con organismos de la región y explica el sistema de tres dominios.
- **Modelo científico y validación:** Claves dicotómicas; sistema de tres dominios (Woese, Kandler y Wheelis, 1990). Especies de Urabá solo con registros verificables (p. ej., GBIF o SiB Colombia), sin datos inventados.
- **Vista 3D (obligatoria):** Ejemplares 3D simplificados (insecto, arácnido, anfibio, pez, helecho, planta con flor) que el estudiante gira para observar el carácter que pide la clave: simetría, segmentación, número de patas, presencia de flores.

**`homeostasis-glucosa` · Homeostasis: regulación de la glucosa por insulina y glucagón** (10.º, P2)

- **Anclaje:** EBC 10.º–11.º, entorno vivo: homeostasis y regulación en el organismo (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts): «Fisiología humana» (10.º) y «Fisiología humana, inmunología y homeostasis» (11.º).
- **Meta de aprendizaje:** Explica la retroalimentación negativa con una prueba de tolerancia a la glucosa simulada y compara la respuesta normal con la de diabetes tipo 1 y tipo 2.
- **Modelo científico y validación:** Modelo mínimo de Bergman (Bergman y otros, 1979) con parámetros publicados; criterios diagnósticos de glucemia de la American Diabetes Association (Standards of Care) citados con año.
- **Vista 3D (obligatoria):** Insulina 3D (PDB 3I40, ya en el repo) con cadenas A y B y puentes disulfuro, en 3Dmol; esquema 3D de páncreas–hígado–músculo con flechas de glucosa e insulina que siguen el modelo.

**`nutricion-digestion` · Digestión: enzimas y pH a lo largo del tubo digestivo** (7.º, P3)

- **Anclaje:** EBC 6.º–7.º, entorno vivo: funciones de nutrición en los seres vivos (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 7.º): «Nutrición, circulación, respiración y excreción».
- **Meta de aprendizaje:** Relaciona cada órgano del tubo digestivo con sus enzimas y su pH, y predice qué nutrientes se digieren en cada tramo.
- **Modelo científico y validación:** Óptimos de pH de amilasa salival, pepsina y tripsina de manuales de bioquímica (citados); reutiliza la curva de actividad enzimática del modelo de «enzimas».
- **Vista 3D (obligatoria):** Tubo digestivo 3D recorrible (boca → estómago → intestino) con el pH coloreado y el alimento que se transforma; órganos seleccionables con su función.

**`biotecnologia-pcr` · Biotecnología: PCR y electroforesis en gel** (10.º, P3)

- **Anclaje:** EBC 10.º–11.º, entorno vivo y CTS: aplicaciones de la biología molecular (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 10.º): «Biotecnología y aplicaciones de la biología molecular».
- **Meta de aprendizaje:** Explica las etapas de la PCR, calcula el número de copias tras n ciclos y estima el tamaño de un fragmento a partir de un gel con marcador.
- **Modelo científico y validación:** N = N₀·(1 + E)ⁿ; migración en gel aproximadamente lineal con el logaritmo del tamaño en el rango del gel (Sambrook y Russell, Molecular Cloning).
- **Vista 3D (obligatoria):** Doble hélice 3D (reutiliza la de «adn») que se desnaturaliza, recibe los cebadores y se extiende en cada ciclo; gel 3D con pozos y bandas que migran.

**`sistema-inmune` · Sistema inmune, vacunas e inmunidad colectiva** (11.º, P3)

- **Anclaje:** EBC 10.º–11.º, entorno vivo y CTS: defensa del organismo y salud pública (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 11.º): «Fisiología humana, inmunología y homeostasis».
- **Meta de aprendizaje:** Explica la especificidad antígeno–anticuerpo y la memoria inmunológica, y usa un modelo SIR para estimar el umbral de inmunidad colectiva.
- **Modelo científico y validación:** Modelo SIR (Kermack y McKendrick, 1927); umbral de inmunidad colectiva 1 − 1/R₀ (Anderson y May). Sin datos epidemiológicos inventados: valores de R₀ de fuentes citadas o rotulados como ilustrativos.
- **Vista 3D (obligatoria):** Anticuerpo IgG 3D en 3Dmol (estructura del PDB por descargar con procedencia y SHA-256) con los sitios de unión resaltados; el antígeno «encaja» solo en el sitio complementario.

### 4.4. Ambiental (2 prácticas nuevas)

| Prioridad | id | Grado | Título | Ola |
|---|---|---|---|---|
| P2 | `efecto-invernadero` | 11.º | Balance de energía de la Tierra y efecto invernadero | nuevas-2 |
| P3 | `ciclo-del-carbono` | 7.º | Ciclo del carbono: reservorios y flujos | nuevas-3 |

**`efecto-invernadero` · Balance de energía de la Tierra y efecto invernadero** (11.º, P2)

- **Anclaje:** EBC 10.º–11.º, CTS y entorno físico: cambio climático y sus causas (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 11.º): «Ecología, biodiversidad, contaminación y cambio climático».
- **Meta de aprendizaje:** Calcula la temperatura de equilibrio de la Tierra sin atmósfera y con una capa absorbente, y explica el efecto de aumentar la absorción infrarroja.
- **Modelo científico y validación:** Ley de Stefan–Boltzmann; T = [S·(1 − α)/(4·σ)]^¼ ≈ 255 K con S ≈ 1361 W/m² (Kopp y Lean, 2011) y α ≈ 0,30; modelo de una capa (Archer, Global Warming: Understanding the Forecast).
- **Vista 3D (obligatoria):** Tierra 3D iluminada por el Sol: la sombra que proyecta es un disco (πR²) mientras la superficie que emite es la esfera (4πR²); de ahí el factor 4. Capa atmosférica 3D que absorbe y reemite infrarrojo.

**`ciclo-del-carbono` · Ciclo del carbono: reservorios y flujos** (7.º, P3)

- **Anclaje:** EBC 6.º–7.º, entorno vivo y CTS: ciclos biogeoquímicos (formulación propia, por verificar con el documento oficial). Malla institucional (grades.ts, 7.º): «Relaciones ecológicas y ciclos biogeoquímicos».
- **Meta de aprendizaje:** Representa el ciclo del carbono como reservorios y flujos, y predice qué cambia al aumentar la quema de combustibles o la deforestación.
- **Modelo científico y validación:** Modelo de cajas con reservorios y flujos de la figura del ciclo global del carbono del IPCC AR6, GT I, cap. 5 (cifras por transcribir con la fuente a la vista; no se inventan).
- **Vista 3D (obligatoria):** Paisaje 3D (bosque, suelo, océano, atmósfera, yacimiento fósil) donde el volumen de cada reservorio es proporcional al carbono que contiene y las flechas de flujo tienen grosor proporcional.

### 4.5. Resumen

| Área | P1 | P2 | P3 | Total | Grados |
|---|---|---|---|---|---|
| Química | 5 | 2 | 1 | 8 | 6.º, 7.º (2), 8.º, 9.º, 10.º (2), 11.º |
| Física | 1 | 3 | 4 | 8 | 7.º, 9.º, 10.º (3), 11.º (3) |
| Biología | 3 | 2 | 3 | 8 | 6.º, 7.º (2), 8.º (2), 10.º (2), 11.º |
| Ambiental | 0 | 1 | 1 | 2 | 7.º, 11.º |
| **Total** | **9** | **8** | **9** | **26** | |

Con las 26, el catálogo pasaría a 91 prácticas: química 28 (9 en 6.º–9.º), física 31 (13 en 10.º–11.º), biología 24,
ambiental 8.

## 5. Mejoras a prácticas existentes (priorizadas)

| # | Prioridad | Práctica(s) | Mejora concreta | Motivo |
|---|---|---|---|---|
| M1 | Alta | todas (`curricularLink`) | Unificar la referencia de los Estándares: «MEN (2004)» o «MEN (2006)», con una nota que explique la elección; hoy conviven las dos. | Coherencia; `pendulo` y `descomposicion` citan 2004, las otras 63 citan 2006. |
| M2 | Alta | todas | Añadir a `curricularLink` campos estructurados: `gradeGroup` («6–7», «8–9», «10–11»), `entorno` (vivo, físico-químico, físico-físico, CTS) y `dbaVerified: boolean`; generar la matriz de la sección 3 automáticamente y enlazarla con la validación docente (`src/lib/validation.ts`). | Hoy el entorno solo está en texto libre; `ecosistema` y `redes` figuran como «ambiental» siendo entorno vivo. |
| M3 | Alta | `ph` | Cumplir lo que anuncia la nota de `acidos-sales`: añadir soluciones amortiguadoras (Henderson–Hasselbalch, capacidad amortiguadora) o corregir esa nota. | El modelo `acidbase.ts` declara que no incluye soluciones amortiguadoras. |
| M4 | Alta | `estequiometria` (11.º) vs `conservacion` (8.º) y `mol` (9.º) | Reenfocar `estequiometria` en lo que no repiten las otras: pureza de reactivos, rendimiento real frente a teórico, reacciones consecutivas y un caso industrial; añadir manipulación directa. | Reactivo limitante aparece en 8.º y en 11.º con el mismo enfoque. |
| M5 | Alta | `conductores` y `circuitos-simples` (ambas 7.º) | Encadenarlas (conductores → circuitos) o fusionarlas; si se fusionan, liberar el espacio de 7.º para `magnetismo-imanes`. | Contenido solapado en el mismo grado. |
| M6 | Media | `ondas` y `sonido` (ambas 8.º) | Reorientar `ondas` a ondas mecánicas en general (cuerda y cubeta: reflexión, superposición, ondas estacionarias) y dejar el sonido a `sonido`; dar sonido e instrumento real a `ondas`. | Solapamiento parcial; `ondas` no tiene sonido ni instrumento real. |
| M7 | Media | `optica` | Añadir prisma y dispersión (índice según la longitud de onda) y enlazar con la práctica nueva `lentes`. | No trata dispersión ni lentes; es de los laboratorios más pequeños (200 líneas). |
| M8 | Media | `mezclas` | Añadir cromatografía en papel y destilación simple; manipulación directa de los montajes. | Sin manipulación directa ni instrumento real; faltan dos métodos de separación habituales. |
| M9 | Media | `mitosis`, `mendel` | Enlazar con la práctica nueva `meiosis`; en `mendel`, mostrar los cromosomas y los loci de los alelos (con la vista 3D de los lotes). | La relación cromosomas–alelos queda implícita. |
| M10 | Media | `popgen`, `poblacion`, `redes`, `seleccion`, `adn`, `choques`, `cinematica` | Añadir manipulación directa (arrastrar, perillas) con alternativa por teclado, como en el resto del catálogo (32 de 65 ya la tienen). | Según `docs/v2/INVENTARIO.md`, no la tienen. |
| M11 | Media | `poblacion` | Revisar el grado: la malla institucional ubica la dinámica de poblaciones en 9.º; ofrecer un modo básico para 9.º y conservar el avanzado en 11.º. | La malla de 9.º queda solo parcialmente cubierta. |
| M12 | Baja | `gases`, `energia` | Confirmar si se cerraron los pendientes de la Fase 3 de `docs/AUDITORIA.md` (presión inicial fija de la jeringa; pista sin h = 10 m) y actualizar la auditoría. | Constan como «Pendiente (Fase 3)». |
| M13 | Baja | `celulas` | Añadir un nivel de organización (tejido vegetal y epitelio) para cubrir «Célula y organización de los seres vivos». | La malla de 6.º lo pide. |
| M14 | Baja | `scripts/inventario.mjs` | Revisar el detector de pruebas axe (reporta 0). | Contradice `docs/AUDITORIA.md`. |

## 6. Plan 3D para todas las prácticas

### 6.1. Principios (obligatorios para cada vista 3D)

- **El 3D tiene que enseñar algo**: orientación espacial, estructura que no se ve en 2D, vectores en el espacio, campos o
  partículas. Cuando el valor 3D es bajo se dice (p. ej., `popgen`) y la escena se hace simple.
- **Las magnitudes de la escena salen del mismo modelo validado** que la simulación 2D (nunca de una animación aparte):
  el 3D es otra vista del mismo estado.
- **Carga diferida:** el motor 3D se descarga solo al abrir la vista 3D (como 3Dmol hoy en `src/chem/engine3d.ts`); no
  entra en el JS inicial ni en el presupuesto de `npm run perf`. El service worker lo precarga en segundo plano, salvo
  ahorro de datos (como ya se hace con los visores actuales).
- **Equipos escolares modestos:** geometría de pocos polígonos, instanciado para partículas (≤ 500 en caja de partículas),
  sin sombras dinámicas por defecto, `devicePixelRatio` limitado a 1,5, render a demanda (sin bucle cuando no hay
  animación) y pausa cuando la pestaña no es visible. Botón «calidad baja».
- **Siempre con respaldo:** sin WebGL o si falla la carga, vista 2D/SVG con la misma información (el patrón actual
  «sin-webgl / no-disponible / reintentar»).
- **Accesibilidad:** descripción textual viva de la escena (`aria-describedby`, `role="img"`), control completo por
  teclado (girar, acercar, seleccionar el siguiente objeto, activar), foco visible, `prefers-reduced-motion` (animaciones
  paso a paso en vez de continuas), contraste en tema claro y oscuro, rótulos de «modelo ilustrativo» cuando corresponda.
- **Pruebas:** prueba unitaria de que la escena refleja el estado del modelo (p. ej., la longitud del vector = valor del
  modelo), E2E con la vista de respaldo y axe en ambos temas; en la regresión visual, enmascarar el lienzo 3D como ya se
  hace con la geometría molecular.

### 6.2. Prácticas con 3D hoy (11)

`geometria`, `proteinas`, `acidos-sales`, `oxidos-hidroxidos`, `nomenclatura-inorganica`, `aromaticos`, `hidrocarburos`,
`nomenclatura-organica`, `grupos-nitrogenados`, `grupos-oxigenados`, `reacciones-organicas`. No requieren trabajo nuevo
para cumplir el pedido; solo revisar que cumplan el teclado y la descripción textual de 6.1.

### 6.3. Lotes para las 54 prácticas sin 3D

Orden: el **lote 1** va primero porque no depende del kit general (usa el kit químico y 3Dmol con estructuras que ya están
en el repositorio: 2LZM, 2HHB, AlphaFold de OCA2) y da resultados inmediatos en química y biología molecular. Del lote 2 en
adelante, el orden sigue el valor pedagógico del 3D: primero lo invisible o espacial (biología celular, campos,
partículas), después mecánica y ondas, y al final los temas en que el 3D aporta menos (ecología y datos). Complejidad:
S ≈ 1–2 días, M ≈ 3–5 días, L ≈ más de una semana (estimación para una persona, incluidas pruebas).

#### Lote 3D-1 · Química y biomoléculas con lo que ya existe (kit químico y 3Dmol) (8 prácticas) — hecho

| Práctica | Grado | Escena 3D propuesta (qué ve y manipula el estudiante) | Tecnología | Complejidad | Prioridad |
|---|---|---|---|---|---|
| `balanceo` Balanceo de ecuaciones químicas con conteo de átomos | 8.º | Reacción 3D (Reaction3D) donde cada coeficiente añade o quita moléculas reales y un contador por elemento compara átomos a cada lado; los átomos se reordenan, no aparecen ni desaparecen. | Kit químico 3D (src/chem: Molecule3D/Reaction3D/Crystal3D sobre 3Dmol.js) | S | 1 |
| `conservacion` Conservación de la masa en sistemas abiertos y cerrados | 8.º | Recipiente cerrado y abierto en 3D con Reaction3D dentro: en el abierto se ve escapar el CO₂ y la balanza baja; en el cerrado la masa se mantiene. Reactivo limitante visible como moléculas sobrantes. | Kit químico 3D (src/chem: Molecule3D/Reaction3D/Crystal3D sobre 3Dmol.js) + kit general para el recipiente | M | 1 |
| `estequiometria` Estequiometría y reactivo limitante | 11.º | Reaction3D a escala de «paquetes» de moléculas: el reactivo en exceso queda sin reaccionar y se cuenta; el rendimiento real se muestra como moléculas que no llegaron a producto. | Kit químico 3D (src/chem: Molecule3D/Reaction3D/Crystal3D sobre 3Dmol.js) | S | 2 |
| `mol` Cálculos estequiométricos básicos | 9.º | Comparador 3D de «1 mol» de sustancias (agua, NaCl, Fe, sacarosa) como volúmenes a escala en un vaso, más una ampliación a moléculas: conecta masa molar, densidad y número de partículas. | Kit químico 3D (src/chem: Molecule3D/Reaction3D/Crystal3D sobre 3Dmol.js) + kit general | M | 2 |
| `soluciones` Preparación de soluciones, molaridad y colorimetría | 10.º | Disolución de NaCl en 3D: iones Na⁺ y Cl⁻ rodeados por moléculas de agua orientadas (capa de hidratación); el número de iones en un volumen fijo cambia con la molaridad y la dilución. | Kit químico 3D (src/chem: Molecule3D/Reaction3D/Crystal3D sobre 3Dmol.js) | M | 2 |
| `enzimas` Actividad enzimática: temperatura, pH y concentración | 10.º | Lisozima de T4 (PDB 2LZM, ya en el repo) con el sitio activo resaltado; deslizador de temperatura que aumenta el factor B / la agitación para explicar la desnaturalización (indicada como modelo cualitativo). | 3Dmol.js con estructura PDB ya incluida en el repo | S | 1 |
| `expresion` Expresión génica y efecto de mutaciones en la proteína | 11.º | Hemoglobina (PDB 2HHB, ya en el repo) con la posición 6 de la cadena β resaltada: el estudiante liga la mutación del codón con el cambio de residuo en la proteína plegada. | 3Dmol.js con estructura PDB ya incluida en el repo | S | 1 |
| `rastreo` Rastreo génico: del gen a la proteína y su función | 11.º | Estructura 3D del producto del gen rastreado (2HHB o el modelo AlphaFold de OCA2 ya incluido) con la variante marcada y su confianza (pLDDT). | 3Dmol.js con estructura PDB ya incluida en el repo | S | 2 |

**Estado del lote 3D-1: hecho (2026-11-01).** Cada práctica tiene una tarjeta «Vista 3D» que se abre a pedido (el código
de la vista y 3Dmol.js se descargan solo entonces), con respaldo SVG sin WebGL, giro con ratón, dedo y teclado
(flechas, + y −, Inicio), descripción textual viva y sin desbordamiento a 390 px. Código: `src/labs/lote3d/` (vistas y
correspondencias puras `mappings.ts` y `scenes.ts`), `src/chem/SpeciesScene3D.tsx` y `src/chem/sceneLayout.ts` (escena
de varias especies del kit). Pruebas: `tests/unit/lote3d.test.ts` y `tests/e2e/visor3d-lote1.spec.ts`.

| Práctica | Qué muestra la vista 3D (implementado) | Desviación respecto de la propuesta |
|---|---|---|
| `balanceo` | Una copia 3D por unidad de cada coeficiente (reactivos a la izquierda, productos a la derecha), tabla de átomos contados en la escena sincronizada con los coeficientes, resaltado del elemento elegido o de la pista; con la ecuación balanceada, la reacción animada (Reaction3D). | Reaction3D exige ecuación balanceada: con coeficientes erróneos se muestran las moléculas y el desbalance, no la animación. El ion acetato no tiene confórmero propio: se obtiene del confórmero del ácido acético quitando el H del –COOH (rotulado como ilustración). |
| `conservacion` | Recipiente (aristas; sin tapa si es abierto) con partículas en la proporción de las cantidades del laboratorio y el avance de su reacción; el CO₂ que sale (o el O₂ que entra) cruza el borde y un contador suma las masas atómicas de lo que queda adentro; reactivo sobrante visible. | Recipiente con aristas del kit químico (sin kit general). La pastilla efervescente se dibuja con la ecuación iónica neta HCO₃⁻ + H₃O⁺ → 2 H₂O + CO₂: no hay geometría del ácido cítrico ni del citrato en el repositorio. |
| `estequiometria` | Antes / después a escala de paquetes (la mayor cantidad = 4 unidades de reacción, el limitante se consume entero, la regla n/ν del modelo); exceso que sobra y, atenuado, el reactivo que no llegó a producto por el rendimiento; tabla de átomos antes y después. | Escena estática antes/después en lugar de Reaction3D animada (la animación no admite sobrantes). |
| `mol` | «Contar pesando»: la entidad que se cuenta (molécula, unidad fórmula o átomo) con su masa en u y la tabla de una entidad a la muestra leída; «Reacción»: Reaction3D de la ecuación en moles. | Sin comparador de volúmenes de 1 mol (necesita el kit general y densidades que el modelo no tiene). La sacarosa no tiene confórmero en el repositorio: se dice y solo se cuenta su composición; los metales se dibujan como átomo aislado (no hay redes metálicas en el kit). |
| `soluciones` | Capa de hidratación (6 aguas de PubChem en octaedro a la suma de radios de Shannon; O hacia el catión, H hacia el anión) y cubo de 5 nm con N = c·N_A·V unidades del soluto (madre o diluida). | El Cu²⁺ no tiene radio iónico en la tabla del kit y los iones poliatómicos no se orientan con esta regla: para CuSO₄ se muestra la capa del NaCl como ejemplo (opción también para KMnO₄). Las aguas del cubo no se dibujan. |
| `enzimas` | Lisozima del fago T4 (2LZM) con Glu11 y Asp20 marcados; cinta por sitio activo o por factor B medido; la fracción nativa del modelo de la enzima elegida (temperatura) aclara la cinta y el factor de pH se informa. | La enzima del laboratorio (amilasa, pepsina, catalasa) no tiene estructura en el repositorio: la lisozima es una enzima modelo, rotulada así. La «agitación» no se anima (sería inventada): se muestra el factor B medido y la fracción nativa del mismo modelo. |
| `expresion` | Hemoglobina 2HHB con las cadenas β (gen HBB) en azul: el codón elegido o mutado se marca como residuo β(c − 1) en las dos cadenas β; mutaciones sin sentido o de corrimiento atenúan lo que ya no se fabricaría. | Ninguna. |
| `rastreo` | Producto del gen con estructura incluida: HBB → 2HHB, INS → 3I40 (cadenas B = codones 25–54 y A = 90–110) y OCA2 → modelo de AlphaFold coloreado por pLDDT, con la variante analizada marcada (y su pLDDT). | LCT y lacZ no tienen estructura en el repositorio: se dice, sin descargar nada. En 3I40 el residuo B30 es Ala (el archivo lo declara frente a UniProt): se avisa si la variante cae ahí. |

Nota técnica: en 3Dmol.js las formas translúcidas no se dibujan en todos los motores de WebGL (se comprobó con
SwiftShader), así que lo atenuado mezcla su color con el del fondo y lo resaltado lleva una malla de alambre.

#### Lote 3D-2 · Biología: lo que no se ve a simple vista (8 prácticas)

| Práctica | Grado | Escena 3D propuesta (qué ve y manipula el estudiante) | Tecnología | Complejidad | Prioridad |
|---|---|---|---|---|---|
| `celulas` Microscopio virtual: células animales y vegetales | 6.º | Célula animal y vegetal 3D con organelos seleccionables (núcleo, mitocondria, cloroplasto, vacuola, pared); corte con un plano que reproduce lo que se ve al microscopio en 2D. | Kit general de escenas 3D (three.js, en construcción en paralelo) | L | 1 |
| `osmosis` Difusión y ósmosis a través de la membrana | 7.º | Bicapa lipídica 3D con acuaporinas: moléculas de agua y de soluto a ambos lados; el flujo neto y el volumen de la célula responden a la concentración. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `mitosis` Mitosis al microscopio: fases e índice mitótico | 7.º | Cromosomas 3D (cromátidas hermanas, centrómero) y huso mitótico en cada fase; el estudiante gira la célula para ver la placa metafásica de frente y de perfil. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `adn` Del ADN a la proteína: replicación, transcripción y traducción | 9.º | Doble hélice 3D (modelo de fibra del ADN-B) con apertura de la horquilla de replicación, ARN polimerasa y ribosoma esquemático; cada base se puede seleccionar. | Kit general de escenas 3D (three.js, en construcción en paralelo) o 3Dmol con coordenadas de ADN-B generadas | L | 1 |
| `extraccion-adn` Modelo interactivo de ADN y complementariedad | 8.º | La misma doble hélice 3D: surcos mayor y menor, antiparalelismo (extremos 5′ y 3′) y puentes de hidrógeno A–T (2) y G–C (3) contados al seleccionar pares. | Kit general de escenas 3D (three.js, en construcción en paralelo) (reutiliza la hélice de «adn») | S | 2 |
| `mendel` Herencia mendeliana y cuadros de Punnett | 8.º | Par de cromosomas homólogos 3D con los loci de los alelos; en el dihíbrido, dos pares en cromosomas distintos que se separan de forma independiente al formar gametos. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `fotosintesis` Fotosíntesis: luz, CO₂ y temperatura | 10.º | Hoja en corte 3D → cloroplasto con tilacoides y estroma; flechas de luz, CO₂ y O₂ cuyo grosor sigue la tasa calculada por el modelo. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `respiracion` Respiración celular y balance energético | 10.º | Mitocondria 3D con crestas seleccionables: glucólisis en el citoplasma, ciclo de Krebs en la matriz y cadena de transporte en la membrana interna, con el balance de ATP por etapa. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |

#### Lote 3D-3 · Mecánica (8 prácticas)

| Práctica | Grado | Escena 3D propuesta (qué ve y manipula el estudiante) | Tecnología | Complejidad | Prioridad |
|---|---|---|---|---|---|
| `pendulo` Péndulo simple y movimiento armónico | 10.º | Péndulo 3D en el soporte universal con vector velocidad, componente tangencial del peso y barras de energía cinética y potencial; cámara lateral y superior (muestra que el movimiento es plano). | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 1 |
| `proyectiles` Movimiento de proyectiles | 10.º | Lanzamiento en 3D con la trayectoria, su sombra en el suelo y los vectores vₓ (constante) y v_y (cambia); vista lateral para comparar con la gráfica. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 1 |
| `newton` Leyes de Newton: fuerza, masa y aceleración | 9.º | Bloque sobre una superficie o en un plano con diagrama de cuerpo libre 3D (peso, normal, fricción, fuerza aplicada) que cambia de tamaño con los controles. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 1 |
| `choques` Choques y cantidad de movimiento | 10.º | Riel de aire 3D con dos carritos, vectores de cantidad de movimiento antes y después, y vista de cámara que viaja con el centro de masa. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 2 |
| `energia` Conservación de la energía mecánica | 10.º | Pista 3D (montaña rusa) con la esfera rodando y barras de Ec, Ep y energía disipada siempre visibles; la altura de la pista se lee en 3D. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `trabajo` Trabajo, potencia y plano inclinado | 9.º | Plano inclinado 3D con el bloque, la fuerza aplicada y el desplazamiento; el área «fuerza × distancia» se muestra como superficie para comparar rutas. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 2 |
| `maquinas` Máquinas simples: palancas y poleas | 6.º | Palanca y polipasto 3D: al tirar de la cuerda se ve cuánto sube la carga y cuánta cuerda se recoge (ventaja mecánica = relación de distancias). | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `cinetica-potencial` Energía cinética y energía potencial | 8.º | Torre de caída y resorte 3D con fotopuertas: la esfera atraviesa los sensores y el resorte se comprime; barras de ½mv², mgh y ½kx². | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 3 |

#### Lote 3D-4 · Electricidad, campos y partículas (8 prácticas)

| Práctica | Grado | Escena 3D propuesta (qué ve y manipula el estudiante) | Tecnología | Complejidad | Prioridad |
|---|---|---|---|---|---|
| `circuitos-simples` Circuitos simples con baterías, interruptores y bombillas | 7.º | Circuito 3D sobre la mesa con pilas, interruptores y bombillos; electrones animados (rapidez de deriva exagerada y rotulada) y bombillos que brillan según la potencia. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `circuitos` Circuitos eléctricos: voltaje, corriente y resistencia | 11.º | Circuito 3D con un «paisaje de potencial»: la altura de cada tramo es el voltaje, las caídas en las resistencias se ven como bajadas; corriente como flujo de partículas. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `conductores` Materiales conductores y aislantes | 7.º | Fragmento 3D de red cristalina de un metal con electrones libres frente a un aislante con electrones ligados; la corriente aparece solo en el conductor. | Kit general de escenas 3D (three.js, en construcción en paralelo) (Crystal3D para las redes) | S | 2 |
| `induccion` Magnetismo e inducción electromagnética | 11.º | Imán, bobina y líneas de campo 3D; al mover el imán cambia el número de líneas que atraviesan la espira (flujo) y se ve el sentido de la corriente inducida (Lenz). | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `gases` Leyes de los gases: presión, volumen y temperatura | 10.º | Caja de partículas 3D con émbolo: la rapidez de las partículas sigue la temperatura, los choques contra las paredes dan la presión; el volumen cambia al mover el émbolo. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `cinetica` Factores que afectan la velocidad de reacción | 10.º | Choques moleculares 3D: solo los choques con energía y orientación suficientes reaccionan; la temperatura cambia la distribución de rapideces y el catalizador baja la barrera. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `equilibrio` Equilibrio químico y principio de Le Châtelier | 11.º | Recipiente 3D con N₂O₄ ⇌ 2 NO₂ (u otro sistema del modelo): reacciones directa e inversa ocurriendo a la vez; al perturbar se ve el desplazamiento y el color cambia. | Kit general de escenas 3D (three.js, en construcción en paralelo) + especies de src/chem | M | 2 |
| `ph` pH, dilución y neutralización ácido-base | 11.º | Vista molecular 3D de la solución: H₃O⁺ y OH⁻ contados en un volumen fijo, que cambia al diluir y al neutralizar en la titulación. | Kit químico 3D (src/chem: Molecule3D/Reaction3D/Crystal3D sobre 3Dmol.js) + kit general | S | 3 |

#### Lote 3D-5 · Ondas, luz y fluidos (7 prácticas)

| Práctica | Grado | Escena 3D propuesta (qué ve y manipula el estudiante) | Tecnología | Complejidad | Prioridad |
|---|---|---|---|---|---|
| `ondas` Laboratorio de ondas: frecuencia, amplitud y longitud de onda | 8.º | Superficie de agua 3D (cubeta de ondas) con una o dos fuentes; frecuencia y amplitud controlables; frentes de onda y longitud de onda medibles con una regla en la escena. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `sonido` Sonido y resonancia | 8.º | Tubo de resonancia 3D con las partículas de aire oscilando y la presión coloreada; nodos y antinodos en tubos abiertos y cerrados. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `optica` Reflexión y refracción de la luz | 8.º | Rayos 3D en un bloque de vidrio, un prisma y una fibra óptica (reflexión total interna); el estudiante mueve el láser en el espacio. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `interferencia` Interferencia y difracción de la luz | 11.º | Doble rendija 3D: frentes de onda que salen de cada rendija, superposición y pantalla con el patrón; se cambia λ y la separación. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `presion` Presión en líquidos y presión atmosférica | 7.º | Columna de agua 3D con orificios a distintas alturas (chorros de Torricelli) y manómetro; la presión se colorea con la profundidad. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 2 |
| `flotacion` Empuje y flotación: principio de Arquímedes | 7.º | Bloque 3D en un recipiente con línea de flotación, volumen desalojado y vectores de peso y empuje; densímetro en líquidos de distinta densidad. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 2 |
| `densidad` Medición de masa, volumen y densidad | 6.º | Cubos 3D de distintos materiales en la balanza y en la probeta (desplazamiento de agua); comparación visual de tamaños a igual masa. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 3 |

#### Lote 3D-6 · Materia, calor, movimiento y evolución (6.º–9.º) (7 prácticas)

| Práctica | Grado | Escena 3D propuesta (qué ve y manipula el estudiante) | Tecnología | Complejidad | Prioridad |
|---|---|---|---|---|---|
| `mezclas` Separación de mezclas: filtración, decantación, imantación y evaporación | 6.º | Montaje 3D: embudo con papel de filtro, imán, embudo de decantación y cápsula de evaporación; las partículas de cada componente van a su lugar según la técnica. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `calor` Calor, temperatura y equilibrio térmico | 6.º | Calorímetro 3D en corte con dos cuerpos y partículas cuya agitación sigue la temperatura; flecha de energía del cuerpo caliente al frío hasta el equilibrio. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 2 |
| `conduccion` Transferencia de calor por conducción | 7.º | Barra 3D con mapa de color de la temperatura que evoluciona con la ley de Fourier; comparación lado a lado de materiales. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 2 |
| `movimiento` Movimiento y distancia recorrida | 6.º | Pista 3D con el móvil, marcas de distancia y cámara superior; desplazamiento frente a distancia recorrida en un recorrido de ida y vuelta. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 3 |
| `cinematica` Velocidad, aceleración y movimiento | 9.º | Carro 3D en una pista con las gráficas x–t y v–t sincronizadas; vectores de velocidad y aceleración sobre el carro. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 3 |
| `seleccion` Selección natural con cambios ambientales | 9.º | Suelo 3D (claro, oscuro, volcánico) con presas de distinto color vistas desde el punto de vista del depredador: muestra por qué el camuflaje cambia la supervivencia. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `popgen` Genética de poblaciones y frecuencias alélicas | 11.º | Dos poblaciones 3D en un paisaje con individuos coloreados por genotipo y migrantes que cruzan (flujo génico). Valor 3D bajo: hacerlo simple. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 3 |

#### Lote 3D-7 · Ecología, ambiente y datos (8 prácticas)

| Práctica | Grado | Escena 3D propuesta (qué ve y manipula el estudiante) | Tecnología | Complejidad | Prioridad |
|---|---|---|---|---|---|
| `ecosistema` Ecosistema: agua, luz y alimento | 6.º | Frasco cerrado 3D (ecosistema) con plantas, caracoles y descomponedores; flechas de O₂, CO₂ y energía cuyo grosor sigue el modelo; luz encendida o apagada. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 1 |
| `redes` Cadenas y redes alimentarias | 6.º | Red trófica 3D en niveles (productores abajo); al quitar una especie se ve la cascada; pirámide de biomasa con volúmenes proporcionales. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `descomposicion` Factores de la descomposición de la materia orgánica | 7.º | Compostera 3D en corte con capas, humedad y temperatura coloreadas, y organismos descomponedores; la masa del residuo baja según el modelo. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 3 |
| `agua` Contaminación del agua e indicadores fisicoquímicos y biológicos | 11.º | Tramo de río 3D aguas abajo del vertimiento con el oxígeno disuelto coloreado (curva de Streeter–Phelps) y puntos de muestreo de macroinvertebrados. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 2 |
| `poblacion` Crecimiento poblacional y capacidad de carga | 11.º | Superficie 3D del rendimiento sostenible en función del tamaño de la población y del esfuerzo de pesca: muestra el máximo y el riesgo de sobreexplotación. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 3 |
| `reto` Reto de indagación con interpretación de datos | 11.º | Gráfico de dispersión 3D (dos variables independientes y una respuesta) que se puede girar para detectar confusión entre variables; útil para diseño multifactorial. | Kit general de escenas 3D (three.js, en construcción en paralelo) | S | 3 |
| `metabolismo` Metabolismo celular: análisis de balance de flujos (FBA) | 11.º | Célula de E. coli 3D esquemática con compartimentos y flechas de flujo cuyo grosor sigue el resultado del FBA. Valor 3D moderado. | Kit general de escenas 3D (three.js, en construcción en paralelo) | M | 3 |
| `secuencias` Secuencias biológicas: análisis y alineamiento | 11.º | Conservación del alineamiento coloreada sobre la estructura 3D (2HHB): los residuos conservados se agrupan en el núcleo de la proteína. | 3Dmol.js con estructura PDB ya incluida en el repo | S | 2 |

### 6.4. Prácticas nuevas y 3D

Cada práctica nueva incluye su vista 3D desde el primer día (campo `view3d` del JSON). Componentes que se reutilizan y
conviene construir una sola vez en el kit general: **caja de partículas** (`gases`, `cinetica`, `equilibrio`,
`estados-de-la-materia`, `termodinamica`, `calor`), **doble hélice** (`adn`, `extraccion-adn`, `biotecnologia-pcr`),
**cromosomas** (`mitosis`, `mendel`, `meiosis`), **líneas de campo** (`induccion`, `electrostatica`, `magnetismo-imanes`),
**rayos de luz** (`optica`, `lentes`), **frentes de onda** (`ondas`, `interferencia`, `efecto-doppler`) y **vectores con
barras de energía** (toda la mecánica).

## 7. Próximos pasos

1. El docente valida o corrige los DBA con el documento oficial en el panel docente; con esos datos se pasa
   `anchorVerified` a `true` y se reemplaza la «formulación propia» por el texto oficial.
2. Implementar M1–M5 (cambios pequeños de datos y textos).
3. ~~Lote 3D-1~~ (hecho el 2026-11-01, ver §6.3); sigue la ola `nuevas-1` (química básica, electrostática y fisiología).
4. Al terminar el kit general de escenas 3D, seguir con los lotes 2 a 7 y las olas `nuevas-2` y `nuevas-3`.
