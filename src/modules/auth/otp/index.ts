import { config, otpProviderName } from "../../../config.js";
import { devProvider } from "./dev.js";
import type { OtpProvider } from "./provider.js";
import { createTwilioProvider } from "./twilio.js";

// Único lugar donde se eligen los proveedores. Para sumar uno: agregarlo a
// este mapa (y a OTP_PROVIDER en config.ts). Cada proveedor se arma una sola
// vez, la primera que se usa.
const factories: Record<string, () => OtpProvider> = {
  dev: () => devProvider,
  // config.ts ya garantiza que las tres credenciales existen con este proveedor.
  twilio: () =>
    createTwilioProvider({
      accountSid: config.TWILIO_ACCOUNT_SID!,
      authToken: config.TWILIO_AUTH_TOKEN!,
      verifySid: config.TWILIO_VERIFY_SID!,
      locale: config.TWILIO_LOCALE || undefined,
    }),
};

let current: OtpProvider | undefined;

export function getOtpProvider(): OtpProvider {
  current ??= factories[otpProviderName]();
  return current;
}
