# Ejemplo completo: la peluquería de Don Pablo

Un caso de uso narrado que recorre **todos los endpoints** de la API, cada
uno marcado donde se usa. Sirve para entender el flujo de punta a punta
(a quien se incorpora al proyecto, o a una IA que lo retoma) antes de
leer el código. Los endpoints y reglas completos están en
[`BACKEND.md`](BACKEND.md).

> **Ojo con los datos.** Las respuestas son ilustrativas: se armaron
> leyendo el código, no se capturaron de una ejecución real. Los IDs
> están inventados y los JSON van recortados a los campos importantes.
> **La API recibe pesos y devuelve centésimos**: $1.000 aparece como
> `100000` en las respuestas.
>
> **Desde 2026-10-22 todo lo del comercio lleva sesión.** Las llamadas de las
> escenas 1 a 8 (`/merchants`, `/customers`, `/bonus-rules`, `/locations`) se
> hacen con `Authorization: Bearer <token>` de la persona que es **dueña** del
> comercio (ver la escena 12); los ejemplos las muestran sin el header para
> no repetirlo. Sin sesión dan `401`, y con un comercio ajeno, `403`.
>
> **Mantenimiento:** si cambia un endpoint o una regla del dominio que
> aparece acá, se actualiza este documento en el mismo cambio (ver
> [`AGENTS.md`](AGENTS.md)). El mismo recorrido se puede hacer a mano en
> la consola local `/dev`, en este orden.

---

## El caso

Pablo tiene una peluquería en Pocitos. Cada corte sale **$400**. Quiere
que los clientes vuelvan y que le adelanten plata, así que arma una
promo: **cargás $1.000 y te llevás 3 cortes** ($1.200 en total, o sea
$200 de regalo).

## Escena 1: Pablo se da de alta

Una persona del equipo de Platita se sienta con Pablo para anotarlo.
Antes, chequea que el sistema esté vivo.

> ▶ **`GET /health`**: ¿el servidor responde? → `{ "ok": true }`

> ▶ **`POST /merchants`**: da de alta la peluquería.
> ```json
> { "name": "Peluquería Don Pablo", "phone": "094111222", "plan": "BASIC" }
> ```
> → `201 { "id": "m_pablo", "name": "Peluquería Don Pablo", "plan": "BASIC", ... }`

Ese `m_pablo` es la llave de todo lo que sigue. Se anotó mal el teléfono
y Pablo lo corrige. También quiere ver cómo quedó la ficha.

> ▶ **`PATCH /merchants/m_pablo`**: corrige solo el teléfono, sin tocar el resto.
> ```json
> { "phone": "094111223" }
> ```

> ▶ **`GET /merchants/m_pablo`**: ve la ficha completa.

> ▶ **`GET /merchants`**: el equipo de Platita ve la lista de todos los
> comercios, paginada. Es una vista de administración, no algo que vería
> Pablo.

## Escena 2: Pablo arma la promo

> ▶ **`POST /merchants/m_pablo/bonus-rules`**: crea la regla "cargando
> $1.000 o más, te regalo $200".
> ```json
> { "minTopUp": 1000, "bonusAmount": 200, "name": "Promo 3 cortes" }
> ```
> → `201 { "id": "r_promo3", "name": "Promo 3 cortes", "minTopUp": 100000, "bonusAmount": 20000, "active": true, "timesUsed": 0 }`
>
> (`name` y `description` son opcionales; `timesUsed` es cuántos bonos
> salieron de esta regla.)

A Pablo se le ocurre una segunda promo de $500 con $50 de regalo. Al
rato se arrepiente. Las reglas no se borran, se apagan.

> ▶ **`PATCH /bonus-rules/r_otra`**: desactiva la promo que no quiere.
> ```json
> { "active": false }
> ```

> ▶ **`GET /merchants/m_pablo/bonus-rules`**: repasa qué promos tiene y
> cuáles están activas.

## Escena 3: llega Juancito

Juancito entra con $1.000 en el bolsillo. La recepcionista pide su
celular, no hay app que bajar.

