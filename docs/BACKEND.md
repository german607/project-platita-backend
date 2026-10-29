# Backend — arquitectura, modelo de datos, endpoints y reglas del dominio

Foto del backend tal como está en el código. Si el código cambia, esto
se actualiza en el mismo cambio (ver [`AGENTS.md`](AGENTS.md)).

## Stack

Node + TypeScript (ESM, `module: NodeNext`), Fastify 5, Prisma 5 sobre
PostgreSQL 16, Zod para validar. Entorno local con `docker-compose.yml`
(Postgres) y `.env.example` (`DATABASE_URL`, `PORT`). Variables de
entorno (todas validadas en `src/config.ts`): `DATABASE_URL`, `PORT`
(default 3000), `NODE_ENV` y `INSECURE_USER_ROUTES` (`true`/`false`; por defecto activas fuera de
producción y apagadas en producción: ver Usuarios), las del ingreso real
(`OTP_PROVIDER`, `OTP_CHANNEL`, `ALLOW_INSECURE_AUTH`, `SESSION_TTL_DAYS`,
`TRUST_PROXY`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SID`,
`TWILIO_LOCALE`, `OTP_REAL_PHONES`: ver Ingreso real) y `ALLOWED_MERCHANT_PHONES` (quién
puede crear comercios: ver Dueño y permisos) y `APP_NAME` (nombre que se muestra; por defecto
`Platita`, hasta 30 caracteres: lo usan la consola `/dev`, `GET /auth/config` y el texto del SMS
con `CustomFriendlyName`). Despliegue en Render + Neon: [`DESPLIEGUE.md`](DESPLIEGUE.md) y `CORS_ORIGINS` (orígenes del frontend
separados por coma, ej. `https://app.platita.uy,http://localhost:5173`;
vacío = sin CORS; nunca `*`). Con CORS habilitado se aceptan los headers
`Content-Type`, `Authorization` e `Idempotency-Key`, los métodos GET,
POST, PATCH y OPTIONS, y se expone `Idempotent-Replayed`.

## Estructura del código

```
src/
  server.ts            arranca: buildApp() + listen + cierre ordenado
  app.ts               buildApp(): arma la app sin escuchar (testeable con app.inject)
  config.ts            ÚNICO lugar que lee variables de entorno, validadas con Zod
  lib/                 piezas compartidas, sin lógica de un módulo en particular
    db.ts              cliente Prisma, getBalance / getBalances, tipo DbClient
    errors.ts          AppError y helpers (notFound, conflict, unprocessable…)
    idempotency.ts     claves de idempotencia (runIdempotent) y su limpieza
    error-handler.ts   convierte cualquier error en { error, code, details? }
    schemas.ts         validaciones reutilizables (ids, pesos, teléfono UY, paginación)
    pagination.ts      pageArgs / toPage (cursor)
    money.ts           pesos ↔ centésimos
    opening-hours.ts   horarios de atención: validación (Zod) y normalización
    phone.ts           normalización de teléfonos uruguayos
  modules/             un directorio por área del dominio
    index.ts           ÚNICO lugar donde se registran los módulos
    merchants/         comercios
    bonus-rules/       reglas de bonificación
    customers/         clientes
    ledger/            libro mayor: cargas, cobros, ajustes, movimientos
    locations/         locales de un comercio (solo cambia la dirección)
    places/            vista PÚBLICA de comercios para el cliente (/places)
    users/             el usuario global (la persona) y sus saldos; SIN verificación
    auth/              ingreso por código, sesiones, /me y los permisos del comercio (access.ts); otp/ = proveedores del código
  dev/console.ts       consola de pruebas /dev (solo fuera de producción)
tests/                 tests de integración (vitest) contra una base de pruebas
```

Cada módulo tiene los mismos tres archivos:
- `schemas.ts` — validación de entrada con Zod y sus tipos.
- `service.ts` — la lógica y el acceso a la base. No sabe nada de HTTP:
  recibe datos ya validados, devuelve datos, y lanza `AppError` si algo
  de negocio falla.
- `routes.ts` — delgado: valida, llama al servicio, devuelve. Nada de
  lógica acá.

### Cómo agregar algo (para que escale)

- **Endpoint nuevo en un área existente:** schema en `schemas.ts`,
  función en `service.ts`, ruta en `routes.ts`, y una entrada en el
  arreglo `ENDPOINTS` de `src/dev/console.ts`.
- **Área nueva (ej. `campaigns`):** crear `src/modules/campaigns/` con
  los tres archivos y registrarlo en `src/modules/index.ts`.
- **Un servicio necesita otra área:** importa el servicio de esa área
  (ej. `requireMerchant` de `merchants/service.ts`), nunca su
  `routes.ts`.
