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

## 2026-10-17 (PR #7 mergeado)

- Se mergeó en `dev` el PR #7 (`jeronimo/perfil-publico-y-cliente`): perfil
  público, locales, `/places`, usuario global con rutas sin verificación y
  `userName` en las fichas. Funcionó probado desde el frontend. GitHub borró
  las ramas mergeadas del remoto. Recordatorio: en la imagen Docker
  (`NODE_ENV=production`) las rutas `/users/*` no existen salvo
  `INSECURE_USER_ROUTES=true`.

## 2026-10-18 (ingreso real del cliente, PR A)

El frontend dejó `docs/PLAN-INGRESO-REAL.md` (en su repo) con el plan del
ingreso por código. Se implementó la parte que no necesita cuenta externa
(proveedor `dev`); el proveedor real queda para otro PR. **Escrito sin poder
compilar ni correr** (el entorno de la IA no ejecuta `tsc`, Prisma ni el
servidor).

Decisiones, tomadas con el usuario y distintas del plan donde se indica:

- **Un solo token opaco** guardado con hash (sha256) en `Session`, 60 días
  que se renuevan al usarlo; **sin JWT, sin `/auth/refresh` y sin
  `JWT_SECRET`** (el plan tenía JWT + refresh con rotación). Se revoca al
  instante con `POST /auth/logout`. Respuesta de `verify-code`: `{ token,
  expiresAt, user }`. Un 401 `INVALID_SESSION` significa volver a pedir código.
- **Proveedor intercambiable**: interfaz `OtpProvider` en
  `src/modules/auth/otp/`, hoy solo `dev` (acepta 000000). `check` devuelve
  `approved | incorrect | expired | too_many_attempts` (no un booleano) para
  poder distinguir los errores. Los 5 minutos y los 5 intentos por código los
  aplica el servicio (`OtpChallenge`), no el proveedor; los límites de pedidos
  (1 cada 30 s y 5 por hora por teléfono, 20 por hora por IP) se cuentan en
  `OtpRequest` con un candado por teléfono.
- **Producción se niega a arrancar con el proveedor `dev`** salvo
  `ALLOW_INSECURE_AUTH=true`, una bandera explícita para demos (el stage
  `develop` también corre con `NODE_ENV=production`). El log avisa en grande.
- Nuevas variables: `OTP_PROVIDER`, `OTP_CHANNEL`, `ALLOW_INSECURE_AUTH`,
  `SESSION_TTL_DAYS`, `TRUST_PROXY` (detrás de un proxy, para que los límites
  por IP funcionen).
- Endpoints: `GET /auth/config` (extra: avisa el proveedor y el `devCode` para
  que el front muestre la ayuda solo con `dev`), `POST /auth/request-code`
  (204, igual para teléfonos conocidos y desconocidos), `POST
  /auth/verify-code`, `POST /auth/logout`, `GET`/`PATCH /me` y `GET
  /me/balances` (misma forma que `/users/:id/balances`, siempre del usuario de
  la sesión). Códigos de error: `INVALID_PHONE` (400), `CODE_INCORRECT` y
  `CODE_EXPIRED` (422), `TOO_MANY_ATTEMPTS` y `TOO_MANY_REQUESTS` (429, con
  `details.retryAfterSeconds`), `OTP_PROVIDER_ERROR` (502), `INVALID_SESSION`
  (401).
- `User.phoneVerifiedAt` se marca con el primer código correcto. Si la
  persona ya existía porque un comercio la anotó, es el mismo usuario.
- Migración escrita a mano: `20261018120000_ingreso_real_sesiones_y_otp`
  (tablas `Session`, `OtpRequest` y `OtpChallenge`, y la columna nueva).
  Limpieza horaria de datos viejos en `server.ts`.
- **Tests con vitest** (`npm test`, carpeta `tests/`): ingreso y sesión,
  idempotencia y cobros simultáneos, y perfil público/locales/`/places`. Usan
  una base aparte (`platita_test`) y se niegan a correr contra una que no
  termine en `_test`; en el CI usan la base descartable del job. Hay que
  correr `npm install` y **commitear el `package-lock.json`** (el CI usa
  `npm ci`).
- Se mantienen `/users/*` e `INSECURE_USER_ROUTES` hasta que el front pase a
  `/me/*`; después se quitan (PR C). Twilio Verify queda para el PR B.

## 2026-10-18 (verificación del PR A)

- El usuario corrió, en Node 22: `npm install` (vitest y 43 paquetes),
  `npm run db:migrate` (aplicó `20261018120000_ingreso_real_sesiones_y_otp`,
  la base en sync), `npx tsc --noEmit` (sin errores) y `npm test`: **42 de 42
  tests en verde a la primera** (3 archivos, base `platita_test`, 5,9 s). Con
  eso quedan verificados por primera vez corriendo: ingreso por código y
  sesión, idempotencia (incluidos pedidos simultáneos con la misma clave),
  cobros simultáneos sin sobregiro, perfil público, locales y `/places`.
