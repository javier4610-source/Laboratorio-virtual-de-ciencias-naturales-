# Registro de decisiones de arquitectura (ADR)

Este directorio documenta las decisiones de arquitectura del programa v2 (prompt maestro del docente, sección 7:
«documenta cada decisión en un registro de decisiones de arquitectura (ADR) con alternativas consideradas, costo,
mantenimiento y licencia. No añadas una dependencia sin justificarla»).

Un ADR no se borra: si una decisión cambia, se escribe un ADR nuevo que la **reemplaza** y el anterior pasa a
estado «reemplazada por NNNN».

## Índice

| N.º | Título | Estado | Fecha |
|---|---|---|---|
| [0001](0001-niveles-de-arquitectura.md) | Niveles de arquitectura: primero el navegador | Aceptada | 2026-10-18 |
| [0002](0002-sistema-de-procedencia.md) | Sistema de procedencia (estatus epistémico de datos y escenas) | Aceptada | 2026-10-18 |
| [0003](0003-registro-de-experimentos.md) | Registro de experimentos reproducible en el dispositivo | Aceptada | 2026-10-18 |
| [0004](0004-privacidad-alias.md) | Privacidad: alias o códigos en lugar de nombres reales | Aceptada | 2026-10-18 |
| [0005](0005-bibliotecas-webassembly.md) | Bibliotecas de visualización molecular y WebAssembly | Propuesta | 2026-10-18 |
| [0006](0006-retiro-etapa-hipotesis.md) | Retiro de la etapa de hipótesis | Aceptada | 2026-10-19 |
| [0007](0007-sistema-de-diseno-y-espacio-de-trabajo.md) | Sistema de diseño formal, espacio de trabajo y componentes experimentales | Aceptada | 2026-10-25 |

## Estados permitidos

- **Propuesta:** en discusión; no se implementa todavía.
- **Aceptada:** vigente; el código debe respetarla.
- **Rechazada:** se evaluó y no se adopta (se conserva como antecedente).
- **Reemplazada por NNNN:** dejó de estar vigente; ver el ADR indicado.
- **Obsoleta:** el contexto que la motivó ya no existe.

## Formato

Cada ADR es un archivo `NNNN-titulo-corto.md` con estas secciones, en este orden:

```markdown
# NNNN · Título

- **Estado:** Propuesta | Aceptada | Rechazada | Reemplazada por NNNN | Obsoleta
- **Fecha:** AAAA-MM-DD
- **Relacionado con:** secciones del prompt maestro, otros ADR, archivos del repositorio

## Contexto
Qué problema hay, qué se verificó en el repositorio (con rutas de archivo) y qué restricciones aplican.

## Decisión
Qué se hace, de forma concreta y verificable.

## Alternativas consideradas
Cada alternativa con el motivo por el que se adoptó o se descartó.

## Consecuencias
Qué mejora, qué empeora, qué queda pendiente y qué riesgos se aceptan.

## Costo
Dinero, tiempo de desarrollo y peso para el usuario (descarga, memoria).

## Mantenimiento
Quién lo opera, con qué frecuencia y qué pasa si nadie lo atiende.

## Licencia
Licencias de las dependencias o servicios involucrados y sus obligaciones (ver `docs/v2/LICENCIAS.md`).
```

Reglas de redacción: no se inventan versiones, identificadores, cifras ni referencias. Lo que no se pudo comprobar
se escribe como **«por verificar»**.
