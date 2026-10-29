#!/usr/bin/env bash
# Build de Render (plan gratis): instala, compila y migra la base. Lo llama
# render.yaml. Es el equivalente a:
#   npm ci --include=dev && npx prisma generate && npm run build && npx prisma migrate deploy
# con un reintento en la migración, porque la base de Neon puede estar dormida y la
# primera conexión puede pasarse de tiempo (después de eso ya está despierta).
set -euo pipefail

# --include=dev: Render pone NODE_ENV=production en el build y, sin esto, no
# instalaría TypeScript ni los tipos que hacen falta para compilar.
npm ci --include=dev
npx prisma generate
npm run build

for intento in 1 2 3; do
  if npx prisma migrate deploy; then
    exit 0
  fi
  if [ "$intento" -eq 3 ]; then
    echo "La migración falló 3 veces: se cancela el deploy."
    exit 1
  fi
  echo "Falló la migración (intento $intento de 3); reintento en 10 segundos..."
  sleep 10
done
