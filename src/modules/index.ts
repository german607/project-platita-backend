import type { FastifyInstance } from "fastify";
import { bonusRuleRoutes } from "./bonus-rules/routes.js";
import { customerRoutes } from "./customers/routes.js";
import { ledgerRoutes } from "./ledger/routes.js";
import { merchantRoutes } from "./merchants/routes.js";

// Único lugar donde se registran los módulos. Para sumar uno nuevo:
// crear src/modules/<nombre>/{schemas,service,routes}.ts y agregarlo acá.
export async function modules(app: FastifyInstance) {
  await app.register(merchantRoutes);
  await app.register(bonusRuleRoutes);
  await app.register(customerRoutes);
  await app.register(ledgerRoutes);
}
