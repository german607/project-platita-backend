import { z } from "zod";
import { uyPhone } from "../../lib/schemas.js";

const name = z.string().trim().min(1).max(120);

// Identificarse por teléfono (SIN verificación: ver routes.ts).
export const identifyUserBody = z.object({
  phone: uyPhone,
  name: name.optional(),
});

export const updateUserBody = z
  .object({ name: name.nullable().optional() })
  .refine((body) => Object.keys(body).length > 0, { message: "Hay que enviar al menos un campo" });

export type IdentifyUserInput = z.infer<typeof identifyUserBody>;
export type UpdateUserInput = z.infer<typeof updateUserBody>;
