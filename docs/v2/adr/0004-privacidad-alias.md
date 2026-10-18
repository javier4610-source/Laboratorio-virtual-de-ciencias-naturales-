# 0004 · Privacidad: alias o códigos en lugar de nombres reales

- **Estado:** Aceptada
- **Fecha:** 2026-10-18
- **Relacionado con:** prompt maestro, sección 14.2; `server/README.md` («Protección de datos»);
  `docs/DESPLIEGUE-SERVIDOR.md`; `src/components/ClassroomUi.tsx`; `src/pages/ReportPage.tsx`; ADR 0001 y 0003

## Contexto

- Los usuarios son principalmente menores de edad. El prompt pide no solicitar cuentas ni datos personales por
  defecto, y que los paneles docentes trabajen con alias o códigos de grupo salvo decisión explícita de la institución.
- Sin servidor, todo queda en el navegador del estudiante (`localStorage`) y no se envía nada.
- Con el servidor opcional (no desplegado), el seguimiento del curso pide código del curso, un nombre o alias y un PIN
  de 4 dígitos (guardado con scrypt y sal). El diagnóstico de la Fase 0 (riesgo 3) señaló que se pedía el **nombre**
  del estudiante.
- El informe al docente (`lvcn-informe-v1`, `src/lib/report.ts`) incluye `student.name` y `student.course`; la página
  del informe rotula el campo como «Nombre del estudiante».
- `server/README.md` ya cita la Ley 1581 de 2012 y lista las medidas del servidor.

## Decisión

1. **Sin cuentas de estudiante por defecto.** El laboratorio funciona completo sin registro.
2. **Alias o código por defecto** en todo lugar donde el estudiante se identifique (seguimiento del curso e informe):
   el campo se rotula «alias o código de estudiante», con un ejemplo de código de grupo y la indicación de no escribir
   el nombre completo. El docente guarda, fuera de la aplicación, la correspondencia entre alias y estudiante.
3. **Nombres reales solo por decisión explícita de la institución**, documentada, con autorización de los acudientes
   y política de tratamiento de datos.
4. **Minimización:** no se piden correo, documento, teléfono ni fecha de nacimiento. Los registros de experimento
   (ADR 0003) no llevan ningún identificador personal.
5. **Marco legal:** en Colombia aplica la Ley 1581 de 2012 y su reglamentación, con protección reforzada de datos de
   niños, niñas y adolescentes. Esta decisión **no es asesoría legal**: el alcance de las obligaciones de la
   institución debe **confirmarse con asesoría legal** antes de desplegar el servidor (tarea T2).
6. **Compatibilidad:** el servidor sigue aceptando el campo de identificación como texto libre; el cambio es de
   rotulado y orientación en la interfaz, sin romper el contrato de la API ni los informes ya exportados.

## Alternativas consideradas

| Alternativa | Resultado | Motivo |
|---|---|---|
| Mantener el nombre real como predeterminado | Rechazada | Contradice la sección 14.2 y aumenta el riesgo para menores |
| Cuentas con correo y contraseña para estudiantes | Rechazada | Más datos personales, más soporte; innecesario para el uso en clase |
| Códigos generados automáticamente por el servidor | Aplazada | Más privados, pero obligan al docente a repartir y conciliar códigos; puede adoptarse después si el docente lo pide |
| Alias acordado con el docente (elegida) | Aceptada | Mínimo cambio, sin romper contratos, compatible con el modo sin servidor |

## Consecuencias

- El panel docente muestra alias; la identificación del estudiante depende de la lista que lleva el docente.
- Riesgo residual: un estudiante puede escribir su nombre real de todos modos; la interfaz lo desaconseja, pero no lo
  impide.
- Pendiente antes de T2: política de privacidad, autorización de acudientes y revisión legal.

## Costo

Sin costo monetario ni dependencias. Cambios de texto en la interfaz y en las pruebas E2E que verifican esos textos.

## Mantenimiento

Revisar los textos de privacidad cuando cambie la normativa o la política institucional.

## Licencia

No aplica.
