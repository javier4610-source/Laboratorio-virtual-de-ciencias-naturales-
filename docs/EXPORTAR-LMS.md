# Publicar prácticas y preguntas en Moodle y Google Classroom

Guía para el docente. Todo se hace desde **Panel docente → Moodle y Classroom**, en el navegador, sin servidor y sin
cuentas. Las preguntas son originales de práctica, alineadas con Saber 11; **no** son ítems oficiales del ICFES.

## Moodle: importar preguntas

### 1. Descargar el archivo

1. Abre el Laboratorio Virtual y entra a **Panel docente → Moodle y Classroom**.
2. En «Preguntas para Moodle» elige qué exportar:
   - **Preguntas de:** banco Saber 11 y prácticas, solo el banco o solo las evaluaciones de las prácticas.
   - **Grado**, **Área** y **Práctica** (opcionales). Con una práctica elegida salen su evaluación, sus preguntas de
     transferencia y las del banco asociadas a ella.
3. Revisa el número de preguntas seleccionadas (puedes verlas en «Ver las preguntas seleccionadas»).
4. Pulsa **Descargar Moodle XML** (recomendado) o **Descargar GIFT**.

### 2. Importar en Moodle (3.x y 4.x)

1. Entra a tu curso en Moodle con permisos de profesor.
2. Abre **Más → Banco de preguntas → Importar** (en Moodle 3.x: *Administración del curso → Banco de preguntas →
   Importar*).
3. En «Formato de archivo» marca **Formato Moodle XML** (o **Formato GIFT** si descargaste ese archivo).
4. En «Generales» deja activado **Obtener categoría de archivo**: las preguntas quedan en
   *Laboratorio Virtual de Ciencias Naturales → Banco tipo Saber 11 / Evaluaciones de las prácticas → Grado → área o
   práctica*.
5. Arrastra el archivo y pulsa **Importar**. Moodle muestra la lista de preguntas importadas; pulsa **Continuar**.
6. Crea o abre un **Cuestionario** y usa **Agregar → del banco de preguntas** para elegir las preguntas.

### Qué trae cada pregunta

- Selección múltiple con única respuesta, opciones A–D en el orden del laboratorio (sin barajar: algunas opciones
  citan casos como «A y C»; puedes activar «Barajar» en el cuestionario si lo prefieres).
- La opción correcta con 100 % y las demás con 0 %; penalización de un tercio por intento en el modo interactivo.
- Retroalimentación de cada opción (por qué es correcta o qué error conceptual tiene) y, como retroalimentación
  general, la explicación científica, la recomendación de repaso y el enlace a la práctica.
- Tablas de datos en HTML, tildes y símbolos en UTF-8, un número de identificación (el id de la pregunta) y etiquetas
  para filtrar en el banco: `grado-8`, `area-quimica`, `competencia-indagacion`, `dificultad-media`,
  `practica-densidad`.

### Moodle XML o GIFT

| | Moodle XML | GIFT |
|---|---|---|
| Tablas de datos | Sí (HTML) | Sí (HTML dentro del texto) |
| Categorías por grado y práctica | Sí | Sí (`$CATEGORY`) |
| Etiquetas e id de la pregunta | Sí | No |
| Retroalimentación por opción y general | Sí | Sí |

Usa GIFT solo si tu Moodle o la persona que administra la plataforma lo pide.

## Google Classroom: publicar una práctica

Classroom **no** importa cuestionarios desde archivos, así que no hay un archivo de preguntas para Classroom. Lo que sí
funciona:

1. En «Google Classroom» elige la **Práctica**. Si quieres, escribe el **Curso** y la **Fecha de entrega**: se añaden
   al texto de la tarea.
2. Pulsa **Compartir en Classroom**. Se abre la página oficial de Google para compartir
   (`https://classroom.google.com/share?url=…&title=…`); inicia sesión con tu cuenta del colegio si te lo pide.
3. Elige la clase y la acción: **Crear tarea**, **Crear pregunta**, **Hacer un anuncio** o **Crear material**. El
   enlace permanente de la práctica queda adjunto.
4. Pulsa **Copiar texto** (o **Descargar texto de la tarea**) y pega el texto en las instrucciones de la tarea:
   pregunta problema, objetivos, pasos, competencias y enlace.
5. Pon los puntos y la fecha, y asigna. Los estudiantes adjuntan su informe del laboratorio (PDF o archivo `.json`)
   en la entrega.

### Enlaces de todo un grado

En «Enlaces de todo el catálogo» elige el grado y pulsa **Descargar enlaces (CSV)**. La tabla (separada por «;», se
abre en Excel o en Hojas de cálculo de Google) trae grado, área, práctica, tema, duración, enlace permanente y enlace
para compartir en Classroom de cada práctica. Sirve para armar el plan del periodo o publicar los enlaces como material.

## Límites (léelos antes de planear)

- **Moodle recibe preguntas, no el simulador.** El estudiante hace la práctica en el Laboratorio Virtual (con el
  enlace) y responde el cuestionario en Moodle. Para poner el enlace en el curso, agrega un recurso **URL** con el
  enlace permanente de la práctica.
- **No hay paquete SCORM ni IMS Common Cartridge.** Un paquete así necesita empaquetar archivos y validarlos en cada
  plataforma; por ahora no se genera. Tampoco hay importación masiva de recursos URL en Moodle.
- **Las notas no viajan solas.** Ni las respuestas del laboratorio ni el avance se envían a Moodle o a Classroom; la
  calificación se pone en la plataforma.
- **Classroom no usa API aquí.** El botón solo abre la página oficial de Google para compartir; no se crean tareas ni
  se leen datos de tus clases desde el laboratorio.
- Los archivos exportados llevan texto y tablas; no incluyen imágenes, gráficas ni simulaciones.
- Los enlaces apuntan a la versión publicada en
  <https://javier4610-source.github.io/Laboratorio-virtual-de-ciencias-naturales-/>. Son estables: el id de una práctica
  no cambia (ver `src/lib/permalink.ts`).