> ▶ **`POST /merchants/m_pablo/customers`**: busca a Juancito por
> teléfono y, si no existe, lo crea.
> ```json
> { "phone": "099 123 456" }
> ```
> → `{ "id": "c_juancito", "phone": "+59899123456", "name": null, "balance": 0 }`

El teléfono quedó normalizado a `+59899123456`. Si la próxima vez lo
escriben como `99123456`, el sistema reconoce al mismo Juancito y no
crea otro.

Un descuido: lo tipearon sin nombre.

> ▶ **`PATCH /customers/c_juancito`**: le pone el nombre.
> ```json
> { "name": "Juancito" }
> ```

*(Si la recepcionista se equivoca y escribe `123`, la API responde
`400 VALIDATION_ERROR: Teléfono uruguayo inválido` y no crea nada.)*

## Escena 4: Juancito carga los $1.000

Juancito le da los $1.000 en efectivo a Pablo. **Platita no toca esa
plata**: queda en la caja de la peluquería. Platita solo anota que ahora
Juancito tiene saldo.

Antes de confirmar, la pantalla le muestra a Pablo cuánto regalo
corresponde, sin registrar nada:

> ▶ **`GET /merchants/m_pablo/bonus-preview?amount=1000`**: vista previa
> del bono.
> → `{ "amount": 100000, "rule": { "id": "r_promo3", "name": "Promo 3 cortes", ... }, "bonus": 20000, "total": 120000 }`
> (si ninguna promo alcanza: `rule: null`, `bonus: 0`).

> ▶ **`POST /customers/c_juancito/topups`**: registra la carga. El
> sistema aplica solo la promo, porque $1.000 llega al mínimo de la regla.
> El header opcional `Idempotency-Key: carga-001` protege contra un
> reintento: si la conexión se corta y se reenvía, no se duplica.
> ```json
> { "amount": 1000, "paidWith": "efectivo" }
> ```
> → `201`
> ```json
> {
>   "topup":   { "type": "TOPUP", "amount": 100000 },
>   "bonus":   { "type": "BONUS", "amount": 20000, "bonusRuleId": "r_promo3" },
>   "balance": 120000
> }
> ```
> Reenviar lo mismo con la misma clave devuelve esta respuesta con el
> header `Idempotent-Replayed: true` y no registra nada nuevo.

Saldo: **$1.200**, justo tres cortes. Juancito quiere confirmarlo:

> ▶ **`GET /customers/c_juancito/balance`**: consulta rápida de saldo, lo
> que se mostraría en la pantalla del mostrador. → `{ "balance": 120000 }`

> ▶ **`GET /customers/c_juancito`**: la ficha completa de Juancito, con
> su saldo.

## Escena 5: los cortes

**Primer corte.**

> ▶ **`POST /customers/c_juancito/charges`**: descuenta $400 del saldo.
> ```json
> { "amount": 400, "note": "Corte" }
> ```
> → `201 { "transaction": { "type": "CHARGE", "amount": -40000 }, "balance": 80000 }`

**Segundo corte**, un mes después. Misma llamada y queda
`balance: 40000`.

Esa tarde la recepcionista, nerviosa, aprieta el botón dos veces. El
segundo cobro ya salió y Juancito quedó en $0 habiendo pagado un corte
de más. (Con `Idempotency-Key` el doble toque no habría duplicado nada;
acá la pantalla no mandó clave y por eso se registró dos veces.)

> ▶ **`POST /customers/c_juancito/charges`** (por error, otra vez $400):
> `balance: 0`.

No se puede borrar ni editar un movimiento, porque el historial es
sagrado. Se corrige con un ajuste que compensa:

> ▶ **`POST /customers/c_juancito/adjustments`**: devuelve los $400
> cobrados de más. La nota es obligatoria.
> ```json
> { "amount": 400, "note": "Cobro duplicado, se devuelve el saldo" }
> ```
> → `201 { "balance": 40000 }`

