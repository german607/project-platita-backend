# Backend — arquitectura, modelo de datos, endpoints y reglas del dominio

Foto del backend tal como está en el código. Si el código cambia, esto
se actualiza en el mismo cambio (ver [`AGENTS.md`](AGENTS.md)).

## Stack

Node + TypeScript (ESM, `module: NodeNext`), Fastify 5, Prisma 5 sobre
PostgreSQL 16, Zod para validar. Entorno local con `docker-compose.yml`
(Postgres) y `.env.example` (`DATABASE_URL`, `PORT`).

## Estructura del código

```
src/
  server.ts            arranca: buildApp() + listen + cierre ordenado
  app.ts               buildApp(): arma la app sin escuchar (testeable con app.inject)
  config.ts            ÚNICO lugar que lee variables de entorno, validadas con Zod
  lib/                 piezas compartidas, sin lógica de un módulo en particular
    db.ts              cliente Prisma, getBalance / getBalances, tipo DbClient
    errors.ts          AppError y helpers (notFound, conflict, unprocessable…)
    error-handler.ts   convierte cualquier error en { error, code, details? }
    schemas.ts         validaciones reutilizables (ids, pesos, teléfono UY, paginación)
    pagination.ts      pageArgs / toPage (cursor)
    money.ts           pesos ↔ centésimos
    phone.ts           normalización de teléfonos uruguayos
  modules/             un directorio por área del dominio
    index.ts           ÚNICO lugar donde se registran los módulos
    merchants/         comercios
    bonus-rules/       reglas de bonificación
    customers/         clientes
    ledger/            libro mayor: cargas, cobros, ajustes, movimientos
  dev/console.ts       consola de pruebas /dev (solo fuera de producción)
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
- **Autenticación (todavía no existe):** va como hook `onRequest` /
  plugin en `app.ts` o por módulo en su `routes.ts`; ningún servicio
  debería necesitar cambiar. Los servicios hoy reciben ids sueltos: al
  sumar auth, el `merchantId` del usuario autenticado reemplaza al de la
  URL.
- **Trabajo en segundo plano (WhatsApp, campañas):** es un módulo nuevo
  que usa los servicios existentes; no se mete en `ledger`.
- **Tests:** `buildApp()` devuelve la app sin puerto, así que se prueba
  con `app.inject(...)`.

## Reglas del dominio ya cerradas

- **Montos**: la API **recibe pesos** y la base **guarda centésimos**
  (enteros). Las respuestas devuelven centésimos. Máximo 1.000.000 de
  pesos por operación.
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
  registra como un `BONUS` aparte. El bono es un monto fijo, no un
  porcentaje. Las reglas no se borran: se desactivan (`active: false`).
- **Cobro y ajuste negativo**: se rechazan con 422 `INSUFFICIENT_BALANCE`
  si el saldo no alcanza. Corren en una transacción que bloquea la fila
  del cliente (`SELECT … FOR UPDATE`), así dos cobros simultáneos no
  gastan el mismo saldo.
- **Visita**: carga y cobro actualizan `Customer.lastVisitAt`.
- **Inactivo**: sin visita en N días; si nunca vino, se cuenta desde que
  se creó el cliente.
- **Teléfono**: solo uruguayo, siempre guardado normalizado como
  `+598XXXXXXXX`. `099123456`, `99 123 456` y `+59899123456` son el
  mismo cliente.

## Convenciones de la API

- **Errores**: siempre `{ error, code, details? }`. `code` es estable
  (`VALIDATION_ERROR`, `NOT_FOUND`, `CONFLICT`, `INSUFFICIENT_BALANCE`,
  `INTERNAL_ERROR`…); el mensaje es para humanos y puede cambiar.
- **Códigos**: 201 al crear, 400 validación, 404 no existe, 409
  conflicto, 422 regla de negocio.
- **Listados**: `{ data: [...], nextCursor }` con `?limit=50&cursor=<id>`
  (limit máx. 200). `nextCursor: null` = no hay más. Hay que ordenar
  siempre con `id` como último criterio.
- **PATCH**: manda solo los campos a cambiar; al menos uno.

## Modelo de datos (`prisma/schema.prisma`)

- `Merchant` — `id`, `name`, `phone?`, `plan` (`BASIC`/`PRO`/`MULTI`),
  `createdAt`.
- `Customer` — `id`, `merchantId`, `phone`, `name?`, `lastVisitAt?`.
  Único por (`merchantId`, `phone`). Índice (`merchantId`, `lastVisitAt`).
- `BonusRule` — `merchantId`, `minTopUp`, `bonusAmount`, `active`.
  Índice (`merchantId`, `active`).
- `Transaction` — `customerId`, `type` (`TOPUP`/`BONUS`/`CHARGE`/
  `ADJUSTMENT`), `amount`, `paidWith?`, `note?`, `createdAt`. Índice
  (`customerId`, `createdAt`).

Los índices están en la migración `20261011173315_segunda_parte`.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/health` | Chequeo de vida |
| POST | `/merchants` | Crea un comercio |
| GET | `/merchants` | Lista comercios (paginado) |
| GET | `/merchants/:id` | Un comercio |
| PATCH | `/merchants/:id` | Edita un comercio |
| POST | `/merchants/:merchantId/bonus-rules` | Crea una regla de bonificación |
| GET | `/merchants/:merchantId/bonus-rules` | Reglas del comercio |
| PATCH | `/bonus-rules/:id` | Edita o desactiva una regla |
| POST | `/merchants/:merchantId/customers` | Busca o crea cliente por teléfono (devuelve saldo) |
| GET | `/merchants/:merchantId/customers?search=` | Lista clientes con saldo (paginado) |
| GET | `/merchants/:merchantId/inactive?days=60` | Clientes inactivos (paginado) |
| GET | `/customers/:id` | Un cliente con saldo |
| PATCH | `/customers/:id` | Cambia el nombre |
| GET | `/customers/:id/balance` | Saldo actual |
| POST | `/customers/:id/topups` | Registra carga y aplica bonificación |
| POST | `/customers/:id/charges` | Cobra descontando saldo |
| POST | `/customers/:id/adjustments` | Corrección manual con signo |
| GET | `/customers/:id/transactions?type=` | Libro mayor del cliente (paginado) |

Ninguno tiene autenticación todavía.

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
