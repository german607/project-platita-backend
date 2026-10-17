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
- [ ] **P1** Seed de datos de ejemplo para desarrollo
- [x] Arquitectura modular por área (`src/modules/<área>` con schemas, service y routes) y `buildApp()` testeable; ver `docs/BACKEND.md`
- [~] Consola de pruebas local en `/dev`, solo fuera de producción (`src/dev/console.ts`)
- [ ] **P1** Ponerle nombres descriptivos a las migraciones nuevas (las dos primeras quedaron como `primeramigracion_jero` y `segunda_parte`)
- [ ] **P2** Contrato de API formal (OpenAPI) cuando las rutas se estabilicen; por ahora la tabla de `docs/BACKEND.md` alcanza
- [x] **P1** Fijar la versión mínima de Node: `engines >=22` en `package.json` y `.nvmrc` con `22` (coincide con el Dockerfile y el CI; 2026-10-13)

## 2. Autenticación y comercios (Backend)

- [ ] **P0** Registro y login de comercio (email + contraseña, hash con bcrypt)
- [ ] **P0** JWT y middleware de autenticación
- [ ] **P0** Acotar **todas** las rutas al comercio autenticado (hoy cualquiera puede operar sobre cualquier `merchantId`)
- Decisión 2026-10-13: la autenticación **se posterga** y no se toca por ahora (el frontend usa un `merchantId` fijo por configuración). Cuando se haga: mantener las URLs actuales y solo verificar que `:merchantId` sea el del token, con un flag `AUTH_REQUIRED` para migrar sin cortar al frontend.
- [ ] **P1** Usuarios por comercio (dueño / cajero) con permisos distintos
- [~] **P1** ABM básico de comercios: alta, listado, detalle y edición (sin autenticación todavía)
- [~] **P1** Perfil del comercio: nombre, teléfono, plan y perfil público (descripción, foto por URL, categoría, horarios, visibilidad); ver §12. Falta la subida del logo/foto
- [ ] **P2** Recuperación de contraseña

## 3. Clientes y saldo (Backend)

- [x] Alta/búsqueda de cliente por teléfono
- [x] Consulta de saldo
- [x] Carga con bonificación
- [x] Cobro descontando saldo
- [~] **P0** Evitar sobregiro con cobros concurrentes: cobros y ajustes corren en una transacción con `SELECT … FOR UPDATE` sobre el cliente; falta el test de concurrencia
- [~] **P0** Normalizar teléfonos uruguayos (09X XXX XXX → +5989XXXXXXX) (`src/lib/phone.ts`; sin tests)
- [~] **P0** Idempotencia en cargas, cobros y ajustes: header `Idempotency-Key` **opcional** (`src/lib/idempotency.ts`, tabla `IdempotencyKey`, 48 h); falta correrla y los tests. Hacerla obligatoria es decisión futura
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
- [ ] **P1** Si la base no responde, devolver 503 con mensaje claro en vez de 500 genérico (`src/lib/error-handler.ts`)
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
- [ ] **P1** Despliegue en un proveedor barato (Railway, Render o Fly.io) + Postgres gestionado: desplegar la imagen `develop` y la `production` desde `packages.yml` (CD)
- [ ] **P1** Backups automáticos de la base
- [ ] **P2** Monitoreo y alertas

## 10. Seguridad y datos personales (Backend + PO)

- [ ] **P0** Rate limiting en login y rutas públicas
- [~] **P1** CORS con `@fastify/cors` y orígenes permitidos por `CORS_ORIGINS` (nunca `*`); falta `npm install` y probarlo con el frontend
- [ ] **P1** Headers de seguridad antes de exponer la API
- [ ] **P0** Nunca loguear contraseñas ni tokens
- [ ] **P1** Cumplimiento de la Ley 18.331 de protección de datos personales (registro de base ante URCDP, consentimiento)
- [ ] **P1** Política de privacidad
- [ ] **P2** Auditoría de acciones sensibles (anulaciones, ajustes)

## 11. Calidad (QA)

