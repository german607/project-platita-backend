import type { FastifyInstance } from "fastify";
import { idParams, merchantIdParams } from "../../lib/schemas.js";
import { createBonusRuleBody, updateBonusRuleBody } from "./schemas.js";
import { createBonusRule, listBonusRules, updateBonusRule } from "./service.js";

export async function bonusRuleRoutes(app: FastifyInstance) {
  app.post("/merchants/:merchantId/bonus-rules", async (req, reply) => {
    const { merchantId } = merchantIdParams.parse(req.params);
    const rule = await createBonusRule(merchantId, createBonusRuleBody.parse(req.body));
    return reply.code(201).send(rule);
  });

  app.get("/merchants/:merchantId/bonus-rules", async (req) =>
    listBonusRules(merchantIdParams.parse(req.params).merchantId),
  );

  app.patch("/bonus-rules/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    return updateBonusRule(id, updateBonusRuleBody.parse(req.body));
  });
}
