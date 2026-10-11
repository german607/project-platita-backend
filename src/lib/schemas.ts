import { z } from "zod";
import { normalizeUyPhone } from "./phone.js";

// Bloques de validación reutilizables por todos los módulos.

export const idParams = z.object({ id: z.string().min(1) });
export const merchantIdParams = z.object({ merchantId: z.string().min(1) });

// La API recibe pesos (con hasta 2 decimales de precisión efectiva) y los
// convierte a centésimos con pesosToCents. El tope evita desbordar el Int.
export const MAX_PESOS = 1_000_000;
export const positivePesos = z.number().positive().max(MAX_PESOS);

// Teléfono uruguayo: acepta 099123456, +59899123456, 99 123 456, etc. y lo
// guarda siempre normalizado (+59899123456) para que no haya duplicados.
export const uyPhone = z
  .string()
  .trim()
  .transform((value, ctx) => {
    const normalized = normalizeUyPhone(value);
    if (!normalized) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Teléfono uruguayo inválido" });
      return z.NEVER;
    }
    return normalized;
  });

// Paginación por cursor: ?limit=50&cursor=<id del último elemento>
export const pageQuery = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  cursor: z.string().min(1).optional(),
});
export type PageQuery = z.infer<typeof pageQuery>;
