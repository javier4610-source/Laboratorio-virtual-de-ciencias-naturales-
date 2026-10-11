# Laboratorio Virtual de Ciencias Naturales

Aplicación web interactiva para estudiantes colombianos de **6.º a 11.º**. Cada práctica permite formular hipótesis, cambiar variables, ejecutar ensayos, registrar datos, graficarlos, compararlos con la hipótesis, concluir con evidencia y responder preguntas por competencias con retroalimentación formativa.

Los resultados se **calculan con modelos científicos explícitos** (ecuaciones y reglas documentadas, con supuestos y límites). No hay resultados aleatorios sin justificación: el único azar es el de la segregación genética en la práctica de Mendel, con semilla reproducible.

> Simulación educativa: no reemplaza el laboratorio real. Las preguntas tipo Saber 11 son **originales** de esta plataforma y **no son preguntas oficiales del ICFES**. Las relaciones con estándares y DBA son paráfrasis y propuestas que el docente debe validar con los documentos oficiales.

## Prácticas implementadas

| Grado | Práctica | Área | Modelo |
|---|---|---|---|
| 6.º | Medición de masa, volumen y densidad | Física | ρ = m/V; volumen geométrico y por desplazamiento; flotación (Arquímedes); resolución de instrumentos |
| 7.º | Difusión y ósmosis a través de la membrana | Biología | Boyle-van 't Hoff, van 't Hoff (π = CRT), turgencia elástica, lisis; difusión de Fick en dos compartimentos con D ∝ T/η |
| 8.º | Herencia mendeliana y cuadros de Punnett | Biología | Segregación y transmisión independiente, dominancia completa/incompleta, muestreo con semilla, χ² |
| 9.º | Del ADN a la proteína | Biología | Complementariedad, replicación semiconservativa, transcripción, código genético estándar, clasificación de mutaciones (incluye HBB Glu6Val) |
| 10.º | Preparación de soluciones, molaridad y colorimetría | Química | n = m/M, M = n/V, C₁V₁ = C₂V₂, Beer-Lambert, solubilidad |
| 10.º | Actividad enzimática | Biología | Michaelis-Menten × Arrhenius × desnaturalización × pH (dos pKa) |
| 11.º | Circuitos eléctricos | Física | Ohm, serie/paralelo/mixto, resistencia interna, Kirchhoff, potencia |
| 11.º | Estequiometría y reactivo limitante | Química | Masas molares desde la fórmula, avance de reacción, exceso, rendimiento, verificador de balanceo |
| 11.º | Crecimiento poblacional y capacidad de carga | Ambiental | Exponencial y logístico con cosecha (solución analítica) |

Otras 30 prácticas de la malla propuesta aparecen como **«Próximamente»** (no están implementadas).

Cada práctica sigue la misma estructura: título, grado y área, tema, pregunta problema, objetivos, competencias, materiales, fundamento, hipótesis, variables (con actividad de clasificación), procedimiento, área interactiva, controles, resultados en tiempo real, tabla de datos, gráficas configurables, preguntas de interpretación, comparación con la hipótesis, conclusión (afirmación-evidencia-razonamiento), evaluación por competencias, aplicación cotidiana, preguntas de transferencia tipo Saber 11 y ficha del modelo con referencias.

## Ejecutar

Requisitos: Node.js 20 o superior.

```bash
npm install
npm run dev          # servidor de desarrollo: http://localhost:5173
npm run build        # versión de producción en dist/ (servible como sitio estático)
npm run preview      # sirve dist/ en http://localhost:4173
npm run build:single # un único archivo dist-single/laboratorio.html (funciona sin servidor, con doble clic)
```

Pruebas:

```bash
npm test             # pruebas unitarias (Vitest): fórmulas, currículo, utilidades
npm run test:e2e     # pruebas de interfaz (Playwright + Chromium) sobre la versión compilada
```

Si Chromium ya está instalado en otra ruta: `PW_CHROMIUM_PATH=/ruta/a/chrome npm run test:e2e`.

No requiere servicios de pago, cuentas ni base de datos. Las fuentes tipográficas se cargan desde Google Fonts si hay internet; sin conexión se usan las fuentes del sistema.

## Publicación en línea

- **GitHub Pages:** el flujo `.github/workflows/deploy.yml` compila, ejecuta las pruebas unitarias y publica `dist/` en GitHub Pages. En el repositorio debe estar activado *Settings → Pages → Source: GitHub Actions*.
- **Archivo único:** `dist-single/laboratorio.html` puede subirse a cualquier hosting estático o abrirse localmente.

