# Cronología

Registro cronológico de lo que se hizo, en orden. A diferencia de
[`STATE.md`](STATE.md) (foto del presente), esto **no se reescribe**:
las entradas viejas quedan tal cual, aunque algo después haya cambiado
(eso se anota como una entrada nueva, no editando la vieja). Ver la
regla de mantenimiento en [`AGENTS.md`](AGENTS.md).

## Antes de 2026-10-11 (historial de git)

- Commit `59ddf41`: modelo de negocio (README) y esqueleto inicial del
  backend (Fastify + Prisma, 4 tablas, 5 endpoints de dominio).
- Commit `30afb55`: se quitó del README la sección de origen de la idea.

## 2026-10-11

- Se leyó el proyecto completo (README, schema, rutas) para
  contextualizar; no se ejecutó el código.
- Se creó la rama `jeronimo/contexto-y-docs`.
- Se armó el sistema de documentación para traspaso entre sesiones/IAs,
  siguiendo el patrón de los proyectos `iwant` y `cajon`: `CLAUDE.md` y
  `AGENTS.md` en la raíz como punteros, y `docs/AGENTS.md` (reglas),
  `STATE.md`, `BACKLOG.md`, `CHANGELOG.md` y `BACKEND.md`.
- Se relevaron y registraron en `BACKLOG.md` los problemas del código
  actual (doble gasto en cobros, falta de auth, teléfonos sin normalizar,
  etc.).
- Se intentó activar Remote Control para aprobar permisos desde el
  celular: la política de la organización (Cencosud) lo tiene
  deshabilitado, no se pudo. Alternativas conversadas: reducir
  permisos con la skill `fewer-permission-prompts`, modo auto, o sesión
  en la nube (sin evaluar contra la política). La Mac se mantuvo
  despierta durante la sesión.
- Se agregó una consola de pruebas local en `GET /dev`
  (`src/dev/console.ts`, registrada en `src/server.ts` solo fuera de
  producción) y el script `db:studio` en `package.json`. No se pudo
  verificar: se denegó la instalación de dependencias, así que no hay
  typecheck ni prueba en navegador.
- Se levantó el proyecto en local (el usuario corrió `docker compose up`,
  `npm install`, `db:migrate` y `dev`). Se creó y aplicó la primera
  migración `20261011165241_primeramigracion_jero`. El puerto 3000
  estaba ocupado por `iwant-backend`, así que se usó `PORT=3001`.
- `GET /` redirige a `/dev` (solo fuera de producción) y la consola
  avisa si falta completar `merchantId`/`customerId` antes de enviar.
- Probando la consola aparecieron dos bugs del backend (id vacío → 200;
  comercio inexistente → 500), registrados en `BACKLOG.md`.

## 2026-10-11 (continuación)

- Probada la consola `/dev` por el usuario: anduvo, pero algunos
  endpoints fallaron (id vacío → 200; comercio inexistente → 500).
- Se decidió seguir en la rama `jeronimo/contexto-y-docs` **sin
  commitear** por ahora.
- Refactor a arquitectura modular para poder crecer hacia producción:
  `src/app.ts` (`buildApp`, sin escuchar), `src/config.ts` (variables de
  entorno validadas, carga `.env` con `process.loadEnvFile`),
  `src/lib/*` (errores, manejador central, schemas compartidos,
  paginación, dinero, teléfono) y `src/modules/{merchants,bonus-rules,
  customers,ledger}` con `schemas/service/routes` cada uno. Se borró
  `src/routes/customers.ts`.
- Endpoints nuevos: `POST/GET /merchants`, `GET/PATCH /merchants/:id`,
  `POST/GET /merchants/:merchantId/bonus-rules`, `PATCH /bonus-rules/:id`,
  `GET /merchants/:merchantId/customers`, `GET/PATCH /customers/:id`,
  `POST /customers/:id/adjustments`, `GET /customers/:id/transactions`.
- Cambios de comportamiento en endpoints existentes: ids inexistentes
  dan 404 (antes 200 con saldo 0 o 500); errores siempre con la forma
  `{ error, code, details? }` (el saldo insuficiente ahora trae el saldo
  en `details`); cargas y cobros responden 201 con el movimiento;
  `/inactive` devuelve `{ data, nextCursor }` en vez de un arreglo y ya
  no lista clientes recién creados; carga y cobro actualizan
  `lastVisitAt`; el teléfono se normaliza a `+598XXXXXXXX` y se rechaza
  si no es uruguayo; los cobros y ajustes corren en una transacción que
  bloquea al cliente (`FOR UPDATE`) para evitar el doble gasto.
