import { Plan } from "@prisma/client";
import { z } from "zod";

const name = z.string().trim().min(1).max(120);
const phone = z.string().trim().min(6).max(30);

export const createMerchantBody = z.object({
  name,
  phone: phone.optional(),
  plan: z.nativeEnum(Plan).optional(),
});

export const updateMerchantBody = z
  .object({
    name: name.optional(),
    phone: phone.nullable().optional(),
    plan: z.nativeEnum(Plan).optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Hay que enviar al menos un campo" });

export type CreateMerchantInput = z.infer<typeof createMerchantBody>;
export type UpdateMerchantInput = z.infer<typeof updateMerchantBody>;
