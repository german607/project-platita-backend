# Platita

**Saldo prepago y fidelización para comercios de barrio en Uruguay.**

> "Te adelanto plata y te hago volver a los clientes."

El cliente carga saldo en su comercio de confianza con una bonificación ("cargá $2.000 y recibís $2.300"), paga descontando ese saldo, y el comercio puede reactivar por WhatsApp a quien dejó de venir.

---

## 1. Propuesta de valor

**Para el comercio**
- Cobra por adelantado: caja hoy por lo que el cliente consume el mes que viene.
- El cliente vuelve porque tiene saldo cargado.
- Puede reactivar por WhatsApp a quien dejó de venir.

**Para el cliente final**
- Recibe un bono por cargar saldo.
- Paga más rápido.
- No descarga ninguna app: se identifica con su número de celular.

## 2. Segmento inicial

Comercios de visita frecuente y ticket repetido:

- Cafeterías
- Barberías y peluquerías
- Estudios de pilates y yoga
- Panaderías
- Lavaderos

Arranque en 2 o 3 barrios de Montevideo (Pocitos, Cordón, Malvín) para que los comercios se refieran entre sí.

## 3. Producto mínimo (MVP)

- Panel web para el comercio, que funcione bien en el celular del mostrador.
- Carga de saldo con bonificación configurable.
- Cobro descontando saldo, buscando al cliente por teléfono o por un QR propio.
- Mensaje automático de WhatsApp con el saldo después de cada uso.
- Lista de clientes inactivos y envío de una promo con un clic.

## 4. Decisión clave: no tocar la plata

La carga se cobra **directamente en la cuenta de Mercado Pago del comercio, o en efectivo en el local**. La plataforma solo lleva el registro del saldo.

- Simplifica mucho lo regulatorio: no hay custodia de fondos.
- El saldo es **cerrado**: solo vale en el comercio que lo emitió.
- Referencia: en Uruguay, quien emite dinero electrónico necesita autorización del Banco Central (por ejemplo, Midinero opera como Institución Emisora de Dinero Electrónico). Platita evita ese terreno al no guardar dinero.

> ⚠️ Validar con un abogado y un contador antes de lanzar, en especial el encuadre del saldo cerrado y el tratamiento contable del saldo que nunca se consume.

## 5. Monetización

| Plan | Precio aprox. | Incluye |
|---|---|---|
| Básico | USD 29/mes | Saldo prepago, hasta 300 clientes |
| Pro | USD 59/mes | Clientes ilimitados, campañas de WhatsApp, reportes |
| Multi-local | USD 99/mes | Para cadenas chicas |

- **Extra:** el costo de los mensajes de WhatsApp se traslada al comercio con un pequeño margen.
- **Sin comisión sobre las cargas**, al menos al principio. "No te cobramos por tu plata" es un argumento de venta.

## 6. Números de referencia (hipótesis a validar)

| Comercios | Ticket promedio | Facturación mensual |
|---|---|---|
| 30 | USD 45 | ~USD 1.350 — cubre costos y prueba el modelo |
| 150 | USD 45 | ~USD 6.750 — ya es un negocio |

- Costos fijos bajos: hosting, API de WhatsApp, dominio. Casi todo es margen.
- **Métrica principal:** saldo cargado por comercio por mes. Si crece, el comercio no se va.

## 7. Canales de adquisición

- **Venta directa en el mostrador.** El pitch se demuestra en 5 minutos.
- **Estudios contables como socios.** Asesoran a decenas de comercios chicos; se les da una comisión recurrente.
- **Referidos entre comercios.** Un mes gratis por cada comercio que traigan.
- **Casos reales en Instagram** con números ("esta barbería adelantó $80.000 en un mes").

## 8. Competencia

| Actor | Qué hace | Relación con Platita |
|---|---|---|
| **Tienda de Puntos** (Argentina) | Fidelización por puntos para pymes, sin app, por suscripción, con WhatsApp. Más de 1.000 marcas; próximo paso anunciado: México | Competidor más directo en modelo. Foco en puntos, no en saldo cargado |
| **Pasito** (Argentina, en Uruguay desde jun-2026) | Puntos por caminar canjeables en comercios adheridos | Captación de clientes nuevos; puede ser complementario |
| **Ahorra Fácil** (Uruguay) | Descuentos en comercios vía WhatsApp | Captación, no retención |
| **Programas bancarios** (Itaú, OCA, Santander, Scotia, BBVA) | Puntos/millas por usar la tarjeta | Fidelizan al banco, no al comercio |

