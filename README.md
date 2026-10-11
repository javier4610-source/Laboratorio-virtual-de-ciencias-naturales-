# Laboratorio Virtual de Ciencias Naturales

Aplicación web interactiva para estudiantes colombianos de **6.º a 11.º**. Cada práctica permite formular hipótesis, cambiar variables, ejecutar ensayos, registrar datos, graficarlos, compararlos con la hipótesis, concluir con evidencia y responder preguntas por competencias con retroalimentación formativa.

Los resultados se **calculan con modelos científicos explícitos** (ecuaciones y reglas documentadas, con supuestos y límites). No hay resultados aleatorios sin justificación: el único azar es el de la segregación genética en la práctica de Mendel, con semilla reproducible.

> Simulación educativa: no reemplaza el laboratorio real. Las preguntas tipo Saber 11 son **originales** de esta plataforma y **no son preguntas oficiales del ICFES**. Las relaciones con estándares y DBA son paráfrasis y propuestas que el docente debe validar con los documentos oficiales.

## Prácticas implementadas (14)

| Grado | Práctica | Área | Modelo |
|---|---|---|---|
| 6.º | Medición de masa, volumen y densidad | Física | ρ = m/V; volumen geométrico y por desplazamiento; flotación (Arquímedes); resolución de instrumentos |
| 7.º | Difusión y ósmosis a través de la membrana | Biología | Boyle-van 't Hoff, van 't Hoff (π = CRT), turgencia elástica, lisis; difusión de Fick con D ∝ T/η |
| 7.º | Mitosis al microscopio: fases e índice mitótico | Biología | Fracción de células por fase ∝ duración; índice mitótico; ADN 2C→4C; efecto de la colchicina |
| 8.º | Herencia mendeliana y cuadros de Punnett | Biología | Segregación y transmisión independiente, dominancia completa/incompleta, muestreo con semilla, χ² |
| 8.º | Laboratorio de ondas | Física | v = λ·f, v = √(T/μ), onda armónica, energía ∝ A²f², sonido en el aire según la temperatura |
| 9.º | Del ADN a la proteína | Biología | Complementariedad, replicación semiconservativa, código genético, clasificación de mutaciones (HBB Glu6Val) |
| 10.º | Soluciones, molaridad y colorimetría | Química | n = m/M, M = n/V, C₁V₁ = C₂V₂, Beer-Lambert, solubilidad |
| 10.º | Actividad enzimática | Biología | Michaelis-Menten × Arrhenius × desnaturalización × pH (dos pKa) |
| 10.º | Fotosíntesis: luz, CO₂ y temperatura | Biología | Inverso del cuadrado, colimitación luz/CO₂ (hipérbola no rectangular), respiración Q₁₀, punto de compensación |
| 11.º | Circuitos eléctricos | Física | Ohm, serie/paralelo/mixto, resistencia interna, Kirchhoff, potencia |
| 11.º | Estequiometría y reactivo limitante | Química | Masas molares desde la fórmula, avance de reacción, exceso, rendimiento, balanceo |
| 11.º | pH, dilución y neutralización | Química | Balance de cargas exacto (ácidos fuertes y débiles), dilución, curva de titulación, indicadores |
| 11.º | Crecimiento poblacional y capacidad de carga | Ambiental | Exponencial y logístico con cosecha |
| 11.º | Genética de poblaciones | Biología | Hardy-Weinberg, selección (incluida ventaja del heterocigoto), mutación, migración, deriva Wright-Fisher |

Otras 25 prácticas de la malla propuesta aparecen como **«Próximamente»** (no están implementadas).

Cada práctica sigue la misma estructura: título, grado y área, tema, pregunta problema, objetivos, competencias, materiales, fundamento, hipótesis, variables (con actividad de clasificación), procedimiento, área interactiva, controles, resultados en tiempo real, tabla de datos, gráficas configurables, preguntas de interpretación, comparación con la hipótesis, conclusión (afirmación-evidencia-razonamiento), evaluación por competencias, aplicación cotidiana, preguntas de transferencia tipo Saber 11 y ficha del modelo con referencias.

## Ejecutar

Requisitos: Node.js 22.13 o superior.

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
npm run test:e2e     # interfaz, servidor real y auditoría de accesibilidad WCAG 2.1 AA (Playwright + axe-core)
npm run server       # servidor institucional opcional (ver server/README.md)
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
  lib/                     Sesión y progreso, almacenamiento local, tendencias, informes, códigos, API del servidor, validación curricular
server/                    Servidor institucional opcional (Node.js sin dependencias)
tests/unit/                Pruebas de modelos, currículo y utilidades
tests/server/              Pruebas del servidor
tests/e2e/                 Pruebas de interfaz de extremo a extremo y de accesibilidad
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

## Almacenamiento, panel docente y servidor opcional

- El trabajo de cada estudiante se guarda en el almacenamiento local de su navegador.
- **Sin servidor:** el estudiante entrega su informe como archivo `.json` o texto copiado y el docente lo importa en el panel docente. Asignaciones y listas se comparten con códigos (`LVCN-A:` / `LVCN-L:`).
- **Con servidor** (opcional, `server/`): el docente crea su cuenta y sus cursos; el estudiante envía su informe con el código de 6 caracteres del curso, sin crear cuenta; el docente lo descarga en la pestaña **Servidor**. Instalación, seguridad y protección de datos en [server/README.md](server/README.md).
- **Validación curricular:** pestaña del panel docente para registrar, por práctica, el DBA y el estándar verificados en los documentos oficiales, exportable para el equipo de área.
- **Usabilidad:** cada práctica incluye una encuesta breve de opinión que viaja en el informe; el protocolo para pruebas con estudiantes está en [docs/PROTOCOLO-USABILIDAD.md](docs/PROTOCOLO-USABILIDAD.md).

## Accesibilidad

Navegación completa por teclado (incluidas flechas en las pestañas), enlace «Saltar al contenido», foco visible, etiquetas en todos los controles, regiones `aria-live` para resultados, descripciones textuales y tabla equivalente para cada gráfica, tema claro/oscuro, alto contraste, tamaño de texto ajustable, reducción de animaciones, diseño adaptable desde 360 px y fuente Atkinson Hyperlegible. Una auditoría automática con axe-core (WCAG 2.1 A/AA) recorre todas las páginas y prácticas en tema claro y oscuro.

## Referentes

- Ministerio de Educación Nacional (2006). *Estándares Básicos de Competencias en Lenguaje, Matemáticas, Ciencias y Ciudadanas.*
- Ministerio de Educación Nacional (2016). *Derechos Básicos de Aprendizaje – Ciencias Naturales*, v1.
- ICFES. *Marco de referencia de la prueba de Ciencias Naturales Saber 11.°* (competencias: uso comprensivo del conocimiento científico, explicación de fenómenos e indagación).

Durante el desarrollo no fue posible descargar los documentos oficiales (acceso de red restringido); por eso las correspondencias curriculares están marcadas como propuestas por validar.

Ver también [docs/AUDITORIA.md](docs/AUDITORIA.md).
