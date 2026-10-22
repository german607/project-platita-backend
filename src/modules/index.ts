import type { FastifyInstance } from "fastify";
import { insecureUserRoutes } from "../config.js";
import { authorizeMerchantAccess } from "./auth/access.js";
import { requireSession } from "./auth/guard.js";
import { authRoutes } from "./auth/routes.js";
import { bonusRuleRoutes } from "./bonus-rules/routes.js";
import { customerRoutes } from "./customers/routes.js";
import { ledgerRoutes } from "./ledger/routes.js";
import { locationRoutes } from "./locations/routes.js";
import { merchantRoutes } from "./merchants/routes.js";
import { placeRoutes } from "./places/routes.js";
import { userRoutes } from "./users/routes.js";

// Único lugar donde se registran los módulos. Para sumar uno nuevo:
// crear src/modules/<nombre>/{schemas,service,routes}.ts y agregarlo acá, en
// la zona pública o en la del comercio según corresponda.
export async function modules(app: FastifyInstance) {
  // Quién hace el pedido (lo completa `requireSession`); se declara una sola
  // vez, acá, para que lo vean todos los módulos.
  app.decorateRequest("auth", null);

  // --- Zona pública: sin sesión, o con su propia forma de ingreso ---
  await app.register(placeRoutes); // el perfil público de los comercios
  await app.register(authRoutes); // el ingreso por código y /me

  // Usuarios sin verificación: solo mientras no exista la sesión real.
  if (insecureUserRoutes) await app.register(userRoutes);

  // --- Zona del comercio: exige sesión y que la persona sea la dueña ---
  // Cubre /merchants, /customers, /bonus-rules y /locations (ver
  // auth/access.ts). Un módulo nuevo del comercio se registra acá adentro.
  await app.register(async (merchantArea) => {
    merchantArea.addHook("onRequest", requireSession);
    merchantArea.addHook("preHandler", authorizeMerchantAccess);

    await merchantArea.register(merchantRoutes);
    await merchantArea.register(bonusRuleRoutes);
    await merchantArea.register(customerRoutes);
    await merchantArea.register(ledgerRoutes);
    await merchantArea.register(locationRoutes);
  });
}