- **Permisos:** van como hooks, nunca dentro de un servicio. Un módulo
  nuevo del comercio se registra dentro de la "zona del comercio" de
  `modules/index.ts` (sesión + dueña) y su ruta necesita una regla en
  `auth/access.ts`: ese archivo falla cerrado (una ruta protegida sin regla da
  500 en vez de dejar pasar). Un módulo público va fuera de esa zona. Los
  servicios siguen recibiendo ids ya autorizados.
- **Trabajo en segundo plano (WhatsApp, campañas):** es un módulo nuevo
  que usa los servicios existentes; no se mete en `ledger`.
- **Tests:** `buildApp()` devuelve la app sin puerto, así que se prueba
  con `app.inject(...)`.

## Cómo se relacionan usuario, ficha y comercio

```
User (la persona, por teléfono)
 └── Customer (ficha en el comercio A, con el saldo de A)  ──  Merchant A
 └── Customer (ficha en el comercio B, con el saldo de B)  ──  Merchant B
```

- **User**: la persona. Un teléfono, un usuario, el mismo en todos los
  comercios. Es lo que identifica a quien usa la app del cliente.
- **Customer** (la "ficha"): la persona vista desde UN comercio. Guarda el
  nombre que le puso ese comercio y su último paso por ahí. Los
  movimientos (`Transaction`) cuelgan de la ficha, **no** del usuario.
- **Saldo**: es de la ficha, o sea del comercio ("saldo cerrado"). No se
  guarda como número: se calcula sumando los movimientos cada vez que se
  consulta. No hay saldo "global" de una persona.
- **Quién ve qué**:
  - El **comercio** ve sus propias fichas con su saldo (teléfono, nombre
    que le puso, saldo, última visita). No ve al `User` ni los saldos de esa
    persona en otros comercios.
  - La **persona** (el usuario) ve el perfil público de los comercios
    (`/places`) y, preguntando, sus saldos en cada comercio donde tiene
    ficha (`/users/:id/balances`, luego `/me/balances`), también con saldo 0.
- **Cargar saldo**: el dinero va al **comercio** (efectivo o su Mercado
  Pago), no a Platita: la plataforma no custodia dinero (README §4). Hoy
  solo el comercio registra la carga (`POST /customers/:id/topups`). Que
  el cliente cargue por su cuenta desde la app está **sin hacer**
  ("Próximamente"); es una decisión de negocio y legal antes que técnica.
- **Verificación**: hoy no existe. Las rutas de usuario se identifican solo
  con el teléfono y existen únicamente fuera de producción (ver Usuarios).

## Reglas del dominio ya cerradas

- **Montos**: la API **recibe pesos** y la base **guarda centésimos**
  (enteros). Las respuestas devuelven centésimos. Máximo 1.000.000 de
  pesos por operación. **Deuda técnica conocida y aceptada**: entrar en
  pesos y salir en centésimos es asimétrico; unificarlo rompe a todo
  consumidor, así que se deja como está hasta un cambio coordinado con el
  frontend (que hoy convierte en un solo lugar).
- **Saldo** = suma de `Transaction.amount` del cliente. Nunca se guarda
  como campo. Positivo suma, negativo resta.
- **Saldo cerrado**: un `Customer` pertenece a un solo `Merchant`; el
  saldo solo vale ahí.
- **La plataforma no custodia dinero**: `TOPUP` solo registra una carga
  que el comercio ya cobró por su cuenta (efectivo o Mercado Pago).
  `paidWith` es informativo.
- **El libro mayor no se edita ni se borra**: un error se corrige con un
  `ADJUSTMENT` que lo compense (nota obligatoria).
- **Bonificación**: al cargar, se aplica la `BonusRule` activa del
  comercio con mayor `minTopUp` que sea `<=` al monto cargado, y se
  registra como un `BONUS` aparte, que guarda de qué regla salió
  (`bonusRuleId`; nulo en los bonos anteriores a esa columna). Si dos
  reglas empatan en mínimo gana la de menor id. La búsqueda de la regla es
  una sola función (`findApplicableRule`) que usan la carga real y la
  vista previa (`GET /merchants/:id/bonus-preview`), así no pueden
  divergir. El bono es un monto fijo, no un porcentaje. Las reglas no se
  borran: se desactivan (`active: false`). Cada regla puede tener `name` y
  `description` opcionales y en los listados trae `timesUsed` (cuántos
  bonos salieron de ella).
- **Perfil público del comercio** (`Merchant`): `description` (hasta 280),
  `photoUrl` (URL http/https; la subida de archivos es otro hito),
  `category` (`CAFETERIA`, `BARBERIA_PELUQUERIA`, `PILATES_YOGA`,
  `PANADERIA`, `LAVADERO`, `OTRO`; nula hasta que se elige),
  `categoryChangedAt`, `visible` ("Aparecer en la app", falso por
  defecto) y `openingHours`. Se edita con `PATCH /merchants/:id` y el GET
  del comercio lo devuelve. Todo es opcional.