- Esquema: se agregaron 3 índices (`Customer(merchantId, lastVisitAt)`,
  `BonusRule(merchantId, active)`, `Transaction(customerId, createdAt)`).
  Falta crear la migración.
- La consola `/dev` se reescribió con todos los endpoints agrupados en
  orden de uso y variables que se completan solas.
- **Nada de lo anterior se compiló ni se corrió**: se denegaron los
  comandos `tsc`/`prisma validate`. Ver "Verificar primero" en el
  backlog.
- Se agregó `docs/EJEMPLO.md`: un caso narrado (peluquería de Don Pablo,
  cliente Juancito, promo de 3 cortes por $1.000) que pasa por los 18
  endpoints, con una tabla resumen. Las respuestas son ilustrativas,
  armadas leyendo el código y no capturadas de una ejecución real. Se
  sumó a `docs/AGENTS.md` en el orden de lectura y en la regla de
  mantenimiento.
- `tsc --noEmit` pasó sin errores tras el refactor y el usuario aplicó la
  migración de los índices (`20261011173315_segunda_parte`). Se dejó todo
  en staging para el primer commit de la rama `jeronimo/contexto-y-docs`
  (documentación para traspaso, arquitectura modular, endpoints nuevos,
  consola `/dev` y migraciones). El commit falló desde la sesión de la IA
  porque git firma con GPG y el entorno no puede leer `~/.gnupg`; lo
  tiene que hacer el usuario desde su terminal. Sin push.
- Se bajó el trabajo de Germán Pereira (`origin/dev`: `TODO.md`, skills de
  roles, `docs/sesiones/`; `origin/main`: `TODO.md` y README) y se
  unificó con este sistema de documentación en el merge de `origin/dev`
  sobre la rama `jeronimo/contexto-y-docs`:
  - `TODO.md` pasó a ser el único backlog; `docs/BACKLOG.md` se borró
    (su historial queda en git) y sus ítems pendientes se pasaron al
    TODO. Se marcó lo ya implementado (`[x]` lo verificado, `[~]` lo
    implementado sin verificar corriéndolo).
  - La tabla de endpoints del README se reemplazó por un link a
    `docs/BACKEND.md`, para tener una sola copia.
  - `docs/AGENTS.md`, `CLAUDE.md` y `AGENTS.md` ahora apuntan a
    `TODO.md`, mencionan los skills de roles y las notas de sesión.
  - Se corrigieron en los skills de Germán las referencias a
    `src/routes/*`, al backlog y al README como lugar de la tabla de
    endpoints.
  - `docs/sesiones/2026-10-11.md` quedó como lo escribió Germán; su tabla
    de fallas menciona `src/routes/customers.ts`, que ya no existe (las
    dos fallas críticas fueron atendidas: ver `TODO.md` §3).
- Aclaración sobre la entrada anterior del commit: el repo **no** necesita
  firma GPG. La firma de `~/.gitconfig` (clave de trabajo) no aplica a
  `~/antes_proyecto/`, que usa `~/.gitconfig-personal` con
  `commit.gpgsign false`; los commits `6c9388c` y `a7dfce0` están sin
  firmar y con la identidad personal. El fallo inicial se produjo cuando
  la configuración del repo todavía resolvía la firma activada. Con la
  configuración actual la IA puede commitear.

## 2026-10-12

