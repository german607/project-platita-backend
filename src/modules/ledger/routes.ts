import type { FastifyInstance } from "fastify";
import { idParams } from "../../lib/schemas.js";
import { adjustmentBody, chargeBody, listTransactionsQuery, topUpBody } from "./schemas.js";
import { listTransactions, registerAdjustment, registerCharge, registerTopUp } from "./service.js";

export async function ledgerRoutes(app: FastifyInstance) {
  app.post("/customers/:id/topups", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    return reply.code(201).send(await registerTopUp(id, topUpBody.parse(req.body)));
  });

  app.post("/customers/:id/charges", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    return reply.code(201).send(await registerCharge(id, chargeBody.parse(req.body)));
  });

  app.post("/customers/:id/adjustments", async (req, reply) => {
    const { id } = idParams.parse(req.params);
    return reply.code(201).send(await registerAdjustment(id, adjustmentBody.parse(req.body)));
  });

  app.get("/customers/:id/transactions", async (req) => {
    const { id } = idParams.parse(req.params);
    return listTransactions(id, listTransactionsQuery.parse(req.query));
  });
}
