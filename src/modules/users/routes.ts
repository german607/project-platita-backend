import type { FastifyInstance } from "fastify";
import { idParams } from "../../lib/schemas.js";
import { identifyUserBody, updateUserBody } from "./schemas.js";
import { getUser, getUserBalances, identifyUser, updateUser } from "./service.js";

// ADVERTENCIA: estas rutas NO verifican nada. Quien conozca un teléfono puede
// identificarse como ese usuario y ver sus saldos. Sirven para armar y probar
// el lado del cliente antes de tener ingreso por código y sesión, y solo se
// registran cuando `insecureUserRoutes` es verdadero (por defecto, fuera de
// producción; ver config.ts). Con la sesión real se reemplazan por `/me`.
export async function userRoutes(app: FastifyInstance) {
  // Identificarse con el teléfono: busca o crea el usuario.
  app.post("/users", async (req) => identifyUser(identifyUserBody.parse(req.body)));

  app.get("/users/:id", async (req) => getUser(idParams.parse(req.params).id));

  app.patch("/users/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    return updateUser(id, updateUserBody.parse(req.body));
  });

  // Saldos del usuario en cada comercio (la forma que tendrá GET /me/balances).
  app.get("/users/:id/balances", async (req) => getUserBalances(idParams.parse(req.params).id));
}
