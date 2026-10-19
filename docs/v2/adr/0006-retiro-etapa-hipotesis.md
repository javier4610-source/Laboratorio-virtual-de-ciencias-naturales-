# 0006 · Retiro de la etapa de hipótesis

- **Estado:** Aceptada
- **Fecha:** 2026-10-19
- **Relacionado con:** solicitud del docente («quiero que elimines la fase de hipótesis de todas las prácticas»);
  ADR 0003 (registro de experimentos); `src/lib/progress.ts`, `src/core/types.ts` (`PracticeDef`, `PracticeSession`,
  `RelationPair`), `src/components/PracticeSections.tsx`, `src/pages/PracticePage.tsx`, `src/lib/syncSummary.ts`,
  `src/lib/classroom.ts`, `src/lib/report.ts`, `src/lib/experimentRecord.ts`, `server/app.mjs`, `scripts/guias/`,
  `docs/v2/PLANTILLAS.md`

## Contexto

- Hasta la versión 1.7.0 cada práctica tenía seis etapas: Preparación → Hipótesis → Experimento → Análisis y
  conclusión → Evaluación → Modelo y referencias (`STAGES` en `src/lib/progress.ts`). En la «Práctica guiada» el
  experimento quedaba bloqueado hasta guardar una hipótesis con la forma «Si…, entonces…, porque…» y una tendencia
  predicha; el análisis comparaba esa predicción con la tendencia detectada y pedía un veredicto «apoya / refuta /
  no concluyente».
- La predicción estaba en cada ficha como `hypothesis: { prompt, pairs }`. Los `pairs` (variable x, variable y,
  conjunto de datos y columnas que pueden variar) también los usaba el análisis para detectar la tendencia y revisar el
  control de variables.
- La hipótesis viajaba en cinco formatos: la sesión del navegador (`PracticeSession.hypothesis` y `.comparison`), el
  resumen sincronizado con el servidor (`SyncSummary`, validado por `validateProgress` en `server/app.mjs`), el informe
  `lvcn-informe-v1`, el registro `lvcn-registro-experimento/1` (campo `hipotesis`, obligatorio en el esquema) y las
  guías en PDF.
- El docente pidió retirar la fase de hipótesis de todas las prácticas.

## Decisión

1. **Etapas.** Quedan cinco, numeradas de 1 a 5: Preparación → Experimento → Análisis y conclusión → Evaluación →
   Modelo y referencias. Una práctica siempre abre en Preparación y su botón lleva al Experimento. El modo guiado solo
   exige guardar al menos un ensayo antes de analizar. El progreso se calcula sobre cuatro etapas principales
   (25 % cada una); el análisis queda completo con al menos una interpretación y la afirmación de la conclusión.
2. **Fichas.** `PracticeDef.hypothesis: HypothesisFrame` se reemplaza por `relations?: RelationPair[]`, con el mismo
   formato que los antiguos `pairs` (`x`, `y`, `xLabel`, `yLabel`, `datasetId`, `allowVary`). Se migraron las 56 fichas
   y se eliminaron los `prompt`. El campo es opcional: sin relaciones, el análisis muestra solo la interpretación y la
   conclusión. Se retiraron de los procedimientos las instrucciones «escribe tu hipótesis» y «compara con tu hipótesis»
   (metabolismo, proteínas, reto, secuencias) y el criterio «Formulación de hipótesis» de la rúbrica del panel docente.
3. **Análisis y conclusión.** Se conservan la relación analizada, la selección de ensayos, la advertencia de control de
   variables, la tendencia detectada (con correlación y número de valores), las preguntas de interpretación y la
   conclusión afirmación-evidencia-razonamiento. Se retiran la hipótesis, la predicción y el veredicto.
