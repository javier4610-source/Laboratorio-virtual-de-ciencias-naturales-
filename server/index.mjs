// Punto de entrada: node server/index.mjs
// Variables de entorno:
//   PORT                 puerto (por defecto 8787)
//   DB_PATH              archivo SQLite (por defecto ./laboratorio.db)
//   REGISTRATION_CODE    código institucional para registrar docentes (obligatorio, ≥ 6 caracteres)
//   ALLOWED_ORIGINS      orígenes del sitio del laboratorio separados por coma, p. ej. https://colegio.github.io
import { createApp } from './app.mjs';

const port = Number(process.env.PORT ?? 8787);
const allowedOrigins = (process.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);

try {
  const { server } = createApp({
    dbPath: process.env.DB_PATH ?? 'laboratorio.db',
    registrationCode: process.env.REGISTRATION_CODE,
    allowedOrigins,
  });
  server.listen(port, () => {
    console.log(`Servidor del Laboratorio Virtual escuchando en el puerto ${port}`);
    if (allowedOrigins.length === 0) console.warn('Aviso: ALLOWED_ORIGINS está vacío; el navegador bloqueará las solicitudes desde el sitio del laboratorio.');
  });
} catch (e) {
  console.error(e.message);
  process.exit(1);
}
