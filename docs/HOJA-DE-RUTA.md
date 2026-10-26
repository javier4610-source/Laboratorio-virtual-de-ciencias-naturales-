# Hoja de ruta del desarrollo continuo

Esta lista la usa la rutina de desarrollo continuo: en cada ronda se toma **el primer elemento pendiente**,
se construye, se verifica y se marca como hecho. El orden puede cambiarlo el docente responsable.

## Protocolo de cada ronda

1. Traer la rama `claude/laboratorio-virtual-ciencias-skqars` actualizada.
2. Tomar el primer elemento `[ ]` de la sección «Pendiente» (un lote completo de prácticas o una mejora).
3. Construir siguiendo las convenciones del README («Cómo agregar una práctica»): modelo calculado con
   supuestos y límites, pruebas unitarias, laboratorio con instrumentos del kit (`src/labs/kit.tsx`),
   ficha con DBA marcado como propuesta, 4 preguntas de evaluación y una tipo Saber, prueba E2E y auditoría axe.
4. Verificar: `npx tsc --noEmit -p .`, `npx vitest run`, `npm run build`, suite E2E completa con axe,
   capturas en tema claro y oscuro (1366 y 390 px) revisadas una por una.
5. Solo si todo pasa: actualizar README, `docs/AUDITORIA.md` (tabla de la ronda), esta hoja de ruta,
   regenerar las guías en PDF (`npm run guias`) y hacer commit y push. Si algo falla y no se puede
   corregir en la ronda, no se publica: se deja anotado aquí en «Bloqueos».
6. Informe breve al docente: qué se hizo, qué se probó y qué sigue.

## Pendiente

Orden de trabajo de las rondas (se toma el primer elemento sin marcar). Pedido del docente: medición realista,
manipulación directa, modo avanzado, lotes 7 a 10 y más prácticas de física según la malla.

- [x] **U3 · Medición realista** (adoptada en densidad, Newton, óptica, gases, circuitos y conductores; el resto se adopta
      progresivamente): modo «instrumento real» con ruido e incertidumbre según la ficha de cada instrumento;
      en el cuaderno, estadística de repeticiones (media, desviación estándar, error estándar) y propagación de
      incertidumbre en los cálculos; adopción progresiva en todos los laboratorios.
- [x] **Física A:** movimiento de proyectiles, péndulo simple y choques y cantidad de movimiento (10.º, `choques`).
- [x] **Lote 7:** conservación de la masa (8.º, química, `conservacion`) · respiración celular y balance energético
      (10.º, biología, `respiracion`) · contaminación del agua e indicadores (11.º, ambiental, `agua`).
- [x] **U5 · Manipulación directa:** arrastrar muestras e instrumentos, perillas y émbolos que se giran o empujan,
      con alternativa por teclado.
- [x] **Física B:** máquinas simples (6.º, `maquinas`) · calor y equilibrio térmico (6.º, `calor`) · presión en líquidos y
      presión atmosférica (7.º, `presion`).
- [x] **Lote 8:** ecosistema: agua, luz y alimento (6.º, `ecosistema`) · balanceo de ecuaciones con conteo de átomos
      (8.º, `balanceo`) · expresión génica y efecto de mutaciones (11.º, `expresion`).
- [x] **Física C:** conducción del calor (7.º, `conduccion`) · sonido y resonancia (8.º, `sonido`) · trabajo, potencia y
      plano inclinado (9.º, `trabajo`).
- [x] **Lote 9:** empuje y flotación (7.º, `flotacion`) · movimiento y distancia recorrida (6.º, `movimiento`) · circuitos simples con
      pilas, interruptores y bombillos (7.º, física, `circuitos-simples`).
- [ ] **T3 · Retroalimentación del docente** (espera T2: necesita el servidor publicado): comentarios y calificación por práctica que el estudiante ve en su
      laboratorio; asignación de prácticas con fecha y recordatorios.
- [x] **Física D:** magnetismo e inducción electromagnética (11.º, `induccion`) · interferencia y difracción de la luz
      (11.º, `interferencia`).
- [x] **Lote 10:** extracción de ADN y complementariedad de bases (8.º, biología, `extraccion-adn`) · el mol,
      la masa molar y la balanza (9.º, química, `mol`) · reto de indagación: diseñar un experimento e
      interpretar datos de sistemas de Urabá (11.º, ambiental, `reto`; datos sintéticos con semilla visible, no reales).
