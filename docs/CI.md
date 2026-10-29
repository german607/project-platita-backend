# CI/CD — Platita

Todo PR hacia `dev` o `main` pasa por dos controles automáticos antes de
poder mergearse. Los workflows están en `.github/workflows/`.

## Flujo de ramas

```
feature/xxx ──PR──▶ dev ──PR──▶ main
hotfix/xxx  ──PR──────────────▶ main
```

- Cada tarea sale de `dev` en una rama `feature/...` y vuelve a `dev` por PR.
- `main` solo recibe PRs desde `dev` (o `hotfix/*` para urgencias). El CI
  rechaza un PR a `main` desde cualquier otra rama.

## Los controles

### 1. CI (`ci.yml`)

Corre en cada PR hacia `dev` o `main` y en cada push a esas ramas.

| Paso | Qué valida |
|---|---|
| Flujo de ramas | Solo en PRs a `main`: que vengan de `dev` o `hotfix/*` |
| `npm ci` | Que `package-lock.json` esté al día |
| `prisma generate` + `tsc --noEmit` | Que el código compile sin errores de tipos |
| `prisma migrate deploy` | Que las migraciones se apliquen sobre un Postgres 16 limpio |
| `prisma migrate diff` | Que `schema.prisma` no tenga cambios sin migración |
| `npm run build` + `/health` | Que la API compile y levante |
| `npm test --if-present` | Los tests (vitest, `tests/`). En el CI usan la base del job (`DATABASE_URL`, `CI=true`); en local, `platita_test` (ver `BACKEND.md`) |
| Imagen Docker (solo PRs) | Que el `Dockerfile` arme, que las migraciones corran dentro del contenedor y que la imagen responda `/health`. Se levanta con la configuración de producción (Twilio con credenciales de mentira): sin un proveedor de códigos real la imagen no arranca a propósito |

### 2. Revisión IA (`ai-review.yml`)