- Rama `feature/ci-cd` (desde `dev`): pipeline de PRs.
  - `.github/workflows/ci.yml`: en PRs y pushes a `dev`/`main` instala
    con `npm ci`, chequea tipos, aplica migraciones sobre Postgres 16,
    falla si `schema.prisma` tiene cambios sin migración (`prisma migrate
    diff`), compila, levanta la API y prueba `/health`, y corre los tests
    si existen. Un job aparte rechaza PRs a `main` que no vengan de `dev`
    o `hotfix/*`.
  - `.github/workflows/ai-review.yml`: Claude
    (`anthropics/claude-code-action@v1`) revisa cada PR no borrador con
    las reglas de `docs/AGENTS.md` y los skills, deja comentarios
    **[Bloqueante]**/**[Sugerencia]** y un resumen, y devuelve un
    veredicto estructurado; el check falla si hay bloqueantes. El
    veredicto se pasa por variable de entorno para evitar inyección en el
    script.
  - `.github/pull_request_template.md` con el checklist de las reglas.
  - `docs/CI.md`: flujo de ramas, qué valida cada check y cómo configurar
    el secret y la protección de ramas.
- Se registró `dev` como rama de integración (estaba abierto en `STATE.md`).
- Verificación: ambos workflows pasan actionlint y el paso del veredicto se
  probó en local con resultados de ejemplo. Los pasos de npm/Prisma no se
  pudieron correr en local porque el entorno de la IA no tiene acceso al
  registro de npm; se validan en la primera corrida en GitHub.
- `ai-review.yml`: además del check, la revisión deja una revisión formal en
  el PR con el token de Actions (`github-actions[bot]`): **Approve** sin
  bloqueantes, **Request changes** con bloqueantes. Germán habilitó en
  GitHub el secret de Claude y "Allow GitHub Actions to create and approve
  pull requests". Lógica del veredicto probada en local con `gh` simulado
  (aprobar, cambios requeridos, sin veredicto, aprobación rechazada).
- Se abrió el PR #2 (`feature/ci-cd` → `dev`), primera corrida del pipeline:
  - **CI: pasó entero en GitHub** (`npm ci`, tipos, migraciones sobre
    Postgres 16, schema sin migración pendiente, build y `/health`). Es la
    primera verificación de esos pasos fuera de la máquina de Jerónimo.
  - **Revisión IA: no corrió.** La action se saltea si `ai-review.yml`
    difiere del de la rama por defecto (`main`), donde todavía no existe.
    Es una medida de seguridad de la action, no un error de configuración.
  - El paso del veredicto ahora distingue ese caso y lo explica, en vez de
    sugerir que falta el secret.
  - `actions/checkout` y `actions/setup-node` pasaron a `v5` por el aviso de
    Node 20 deprecado en los runners.
  - Recomendación registrada en `docs/CI.md`: rama por defecto del repo =
    `dev`, para que los PRs lleven el mismo workflow que la rama por defecto.
- Germán puso `dev` como rama por defecto del repo y mergeó el PR #2 a
  mano. Rama `feature/estado-ci`: se actualizan `TODO.md` y `STATE.md` con
  eso; su PR es la primera prueba real de la revisión IA.
- PR #3: la primera corrida de la revisión IA falló en 18 segundos sin
  veredicto; era el secret. Germán lo reemplazó y al re-correr **Claude
  revisó y `github-actions[bot]` aprobó el PR**. Es la primera revisión IA
  real. Claude no publicó el comentario de resumen que pedía el prompt.
- Rama `feature/revision-ia-resumen` (cambia `ai-review.yml`, así que
  necesita merge manual):
  - El resumen ya no depende de que Claude lo publique: viene en la salida
    estructurada y el workflow lo usa como texto de la revisión
    (approve/request changes). Se quitó `gh pr comment` de las
    herramientas permitidas.
  - Si Claude falla, el check muestra el error real (resultado, turnos y
    herramientas denegadas) sacado de `$RUNNER_TEMP/claude-execution-output.json`,
    porque los logs no siempre se pueden abrir desde donde se diagnostica.
  - Probado en local con `gh` simulado: sin registro, error de credencial,
    aprobado, cambios requeridos y workflow modificado.

## 2026-10-13

- `npm run dev` falló con `EADDRINUSE` en `0.0.0.0:3000`. Causa: el puerto
  lo tiene `iwant-backend` (proceso node con cwd `~/iwant/iwant-backend`),
  no Platita. No se tocó código ni se mató el proceso ajeno; la solución
  es correr `PORT=3001 npm run dev` (ya documentado en el README). No se
  pudo verificar corriéndolo: el entorno de la IA no pudo levantar el
  servidor.
- Se anotó en `STATE.md` (sección "Puerto y despliegue") y en `TODO.md`
  §9. Sobre CORS: no está configurado y hoy no hace falta; se detalló en
  `STATE.md` y en `TODO.md` §10 qué hacer cuando haya frontend en otro
  origen. `.env` y `.env.example` no se editaron (el entorno no los
  deja tocar).

## 2026-10-13 (continuación)

- El usuario corrió `PORT=3001 npm run dev`: el servidor levanta y `/dev`
  responde 200, con lo que la solución del puerto queda verificada. Un
  `POST /merchants` desde la consola devolvió 500 por
  `PrismaClientInitializationError`: Postgres no estaba corriendo en
  `localhost:5432`. No es un error de código; hay que levantar la base
  con `docker compose up -d` y aplicar `npm run db:migrate`. La IA no
  pudo hacerlo (sin acceso al socket de Docker en su entorno).
- Mejora pendiente (no hecha): que un fallo de conexión a la base
  devuelva 503 con un mensaje claro en vez de 500 genérico.

- Rama de trabajo renombrada a `jeronimo/reajustes-para-front` (desde
  `origin/dev`). Se borró en local `jeronimo/contexto-y-docs`, ya mergeada
  en `dev`. Las ramas remotas de `feature/*` no se tocaron.

## 2026-10-13 (pedido del frontend)

El frontend (repo `project-platita-frontend`) pidió completar el diseño.
Se implementó, **sin poder compilar ni correr nada** (el entorno de la IA
no pudo ejecutar `tsc`, Prisma ni el servidor; todo se revisó leyendo):

- **Idempotencia opcional** en `POST /customers/:id/topups`, `/charges` y
  `/adjustments` con el header `Idempotency-Key`. Tabla nueva
  `IdempotencyKey` (único por cliente + clave, hash de operación y cuerpo,
  respuesta JSON, vence a las 48 h, limpieza horaria en `server.ts`). La
  clave se escribe en la misma transacción que el movimiento y con la fila
  del cliente bloqueada, así los pedidos simultáneos se serializan. Misma
  clave y cuerpo: respuesta guardada (201) con `Idempotent-Replayed:
  true`; otro cuerpo u operación: 422 `IDEMPOTENCY_KEY_REUSED`; los errores
  no se guardan. La carga ahora también bloquea la fila del cliente.
- **CORS** con `@fastify/cors` (agregado a `package.json`, falta `npm
  install`) y `CORS_ORIGINS` en `src/config.ts`.
- **Búsqueda de clientes**: `?search=` normaliza teléfonos (antes
  `099123456` no encontraba `+59899123456`) y `?phone=` filtra exacto sin
  crear. Helper `phoneSearchFragment` en `src/lib/phone.ts`.
- **`GET /merchants/:id/transactions?from&to&type`**: movimientos de todo el
  comercio con el cliente en cada fila (`from` inclusivo, `to` exclusivo).
- **`/inactive`** ahora trae `balance` por cliente y `total`.
- **`GET /merchants/:id/bonus-preview?amount=`**; la selección de la regla
  pasó a `findApplicableRule` (bonus-rules/service.ts), usada también por la
  carga real.
- **Bonos**: `Transaction.bonusRuleId`; `BonusRule.name` y `description`
  opcionales; `timesUsed` en el listado, alta y edición de reglas. Los
  bonos anteriores quedan con `bonusRuleId` nulo y no cuentan en
  `timesUsed`.
- Migración escrita a mano: `20261013150000_idempotencia_y_origen_de_bonos`.
- Consola `/dev`: campo `Idempotency-Key` y los endpoints nuevos.
- **No se hizo, a pedido del usuario:** autenticación (se posterga, no se
  tocó nada) y unificar unidades (deuda técnica documentada). WhatsApp a
  inactivos queda pendiente.
- Contrato existente sin cambios: listados `{ data, nextCursor }`, errores
  `{ error, code, details }`, 422 `INSUFFICIENT_BALANCE` con `details {
  balance, needed }`, montos en pesos de entrada y centésimos de salida.
  Cambios de forma, todos aditivos: `balance` en cada item de `/inactive`,
  `total` en `/inactive`, `name`/`description`/`timesUsed` en las reglas,
  `bonusRuleId` en los movimientos BONUS.

## 2026-10-13 (verificación parcial)

- El usuario corrió `npm install`, `npm run db:migrate` y `tsc --noEmit`: la
  migración `20261013150000_idempotencia_y_origen_de_bonos` se aplicó y
  Prisma informa la base en sync (el SQL escrito a mano coincide con el
  esquema); `tsc` no mostró errores. La lógica nueva sigue sin correrse.
- `npm install` avisó `EBADENGINE`: `cookie@2.0.1` (vía `@fastify/cors`)
  pide Node >= 22 y la máquina tiene 20.12.2. No bloquea; refuerza el
  pendiente de fijar la versión de Node.

- Rama `feature/paquetes`: paquetes por stage, pedido de Germán ("cada PR a
  dev genera un paquete en develop y main en prod").
  - `Dockerfile` multi-stage (Node 22 bookworm-slim, openssl para Prisma),
    corre como usuario `node`, `HEALTHCHECK` sobre `/health`. Incluye la CLI
    de Prisma para correr `prisma migrate deploy` con la misma imagen.
    `.dockerignore`.
  - `ci.yml`: job **Imagen Docker** en PRs: arma la imagen, corre las
    migraciones dentro del contenedor contra el Postgres del job y prueba
    `/health`.
  - `.github/workflows/packages.yml`: cuando el CI termina bien sobre un
    push a `dev` o `main`, publica la imagen en GHCR con tags por stage
    (`develop`/`develop-<sha>`; `production`/`latest`/`production-<sha>`)
    y la registra como deployment en el environment `develop` o
    `production`.
  - Se interpretó "cada PR" como cada PR **mergeado**: abrir un PR no
    publica nada.
  - Verificación: actionlint sin errores y lógica de tags probada en local.
    El build de la imagen no se pudo probar acá (sin daemon de Docker ni
    acceso a npm); lo valida el job Imagen Docker en el PR.

- Se corrigió en `STATE.md` y `TODO.md` la referencia al PR #4 como pendiente: ya está mergeado.
- PR #5: pasaron CI, **Imagen Docker** (la imagen se armó, corrió las
  migraciones dentro del contenedor y respondió `/health`) y la revisión IA,
  que aprobó con el resumen como texto de la revisión (primera vez que se ve
  el cambio del PR #4 funcionando).

- Se fijó la versión de Node: `"engines": { "node": ">=22" }` en
  `package.json` y `.nvmrc` con `22`, para coincidir con el Dockerfile y el
  CI y evitar el `EBADENGINE`. Cierra el pendiente de `TODO.md` §1.

## 2026-10-15 (hito: lado del cliente, partes 1 a 3)

Pedido del frontend para el área de clientes. Rama nueva
`jeronimo/perfil-publico-y-cliente` desde `origin/dev` (el PR #6 ya estaba
mergeado). **Escrito sin poder compilar ni correr nada** (el entorno de la
IA no ejecuta `tsc`, Prisma ni el servidor; se revisó leyendo):

- **Perfil público** en `Merchant`: `description` (280), `photoUrl`
  (http/https), `category` (enum `MerchantCategory`, nula hasta elegirla),
  `categoryChangedAt`, `visible` (default `false`; los comercios
  existentes quedan ocultos) y `openingHours` (JSON). Se edita con el
  `PATCH /merchants/:id` que ya existía y todos los GET del comercio lo
  devuelven (con los 7 días de horarios siempre).
  - Categoría: primera vez libre; después 90 días entre cambios, si no 422
    `CATEGORY_CHANGE_TOO_SOON` con `details.availableAt`. La misma
    categoría no cuenta como cambio.
  - `visible: true` exige un local activo y una categoría; si no, 422
    `PROFILE_INCOMPLETE` con `details.missing`. (La exigencia de categoría
    es una decisión de esta implementación: el pedido solo pedía el local,
    pero el filtro y la tarjeta de `/places` la necesitan.)
  - Horarios: `src/lib/opening-hours.ts` (validación `from < to`, sin
    superposición, tramos ordenados; `24:00` permitido como cierre).
- **Locales**: modelo `Location` y módulo `src/modules/locations/`
  (`GET`/`POST /merchants/:id/locations`, `PATCH /locations/:id`, sin
  DELETE). Decisión propia: no se puede dar de baja el único local activo
  de un comercio visible (422 `LOCATION_REQUIRED_WHILE_VISIBLE`), para no
  romper la regla de visibilidad; usa `lockMerchant` (nuevo, en
  `merchants/service.ts`) para que "poner visible" y "dar de baja" no se
  crucen.
- **Lugares públicos**: módulo `src/modules/places/` con `GET /places` y
  `GET /places/:merchantId`, sin sesión y con `select` explícito (nunca
  teléfono, plan, clientes ni saldos). Un comercio no visible da el mismo
  404 que uno inexistente. Orden por nombre con id de desempate.
- Migración escrita a mano: `20261015120000_perfil_publico_y_locales`
  (sin aplicar).
- Consola `/dev`: variable `locationId` y los endpoints nuevos.
- **Todavía no se hizo** (partes 4 a 7 del pedido): ingreso por código y
  sesión, `GET /me/balances`, subida de foto y QR personal. Quedan en
  `TODO.md` §12.
- Contrato existente sin cambios: todo lo nuevo son campos y endpoints
  nuevos (los GET/PATCH de comercio suman campos).

## 2026-10-15 (verificación parcial)

- El usuario corrió `npm run db:migrate` y `tsc --noEmit`: la migración
  `20261015120000_perfil_publico_y_locales` se aplicó, Prisma informa la base
  en sync (el SQL escrito a mano coincide) y `tsc` no mostró errores. La
  lógica nueva sigue sin correrse. Prisma ofreció actualizar a 8.0.0-rc; no
  se acepta (es un salto mayor y no es parte de este hito).

## 2026-10-15 (decisión: se posterga login y seguridad del cliente)

- El usuario decidió que **no se avanza por ahora** con el ingreso del
  cliente por código, la sesión (`/auth/client/*`, `/me`), `GET
  /me/balances`, el envío de códigos por WhatsApp o SMS ni el rate
  limiting: se prueba primero lo ya hecho (perfil público, locales y
  `/places`). Quedan en `TODO.md` §12 marcados como postergados. La
  advertencia sigue vigente: la app del cliente **no se puede publicar**
  sin la verificación real, porque sin ella cualquiera vería los saldos de
  cualquier número. Mientras tanto el frontend simula el ingreso.

## 2026-10-16 (usuario global, sin seguridad)

Al probar desde el frontend se vio que no había forma de saber los saldos
de "la persona" entre comercios: solo existían fichas `Customer` sueltas.
Se crea la estructura de usuario, sin tocar login ni seguridad (siguen
postergados). **Escrito sin poder compilar ni correr** (migración sin
aplicar):

- Modelo `User` (`phone` único normalizado, `name?`, `createdAt`) y
  `Customer.userId` obligatorio. La migración
  `20261016120000_usuarios_globales` crea un usuario por cada teléfono
  distinto (id con `gen_random_uuid()`, primer nombre anotado) y enlaza las
  fichas existentes antes de volver `userId` NOT NULL.
- `POST /merchants/:id/customers` ahora busca o crea el usuario del
  teléfono y cuelga la ficha de él. El nombre que anota el comercio solo
  siembra el nombre del usuario cuando es nuevo, nunca lo pisa.
- Módulo `src/modules/users/`: `POST /users` (busca o crea por teléfono),
  `GET`/`PATCH /users/:id` y `GET /users/:id/balances` (saldos en cada
  comercio con ficha, también con saldo 0, por última visita; del comercio
  solo `id`, `name`, `category`, `photoUrl`). La lógica recibe el id del
  usuario, así `/me/balances` la reusará con la sesión real.
- **Estas rutas no verifican nada**: quien conozca un teléfono ve sus
  saldos. Solo se registran si `INSECURE_USER_ROUTES` es verdadero (nueva
  variable; por defecto, activas fuera de producción y apagadas en
  producción). La imagen Docker corre con `NODE_ENV=production`, así que
  ahí no existen salvo que se fuerce la variable.
- Consola `/dev`: variable `userId` y la sección de usuarios.
- Decisión: los saldos del usuario incluyen comercios no visibles (es su
  propia plata); del comercio solo se expone el perfil público mínimo.

## 2026-10-16 (verificación parcial)

- El usuario corrió `npm run db:migrate` y `tsc --noEmit`: la migración
  `20261016120000_usuarios_globales` se aplicó (con el relleno de usuarios), Prisma
  informa la base en sync y `tsc` no mostró errores. La lógica de `users` y el
  alta de ficha con usuario siguen sin correrse.

- Se documentó en `BACKEND.md` (sección "Cómo se relacionan usuario, ficha
  y comercio") el modelo: User (la persona, por teléfono) → Customer (ficha
  por comercio, con el saldo de ese comercio) → Merchant; quién ve qué, y
  que cargar saldo va al comercio y todavía no lo hace el cliente.

## 2026-10-17 (userName en las fichas de cliente)

Pedido del frontend: mostrar "Juanito (Juan)", el nombre que el comercio le
puso al cliente y el que se puso la persona. Se agregó `userName` (el
`User.name`, puede ser `null`) a las respuestas que traen una ficha:
`POST /merchants/:id/customers`, `GET`/`PATCH /customers/:id`,
`GET /merchants/:id/customers`, `GET /merchants/:id/inactive` y el objeto
`customer` de `GET /merchants/:id/transactions`. Se pide con la misma
consulta (`include` de `user.name`), sin ir a `/users` por cliente, y sale
plano: nunca el objeto `user`. Campo nuevo y aditivo, sin migración. Los
demás campos y `name` no cambian. **Escrito sin poder compilar ni correr.**
