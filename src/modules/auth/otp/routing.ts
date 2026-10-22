import type { OtpProvider } from "./provider.js";

// Modo mixto: reparte cada teléfono entre dos proveedores. Pensado para
// entornos de prueba donde "cualquiera entra con 000000" (proveedor `dev`),
// salvo unos teléfonos concretos que pasan siempre por el proveedor real, de
// modo que 000000 NO les sirve y nadie puede entrar como esa persona.
//
// Un mismo teléfono va siempre al mismo proveedor, tanto al mandar el código
// como al comprobarlo. Los teléfonos llegan normalizados (+598…), igual que
// los de la lista.
export function createRoutingProvider(opts: {
  /** El que usan todos los teléfonos que no están en la lista. */
  fallback: OtpProvider;
  /** El que usan los teléfonos de la lista. */
  special: OtpProvider;
  specialPhones: ReadonlySet<string>;
}): OtpProvider {
  const pick = (phone: string) => (opts.specialPhones.has(phone) ? opts.special : opts.fallback);

  return {
    name: `${opts.fallback.name}+${opts.special.name}`,
    start: (phone, channel) => pick(phone).start(phone, channel),
    check: (phone, code) => pick(phone).check(phone, code),
  };
}
