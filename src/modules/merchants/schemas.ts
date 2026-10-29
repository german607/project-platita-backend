import { MerchantCategory, Plan } from "@prisma/client";
import { z } from "zod";
import { openingHoursSchema } from "../../lib/opening-hours.js";

const name = z.string().trim().min(1).max(120);
const phone = z.string().trim().min(6).max(30);

// Perfil público. La foto es solo una URL (la subida de archivos es otro hito).
const description = z.string().trim().min(1).max(280);
const photoUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((url) => /^https?:\/\//i.test(url), { message: "La foto tiene que ser una URL http o https" });

export const createMerchantBody = z.object({
  name,
  phone: phone.optional(),
  plan: z.nativeEnum(Plan).optional(),
});

// description y photoUrl aceptan null para borrarlos. category no se puede
// borrar. openingHours reemplaza la semana completa (un día ausente = cerrado).
export const updateMerchantBody = z
  .object({
    name: name.optional(),
    phone: phone.nullable().optional(),
    plan: z.nativeEnum(Plan).optional(),
    description: description.nullable().optional(),
    photoUrl: photoUrl.nullable().optional(),
    category: z.nativeEnum(MerchantCategory).optional(),
    visible: z.boolean().optional(),
    openingHours: openingHoursSchema.optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Hay que enviar al menos un campo" });

export type CreateMerchantInput = z.infer<typeof createMerchantBody>;
export type UpdateMerchantInput = z.infer<typeof updateMerchantBody>;
