// Proveedor del código de un solo uso. TODO lo que depende de quién manda el
// mensaje (Twilio, otro SMS, WhatsApp…) vive detrás de esta interfaz y en un
// solo archivo por proveedor. El resto del backend solo conoce esto.
//
// Cambiar de proveedor = (1) crear `otp/<nombre>.ts` que cumpla `OtpProvider`,
// (2) sumarlo al mapa de `otp/index.ts` y al enum `OTP_PROVIDER` de
// `config.ts`, (3) poner `OTP_PROVIDER=<nombre>` y sus credenciales en las
// variables de entorno. No se toca ninguna ruta ni el frontend.

export type OtpChannel = "sms" | "whatsapp";

// Resultado de comprobar un código. Los límites propios (5 minutos de vida y
// 5 intentos) los aplica el servicio sin depender del proveedor; estos
// resultados cubren además lo que el proveedor pueda decidir por su cuenta.
export type OtpCheckResult = "approved" | "incorrect" | "expired" | "too_many_attempts";

export interface OtpProvider {
  readonly name: string;
  /** Manda un código al teléfono (E.164, ej. +59899123456) por el canal dado. */
  start(phone: string, channel: OtpChannel): Promise<void>;
  /** Comprueba el código. Un código aprobado no puede servir una segunda vez. */
  check(phone: string, code: string): Promise<OtpCheckResult>;
}