- **Categoría**: la primera vez se elige libre (y ahí arranca el
  plazo). Después, si pasaron menos de 90 días desde `categoryChangedAt`,
  422 `CATEGORY_CHANGE_TOO_SOON` con `details { availableAt }` (ISO). Elegir
  la misma que ya tiene no cuenta como cambio. Si un comercio necesita
  cambiarla antes, se corrige a mano en la base (no hay endpoint de
  administración).
- **Visibilidad**: `visible: true` exige al menos un local activo **y**
  una categoría (la categoría se evalúa con la que quedaría tras ese
  mismo PATCH); si falta algo, 422 `PROFILE_INCOMPLETE` con
  `details { missing: ["location" | "category"] }` y un mensaje que dice
  qué falta. Mientras el comercio sea visible, no se puede dar de baja su
  único local activo (422 `LOCATION_REQUIRED_WHILE_VISIBLE`). Ambas
  operaciones bloquean la fila del comercio, así no se cruzan.
- **Horarios**: la semana tipo `{ mon, tue, wed, thu, fri, sat, sun }`,
  cada día una lista de tramos `{ from, to }` en `HH:MM` (hora de
  Montevideo; `to` puede ser `24:00`). Lista vacía o día ausente =
  cerrado. Cada tramo con `from < to` y sin superponerse (que uno termine
  donde empieza otro está bien); se guardan ordenados. El PATCH reemplaza
  la semana completa y el GET devuelve siempre los 7 días.
- **Locales** (`Location`): un comercio tiene uno o más. Solo la dirección
  (texto) cambia entre locales; horarios, descripción, foto y categoría son
  del comercio y el saldo también (vale en todos los locales). No hay mapa
  ni coordenadas: el front arma "Cómo llegar". No hay DELETE: se da de baja
  con `active: false`.
- **Usuario** (`User`): la persona, identificada por su **teléfono**
  normalizado (único). Es global: el mismo en todos los comercios. Cada
  `Customer` (la ficha de un comercio) tiene un `userId` obligatorio que
  lo referencia; el saldo sigue siendo de la ficha, o sea del comercio.
  Al crear una ficha (`POST /merchants/:id/customers`) se busca o crea el
  usuario de ese teléfono; el nombre que anota el comercio solo siembra el
  nombre del usuario cuando es nuevo, nunca lo pisa (el nombre del usuario
  lo cambia la propia persona). `Customer.name` sigue siendo "cómo lo anota
  el comercio". Las respuestas que traen una ficha incluyen además
  `userName` (el `User.name`, puede ser `null`): `POST`/`GET`/`PATCH` de
  clientes, `GET /merchants/:id/customers`, `GET /merchants/:id/inactive` y
  el objeto `customer` de `GET /merchants/:id/transactions`. Siempre plano
  (`userName`), nunca el objeto `user`.
- **Identificarse sin verificar** (`/users/*`): `POST /users` busca o crea
  por teléfono y devuelve el usuario; `GET`/`PATCH /users/:id`;
  `GET /users/:id/balances` devuelve los saldos de la persona en cada
  comercio donde tiene ficha, incluso con saldo 0, ordenados por última
  visita (los que nunca visitó, al final) y por nombre del comercio. **No
  hay código ni sesión**: quien conozca un teléfono puede ver sus saldos.
  Por eso estas rutas solo existen si `INSECURE_USER_ROUTES` es verdadero
  (por defecto, fuera de producción). Son una simulación para armar el
  lado del cliente: cuando exista el ingreso real se reemplazan por
  `/me/*` con la misma lógica (las funciones de `users/service.ts` reciben
  el id del usuario, no saben cómo se identificó).
