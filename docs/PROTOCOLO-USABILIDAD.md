# Protocolo de pruebas de usabilidad y accesibilidad con estudiantes

Este protocolo sirve para que la institución pruebe el Laboratorio Virtual con estudiantes reales. Las pruebas automáticas (axe-core, Playwright) detectan problemas técnicos, pero **no reemplazan** observar a estudiantes usando la plataforma.

## 1. Objetivos

1. Verificar que estudiantes de 6.º a 11.º completan las tareas principales sin ayuda.
2. Detectar dónde se confunden (vocabulario, controles, pasos).
3. Comprobar el uso con teclado, lector de pantalla, ampliación de pantalla y celular.
4. Medir la facilidad de uso percibida (cuestionario SUS y encuesta integrada en cada práctica).

## 2. Participantes

| Grupo | Cantidad sugerida | Criterio |
|---|---|---|
| 6.º–7.º | 5–6 estudiantes | Mezcla de desempeños académicos |
| 8.º–9.º | 5–6 estudiantes | Al menos uno con poca experiencia en computador |
| 10.º–11.º | 5–6 estudiantes | Al menos uno que use el celular como dispositivo principal |
| Necesidades educativas | 2–4 estudiantes | Baja visión, dislexia, TDAH o uso de lector de pantalla, según la población del colegio |
| Docentes | 3–4 | Panel docente, validación curricular, servidor |

Cinco participantes por grupo suelen revelar la mayoría de los problemas frecuentes de usabilidad.

**Ética:** obtener el consentimiento informado del acudiente y el asentimiento del estudiante; explicar que se evalúa la plataforma, no al estudiante; registrar los datos sin nombres (código P01, P02…); no grabar rostros sin autorización expresa.

## 3. Preparación

- Equipos representativos del colegio (incluido al menos uno de bajo rendimiento) y un celular Android.
- Navegador actualizado; borrar los datos del sitio antes de cada participante.
- Una persona facilita (lee las tareas, no ayuda) y otra observa y registra.
- Pedir al estudiante que «piense en voz alta».

## 4. Tareas

Leer la tarea en voz alta; si después de 3 minutos no avanza, anotar «no completada» y pasar a la siguiente.

| N.º | Tarea | Criterio de éxito |
|---|---|---|
| T1 | «Busca una práctica de tu grado sobre [tema] y ábrela.» | Llega a la práctica correcta |
| T2 | «Lee la pregunta problema y escribe tu hipótesis.» | Guarda una hipótesis con «Si…, entonces…, porque…» |
| T3 | «Clasifica las variables del experimento.» | Usa la actividad y la comprueba |
| T4 | «Haz tres ensayos cambiando solo una variable y guárdalos.» | Tres ensayos en la tabla con una sola variable distinta |
| T5 | «Cambia la gráfica para ver [variable] contra [variable].» | Usa los selectores de ejes |
| T6 | «Compara tus resultados con tu hipótesis y escribe una conclusión.» | Llena afirmación, evidencia y razonamiento |
| T7 | «Responde las preguntas; si fallas una, intenta de nuevo.» | Usa «Intentar de nuevo» |
| T8 | «Genera tu informe y envíalo a tu docente.» | Descarga, copia o envía al servidor |
| T9 (accesibilidad) | Repetir T2 y T4 **solo con teclado** | Completa sin mouse |
| T10 (accesibilidad) | Con ampliación al 200 % o en celular, repetir T4 | Completa sin perder controles |
| T11 (lector de pantalla) | Con NVDA (Windows) o TalkBack (Android), leer el resultado de un ensayo y la tabla de datos de la gráfica | Escucha los valores |

Tareas para docentes: crear una asignación con código; importar un informe; revisar «Preguntas con mayor tasa de error»; registrar la validación curricular de una práctica; crear un curso en el servidor.

## 5. Medidas

| Medida | Cómo se registra |
|---|---|
| Éxito por tarea | Completada / con ayuda / no completada |
| Tiempo por tarea | Cronómetro |
| Errores y confusiones | Descripción breve y pantalla donde ocurrió |
| Facilidad percibida | Cuestionario SUS (sección 6) y encuesta de la práctica |
| Comentarios | Frases textuales del estudiante |

## 6. Cuestionario SUS (adaptación al español para uso escolar)

Escala de 1 (totalmente en desacuerdo) a 5 (totalmente de acuerdo). Adaptación propia del System Usability Scale (Brooke, 1996); no es una traducción validada.

1. Me gustaría usar este laboratorio con frecuencia.
2. El laboratorio me pareció más complicado de lo necesario.
3. El laboratorio fue fácil de usar.
4. Necesitaría ayuda de otra persona para poder usarlo.
5. Las partes del laboratorio (experimento, tabla, gráfica, preguntas) funcionan bien juntas.
6. Hay demasiadas cosas inconsistentes en el laboratorio.
7. Creo que la mayoría de mis compañeros aprendería a usarlo rápido.
8. El laboratorio fue difícil de manejar.
9. Me sentí seguro(a) usando el laboratorio.
10. Tuve que aprender muchas cosas antes de poder usarlo.

**Puntaje:** ítems impares: (respuesta − 1); ítems pares: (5 − respuesta). Sumar y multiplicar por 2,5 (escala 0–100). Como referencia común, alrededor de 68 se considera un resultado promedio.

## 7. Encuesta integrada en cada práctica

Al final de la etapa de evaluación, cada práctica incluye tres afirmaciones (1 a 5) y un comentario: «fue fácil de usar», «entendí qué tenía que hacer» y «me ayudó a entender el tema». Las respuestas viajan en el informe y el panel docente muestra sus promedios por práctica en la pestaña **Informes**.

## 8. Análisis y priorización

1. Agrupar los problemas observados por pantalla.
2. Clasificar su gravedad: **crítica** (impide completar la tarea), **alta** (la completa con mucha dificultad), **media** (confusión), **baja** (cosmética).
3. Corregir primero los críticos y los que afectan a estudiantes con necesidades educativas.
4. Repetir la prueba con otros participantes después de corregir.

## 9. Plantilla de registro

| Participante | Grado | Dispositivo | Tarea | Resultado | Tiempo | Observaciones |
|---|---|---|---|---|---|---|
| P01 | 7.º | PC del colegio | T1 | Completada | 0:45 | Buscó por «células» |
| | | | | | | |

## Referencias

- Brooke, J. (1996). SUS: A "quick and dirty" usability scale. En *Usability Evaluation in Industry*. Taylor & Francis.
- W3C (2018). *Web Content Accessibility Guidelines (WCAG) 2.1*.
