# TODO — Platita

Lista de trabajo segmentada por área. Cada ítem tiene un responsable natural (PO, Backend o QA).
Prioridad: **P0** = bloquea el piloto · **P1** = necesario para cobrar · **P2** = después del piloto.

Leyenda: `[x]` hecho y verificado · `[ ]` pendiente · `[~]` en curso, o implementado pero todavía sin verificar corriéndolo

Este es el **único backlog** del proyecto (ver `docs/AGENTS.md`). El estado general está en `docs/STATE.md` y los detalles técnicos en `docs/BACKEND.md`.

---

## 0. Producto y validación (PO)

- [ ] **P0** Entrevistar a 10 comercios: qué usan hoy para fidelizar, si venden saldo/vales, cuánto pagarían
- [ ] **P0** Elegir 5 comercios piloto (2–3 barrios) y armar el MVP "concierge" con planilla + WhatsApp
- [ ] **P0** Definir métricas del piloto: saldo cargado por comercio, % de clientes que cargan, frecuencia de visita
- [ ] **P0** Consulta con abogado: encuadre del saldo cerrado (que no sea dinero electrónico)
- [ ] **P1** Consulta con contador: tratamiento del saldo no consumido y facturación de las cargas
- [ ] **P1** Términos y condiciones para el cliente final (vencimiento del saldo, devoluciones)
- [ ] **P1** Material de mostrador: cartel con QR y pitch de 5 minutos
- [ ] **P1** Validar precios (USD 29 / 59 / 99) con los comercios piloto
- [ ] **P1** Corregir la tabla de números del README §6: "Ticket promedio USD 45" parece ser el ingreso por comercio para Platita (30 × 45 = 1.350), no el ticket del comercio; confirmar y reetiquetar
- [ ] **P2** Programa de referidos entre comercios y acuerdo con estudios contables

## 1. Fundaciones del backend (Backend)

- [x] Esqueleto Fastify + TypeScript + Prisma + PostgreSQL
- [x] Modelo de datos: Merchant, Customer, BonusRule, Transaction (libro mayor)
- [x] Verificar instalación, compilación y primera migración (2026-10-11: `npm install`, `tsc --noEmit` y migraciones aplicadas)
- [~] **P0** Configuración por variables de entorno validada con zod al arrancar (`src/config.ts`; compila, falta ver que arranque)
- [~] **P0** Manejo de errores uniforme (formato `{ error, code, details }`) (`src/lib/error-handler.ts`; compila, falta recorrer los casos)
- [ ] **P1** Logs estructurados con request id
- [~] **P1** Seed de datos de ejemplo para desarrollo: `npm run db:seed` (idempotente) y `npm run db:reset-seed` (vacía todo y recarga), solo en local; escrito el 2026-10-22 y verificado por `tests/seed.test.ts` (108 tests en verde); falta correr `npm run db:seed` y `db:reset-seed` a mano sobre la base de desarrollo y probar con el front
- [ ] **P1** Reemplazar `.env.example` por la versión de `docs/env.example.txt` (`OTP_PROVIDER=dev` por defecto, Twilio comentado y la nota de `OTP_REAL_PHONES`): la sesión de la IA no puede editar ese archivo; copiarlo a mano con `cp docs/env.example.txt .env.example` y borrar el `.txt`
- [x] Arquitectura modular por área (`src/modules/<área>` con schemas, service y routes) y `buildApp()` testeable; ver `docs/BACKEND.md`
- [~] Consola de pruebas local en `/dev`, solo fuera de producción (`src/dev/console.ts`)
- [ ] **P1** Ponerle nombres descriptivos a las migraciones nuevas (las dos primeras quedaron como `primeramigracion_jero` y `segunda_parte`)
- [ ] **P2** Contrato de API formal (OpenAPI) cuando las rutas se estabilicen; por ahora la tabla de `docs/BACKEND.md` alcanza
- [x] **P1** Fijar la versión mínima de Node: `engines >=22` en `package.json` y `.nvmrc` con `22` (coincide con el Dockerfile y el CI; 2026-10-13)