- **Ingreso real del cliente** (`/auth/*`, `/me/*`): la persona escribe su
  celular, recibe un código de 6 dígitos y lo escribe; queda con una sesión
  abierta por semanas. No hay usuario ni contraseña. Un teléfono queda
  verificado (`User.phoneVerifiedAt`) con el primer código correcto, y si la
  persona no existía se crea (o ya la había creado un comercio al anotarla:
  es el mismo `User`, por teléfono).
  - **Código**: vive 5 minutos, sirve una sola vez y se puede intentar 5
    veces; pedir uno nuevo reinicia los intentos. Eso lo aplica el servicio,
    no el proveedor. Errores: 422 `CODE_INCORRECT` (`details.attemptsLeft`),
    422 `CODE_EXPIRED` (venció, nunca se pidió o ya se usó), 429
    `TOO_MANY_ATTEMPTS`. Teléfono inválido: 400 `INVALID_PHONE`.
  - **Límites de pedidos** (cada mensaje cuesta plata): 1 cada 30 s y 5 por
    hora por teléfono, y 20 por hora por IP. Pasados: 429 `TOO_MANY_REQUESTS`
    con `details.retryAfterSeconds`. Se cuentan en la base (`OtpRequest`) con
    un candado por teléfono. Detrás de un proxy hay que poner
    `TRUST_PROXY=true`, si no todas las IPs parecen la del proxy.
  - **Sin enumeración**: `request-code` responde 204 igual para un teléfono
    conocido y uno desconocido.
  - **Sesión**: un solo token opaco (32 bytes aleatorios) que el cliente manda
    como `Authorization: Bearer <token>`. En la base solo se guarda su hash
    (sha256). Dura `SESSION_TTL_DAYS` (60) y se renueva al usarla (a lo sumo
    una vez por hora). Se revoca al instante con `POST /auth/logout`. No hay
    refresh token ni JWT. Cualquier problema con el token (falta, desconocido,
    vencido, cerrado) es 401 `INVALID_SESSION`: el front vuelve a pedir código.
  - **`/me/*`** lee siempre del usuario de la sesión, nunca de un id que mande
    el cliente. `GET /me/balances` tiene la misma forma que
    `GET /users/:id/balances`.
  - **Proveedor del código** (`src/modules/auth/otp/`): la interfaz
    `OtpProvider` (`start` y `check`) es lo único que conoce quién manda el
    mensaje. Existen `dev` (no manda nada y solo acepta `000000`) y `twilio`
    (Twilio Verify). **Producción se niega a arrancar con `dev`** salvo `ALLOW_INSECURE_AUTH=true`
    (para demos, con un aviso en el log): lo valida `config.ts`. El canal
    (`OTP_CHANNEL=sms|whatsapp`) también es configuración, no del front.
    `GET /auth/config` avisa el proveedor y el `devCode`, para que el front
    muestre la ayuda solo con `dev`.
  - **Twilio Verify** (`otp/twilio.ts`): llama a la API REST con `fetch`, sin
    SDK, con autenticación básica. Se activa con `OTP_PROVIDER=twilio` y estas
    variables, que **solo van en el entorno, nunca en el código ni en el repo**:
    `TWILIO_ACCOUNT_SID` (empieza con `AC`), `TWILIO_AUTH_TOKEN` y
    `TWILIO_VERIFY_SID` (el SID del **servicio de Verify**, empieza con `VA`,
    no el de la cuenta); opcional `TWILIO_LOCALE` (ej. `es`) para el idioma del
    SMS. `config.ts` se niega a arrancar si falta alguna o si los prefijos no
    coinciden, y sus mensajes nombran las variables pero nunca los valores.
    Traducción de Twilio a `OtpProvider.check`: estado `approved` → `approved`;
    `pending` → `incorrect`; `expired` o `canceled` → `expired`;
    `max_attempts_reached` o HTTP 429 con código 60202 → `too_many_attempts`;
    HTTP 404 (no hay verificación abierta) → `expired`; cualquier otra cosa
    (credenciales inválidas, error 5xx, sin red, respuesta rara) es un fallo del
    proveedor: 502 `OTP_PROVIDER_ERROR`, que no cuenta contra los límites de la
    persona y no gasta un intento. Los errores de `TwilioError` guardan solo el
    estado HTTP, el código de Twilio y el enlace a su documentación, **nunca su
    mensaje** (puede traer el teléfono). Si todos los códigos aparecen como
    vencidos, revisar `TWILIO_VERIFY_SID` (un SID equivocado también da 404).
    En la cuenta de prueba de Twilio solo se manda a números verificados de
    antemano en su consola, y cada verificación gasta de las gratis.
    **El servicio de Verify tiene que estar configurado con códigos de 6
    dígitos** (el backend valida exactamente 6) y el canal SMS activado.
  - **Modo mixto** (`OTP_REAL_PHONES`): para un entorno de prueba donde
    "cualquiera entra con 000000" pero unos teléfonos concretos se verifican de
    verdad. Con `OTP_PROVIDER=dev`, los teléfonos de la lista (separados por
    coma, en cualquier formato uruguayo; se normalizan) pasan **siempre** por
    Twilio, tanto al mandar como al comprobar el código, así que 000000 **no
    les sirve** y nadie puede entrar como esa persona. El resto sigue con 000000.
    Pide las tres credenciales de Twilio; no se combina con
    `OTP_PROVIDER=twilio` (ya son todos reales); un elemento que no es un
    teléfono uruguayo hace fallar el arranque (el mensaje dice cuál, no su
    valor). Lo implementa `otp/routing.ts` (`createRoutingProvider`), que reparte
    cada teléfono entre dos proveedores sin tocar el servicio. **Es solo para
    entornos de prueba**: en producción sigue exigiendo `ALLOW_INSECURE_AUTH`
    (el resto de los teléfonos entra con 000000) y el log avisa.
    `GET /auth/config` suma `realPhonesConfigured` (booleano; nunca devuelve
    cuáles son los teléfonos) para que el front matice la ayuda del código.
    Alternativa más segura para producción, **no implementada**: al revés,
    Twilio para todos y 000000 solo para una lista de teléfonos de prueba (por
    ejemplo para revisores de una tienda de apps).
  - **Cambiar o sumar un proveedor**: (1) crear `otp/<nombre>.ts` que cumpla `OtpProvider`, devolviendo
    `approved`, `incorrect`, `expired` o `too_many_attempts` en `check`;
    (2) sumarlo al mapa de `otp/index.ts` y al enum `OTP_PROVIDER` de
    `config.ts`; (3) poner `OTP_PROVIDER=<nombre>` y sus credenciales en
    variables de entorno, nunca en el código. No se toca ninguna ruta.
  - **Riesgo conocido**: si un teléfono se recicla, quien lo recibe vería los
    saldos del dueño anterior. Es un tema de términos y condiciones.
  - Las rutas `/users/*` (ingreso sin verificar) siguen existiendo por ahora
    y se eliminan, junto con `INSECURE_USER_ROUTES`, cuando el front pase a
    `/me/*`.
