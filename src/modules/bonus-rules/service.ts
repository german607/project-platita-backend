import { db } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import { pesosToCents } from "../../lib/money.js";
import { requireMerchant } from "../merchants/service.js";
import type { CreateBonusRuleInput, UpdateBonusRuleInput } from "./schemas.js";

export async function createBonusRule(merchantId: string, input: CreateBonusRuleInput) {
  await requireMerchant(merchantId);
  return db.bonusRule.create({
    data: {
      merchantId,
      minTopUp: pesosToCents(input.minTopUp),
      bonusAmount: pesosToCents(input.bonusAmount),
      active: input.active,
    },
  });
}

export async function listBonusRules(merchantId: string) {
  await requireMerchant(merchantId);
  const data = await db.bonusRule.findMany({
    where: { merchantId },
    orderBy: [{ minTopUp: "asc" }, { id: "asc" }],
  });
  return { data };
}

// No hay DELETE: una regla se desactiva con { active: false }, así el
// historial de bonificaciones ya aplicadas sigue siendo explicable.
export async function updateBonusRule(id: string, input: UpdateBonusRuleInput) {
  const existing = await db.bonusRule.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Regla de bonificación");
  return db.bonusRule.update({
    where: { id },
    data: {
      minTopUp: input.minTopUp === undefined ? undefined : pesosToCents(input.minTopUp),
      bonusAmount: input.bonusAmount === undefined ? undefined : pesosToCents(input.bonusAmount),
      active: input.active,
    },
  });
}
