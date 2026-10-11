import type { FastifyInstance } from "fastify";
import { idParams, merchantIdParams } from "../../lib/schemas.js";
import { inactiveQuery, listCustomersQuery, updateCustomerBody, upsertCustomerBody } from "./schemas.js";
import {
  getCustomer,
  getCustomerBalance,
  listCustomers,
  listInactiveCustomers,
  updateCustomer,
  upsertCustomer,
} from "./service.js";

export async function customerRoutes(app: FastifyInstance) {
  // Buscar o crear cliente por teléfono
  app.post("/merchants/:merchantId/customers", async (req) => {
    const { merchantId } = merchantIdParams.parse(req.params);
    return upsertCustomer(merchantId, upsertCustomerBody.parse(req.body));
  });

  app.get("/merchants/:merchantId/customers", async (req) => {
    const { merchantId } = merchantIdParams.parse(req.params);
    return listCustomers(merchantId, listCustomersQuery.parse(req.query));
  });

  // Clientes inactivos (para campañas de reactivación)
  app.get("/merchants/:merchantId/inactive", async (req) => {
    const { merchantId } = merchantIdParams.parse(req.params);
    return listInactiveCustomers(merchantId, inactiveQuery.parse(req.query));
  });

  app.get("/customers/:id", async (req) => getCustomer(idParams.parse(req.params).id));

  app.patch("/customers/:id", async (req) => {
    const { id } = idParams.parse(req.params);
    return updateCustomer(id, updateCustomerBody.parse(req.body));
  });

  app.get("/customers/:id/balance", async (req) => getCustomerBalance(idParams.parse(req.params).id));
}