**Diferenciación:** puntos y sellos ya es terreno competido. Lo que nadie ofrece es **la caja por adelantado**, un argumento más fuerte para un comercio chico que los puntos. Además, el saldo ya cargado por los clientes hace que el comercio no se cambie fácilmente.

## 9. Riesgos

| Riesgo | Mitigación |
|---|---|
| Regulatorio: que el saldo se interprete como dinero electrónico | Modelo cerrado (saldo de un solo comercio) y sin custodiar fondos |
| Que Mercado Pago agregue algo parecido | Foco en fidelización y WhatsApp, que no priorizan |
| Que Tienda de Puntos llegue a Uruguay o agregue saldo | Moverse rápido en pocos barrios y atar comercios con saldo cargado |
| Adopción: que el comercio no lo empuje | Material listo: cartel de mostrador y QR |

## 10. Validación en 4 semanas

1. Conseguir 5 comercios y llevarles el saldo con una planilla y WhatsApp a mano (MVP "concierge").
2. Medir cuántos clientes cargan saldo y cuánto vuelven.
3. Al final, cobrar. **Si al menos 3 de los 5 pagan, se construye el producto.** Si no, se aprendió barato.

Antes de empezar: preguntar a 10 comercios qué usan hoy para fidelizar. Sirve como investigación de competencia y como primera validación.

---

## 11. Backend (este repositorio)

### Stack

- Node + TypeScript, Fastify
- PostgreSQL con Prisma
- Montos en centésimos de peso (enteros)
- Saldo calculado desde un libro mayor de movimientos (`Transaction`), nunca guardado suelto

### Correr en local

**Node 22 o más nuevo** (el repo trae un `.nvmrc`: con `nvm use` se elige solo; con Node 20 los tests fallan).

```bash
nvm use
cp .env.example .env
docker compose up -d
npm install
npm run db:migrate
npm run db:seed     # datos de ejemplo para probar (opcional)
npm run dev
```

Con el servidor arriba, `http://localhost:3000/dev` abre una consola de
pruebas para probar todos los endpoints desde el navegador (solo fuera de
producción). Si el puerto 3000 está ocupado: `PORT=3001 npm run dev`.

**Datos de ejemplo.** `npm run db:seed` carga personas con teléfonos fijos,
comercios visibles con locales, horarios y promos, y clientes con saldos y
movimientos (incluye casos para probar: saldo 0, clientes que no vienen hace
más de 30 días y una persona con saldo en varios comercios). Se puede repetir
sin duplicar. Imprime qué teléfono entra a qué cuenta; en local todos entran con
el código `000000`. `npm run db:reset-seed` **borra toda la base de desarrollo**
y vuelve a cargar los datos de ejemplo. Ambos se niegan a correr en producción
o contra una base que no sea local.

**Desplegar.** La API va en Render y la base en Neon (planes gratis): la guía paso a paso, las
variables y qué pasa cuando se duermen está en [`docs/DESPLIEGUE.md`](docs/DESPLIEGUE.md) y el
Blueprint en `render.yaml`.

**Ingreso de prueba y SMS reales.** Con `OTP_PROVIDER=dev` (el valor por defecto
en `.env.example`) cualquier teléfono entra con `000000`. Para probar un SMS real
con tu número sin perder eso, ver `OTP_REAL_PHONES` en `.env.example` y la sección
"Ingreso real" de [`docs/BACKEND.md`](docs/BACKEND.md).

### Endpoints y documentación técnica

La tabla de endpoints, la arquitectura del backend y las reglas del
dominio viven en [`docs/BACKEND.md`](docs/BACKEND.md) (una sola copia, para
que no se desactualice). Un caso de uso narrado que pasa por todos los
endpoints está en [`docs/EJEMPLO.md`](docs/EJEMPLO.md). El estado actual
del proyecto, en [`docs/STATE.md`](docs/STATE.md). El flujo de ramas y
los checks automáticos de cada PR (CI y revisión con IA), en
[`docs/CI.md`](docs/CI.md).

### Próximos pasos

- Ver [TODO.md](TODO.md) para la lista completa por área
