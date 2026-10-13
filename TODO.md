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
- [ ] **P1** Fijar la versión mínima de Node (una dependencia de Fastify pide >= 22; algunas máquinas de desarrollo tienen 20.12) y agregar `engines` al `package.json`

## 2. Autenticación y comercios (Backend)

- [ ] **P0** Registro y login de comercio (email + contraseña, hash con bcrypt)
- [ ] **P0** JWT y middleware de autenticación
- [ ] **P0** Acotar **todas** las rutas al comercio autenticado (hoy cualquiera puede operar sobre cualquier `merchantId`)
- [ ] **P1** Usuarios por comercio (dueño / cajero) con permisos distintos
- [~] **P1** ABM básico de comercios: alta, listado, detalle y edición (sin autenticación todavía)
- [ ] **P1** Perfil del comercio: nombre, teléfono, logo, plan
- [ ] **P2** Recuperación de contraseña

## 3. Clientes y saldo (Backend)

- [x] Alta/búsqueda de cliente por teléfono
- [x] Consulta de saldo
- [x] Carga con bonificación
- [x] Cobro descontando saldo
- [~] **P0** Evitar sobregiro con cobros concurrentes: cobros y ajustes corren en una transacción con `SELECT … FOR UPDATE` sobre el cliente; falta el test de concurrencia
- [~] **P0** Normalizar teléfonos uruguayos (09X XXX XXX → +5989XXXXXXX) (`src/lib/phone.ts`; sin tests)
- [ ] **P0** Idempotencia en cargas y cobros (clave de idempotencia para evitar dobles registros)
- [~] **P1** Historial de movimientos por cliente, paginado (`GET /customers/:id/transactions`)
- [~] **P1** Listado de clientes del comercio con saldo y búsqueda por nombre o teléfono
- [~] **P1** Ajustes manuales con signo y nota obligatoria (`POST /customers/:id/adjustments`)
- [ ] **P1** Anulación de un movimiento (genera un ajuste inverso, nunca borra); hoy el ajuste es libre y no queda ligado al movimiento que corrige
- [ ] **P1** QR personal del cliente para identificarse en el mostrador
- [ ] **P2** Vencimiento de saldo según términos del comercio
- [ ] **P1** Unificar las unidades de la API: hoy recibe pesos y devuelve centésimos; decidir antes de que haya consumidores de la API
- [ ] **P2** Baja o archivado de comercios y clientes (a propósito no hay DELETE)

## 4. Bonificaciones (Backend)

- [~] Aplicación automática de la regla de mayor monto alcanzado (implementada en `ledger/service.ts`; sin verificar corriéndola)
- [~] **P0** ABM de reglas de bonificación (crear, listar, activar/desactivar); las reglas no se borran, se desactivan
- [ ] **P1** Definir qué pasa con dos reglas activas del mismo monto mínimo (hoy gana la de menor id)
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

- [~] **P0** Dockerfile de la API (multi-stage, healthcheck, CLI de Prisma para migrar); se valida en el CI de cada PR
- [~] **P1** Paquetes por stage: merge a `dev` publica la imagen `develop` y merge a `main` la `production` en GHCR (`packages.yml`)
- [ ] **P2** Imagen más liviana: separar la CLI de Prisma de las dependencias de producción
- [x] **P0** CI en GitHub Actions: typecheck, migraciones, drift de schema, arranque y tests (`ci.yml`; ver `docs/CI.md`). Pasó en GitHub en el PR #2
- [x] **P0** Revisión con IA en cada PR a `dev`/`main` que aprueba o pide cambios y bloquea el merge si hay problemas graves (`ai-review.yml`). Aprobó el PR #3
- [~] **P1** Resumen de la revisión IA publicado por el workflow y error real de Claude visible en el check (PR #4, mergeado; falta verlo en una corrida real)
- [x] **P0** Poner `dev` como rama por defecto del repo y mergear el PR #2 a mano (la revisión IA no puede revisar el PR que la crea)
- [x] **P0** Cargar en GitHub el secret de Claude y permitir que Actions apruebe PRs
- [ ] **P0** Protección de ramas de `dev` y `main` con los checks requeridos y 1 aprobación (pasos en `docs/CI.md`; después de la primera corrida)
- [ ] **P1** Lint (ESLint) como paso del CI
- [ ] **P1** Despliegue en un proveedor barato (Railway, Render o Fly.io) + Postgres gestionado: desplegar la imagen `develop` y la `production` desde `packages.yml` (CD)
- [ ] **P1** Backups automáticos de la base
- [ ] **P2** Monitoreo y alertas

## 10. Seguridad y datos personales (Backend + PO)

- [ ] **P0** Rate limiting en login y rutas públicas
- [ ] **P1** CORS y headers de seguridad antes de exponer la API
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
- [ ] **P1** Tests de idempotencia
- [ ] **P1** Colección de requests (Bruno o Postman) para pruebas manuales
- [ ] **P1** Checklist de prueba manual en el celular del mostrador
- [ ] **P2** Pruebas de carga básicas