**Tercer corte.** Otra vez `POST .../charges` por $400, y el saldo llega
a **0**.

## Escena 6: el saldo se acabó

Juancito vuelve y quiere un cuarto corte. No le queda saldo.

> ▶ **`POST /customers/c_juancito/charges`**: intenta cobrar $400.
> → `422`
> ```json
> { "error": "Saldo insuficiente", "code": "INSUFFICIENT_BALANCE",
>   "details": { "balance": 0, "needed": 40000 } }
> ```

La recepcionista le explica y él recarga otros $1.000 (otro
`POST .../topups`). Este rechazo es una protección: el sistema no deja
gastar saldo que no existe, ni siquiera si dos cobros llegan en el mismo
instante.

## Escena 7: Pablo revisa los números

Pablo quiere ver qué pasó con la plata de Juancito, movimiento por
movimiento.

> ▶ **`GET /customers/c_juancito/transactions`**: el historial, del más
> nuevo al más viejo.
> ```
> CHARGE      -40000   (corte 3)
> ADJUSTMENT  +40000   "Cobro duplicado..."
> CHARGE      -40000   (el doble toque)
> CHARGE      -40000   (corte 2)
> CHARGE      -40000   (corte 1)
> BONUS       +20000
> TOPUP      +100000
> ```
> Todo suma 0. Con `?type=CHARGE` ve solo los cobros.

> ▶ **`GET /merchants/m_pablo/customers?search=juan`**: busca a Juancito
> en su lista de clientes. Cada cliente viene con su saldo. `search`
> también entiende teléfonos en cualquier formato (`?search=099123456`
> encuentra a `+59899123456`), y `?phone=099123456` busca el teléfono
> exacto sin crear nada.

Cada ficha trae `name` (como la anota Pablo, ej. "Juancito") y `userName`
(el nombre que la persona se puso, ej. "Juan"; `null` si no eligió
uno), así la pantalla puede mostrar "Juancito (Juan)".

Y a fin de día mira todo lo que pasó en el mostrador, de todos sus
clientes:

> ▶ **`GET /merchants/m_pablo/transactions?from=2026-10-13T00:00:00-03:00&to=2026-10-14T00:00:00-03:00`**:
> los movimientos del día, del más nuevo al más viejo, cada uno con el
> `customer` (`id`, `name`, `phone`). `from` es inclusivo y `to`
> exclusivo.

## Escena 8: dos meses después

Juancito no volvió. Pablo quiere recuperarlo.

> ▶ **`GET /merchants/m_pablo/inactive?days=60`**: lista los clientes que
> no vienen hace 60 días o más.
> → `{ "data": [ { "id": "c_juancito", "balance": 0, ... } ], "nextCursor": null, "total": 1 }`
> (cada cliente trae su saldo; `total` cuenta todos los inactivos, no
> solo los de esta página).

Con esa lista, Pablo (o más adelante la plataforma, con un clic) le
mandaría a Juancito una promo por WhatsApp. **Esa parte todavía no
existe**: es el siguiente módulo a construir (ver
[`TODO.md`](../TODO.md)).

## Escena 9: Pablo aparece en la app

Los clientes ahora pueden mirar los comercios desde la app. Por defecto
nadie aparece: Pablo tiene que activarlo. Primero completa su perfil
público (lo hace él, desde la pestaña "Mi comercio").

> ▶ **`PATCH /merchants/m_pablo`**: descripción, categoría y horarios.
> ```json
> {
>   "description": "Cortes y barba en Pocitos, sin turno.",
>   "category": "BARBERIA_PELUQUERIA",
>   "openingHours": {
>     "mon": [], "tue": [{ "from": "10:00", "to": "20:00" }],
>     "wed": [{ "from": "10:00", "to": "20:00" }], "thu": [{ "from": "10:00", "to": "20:00" }],
>     "fri": [{ "from": "10:00", "to": "13:00" }, { "from": "15:00", "to": "20:00" }],
>     "sat": [{ "from": "10:00", "to": "14:00" }], "sun": []
>   }
> }
> ```
> La categoría se elige libre la primera vez. Si Pablo quisiera cambiarla
> a los 20 días: `422 CATEGORY_CHANGE_TOO_SOON` con
> `details { "availableAt": "2027-01-13T..." }` (90 días después).

