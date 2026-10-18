# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y versión semántica
([SemVer](https://semver.org/lang/es/)): MAYOR cuando cambia un contrato existente (rutas, identificadores,
formato de datos guardados), MENOR cuando se agregan prácticas o funciones, PARCHE para correcciones.
Cada versión se puede revertir con `git revert` sin afectar las anteriores.

## [Sin publicar]

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