- `npm audit --omit=dev` da 0; `npm audit` da 6 (2 críticas, 1 alta, 3
  moderadas) en dependencias de desarrollo traídas por vitest 2; no se
  corrige con `--force`, queda como pendiente P2 en `TODO.md`.

## 2026-10-20 (proveedor Twilio Verify, PR B)

La cuenta de prueba de Twilio ya existe (la creó el usuario; el Auth Token
se pegó por error en el chat y se rotó enseguida, ya con otro valor).
Se escribió el proveedor real **sin poder compilar ni correr** (el entorno de
la IA no ejecuta `tsc` ni los tests):

- `src/modules/auth/otp/twilio.ts`: `createTwilioProvider(cfg, deps)` con
  `fetch` a `verify.twilio.com/v2/Services/{VA…}/Verifications` y
  `/VerificationCheck`, autenticación básica, timeout de 10 s y un `fetch`
  inyectable para los tests. Traduce los estados de Twilio al contrato de
  `OtpProvider` (ver `BACKEND.md`). `TwilioError` no guarda el mensaje de
  Twilio ni la causa de red (podrían traer el teléfono o la URL).
- `config.ts`: `OTP_PROVIDER` acepta `twilio`; nuevas `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID` y `TWILIO_LOCALE` (opcional).
  Con `twilio` son obligatorias (las tres) y los prefijos deben ser `AC` y
  `VA`; los mensajes de error nombran variables, no valores.
- `otp/index.ts`: los proveedores se arman una sola vez, la primera que se usa.
- `auth/service.ts`: si el proveedor falla al **comprobar** un código, 502
  `OTP_PROVIDER_ERROR` y se devuelve el intento que se había contado (antes
  habría sido un 500 genérico). El fallo al **mandar** ya existía.
- Tests nuevos: `twilio-provider.test.ts` (contrato con `fetch` simulado, sin
  salir a la red), `config.test.ts` (producción se niega a arrancar con `dev`
  salvo opt-in, y las credenciales de Twilio) y 3 casos de fallos del
  proveedor en `auth.test.ts`.
- Dos cosas que hay que confirmar contra la documentación de Twilio porque se
  escribieron de memoria: los códigos de error (404 sin verificación abierta,
  429/60202 por intentos) y que `Locale=es` esté soportado.
- Pendiente de verificar corriendo: `npm test`, y un SMS real al celular
  verificado de la cuenta de prueba.

## 2026-10-20 (verificación del proveedor Twilio)

- El usuario corrió `tsc --noEmit` (sin errores) y `npm test`: **72 de 72 en
  verde**. En una primera corrida con Node 20.12.2 fallaron 44 tests por
  `require() of ES Module .../cookie/dist/index.js from light-my-request`:
  `app.inject()` carga `cookie@2` (solo ESM), que necesita Node >= 22.12. No
  era un error del código: con `nvm use` (22.23.3) pasaron todos. Queda como
  mejora opcional subir `engines` a `>=22.12` (toca el lock).
- Sigue sin verificar: un SMS real con la cuenta de prueba de Twilio.

## 2026-10-21 (modo mixto de verificación)

El PR #8 (ingreso real con Twilio) se mergeó en `dev`. Rama nueva
`jeronimo/otp-numeros-reales` desde `origin/dev`. Pedido del usuario: seguir en
modo de prueba (cualquiera entra con 000000) pero que su propio número se
verifique de verdad con Twilio. **Escrito sin poder compilar ni correr.**

- Se descartó la idea literal ("000000 para todos, también para mi número"):
  entonces cualquiera podría entrar como el dueño del número y la verificación
  real no protegería nada. Se implementó al revés: 000000 vale para todos
  **menos** para una lista de teléfonos que pasan siempre por Twilio.
- `OTP_REAL_PHONES` (lista separada por comas, cualquier formato uruguayo,
  normalizada y sin repetidos). Con `OTP_PROVIDER=dev` arma
  `createRoutingProvider` (`otp/routing.ts`), que manda cada teléfono al
  proveedor de prueba o al real, tanto en `start` como en `check`. El servicio
  de auth no cambió.
- `config.ts` valida: pide las tres credenciales de Twilio, no se combina con
  `OTP_PROVIDER=twilio` y rechaza elementos que no son teléfonos uruguayos
  (nombra el elemento, nunca su valor). En producción sigue exigiendo
  `ALLOW_INSECURE_AUTH`.
- `GET /auth/config` suma `realPhonesConfigured` (booleano; no dice cuáles).
- Tests nuevos: `routing-provider.test.ts` (reparto entre proveedores y
  selección según la configuración, con `fetch` simulado) y 7 casos de
  `OTP_REAL_PHONES` en `config.test.ts`. Los tests fuerzan `OTP_REAL_PHONES`
  vacío para no depender del `.env` de quien los corre.
- Para el front: con el modo mixto el aviso del código 000000 sigue valiendo
  salvo para los teléfonos de la lista; no hay forma de saber cuáles desde la
  API a propósito.

