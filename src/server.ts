import { buildApp } from "./app.js";
import { config } from "./config.js";
import { db } from "./lib/db.js";
import { deleteExpiredIdempotencyKeys } from "./lib/idempotency.js";

const app = await buildApp();

// Cierre ordenado: termina los pedidos en curso y suelta la conexión a la base.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

// Las claves de idempotencia vencidas (48 h) se borran cada hora. Si la
// limpieza falla no es grave: las vencidas igual se ignoran al consultarlas.
const cleanup = setInterval(() => {
  deleteExpiredIdempotencyKeys(db).catch((err) => app.log.warn(err, "no se pudieron limpiar claves de idempotencia"));
}, 60 * 60 * 1000);
cleanup.unref();

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
