import { buildApp } from "./app.js";
import { allowedMerchantPhones, config, isProduction, usingInsecureAuth } from "./config.js";
import { connectWithRetry, db } from "./lib/db.js";
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

if (isProduction && allowedMerchantPhones.length === 0) {
  app.log.warn(
    "ATENCIÓN: ALLOWED_MERCHANT_PHONES está vacía: en producción nadie puede crear comercios hasta que se configure.",
  );
}

if (usingInsecureAuth) {
  app.log.warn(
    "ATENCIÓN: ingreso con el proveedor de prueba (código 000000) en producción: cualquiera que conozca un teléfono entra. Solo para demos.",
  );
}

// La base puede estar dormida (Neon gratis): se reintenta antes de rendirse. Lo
// hace antes de abrir el puerto, así el primer pedido ya la encuentra despierta.
try {
  await connectWithRetry(db, {
    onRetry: (attempt) => app.log.warn(`La base no respondió (intento ${attempt}); reintento en unos segundos…`),
  });
} catch (err) {
  app.log.error(err, "No se pudo conectar a la base de datos");
  process.exit(1);
}

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
