# 0003 · Registro de experimentos reproducible en el dispositivo

- **Estado:** Aceptada
- **Fecha:** 2026-10-18
- **Relacionado con:** prompt maestro, secciones 12 y 14.2; `src/core/types.ts` (`PracticeSession`, `Trial`);
  `src/lib/storage.ts`; `src/lib/measurement.ts`; `src/lib/report.ts`; ADR 0002 y 0004

## Contexto

- Hoy el trabajo de cada práctica se guarda como `PracticeSession` en `localStorage` mediante `src/lib/storage.ts`
  (con respaldo en memoria si el almacenamiento no está disponible). Incluye ensayos (`Trial`), hipótesis, análisis
  y, desde la medición realista, `measurement: { mode, counts }` (modo ideal o real y contador de repeticiones por
  lectura).
- El informe exportable (`src/lib/report.ts`, formato `lvcn-informe-v1`) es una **entrega al docente**: incluye
  nombre y curso del estudiante. No es un registro reproducible: no lleva semilla, versión del modelo ni versión del
  software (diagnóstico, riesgo 7).
- La versión de la aplicación está disponible en el código: `vite.config.ts` define `__APP_VERSION__` a partir del
  campo `version` de `package.json`.
- El ruido de medición es determinista: `readingSeed(practiceId, clave, repetición)`. Si se repite la misma secuencia
  de lecturas (mismo modo, mismas claves y mismos contadores), se obtienen los mismos valores.

## Decisión

1. **Almacenamiento en el dispositivo por defecto** (`localStorage`), con exportación e importación de archivos. El
   almacenamiento en servidor solo se usa si el docente lo activa (ADR 0001) y con política de acceso definida.
2. **Formato abierto JSON** con identificador de esquema `lvcn-registro-experimento/1`. Un cambio incompatible
   incrementa el número (`/2`) y la importación sigue aceptando las versiones anteriores.
3. **Campos implementados** (sección 12 del prompt; `src/lib/experimentRecord.ts`, esquema en
   `docs/v2/esquema-registro-experimento.json`, coincidencia comprobada por `tests/unit/provenance.test.ts`):

| Campo | Contenido | Sección 12 |
|---|---|---|
| `formato` | `"lvcn-registro-experimento/1"` | — |
| `id` | `<práctica>-<marca de tiempo en base 36>`; no deriva de datos personales | identificador |
| `fecha` | Fecha y hora de exportación (ISO 8601); cada ensayo lleva además su propia `fecha` | fecha |
| `software` | Nombre y versión de la aplicación (`__APP_VERSION__`) | versión del software |
| `practica` | Identificador, título, grado y área | — |
| `pregunta`, `hipotesis` | Pregunta problema de la práctica; hipótesis y tendencia del estudiante (`hipotesis` es opcional y obsoleta desde el ADR 0006: los registros nuevos no la incluyen) | pregunta científica |
| `modelo` | Nombre (`ModelSpec.name`), ecuaciones, supuestos, límites y referencias | método, fuentes |
| `procedencia` | Estatus de los datos y de la escena, y frase explicativa (ADR 0002) | estatus |
| `medicion` | Modo (ideal o real), regla de la semilla y número de lecturas por clave | parámetros, semilla |
| `conjuntos` | Columnas (unidad, si es entrada, resolución) y ensayos con valores, nota, estatus, versión y modo | entradas, resultados |
| `advertencias` | Recordatorio de que son valores de un modelo calculado; aviso si no hay ensayos | incertidumbres y advertencias |
| `estado` | `con-datos` o `sin-datos` | estado |

   «Archivos generados» no aplica todavía: el laboratorio no produce archivos derivados aparte del CSV (que ahora
   incluye la columna «Estatus del dato»). Los parámetros editables del modo avanzado aún no se guardan en el
   registro, y no existe una «versión del modelo» separada de la versión del software: **pendientes** (se propone
   un número de versión en cada `ModelSpec`).
4. **Sin datos personales.** El registro no lleva nombre, curso, alias, PIN, correo ni identificadores del
   dispositivo. El informe al docente (`lvcn-informe-v1`) sigue existiendo aparte (ADR 0004).
5. **Reproducibilidad.** Importar un registro en la misma versión del software y del modelo debe reproducir los mismos
   valores; con otra versión, la aplicación lo advierte en lugar de prometer igualdad. La ida y vuelta (exportar → importar
   → mismos ensayos) está comprobada por una prueba unitaria y una prueba de extremo a extremo (`tests/e2e/procedencia.spec.ts`).

## Alternativas consideradas

| Alternativa | Resultado | Motivo |
|---|---|---|
| Ampliar el informe `lvcn-informe-v1` | Rechazada | Mezcla una entrega con datos personales con un registro que debe circular sin ellos |
| Paquete RO-Crate (JSON-LD con metadatos y archivos) | Aplazada | Más pesado de generar y validar; no se necesita mientras el registro sea un único archivo. Se reconsiderará si se publican conjuntos de datos o se adjuntan archivos (estructuras, trayectorias) |
| Almacenamiento en servidor por defecto | Rechazada | Requiere infraestructura, cuentas y política de datos de menores (ADR 0001 y 0004) |
| JSON propio con esquema versionado en el dispositivo (elegida) | Aceptada | Simple, abierto, funciona sin conexión y no expone datos personales |

## Consecuencias

- Otra persona puede reproducir una secuencia de lecturas a partir del archivo exportado.
- `localStorage` puede borrarse al limpiar el navegador: se recomienda exportar el registro; la interfaz debe decirlo.
- Los valores reproducidos dependen de la versión del modelo; por eso se registra y se compara.

## Costo

Sin dependencias nuevas. Archivos de pocos kilobytes por experimento (tamaño exacto **por medir**).

## Mantenimiento

El esquema se documenta junto al código que lo genera; cada cambio de esquema exige actualizar la importación, las
pruebas y el CHANGELOG.

## Licencia

No aplica (formato propio). Si se adopta RO-Crate, revisar la licencia de la especificación y de las bibliotecas.
