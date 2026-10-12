import type { Prisma } from "@prisma/client";
import { db, getBalance } from "../../lib/db.js";
import { notFound, unprocessable } from "../../lib/errors.js";
import { pesosToCents } from "../../lib/money.js";
import { pageArgs, toPage } from "../../lib/pagination.js";
import type { AdjustmentInput, ChargeInput, ListTransactionsQuery, TopUpInput } from "./schemas.js";

// Bloquea la fila del cliente hasta que termine la transacción. Así dos
// cobros simultáneos del mismo cliente se hacen en fila y el segundo ve el
// saldo ya descontado: no se puede gastar dos veces el mismo saldo.
async function lockCustomer(tx: Prisma.TransactionClient, customerId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Customer" WHERE id = ${customerId} FOR UPDATE`;
  if (rows.length === 0) throw notFound("Cliente");
}

function insufficientBalance(balance: number, needed: number) {
  return unprocessable("INSUFFICIENT_BALANCE", "Saldo insuficiente", { balance, needed });
}

// Registra una carga (el comercio ya cobró por su cuenta) y la bonificación.
export function registerTopUp(customerId: string, input: TopUpInput) {
  const amount = pesosToCents(input.amount);

  return db.$transaction(async (tx) => {
    const customer = await tx.customer.findUnique({ where: { id: customerId } });
    if (!customer) throw notFound("Cliente");

    // Se aplica la regla activa con mayor mínimo que la carga alcance.
    const rule = await tx.bonusRule.findFirst({
      where: { merchantId: customer.merchantId, active: true, minTopUp: { lte: amount } },
      orderBy: [{ minTopUp: "desc" }, { id: "asc" }],
    });

    const topup = await tx.transaction.create({
      data: { customerId, type: "TOPUP", amount, paidWith: input.paidWith },
    });
    const bonus = rule
      ? await tx.transaction.create({ data: { customerId, type: "BONUS", amount: rule.bonusAmount } })
      : null;
    await tx.customer.update({ where: { id: customerId }, data: { lastVisitAt: new Date() } });

    return { topup, bonus, balance: await getBalance(customerId, tx) };
  });
}

// Cobra descontando saldo. Rechaza con 422 si no alcanza.
export function registerCharge(customerId: string, input: ChargeInput) {
  const amount = pesosToCents(input.amount);

  return db.$transaction(async (tx) => {
    await lockCustomer(tx, customerId);

    const balance = await getBalance(customerId, tx);
    if (balance < amount) throw insufficientBalance(balance, amount);

    const transaction = await tx.transaction.create({
      data: { customerId, type: "CHARGE", amount: -amount, note: input.note },
    });
    await tx.customer.update({ where: { id: customerId }, data: { lastVisitAt: new Date() } });

    return { transaction, balance: balance - amount };
  });
}

// Corrección manual. No se edita ni se borra ningún movimiento: un error se
// corrige con un ajuste que lo compense, y queda todo el rastro.
export function registerAdjustment(customerId: string, input: AdjustmentInput) {
  const amount = pesosToCents(input.amount);

  return db.$transaction(async (tx) => {
    await lockCustomer(tx, customerId);

    const balance = await getBalance(customerId, tx);
    if (balance + amount < 0) throw insufficientBalance(balance, -amount);

    const transaction = await tx.transaction.create({
      data: { customerId, type: "ADJUSTMENT", amount, note: input.note },
    });
    return { transaction, balance: balance + amount };
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
