# Reglas para quien (o la IA que) trabaje en este proyecto

Este proyecto puede pasar por distintas sesiones de IA en distintos
momentos — la misma IA en otra sesión, u otra IA distinta, u otra persona
que se incorpora. Para que el traspaso sea inmediato, sin tener que
releer una conversación entera para reconstruir el contexto, este repo
lleva su propio registro en markdown. Es la fuente de verdad, no una
conversación de chat en particular.

## Regla obligatoria

Cualquier cambio de código, de diseño, o decisión de producto/arquitectura
que se tome se registra **en el mismo cambio** (no "después"):

- [`STATE.md`](STATE.md) — se **reescribe** para reflejar la realidad
  ahora mismo. No es un historial: es una foto del presente. Si algo que
  decía deja de ser cierto, se corrige o se borra.
- [`CHANGELOG.md`](CHANGELOG.md) — se **agrega** una entrada nueva al
  final, con fecha. Nunca se borra ni se reescribe una entrada vieja: es
  historia. Si algo quedó mal documentado, se corrige con una entrada
  nueva que lo aclara, no editando la vieja.
- [`../TODO.md`](../TODO.md) — **el único backlog** del proyecto, por área
  y con prioridad P0/P1/P2. Si el cambio resuelve un pendiente, se marca
  (`[x]`, o `[~]` si está implementado pero sin verificar corriéndolo).
  Si genera un pendiente nuevo, se agrega en su sección. No se mantiene
  otra lista de pendientes en ningún otro lado.
- [`BACKEND.md`](BACKEND.md) — si el cambio toca el modelo de datos, un
  endpoint o una regla del dominio (saldo, bonificación, etc.), se
  actualiza ahí. Es la única tabla de endpoints (el README solo apunta
  acá).
- [`../README.md`](../README.md) — contiene el plan de negocio. Si una
  decisión de negocio cambia (precios, segmento, riesgos), se corrige
  ahí también.

## Al arrancar una sesión nueva

Leer en este orden:
1. [`STATE.md`](STATE.md) — dónde estamos, ahora.
2. [`../TODO.md`](../TODO.md) — qué falta y con qué prioridad.
3. [`BACKEND.md`](BACKEND.md) — si el trabajo toca el backend: modelo de
   datos, endpoints y reglas del dominio ya cerradas.
4. [`EJEMPLO.md`](EJEMPLO.md) — un caso de uso narrado que recorre todos
   los endpoints; la forma más rápida de entender el flujo completo.
5. [`CHANGELOG.md`](CHANGELOG.md) — solo si hace falta más detalle
   histórico de por qué algo quedó como quedó.

No asumir que lo que dice una conversación de chat vieja sigue vigente
si contradice estos archivos — estos archivos ganan.

## Roles (skills del proyecto)

En `.claude/skills/` hay tres roles de trabajo: `platita-product-owner`
(qué se construye y por qué), `platita-backend-engineer` (implementación
y revisión de código) y `platita-qa` (planes de prueba y tests). Cada
uno parte de las reglas de este documento; si un rol y este documento se
contradicen, gana este documento.

## Notas de sesión

`docs/sesiones/AAAA-MM-DD.md` son resúmenes narrativos de una sesión de
trabajo (qué se habló y se decidió). Son opcionales y no reemplazan nada
de lo anterior: el registro obligatorio es `CHANGELOG.md`, y una nota de
sesión no se actualiza después, igual que una entrada del changelog.

## Dónde se ponen las reglas (para cualquier IA o agente)

Cada herramienta busca sus reglas en un lugar distinto. Para no duplicar
contenido, **las reglas reales viven acá (`docs/AGENTS.md`)** y los demás
archivos son punteros de una línea:

| Herramienta | Archivo que lee automáticamente |
|---|---|
| Claude Code | `CLAUDE.md` (raíz) |
| Codex, Cursor, Copilot y otros | `AGENTS.md` (raíz) |

Si se suma otra herramienta con su propio archivo de reglas, se crea un
puntero a este documento — no se copian las reglas.

## Convenciones del proyecto

- Idioma de la documentación y de los mensajes de commit: español.
- Montos guardados siempre en **centésimos de peso**, enteros. Nunca
  decimales ni `float` en la base.
- El saldo **nunca se guarda suelto**: se calcula sumando `Transaction`.
  Los movimientos no se editan ni se borran: se corrigen con ajustes.
- La plataforma **no custodia dinero** (ver README §4). Cualquier cambio
  que se acerque a mover o guardar plata es una decisión de negocio y
  legal, no solo técnica: se consulta antes y se registra en `STATE.md`.
- Trabajo en ramas propias, no directo en `main`.
- El backend se organiza en módulos (`src/modules/<área>/` con
  `schemas.ts`, `service.ts`, `routes.ts`); la lógica va en el servicio,
  nunca en la ruta. Detalle y receta para agregar cosas en
  [`BACKEND.md`](BACKEND.md).
- Todo endpoint nuevo o modificado se refleja también en la consola de
  pruebas `src/dev/console.ts`, en la tabla de [`BACKEND.md`](BACKEND.md)
  y, si aparece en el caso narrado, en [`EJEMPLO.md`](EJEMPLO.md).
- No se declara que algo "anda" sin haberlo corrido: lo escrito pero sin
  verificar se anota como tal en `STATE.md` y se marca `[~]` en el TODO.
- Commits solo cuando el usuario lo pida.