- **Dueño y permisos del comercio**: un comercio pertenece a una persona
  (`Merchant.ownerId` → `User`); una persona puede ser dueña de varios y a la
  vez clienta de otros. **Todo lo de `/merchants`, `/customers`,
  `/bonus-rules` y `/locations` sale de la sesión** (`Authorization: Bearer`)
  y exige que la persona sea la dueña del comercio al que apunta el pedido
  (para `/customers/:id`, `/bonus-rules/:id` y `/locations/:id`, el comercio
  del cliente, la regla o el local). Sin sesión o con una sesión inválida: 401
  `INVALID_SESSION`. Con un comercio ajeno: 403 `FORBIDDEN`. Si el comercio,
  cliente, regla o local no existe: 404 (el 403 solo aparece sobre algo que
  existe). Lo resuelven `requireSession` y `authorizeMerchantAccess` (hooks de
  la zona del comercio en `modules/index.ts`; reglas en `auth/access.ts`).
  Quedan públicos: `/places*`, `/auth/*`, `/health` y, solo fuera de
  producción, `/dev` y `/users/*`. El preflight de CORS no pide sesión.
  - **Crear un comercio** (`POST /merchants`) exige sesión y deja a la persona
    como dueña: así se "crea una cuenta de comercio". **No cualquiera puede
    crearlo: los comercios los habilitamos nosotros.** Solo pueden los teléfonos
    de la variable de entorno `ALLOWED_MERCHANT_PHONES` (separados por coma, en
    cualquier formato uruguayo; se normalizan y un elemento que no es un
    teléfono hace fallar el arranque). Quien no está en la lista recibe 403
    `MERCHANT_CREATION_NOT_ALLOWED`. **Sin lista:** en desarrollo y tests puede
    cualquiera (para probar) y en **producción nadie** (se cierra en vez de abrirse
    por un olvido; el log avisa al arrancar). Esto solo controla el alta: quien ya
    es dueña de un comercio lo sigue operando aunque no esté en la lista, y
    `db:assign-merchant` y el seed no pasan por acá. `GET /me` trae
    `canCreateMerchant` para que el front muestre u oculte "crear cuenta de
    comercio". La regla vive en `merchants/policy.ts`. `GET /merchants` lista
    **solo los comercios de la sesión** (ya no hay lista de todos).
  - **`GET /me`** devuelve `{ user, merchants: [{ id, name }], canCreateMerchant }`:
    con eso el front decide a qué área llevar a la persona (cliente, comercio, o
    preguntarle a cuál si tiene varias).
  - **Comercios anteriores a los dueños** quedaron con `ownerId` nulo: nadie
    los puede operar (403 para todos) hasta asignarles uno con
    `npm run db:assign-merchant -- <idDelComercio> <teléfono>` (`--list` muestra
    los que no tienen dueño). Un comercio sin dueño sigue apareciendo en
    `/places` si es visible.
  - Un solo dueño por comercio. Dueño/cajero con permisos distintos, traspaso
    de dueño y un tope de comercios por persona **no están hechos** (`TODO.md`).
- **Lugares** (`/places`): vista pública (sin sesión) de los comercios con
  `visible = true`. Solo expone el perfil público (nombre, categoría,
  descripción, foto, locales activos, horarios y promos activas); nunca
  teléfono, plan, clientes ni saldos. Un comercio no visible da el mismo
  404 que uno inexistente. Orden por nombre (desempate por id).
