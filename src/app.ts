import cors from "@fastify/cors";
import Fastify from "fastify";
import { config, isProduction } from "./config.js";
import { db } from "./lib/db.js";
import { errorHandler } from "./lib/error-handler.js";
import { modules } from "./modules/index.js";

// Arma la app sin levantar el puerto: así server.ts la escucha y los tests
// (cuando existan) la usan directo con app.inject().
export async function buildApp() {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });

  app.setErrorHandler(errorHandler);
  app.addHook("onClose", async () => {
    await db.$disconnect();
  });

  // CORS solo para los orígenes configurados; nunca "*".
  if (config.CORS_ORIGINS.length > 0) {
    await app.register(cors, {
      origin: config.CORS_ORIGINS,
      methods: ["GET", "POST", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
      exposedHeaders: ["Idempotent-Replayed"],
      maxAge: 86400,
    });
  }

  app.get("/health", async () => ({ ok: true }));
  await app.register(modules);

  // Consola de pruebas local en /dev; nunca en producción.
  if (!isProduction) {
    const { devConsoleRoutes } = await import("./dev/console.js");
    await app.register(devConsoleRoutes);
  }

  return app;
}
