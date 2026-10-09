import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db, getBalance } from "../lib/db.js";

const pesosToCents = (pesos: number) => Math.round(pesos * 100);

export async function customerRoutes(app: FastifyInstance) {
  // Buscar o crear cliente por teléfono
  app.post("/merchants/:merchantId/customers", async (req) => {
    const { merchantId } = z.object({ merchantId: z.string() }).parse(req.params);
    const body = z.object({ phone: z.string().min(8), name: z.string().optional() }).parse(req.body);

    const customer = await db.customer.upsert({
      where: { merchantId_phone: { merchantId, phone: body.phone } },
      update: { name: body.name },
      create: { merchantId, phone: body.phone, name: body.name },
    });
    return { ...customer, balance: await getBalance(customer.id) };
  });

  // Consultar saldo
  app.get("/customers/:id/balance", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    return { customerId: id, balance: await getBalance(id) };
  });

  // Registrar una carga (el comercio ya cobró por su cuenta) + bonificación
  app.post("/customers/:id/topups", async (req) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ amount: z.number().positive(), paidWith: z.string().optional() }).parse(req.body);
    const amount = pesosToCents(body.amount);

    const customer = await db.customer.findUniqueOrThrow({ where: { id } });
    const rule = await db.bonusRule.findFirst({
      where: { merchantId: customer.merchantId, active: true, minTopUp: { lte: amount } },
      orderBy: { minTopUp: "desc" },
    });

    await db.$transaction([
      db.transaction.create({ data: { customerId: id, type: "TOPUP", amount, paidWith: body.paidWith } }),
      ...(rule
        ? [db.transaction.create({ data: { customerId: id, type: "BONUS", amount: rule.bonusAmount } })]
        : []),
    ]);

    return { balance: await getBalance(id), bonus: rule?.bonusAmount ?? 0 };
  });

  // Cobrar descontando saldo
  app.post("/customers/:id/charges", async (req, reply) => {
    const { id } = z.object({ id: z.string() }).parse(req.params);
    const body = z.object({ amount: z.number().positive(), note: z.string().optional() }).parse(req.body);
    const amount = pesosToCents(body.amount);

    const balance = await getBalance(id);
    if (balance < amount) {
      return reply.code(422).send({ error: "Saldo insuficiente", balance });
    }

    await db.$transaction([
      db.transaction.create({ data: { customerId: id, type: "CHARGE", amount: -amount, note: body.note } }),
      db.customer.update({ where: { id }, data: { lastVisitAt: new Date() } }),
    ]);
    return { balance: balance - amount };
  });

  // Clientes inactivos (para campañas de reactivación)
  app.get("/merchants/:merchantId/inactive", async (req) => {
    const { merchantId } = z.object({ merchantId: z.string() }).parse(req.params);
    const { days } = z.object({ days: z.coerce.number().default(60) }).parse(req.query);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    return db.customer.findMany({
      where: { merchantId, OR: [{ lastVisitAt: { lt: since } }, { lastVisitAt: null }] },
      orderBy: { lastVisitAt: "asc" },
    });
  });
}
