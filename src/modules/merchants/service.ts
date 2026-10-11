import { db } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import { pageArgs, toPage } from "../../lib/pagination.js";
import type { PageQuery } from "../../lib/schemas.js";
import type { CreateMerchantInput, UpdateMerchantInput } from "./schemas.js";

export function createMerchant(input: CreateMerchantInput) {
  return db.merchant.create({ data: input });
}

export async function listMerchants(page: PageQuery) {
  const rows = await db.merchant.findMany({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  return toPage(rows, page.limit);
}

export async function getMerchant(id: string) {
  const merchant = await db.merchant.findUnique({ where: { id } });
  if (!merchant) throw notFound("Comercio");
  return merchant;
}

// Para otros módulos: falla con 404 si el comercio no existe.
export async function requireMerchant(id: string) {
  const merchant = await db.merchant.findUnique({ where: { id }, select: { id: true } });
  if (!merchant) throw notFound("Comercio");
}

export async function updateMerchant(id: string, input: UpdateMerchantInput) {
  await requireMerchant(id);
  return db.merchant.update({ where: { id }, data: input });
}
