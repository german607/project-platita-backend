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
