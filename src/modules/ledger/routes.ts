import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { idempotencyKeyHeader, type Idempotent } from "../../lib/idempotency.js";
import { idParams, merchantIdParams } from "../../lib/schemas.js";
import {
  adjustmentBody,
  chargeBody,
  listMerchantTransactionsQuery,
  listTransactionsQuery,
  topUpBody,
} from "./schemas.js";
import {
  listMerchantTransactions,
  listTransactions,
  registerAdjustment,
  registerCharge,
  registerTopUp,
} from "./service.js";

const idempotencyKeyOf = (req: FastifyRequest) => idempotencyKeyHeader.parse(req.headers["idempotency-key"]);

// 201 siempre; si fue un reintento con la misma clave se avisa en el header.
function sendCreated<T>(reply: FastifyReply, result: Idempotent<T>) {
  if (result.replayed) reply.header("Idempotent-Replayed", "true");
  return reply.code(201).send(result.body);
}

export async function ledgerRoutes(app: FastifyInstance) {
  app.post("/customers/:id/topups", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    return sendCreated(reply, await registerTopUp(id, topUpBody.parse(req.body), idempotencyKeyOf(req)));
  });

  app.post("/customers/:id/charges", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    return sendCreated(reply, await registerCharge(id, chargeBody.parse(req.body), idempotencyKeyOf(req)));
  });

  app.post("/customers/:id/adjustments", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    return sendCreated(reply, await registerAdjustment(id, adjustmentBody.parse(req.body), idempotencyKeyOf(req)));
  });

  app.get("/customers/:id/transactions", async (req) => {
    const { id } = idParams.parse(req.params);
    return listTransactions(id, listTransactionsQuery.parse(req.query));
  });

  // Movimientos de todo el comercio (panel "Hoy en el mostrador")
  app.get("/merchants/:merchantId/transactions", async (req) => {
    const { merchantId } = merchantIdParams.parse(req.params);
    return listMerchantTransactions(merchantId, listMerchantTransactionsQuery.parse(req.query));
  });
}