## Estructura

```
src/
  core/types.ts            Modelo de datos común (práctica, pregunta, sesión, ensayos)
  models/                  Motor de simulación: funciones puras + ficha técnica (ModelSpec)
  curriculum/              Grados, malla, prácticas (contenido pedagógico) e índice
  assessment/bank.ts       Banco de preguntas originales tipo Saber 11
  labs/                    Componentes interactivos por práctica, registro y estructura de tablas
  components/              Gráficas SVG, tablas de datos, preguntas, etapas de la práctica, controles
  pages/                   Inicio, grado, catálogo, práctica, informe, banco, panel docente, ayuda
  lib/                     Sesión y progreso, almacenamiento local, tendencias, informes, códigos, formato
tests/unit/                Pruebas de modelos, currículo y utilidades
tests/e2e/                 Pruebas de interfaz de extremo a extremo
docs/                      Auditoría técnica, científica y pedagógica
```

Módulos del enunciado → código: A navegación (`App.tsx`, `lib/router.ts`), B currículo (`curriculum/`), C catálogo (`pages/CatalogPages.tsx`), D simulación (`models/`, `labs/`), E registro (`lib/session.ts`, `components/DataPanel.tsx`), F tablas y gráficas (`components/Chart.tsx`, `DataPanel.tsx`), G evaluación (`components/QuestionCard.tsx`, `PracticeSections.tsx`), H banco Saber (`assessment/bank.ts`, `pages/BankPage.tsx`), I informes (`pages/ReportPage.tsx`, `lib/report.ts`), J panel docente (`pages/TeacherPage.tsx`), K accesibilidad y ayuda (`pages/HelpPage.tsx`, `lib/prefs.ts`), L progreso (`lib/progress.ts`).

## Cómo agregar una práctica

1. Escribe el modelo en `src/models/mi-modelo.ts` (funciones puras con validación de rangos) y su `ModelSpec`.
2. Agrega pruebas en `tests/unit/models.test.ts`.
3. Define las columnas de la tabla en `src/labs/datasets.ts` (marca con `input: true` las variables que controla el estudiante).
4. Crea el componente `src/labs/MiLab.tsx` (recibe `api` y llama `api.addTrial(datasetId, valores)`), y regístralo en `src/labs/registry.ts`.
5. Escribe el contenido en `src/curriculum/practices/mi-practica.ts` (estructura `PracticeDef`) y agrégalo a `PRACTICES` en `src/curriculum/index.ts`.
6. Las pruebas de `tests/unit/curriculum.test.ts` comprobarán que la práctica tiene todas las secciones y que sus hipótesis apuntan a columnas existentes.

## Almacenamiento y panel docente (sin servidor)

- El trabajo de cada estudiante se guarda en el almacenamiento local de su navegador.
- El estudiante entrega su **informe** como archivo `.json` o texto copiado; el docente lo **importa** en el panel docente, donde ve resultados agregados, preguntas con mayor tasa de error y exporta CSV.
- Las **asignaciones** y **listas por unidad** se comparten con un código (`LVCN-A:` / `LVCN-L:`) que el estudiante pega en la página de inicio.
- Limitación: no hay cuentas, sincronización entre dispositivos ni envío automático. Requeriría un servidor con base de datos y autenticación.

## Accesibilidad

Navegación completa por teclado, enlace «Saltar al contenido», foco visible, etiquetas en todos los controles, regiones `aria-live` para resultados, descripciones textuales y tabla equivalente para cada gráfica, tema claro/oscuro, alto contraste, tamaño de texto ajustable, reducción de animaciones, diseño adaptable desde 360 px y fuente Atkinson Hyperlegible.

## Referentes

- Ministerio de Educación Nacional (2006). *Estándares Básicos de Competencias en Lenguaje, Matemáticas, Ciencias y Ciudadanas.*
- Ministerio de Educación Nacional (2016). *Derechos Básicos de Aprendizaje – Ciencias Naturales*, v1.
- ICFES. *Marco de referencia de la prueba de Ciencias Naturales Saber 11.°* (competencias: uso comprensivo del conocimiento científico, explicación de fenómenos e indagación).

Durante el desarrollo no fue posible descargar los documentos oficiales (acceso de red restringido); por eso las correspondencias curriculares están marcadas como propuestas por validar.

Ver también [docs/AUDITORIA.md](docs/AUDITORIA.md).
