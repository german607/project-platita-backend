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

// Movimientos del comercio. from/to son fechas ISO (con offset, ej.
// 2026-10-13T00:00:00-03:00): "hoy" depende de la zona horaria del cliente.
export const listMerchantTransactionsQuery = listTransactionsQuery
  .extend({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
  })
  .refine((q) => !q.from || !q.to || q.from < q.to, { message: "`from` tiene que ser anterior a `to`" });

export type ListMerchantTransactionsQuery = z.infer<typeof listMerchantTransactionsQuery>;
export type TopUpInput = z.infer<typeof topUpBody>;
export type ChargeInput = z.infer<typeof chargeBody>;
export type AdjustmentInput = z.infer<typeof adjustmentBody>;
export type ListTransactionsQuery = z.infer<typeof listTransactionsQuery>;