## 2. Autenticación y comercios (Backend)

- [x] **P0** Registro y login de comercio: se resuelve con el mismo ingreso por código por mensaje que los clientes (no email y contraseña): una persona crea un comercio estando con sesión y queda como dueña (2026-10-22; sin verificar corriendo)
- [x] **P0** Middleware de autenticación: `requireSession` y token opaco (sin JWT; ver §12)
- [x] **P0** Acotar **todas** las rutas al comercio autenticado: `/merchants`, `/customers`, `/bonus-rules` y `/locations` exigen sesión y ser la dueña (`auth/access.ts`; 401/403/404); verificado por `tests/merchant-access.test.ts` (99 tests en verde, 2026-10-22); falta probarlo con el frontend
- Decisión 2026-10-13: la autenticación del comercio se había postergado. **El 2026-10-22 el frontend la pidió** (para sacar `VITE_MERCHANT_ID`) y se hizo con las URLs actuales y sin flag de transición: el área del comercio del front deja de andar hasta que mande el token.
- [ ] **P1** Usuarios por comercio (dueño / cajero) con permisos distintos: hoy hay un solo dueño por comercio (`Merchant.ownerId`); para cajeros hará falta una tabla de miembros con rol
- [~] **P0** Solo los teléfonos habilitados pueden crear comercios: `ALLOWED_MERCHANT_PHONES` (lista en una variable de entorno; sin lista, abierto fuera de producción y cerrado en producción); 403 `MERCHANT_CREATION_NOT_ALLOWED` y `canCreateMerchant` en `GET /me` (2026-10-23; verificado por `tests/merchant-creation.test.ts`, 118 tests en verde; falta probarlo con el front)
- [ ] **P1** Traspaso de un comercio a otra persona sin pasar por el script, y un tope de comercios por persona (quien está habilitada puede crear los que quiera)
- [ ] **P1** Configurar `ALLOWED_MERCHANT_PHONES` en cada entorno donde haya comercios reales, y agregar la variable al `.env.example` (la sesión de la IA no puede editar ese archivo; ver `docs/BACKEND.md`)
- [ ] **P1** Asignar dueño a los comercios anteriores a los dueños (`npm run db:assign-merchant -- --list` los muestra) en cada base donde existan, incluida la de producción cuando haya
- [~] **P1** ABM básico de comercios: alta, listado, detalle y edición (sin autenticación todavía)
- [~] **P1** Perfil del comercio: nombre, teléfono, plan y perfil público (descripción, foto por URL, categoría, horarios, visibilidad); ver §12. Falta la subida del logo/foto
- [ ] **P2** Recuperación de contraseña

## 3. Clientes y saldo (Backend)

