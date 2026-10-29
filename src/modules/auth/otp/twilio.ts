import type { OtpChannel, OtpCheckResult, OtpProvider } from "./provider.js";

// Proveedor Twilio Verify. Twilio genera, manda y comprueba el código; el
// backend solo llama a la API REST con `fetch` (sin SDK).
//
//   POST {base}/Services/{VA…}/Verifications       To, Channel[, Locale]   → manda el código
//   POST {base}/Services/{VA…}/VerificationCheck   To, Code                → lo comprueba
//
// Autenticación básica con Account SID y Auth Token. Los límites propios
// (5 minutos y 5 intentos por código, y los pedidos por teléfono e IP) los
// aplica el servicio de auth, no este archivo: acá solo se traduce Twilio al
// contrato de `OtpProvider`.

export type TwilioConfig = {
  accountSid: string;
  authToken: string;
  /** SID del servicio de Verify (empieza con VA), no el de la cuenta (AC). */
  verifySid: string;
  /** Idioma del texto del SMS, ej. "es". Opcional. */
  locale?: string;
  /**
   * Nombre de la app que aparece en el texto del mensaje ("Tu código de <nombre>…").
   * Se manda en cada pedido (CustomFriendlyName, máx. 30 caracteres) y pisa el
   * nombre del servicio de Verify. Opcional.
   */
  friendlyName?: string;
};

type Deps = {
  /** Para los tests: se reemplaza por un fetch simulado. */
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
};

// Error de comunicación o respuesta inesperada de Twilio. A propósito NO
// guarda el mensaje de Twilio (puede traer el teléfono) ni credenciales: solo
// el estado HTTP, el código de error de Twilio y el enlace a su documentación.
export class TwilioError extends Error {
  constructor(
    readonly httpStatus: number | null,
    readonly twilioCode: number | null,
    readonly moreInfo: string | null,
  ) {
    super(`Twilio Verify falló (HTTP ${httpStatus ?? "sin respuesta"}, código ${twilioCode ?? "?"})`);
    this.name = "TwilioError";
  }
}

const asNumber = (value: unknown) => (typeof value === "number" ? value : null);
const asString = (value: unknown) => (typeof value === "string" ? value : null);

// Códigos de error de Twilio Verify que importan para traducir:
const MAX_CHECK_ATTEMPTS_REACHED = 60202;

export function createTwilioProvider(cfg: TwilioConfig, deps: Deps = {}): OtpProvider {
  const doFetch = deps.fetchImpl ?? fetch;
  const serviceUrl = `${deps.baseUrl ?? "https://verify.twilio.com/v2"}/Services/${cfg.verifySid}`;
  const authorization = `Basic ${Buffer.from(`${cfg.accountSid}:${cfg.authToken}`).toString("base64")}`;

  async function post(path: string, form: Record<string, string>) {
    let res: Response;
    try {
      res = await doFetch(`${serviceUrl}/${path}`, {
        method: "POST",
        headers: {
          authorization,
          "content-type": "application/x-www-form-urlencoded",
          accept: "application/json",
        },
        body: new URLSearchParams(form),
        signal: AbortSignal.timeout(deps.timeoutMs ?? 10_000),
      });
    } catch {
      // Sin red, timeout, etc. No se guarda la causa: puede incluir la URL.
      throw new TwilioError(null, null, null);
    }
    let body: Record<string, unknown> | null = null;
    try {
      body = (await res.json()) as Record<string, unknown>;
    } catch {
      // Respuesta sin JSON.
    }
    return { httpStatus: res.status, body };
  }

  const failure = (httpStatus: number, body: Record<string, unknown> | null) =>
    new TwilioError(httpStatus, asNumber(body?.code), asString(body?.more_info));

  return {
    name: "twilio",

    async start(phone: string, channel: OtpChannel) {
      const form: Record<string, string> = { To: phone, Channel: channel };
      if (cfg.locale) form.Locale = cfg.locale;
      if (cfg.friendlyName) form.CustomFriendlyName = cfg.friendlyName;
      const { httpStatus, body } = await post("Verifications", form);
      if (httpStatus < 200 || httpStatus >= 300) throw failure(httpStatus, body);
    },

    async check(phone: string, code: string): Promise<OtpCheckResult> {
      const { httpStatus, body } = await post("VerificationCheck", { To: phone, Code: code });

      if (httpStatus >= 200 && httpStatus < 300) {
        switch (body?.status) {
          case "approved":
            return "approved";
          case "pending": // el código no coincide: la verificación sigue abierta
            return "incorrect";
          case "expired":
          case "canceled":
            return "expired";
          case "max_attempts_reached":
            return "too_many_attempts";
          default:
            throw failure(httpStatus, body);
        }
      }

      // No existe una verificación abierta para ese teléfono: venció, ya se
      // aprobó o nunca se pidió. (Ojo: un VERIFY_SID equivocado también da
      // 404; si todos los códigos aparecen como vencidos, revisarlo.)
      if (httpStatus === 404) return "expired";
      if (httpStatus === 429 && asNumber(body?.code) === MAX_CHECK_ATTEMPTS_REACHED) return "too_many_attempts";

      throw failure(httpStatus, body);
    },
  };
}
