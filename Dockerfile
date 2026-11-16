# syntax=docker/dockerfile:1
#
# Back de Perdidos y adopciones (Express 5 + Mongoose).
#   target "dev"  -> usado por docker-compose (hot reload con nodemon)
#   target "prod" -> imagen mínima para producción (Render sigue usando su build de Node;
#                    este target solo se usa si algún día se migra a despliegue por Docker)

FROM node:22-bookworm-slim AS base
WORKDIR /app
# mongodb-memory-server intenta bajar un binario de Mongo al instalar; en Docker usamos el contenedor mongo
ENV MONGOMS_DISABLE_POSTINSTALL=1
COPY package.json package-lock.json ./

# ---------- desarrollo ----------
FROM base AS dev
RUN npm ci
COPY . .
EXPOSE 3000
# -L: polling, necesario porque los archivos montados desde Windows no emiten eventos de cambio
CMD ["npx", "nodemon", "-L", "index.js"]

# ---------- dependencias de producción ----------
FROM base AS deps-prod
RUN npm ci --omit=dev

# ---------- producción ----------
FROM node:22-bookworm-slim AS prod
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps-prod /app/node_modules ./node_modules
COPY . .
RUN mkdir -p logs && chown -R node:node logs
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "index.js"]
