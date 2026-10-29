import type { BonusRule } from "@prisma/client";
import { db, type DbClient } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import { pesosToCents } from "../../lib/money.js";
import { requireMerchant } from "../merchants/service.js";
import type { BonusPreviewQuery, CreateBonusRuleInput, UpdateBonusRuleInput } from "./schemas.js";

// Regla de bonificación que corresponde a una carga: la activa del comercio
// con mayor mínimo que el monto alcance; si empatan, la de menor id. Es la
// ÚNICA implementación: la usan la carga real y la vista previa, así no
// pueden divergir.
export function findApplicableRule(client: DbClient, merchantId: string, amountCents: number) {
  return client.bonusRule.findFirst({
    where: { merchantId, active: true, minTopUp: { lte: amountCents } },
    orderBy: [{ minTopUp: "desc" }, { id: "asc" }],
  });
}

// Cuántos bonos salieron de cada regla (`timesUsed`). Los bonos anteriores a
// la columna bonusRuleId no se pueden atribuir y no cuentan.
async function timesUsedByRule(ruleIds: string[]) {
  if (ruleIds.length === 0) return new Map<string, number>();
  const rows = await db.transaction.groupBy({
    by: ["bonusRuleId"],
    where: { type: "BONUS", bonusRuleId: { in: ruleIds } },
    _count: { _all: true },
  });
  return new Map(rows.map((r) => [r.bonusRuleId as string, r._count._all]));
}

const withTimesUsed = (rule: BonusRule, counts: Map<string, number>) => ({
  ...rule,
  timesUsed: counts.get(rule.id) ?? 0,
});

export async function createBonusRule(merchantId: string, input: CreateBonusRuleInput) {
  await requireMerchant(merchantId);
  const rule = await db.bonusRule.create({
    data: {
      merchantId,
      minTopUp: pesosToCents(input.minTopUp),
      bonusAmount: pesosToCents(input.bonusAmount),
      active: input.active,
      name: input.name,
      description: input.description,
    },
  });
  return withTimesUsed(rule, new Map());
}

export async function listBonusRules(merchantId: string) {
  await requireMerchant(merchantId);
  const rules = await db.bonusRule.findMany({
    where: { merchantId },
    orderBy: [{ minTopUp: "asc" }, { id: "asc" }],
  });
  const counts = await timesUsedByRule(rules.map((r) => r.id));
  return { data: rules.map((r) => withTimesUsed(r, counts)) };
}

// No hay DELETE: una regla se desactiva con { active: false }, así el
// historial de bonificaciones ya aplicadas sigue siendo explicable.
export async function updateBonusRule(id: string, input: UpdateBonusRuleInput) {
  const existing = await db.bonusRule.findUnique({ where: { id }, select: { id: true } });
  if (!existing) throw notFound("Regla de bonificación");
  const rule = await db.bonusRule.update({
    where: { id },
    data: {
      minTopUp: input.minTopUp === undefined ? undefined : pesosToCents(input.minTopUp),
      bonusAmount: input.bonusAmount === undefined ? undefined : pesosToCents(input.bonusAmount),
      active: input.active,
      name: input.name,
      description: input.description,
    },
  });
  return withTimesUsed(rule, await timesUsedByRule([id]));
}

// Qué pasaría si el cliente cargara `amount` pesos: no registra nada.
// Entra en pesos (como las cargas) y sale en centésimos.
export async function previewBonus(merchantId: string, query: BonusPreviewQuery) {
  await requireMerchant(merchantId);
  const amount = pesosToCents(query.amount);
  const rule = await findApplicableRule(db, merchantId, amount);
  const bonus = rule?.bonusAmount ?? 0;
  return {
    amount,
    rule: rule
      ? { id: rule.id, name: rule.name, minTopUp: rule.minTopUp, bonusAmount: rule.bonusAmount }
      : null,
    bonus,
    total: amount + bonus,
  };
}
