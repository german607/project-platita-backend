import type { FastifyInstance } from "fastify";
import { idParams, merchantIdParams } from "../../lib/schemas.js";
import { createLocationBody, updateLocationBody } from "./schemas.js";
import { createLocation, listLocations, updateLocation } from "./service.js";

export async function locationRoutes(app: FastifyInstance) {
  app.post("/merchants/:merchantId/locations", async (req, reply) => {
    const { merchantId } = merchantIdParams.parse(req.params);
    return reply.code(201).send(await createLocation(merchantId, createLocationBody.parse(req.body)));
  });

  app.get("/merchants/:merchantId/locations", async (req) =>
    listLocations(merchantIdParams.parse(req.params).merchantId),
  );

  app.patch("/locations/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    return updateLocation(id, updateLocationBody.parse(req.body));
  });
}