Quiere aparecer ya, pero todavía no cargó ningún local:

> ▶ **`PATCH /merchants/m_pablo`** con `{ "visible": true }` → `422`
> `{ "code": "PROFILE_INCOMPLETE", "error": "Para aparecer en la app falta: al menos un local activo", "details": { "missing": ["location"] } }`

> ▶ **`POST /merchants/m_pablo/locations`**: agrega su local. Solo la
> dirección (texto; el front arma el "Cómo llegar").
> ```json
> { "label": "Pocitos", "address": "Av. Brasil 2500, Pocitos" }
> ```
> ▶ **`GET /merchants/m_pablo/locations`**: sus locales, también los de baja.
> ▶ **`PATCH /locations/l_pocitos`**: corrige la dirección o lo da de baja
> con `{ "active": false }` (no se borran). Mientras Pablo aparezca en la
> app no puede dar de baja su único local: `422 LOCATION_REQUIRED_WHILE_VISIBLE`.

Ahora sí:

> ▶ **`PATCH /merchants/m_pablo`** con `{ "visible": true }` → `200`.

Una clienta, sin iniciar sesión, mira qué hay en el barrio:

> ▶ **`GET /places?category=BARBERIA_PELUQUERIA`**: lugares visibles, por
> nombre.
> → `{ "data": [ { "id": "m_pablo", "name": "Peluquería Don Pablo", "category": "BARBERIA_PELUQUERIA", "photoUrl": null, "locations": [ { "label": "Pocitos", "address": "Av. Brasil 2500, Pocitos" } ], "hasActivePromo": true } ], "nextCursor": null }`

> ▶ **`GET /places/m_pablo`**: el detalle, con horarios (siempre los 7
> días) y las promos activas (montos en centésimos).
> → `{ "id": "m_pablo", ..., "openingHours": { "mon": [], "tue": [ ... ], ... }, "promos": [ { "id": "r_promo3", "name": "Promo 3 cortes", "description": null, "minTopUp": 100000, "bonusAmount": 20000 } ] }`

Si Pablo se desactiva (`visible: false`), o el comercio no existe,
`GET /places/m_pablo` responde el mismo `404`: no se revela que existe.
Nada de lo que ve la clienta incluye datos de otros clientes, su teléfono
ni su plan.

## Escena 10: Juancito mira sus saldos desde la app (ingreso simulado)

Juancito ya tenía ficha en la peluquería de Pablo. Ahora abre la app del
cliente. Esta escena es el **ingreso simulado**, que se retira cuando el
front pase al real (escena 11): se identifica solo con su teléfono, y eso
sirve únicamente fuera de producción.

> ▶ **`POST /users`**: busca o crea a la persona por teléfono.
> ```json
> { "phone": "099 123 456", "name": "Juancito" }
> ```
> → `{ "id": "u_juancito", "phone": "+59899123456", "name": "Juancito", ... }`

Es el **mismo** `u_juancito` en todos los comercios: cuando la
peluquería creó su ficha (escena 3), el sistema ya había creado este
usuario, y la ficha `c_juancito` guarda `userId: "u_juancito"`. Si mañana
va al café de la esquina y lo anotan con el mismo teléfono, ese comercio
crea su propia ficha (con su propio saldo) colgando del mismo usuario.

> ▶ **`GET /users/u_juancito/balances`**: sus saldos, comercio por comercio.
> → `{ "data": [ { "merchant": { "id": "m_pablo", "name": "Peluquería Don Pablo", "category": "BARBERIA_PELUQUERIA", "photoUrl": null }, "balance": 0, "lastVisitAt": "2026-10-15T..." } ] }`
> Incluye los comercios con saldo 0 y va ordenado por última visita.

