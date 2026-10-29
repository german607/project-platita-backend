import { createHash } from "node:crypto";
import type { Prisma, PrismaClient } from "@prisma/client";
import { z } from "zod";
import { unprocessable } from "./errors.js";

// Idempotencia de cargas, cobros y ajustes. El cliente manda un header
// `Idempotency-Key` (opcional): la misma clave con la misma operación y el
// mismo cuerpo devuelve la respuesta guardada sin volver a registrar nada.

export const IDEMPOTENCY_TTL_MS = 48 * 60 * 60 * 1000;

export const idempotencyKeyHeader = z.string().trim().min(1).max(255).optional();

export type Idempotent<T> = { body: T; replayed: boolean };

type Options = { customerId: string; key: string | undefined; operation: string; input: unknown };

// Se llama DENTRO de la transacción y con la fila del cliente ya bloqueada
// (`lockCustomer`): dos pedidos simultáneos con la misma clave se hacen en
// fila, el segundo ve la clave que dejó el primero y devuelve su respuesta.
// La clave se guarda en la misma transacción que el movimiento, así no puede
// quedar un movimiento sin su clave ni una clave sin su movimiento.
// Los errores (ej. saldo insuficiente) no se guardan: reintentar con la misma
// clave vuelve a evaluar la operación.
export async function runIdempotent<T>(
  tx: Prisma.TransactionClient,
  { customerId, key, operation, input }: Options,
  run: () => Promise<T>,
): Promise<Idempotent<T>> {
  if (!key) return { body: await run(), replayed: false };

  const requestHash = createHash("sha256")
    .update(JSON.stringify({ operation, input }))
    .digest("hex");

  const existing = await tx.idempotencyKey.findUnique({ where: { customerId_key: { customerId, key } } });
  if (existing) {
    if (Date.now() - existing.createdAt.getTime() < IDEMPOTENCY_TTL_MS) {
      if (existing.requestHash !== requestHash) {
        throw unprocessable(
          "IDEMPOTENCY_KEY_REUSED",
          "La clave de idempotencia ya se usó con otra operación o con otro cuerpo",
        );
      }
      return { body: existing.response as T, replayed: true };
    }
    await tx.idempotencyKey.delete({ where: { id: existing.id } }); // vencida
  }

  // Se guarda lo mismo que se va a mandar por la red (fechas como texto), así
  // el reintento devuelve exactamente la misma respuesta.
  const body = JSON.parse(JSON.stringify(await run())) as T;
  await tx.idempotencyKey.create({
    data: { customerId, key, requestHash, response: body as Prisma.InputJsonValue },
  });
  return { body, replayed: false };
}

export async function deleteExpiredIdempotencyKeys(db: PrismaClient) {
  const { count } = await db.idempotencyKey.deleteMany({
    where: { createdAt: { lt: new Date(Date.now() - IDEMPOTENCY_TTL_MS) } },
  });
  return count;
}
