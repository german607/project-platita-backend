import type { PrismaClient } from "@prisma/client";

const DAY = 24 * 60 * 60 * 1000;

// Borra lo que ya no sirve: pedidos de código y códigos viejos (24 h) y
// sesiones vencidas o cerradas hace más de una semana. Se llama cada hora
// desde server.ts; si falla no es grave, porque nada de esto se lee vencido.
export async function deleteExpiredAuthData(db: PrismaClient) {
  const now = Date.now();
  const day = new Date(now - DAY);
  const week = new Date(now - 7 * DAY);

  await db.otpRequest.deleteMany({ where: { createdAt: { lt: day } } });
  await db.otpChallenge.deleteMany({ where: { requestedAt: { lt: day } } });
  await db.session.deleteMany({
    where: { OR: [{ expiresAt: { lt: week } }, { revokedAt: { lt: week } }] },
  });
}
