import type { Prisma } from "@prisma/client";
import { db, getBalance, getBalances } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import { pageArgs, toPage } from "../../lib/pagination.js";
import { requireMerchant } from "../merchants/service.js";
import type { InactiveQuery, ListCustomersQuery, UpdateCustomerInput, UpsertCustomerInput } from "./schemas.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Busca o crea un cliente por (comercio, teléfono normalizado).
export async function upsertCustomer(merchantId: string, input: UpsertCustomerInput) {
  await requireMerchant(merchantId);
  const customer = await db.customer.upsert({
    where: { merchantId_phone: { merchantId, phone: input.phone } },
    update: input.name === undefined ? {} : { name: input.name },
    create: { merchantId, phone: input.phone, name: input.name },
  });
  return { ...customer, balance: await getBalance(customer.id) };
}

export async function getCustomer(id: string) {
  const customer = await db.customer.findUnique({ where: { id } });
  if (!customer) throw notFound("Cliente");
  return { ...customer, balance: await getBalance(id) };
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
  const customer = await db.customer.update({ where: { id }, data: input });
  return { ...customer, balance: await getBalance(id) };
}

export async function listCustomers(merchantId: string, query: ListCustomersQuery) {
  await requireMerchant(merchantId);

  const where: Prisma.CustomerWhereInput = { merchantId };
  if (query.search) {
    const digits = query.search.replace(/\D/g, "");
    where.OR = [
      { name: { contains: query.search, mode: "insensitive" } },
      ...(digits ? [{ phone: { contains: digits } }] : []),
    ];
  }

  const rows = await db.customer.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);
  const balances = await getBalances(page.data.map((c) => c.id));
  return { ...page, data: page.data.map((c) => ({ ...c, balance: balances.get(c.id) ?? 0 })) };
}

// Inactivo = sin visita (carga o cobro) en `days` días. Si nunca vino, se
// cuenta desde que se creó el cliente, así un cliente nuevo no aparece acá.
export async function listInactiveCustomers(merchantId: string, query: InactiveQuery) {
  await requireMerchant(merchantId);
  const since = new Date(Date.now() - query.days * DAY_MS);

  const rows = await db.customer.findMany({
    where: {
      merchantId,
      OR: [{ lastVisitAt: { lt: since } }, { lastVisitAt: null, createdAt: { lt: since } }],
    },
    orderBy: { id: "asc" },
    ...pageArgs(query),
  });
  return toPage(rows, query.limit);
}
