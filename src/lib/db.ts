import { PrismaClient } from "@prisma/client";

export const db = new PrismaClient();

export async function getBalance(customerId: string): Promise<number> {
  const result = await db.transaction.aggregate({
    where: { customerId },
    _sum: { amount: true },
  });
  return result._sum.amount ?? 0;
}
