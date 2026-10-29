# Despliegue: Render (API) + Neon (base) + Cloudflare Pages (front)

Guía para poner la API en internet con planes gratis. Lo que está **sin
verificar** está marcado; casi todo se escribió leyendo la documentación de cada
servicio y todavía no se desplegó nada (`TODO.md` §9).

```
Cloudflare Pages (front)  ──HTTPS──▶  Render (esta API, plan free)  ──▶  Neon (Postgres, plan free)
```

## 1. Los comandos de Render

El build y el arranque que propuso el front están bien, con un ajuste:

| | Comando | Comentario |
|---|---|---|
| **Build** | `bash scripts/render-build.sh` | Hace `npm ci --include=dev && npx prisma generate && npm run build && npx prisma migrate deploy`, con un **reintento** en la migración |
| **Start** | `npm start` | Es `node dist/server.js`; escucha en `0.0.0.0` y en el `PORT` que pone Render |
| **Node** | `NODE_VERSION=22` | Render elige la versión así: `NODE_VERSION` > `.node-version` > `.nvmrc` > `engines`. Se fija en el `render.yaml` |
| **Health check** | `/health` | No toca la base, a propósito (ver §5) |

Por qué cada parte:
- **`npm ci --include=dev`**: en el build Render pone `NODE_ENV=production` y, sin esto, no
  instalaría TypeScript ni los tipos que hacen falta para compilar.
- **`npx prisma generate`**: sobra (el cliente se genera solo al instalar) pero no molesta.
- **`prisma migrate deploy` dentro del build**: en el plan gratis Render **no tiene "pre-deploy
  command"** (es de planes pagos), así que las migraciones van al final del build. Si una
  migración falla, el deploy se cancela y sigue sirviendo la versión anterior.
- **El reintento**: el build despierta la base de Neon; si la primera conexión se pasa de
  tiempo, el segundo intento ya la encuentra despierta.
- No se usa el `Dockerfile` ni la imagen de GitHub Packages: Render construye desde el código.

El **`render.yaml`** de la raíz es el Blueprint: se crea con *New > Blueprint* apuntando al
repo. Trae el servicio con esos comandos, `plan: free`, `region: ohio` y las variables; las
que no llevan valor (`sync: false`) las pide Render al crearlo.

## 2. La base en Neon

1. Crear el proyecto en la región **AWS US East 2 (Ohio)**, la misma que `region: ohio` de Render.
2. Copiar la cadena de conexión **directa** (en el panel de Neon, con *Connection pooling*
   apagado: el host no lleva `-pooler`).
3. Agregarle los parámetros de conexión y usarla como `DATABASE_URL`:

```
postgresql://USUARIO:CLAVE@ep-xxxx.us-east-2.aws.neon.tech/neondb?sslmode=require&connect_timeout=15&pool_timeout=20
```

**Por qué la directa y no la "pooled"**: Prisma necesita una conexión directa para
migrar (`prisma migrate deploy`), y con una sola instancia gratis y poco tráfico no hace
falta el pooler. Si algún día se usa el pooler (host con `-pooler`), hay que agregarle
`pgbouncer=true` para la API y tener aparte una conexión directa para migrar (`directUrl` en el
`schema.prisma`, que hoy no está).

## 3. Variables de entorno

