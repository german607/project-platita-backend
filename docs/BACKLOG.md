# Backlog — qué falta, ahora mismo

Estado actual de pendientes, a diferencia de [`CHANGELOG.md`](CHANGELOG.md)
(historia, cronológico) y [`STATE.md`](STATE.md) (foto general del
presente). Cuando algo de acá se resuelve, se borra en el mismo cambio
que lo resuelve — no se deja para que la próxima sesión tenga que
releer todo para reconstruir esta lista. Ver la regla en
[`AGENTS.md`](AGENTS.md).

## Verificar primero (código escrito, nunca compilado ni corrido)

- Recorrer el flujo completo desde `/dev`: comercio → regla → cliente →
  carga con bono → cobro → ajuste → movimientos → inactivos, más los
  casos de error (id inexistente, saldo insuficiente, teléfono inválido).
- Probar el bloqueo de cobros simultáneos (dos `charges` a la vez sobre
  el mismo cliente con saldo para uno solo).
- Los nombres de las migraciones (`primeramigracion_jero`,
  `segunda_parte`) no son descriptivos y ya quedaron commiteados; las
  siguientes tienen que llevar un nombre que diga qué hacen.

## Backend — a diseñar/implementar

- **Autenticación de comercios** y que cada comercio solo vea lo suyo
  (hoy cualquiera con un id puede operar). Es el pendiente más serio.
- **Idempotencia** en cargas, cobros y ajustes (header `Idempotency-Key`):
  un reintento por mala señal en el mostrador hoy duplica el movimiento.
- **Reglas de bonificación**: hoy dos reglas con el mismo `minTopUp`
  son ambiguas (gana la de menor id). Decidir si se impide, y si el
  bono puede ser porcentaje además de monto fijo.
- **Límites por plan** (BASIC: hasta 300 clientes): el lugar natural es
  `customers/service.ts`, al crear.
- **Asimetría de unidades**: la API recibe pesos y devuelve centésimos.
  Decidir si se unifica (recomendado antes de que haya clientes de la
  API) y registrar la decisión.
- Baja/archivado de comercios y clientes (no hay DELETE a propósito).
- Teléfonos: la normalización solo cubre Uruguay.
- Orden de `/inactive` por antigüedad de visita (hoy por `id` para que
  la paginación sea estable con nulos).
- Mensaje de WhatsApp con el saldo después de cada uso (plantillas
  aprobadas, opt-in del cliente, costo por mensaje) y envío de campañas
  a inactivos: módulo nuevo (`src/modules/campaigns/`).
- Rate limiting, CORS y headers de seguridad antes de exponer la API.
- Contrato de API formal (OpenAPI) cuando las rutas se estabilicen.

## Producto

- Panel web para el mostrador (mobile first) y QR propio del cliente.

## Calidad / infraestructura

- Tests (con `buildApp()` + `app.inject()`), empezando por el libro
  mayor: bono, saldo insuficiente, cobros simultáneos, ajustes.
- Logs, métricas y manejo de variables de entorno por ambiente para
  producción.
- Aviso de Node: `cookie@2.0.1` (dependencia de Fastify) pide Node >= 22
  y la máquina tiene 20.12.2. No frenó nada por ahora; agregar
  `engines` al `package.json` cuando se decida la versión.
- Datos de prueba viejos en la base local con teléfonos sin normalizar
  (si los hubiera): borrar o migrar.

## Negocio / validación

- Validar encuadre legal del saldo cerrado con abogado y contador.
- Corregir la tabla de números del README §6: "Ticket promedio USD 45"
  parece ser el ingreso por comercio para Platita, no el ticket del
  comercio. Confirmar y reetiquetar.
- Ejecutar la validación concierge del README §10.
