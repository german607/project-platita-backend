import type { FastifyInstance } from "fastify";
import { idParams, pageQuery } from "../../lib/schemas.js";
import { createMerchantBody, updateMerchantBody } from "./schemas.js";
import { createMerchant, getMerchant, listMerchants, updateMerchant } from "./service.js";

export async function merchantRoutes(app: FastifyInstance) {
  app.post("/merchants", async (req, reply) => {
    const body = createMerchantBody.parse(req.body);
    return reply.code(201).send(await createMerchant(body));
  });

  app.get("/merchants", async (req) => listMerchants(pageQuery.parse(req.query)));

  app.get("/merchants/:id", async (req) => getMerchant(idParams.parse(req.params).id));

  app.patch("/merchants/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    return updateMerchant(id, updateMerchantBody.parse(req.body));
  });
}
