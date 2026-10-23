import { config, otpProviderName, otpRealPhones } from "../../../config.js";
import { devProvider } from "./dev.js";
import type { OtpProvider } from "./provider.js";
import { createRoutingProvider } from "./routing.js";
import { createTwilioProvider } from "./twilio.js";

// Único lugar donde se eligen los proveedores. Para sumar uno: agregarlo a
// este mapa (y a OTP_PROVIDER en config.ts). Cada proveedor se arma una sola
// vez, la primera que se usa.

// config.ts ya garantiza que las tres credenciales existen cuando se usa Twilio.
const twilio = () =>
  createTwilioProvider({
    accountSid: config.TWILIO_ACCOUNT_SID!,
    authToken: config.TWILIO_AUTH_TOKEN!,
    verifySid: config.TWILIO_VERIFY_SID!,
    locale: config.TWILIO_LOCALE || undefined,
  });

const factories: Record<string, () => OtpProvider> = {
  // Con OTP_REAL_PHONES, el proveedor de prueba deja pasar por Twilio a esos
  // teléfonos (modo mixto): para el resto sigue valiendo 000000.
  dev: () =>
    otpRealPhones.length > 0
      ? createRoutingProvider({ fallback: devProvider, special: twilio(), specialPhones: new Set(otpRealPhones) })
      : devProvider,
  twilio,
};

let current: OtpProvider | undefined;

export function getOtpProvider(): OtpProvider {
  current ??= factories[otpProviderName]();
  return current;
}
