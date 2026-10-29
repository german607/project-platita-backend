import { z } from "zod";
import { pageQuery, uyPhone } from "../../lib/schemas.js";

export const upsertCustomerBody = z.object({
  phone: uyPhone,
  name: z.string().trim().min(1).max(120).optional(),
});

export const updateCustomerBody = z
  .object({ name: z.string().trim().min(1).max(120).nullable().optional() })
  .refine((body) => Object.keys(body).length > 0, { message: "Hay que enviar al menos un campo" });

export const listCustomersQuery = pageQuery.extend({
  // Texto libre: nombre o teléfono (en cualquier formato, también parcial).
  search: z.string().trim().min(1).optional(),
  // Teléfono exacto (se normaliza igual que al guardarlo); no crea nada.
  phone: uyPhone.optional(),
});

export const inactiveQuery = pageQuery.extend({
  days: z.coerce.number().int().positive().max(3650).default(60),
});

export type UpsertCustomerInput = z.infer<typeof upsertCustomerBody>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerBody>;
export type ListCustomersQuery = z.infer<typeof listCustomersQuery>;
export type InactiveQuery = z.infer<typeof inactiveQuery>;