- [x] Alta/búsqueda de cliente por teléfono
- [x] Consulta de saldo
- [x] Carga con bonificación
- [x] Cobro descontando saldo
- [x] **P0** Evitar sobregiro con cobros concurrentes: cobros y ajustes corren en una transacción con `SELECT … FOR UPDATE` sobre el cliente; verificado por `tests/idempotency.test.ts` (dos cobros simultáneos: uno pasa, el otro da 422)
- [~] **P0** Normalizar teléfonos uruguayos (09X XXX XXX → +5989XXXXXXX) (`src/lib/phone.ts`; sin tests)
- [x] **P0** Idempotencia en cargas, cobros y ajustes: header `Idempotency-Key` **opcional** (`src/lib/idempotency.ts`, tabla `IdempotencyKey`, 48 h); verificada por los tests (misma clave, otro cuerpo, otra operación, errores no guardados, pedidos simultáneos). Hacerla obligatoria es decisión futura
- [~] **P1** Historial de movimientos por cliente, paginado (`GET /customers/:id/transactions`)
- [~] **P1** Listado de clientes del comercio con saldo y búsqueda por nombre o teléfono (la búsqueda normaliza el teléfono y `?phone=` filtra exacto sin crear; sin verificar)
- [~] **P1** Movimientos de todo el comercio: `GET /merchants/:id/transactions?from&to` con el cliente en cada fila (sin verificar)
- [~] **P1** Saldo de cada cliente y `total` en `/inactive` (sin verificar)
- [~] **P1** `userName` (el `User.name`, puede ser null) en las fichas de cliente: clientes, `/inactive` y el `customer` de `/merchants/:id/transactions` (2026-10-17; sin verificar)
- [~] **P1** Ajustes manuales con signo y nota obligatoria (`POST /customers/:id/adjustments`)
- [ ] **P1** Anulación de un movimiento (genera un ajuste inverso, nunca borra); hoy el ajuste es libre y no queda ligado al movimiento que corrige
- [ ] **P1** QR personal del cliente para identificarse en el mostrador
- [ ] **P2** Vencimiento de saldo según términos del comercio
- [ ] **P1** Unificar las unidades de la API (hoy recibe pesos y devuelve centésimos). **Deuda técnica aceptada 2026-10-13**: ya hay un consumidor (frontend) y cambiarlo lo rompe; se decide más adelante y en un cambio coordinado con el frontend
- [ ] **P2** Baja o archivado de comercios y clientes (a propósito no hay DELETE)

## 4. Bonificaciones (Backend)

- [~] Aplicación automática de la regla de mayor monto alcanzado (implementada en `ledger/service.ts`; sin verificar corriéndola)
- [~] **P0** ABM de reglas de bonificación (crear, listar, activar/desactivar); las reglas no se borran, se desactivan
- [x] **P1** Dos reglas activas del mismo monto mínimo: gana la de menor id (decidido y documentado en `BACKEND.md`)
- [~] **P1** Vista previa del bono en el servidor (`GET /merchants/:id/bonus-preview`), con la misma función que usa la carga real (sin verificar)
- [~] **P2** Cada `BONUS` guarda de qué regla salió (`bonusRuleId`); `name` y `description` opcionales en las reglas; `timesUsed` en el listado de reglas (sin verificar)
- [ ] **P1** Bonificación porcentual además de monto fijo
- [ ] **P2** Promos con fecha de vigencia

## 5. Notificaciones por WhatsApp (Backend)

- [ ] **P0** Interfaz `Notifier` con proveedor de consola (desarrollo) y WhatsApp Cloud API
- [ ] **P0** Mensaje automático con el saldo después de cada carga y cobro
- [ ] **P1** Plantillas de mensaje aprobadas por Meta
- [ ] **P1** Registro de mensajes enviados y su costo (para trasladarlo al comercio)
- [ ] **P1** Opt-out del cliente ("no quiero recibir mensajes")

## 6. Campañas y reactivación (Backend)

- [x] Listado de clientes inactivos por días sin visita
- [ ] **P1** Enviar promo a clientes inactivos con un clic
- [ ] **P1** Límite de envíos por plan y por cliente (no spamear)
- [ ] **P2** Segmentos: mejores clientes, saldo bajo, cumpleaños
- [ ] **P2** Ordenar los inactivos por antigüedad de la última visita (hoy van por id para que la paginación sea estable con valores nulos)

## 7. Reportes (Backend)

- [ ] **P1** Resumen mensual: saldo cargado, consumido, pendiente, bonificaciones otorgadas
- [ ] **P1** Clientes activos vs inactivos
- [ ] **P2** Exportación CSV para el contador

## 8. Planes y facturación de la plataforma (Backend + PO)

- [ ] **P1** Límites por plan (Básico: 300 clientes; Pro: campañas)
- [ ] **P1** Cobro de la suscripción al comercio (Mercado Pago suscripciones)
- [ ] **P2** Plan multi-local

## 9. Infraestructura y despliegue (Backend)

