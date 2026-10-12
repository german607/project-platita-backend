import { buildApp } from "./app.js";
import { config } from "./config.js";

const app = await buildApp();

// Cierre ordenado: termina los pedidos en curso y suelta la conexión a la base.
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.on(signal, async () => {
    await app.close();
    process.exit(0);
  });
}

try {
  await app.listen({ port: config.PORT, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
