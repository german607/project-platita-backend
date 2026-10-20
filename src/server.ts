import { buildApp } from "./app.js";
import { config, usingInsecureAuth } from "./config.js";
import { db } from "./lib/db.js";
import { deleteExpiredIdempotencyKeys } from "./lib/idempotency.js";
import { deleteExpiredAuthData } from "./modules/auth/cleanup.js";

const app = await buildApp();

// Cierre ordenado: termina los pedidos en curso y suelta la conexión a la base.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

// Se borran cada hora las claves de idempotencia vencidas (48 h) y los datos
// de ingreso viejos (códigos y sesiones). Si la limpieza falla no es grave:
// lo vencido igual se ignora al consultarlo.
const cleanup = setInterval(() => {
  deleteExpiredIdempotencyKeys(db).catch((err) => app.log.warn(err, "no se pudieron limpiar claves de idempotencia"));
  deleteExpiredAuthData(db).catch((err) => app.log.warn(err, "no se pudieron limpiar datos de ingreso"));
}, 60 * 60 * 1000);
cleanup.unref();

if (usingInsecureAuth) {
  app.log.warn(
    "ATENCIÓN: ingreso con el proveedor de prueba (código 000000) en producción: cualquiera que conozca un teléfono entra. Solo para demos.",
  );
}

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