> ▶ **`PATCH /users/u_juancito`**: él elige cómo se llama.
> ```json
> { "name": "Juan Pérez" }
> ```
> (Es el nombre de la persona. El que anota cada comercio, `Customer.name`, no cambia.)

## Escena 11: Juancito entra de verdad

Ahora Juancito entra con un código que le llega al celular. No hay usuario ni
contraseña.

> ▶ **`POST /auth/request-code`**: escribe su celular.
> ```json
> { "phone": "099 123 456" }
> ```
> → `204` (sin cuerpo). Responde igual si el teléfono ya existía o no. Si
> pide otro código antes de 30 segundos: `429 TOO_MANY_REQUESTS` con
> `details.retryAfterSeconds`. Si escribe `123`: `400 INVALID_PHONE`.

Le llega un código de 6 dígitos (en desarrollo, con el proveedor `dev`, el
único válido es `000000` y `GET /auth/config` lo avisa).

> ▶ **`POST /auth/verify-code`**: escribe el código.
> ```json
> { "phone": "099 123 456", "code": "000000" }
> ```
> → `200 { "token": "…", "expiresAt": "2026-12-17T…", "user": { "id": "u_juancito", "phone": "+59899123456", "phoneVerifiedAt": "2026-10-18T…", ... } }`

Si se equivoca: `422 CODE_INCORRECT` (con `details.attemptsLeft`); si pasan
más de 5 minutos o ya lo usó: `422 CODE_EXPIRED`; a los 5 intentos fallidos:
`429 TOO_MANY_ATTEMPTS` y tiene que pedir un código nuevo.

Como Pablo ya lo había anotado por su teléfono, `u_juancito` es el mismo
usuario de la escena 3: no se crea otro. Desde acá, la app manda
`Authorization: Bearer <token>` y nunca un id.

> ▶ **`GET /me`**, **`PATCH /me`** (`{ "name": "Juan Pérez" }`) y
> **`GET /me/balances`**: su perfil y sus saldos en cada comercio, con la
> misma forma que la escena 10. Con un token falso, vencido o cerrado:
> `401 INVALID_SESSION`, y la app vuelve a pedir código.

> ▶ **`POST /auth/logout`**: cierra la sesión (204); el token deja de servir
> al instante.

## Escena 12: Pablo entra a su comercio

Hasta ahora todo lo del comercio se hacía "a ciegas": cualquiera que conociera
el id podía operarlo. Ahora el comercio **es de una persona**, y entra con el
mismo código por mensaje que los clientes.

> ▶ **Ingreso:** `POST /auth/request-code` y `POST /auth/verify-code` con el
> celular de Pablo → `{ token, expiresAt, user }`.

Pablo puede ser, a la vez, cliente de otros comercios y dueño de uno o más. La
app le pregunta qué es:

> ▶ **`GET /me`** (con su token):
> ```json
> { "user": { "id": "u_pablo", "phone": "+59894111223", "name": null, ... },
>   "merchants": [ { "id": "m_pablo", "name": "Peluquería Don Pablo" } ] }
> ```
> Si `merchants` viene vacío es solo cliente; con un comercio, entra directo;
> con varios, la app le pregunta a cuál.

Cuando se da de alta un comercio nuevo, la persona **ya tiene que haber
ingresado**: queda como dueña.

> ▶ **`POST /merchants`** (con su token): `{ "name": "Peluquería Don Pablo" }`
> → `201 { "id": "m_pablo", "ownerId": "u_pablo", ... }`.
> ▶ **`GET /merchants`**: lista **solo sus** comercios.

Y ahora hay límites. Si Ana (otra persona, con su propia sesión) intenta tocar
el comercio de Pablo:

> ▶ **`GET /customers/c_juancito`** (con el token de Ana) → `403`
> `{ "error": "Este comercio no es tuyo", "code": "FORBIDDEN" }`. Lo mismo para
> sus clientes, promos, locales y movimientos.
> Sin ningún token: `401 INVALID_SESSION`. Con un id que no existe: `404`.

