import { TransactionType } from "@prisma/client";
import { z } from "zod";
import { MAX_PESOS, pageQuery, positivePesos } from "../../lib/schemas.js";

const paidWith = z.string().trim().min(1).max(40).optional();
const note = z.string().trim().min(1).max(280);

export const topUpBody = z.object({ amount: positivePesos, paidWith });

export const chargeBody = z.object({ amount: positivePesos, note: note.optional() });

// Ajuste manual con signo: positivo suma saldo, negativo resta. La nota es
// obligatoria porque es la única explicación que queda en el libro mayor.
export const adjustmentBody = z.object({
  amount: z
    .number()
    .min(-MAX_PESOS)
    .max(MAX_PESOS)
    .refine((n) => n !== 0, { message: "El ajuste no puede ser 0" }),
  note,
});

export const listTransactionsQuery = pageQuery.extend({
  type: z.nativeEnum(TransactionType).optional(),
});

export type TopUpInput = z.infer<typeof topUpBody>;
export type ChargeInput = z.infer<typeof chargeBody>;
export type AdjustmentInput = z.infer<typeof adjustmentBody>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuery>;
