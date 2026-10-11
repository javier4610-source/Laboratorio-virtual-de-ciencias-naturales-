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

- [ ] **Lote 6:** materiales conductores y aislantes (7.º, física, `conductores`) · factores de la descomposición
      de la materia orgánica (7.º, ambiental, `descomposicion`) · equilibrio químico y principio de Le Châtelier
      (11.º, química, `equilibrio`).
- [ ] **Lote 7:** conservación de la masa en sistema abierto y cerrado (8.º, química, `conservacion`) ·
      respiración celular y balance energético (10.º, biología, `respiracion`) · contaminación del agua e
      indicadores fisicoquímicos y biológicos (11.º, ambiental, `agua`).
- [ ] **Lote 8:** ecosistema: agua, luz y alimento (6.º, ambiental, `ecosistema`) · balanceo visual de ecuaciones
      químicas con conteo de átomos (8.º, química, `balanceo`) · expresión génica y efecto de mutaciones en la
      proteína (11.º, biología, `expresion`).
- [ ] **Lote 9:** empuje y flotación con dinamómetro, principio de Arquímedes (7.º, física, `flotacion`) ·
      movimiento y distancia recorrida con cinta y cronómetro (6.º, física, `movimiento`) · circuitos simples con
      pilas, interruptores y bombillos (7.º, física, `circuitos-simples`).
- [ ] **Lote 10:** extracción de ADN y complementariedad de bases (8.º, biología, `extraccion-adn`) · el mol,
      la masa molar y la balanza (9.º, química, `mol`) · reto de indagación: diseñar un experimento e
      interpretar datos reales de Urabá (11.º, ambiental, `reto`).
- [ ] **Mejora:** pistas contextuales en el laboratorio cuando el estudiante cambia dos variables a la vez o
      registra datos repetidos.
- [ ] **Mejora:** panel docente con analítica por curso (avance por práctica, errores frecuentes por pregunta,
      competencias más débiles) a partir de los informes recibidos.
- [ ] **Mejora:** auditoría de rendimiento en equipos modestos (tiempo de carga, memoria, animaciones a 60 fps)
      y presupuesto de tamaño por práctica.
- [ ] **Mejora:** exportación de resultados para Google Classroom y Moodle (CSV con formato de calificaciones).
- [ ] **Mejora:** pruebas de regresión visual automáticas de los 24+ laboratorios.

## Hecho

- [x] Fases 1 a 4: 24 prácticas, servidor de informes, accesibilidad WCAG 2.1 AA, modo sin conexión, guías en PDF.
- [x] Fase 5: espacio de trabajo profesional e instrumentos realistas en los 24 laboratorios.

## Bloqueos

(ninguno)
