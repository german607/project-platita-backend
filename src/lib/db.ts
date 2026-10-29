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

// Conecta a la base con reintentos. Con una base que se duerme (Neon gratis se
// suspende a los 5 minutos sin uso), la primera conexión puede tardar o fallar
// mientras despierta: al arrancar el servidor se reintenta unos segundos en vez de
// morir. Espera 2 s, 4 s, 6 s… entre intentos (con 6 intentos, unos 30 s en total).
export async function connectWithRetry(
  client: { $connect(): Promise<void> },
  opts: { attempts?: number; delayMs?: number; onRetry?: (attempt: number, error: unknown) => void } = {},
) {
  const attempts = opts.attempts ?? 6;
  const delayMs = opts.delayMs ?? 2000;
  for (let attempt = 1; ; attempt++) {
    try {
      await client.$connect();
      return;
    } catch (error) {
      if (attempt >= attempts) throw error;
      opts.onRetry?.(attempt, error);
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}
