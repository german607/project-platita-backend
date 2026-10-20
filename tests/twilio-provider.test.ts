import { describe, expect, it, vi } from "vitest";
import { createTwilioProvider, TwilioError } from "../src/modules/auth/otp/twilio.js";

// El proveedor de Twilio se prueba con un fetch simulado: no sale a la red ni
// gasta verificaciones. Son los mismos casos que cualquier proveedor nuevo
// tiene que cumplir (el contrato de OtpProvider).

const CFG = { accountSid: "ACtest", authToken: "token-de-prueba", verifySid: "VAtest" };
const PHONE = "+59899123456";

const reply = (status: number, body?: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });

function providerReplying(response: Response | Error, extra: { locale?: string } = {}) {
  const fetchImpl = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  return { fetchImpl, provider: createTwilioProvider({ ...CFG, ...extra }, { fetchImpl: fetchImpl as unknown as typeof fetch }) };
}

const sentRequest = (fetchImpl: ReturnType<typeof vi.fn>) => {
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  return { url, init, form: new URLSearchParams(String(init.body)) };
};

describe("proveedor Twilio Verify", () => {
  describe("start", () => {
    it("pide la verificación con el teléfono, el canal y la autenticación básica", async () => {
      const { fetchImpl, provider } = providerReplying(reply(201, { status: "pending" }));
      await provider.start(PHONE, "sms");

      const { url, init, form } = sentRequest(fetchImpl);
      expect(url).toBe("https://verify.twilio.com/v2/Services/VAtest/Verifications");
      expect(init.method).toBe("POST");
      expect(form.get("To")).toBe(PHONE);
      expect(form.get("Channel")).toBe("sms");
      expect(form.has("Locale")).toBe(false);
      const headers = init.headers as Record<string, string>;
      expect(headers.authorization).toBe(`Basic ${Buffer.from("ACtest:token-de-prueba").toString("base64")}`);
      expect(headers["content-type"]).toBe("application/x-www-form-urlencoded");
    });

    it("manda el canal whatsapp y el idioma si están configurados", async () => {
      const { fetchImpl, provider } = providerReplying(reply(201, { status: "pending" }), { locale: "es" });
      await provider.start(PHONE, "whatsapp");
      const { form } = sentRequest(fetchImpl);
      expect(form.get("Channel")).toBe("whatsapp");
      expect(form.get("Locale")).toBe("es");
    });

    it("si Twilio rechaza el pedido, falla con su código pero sin su mensaje", async () => {
      const { provider } = providerReplying(
        reply(400, { code: 21608, message: "The number +59899123456 is unverified", more_info: "https://www.twilio.com/docs/errors/21608" }),
      );
      const error = await provider.start(PHONE, "sms").catch((e) => e);
      expect(error).toBeInstanceOf(TwilioError);
      expect(error.httpStatus).toBe(400);
      expect(error.twilioCode).toBe(21608);
      expect(error.moreInfo).toBe("https://www.twilio.com/docs/errors/21608");
      // Ni el teléfono ni el mensaje de Twilio quedan en el error.
      expect(error.message).not.toContain("5989");
      expect(error.message).not.toContain("unverified");
    });

    it("si no hay red, falla sin detalles de la conexión", async () => {
      const { provider } = providerReplying(new Error("connect ECONNREFUSED verify.twilio.com"));
      const error = await provider.start(PHONE, "sms").catch((e) => e);
      expect(error).toBeInstanceOf(TwilioError);
      expect(error.httpStatus).toBeNull();
      expect(error.message).not.toContain("ECONNREFUSED");
    });
  });

  describe("check", () => {
    it("manda el teléfono y el código a VerificationCheck", async () => {
      const { fetchImpl, provider } = providerReplying(reply(200, { status: "approved", valid: true }));
      await provider.check(PHONE, "123456");
      const { url, form } = sentRequest(fetchImpl);
      expect(url).toBe("https://verify.twilio.com/v2/Services/VAtest/VerificationCheck");
      expect(form.get("To")).toBe(PHONE);
      expect(form.get("Code")).toBe("123456");
    });

    it.each([
      ["aprobado", reply(200, { status: "approved", valid: true }), "approved"],
      ["código incorrecto (la verificación sigue pendiente)", reply(200, { status: "pending", valid: false }), "incorrect"],
      ["vencida", reply(200, { status: "expired" }), "expired"],
      ["cancelada", reply(200, { status: "canceled" }), "expired"],
      ["máximo de intentos del lado de Twilio", reply(200, { status: "max_attempts_reached" }), "too_many_attempts"],
      ["no hay verificación abierta (404)", reply(404, { code: 20404 }), "expired"],
      ["máximo de intentos (429 con código 60202)", reply(429, { code: 60202 }), "too_many_attempts"],
    ])("traduce: %s", async (_caso, response, expected) => {
      const { provider } = providerReplying(response);
      await expect(provider.check(PHONE, "123456")).resolves.toBe(expected);
    });

    it.each([
      ["credenciales inválidas (401)", reply(401, { code: 20003 })],
      ["error de Twilio (500)", reply(500, {})],
      ["límite de pedidos de Twilio (429 que no es de intentos)", reply(429, { code: 20429 })],
      ["estado desconocido", reply(200, { status: "algo-nuevo" })],
      ["respuesta que no es JSON", new Response("<html>", { status: 200 })],
    ])("falla (no adivina) ante: %s", async (_caso, response) => {
      const { provider } = providerReplying(response);
      await expect(provider.check(PHONE, "123456")).rejects.toBeInstanceOf(TwilioError);
    });

    it("si no hay red, falla", async () => {
      const { provider } = providerReplying(new Error("timeout"));
      await expect(provider.check(PHONE, "123456")).rejects.toBeInstanceOf(TwilioError);
    });
  });
});