- Se agregó `npm run db:delete-user -- <teléfono>` (`scripts/delete-user.ts`):
  borra a una persona y todo lo que cuelga de ella para repetir las pruebas
  de ingreso. Se niega a correr en producción o contra una base no local.
  Escrito sin correr. El teléfono se normaliza como en el resto de la API.

## 2026-10-21 (continuación: SMS real probado)

- El usuario probó de punta a punta, con el frontend ya adaptado a `/auth/*`, el
  ingreso real con Twilio Verify por SMS y el modo mixto: **funciona**. Antes de
  adaptar el front, el "código 000000" y la falta de SMS se debían a que el
  front usaba todavía el ingreso simulado (`POST /users`): lo mostró el script
  de borrado (0 sesiones y 0 pedidos de código para ese usuario).
- Queda por probar el canal WhatsApp de Twilio Verify. No requiere cambios de
  código: `OTP_CHANNEL=whatsapp` ya se pasa a Twilio como `Channel`. En la
  cuenta de prueba, según la documentación de Twilio, usa su plantilla de prueba
  y solo manda a números verificados; para producción hace falta un remitente de
  WhatsApp Business propio (la función de Verify con WhatsApp figura como beta
  pública). El precio a Uruguay no se pudo confirmar.

## 2026-10-22 (dueños de comercio y permisos)

Pedido del frontend para las cuentas de comercio: que la entrada decida sola a
qué área llevar a la persona y se pueda sacar `VITE_MERCHANT_ID`. Se hizo sobre
la rama `jeronimo/otp-numeros-reales` (que seguía con el modo mixto y el script
de borrado sin commitear). **Escrito sin poder compilar ni correr** (el entorno
de la IA no ejecuta `tsc`, Prisma ni los tests).

- **Dueño**: `Merchant.ownerId` (nulo, FK a `User` con `ON DELETE SET NULL`),
  migración `20261022120000_duenos_de_comercio` escrita a mano. Un solo dueño
  por comercio; una persona puede tener varios.
- **Permisos** (`src/modules/auth/access.ts`): un hook de la "zona del comercio"
  (`modules/index.ts`) cubre `/merchants`, `/customers`, `/bonus-rules` y
  `/locations`: `requireSession` (401 `INVALID_SESSION`) y
  `authorizeMerchantAccess` (403 `FORBIDDEN` si el comercio es de otra persona;
  404 si el comercio, cliente, regla o local no existe). Falla **cerrado**: una
  ruta protegida sin regla da 500. Un comercio sin dueño da 403 a todos. Los
  servicios no cambian: los permisos viven solo en el hook. `decorateRequest`
  de `auth` se movió a `modules/index.ts` para que lo vean las dos zonas.
- `POST /merchants` exige sesión y deja a la persona como dueña; `GET
  /merchants` lista solo los comercios de la sesión (antes listaba todos).
- **`GET /me` cambió de forma** (rompe al front actual, a pedido): ahora es `{
  user, merchants: [{ id, name }] }` en vez del usuario suelto. `PATCH /me` sigue
  devolviendo el usuario.
- `scripts/assign-merchant.ts` (`npm run db:assign-merchant`): asigna dueño a un
  comercio por teléfono y lista los que no tienen (`--list`). Solo corre contra
  una base local salvo `--force-remote`.
- Consola `/dev`: la sección de ingreso pasó al principio y todo lo del comercio
  lleva el token. Tests: los existentes ahora operan con la sesión de la dueña
  y hay `merchant-access.test.ts` (401, 403 en todas las rutas del comercio
  ajeno, 404, comercios sin dueño, reasignación, `/places` público, preflight
  de CORS y la falla cerrada).
- Decisiones propias (no pedidas): 404 para lo que no existe y 403 solo para lo
  que existe y es ajeno; sin flag de transición (el área del comercio del front
  deja de andar hasta que mande el token); `GET /merchants` ya no lista todos.

## 2026-10-22 (verificación de los dueños de comercio)

- El usuario corrió `npm run db:migrate` (aplicó `20261022120000_duenos_de_comercio`,
  base en sync), `tsc --noEmit` (sin errores) y `npm test` con Node 22.23.3: **99 de
  99 tests en verde** (7 archivos). Una primera corrida con Node 20 había fallado
  59 tests por el mismo motivo de siempre (`cookie@2`, necesita Node >= 22.12), no
  por el código. Quedan verificados por primera vez: los permisos del comercio
  (401/403/404, falla cerrado, comercios sin dueño y reasignación), el modo mixto
  y el preflight de CORS sin sesión.
- Pendiente: probarlo con el frontend (que mande el token y use `GET /me`) y el
  preflight en el navegador real.

- La rama de trabajo se llamaba `jeronimo/otp-numeros-reales` (nombre del modo
  mixto, con el que empezó) pero pasó a incluir también los dueños de comercio, un
  tema distinto y mayor. Se renombró (todavía sin subir) a
  `jeronimo/duenos-de-comercio-y-modo-mixto` y se decidió un solo PR con los dos
  temas, porque comparten archivos (`auth/routes.ts`, tests y docs).
