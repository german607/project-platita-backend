import type { FastifyInstance } from "fastify";
import { insecureUserRoutes } from "../config.js";
import { authRoutes } from "./auth/routes.js";
import { bonusRuleRoutes } from "./bonus-rules/routes.js";
import { customerRoutes } from "./customers/routes.js";
import { ledgerRoutes } from "./ledger/routes.js";
import { locationRoutes } from "./locations/routes.js";
import { merchantRoutes } from "./merchants/routes.js";
import { placeRoutes } from "./places/routes.js";
import { userRoutes } from "./users/routes.js";

// Único lugar donde se registran los módulos. Para sumar uno nuevo:
// crear src/modules/<nombre>/{schemas,service,routes}.ts y agregarlo acá.
export async function modules(app: FastifyInstance) {
  await app.register(merchantRoutes);
  await app.register(bonusRuleRoutes);
  await app.register(customerRoutes);
  await app.register(ledgerRoutes);
  await app.register(locationRoutes);
  await app.register(placeRoutes);
  await app.register(authRoutes);

  // Usuarios sin verificación: solo mientras no exista la sesión real.
  if (insecureUserRoutes) await app.register(userRoutes);
}
