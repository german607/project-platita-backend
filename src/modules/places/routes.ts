import type { FastifyInstance } from "fastify";
import { merchantIdParams } from "../../lib/schemas.js";
import { listPlacesQuery } from "./schemas.js";
import { getPlace, listPlaces } from "./service.js";

// Rutas públicas (sin sesión): solo exponen el perfil público de comercios
// visibles, sin datos de ningún cliente.
export async function placeRoutes(app: FastifyInstance) {
  app.get("/places", async (req) => listPlaces(listPlacesQuery.parse(req.query)));

  app.get("/places/:merchantId", async (req) => getPlace(merchantIdParams.parse(req.params).merchantId));
}
