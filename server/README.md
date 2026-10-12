# Servidor institucional (opcional)

Permite que los estudiantes **envíen sus informes por internet** con un código de curso, y que los docentes los descarguen en el panel docente. El laboratorio funciona sin este servidor (los informes se entregan como archivo o texto).

- Sin dependencias externas: usa solo módulos de Node.js (`node:http`, `node:sqlite`, `node:crypto`).
- Requiere **Node.js 22.13 o superior** (por `node:sqlite`; Node muestra un aviso de función experimental).
- Datos en un archivo SQLite (`laboratorio.db`).

## Qué hace

| Quién | Qué puede hacer |
|---|---|
| Docente | Crear cuenta (con el código de registro institucional), iniciar sesión, crear cursos, cerrar o reabrir la recepción, descargar y eliminar informes de **sus** cursos. |
| Estudiante | Enviar su informe con el código de 6 caracteres del curso (sin cuenta). Opcionalmente, **unirse al curso** con el código, su nombre y un PIN de 4 dígitos para que su avance se sincronice solo. |

Seguridad implementada (y probada en `tests/server/server.test.ts` y `tests/server/tracking.test.ts`): contraseñas con scrypt y sal, sesiones con token aleatorio (se guarda solo su hash) que expiran a las 12 horas, aislamiento entre docentes, registro protegido por código institucional, límite de intentos de inicio de sesión y de envíos por conexión, límite de 512 KB por envío, validación del informe, CORS restringido a los orígenes configurados y cabeceras de seguridad.

## Ejecutar

```bash
REGISTRATION_CODE="un-codigo-dificil-de-adivinar" \
ALLOWED_ORIGINS="https://usuario.github.io" \
PORT=8787 DB_PATH=/var/lib/laboratorio/laboratorio.db \
node server/index.mjs
```

| Variable | Descripción |
|---|---|
| `REGISTRATION_CODE` | Obligatoria. Código que el administrador entrega a los docentes para crear su cuenta (≥ 6 caracteres). |
| `ALLOWED_ORIGINS` | Dirección (origen) del sitio donde está publicado el laboratorio, separadas por coma. Sin ella el navegador bloquea las solicitudes. |
| `PORT` | Puerto (8787 por defecto). |
| `DB_PATH` | Archivo de la base de datos. Haz copias de seguridad periódicas de este archivo. |

En la aplicación, el docente escribe la dirección del servidor en **Panel docente → Servidor**. También se puede fijar al compilar con `VITE_API_URL=https://… npm run build`.

## Publicación

Cualquier servicio que ejecute Node.js con disco persistente sirve (un servidor del colegio, una máquina virtual, o servicios de hosting con volúmenes). Debe publicarse con **HTTPS** (por ejemplo, detrás de Nginx o Caddy). Si el hosting reinicia el disco, la base de datos se pierde: usa un volumen persistente.

## Seguimiento del curso

El estudiante pulsa **Unirme a mi curso** (encabezado del laboratorio, o el enlace `#/unirme?codigo=…&servidor=…` que copia el docente) y escribe el código del curso, su nombre (o un alias acordado) y un **PIN de 4 dígitos** que él mismo inventa. Con el mismo nombre y PIN vuelve a entrar desde otro equipo: el avance guardado en el servidor se recupera en las prácticas que estén vacías en ese equipo. Desde ahí, cada práctica envía un resumen de su avance con antirrebote (unos segundos después del último cambio); sin conexión, el resumen espera en una cola local y se envía cuando vuelve la red. Si el servidor falla, el laboratorio sigue funcionando igual.

### Endpoints

| Método y ruta | Quién | Descripción |
|---|---|---|
| `POST /api/estudiantes` | público (con código) | `{ joinCode, name, pin }`. Inscribe (201) o devuelve la misma cuenta si nombre y PIN coinciden (200). Responde `{ token, expiresAt, created, student, course }`. Un curso cerrado no admite inscripciones nuevas. |
| `GET /api/estudiante` | estudiante | Valida la sesión y registra el ingreso del día. |
| `DELETE /api/estudiante/sesion` | estudiante | Cierra la sesión («Salir del curso»). |
| `GET /api/estudiante/progreso` | estudiante | Su propio avance (para continuar desde otro equipo). |
| `POST /api/estudiante/eventos` | estudiante | `{ kind: 'practica', practiceId }`: apertura de práctica (se ignora si se repite en 15 min). |
| `PUT /api/estudiante/progreso/:practica` | estudiante | Resumen del avance (ver abajo). Idempotente: misma versión → `duplicate`; versión más vieja → `stale` (no sobrescribe). |
| `GET /api/cursos/:id/seguimiento` | docente dueño | Todo junto: `summary`, `students`, `questions`, `alerts`. |
| `GET /api/cursos/:id/resumen` | docente dueño | Inscritos, activos hoy y en 7 días, avance y puntaje promedio, prácticas más trabajadas, ingresos por día (14 días) y aciertos por competencia. |
| `GET /api/cursos/:id/estudiantes` | docente dueño | Estudiantes con avance, ensayos, aciertos y tiempo por práctica. |
| `GET /api/cursos/:id/estudiantes/:sid` | docente dueño | Detalle: resumen completo de cada práctica y línea de tiempo (ingresos, aperturas, etapas, respuestas). |
| `DELETE /api/cursos/:id/estudiantes/:sid` | docente dueño | Elimina al estudiante, su sesión y todos sus datos. |
| `GET /api/cursos/:id/preguntas` | docente dueño | Por pregunta: respondida por, porcentaje de acierto al primer intento y opción errada más elegida. |
| `GET /api/cursos/:id/alertas` | docente dueño | Sin actividad en 7 días; práctica iniciada sin avance en 3 días; menos de 50 % de aciertos en una competencia (mínimo 3 respuestas). |
| `GET /api/cursos/:id/seguimiento.csv` | docente dueño | Exportación (separador `;`, protegida contra fórmulas al abrir en hojas de cálculo). |

