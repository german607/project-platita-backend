import type { FastifyInstance } from "fastify";
import { idParams, merchantIdParams } from "../../lib/schemas.js";
import { bonusPreviewQuery, createBonusRuleBody, updateBonusRuleBody } from "./schemas.js";
import { createBonusRule, listBonusRules, previewBonus, updateBonusRule } from "./service.js";

export async function bonusRuleRoutes(app: FastifyInstance) {
  app.post("/merchants/:merchantId/bonus-rules", async (req, reply) => {
    const { merchantId } = merchantIdParams.parse(req.params);
    const rule = await createBonusRule(merchantId, createBonusRuleBody.parse(req.body));
    return reply.code(201).send(rule);
  });

  app.get("/merchants/:merchantId/bonus-rules", async (req) =>
    listBonusRules(merchantIdParams.parse(req.params).merchantId),
  );

  // Vista previa del bono de una carga (no registra nada)
  app.get("/merchants/:merchantId/bonus-preview", async (req) => {
    const { merchantId } = merchantIdParams.parse(req.params);
    return previewBonus(merchantId, bonusPreviewQuery.parse(req.query));
  });

  app.patch("/bonus-rules/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    return updateBonusRule(id, updateBonusRuleBody.parse(req.body));
  });
}
