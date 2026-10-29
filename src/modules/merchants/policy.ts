import { allowedMerchantPhones, isProduction } from "../../config.js";
import { AppError } from "../../lib/errors.js";

// Quién puede CREAR un comercio (no quién puede operar uno ya creado: eso es
// ser su dueña, ver auth/access.ts). Los comercios los habilitamos nosotros: la
// lista sale de la variable de entorno ALLOWED_MERCHANT_PHONES.
//
// - Con lista: solo los teléfonos de la lista.
// - Sin lista: en desarrollo y tests puede cualquiera, para probar; en
//   producción nadie, así un olvido de configuración no abre el alta a todos.
export function canCreateMerchant(phone: string): boolean {
  if (allowedMerchantPhones.length > 0) return allowedMerchantPhones.includes(phone);
  return !isProduction;
}

export function assertCanCreateMerchant(phone: string) {
  if (!canCreateMerchant(phone)) {
    throw new AppError(
      403,
      "MERCHANT_CREATION_NOT_ALLOWED",
      "Tu número todavía no está habilitado para crear un comercio: escribinos para habilitarlo",
    );
  }
}