Los tokens de estudiante y de docente son distintos (tablas separadas): uno no sirve en las rutas del otro. Un docente solo ve sus cursos (otro curso responde 404).

### Resumen de avance que se guarda (por estudiante y práctica)

Se valida campo por campo y se descartan campos desconocidos; máximo **64 KB** por envío (413 si se supera): modo de trabajo, etapas completadas, porcentaje de avance, número de ensayos y los **últimos 30 ensayos** (hasta 24 valores cada uno), hipótesis, comparación con los datos, conclusión (afirmación, evidencia, razonamiento), interpretaciones, respuestas (opción elegida, opción del primer intento, acierto al primer intento, intentos), puntaje por competencia, ajuste elegido en el análisis, tiempo activo aproximado (bloques de 15 s con la pestaña visible y actividad en el último minuto) y última actividad. Textos de hasta 2000 caracteres. La versión es la marca de tiempo del último cambio en el equipo del estudiante (acotada a 1 día en el futuro).

Además se guarda: nombre del estudiante, hash scrypt del PIN, fechas de inscripción y última conexión, días con actividad y eventos de la línea de tiempo.

### Límites

| Límite | Valor (opción de `createApp({ limits })`) |
|---|---|
| Inscripciones e ingresos por IP | 90 cada 15 min (`join`) |
| PIN incorrecto por estudiante (curso + nombre) | 5 fallos → bloqueo de 15 min (`pin`) |
| Sincronizaciones y eventos por estudiante | 240 cada 10 min (`sync`) |
| Estudiantes por curso | 300 (`studentsPerCourse`) |
| Prácticas por estudiante | 80 |
| Duración de la sesión del estudiante | 120 días |

Los días se cuentan en hora de Colombia (UTC−5; opción `tzOffsetMinutes`).

## Protección de datos personales

El servidor guarda el nombre y el curso que escribe el estudiante y el contenido de su informe; si se une al curso, también el resumen de avance descrito arriba. En Colombia aplican la Ley 1581 de 2012 y sus normas reglamentarias, con protección reforzada para datos de niños, niñas y adolescentes (art. 7: prevalece su interés superior). Medidas incluidas: no se piden correo, documento, teléfono ni fecha de nacimiento (basta un alias acordado con el docente); el PIN se guarda con scrypt y sal; el estudiante ve un aviso de qué se envía y a quién antes de unirse; solo el docente dueño del curso ve los datos; el docente puede eliminar a un estudiante con todos sus datos o el curso completo. Antes de usarlo, la institución debe:

1. Definir quién es el responsable del tratamiento de los datos y su política de tratamiento.
2. Obtener las autorizaciones correspondientes de acudientes cuando se requieran, e informar a los estudiantes la finalidad (acompañamiento pedagógico) del seguimiento.
3. Limitar el acceso al servidor y definir cuánto tiempo se conservan los informes y el avance (por ejemplo, eliminar los cursos al terminar el año escolar).
4. Usar HTTPS y hacer copias de seguridad cifradas del archivo de la base de datos.

Esta guía no es asesoría jurídica; consulte con el área encargada de la institución.

## Limitaciones conocidas

- No hay recuperación de contraseña por correo (requiere un servicio de correo); el administrador puede borrar la cuenta en la base de datos para que el docente la cree de nuevo.
- El límite de intentos se guarda en memoria y se reinicia al reiniciar el servidor; varios estudiantes detrás de la misma red del colegio comparten el límite de envíos (120 cada 10 minutos por IP, pensado para un salón completo detrás de la misma red; ajustable en `createApp`).
- No hay panel de administración.
