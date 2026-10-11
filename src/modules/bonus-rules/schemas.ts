import { z } from "zod";
import { positivePesos } from "../../lib/schemas.js";

// Montos en pesos en la API; el servicio los pasa a centésimos.
export const createBonusRuleBody = z.object({
  minTopUp: positivePesos,
  bonusAmount: positivePesos,
  active: z.boolean().optional(),
});

export const updateBonusRuleBody = z
  .object({
    minTopUp: positivePesos.optional(),
    bonusAmount: positivePesos.optional(),
    active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Hay que enviar al menos un campo" });

export type CreateBonusRuleInput = z.infer<typeof createBonusRuleBody>;
export type UpdateBonusRuleInput = z.infer<typeof updateBonusRuleBody>;