- [~] Conflicto de puerto local: `EADDRINUSE` en 3000 porque lo ocupa `iwant-backend`; se corre con `PORT=3001 npm run dev` (verificado 2026-10-13: levanta y `/dev` da 200; falta recorrer el flujo con Postgres arriba)
- [ ] **P1** Un puerto por defecto que no choque en desarrollo (o `PORT` fijado en `.env.example`) y un mensaje de error claro si está ocupado
- [~] **P1** Si la base no responde, devolver 503 `DATABASE_UNAVAILABLE` con `Retry-After` en vez de 500 genérico (`src/lib/error-handler.ts`) y reintentar la conexión al arrancar (`connectWithRetry`); escrito el 2026-10-25 y verificado por tests con errores simulados; falta probarlo con una base de Neon que se duerme de verdad
- [x] **P0** Dockerfile de la API (multi-stage, healthcheck, CLI de Prisma para migrar); validado por el job Imagen Docker en el PR #5
- [~] **P1** Paquetes por stage: merge a `dev` publica la imagen `develop` y merge a `main` la `production` en GHCR (`packages.yml`)
- [ ] **P2** Imagen más liviana: separar la CLI de Prisma de las dependencias de producción
- [x] **P0** CI en GitHub Actions: typecheck, migraciones, drift de schema, arranque y tests (`ci.yml`; ver `docs/CI.md`). Pasó en GitHub en el PR #2
- [x] **P0** Revisión con IA en cada PR a `dev`/`main` que aprueba o pide cambios y bloquea el merge si hay problemas graves (`ai-review.yml`). Aprobó el PR #3
- [x] **P1** Resumen de la revisión IA publicado por el workflow (visto en el PR #5) y error real de Claude visible en el check (este último sin ver todavía en una falla real)
- [x] **P0** Poner `dev` como rama por defecto del repo y mergear el PR #2 a mano (la revisión IA no puede revisar el PR que la crea)
- [x] **P0** Cargar en GitHub el secret de Claude y permitir que Actions apruebe PRs
- [ ] **P0** Protección de ramas de `dev` y `main` con los checks requeridos y 1 aprobación (pasos en `docs/CI.md`; después de la primera corrida)
- [ ] **P1** Lint (ESLint) como paso del CI
- [~] **P1** Despliegue en Render (plan free, `render.yaml` + `scripts/render-build.sh`) con la base en Neon: escrito el 2026-10-25, guía en `docs/DESPLIEGUE.md`; falta crear el Blueprint, desplegar y verificar (build, migraciones, `/health`, el primer pedido tras dormir). Después, el CD desde `packages.yml`: desplegar la imagen `develop` y la `production` desde `packages.yml` (CD)
- [~] **P1** `db:seed` y `db:reset-seed` con freno de seguridad: se niegan siempre con `NODE_ENV=production` y piden `--yes` si la base no es local (2026-10-25; probado con tests de la regla)
- [~] **P1** `APP_NAME` (nombre que se muestra: consola `/dev`, `GET /auth/config` y texto del SMS) y `APP_SLUG` (nombre técnico de la base local en `docker-compose.yml`); el resto del nombre (`package.json`, imágenes, workflows, docs) sigue a mano hasta que el nombre sea definitivo (ver `docs/DESPLIEGUE.md` §6)
- [ ] **P1** Variables de entorno de cada entorno desplegado (incluido el stage `develop`, que también corre con `NODE_ENV=production`): `OTP_PROVIDER=twilio` y sus tres credenciales (o `ALLOW_INSECURE_AUTH=true` solo para una demo), `ALLOWED_MERCHANT_PHONES`, `CORS_ORIGINS` y `TRUST_PROXY` si hay un proxy delante; sin las de ingreso la imagen no arranca (`docs/CI.md`)
- [ ] **P1** Backups automáticos de la base
- [ ] **P2** Monitoreo y alertas

## 10. Seguridad y datos personales (Backend + PO)

- [~] **P0** Rate limiting en login y rutas públicas (el login por código ya tiene límites por teléfono e IP; faltan las rutas públicas como `/places`)
- [~] **P1** CORS con `@fastify/cors` y orígenes permitidos por `CORS_ORIGINS` (nunca `*`); falta `npm install` y probarlo con el frontend
- [ ] **P1** Headers de seguridad antes de exponer la API
- [ ] **P0** Nunca loguear contraseñas ni tokens
- [ ] **P1** Cumplimiento de la Ley 18.331 de protección de datos personales (registro de base ante URCDP, consentimiento)
- [ ] **P1** Política de privacidad
- [ ] **P2** Auditoría de acciones sensibles (anulaciones, ajustes)

## 11. Calidad (QA)

- [ ] **P0** Recorrer a mano el flujo completo en `/dev` tras el refactor a módulos, con los casos de error (id inexistente, saldo insuficiente, teléfono inválido); hay un caso narrado en `docs/EJEMPLO.md`
- [ ] **P0** Plan de pruebas del flujo principal: alta de cliente → carga con bono → cobro → saldo
- [x] **P0** Tests de integración contra Postgres real (vitest): `npm test`, carpeta `tests/`, base aparte `platita_test`; 42 tests en verde (2026-10-18): ingreso, idempotencia y perfil/lugares. La cobertura sigue siendo parcial (faltan ledger, bonificaciones, clientes y aislamiento entre comercios)
- [ ] **P0** Casos borde de saldo: saldo exacto, insuficiente, montos con decimales, cobros concurrentes
- [ ] **P0** Tests de aislamiento entre comercios (un comercio no ve ni opera clientes de otro)
- [ ] **P0** Verificar corriendo lo del 2026-10-13 que los tests todavía no cubren: vista previa del bono, movimientos del comercio, búsqueda por teléfono e inactivos (idempotencia y cobros simultáneos ya verificados por `tests/`)
- [x] **P1** Tests de idempotencia (en `tests/idempotency.test.ts`, incluye cobros simultáneos; sin correr)
- [ ] **P1** Colección de requests (Bruno o Postman) para pruebas manuales
- [ ] **P1** Checklist de prueba manual en el celular del mostrador
- [ ] **P2** Pruebas de carga básicas

## 12. App del cliente: perfil público y lugares (Backend)

Hito iniciado el 2026-10-15. La web tiene dos áreas con la misma API: comercio y cliente (la persona que va a los comercios; por ahora solo mira, cargar por su cuenta es "Próximamente").

- [x] **P0** Perfil público del comercio: `description`, `photoUrl`, `category` (regla de 90 días: 422 `CATEGORY_CHANGE_TOO_SOON`), `visible` (422 `PROFILE_INCOMPLETE`) y `openingHours`, por `PATCH /merchants/:id` (verificado por los tests y probado con el frontend)
- [x] **P0** Locales: `Location` con `label`, `address` y `active`; `GET`/`POST /merchants/:id/locations` y `PATCH /locations/:id` (sin DELETE; 422 `LOCATION_REQUIRED_WHILE_VISIBLE`) (verificado por los tests)
- [x] **P0** Lugares públicos: `GET /places` (filtros `category` y `search`, orden por nombre) y `GET /places/:merchantId` (404 si no es visible); sin datos de clientes (verificado por los tests)
- [x] **P0** Ingreso del cliente por teléfono + código de un solo uso y sesión (2026-10-18; verificado con el proveedor `dev` por los tests; falta probarlo con el frontend y con un proveedor real): `GET /auth/config`, `POST /auth/request-code`, `POST /auth/verify-code`, `POST /auth/logout`, `GET`/`PATCH /me`. Token opaco único (sin JWT ni refresh), límites por teléfono e IP, 5 intentos y 5 minutos por código. Proveedor `dev` (acepta 000000). **No se puede publicar sin un proveedor real**: ver el ítem de Twilio abajo
- [~] **P0** Usuario global (`User`, por teléfono) enlazado desde cada `Customer.userId`, con `POST /users`, `GET`/`PATCH /users/:id` y `GET /users/:id/balances` **sin verificación** y solo fuera de producción (2026-10-16; migración y `tsc` verificados, lógica sin correr)
- [x] **P0** `GET /me/balances` (misma lógica que `/users/:id/balances`, con la sesión real): saldos del usuario verificado, juntando las filas `Customer` con su teléfono (verificado por los tests)
- [x] **P1** Rate limiting del ingreso (`/auth/request-code`: por teléfono e IP, en la base). Verificado por los tests. Falta el de `/places` y los endpoints públicos (`/places`, `/auth/client/*`), por IP y por teléfono
- [x] **P0** Proveedor real de códigos: `otp/twilio.ts` (Twilio Verify por SMS, con `fetch`, sin SDK): verificado con tests contra un `fetch` simulado (72 en verde) y **probado de punta a punta por el usuario con el frontend y su celular** (cuenta de prueba de Twilio); queda pendiente el canal WhatsApp. Credenciales solo en variables de entorno
- [~] **P1** Modo mixto de verificación (`OTP_REAL_PHONES`): 000000 para todos menos para los teléfonos de la lista, que van por Twilio; probado por el usuario con el frontend y por `tests/routing-provider.test.ts` y `config.test.ts` (99 tests en verde)
- [ ] **P1** Probar el canal WhatsApp de Twilio Verify (`OTP_CHANNEL=whatsapp`, sin cambios de código): activarlo en el servicio de Verify (en la cuenta de prueba, con la plantilla de prueba de Twilio y solo a números verificados; en producción hace falta un remitente de WhatsApp Business propio) y confirmar el precio a Uruguay, ver `docs/BACKEND.md`
- [ ] **P2** Variante inversa para producción: Twilio para todos y 000000 solo para una lista de teléfonos de prueba (revisores de tiendas de apps, pruebas de punta a punta); no implementada
- [ ] **P1** Confirmar en la web oficial de Twilio el precio por verificación a Uruguay, el crédito de prueba y si Uruguay exige registrar el nombre del remitente de los SMS; revisar que el servicio de Verify tenga códigos de 6 dígitos
- [ ] **P2** Credencial de Twilio con API Key (`SK…`) en vez del Auth Token de la cuenta, para poder revocarla sin tocar la cuenta
- [ ] **P0** Quitar `/users/*` y `INSECURE_USER_ROUTES` cuando el front use `/me/*`
- [ ] **P1** Producción con `OTP_PROVIDER` real, límites activos y `TRUST_PROXY` según el despliegue
- [ ] **P2** Subida y almacenamiento de la foto del comercio (hoy solo la URL)
- [ ] **P2** QR personal del cliente, diseñado sobre el usuario verificado (ver §3)
- [ ] **P2** Orden alternativo de `/places` (más nuevos primero, o por cercanía si algún día hay coordenadas)
- [ ] **P2** Endpoint de administración para cambiar la categoría antes de los 90 días (hoy se corrige a mano en la base)
- [ ] **P1** Verificar corriendo lo que los tests no cubren de 2026-10-15/16: el relleno de usuarios de la migración `usuarios_globales` sobre una base con datos reales y las rutas `/users` con `INSECURE_USER_ROUTES=false` (perfil, locales y `/places` ya verificados por `tests/`)
- [ ] **P2** Revisar las 6 vulnerabilidades de `npm audit` en dependencias de desarrollo (vitest 2: vite y esbuild; producción está limpia, `npm audit --omit=dev` da 0): probar una versión más nueva de vitest. No usar `npm audit fix --force`
- [ ] **P0** Verificar con el frontend lo del 2026-10-22 (migración, `tsc` y tests ya verificados): que mande el token, la pantalla de a qué cuenta entrar según `GET /me`, y que el preflight de CORS del navegador real no pida sesión (hay un test, falta el navegador)
- [ ] **P1** Verificar con Render + Neon lo del 2026-10-25: que `CustomFriendlyName` (el nombre de la app en el SMS) lo acepte Twilio, cuánto tardan en despertar Render y Neon, y si aparece un `P1017` en el primer pedido