Los comercios que se crearon antes de los dueños quedaron sin dueño (nadie los
puede operar) hasta que se les asigna uno con `npm run db:assign-merchant`.
Lo público no cambió: `/places` se sigue viendo sin sesión.

---

## Resumen: qué endpoint se usó en cada escena

| # | Endpoint | Para qué sirvió | Escena |
|---|---|---|---|
| 1 | `GET /health` | ¿Está vivo? | 1 |
| 2 | `POST /merchants` | Alta de la peluquería | 1 |
| 3 | `GET /merchants` | Lista de comercios (administración) | 1 |
| 4 | `GET /merchants/:id` | Ficha del comercio | 1 |
| 5 | `PATCH /merchants/:id` | Corregir el teléfono | 1 |
| 6 | `POST /merchants/:id/bonus-rules` | Crear la promo | 2 |
| 7 | `GET /merchants/:id/bonus-rules` | Ver las promos | 2 |
| 8 | `PATCH /bonus-rules/:id` | Apagar una promo | 2 |
| 9 | `POST /merchants/:id/customers` | Registrar o encontrar a Juancito | 3 |
| 10 | `PATCH /customers/:id` | Ponerle el nombre | 3 |
| 11 | `POST /customers/:id/topups` | Cargar $1.000 y recibir el bono | 4 |
| 12 | `GET /customers/:id/balance` | Consulta rápida de saldo | 4 |
| 13 | `GET /customers/:id` | Ficha completa con saldo | 4 |
| 14 | `POST /customers/:id/charges` | Cobrar cada corte | 5 y 6 |
| 15 | `POST /customers/:id/adjustments` | Corregir el cobro duplicado | 5 |
| 16 | `GET /customers/:id/transactions` | Historial de movimientos | 7 |
| 17 | `GET /merchants/:id/customers` | Buscar clientes con su saldo | 7 |
| 18 | `GET /merchants/:id/inactive` | Clientes a reactivar | 8 |
| 19 | `GET /merchants/:id/bonus-preview` | Ver el bono antes de cargar | 4 |
| 20 | `GET /merchants/:id/transactions` | Movimientos del día del comercio | 7 |
| 21 | `POST /merchants/:id/locations` | Cargar el local | 9 |
| 22 | `GET /merchants/:id/locations` | Ver los locales | 9 |
| 23 | `PATCH /locations/:id` | Corregir o dar de baja un local | 9 |
| 24 | `GET /places` | La clienta explora los lugares (público) | 9 |
| 25 | `GET /places/:merchantId` | Detalle de un lugar (público) | 9 |
| 26 | `POST /users` | Identificarse por teléfono (sin verificar) | 10 |
| 27 | `GET /users/:id` | El usuario | 10 |
| 28 | `PATCH /users/:id` | Cambiar su nombre | 10 |
| 29 | `GET /users/:id/balances` | Saldos en cada comercio | 10 |
| 30 | `GET /auth/config` | Qué proveedor de códigos hay | 11 |
| 31 | `POST /auth/request-code` | Pedir el código | 11 |
| 32 | `POST /auth/verify-code` | Verificar y abrir la sesión | 11 |
| 33 | `GET /me`, `PATCH /me` | Ver y cambiar su perfil | 11 |
| 34 | `GET /me/balances` | Sus saldos con sesión real | 11 |
| 35 | `POST /auth/logout` | Cerrar la sesión | 11 |
| 36 | `GET /me` (con comercios) | Saber qué cuentas tiene la sesión | 12 |
| 37 | `POST /merchants` (con sesión) | Crear un comercio y quedar como dueña | 12 |

## Lo que el cuento deja ver que falta

- **Login:** hoy cualquiera que conozca `c_juancito` podría cobrarle.
  Falta la autenticación.
- **Un cobro repetido por mala señal:** la idempotencia existe pero es
  opcional: solo protege si la pantalla manda `Idempotency-Key`. Sin
  clave, un reenvío se duplica y se corrige con un ajuste (escena 5).
- **El WhatsApp de la escena 8** no está construido.
