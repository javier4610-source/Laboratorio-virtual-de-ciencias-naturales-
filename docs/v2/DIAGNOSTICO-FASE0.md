# Fase 0 · Diagnóstico del laboratorio (prompt maestro v2)

Fecha: 2026-10-18 (antes del Lote 10: entonces había 47 prácticas; hoy hay 50) · Alcance: auditoría de solo lectura del repositorio; no se modificó ninguna práctica.
Inventario detallado y generado desde el código: [`INVENTARIO.md`](INVENTARIO.md) (`node scripts/inventario.mjs`).

## 1. Acceso verificado (sección 18.1)

| Recurso | Acceso | Evidencia |
|---|---|---|
| Código fuente | Sí, completo | Repositorio clonado; rama `claude/laboratorio-virtual-ciencias-skqars` |
| Terminal, compilación y pruebas | Sí | `tsc`, `vitest` (615 pruebas), `vite build`, Playwright con Chromium y axe (83 pruebas E2E) se ejecutaron el 2026-10-18 |
| Integración continua | Sí | GitHub Actions ejecuta tipos, pruebas unitarias, compilación y E2E completo; si algo falla no publica (ejecuciones 41 y 42 lo demuestran: la 41 falló y no publicó) |
| Registro npm | Sí | `npm view` responde (permite instalar 3Dmol.js, RDKit.js, Pyodide) |
| APIs científicas (RCSB PDB, UniProt, PubChem, NCBI E-utilities, AlphaFold DB) y CDN | **No desde este entorno de desarrollo** | `curl` devuelve código 000 (bloqueado por la política de red del entorno). El navegador de los estudiantes sí puede llegar a ellas; los ejecutores de GitHub Actions probablemente también, pero **no está verificado** |

Consecuencia: cualquier función que consulte un servicio externo se podrá construir y probar con respuestas
grabadas, pero su ejecución real quedará como **«no verificado»** hasta que (a) se habilite el dominio en la
configuración de red del entorno, o (b) se ejecute la prueba real periódica en GitHub Actions.

## 2. Supuestos de la sección 2: confirmados o corregidos

| Supuesto | Resultado | Detalle |
|---|---|---|
| Público 6.º–11.º con evaluación por competencias | **Confirmado** | 47 prácticas (6.º: 8 · 7.º: 8 · 8.º: 6 · 9.º: 5 · 10.º: 10 · 11.º: 10); competencias uso, explicación e indagación; banco tipo Saber 11 |
| Español como idioma principal | **Confirmado**; i18n **no preparada** | Textos escritos directamente en los componentes; no hay catálogo de cadenas |
| Hosting estático en GitHub Pages | **Confirmado, con matiz** | Además existe un servidor Node opcional (`server/`, `node:sqlite`) para informes y seguimiento de curso, listo para Render pero **no desplegado** (pendiente T2 del docente) |
| Tecnología desconocida | **Corregido** | React 19 + TypeScript 5.9 + Vite 7; Vitest; Playwright + axe; PWA con service worker propio. Dependencias de ejecución: solo React y tres fuentes tipográficas |
| Equipos modestos y conexión limitada | **Atendido en parte** | Cada laboratorio se carga bajo demanda; JS inicial 376 kB (117 kB comprimido); la PWA precarga 129 archivos (2,9 MB) y funciona sin conexión. No hay presupuesto de rendimiento escrito ni medición en dispositivo modesto |
| Mantenimiento por una persona | **Confirmado** | Un docente; se prioriza lo que no requiere operar servidores |

## 3. Clasificación de los simuladores (sección 6)

- **Las 47 prácticas tienen un modelo matemático implementado** en `src/models/` con ficha técnica (`ModelSpec`:
  ecuaciones, unidades, supuestos, límites y casos de prueba) visible en la pestaña «Modelo y referencias».
- **Clasificación provisional, por búsqueda automática de rótulos en el código:** 15 laboratorios ya contienen texto
  que rotula partes como ilustración o esquema (celulas, maquinas, mezclas, redes, descomposicion, mitosis, osmosis,
  presion, mendel, cinetica, enzimas, fotosintesis, equilibrio, poblacion, popgen) → **mixtos**. Los otros 32 no tienen
  ese rótulo: se presumen de **cálculo real**, pero la clasificación definitiva exige revisar cada escena (Fase 2).
- **Riesgo:** varias animaciones no derivan de un cálculo (por ejemplo, fases de la mitosis, imágenes del microscopio,
  animación de transcripción y traducción, organismos de la selección natural) y no todas dicen explícitamente
  «ilustración». Hay que revisarlas una por una y rotularlas (Fase 2: sistema de procedencia).
- La barra de avance de cada práctica mide etapas realmente completadas. No se detectaron resultados estáticos presentados como cálculo en vivo, pero la confirmación definitiva queda para la revisión escena por escena de la Fase 2.

## 4. Valores de referencia del prompt contrastados con el código actual

| Caso (sección) | Esperado | Obtenido hoy | Veredicto |
|---|---|---|---|
| pH de HCl 0,100 M (9.2) | ≈ 1,00 | 1,0000 (`solvePH`) | Cumple |
| pH de ácido acético 0,100 M, Ka = 1,8×10⁻⁵ (9.2) | ≈ 2,87 | 2,875 | Cumple |
| 1 mol de gas ideal a 273,15 K y 101,325 kPa (9.2) | ≈ 22,414 L | 22,420 L | **Cumple con matiz:** en el modo Charles la presión está fija en 101,3 kPa, no 101,325 (diferencia 0,025 %) |
| Ep = m·g·h con m = 1 kg, h = 10 m, g = 9,81 (9.1) | 98,1 J; v = 14,0 m/s | No ejecutable: la pista admite h ≤ 2 m. Con h = 2 m: 19,62 J y 6,264 m/s = √(2gh) exacto | **Brecha:** rango limitado y sin integración en el tiempo |
| Integración numérica con control de deriva (9.1) | Deriva < tolerancia declarada | La energía se calcula por posición (conservación exacta por construcción); no hay gráfica E(t) ni integrador | **Brecha** (Fase 3) |

