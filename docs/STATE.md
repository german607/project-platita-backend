# Estado actual — Platita

> Última actualización: 2026-10-22. Esto es una foto del presente, se
> reescribe cuando deja de ser cierto — no es historial (eso es
> [`CHANGELOG.md`](CHANGELOG.md)). Ver también [`../TODO.md`](../TODO.md)
> y la regla de mantenimiento en [`AGENTS.md`](AGENTS.md).

## Qué es

Saldo prepago cerrado y fidelización para comercios de barrio en
Uruguay. Plan de negocio completo en [`../README.md`](../README.md)
(secciones 1 a 10). La plataforma no custodia dinero: la carga se cobra
en la cuenta de Mercado Pago del comercio o en efectivo, y Platita solo
registra el saldo.

## Documentación y traspaso entre sesiones

Desde 2026-10-11 el proyecto lleva su propio registro en `docs/`, con el
mismo patrón que `iwant` y `cajon`: `CLAUDE.md` y `AGENTS.md` en la raíz
apuntan a [`AGENTS.md`](AGENTS.md), que define la regla obligatoria
(registrar cada cambio en `STATE`, `CHANGELOG` y `TODO.md` en el mismo
cambio) y el orden de lectura. Las reglas viven solo en `docs/AGENTS.md`.
Las ramas de Jerónimo ya se mergearon en `dev` por PR y GitHub las borró
del remoto: `jeronimo/contexto-y-docs` (PR #1), `jeronimo/reajustes-para-front`
(PR #6) y `jeronimo/perfil-publico-y-cliente` (PR #7, 2026-10-17). Cada
tarea nueva sale de `origin/dev` actualizado (`git fetch --prune`). Este repo
no firma commits (`commit.gpgsign false`, con la identidad personal vía
`~/.gitconfig-personal`); la firma GPG de la configuración global solo
aplica fuera de las carpetas personales.

**Trabajo de Germán Pereira (publicado en `origin/main` y `origin/dev`,
2026-10-11):** `TODO.md` segmentado por área con prioridades P0/P1/P2,
tres skills de roles en `.claude/skills/` (Product Owner, Backend
Engineer, QA) y notas de sesión en `docs/sesiones/`. Se unificó con
este sistema: `TODO.md` es **el único backlog** (se borró
`docs/BACKLOG.md` y sus ítems se pasaron al TODO), la tabla de
endpoints vive solo en `docs/BACKEND.md` (el README apunta ahí) y los
skills y `docs/AGENTS.md` se refieren a los mismos archivos. Se
tocaron los skills de Germán solo para corregir referencias
desactualizadas (rutas, backlog); conviene que los revise.

## Ramas y CI/CD

La rama de integración es **`dev`** (decidido por Germán el 2026-10-11).
Cada tarea va en `feature/...` desde `dev` y vuelve por PR; `main` solo
recibe PRs desde `dev` o `hotfix/*`. Detalle en [`CI.md`](CI.md).

Cada PR a `dev` o `main` pasa por dos checks de GitHub Actions: **CI**
(`ci.yml`: tipos, migraciones sobre Postgres, schema sin migración
pendiente, arranque y tests) y **Revisión IA** (`ai-review.yml`: Claude
revisa con las reglas de este repo, comenta, aprueba o pide cambios en el
PR como `github-actions[bot]`, y falla si hay bloqueantes).
Mergeados en `dev` con el PR #2. **El CI pasó en GitHub.** La rama por
defecto del repo es `dev`, porque la action de Claude solo corre si
`ai-review.yml` es idéntico al de la rama por defecto. La revisión
IA ya funcionó: aprobó el PR #3. Con el PR #4 (mergeado a mano) el
resumen de Claude sale como texto de la revisión y el error real aparece
en el check cuando Claude falla. El resumen ya se vio funcionar en el
PR #5. El secret de Claude y el permiso de Actions para
aprobar PRs ya están cargados en GitHub; falta la protección de ramas.

Paquetes: en la rama `feature/paquetes` hay un `Dockerfile` y
`packages.yml`, que publica la imagen en GitHub Packages al mergear
(`dev` → stage `develop`, `main` → stage `production`). En el PR #5 la
imagen se armó, migró y respondió `/health` en el CI; la publicación se
prueba con el primer merge. No hay servidor ni despliegue: las imágenes quedan
publicadas, listas para desplegar.

Limitación del entorno: la política de la organización (Cencosud) tiene
Remote Control deshabilitado, así que no se pueden aprobar permisos
desde el celular. Alternativas evaluadas en el CHANGELOG del
2026-10-11.

## Etapa

Pre-MVP. Hay un plan de negocio escrito y un backend con el dominio
básico completo en la API. **Todavía no se validó con comercios reales**
(el plan de la sección 10 del README, concierge de 4 semanas, no
arrancó).

## Backend (`src/`, `prisma/`)

Node + TypeScript, Fastify, Prisma sobre PostgreSQL, Zod. Arquitectura
modular (un directorio por área en `src/modules/`, con `schemas`,
`service` y `routes`), manejo de errores centralizado, paginación por
cursor y configuración validada. El mapa completo, las convenciones de
la API y cómo agregar endpoints o módulos está en
[`BACKEND.md`](BACKEND.md).

Endpoints: comercios (alta, listado, detalle, edición), reglas de
bonificación (alta, listado con `timesUsed`, edición/desactivación, vista
previa del bono), clientes (alta por teléfono, listado con saldo y
búsqueda normalizada, detalle, edición, saldo, inactivos con saldo y
total) y libro mayor (carga con bono, cobro, ajuste, movimientos del
cliente y movimientos de todo el comercio). Cargas, cobros y ajustes
aceptan un header `Idempotency-Key` **opcional**.

**Pedido del frontend atendido (2026-10-13):** idempotencia opcional,
CORS por `CORS_ORIGINS`, búsqueda por teléfono normalizada y `?phone=`,
movimientos del comercio, saldo y total en inactivos, vista previa del
bono, `bonusRuleId` en los bonos, `name`/`description`/`timesUsed` en las
promos. **Decidido no hacer por ahora:** autenticación de comercios
(se posterga, no se toca) y unificar unidades (deuda técnica aceptada:
la API sigue recibiendo pesos y devolviendo centésimos). WhatsApp a
inactivos sigue sin construirse. Todo esto está **escrito pero sin
verificar corriéndolo** (ver abajo).

**Hito "lado del cliente" (2026-10-15, en curso; primera parte mergeada en `dev` con el PR #7 el 2026-10-17):** la web tendrá dos
áreas con la misma API, comercio y cliente (la persona que va a los
comercios; por ahora solo mira). Hecho en esta rama, **escrito y sin
verificar corriéndolo**: perfil público del comercio (`description`,
`photoUrl`, `category` con regla de 90 días, `visible`, `openingHours`),
locales (`Location`) y los endpoints públicos `GET /places` y
`GET /places/:merchantId`. **Usuario global (2026-10-16):** existe el modelo `User` (la persona,
identificada por teléfono) y cada ficha `Customer` de un comercio lo
referencia con `userId`. Hay rutas **sin verificación** (`POST /users`,
`GET`/`PATCH /users/:id`, `GET /users/:id/balances`) para armar y probar
el lado del cliente; solo existen fuera de producción
(`INSECURE_USER_ROUTES`). **Postergado por decisión del usuario
(2026-10-15, no se pide por ahora)**: ingreso del cliente por código de un
solo uso y sesión (`/auth/client/*`, `/me`), rate limiting, envío de
códigos (WhatsApp/SMS), subida de la foto y QR personal. Cuando exista
la sesión, `/me/balances` reusa la lógica de `users/service.ts`. Decisiones tomadas: un comercio solo aparece si
activa "Aparecer en la app" (apagado por defecto); la categoría no se
cambia antes de 90 días; un comercio puede tener varios locales y solo
cambia la dirección (texto, sin mapa); el saldo es del comercio y vale en
todos sus locales; `/places` es público (sin datos de clientes). El
ingreso real del cliente es **obligatorio antes de publicar**: sin
verificación cualquiera vería los saldos de cualquier número.

**Ingreso real del cliente (2026-10-18, verificado con el proveedor
`dev` por los tests):** código de 6 dígitos por mensaje y sesión (`/auth/*`, `/me/*`),
con el plan que armó el frontend (`PLAN-INGRESO-REAL.md` en su repo) y estas
decisiones: un solo token opaco guardado con hash (sin JWT ni refresh), 60
días que se renuevan al usarlo; códigos de 5 minutos y 5 intentos; límites
por teléfono e IP; proveedor intercambiable (`otp/`), hoy solo `dev`
(acepta 000000). Producción se niega a arrancar con `dev` salvo
`ALLOW_INSECURE_AUTH=true` (demos). **Dueños de comercio y permisos (2026-10-22, pedido del frontend; verificado por
los tests, falta probarlo con el front):** un comercio pertenece a una persona (`Merchant.ownerId`) y todo
lo de `/merchants`, `/customers`, `/bonus-rules` y `/locations` exige sesión y
ser la dueña (401 `INVALID_SESSION`, 403 `FORBIDDEN`, 404 si no existe).
`POST /merchants` deja a la persona de la sesión como dueña, `GET /merchants`
lista solo los suyos y `GET /me` devuelve `{ user, merchants }`. **Cambio que
rompe al frontend actual**: el área del comercio deja de andar hasta que mande
el token (y `GET /me` cambió de forma). Los comercios anteriores quedaron sin
dueño: se asignan con `npm run db:assign-merchant`. Esto adelanta el "Auth
para comercios" que se había postergado (`TODO.md` §2), pero con el ingreso por
código en lugar de email y contraseña.

**Quién puede crear comercios (2026-10-23, pedido del usuario; verificado por los
tests, falta probarlo con el front):** `ALLOWED_MERCHANT_PHONES` (lista de teléfonos en una variable de
entorno). Solo esos teléfonos pueden hacer `POST /merchants` (si no, 403
`MERCHANT_CREATION_NOT_ALLOWED`); sin lista, abierto en desarrollo y tests y
**cerrado en producción**. `GET /me` suma `canCreateMerchant`. No afecta a quien
ya es dueña de un comercio.

**Modo mixto (2026-10-21, probado por el usuario con el frontend y por los tests):** `OTP_REAL_PHONES` lista
teléfonos que se verifican de verdad con Twilio mientras el resto entra con
000000 (para probar con tu número sin perder la comodidad del código de
prueba). **Proveedor real (2026-10-20, mergeado en `dev` con el PR #8): Twilio Verify por SMS** (`otp/twilio.ts`,
verificado con `tsc` y con tests contra un `fetch` simulado, sin haber mandado
todavía un SMS de verdad). Falta probarlo con la cuenta de prueba y el celular, y quitar
`/users/*` cuando el front use `/me/*`. También se sumó vitest con tests de
ingreso, idempotencia y perfil/lugares.

**Seed de desarrollo (2026-10-22, verificado por los tests; falta correrlo a mano):** `npm run db:seed` carga
personas con teléfonos fijos (`+59899000001` dueña de dos comercios,
`+59899000002` solo cliente, `+59899000003` dueña de tres), cinco comercios
visibles y clientes con saldos y movimientos en fechas distintas, y se puede
repetir sin duplicar; `npm run db:reset-seed` vacía toda la base de desarrollo y
recarga. Ambos solo corren en local. Todos entran con `000000`. El `.env.example`
nuevo quedó en `docs/env.example.txt` para copiar a mano (la sesión de la IA no
puede editar `.env.example`).

Consola de pruebas local en `GET /dev` (`src/dev/console.ts`), con todos
los endpoints en orden de uso; solo si `NODE_ENV !== "production"`.

### Puerto y despliegue

La API escucha en `PORT` (default 3000, `0.0.0.0`). En esta máquina el
3000 lo ocupa `iwant-backend` (`~/iwant/iwant-backend`), por lo que
`npm run dev` falla con `EADDRINUSE` (2026-10-13). No es un bug del
código: se corre con `PORT=3001 npm run dev` (o `PORT=3001` en el `.env`,
que no se versiona). No se mata el proceso de `iwant`.
**Verificado por el usuario (2026-10-13):** con `PORT=3001` el servidor
levanta y `GET /dev` responde 200. En la misma corrida `POST /merchants`
dio 500 (`PrismaClientInitializationError`, no alcanza `localhost:5432`):
Postgres no estaba levantado. Se levanta con `docker compose up -d` y
`npm run db:migrate` (README). Pendiente de confirmar que con la base
arriba el flujo anda.

**CORS:** `@fastify/cors` está en `package.json` y se activa solo si
`CORS_ORIGINS` (lista separada por comas, validada en `src/config.ts`)
no está vacía; nunca `*`. Falta `npm install` en cada máquina y probarlo
con el frontend. Hay que sumar la variable a `.env.example` (no pudo
editarlo la IA por una restricción del entorno).

### Qué está verificado y qué no

- **Verificado (2026-10-11)**, antes del refactor a módulos: las
  dependencias se instalan, la migración inicial se aplica sobre
  Postgres en Docker, el servidor levanta y la consola `/dev` anduvo en
  el navegador. El puerto 3000 de esta máquina lo ocupa `iwant-backend`,
  así que Platita se corre con `PORT=3001`.
- **Verificado después del refactor**: `tsc --noEmit` pasa sin errores
  y la migración de los índices (`segunda_parte`) se aplicó.
- **Verificado el 2026-10-13 (por el usuario)**: `npm install`
  (instaló `@fastify/cors`), `npm run db:migrate` aplicó
  `20261013150000_idempotencia_y_origen_de_bonos` y Prisma informa la base
  en sync con el esquema (el SQL escrito a mano coincide), y `tsc
  --noEmit` no mostró errores. **Sigue sin correrse** la lógica nueva
  (idempotencia, vista previa, movimientos del comercio, búsqueda por
  teléfono, inactivos, CORS).
- **Node:** el proyecto pide Node >= 22 (`engines` en `package.json` y
  `.nvmrc`), igual que el Dockerfile y el CI. `@fastify/cors` trae
  `cookie@2.0.1`, que lo exige; con Node 20 solo daba un warning
  `EBADENGINE`. Con `nvm use` se elige la versión sola.
- **Verificado el 2026-10-15 (por el usuario)**: `npm run db:migrate`
  aplicó `20261015120000_perfil_publico_y_locales` y Prisma informa la base
  en sync (el SQL escrito a mano coincide con el esquema), y `tsc
  --noEmit` no mostró errores. **Sigue sin correrse** la lógica nueva:
  perfil público (regla de categoría, visibilidad), locales y `/places`.
- **Escrito el 2026-10-17 y sin verificar**: `userName` en las fichas de
  cliente (ver CHANGELOG). Solo cambia consultas, sin migración.
- **Verificado el 2026-10-20 (por el usuario, Node 22.23.3)**: `tsc --noEmit`
  sin errores y `npm test`: **72 de 72 tests en verde** (5 archivos): los 42
  de antes más el proveedor de Twilio con `fetch` simulado, las reglas de
  arranque de la configuración y los fallos del proveedor en el ingreso.
  **Los tests necesitan Node >= 22.12**: con Node 20, `app.inject()` falla al
  cargar `cookie@2` (módulo ESM) y se rompen los 44 tests que lo usan.
- **Verificado el 2026-10-18 (por el usuario, Node 22)**: `npm install`,
  `npm run db:migrate` (aplicó `20261018120000_ingreso_real_sesiones_y_otp`
  y la base está en sync), `tsc --noEmit` sin errores y **`npm test`: 42 de
  42 tests en verde** (`tests/auth.test.ts`, `idempotency.test.ts` y
  `places.test.ts`, contra la base `platita_test`). Eso verifica el ingreso
  por código con el proveedor `dev` (límites, intentos, vencimiento,
  sesión, `/me`), la idempotencia, los cobros simultáneos, el perfil
  público, los locales y `/places`. **Sin verificar todavía**: el ingreso
  con el frontend real, un proveedor real de códigos, y lo que los tests no
  cubren (vista previa del bono, movimientos del comercio, búsqueda por
  teléfono, inactivos, el relleno de la migración `usuarios_globales` sobre
  datos reales y las rutas `/users` con `INSECURE_USER_ROUTES=false`).
- `npm audit --omit=dev` da 0 vulnerabilidades; `npm audit` muestra 6 en
  herramientas de desarrollo de vitest 2 (no llegan a producción).
- **Verificado el 2026-10-16 (por el usuario)**: `npm run db:migrate` aplicó
  `20261016120000_usuarios_globales` (con su relleno de usuarios) y Prisma
  informa la base en sync, y `tsc --noEmit` no mostró errores. **Sigue sin
  correrse** la lógica del módulo `users` ni el alta de ficha con usuario.
- **Escrito y sin verificar en ejecución**: los endpoints nuevos, el
  bloqueo de cobros simultáneos, la normalización de teléfonos y la
  paginación. No se recorrió el flujo completo. Ver la lista "Verificar
  primero" del [`TODO`](../TODO.md) (los ítems `[~]`).

## No existe todavía

- Autenticación de comercios (hoy cualquiera con un id puede operar; postergada a propósito).
- WhatsApp (mensaje de saldo y campañas).
- Frontend / panel del mostrador, QR.
- Proveedor real de códigos (Twilio).
- Tests de los módulos de ledger, bonificaciones y clientes, y de aislamiento
  entre comercios (hoy hay tests de ingreso, idempotencia y perfil/lugares).

## Decisiones abiertas

- Si el modelo de saldo cerrado es suficiente a nivel legal (Banco
  Central y defensa del consumidor, incluyendo qué pasa si el comercio
  cierra). Pendiente de abogado y contador.
- Cuánto backend construir antes de validar con el concierge del README
  §10.
- La API recibe pesos y devuelve centésimos: deuda técnica aceptada, se unifica más adelante en un cambio coordinado con el frontend.
- El usuario manifestó dudas sobre partes del plan (a precisar en la
  próxima sesión); cuando se concreten, registrarlas acá.