- **Idempotencia** (opcional): `POST /customers/:id/topups`, `/charges` y
  `/adjustments` aceptan el header `Idempotency-Key` (1 a 255
  caracteres). La clave se guarda por cliente, junto con un hash de la
  operación y el cuerpo, **en la misma transacción** que el movimiento y
  con la fila del cliente bloqueada, así dos pedidos simultáneos con la
  misma clave se hacen en fila. Misma clave y mismo cuerpo: devuelve la
  respuesta guardada (201) con el header `Idempotent-Replayed: true` y no
  registra nada. Misma clave con otra operación u otro cuerpo: 422
  `IDEMPOTENCY_KEY_REUSED`. Los errores (ej. saldo insuficiente) no se
  guardan: reintentar con la misma clave vuelve a evaluar. Las claves
  vencen a las 48 horas (se borran cada hora, y una vencida se ignora).
  Sin header, todo funciona como antes.
- **Cobro y ajuste negativo**: se rechazan con 422 `INSUFFICIENT_BALANCE`
  si el saldo no alcanza. Corren en una transacción que bloquea la fila
  del cliente (`SELECT … FOR UPDATE`), así dos cobros simultáneos no
  gastan el mismo saldo.
- **Visita**: carga y cobro actualizan `Customer.lastVisitAt`.
- **Inactivo**: sin visita en N días; si nunca vino, se cuenta desde que
  se creó el cliente.
- **Teléfono**: solo uruguayo, siempre guardado normalizado como
  `+598XXXXXXXX`. `099123456`, `99 123 456` y `+59899123456` son el
  mismo cliente. La búsqueda (`?search=`) normaliza igual: un teléfono
  completo en cualquier formato lo encuentra, y también sirve parcial.
  `?phone=` filtra por teléfono exacto sin crear nada.

## Convenciones de la API

