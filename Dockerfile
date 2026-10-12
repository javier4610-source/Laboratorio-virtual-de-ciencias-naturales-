# Servidor del Laboratorio Virtual (Render, Railway o cualquier servicio con contenedores).
# Solo usa módulos de Node.js; la base de datos SQLite vive en un volumen persistente montado en /data.
FROM node:22-alpine
ENV NODE_ENV=production \
    PORT=8787 \
    DB_PATH=/data/laboratorio.db
WORKDIR /app
COPY server ./server
RUN mkdir -p /data && chown -R node:node /data /app
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:${PORT}/api/salud || exit 1
CMD ["node", "--disable-warning=ExperimentalWarning", "server/index.mjs"]