- [ ] **T2 · Publicación del servidor:** el docente eligió Render; `Dockerfile`, `render.yaml` y la guía
      `docs/DESPLIEGUE-SERVIDOR.md` están listos. Falta que el docente cree la cuenta y entregue la dirección para
      configurar la variable `API_URL`; política de privacidad y autorización de acudientes (Ley 1581).
- [ ] **Taller de compuestos, siguiente paso (pendiente):** red de la anhidrita (CaSO₄) cuando se pueda consultar un
      refinamiento publicado (AMCSD/ICSD) y SrO con una densidad publicada; revisión humana, con un químico, de los
      registros que quedan como «fórmula registrada sin coincidencia de nombre»; ampliar los binarios entre no metales
      con dos átomos centrales (S₂Cl₂, N₂F₄) si hay geometría fiable.
- [ ] **Rediseño, paso siguiente** (ADR 0007): medir con Lighthouse cuando haya red para instalarlo; revisar con
      estudiantes la barra de simulación, los atajos, el inicio por perfiles y los avisos con «Cómo corregirlo».
- [ ] **Mejoras:** pistas contextuales al cambiar dos variables a la vez; auditoría de rendimiento en equipos
      modestos; exportación para Google Classroom y Moodle; pruebas de regresión visual.

## Hecho

- [x] v2.9.0 · Rediseño, siguiente paso (ADR 0007): «Cómo corregirlo» propio de cada modelo en los avisos de 19 prácticas
  (nivel «no válida», «atención» o «nota», calculado con el mismo umbral del modelo y comprobado en pruebas) y resolución del
  instrumento en las lecturas de 17 prácticas más, con estado «fuera de rango» solo donde el modelo define el rango.
- [x] v2.8.0 · Taller de compuestos, siguiente paso: redes de Li₂O, Na₂O, K₂O, BaO, ZnS, TiO₂ (rutilo),
  α-Al₂O₃ (corindón, CIF AMCSD) y cuarzo α (red covalente) con densidad publicada citada; rutas «NH₃ + ácido» (sales
  de amonio con el NH₄⁺ y sus enlaces N–H) y «No metal + no metal»; revisión automática de los registros de PubChem
  hallados por la fórmula con una regla documentada (`src/models/pubchemNameMatch.ts`).
- [x] v2.7.0 · Rediseño, siguiente paso (ADR 0007): `SimControls` con pausa real en las 23 prácticas con
  dinámica temporal (21 nuevas), `Readout.resolution` en seis de ellas, `ConditionAlert` en choques, animaciones
  continuas de gases y fotosíntesis que ya se pueden pausar (WCAG 2.2.2) y tabla de adopción por práctica (con el
  motivo de las 19 que tienen animación sin dinámica que pausar) en `docs/v2/SISTEMA-DE-DISENO.md`.
- [x] v2.6.0 (sin publicar) · Rediseño integral de la plataforma (pedido del docente, ADR 0007): sistema de diseño con
  tokens y escala de datos distinguible con daltonismo, inicio por perfiles, catálogo con filtros en la dirección,
  espacio de trabajo de la práctica, atajos de teclado, componentes experimentales compartidos (simulación, condiciones,
  lecturas, relaciones, comparación de ensayos, JSON) y carga más liviana.
- [x] v2.5.0 · Palitos visibles en todos los visores 3D (esferas proporcionales al radio covalente) y taller ampliado a 77 elementos (3329 compuestos registrados en PubChem o rotulados como formales).
- [x] v2.4.0 · Taller de formación de compuestos (pedido del docente) en óxidos e hidróxidos, ácidos y sales y nomenclatura inorgánica: elementos a elección, 9 rutas, validación explicada, registro en PubChem precalculado (1066 compuestos: 583 registrados por nombre, 337 solo por fórmula, 146 formales), retos y cuaderno.

- [x] U6 · Modo avanzado: ecuaciones del modelo con los valores actuales (MathML) en 13 laboratorios, constantes del modelo editables en 6 y curva del modelo con residuos en el cuaderno (11 prácticas).
- [x] Sonidos realistas sintetizados (22 laboratorios) y manipulación directa en 17 laboratorios con acabado visual de la escena.