- **Errores**: siempre `{ error, code, details? }`. `code` es estable
  (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_BALANCE`,
  `INTERNAL_ERROR`…); el mensaje es para humanos y puede cambiar.
- **Códigos**: 201 al crear, 400 validación, 404 no existe, 409
  conflicto, 422 regla de negocio, 503 `DATABASE_UNAVAILABLE` (la base no respondió: pasa al
  despertar una base gratis que se durmió; trae `Retry-After: 2` y conviene reintentar).
- **Listados**: `{ data: [...], nextCursor }` con `?limit=50&cursor=<id>`
  (limit máx. 200). `nextCursor: null` = no hay más. Hay que ordenar
  siempre con `id` como último criterio.
- **PATCH**: manda solo los campos a cambiar; al menos uno.

## Modelo de datos (`prisma/schema.prisma`)

- `Merchant` — `id`, `name`, `phone?`, `plan` (`BASIC`/`PRO`/`MULTI`),
  `createdAt`.
- `Customer` — `id`, `merchantId`, `userId`, `phone`, `name?`,
  `lastVisitAt?`. Único por (`merchantId`, `phone`). Índices
  (`merchantId`, `lastVisitAt`) y (`userId`).
- `Merchant` — `id`, `name`, `phone?`, `plan`, `createdAt`, `ownerId?` (la
  dueña; índice) y el perfil
  público: `description?`, `photoUrl?`, `category?`, `categoryChangedAt?`,
  `visible` (default `false`), `openingHours?` (JSON). Índice
  (`visible`, `category`).
- `User` — `id`, `phone` (único), `name?`, `phoneVerifiedAt?` (nulo = existe
  pero nunca verificó), `createdAt`.
- `Session` — `userId`, `tokenHash` (único), `expiresAt`, `lastUsedAt`,
  `revokedAt?`, `userAgent?`. Índices (`userId`) y (`expiresAt`).
- `OtpRequest` — `phone`, `ip?`, `createdAt` (para los límites). Se borra a
  las 24 h.
- `OtpChallenge` — `phone` (único), `requestedAt`, `attempts` (el código
  vigente de un teléfono). Se borra a las 24 h.
- `Location` — `merchantId`, `label?`, `address`, `active`, `createdAt`.
  Índice (`merchantId`, `active`).
- `BonusRule` — `merchantId`, `name?`, `description?`, `minTopUp`,
  `bonusAmount`, `active`. Índice (`merchantId`, `active`).
- `Transaction` — `customerId`, `type` (`TOPUP`/`BONUS`/`CHARGE`/
  `ADJUSTMENT`), `amount`, `paidWith?`, `note?`, `bonusRuleId?` (solo en
  `BONUS`), `createdAt`. Índices (`customerId`, `createdAt`) y
  (`bonusRuleId`).
- `IdempotencyKey` — `customerId`, `key`, `requestHash`, `response`
  (JSON), `createdAt`. Único por (`customerId`, `key`).

Los índices originales están en la migración
`20261011173315_segunda_parte`; las columnas y la tabla nuevas, en
`20261013150000_idempotencia_y_origen_de_bonos` y
`20261015120000_perfil_publico_y_locales` y
`20261016120000_usuarios_globales` (crea un usuario por cada teléfono
existente y enlaza las fichas), `20261018120000_ingreso_real_sesiones_y_otp` y
`20261022120000_duenos_de_comercio` (agrega `Merchant.ownerId`).

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Chequeo de vida |
| POST | `/merchants` | **Sesión y teléfono habilitado** (`ALLOWED_MERCHANT_PHONES`). Crea un comercio y la persona queda como dueña; 403 `MERCHANT_CREATION_NOT_ALLOWED` si no está habilitada |
| GET | `/merchants` | **Sesión.** Lista los comercios de la sesión (paginado) |
| GET | `/merchants/:id` | Un comercio |
| PATCH | `/merchants/:id` | Edita un comercio y su perfil público (categoría, visibilidad, horarios…) |
| GET | `/auth/config` | Nombre de la app (`appName`), proveedor de códigos en uso, canal y `devCode` (solo con `dev`) |
| POST | `/auth/request-code` | `{ phone }` → 204. Manda el código; 429 si pide demasiados |
| POST | `/auth/verify-code` | `{ phone, code }` → `{ token, expiresAt, user }`. Crea al usuario si no existía |
| POST | `/auth/logout` | **Sesión.** 204; cierra la sesión actual |
| GET | `/me` | **Sesión.** `{ user, merchants: [{ id, name }], canCreateMerchant }`: la persona, sus cuentas de comercio y si puede crear una nueva |
| PATCH | `/me` | **Sesión.** La persona cambia su nombre |
| GET | `/me/balances` | **Sesión.** Saldos en cada comercio (`{ data: [{ merchant, balance, lastVisitAt }] }`) |
| POST | `/users` | **Sin verificar, solo si `INSECURE_USER_ROUTES`.** Se identifica con el teléfono: busca o crea el usuario |
| GET | `/users/:id` | **Sin verificar.** El usuario |
| PATCH | `/users/:id` | **Sin verificar.** El usuario cambia su nombre |
| GET | `/users/:id/balances` | **Sin verificar.** Saldos del usuario en cada comercio, `{ data: [{ merchant: {id,name,category,photoUrl}, balance, lastVisitAt }] }` |
| GET | `/places?category=&search=` | **Público.** Comercios visibles con locales activos y `hasActivePromo` (paginado, por nombre) |
| GET | `/places/:merchantId` | **Público.** Detalle: descripción, foto, locales, horarios y promos activas; 404 si no es visible |
| GET | `/merchants/:merchantId/locations` | Locales del comercio (también los de baja) |
| POST | `/merchants/:merchantId/locations` | Agrega un local |
| PATCH | `/locations/:id` | Edita un local o lo da de baja (`active: false`) |
| POST | `/merchants/:merchantId/bonus-rules` | Crea una regla de bonificación |
| GET | `/merchants/:merchantId/bonus-rules` | Reglas del comercio, cada una con `timesUsed` |
| GET | `/merchants/:merchantId/bonus-preview?amount=` | Qué regla y cuánto bono daría una carga de `amount` pesos (no registra nada) |
| PATCH | `/bonus-rules/:id` | Edita o desactiva una regla |
| POST | `/merchants/:merchantId/customers` | Busca o crea cliente por teléfono (devuelve saldo) |
| GET | `/merchants/:merchantId/customers?search=&phone=` | Lista clientes con saldo (paginado); `search` por nombre o teléfono en cualquier formato, `phone` exacto |
| GET | `/merchants/:merchantId/inactive?days=60` | Clientes inactivos con su saldo (paginado) y `total` de inactivos |
| GET | `/merchants/:merchantId/transactions?from=&to=&type=` | Movimientos de todo el comercio, con `customer {id,name,phone}` (paginado; `from` inclusivo, `to` exclusivo, ISO con offset) |
| GET | `/customers/:id` | Un cliente con saldo |
| PATCH | `/customers/:id` | Cambia el nombre |
| GET | `/customers/:id/balance` | Saldo actual |
| POST | `/customers/:id/topups` | Registra carga y aplica bonificación (acepta `Idempotency-Key`) |
| POST | `/customers/:id/charges` | Cobra descontando saldo (acepta `Idempotency-Key`) |
| POST | `/customers/:id/adjustments` | Corrección manual con signo (acepta `Idempotency-Key`) |
| GET | `/customers/:id/transactions?type=` | Libro mayor del cliente (paginado) |

**Zona del comercio:** todas las rutas de `/merchants/…`, `/customers/…`, `/bonus-rules/…` y `/locations/…` de esta tabla exigen sesión **y ser la dueña del comercio** (401 `INVALID_SESSION` sin sesión, 403 `FORBIDDEN` con un comercio ajeno). `/places*` y `/auth/*` son públicos (`/auth/logout` y `/me*` piden sesión).

## Tests

`npm test` corre vitest (`tests/`) contra Postgres real con `app.inject()`:
ingreso y sesión (`auth.test.ts`), el proveedor de Twilio con un `fetch`
simulado (`twilio-provider.test.ts`), el modo mixto (`routing-provider.test.ts`), las reglas de arranque de la
configuración (`config.test.ts`), idempotencia y cobros simultáneos
(`idempotency.test.ts`) y perfil público, locales y `/places`
(`places.test.ts`). Los tests **vacían las tablas**, por eso usan una base
aparte: `platita_test` (o `TEST_DATABASE_URL`), y se niegan a correr contra
una base cuyo nombre no termine en `_test` (en el CI, que es descartable, se
usa la `DATABASE_URL` del job). Crear la base una sola vez:

```
docker compose exec db createdb -U platita platita_test
```

Las migraciones se aplican solas al empezar. Detalle en [`CI.md`](CI.md).

## Herramientas de desarrollo

- `npm run db:seed`: carga datos de ejemplo (`scripts/lib/seed.ts`): tres
  personas con teléfonos fijos (`+59899000001` Ana, dueña de dos comercios;
  `+59899000002` Beto, solo cliente con saldo en tres comercios;
  `+59899000003` Carla, dueña de tres comercios y clienta de uno), cinco
  comercios visibles en categorías distintas (con descripción, foto por URL
  placeholder, uno o dos locales, horarios variados y promos con nombre) y
  clientes con saldos y movimientos de cargas, bonos y cobros en fechas pasadas,
  incluidos saldo 0, clientes sin venir hace más de 30 días y nombres distintos
  entre el comercio y la persona. Los bonos salen de las promos del comercio
  (con `bonusRuleId`), como en la API. Repetirlo **no duplica**: borra y vuelve
  a crear solo lo que cuelga de los comercios del seed (ids `seed_*`); las
  personas se reutilizan por teléfono y lo demás de la base no se toca. Imprime
  qué teléfono entra a qué cuenta (todos con el código `000000`).
- `npm run db:reset-seed`: **vacía TODA la base de desarrollo** (también lo que
  cargaste a mano; las personas tienen que volver a ingresar) y vuelve a cargar
  el seed. Las tablas y las migraciones no se tocan.
- **Freno de seguridad** (`scripts/lib/dev-guard.ts`): ambos se niegan **siempre** con
  `NODE_ENV=production` (sin forma de forzarlo), y con una base que no sea local
  (otro host que `localhost`) solo siguen si se confirma con `--yes`
  (`npm run db:seed -- --yes`); en ese caso avisan contra qué base van a escribir, y
  `db:reset-seed` avisa además que la va a vaciar.

- `npm run db:assign-merchant -- <idDelComercio> <teléfono>`: le asigna una
  dueña a un comercio (busca o crea a la persona por teléfono; si ya tenía otro
  dueño, lo cambia). `--list` muestra los comercios sin dueño. Por seguridad
  solo corre contra una base local y fuera de producción; para una base remota
  hay que pedirlo con `--force-remote`. Código en `scripts/assign-merchant.ts`.
- `npm run db:delete-user -- 099123456`: borra a la persona con ese teléfono
  (en cualquier formato) y todo lo que cuelga de ella: sesiones, fichas en los
  comercios con sus movimientos y claves de idempotencia, y los pedidos de
  código de ese teléfono (para saltear el límite de 30 s). Sirve para repetir
  el ingreso desde cero. Los movimientos son del libro mayor: **solo datos de
  prueba**. Se niega a correr con `NODE_ENV=production` o contra una base que
  no sea local. Código en `scripts/delete-user.ts`.

## Consola de pruebas (`/dev`)

Página única servida por el propio backend en `GET /dev` (y `/` redirige
ahí), solo cuando `NODE_ENV !== "production"`. HTML y JS embebidos en un
string en `src/dev/console.ts`, sin dependencias ni build. **Regla:**
cuando se agrega o cambia un endpoint, se actualiza también el arreglo
`ENDPOINTS` de ese archivo. Las entradas con `captures` completan solas
las variables de arriba (`merchantId`, `bonusRuleId`, `customerId`).

## Pendiente de documentar

Contrato de API formal (como `API_CONTRACT.md` en `iwant`, o un
OpenAPI) cuando las rutas se estabilicen — por ahora la tabla de arriba
alcanza.
