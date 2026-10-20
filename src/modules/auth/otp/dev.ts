import type { OtpProvider } from "./provider.js";

// Proveedor de desarrollo y pruebas: no manda nada ni cuesta nada, y el único
// código válido es siempre 000000. NO es seguro: cualquiera que conozca un
// teléfono puede entrar. Por eso producción se niega a arrancar con este
// proveedor salvo opt-in explícito (ALLOW_INSECURE_AUTH, ver config.ts).
export const DEV_CODE = "000000";

export const devProvider: OtpProvider = {
  name: "dev",
  async start() {
    // No hay nada que mandar.
  },
  async check(_phone, code) {
    return code === DEV_CODE ? "approved" : "incorrect";
  },
};