- [x] Fases 1 a 4: 24 prácticas, servidor de informes, accesibilidad WCAG 2.1 AA, modo sin conexión, guías en PDF.
- [x] Fase 5: espacio de trabajo profesional e instrumentos realistas en los 24 laboratorios.
- [x] Lote 6; U1 análisis de datos; U2 identidad visual; U4 sensores en tiempo real; T1 seguimiento del curso.

## Bloqueos

- Taller de compuestos, siguiente paso (2026-10-26): las bases cristalográficas (AMCSD/RRUFF, COD, ICSD) y el CCCBDB
  no son accesibles desde el entorno de desarrollo; la red de la anhidrita, la densidad del SrO y la verificación de los
  parámetros «por verificar» esperan a que se puedan consultar. La revisión con un químico depende del docente.

## Programa v2 · prompt maestro del docente (plataforma in silico)

Fuente: «PROMPT_LABORATORIO_VIRTUAL_v2.docx» (docente, 2026-10-18). Prioridad: 1) integridad científica y seguridad,
2) no romper lo existente, 3) valor pedagógico, 4) calidad técnica e interfaz, 5) cantidad y espectacularidad.
Cada fase termina con un informe (cambios, pruebas con resultado real, limitaciones, riesgos, siguiente paso) y no
se empieza la siguiente sin cumplir el criterio de salida. Nada simulado como real; ningún identificador o
referencia inventados; todo dato con su estatus (evidencia experimental, predicción computacional, modelo calculado,
ilustración educativa, sin información). Diagnóstico y plan: `docs/v2/DIAGNOSTICO-FASE0.md`.

- [x] **v2 · Fase 0:** diagnóstico, inventario automático (`node scripts/inventario.mjs`), supuestos verificados.
- [x] **v2 · Fase 1:** valores dorados por práctica (`tests/golden`), axe con WCAG 2.2 AA, prueba en viewport móvil,
      CHANGELOG y versión semántica. Criterio: todas las prácticas cubiertas por pruebas que pasan.
- [x] **v2 · Fase 2:** ADR (`docs/v2/adr`), sistema de procedencia visible, registro de experimentos exportable (JSON
      con esquema, semilla y versión del modelo), plantilla de ficha de enriquecimiento, alias en el seguimiento.
- [x] **v2 · Fase 3:** energía con integración temporal (referencia 98,1 J y 14,0 m/s), gas a 101,325 kPa (22,414 L),
      geometría molecular 3D con un motor real, QR por práctica.
- [x] **v2 · Fase 4:** secuencias (validadas con Biopython), BLAST real con proxy de Nivel 1 en el servidor del colegio
      (activo cuando el docente publique el servidor y defina `NCBI_EMAIL`) y rastreo génico con datos validados.
- [x] **v2 · Fase 5:** visor de estructuras de proteínas (PDB y AlphaFold) con procedencia, pLDDT y validación contra
      Biopython; vista de respaldo sin WebGL.
- [x] **v2 · Fase 6:** metabolismo con FBA (E. coli core) en el navegador, validado contra COBRApy 0.32.1 (439 casos,
      error relativo ≤ 3×10⁻¹²); genes esenciales y variabilidad de flujos.
- [x] **Rediseño visual 2026** de la interfaz y práctica 56 de energía cinética y potencial (8.º) (versión 1.7.0).
- [x] **Etapa de hipótesis retirada** de todas las prácticas por decisión del docente (versión 2.0.0, ADR 0006).
- [x] **Química inorgánica** (versión 2.1.0): kit 3D, óxidos e hidróxidos, ácidos y sales, nomenclatura inorgánica.
- [x] **Química orgánica, parte 1** (versión 2.2.0): hidrocarburos, aromáticos y nomenclatura IUPAC.
- [x] **Química orgánica, parte 2** (versión 2.3.0): grupos funcionales oxigenados y nitrogenados, reacciones orgánicas en 3D.
- [x] **Rediseño integral de la plataforma** (versión 2.6.0, sin publicar): diagnóstico en `docs/v2/REDISENO-2026-10.md`,
      sistema de diseño en `docs/v2/SISTEMA-DE-DISENO.md`, ADR 0007.
- [ ] **v2 · Fase 7 (en pausa por decisión del docente):** fármacos con RDKit.js; trabajo guardado fuera del repositorio, listo para retomar.
- [ ] **v2 · Fases 7–10:** fármacos, genómica, dinámica molecular,
      cuadernos, validación final (ver la tabla del diagnóstico; lo que exige servidor queda bloqueado por
      infraestructura hasta decisión del docente).
