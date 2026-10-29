import { z } from "zod";

// El teléfono se valida en el servicio (con su propio código INVALID_PHONE),
// no acá, para que el front pueda distinguirlo de un cuerpo mal formado.
const phone = z.string().trim().min(1).max(40);

export const requestCodeBody = z.object({ phone });

export const verifyCodeBody = z.object({
  phone,
  code: z.string().trim().regex(/^\d{6}$/, "El código tiene 6 dígitos"),
});

export type RequestCodeInput = z.infer<typeof requestCodeBody>;
export type VerifyCodeInput = z.infer<typeof verifyCodeBody>;
