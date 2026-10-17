import type { Prisma } from "@prisma/client";
import { db, getBalance, getBalances } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import { normalizeUyPhone, phoneSearchFragment } from "../../lib/phone.js";
import { pageArgs, toPage } from "../../lib/pagination.js";
import { requireMerchant } from "../merchants/service.js";
import type { InactiveQuery, ListCustomersQuery, UpdateCustomerInput, UpsertCustomerInput } from "./schemas.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// La ficha también trae `userName`: el nombre de la PERSONA (`User.name`, puede
// ser null), distinto de `name`, que es como la anota este comercio. Se pide
// en la misma consulta para que el front no tenga que ir a /users por cada
// cliente. Se devuelve plano (`userName`), nunca el objeto `user` completo.
const withUserName = { user: { select: { name: true } } } as const;

function flattenUser<T extends { user: { name: string | null } }>({ user, ...rest }: T) {
  return { ...rest, userName: user.name };
}

// Busca o crea un cliente por (comercio, teléfono normalizado).
export async function upsertCustomer(merchantId: string, input: UpsertCustomerInput) {
  await requireMerchant(merchantId);
  // La ficha del comercio cuelga del usuario global de ese teléfono: se
  // busca o se crea. El nombre que anota el comercio solo siembra el nombre
  // del usuario cuando es nuevo; después no lo pisa (es de la persona).
  const user = await db.user.upsert({
    where: { phone: input.phone },
    update: {},
    create: { phone: input.phone, name: input.name },
  });
  const customer = await db.customer.upsert({
    where: { merchantId_phone: { merchantId, phone: input.phone } },
    update: input.name === undefined ? {} : { name: input.name },
    create: { merchantId, userId: user.id, phone: input.phone, name: input.name },
    include: withUserName,
  });
  return { ...flattenUser(customer), balance: await getBalance(customer.id) };
}

export async function getCustomer(id: string) {
  const customer = await db.customer.findUnique({ where: { id }, include: withUserName });
  if (!customer) throw notFound("Cliente");
  return { ...flattenUser(customer), balance: await getBalance(id) };
}

// Falla con 404 si el cliente no existe (a diferencia de un saldo 0).
export async function getCustomerBalance(id: string) {
  const customer = await db.customer.findUnique({ where: { id }, select: { id: true } });
  if (!customer) throw notFound("Cliente");
  return { customerId: id, balance: await getBalance(id) };
}

export async function updateCustomer(id: string, input: UpdateCustomerInput) {
  const existing = await db.customer.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Cliente");
  const customer = await db.customer.update({ where: { id }, data: input, include: withUserName });
  return { ...flattenUser(customer), balance: await getBalance(id) };
}

export async function listCustomers(merchantId: string, query: ListCustomersQuery) {
  await requireMerchant(merchantId);

  const where: Prisma.CustomerWhereInput = { merchantId };
  if (query.phone) where.phone = query.phone;
  if (query.search) {
    // El teléfono se busca como se guarda: exacto si el texto es un teléfono
    // uruguayo completo, y "contiene" sobre los dígitos para búsquedas parciales.
    const exact = normalizeUyPhone(query.search);
    const fragment = phoneSearchFragment(query.search);
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      ...(exact ? [{ phone: exact }] : []),
      ...(fragment ? [{ phone: { contains: fragment } }] : []),
    ];
  }

  const rows = await db.customer.findMany({
    where,
    include: withUserName,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  const balances = await getBalances(page.data.map((c) => c.id));
  return { ...page, data: page.data.map((c) => ({ ...flattenUser(c), balance: balances.get(c.id) ?? 0 })) };
}

// Inactivo = sin visita (carga o cobro) en `days` días. Si nunca vino, se
// cuenta desde que se creó el cliente, así un cliente nuevo no aparece acá.
export async function listInactiveCustomers(merchantId: string, query: InactiveQuery) {
  await requireMerchant(merchantId);
  const since = new Date(Date.now() - query.days * DAY_MS);
  const where: Prisma.CustomerWhereInput = {
    merchantId,
    OR: [{ lastVisitAt: { lt: since } }, { lastVisitAt: null, createdAt: { lt: since } }],
  };

  const [rows, total] = await Promise.all([
    db.customer.findMany({ where, include: withUserName, orderBy: { id: "asc" }, ...pageArgs(query) }),
    db.customer.count({ where }),
  ]);
  const page = toPage(rows, query.limit);
  const balances = await getBalances(page.data.map((c) => c.id));
  // `total` cuenta todos los inactivos, no solo los de esta página.
  return { ...page, total, data: page.data.map((c) => ({ ...flattenUser(c), balance: balances.get(c.id) ?? 0 })) };
}
