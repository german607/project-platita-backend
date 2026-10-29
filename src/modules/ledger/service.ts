import type { Prisma } from "@prisma/client";
import { db, getBalance } from "../../lib/db.js";
import { notFound, unprocessable } from "../../lib/errors.js";
import { runIdempotent } from "../../lib/idempotency.js";
import { pesosToCents } from "../../lib/money.js";
import { pageArgs, toPage } from "../../lib/pagination.js";
import { findApplicableRule } from "../bonus-rules/service.js";
import { requireMerchant } from "../merchants/service.js";
import type {
  AdjustmentInput,
  ChargeInput,
  ListMerchantTransactionsQuery,
  ListTransactionsQuery,
  TopUpInput,
} from "./schemas.js";

// Bloquea la fila del cliente hasta que termine la transacción. Así dos
// operaciones simultáneas del mismo cliente se hacen en fila: el segundo
// cobro ve el saldo ya descontado (no se gasta dos veces el mismo saldo) y
// dos pedidos con la misma clave de idempotencia no se pisan. Devuelve el
// cliente.
async function lockCustomer(tx: Prisma.TransactionClient, customerId: string) {
  const rows = await tx.$queryRaw<{ id: string; merchantId: string }[]>`
    SELECT id, "merchantId" FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;
  if (rows.length === 0) throw notFound("Cliente");
  return rows[0];
}

function insufficientBalance(balance: number, needed: number) {
  return unprocessable("INSUFFICIENT_BALANCE", "Saldo insuficiente", { balance, needed });
}

// Registra una carga (el comercio ya cobró por su cuenta) y la bonificación.
// `idempotencyKey` es opcional: con ella, reintentar no duplica la carga.
export function registerTopUp(customerId: string, input: TopUpInput, idempotencyKey?: string) {
  const amount = pesosToCents(input.amount);

  return db.$transaction(async (tx) => {
    const customer = await lockCustomer(tx, customerId);

    return runIdempotent(tx, { customerId, key: idempotencyKey, operation: "topup", input }, async () => {
      // Se aplica la regla activa con mayor mínimo que la carga alcance.
      const rule = await findApplicableRule(tx, customer.merchantId, amount);

      const topup = await tx.transaction.create({
        data: { customerId, type: "TOPUP", amount, paidWith: input.paidWith },
      });
      const bonus = rule
        ? await tx.transaction.create({
            data: { customerId, type: "BONUS", amount: rule.bonusAmount, bonusRuleId: rule.id },
          })
        : null;
      await tx.customer.update({ where: { id: customerId }, data: { lastVisitAt: new Date() } });

      return { topup, bonus, balance: await getBalance(customerId, tx) };
    });
  });
}

// Cobra descontando saldo. Rechaza con 422 si no alcanza.
export function registerCharge(customerId: string, input: ChargeInput, idempotencyKey?: string) {
  const amount = pesosToCents(input.amount);

  return db.$transaction(async (tx) => {
    await lockCustomer(tx, customerId);

    return runIdempotent(tx, { customerId, key: idempotencyKey, operation: "charge", input }, async () => {
      const balance = await getBalance(customerId, tx);
      if (balance < amount) throw insufficientBalance(balance, amount);

      const transaction = await tx.transaction.create({
        data: { customerId, type: "CHARGE", amount: -amount, note: input.note },
      });
      await tx.customer.update({ where: { id: customerId }, data: { lastVisitAt: new Date() } });

      return { transaction, balance: balance - amount };
    });
  });
}

// Corrección manual. No se edita ni se borra ningún movimiento: un error se
// corrige con un ajuste que lo compense, y queda todo el rastro.
export function registerAdjustment(customerId: string, input: AdjustmentInput, idempotencyKey?: string) {
  const amount = pesosToCents(input.amount);

  return db.$transaction(async (tx) => {
    await lockCustomer(tx, customerId);

    return runIdempotent(tx, { customerId, key: idempotencyKey, operation: "adjustment", input }, async () => {
      const balance = await getBalance(customerId, tx);
      if (balance + amount < 0) throw insufficientBalance(balance, -amount);

      const transaction = await tx.transaction.create({
        data: { customerId, type: "ADJUSTMENT", amount, note: input.note },
      });
      return { transaction, balance: balance + amount };
    });
  });
}

// Libro mayor del cliente, del más nuevo al más viejo.
export async function listTransactions(customerId: string, query: ListTransactionsQuery) {
  const customer = await db.customer.findUnique({ where: { id: customerId }, select: { id: true } });
  if (!customer) throw notFound("Cliente");

  const rows = await db.transaction.findMany({
    where: { customerId, type: query.type },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(query),
  });
  return toPage(rows, query.limit);
}

// Libro mayor de TODO el comercio, del más nuevo al más viejo, con el
// cliente de cada movimiento (con `userName`). `from` es inclusivo y `to` exclusivo.
export async function listMerchantTransactions(merchantId: string, query: ListMerchantTransactionsQuery) {
  await requireMerchant(merchantId);

  const rows = await db.transaction.findMany({
    where: {
      customer: { merchantId },
      type: query.type,
      createdAt: { gte: query.from, lt: query.to },
    },
    include: { customer: { select: { id: true, name: true, phone: true, user: { select: { name: true } } } } },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(query),
  });
  // `customer.userName` es el nombre de la persona (User.name, puede ser null);
  // `customer.name` es como la anota este comercio.
  const page = toPage(rows, query.limit);
  return {
    ...page,
    data: page.data.map(({ customer: { user, ...customer }, ...transaction }) => ({
      ...transaction,
      customer: { ...customer, userName: user.name },
    })),
  };
}
