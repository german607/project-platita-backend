import { Prisma, PrismaClient } from "@prisma/client";

export const db = new PrismaClient();

// Sirve tanto el cliente normal como el de dentro de una transacción.
export type DbClient = PrismaClient | Prisma.TransactionClient;

// El saldo siempre se calcula sumando movimientos, nunca se guarda suelto.
export async function getBalance(customerId: string, client: DbClient = db): Promise<number> {
  const result = await client.transaction.aggregate({
    where: { customerId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}

// Saldos de varios clientes en una sola consulta (para listados).
export async function getBalances(customerIds: string[], client: DbClient = db): Promise<Map<string, number>> {
  if (customerIds.length === 0) return new Map();
  const rows = await client.transaction.groupBy({
    by: ["customerId"],
    where: { customerId: { in: customerIds } },
    _sum: { amount: true },
  });
  return new Map(rows.map((r) => [r.customerId, r._sum.amount ?? 0]));
}
