# Servidor institucional (opcional)

Permite que los estudiantes **envíen sus informes por internet** con un código de curso, y que los docentes los descarguen en el panel docente. El laboratorio funciona sin este servidor (los informes se entregan como archivo o texto).

- Sin dependencias externas: usa solo módulos de Node.js (`node:http`, `node:sqlite`, `node:crypto`).
- Requiere **Node.js 22.13 o superior** (por `node:sqlite`; Node muestra un aviso de función experimental).
- Datos en un archivo SQLite (`laboratorio.db`).

## Qué hace

| Quién | Qué puede hacer |
|---|---|
| Docente | Crear cuenta (con el código de registro institucional), iniciar sesión, crear cursos, cerrar o reabrir la recepción, descargar y eliminar informes de **sus** cursos. |
| Estudiante | Enviar su informe con el código de 6 caracteres del curso. **No tiene cuenta.** |

Seguridad implementada (y probada en `tests/server/server.test.ts`): contraseñas con scrypt y sal, sesiones con token aleatorio (se guarda solo su hash) que expiran a las 12 horas, aislamiento entre docentes, registro protegido por código institucional, límite de intentos de inicio de sesión y de envíos por conexión, límite de 512 KB por envío, validación del informe, CORS restringido a los orígenes configurados y cabeceras de seguridad.

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

## Protección de datos personales

El servidor guarda el nombre y el curso que escribe el estudiante y el contenido de su informe. En Colombia aplican la Ley 1581 de 2012 y sus normas reglamentarias, con protección reforzada para datos de niños, niñas y adolescentes. Antes de usarlo, la institución debe:

1. Definir quién es el responsable del tratamiento de los datos y su política de tratamiento.
2. Obtener las autorizaciones correspondientes de acudientes cuando se requieran.
3. Limitar el acceso al servidor y definir cuánto tiempo se conservan los informes (los docentes pueden eliminar cursos e informes).

Esta guía no es asesoría jurídica; consulte con el área encargada de la institución.

## Limitaciones conocidas

- No hay recuperación de contraseña por correo (requiere un servicio de correo); el administrador puede borrar la cuenta en la base de datos para que el docente la cree de nuevo.
- El límite de intentos se guarda en memoria y se reinicia al reiniciar el servidor; varios estudiantes detrás de la misma red del colegio comparten el límite de envíos (120 cada 10 minutos por IP, pensado para un salón completo detrás de la misma red; ajustable en `createApp`).
- No hay panel de administración.