4. **Compatibilidad de datos.**
   - `PracticeSession.hypothesis` y `.comparison` quedan **opcionales y obsoletos** (`@deprecated`): las sesiones nuevas
     no los tienen; las antiguas se siguen cargando y la interfaz los ignora.
   - **Servidor:** sin cambios en el contrato. `validateProgress` sigue aceptando la etapa `hipotesis` y los campos
     `hypothesis` y `comparison` de clientes anteriores, y los rellena vacíos cuando no llegan, de modo que un cliente
     anterior que restaure un resumen nuevo sigue funcionando. El cliente actual ya no los envía. El panel de
     seguimiento no los muestra (tampoco los eventos «etapa hipotesis» de la línea de tiempo) y la columna «Hipótesis»
     sale de los dos CSV (servidor y panel docente).
   - **Informe `lvcn-informe-v1`:** se mantiene el formato. La sesión se envía con `hypothesis` y `comparison` vacíos
     (no omitidos) para que un panel docente de la versión 1.7.0 o anterior pueda abrir un informe nuevo; el texto de
     una hipótesis antigua no se incluye.
   - **Registro `lvcn-registro-experimento/1`:** se mantiene la versión `/1`. `hipotesis` pasa de obligatorio a
     opcional y obsoleto (`"deprecated": true` en `docs/v2/esquema-registro-experimento.json`); los registros nuevos no
     lo incluyen y los antiguos que lo traen se siguen importando (el campo se ignora). No es un cambio incompatible en
     el sentido del ADR 0003: ningún lector (ni el actual ni los anteriores) dependía de ese campo para validar o
     importar, así que no se pasa a `/2`.
5. **Versión.** Cambio **MAYOR** (2.0.0 al publicar) según la política del CHANGELOG: cambia un contrato existente
   — el formato de las fichas `PracticeDef` documentado en `docs/v2/PLANTILLAS.md`, los identificadores de etapa
   (`hipotesis` deja de existir en `StageId`), el significado del porcentaje de avance y el esquema del registro — aunque
   los datos guardados siguen siendo legibles.

## Alternativas consideradas

| Alternativa | Decisión | Motivo |
|---|---|---|
| Retirar la etapa, conservar las relaciones como `relations` y mantener los campos antiguos opcionales (elegida) | Aceptada | Cumple la petición sin perder la detección de tendencias ni romper sesiones, servidor, informes o registros existentes |
| Ocultar la pestaña pero dejar la hipótesis en el modelo de datos y en el informe | Rechazada | La hipótesis seguiría apareciendo en el informe, el seguimiento, las guías y el registro; no es lo que pidió el docente |
| Dejar la hipótesis como paso opcional dentro del Experimento | Rechazada | Inventa una etapa o un paso nuevo que el docente no pidió |
| Borrar `hypothesis`/`comparison` de las sesiones y del servidor (migración destructiva) | Rechazada | Rompe clientes anteriores en caché sin conexión y pierde datos ya guardados sin beneficio para el estudiante |
| Pasar el registro a `lvcn-registro-experimento/2` | Rechazada | Hacer opcional un campo que ningún lector usa es compatible en ambos sentidos; un `/2` obligaría a mantener dos lectores sin necesidad |

## Consecuencias

- **Pedagógicas.**
  - La predicción deja de ser obligatoria: el estudiante va de la preparación (pregunta problema, fundamento,
    clasificación de variables y procedimiento) directamente al experimento.
  - El análisis se centra en la evidencia: qué tendencia muestran los datos, si se controlaron las demás variables y
    cómo la conclusión responde la pregunta problema citando datos y conceptos.
  - Se pierde el contraste explícito entre lo esperado y lo medido, que apoyaba la detección de ideas previas. Lo
    compensan en parte las predicciones que ya están dentro de algunos laboratorios y procedimientos (conductores,
    carrera del movimiento, temperatura de equilibrio del calorímetro, tachuelas de la conducción), que se conservan
    porque son parte del experimento y no una etapa.
  - El concepto científico de hipótesis se sigue nombrando donde corresponde (estándares del MEN, prueba de
    chi-cuadrado en Mendel, hipótesis de optimalidad del FBA, «hipótesis conceptual» de perturbación del rastreo
    génico, preguntas del banco que evalúan si unos datos sostienen una hipótesis): son contenido, no la etapa.
- **Técnicas.** El análisis ya no depende de una ficha con relaciones numéricas, lo que permite prácticas futuras sin
  ellas (p. ej., de nomenclatura). La rúbrica del panel docente pasa de cinco a cuatro criterios.
- **Riesgos aceptados.** Los resúmenes guardados en el servidor por clientes anteriores conservan su porcentaje
  calculado con seis etapas hasta que el estudiante vuelva a sincronizar esa práctica.

## Costo

Sin costo económico. Desarrollo: una ronda. Para el usuario el paquete es un poco más liviano (sin la etapa ni el
texto de los 56 enunciados).

## Mantenimiento

Al crear una práctica nueva se declaran `relations` solo si tiene variables numéricas para analizar. Cuando ningún
cliente anterior a la versión 2.0.0 siga en uso, se pueden retirar del servidor los campos obsoletos con un ADR nuevo.

## Licencia

No aplica (no se agregan dependencias).
