# 0002 · Sistema de procedencia (estatus epistémico de datos y escenas)

- **Estado:** Aceptada
- **Fecha:** 2026-10-18
- **Relacionado con:** prompt maestro, secciones 4.2, 11 y 12; `docs/v2/DIAGNOSTICO-FASE0.md` (secciones 3 y 5.6);
  `src/lib/measurement.ts`; `src/models/inquiry.ts`; ADR 0003

## Contexto

- El prompt exige etiquetar **cada dato y resultado**, en la interfaz y en las exportaciones, con una de cinco
  categorías, y que toda animación indique si proviene de un cálculo o es ilustrativa.
- Hoy no existe esa etiqueta (diagnóstico, riesgo 6). Lo que sí existe:
  - Cada práctica tiene un modelo matemático en `src/models/` con su `ModelSpec` (ecuaciones, unidades, supuestos,
    límites y casos de prueba), visible en la etapa «Modelo y referencias» de cada práctica.
  - **Modo «instrumento real»** (`src/lib/measurement.ts`): suma ruido gaussiano **sintético** y cuantiza a la
    resolución del instrumento. La semilla es `readingSeed(practiceId, clave, repetición)` (hash FNV-1a), de modo que la
    misma lectura con el mismo contador de repetición da siempre el mismo valor. En modo «ideal» solo se cuantiza.
  - Algunos modelos usan azar con semilla reproducible (`seededRandom` de `src/models/math.ts`), por ejemplo
    `mendel`, `popgen`, `selection` e `inquiry`.
  - La práctica `reto` (`src/models/inquiry.ts`) genera **datos sintéticos** con semilla visible (1 a 999); el propio
    código declara que «nada de lo que produce este modelo es una medición real». Nota: `docs/HOJA-DE-RUTA.md`
    (lote 10) la describe como «interpretar datos reales de Urabá»; esa redacción es **imprecisa** y debe corregirse
    a «datos sintéticos de sistemas de Urabá».
  - Las escenas (pistas, microscopio, fases de la mitosis, animación de transcripción, etc.) son dibujos SVG. En
    algunas la posición o el estado se deriva del modelo; en otras son ilustración pura. La clasificación escena por
    escena está pendiente (diagnóstico, sección 3).
- Ninguna práctica actual muestra datos medidos en un laboratorio real ni predicciones de un modelo entrenado.

## Decisión

### Categorías

| Estatus | Cuándo se usa | Ejemplo en el laboratorio |
|---|---|---|
| **Evidencia experimental** | Datos medidos en un sistema real, con fuente identificable (publicación, base de datos, medición propia documentada) | Ninguno hoy. Futuro: estructura PDB por difracción, con método y resolución |
| **Predicción computacional** | Salida de un modelo entrenado o de un motor de predicción (estructura predicha, confórmero calculado, ADMET, aprendizaje automático) | Coordenadas 3D de la práctica `geometria` (confórmeros de PubChem, OMEGA + MMFF94s). Futuro: modelo de AlphaFold DB con pLDDT |
| **Modelo calculado** | Resultado de ecuaciones o reglas explícitas con supuestos declarados | **Todos los resultados numéricos actuales**, incluidas las lecturas en modo «instrumento real» (modelo + ruido sintético con semilla) y los datos del `reto` |
| **Ilustración educativa** | Representación visual que no se deriva de un cálculo | Escenas dibujadas que no dependen del modelo |
| **Sin información disponible** | No hay dato, o no se pudo obtener | Servicio externo no disponible, campo sin fuente |

Reglas de aplicación:

1. **Resultados numéricos:** en todas las prácticas actuales son «Modelo calculado». El detalle remite a la ficha
   `ModelSpec` (supuestos y límites).
2. **Ruido de medición:** cuando el modo «instrumento real» está activo, el detalle añade «con ruido de medición
   sintético (semilla reproducible)». El ruido **no** convierte los datos en evidencia experimental.
3. **Datos del `reto`:** «Modelo calculado» con la leyenda «datos sintéticos; semilla N», mostrando la semilla usada.
4. **Escenas:** «Ilustración educativa» salvo que su geometría o estado se calcule con el modelo de la práctica; en ese
   caso, «Modelo calculado». La clasificación se revisa escena por escena y se registra en la ficha de enriquecimiento
   (`docs/v2/PLANTILLAS.md`).
5. **Lenguaje:** las etiquetas usan siempre texto, no solo color (WCAG 2.2 AA), y no se usa «gemelo digital».

### Implementación

- `src/lib/provenance.ts`: tipos del estatus, textos de cada categoría (etiqueta y explicación) y procedencia por
  práctica (estatus de los datos, estatus de la escena y detalle).
- Componente de procedencia en `src/components/Provenance.tsx`: una franja sobre cada laboratorio (estatus de las
  lecturas y datos, estatus de la escena, detalle) y una etiqueta reutilizable para el cuaderno de datos.
- Exportaciones: columna o campo de estatus en el CSV del cuaderno y en los JSON exportados (informe y registro de
  experimento, ADR 0003).
- Detrás del indicador de característica `procedencia` en `src/lib/flags.ts`, **activado por defecto**; al
  desactivarlo, la interfaz vuelve a su presentación anterior sin perder datos.

## Alternativas consideradas

| Alternativa | Resultado | Motivo |
|---|---|---|
| Un solo aviso general («simulación educativa») | Rechazada | Ya existe en el README; no distingue dato de escena ni sirve para las exportaciones |
| Etiqueta por cada valor individual | Aplazada | Demasiado ruido visual hoy, cuando todos los valores de una práctica comparten estatus; se adoptará cuando una práctica mezcle fuentes (p. ej., comparar con datos publicados) |
| Etiqueta por práctica (datos + escena) y campo en exportaciones (elegida) | Aceptada | Honesta, verificable y de bajo costo; se puede refinar a nivel de valor más adelante |

## Consecuencias

- El estudiante distingue qué es cálculo, qué es dibujo y qué es ruido sintético.
- Las exportaciones cambian de forma (columna o campo nuevo). Quien procese el CSV con una hoja de cálculo verá una
  columna adicional; se documenta en el CHANGELOG.
- Queda pendiente la revisión escena por escena; mientras no se haga, una escena sin clasificar se rotula de forma
  conservadora como «Ilustración educativa».

## Costo

Sin dependencias nuevas. Costo de desarrollo bajo (tipos, un componente, cambios en exportaciones y pruebas).

## Mantenimiento

`practiceProvenance` da a toda práctica del catálogo la procedencia por defecto (modelo calculado, escena ilustrativa);
una práctica con datos sintéticos se declara en `SYNTHETIC_SAMPLES`. Un módulo nuevo con evidencia experimental o
predicciones (fases 4 a 8) debe ampliar esta función y sus pruebas (`tests/unit/provenance.test.ts`).

## Licencia

No aplica (código propio, sin dependencias).
