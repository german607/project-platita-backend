import { z } from "zod";
import { MAX_PESOS, positivePesos } from "../../lib/schemas.js";

const ruleName = z.string().trim().min(1).max(80);
const ruleDescription = z.string().trim().min(1).max(280);

// Montos en pesos en la API; el servicio los pasa a centésimos.
export const createBonusRuleBody = z.object({
  minTopUp: positivePesos,
  bonusAmount: positivePesos,
  active: z.boolean().optional(),
  name: ruleName.optional(),
  description: ruleDescription.optional(),
});

// name y description aceptan null para borrarlos.
export const updateBonusRuleBody = z
  .object({
    minTopUp: positivePesos.optional(),
    bonusAmount: positivePesos.optional(),
    active: z.boolean().optional(),
    name: ruleName.nullable().optional(),
    description: ruleDescription.nullable().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Hay que enviar al menos un campo" });

// Vista previa: cuánto bono daría una carga de `amount` pesos.
export const bonusPreviewQuery = z.object({
  amount: z.coerce.number().positive().max(MAX_PESOS),
});

export type CreateBonusRuleInput = z.infer<typeof createBonusRuleBody>;
export type UpdateBonusRuleInput = z.infer<typeof updateBonusRuleBody>;
export type BonusPreviewQuery = z.infer<typeof bonusPreviewQuery>;
