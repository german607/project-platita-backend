import { afterEach, describe, expect, it, vi } from "vitest";
import type { OtpProvider } from "../src/modules/auth/otp/provider.js";
import { createRoutingProvider } from "../src/modules/auth/otp/routing.js";

const REAL = "+59892965852"; // un teléfono de la lista
const OTHER = "+59899123456";

function fakeProvider(name: string, checkResult: "approved" | "incorrect"): OtpProvider {
  return {
    name,
    start: vi.fn(async () => {}),
    check: vi.fn(async () => checkResult),
  };
}

describe("modo mixto: el proveedor de prueba para todos, el real para unos teléfonos", () => {
  it("los teléfonos de la lista van al proveedor real, tanto al mandar como al comprobar", async () => {
    const dev = fakeProvider("dev", "approved");
    const twilio = fakeProvider("twilio", "incorrect");
    const mixed = createRoutingProvider({ fallback: dev, special: twilio, specialPhones: new Set([REAL]) });

    await mixed.start(REAL, "sms");
    // 000000 NO le sirve a ese teléfono: lo decide Twilio, no el proveedor de prueba.
    await expect(mixed.check(REAL, "000000")).resolves.toBe("incorrect");

    expect(twilio.start).toHaveBeenCalledWith(REAL, "sms");
    expect(twilio.check).toHaveBeenCalledWith(REAL, "000000");
    expect(dev.start).not.toHaveBeenCalled();
    expect(dev.check).not.toHaveBeenCalled();
  });

  it("el resto de los teléfonos usa el proveedor de prueba y nunca toca el real", async () => {
    const dev = fakeProvider("dev", "approved");
    const twilio = fakeProvider("twilio", "incorrect");
    const mixed = createRoutingProvider({ fallback: dev, special: twilio, specialPhones: new Set([REAL]) });

    await mixed.start(OTHER, "sms");
    await expect(mixed.check(OTHER, "000000")).resolves.toBe("approved");

    expect(dev.start).toHaveBeenCalledWith(OTHER, "sms");
    expect(twilio.start).not.toHaveBeenCalled();
    expect(twilio.check).not.toHaveBeenCalled();
  });

  it("lleva el nombre de los dos proveedores", () => {
    const mixed = createRoutingProvider({
      fallback: fakeProvider("dev", "approved"),
      special: fakeProvider("twilio", "incorrect"),
      specialPhones: new Set(),
    });
    expect(mixed.name).toBe("dev+twilio");
  });
});

// La elección del proveedor según la configuración: se vuelve a importar con
// otras variables de entorno, sin tocar la red (fetch simulado).
describe("getOtpProvider según OTP_REAL_PHONES", () => {
  const original = { ...process.env };

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });

  async function loadProvider(env: Record<string, string>) {
    vi.resetModules();
    vi.spyOn(process, "loadEnvFile").mockImplementation(() => {});
    for (const key of ["OTP_PROVIDER", "OTP_REAL_PHONES", "TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SID"]) {
      delete process.env[key];
    }
    Object.assign(process.env, { NODE_ENV: "test" }, env);
    const { getOtpProvider } = await import("../src/modules/auth/otp/index.js");
    return getOtpProvider();
  }

  const TWILIO = { TWILIO_ACCOUNT_SID: "ACxxxxxxxx", TWILIO_AUTH_TOKEN: "secreto", TWILIO_VERIFY_SID: "VAxxxxxxxx" };

  it("sin la lista, es el proveedor de prueba puro", async () => {
    const provider = await loadProvider({});
    expect(provider.name).toBe("dev");
  });

  it("con la lista, el teléfono listado (en cualquier formato) va a Twilio y 000000 no le sirve", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ status: "pending", valid: false }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const provider = await loadProvider({ OTP_REAL_PHONES: "092 965 852, 099111222", ...TWILIO });
    expect(provider.name).toBe("dev+twilio");

    // El teléfono de la lista: lo comprueba Twilio ("pending" = código incorrecto).
    await expect(provider.check("+59892965852", "000000")).resolves.toBe("incorrect");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Otro teléfono: 000000 vale y no se llama a Twilio.
    await expect(provider.check("+59898765432", "000000")).resolves.toBe("approved");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
