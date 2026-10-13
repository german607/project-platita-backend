# Imagen de la API de Platita. La publica el workflow de paquetes
# (.github/workflows/packages.yml) y se valida en cada PR (ci.yml).
#
# Uso:
#   docker run -e DATABASE_URL=... -p 3000:3000 <imagen>
#   docker run -e DATABASE_URL=... <imagen> npx prisma migrate deploy   # migraciones

# --- build: dependencias completas, cliente de Prisma y compilación ---
FROM node:22-bookworm-slim AS build
# Prisma necesita openssl para elegir su motor.
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY prisma ./prisma
RUN npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# --- runtime: lo mínimo para correr y migrar ---
FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000

# Se copian las dependencias de build tal cual: incluyen la CLI de Prisma
# (para `prisma migrate deploy`) y el cliente ya generado.
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --chown=node:node prisma ./prisma
COPY --chown=node:node package.json ./

USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