## 5. Riesgos y deuda técnica

1. **Pruebas:** hay 615 pruebas unitarias y una prueba E2E por práctica, pero no existe todavía una tabla única de
   «valores dorados» (una entrada y su salida esperada por práctica). → Fase 1.
2. **Accesibilidad:** axe revisa WCAG 2.0/2.1 AA; el prompt pide **2.2 AA**. No hay pruebas en viewport móvil. → Fase 1.
3. **Privacidad (14.2):** el seguimiento de curso pide **nombre del estudiante** y PIN; el prompt pide alias o códigos
   por defecto. Solo funciona si el docente activa el servidor (hoy no desplegado). → corregir antes de T2.
4. **Seguridad (14.1):** no hay política de seguridad de contenido (CSP). No hay dependencias de terceros en
   ejecución, lo que reduce el riesgo actual; al añadir 3Dmol.js o RDKit.js habrá que fijar versión e integridad.
5. **Control de versiones (sección 5):** versión 0.1.0 sin CHANGELOG ni etiquetas semánticas. → Fase 1.
6. **Procedencia (4.2):** no existe todavía una etiqueta visible de estatus epistémico (evidencia experimental,
   predicción, modelo calculado, ilustración, sin información) en datos y exportaciones. → Fase 2.
7. **Registro de experimentos (sección 12):** se guardan ensayos e informes, pero sin semilla, versión del modelo ni
   formato exportable reproducible (JSON con esquema). → Fase 2.
8. **Cobertura desigual de capacidades:** instrumento real en 20 de 47 prácticas, modo avanzado en 17, parámetros
   editables en 8, manipulación directa en 29, sonido en 33.
9. **Internacionalización:** no preparada (riesgo bajo para el público actual).

## 6. Oportunidades y decisión de niveles de arquitectura (sección 7)

- **Nivel 0 (navegador) primero.** Bibliotecas candidatas, disponibles en npm (verificado hoy):

  | Biblioteca | Versión | Licencia | Tamaño del paquete npm | Uso |
  |---|---|---|---|---|
  | 3Dmol.js | 2.5.5 | BSD-3-Clause | 20,7 MB sin comprimir (el archivo minificado es mucho menor; medir antes de decidir) | Visor de proteínas y moléculas |
  | NGL | 2.5.0 | MIT | 23,0 MB sin comprimir | Alternativa al visor |
  | RDKit.js | 2026.9.1 | BSD-3-Clause | 7,5 MB (incluye WebAssembly) | SMILES, descriptores, Lipinski, geometría |
  | Pyodide | 314.0.7 | MPL-2.0 | 13,9 MB | Cuadernos de Python en el navegador |

  Todas se cargarían **solo al abrir el módulo** que las usa, para no penalizar a los equipos modestos, y se
  empaquetarían con la aplicación (versión fijada, sin CDN), lo que además permite el uso sin conexión.
- **Nivel 1 (proxy sin servidor):** necesario para BLAST del NCBI (cuotas, identificación de la herramienta, cola).
  Requiere una cuenta en un servicio de funciones (costo y decisión del docente).
- **Nivel 2 (backend científico, Python):** necesario para COBRApy con modelos grandes, docking con AutoDock Vina y
  ADMET. El servidor Node existente no lo cubre. **Bloqueado por infraestructura** hasta que el docente decida.
- **Nivel 3 (GPU, GROMACS, cribado masivo):** fuera de alcance para un colegio; se documentará como no implementado.
- **Ventaja actual:** la arquitectura ya separa modelo (funciones puras probadas) e interfaz, y tiene ficha técnica
  por modelo: los «adaptadores» y la «procedencia» del prompt se pueden construir sobre lo existente sin reescribir.

## 7. Plan de iteraciones (orden del prompt, sección 15)

| Fase | Contenido | Nivel | Estado |
|---|---|---|---|
| 0 | Este diagnóstico e inventario automático | — | Entregado |
| 1 | Valores dorados por práctica, WCAG 2.2 en axe, prueba móvil, CHANGELOG y versión semántica | — | Siguiente |
| 2 | ADR, sistema de procedencia, registro de experimentos exportable, plantillas pedagógicas | 0–1 | Pendiente |
| 3 | Energía con integración en el tiempo y referencia 98,1 J; química con referencias; geometría 3D con RDKit; QR por práctica | 0 | Pendiente |
| 4 | Secuencias (MVP en navegador); BLAST real | 0–1 | MVP posible; BLAST **bloqueado por red/infraestructura** |
| 5 | Visor molecular con PDB y AlphaFold DB | 0 | Posible; la carga real **no verificable** desde este entorno |
| 6 | FBA (E. coli core, 0,874 h⁻¹) | 0–2 | Posible en navegador si se valida contra COBRApy |
| 7 | Fármacos: descriptores con RDKit (Nivel 0); docking | 0–2 | Docking **bloqueado por infraestructura** |
| 8–9 | Genómica comparativa, cáncer, agrícola, dinámica molecular, cuadernos | 0–3 | Pendiente |
| 10 | Optimización y validación final | Todos | Pendiente |

Cada fase se entregará con su informe (cambios, pruebas con resultados reales, limitaciones, riesgos y siguiente
paso) y no se pasará a la siguiente sin cumplir su criterio de salida.