Claude (con [`anthropics/claude-code-action`](https://github.com/anthropics/claude-code-action))
revisa el diff usando las reglas de `docs/AGENTS.md` y de los roles de
`.claude/skills/`:

- Deja comentarios en las líneas con problemas, marcados **[Bloqueante]** o
  **[Sugerencia]**.
- Devuelve un veredicto estructurado (veredicto, cantidad de bloqueantes y
  resumen). Con eso el workflow deja una revisión formal en el PR, firmada
  por `github-actions[bot]`, con el resumen como texto: **Approve** si no hay
  bloqueantes, **Request changes** si los hay. Una aprobación posterior
  reemplaza el "request changes" anterior.
- Si Claude falla (credencial inválida, límite de uso, etc.), el check
  muestra el error real del registro de ejecución, sin tener que abrir el
  log.
- **El check falla si hay al menos un bloqueante**, y así bloquea el merge.

La aprobación sirve para exigir "1 aprobación" en la protección de ramas
sin trabarse: GitHub no deja aprobar los PRs propios. En `main` conviene
exigir además una aprobación humana.

Qué bloquea: montos con decimales, movimientos del libro mayor editados o
borrados, operaciones no acotadas al comercio, cobros sin bloqueo (sobregiro),
cualquier custodia de dinero, secretos en el código, entrada sin validar,
schema sin migración, código sin entrada en `CHANGELOG.md` y errores de
lógica. El estilo, los nombres y la falta de tests son sugerencias.

Los PRs en borrador no se revisan; se revisan al marcarlos como listos. Cada
push nuevo al PR dispara una revisión nueva.

**Límite de seguridad:** la action de Claude solo corre si
`.github/workflows/ai-review.yml` del PR es idéntico al de la rama por
defecto del repo. Así un PR no puede cambiar a su propio revisor. Un PR que
modifica ese archivo falla la revisión con un mensaje que lo explica, y lo
tiene que revisar y mergear una persona. Por eso la rama por defecto del
repo tiene que ser `dev`: los PRs salen de `dev` y llevan el mismo
workflow.

## Configuración (una sola vez, en GitHub)

### Secret de Claude

En el repo: **Settings → Secrets and variables → Actions → New repository
secret**. Alcanza con uno de los dos:

| Secret | Cuándo usarlo | Cómo conseguirlo |
|---|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Si tenés plan Pro o Max (consume de tu plan) | En tu computadora: `claude setup-token` |
| `ANTHROPIC_API_KEY` | Si preferís pagar por uso | console.anthropic.com → API Keys |

Además, la app de Claude para GitHub tiene que estar instalada con acceso a
este repo (ya lo está).

### Permitir que Actions apruebe PRs

**Settings → Actions → General → Workflow permissions** → tildar **Allow
GitHub Actions to create and approve pull requests** → **Save**. Sin esto,
la revisión IA falla al intentar aprobar.

### Rama por defecto

**Settings → General → Default branch** → `dev`. Ver el límite de
seguridad de la revisión IA, más arriba.

### Protección de ramas

En **Settings → Rules → Rulesets → New branch ruleset**, uno para `dev` y
otro para `main` (o uno solo apuntando a las dos):

- **Require a pull request before merging**, con *Required approvals* en 1.
- **Require status checks to pass**, agregando:
  - `Build, migraciones y arranque`
  - `Revisión de Claude`
  - `Flujo de ramas` (solo en `main`)
- **Block force pushes**.

Los checks aparecen en la lista después de la primera corrida.

## Correr el CI en local

```bash
docker compose up -d
npm ci
npx prisma generate && npx tsc --noEmit
npx prisma migrate deploy
npm run build && node dist/server.js   # y en otra terminal: curl localhost:3000/health
```

## Paquetes por stage (`packages.yml`)

Cada merge publica una imagen Docker de la API en GitHub Packages
(`ghcr.io/german607/project-platita-backend`), solo si el CI pasó sobre el
commit mergeado:

| Merge a | Stage (environment) | Tags |
|---|---|---|
| `dev` | `develop` | `develop`, `develop-<sha>` |
| `main` | `production` | `production`, `latest`, `production-<sha>` |

- Los PRs no publican nada; publica el merge (el push a la rama).
- Cada publicación queda como deployment en **Environments** del repo, con
  link al paquete. Los tags `develop`/`production` siempre apuntan a la
  última; los tags con `<sha>` no cambian y sirven para volver atrás.
- La imagen no corre migraciones sola. Al desplegar:
  ```bash
  docker run --rm -e DATABASE_URL=... ghcr.io/german607/project-platita-backend:develop npx prisma migrate deploy
  docker run -d -e DATABASE_URL=... -e OTP_PROVIDER=twilio -e TWILIO_ACCOUNT_SID=... \
    -e TWILIO_AUTH_TOKEN=... -e TWILIO_VERIFY_SID=... -p 3000:3000 \
    ghcr.io/german607/project-platita-backend:develop
  ```
- **La imagen corre con `NODE_ENV=production` (también la del stage `develop`)
  y se niega a arrancar sin un proveedor de códigos real**: hace falta
  `OTP_PROVIDER=twilio` con sus tres credenciales, o, para una demo con el código
  de prueba `000000`, `ALLOW_INSECURE_AUTH=true` (el log lo avisa en grande). Sin
  `ALLOWED_MERCHANT_PHONES` nadie puede crear comercios, y las rutas
  `/users/*` no existen salvo `INSECURE_USER_ROUTES=true`. Detalle en
  [`BACKEND.md`](BACKEND.md).
- La API también se puede desplegar sin Docker, desde el código, en Render (`render.yaml`): ver [`DESPLIEGUE.md`](DESPLIEGUE.md).
- `packages.yml` se dispara con `workflow_run`, que usa la versión del
  archivo en la rama por defecto (`dev`). Un cambio a este workflow aplica
  desde que se mergea en `dev`.

Todavía no hay servidor: las imágenes quedan publicadas listas para
desplegar. Cuando se elija proveedor (`TODO.md` §9), el despliegue se suma
como un paso más de este workflow, por environment.
