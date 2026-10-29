import type { FastifyInstance } from "fastify";
import { idParams, pageQuery } from "../../lib/schemas.js";
import { authOf } from "../auth/guard.js";
import { createMerchantBody, updateMerchantBody } from "./schemas.js";
import { createMerchant, getMerchant, listMerchants, updateMerchant } from "./service.js";

export async function merchantRoutes(app: FastifyInstance) {
  // Crear un comercio con sesión: la persona queda como dueña.
  app.post("/merchants", async (req, reply) => {
    const body = createMerchantBody.parse(req.body);
    return reply.code(201).send(await createMerchant(body, authOf(req).userId));
  });

  // Los comercios de la persona de la sesión (no hay lista de todos).
  app.get("/merchants", async (req) => listMerchants(authOf(req).userId, pageQuery.parse(req.query)));

  app.get("/merchants/:id", async (req) => getMerchant(idParams.parse(req.params).id));

  app.patch("/merchants/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    return updateMerchant(id, updateMerchantBody.parse(req.body));
  });
}
