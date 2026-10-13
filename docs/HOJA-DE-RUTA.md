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
- [ ] **Física C:** transferencia de calor por conducción (7.º, `conduccion`) · sonido y resonancia (8.º, `sonido`) ·
      trabajo, potencia y plano inclinado (9.º, `trabajo`).
- [ ] **Lote 9:** empuje y flotación con dinamómetro, principio de Arquímedes (7.º, física, `flotacion`) ·
      movimiento y distancia recorrida con cinta y cronómetro (6.º, física, `movimiento`) · circuitos simples con
      pilas, interruptores y bombillos (7.º, física, `circuitos-simples`).
- [ ] **T3 · Retroalimentación del docente:** comentarios y calificación por práctica que el estudiante ve en su
      laboratorio; asignación de prácticas con fecha y recordatorios.
- [ ] **Física D:** magnetismo e inducción electromagnética (11.º, `induccion`) · interferencia y difracción de la luz
      (11.º, `interferencia`).
- [ ] **Lote 10:** extracción de ADN y complementariedad de bases (8.º, biología, `extraccion-adn`) · el mol,
      la masa molar y la balanza (9.º, química, `mol`) · reto de indagación: diseñar un experimento e
      interpretar datos reales de Urabá (11.º, ambiental, `reto`).
- [ ] **T2 · Publicación del servidor:** el docente eligió Render; `Dockerfile`, `render.yaml` y la guía
      `docs/DESPLIEGUE-SERVIDOR.md` están listos. Falta que el docente cree la cuenta y entregue la dirección para
      configurar la variable `API_URL`; política de privacidad y autorización de acudientes (Ley 1581).
- [ ] **Mejoras:** pistas contextuales al cambiar dos variables a la vez; auditoría de rendimiento en equipos
      modestos; exportación para Google Classroom y Moodle; pruebas de regresión visual.

## Hecho

- [x] U6 · Modo avanzado: ecuaciones del modelo con los valores actuales (MathML) en 13 laboratorios, constantes del modelo editables en 6 y curva del modelo con residuos en el cuaderno (11 prácticas).
- [x] Sonidos realistas sintetizados (22 laboratorios) y manipulación directa en 17 laboratorios con acabado visual de la escena.

- [x] Fases 1 a 4: 24 prácticas, servidor de informes, accesibilidad WCAG 2.1 AA, modo sin conexión, guías en PDF.
- [x] Fase 5: espacio de trabajo profesional e instrumentos realistas en los 24 laboratorios.
- [x] Lote 6; U1 análisis de datos; U2 identidad visual; U4 sensores en tiempo real; T1 seguimiento del curso.

## Bloqueos

(ninguno)