- [ ] **P0** Recorrer a mano el flujo completo en `/dev` tras el refactor a módulos, con los casos de error (id inexistente, saldo insuficiente, teléfono inválido); hay un caso narrado en `docs/EJEMPLO.md`
- [ ] **P0** Plan de pruebas del flujo principal: alta de cliente → carga con bono → cobro → saldo
- [ ] **P0** Tests de integración contra Postgres real (vitest)
- [ ] **P0** Casos borde de saldo: saldo exacto, insuficiente, montos con decimales, cobros concurrentes
- [ ] **P0** Tests de aislamiento entre comercios (un comercio no ve ni opera clientes de otro)
- [ ] **P0** Verificar corriendo lo del 2026-10-13: recorrer (migración, `npm install` y `tsc` ya verificados) idempotencia (mismo cuerpo, otro cuerpo, concurrente), preview, movimientos del comercio, búsqueda por teléfono e inactivos
- [ ] **P1** Tests de idempotencia
- [ ] **P1** Colección de requests (Bruno o Postman) para pruebas manuales
- [ ] **P1** Checklist de prueba manual en el celular del mostrador
- [ ] **P2** Pruebas de carga básicas

## 12. App del cliente: perfil público y lugares (Backend)

Hito iniciado el 2026-10-15. La web tiene dos áreas con la misma API: comercio y cliente (la persona que va a los comercios; por ahora solo mira, cargar por su cuenta es "Próximamente").

- [~] **P0** Perfil público del comercio: `description`, `photoUrl`, `category` (regla de 90 días: 422 `CATEGORY_CHANGE_TOO_SOON`), `visible` (422 `PROFILE_INCOMPLETE`) y `openingHours`, por `PATCH /merchants/:id` (migración escrita a mano, sin aplicar)
- [~] **P0** Locales: `Location` con `label`, `address` y `active`; `GET`/`POST /merchants/:id/locations` y `PATCH /locations/:id` (sin DELETE; 422 `LOCATION_REQUIRED_WHILE_VISIBLE`)
- [~] **P0** Lugares públicos: `GET /places` (filtros `category` y `search`, orden por nombre) y `GET /places/:merchantId` (404 si no es visible); sin datos de clientes
- [ ] **Postergado 2026-10-15** (no se pide por ahora; se prueba primero lo demás) Ingreso del cliente por teléfono + código de un solo uso y sesión: `POST /auth/client/request-code`, `POST /auth/client/verify`, `GET`/`PATCH /me`, `POST /auth/logout`. **No se puede publicar sin la verificación real**; depende de un proveedor de WhatsApp/SMS (ver §5) y de rate limiting (§10)
- [~] **P0** Usuario global (`User`, por teléfono) enlazado desde cada `Customer.userId`, con `POST /users`, `GET`/`PATCH /users/:id` y `GET /users/:id/balances` **sin verificación** y solo fuera de producción (2026-10-16; migración y `tsc` verificados, lógica sin correr)
- [ ] **Postergado 2026-10-15** (depende de la sesión del cliente) `GET /me/balances` (misma lógica que `/users/:id/balances`): saldos del usuario verificado, juntando las filas `Customer` con su teléfono
- [ ] **Postergado 2026-10-15** Rate limiting en los endpoints públicos (`/places`, `/auth/client/*`), por IP y por teléfono
- [ ] **P2** Subida y almacenamiento de la foto del comercio (hoy solo la URL)
- [ ] **P2** QR personal del cliente, diseñado sobre el usuario verificado (ver §3)
- [ ] **P2** Orden alternativo de `/places` (más nuevos primero, o por cercanía si algún día hay coordenadas)
- [ ] **P2** Endpoint de administración para cambiar la categoría antes de los 90 días (hoy se corrige a mano en la base)
- [ ] **P1** Verificar corriendo lo del 2026-10-15 (migración y `tsc` ya verificados): perfil (categoría dos veces, visible sin local), locales (baja del único activo), `/places` con y sin promo, y que un comercio no visible dé 404