| Variable | Obligatoria | Valor |
|---|---|---|
| `NODE_VERSION` | sí (la fija el yaml) | `22` |
| `NODE_ENV` | sí (la fija el yaml) | `production` |
| `TRUST_PROXY` | sí (la fija el yaml) | `true`: detrás del proxy de Render, sin esto los límites por IP no sirven |
| `DATABASE_URL` | sí | la cadena de Neon de arriba |
| `CORS_ORIGINS` | sí | la URL del front en Cloudflare Pages, sin barra final (varias, separadas por coma) |
| `ALLOWED_MERCHANT_PHONES` | sí | teléfonos que pueden crear comercios. **Sin esto, en producción nadie puede** |
| `OTP_PROVIDER` | sí | `twilio` (SMS reales) o `dev` (solo demo, con `ALLOW_INSECURE_AUTH=true`) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` | con `twilio` | las credenciales; **nunca** en el repo |
| `APP_NAME` | no | nombre que se ve en el SMS y en `GET /auth/config` (hasta 30 caracteres; por defecto `Platita`) |
| `OTP_CHANNEL` | no | `sms` (por defecto) o `whatsapp` |
| `TWILIO_LOCALE` | no | idioma del SMS, por ejemplo `es` |
| `ALLOW_INSECURE_AUTH` | solo demo | `true`: cualquiera entra con `000000`. **No usar con datos reales** |
| `OTP_REAL_PHONES` | no | con `OTP_PROVIDER=dev`, teléfonos que pasan por Twilio igual |
| `INSECURE_USER_ROUTES` | no | dejar sin definir: en producción las rutas `/users/*` no existen |

**La API no arranca** en producción sin un proveedor de códigos real o `ALLOW_INSECURE_AUTH=true`
(lo valida `config.ts`), y avisa en el log si `ALLOWED_MERCHANT_PHONES` está vacía.

## 4. Primer arranque

1. Render corre el build: instala, compila y migra la base de Neon.
2. Los comercios que ya existan no tienen dueño. Desde tu máquina, con `DATABASE_URL`
   apuntando a Neon, se asignan con `npm run db:assign-merchant -- --force-remote <id> <teléfono>`.
3. Datos de ejemplo en Neon (solo para una demo): `npm run db:seed -- --yes`. **Nunca** con
   `NODE_ENV=production`: el seed se niega siempre. `db:reset-seed` también necesita `--yes` en
   una base remota y la **vacía por completo**: no usarlo sobre datos reales.

## 5. Qué pasa cuando se duerme todo

Hay dos cosas que se duermen, y se suman:

1. **Render (plan free)** suspende el servicio después de un rato sin tráfico; el primer pedido
   lo despierta y tarda (del orden de decenas de segundos). *No lo verifiqué en la
   documentación de Render: confirmar los tiempos reales en el panel.*
2. **Neon (plan free)** suspende el cómputo a los **5 minutos** sin consultas. Despertarlo tarda
   unos cientos de milisegundos y más si estuvo dormido mucho tiempo (más de 7 días, según su
   documentación).

**Qué hace Prisma al despertar.** El `connect_timeout` por defecto de Prisma es **5 segundos**, y si la
base todavía no despertó la conexión falla con `P1001` ("Can't reach database server"). Neon
recomienda `connect_timeout=15`, y `pool_timeout` (por defecto 10 s) también conviene subirlo: por eso
van en la cadena de conexión (§2). Prisma **no reintenta solo**. Además, una conexión que Neon cerró
al suspenderse puede dar un error puntual (`P1017`, "el servidor cerró la conexión") en el primer
pedido. Eso no lo pude confirmar en la documentación, así que está cubierto igual:

- **Al arrancar**, el servidor intenta conectar a la base **hasta 6 veces** (esperando 2, 4, 6… segundos,
  unos 30 en total) antes de abrir el puerto (`connectWithRetry`). Si no puede, termina con error.
- **Durante el uso**, un error de "base no disponible" (`P1001`, `P1002`, `P1008`, `P1017`) se
  devuelve como **`503 DATABASE_UNAVAILABLE`** con el header `Retry-After: 2`, en lugar de un 500
  genérico. Otros errores de Prisma (por ejemplo una contraseña mal puesta, `P1000`) siguen siendo
  500 a propósito, para no esconder una mala configuración.
- **`/health` no toca la base**: si lo hiciera, el health check de Render la mantendría despierta
  y gastaría las horas de cómputo gratis de Neon.

**Recomendación para el front**: un timeout generoso (60 s) para el primer pedido, mostrar un
"despertando el servidor…" y reintentar una o dos veces ante un `503`.

## 6. Cambiar el nombre de la app

`Platita` es el nombre de trabajo. Lo que sale de variables:

| Dónde | Variable | Qué cambia |
|---|---|---|
| Consola `/dev`, `GET /auth/config`, texto del SMS | `APP_NAME` | el nombre que se **muestra** (hasta 30 caracteres, con tildes y espacios) |
| `docker-compose.yml` | `APP_SLUG` (en el `.env`) | usuario, clave y nombre de la base de Postgres local (**solo la primera vez** que se crea el volumen); `DATABASE_URL` tiene que usar el mismo nombre |
| Nombre del contenedor y del volumen local | `COMPOSE_PROJECT_NAME` (en el `.env`) | cambiarlo crea un volumen **nuevo** (la base local queda vacía) |

**Lo que no sale de variables** (se cambia a mano cuando el nombre sea definitivo): `name` de
`package.json`, el nombre del repo y de la imagen en GitHub Packages, el servicio de `render.yaml`,
las bases de los workflows de CI, la base de los tests (`platita_test`) y los textos de los docs.

## 7. Pendiente de verificar

- Crear el Blueprint en Render y comprobar que el build, las migraciones y `/health` andan.
- Que `CustomFriendlyName` (el nombre de la app en el SMS) lo acepte la cuenta de Twilio.
- Los tiempos reales de despertar Render y Neon, y si aparece el `P1017` en el primer pedido.
- `connect_timeout` en las migraciones: la documentación de Neon no es concluyente sobre si el
  CLI de Prisma lo respeta; por eso el build reintenta.
