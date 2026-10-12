# Publicar el servidor de seguimiento (Render)

El servidor permite que el docente vea en tiempo real a sus estudiantes: quién ingresa, su avance, puntajes,
análisis y conclusiones. El repositorio ya trae todo lo necesario (`Dockerfile` y `render.yaml`).

Costo aproximado: plan *Starter* de Render (unos USD 7 al mes) más 1 GB de disco persistente (unos USD 0,25 al mes).
Los valores exactos los muestra Render antes de confirmar.

## Pasos del docente (una sola vez, unos 10 minutos)

1. Entra a <https://render.com> y crea una cuenta con **«Sign in with GitHub»** (la misma cuenta de GitHub del repositorio).
2. En el panel de Render: **New → Blueprint**.
3. Elige el repositorio `Laboratorio-virtual-de-ciencias-naturales-` y la rama `claude/laboratorio-virtual-ciencias-skqars`.
4. Render lee el archivo `render.yaml` y muestra el servicio **laboratorio-virtual-servidor** con un disco de 1 GB.
   Pulsa **Apply** y agrega un medio de pago cuando lo pida.
5. Espera a que el estado diga **Live**. Copia la dirección del servicio (algo como
   `https://laboratorio-virtual-servidor.onrender.com`).
6. En el servicio, abre **Environment** y copia el valor de `REGISTRATION_CODE`: es el código para crear cuentas
   de docente. Guárdalo; no lo publiques.
7. En GitHub: repositorio → **Settings → Secrets and variables → Actions → Variables → New repository variable**:
   nombre `API_URL`, valor la dirección del paso 5. Con esto la página del laboratorio queda conectada al servidor
   en la siguiente publicación (o pídele al asistente que vuelva a publicar).
8. En el laboratorio: **Panel docente → Servidor**: crea tu cuenta con el código del paso 6, crea tus cursos y
   comparte con los estudiantes el código de 6 caracteres de cada curso.

## Comprobación

Abre `https://<tu-servicio>.onrender.com/api/salud` en el navegador: debe responder `{"ok":true,...}`.

## Copias de seguridad

Render guarda instantáneas diarias de los discos persistentes durante 7 días. Para una copia propia, desde la
consola del servicio (**Shell**): `cp /data/laboratorio.db /data/copia-$(date +%F).db`, o descarga el archivo.

## Alternativa: Railway

1. <https://railway.app> → **New Project → Deploy from GitHub repo** → elige el repositorio (usa el `Dockerfile`).
2. En el servicio: **Volumes → Add volume** con *mount path* `/data`.
3. **Variables**: `REGISTRATION_CODE` (un código largo y secreto), `ALLOWED_ORIGINS=https://javier4610-source.github.io`,
   `DB_PATH=/data/laboratorio.db`.
4. **Settings → Networking → Generate domain** y sigue desde el paso 7 de arriba.

## Protección de datos (Ley 1581 de 2012)

El servidor guarda el nombre o alias del estudiante, su curso y su trabajo en las prácticas. Antes de usarlo con
estudiantes, la institución debe definir quién es el responsable del tratamiento, publicar una política de
tratamiento de datos y obtener la autorización de los acudientes cuando se requiera. Se recomienda que los
estudiantes usen su nombre de pila y la inicial del apellido. Esta guía no es asesoría jurídica.
