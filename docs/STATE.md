# Estado actual — Platita

> Última actualización: 2026-10-12. Esto es una foto del presente, se
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
Se trabaja en la rama `jeronimo/contexto-y-docs` (commits `6c9388c` y
`a7dfce0`, este último el merge de `origin/dev`). Sin push. Este repo
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
Están en el PR #2 (`feature/ci-cd` → `dev`), sin mergear. **El CI pasó
en GitHub.** **La revisión IA todavía no corrió**: la action solo corre si
`ai-review.yml` es idéntico al de la rama por defecto, y hoy la rama por
defecto es `main`, donde no existe. Para destrabarlo: poner `dev` como
rama por defecto y mergear el PR #2 a mano; desde ahí los PRs que salgan
de `dev` se revisan. El secret de Claude y el permiso de Actions para
aprobar PRs ya están cargados en GitHub; falta la protección de ramas. No
hay despliegue (CD) todavía.

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
bonificación (alta, listado, edición/desactivación), clientes (alta por
teléfono, listado con saldo, detalle, edición, saldo, inactivos) y libro
mayor (carga con bono, cobro, ajuste, movimientos).

Consola de pruebas local en `GET /dev` (`src/dev/console.ts`), con todos
los endpoints en orden de uso; solo si `NODE_ENV !== "production"`.

### Qué está verificado y qué no

- **Verificado (2026-10-11)**, antes del refactor a módulos: las
  dependencias se instalan, la migración inicial se aplica sobre
  Postgres en Docker, el servidor levanta y la consola `/dev` anduvo en
  el navegador. El puerto 3000 de esta máquina lo ocupa `iwant-backend`,
  así que Platita se corre con `PORT=3001`.
- **Verificado después del refactor**: `tsc --noEmit` pasa sin errores
  y la migración de los índices (`segunda_parte`) se aplicó.
- **Escrito y sin verificar en ejecución**: los endpoints nuevos, el
  bloqueo de cobros simultáneos, la normalización de teléfonos y la
  paginación. No se recorrió el flujo completo. Ver la lista "Verificar
  primero" del [`TODO`](../TODO.md) (los ítems `[~]`).

## No existe todavía

- Autenticación de comercios (hoy cualquiera con un id puede operar).
- WhatsApp (mensaje de saldo y campañas).
- Frontend / panel del mostrador, QR.
- Tests.

## Decisiones abiertas

- Si el modelo de saldo cerrado es suficiente a nivel legal (Banco
  Central y defensa del consumidor, incluyendo qué pasa si el comercio
  cierra). Pendiente de abogado y contador.
- Cuánto backend construir antes de validar con el concierge del README
  §10.
- La API recibe pesos y devuelve centésimos; ver si se unifica.
- El usuario manifestó dudas sobre partes del plan (a precisar en la
  próxima sesión); cuando se concreten, registrarlas acá.
