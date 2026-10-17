import { db, getBalances } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import type { IdentifyUserInput, UpdateUserInput } from "./schemas.js";

// Usuario global: la persona, identificada por su teléfono normalizado. Cada
// comercio tiene una ficha `Customer` por usuario, con el saldo de ESE
// comercio. Esta capa la usa hoy `/users/*` (sin verificación) y mañana la
// sesión real (`/me/*`): las funciones reciben el id del usuario, no saben
// cómo se identificó.

// Busca por teléfono o crea. El nombre solo se completa si el usuario todavía
// no tiene uno (no se pisa el que ya eligió).
export async function identifyUser(input: IdentifyUserInput) {
  const user = await db.user.upsert({
    where: { phone: input.phone },
    update: {},
    create: { phone: input.phone, name: input.name },
  });
  if (input.name && !user.name) {
    return db.user.update({ where: { id: user.id }, data: { name: input.name } });
  }
  return user;
}

export async function getUser(id: string) {
  const user = await db.user.findUnique({ where: { id } });
  if (!user) throw notFound("Usuario");
  return user;
}

export async function updateUser(id: string, input: UpdateUserInput) {
  await getUser(id);
  return db.user.update({ where: { id }, data: input });
}

// Saldos del usuario en todos los comercios donde tiene ficha, incluso con
// saldo 0. Del comercio solo sale el perfil público mínimo (nunca teléfono ni
// plan). Orden: última visita primero (los que nunca visitó, al final) y por
// nombre del comercio de desempate.
export async function getUserBalances(userId: string) {
  await getUser(userId);

  const customers = await db.customer.findMany({
    where: { userId },
    select: {
      id: true,
      lastVisitAt: true,
      merchant: { select: { id: true, name: true, category: true, photoUrl: true } },
    },
  });
  const balances = await getBalances(customers.map((c) => c.id));

  const data = customers
    .map((c) => ({ merchant: c.merchant, balance: balances.get(c.id) ?? 0, lastVisitAt: c.lastVisitAt }))
    .sort((a, b) => {
      const at = a.lastVisitAt?.getTime();
      const bt = b.lastVisitAt?.getTime();
      if (at !== undefined && bt !== undefined && at !== bt) return bt - at;
      if (at !== undefined && bt === undefined) return -1;
      if (at === undefined && bt !== undefined) return 1;
      return a.merchant.name.localeCompare(b.merchant.name);
    });

  return { data };
}
