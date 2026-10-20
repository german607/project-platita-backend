import { afterEach, describe, expect, it, vi } from "vitest";

// La configuración se valida al importar `src/config.ts`. Para probar las
// reglas de arranque se vuelve a importar con otras variables de entorno.
// `process.loadEnvFile` se anula para que el .env de quien corre los tests
// (con sus credenciales reales) no se cuele en el resultado.

const MANAGED = [
  "OTP_PROVIDER",
  "ALLOW_INSECURE_AUTH",
  "TWILIO_ACCOUNT_SID",
  "TWILIO_AUTH_TOKEN",
  "TWILIO_VERIFY_SID",
  "TWILIO_LOCALE",
];

const original = { ...process.env };

async function loadConfig(env: Record<string, string> = {}) {
  vi.resetModules();
  vi.spyOn(process, "loadEnvFile").mockImplementation(() => {});
  for (const key of MANAGED) delete process.env[key];
  Object.assign(process.env, { NODE_ENV: "test" }, env);
  return import("../src/config.js");
}

const TWILIO = {
  OTP_PROVIDER: "twilio",
  TWILIO_ACCOUNT_SID: "ACxxxxxxxx",
  TWILIO_AUTH_TOKEN: "secreto",
  TWILIO_VERIFY_SID: "VAxxxxxxxx",
};

describe("validación de la configuración al arrancar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });

  it("en desarrollo y tests arranca con el proveedor dev por defecto", async () => {
    const { config, otpProviderName, usingInsecureAuth } = await loadConfig();
    expect(config.OTP_PROVIDER).toBeUndefined();
    expect(otpProviderName).toBe("dev");
    expect(usingInsecureAuth).toBe(false);
  });

  describe("producción", () => {
    it("se niega a arrancar con el proveedor dev (por defecto)", async () => {
      await expect(loadConfig({ NODE_ENV: "production" })).rejects.toThrow(/OTP_PROVIDER/);
    });

    it("se niega a arrancar con OTP_PROVIDER=dev explícito", async () => {
      await expect(loadConfig({ NODE_ENV: "production", OTP_PROVIDER: "dev" })).rejects.toThrow(/ALLOW_INSECURE_AUTH/);
    });

    it("arranca con el proveedor dev solo si se pide a propósito (demos)", async () => {
      const { usingInsecureAuth } = await loadConfig({ NODE_ENV: "production", ALLOW_INSECURE_AUTH: "true" });
      expect(usingInsecureAuth).toBe(true);
    });

    it("arranca con Twilio y sin ALLOW_INSECURE_AUTH", async () => {
      const { usingInsecureAuth, otpProviderName } = await loadConfig({ NODE_ENV: "production", ...TWILIO });
      expect(otpProviderName).toBe("twilio");
      expect(usingInsecureAuth).toBe(false);
    });
  });

  describe("OTP_PROVIDER=twilio", () => {
    it("exige las tres credenciales y dice cuáles faltan, sin mostrar valores", async () => {
      const error = await loadConfig({ OTP_PROVIDER: "twilio", TWILIO_AUTH_TOKEN: "secreto-que-no-debe-salir" }).catch(
        (e) => e,
      );
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain("TWILIO_ACCOUNT_SID");
      expect(error.message).toContain("TWILIO_VERIFY_SID");
      expect(error.message).not.toContain("secreto-que-no-debe-salir");
    });

    it("el Account SID tiene que empezar con AC", async () => {
      await expect(loadConfig({ ...TWILIO, TWILIO_ACCOUNT_SID: "VAxxxxxxxx" })).rejects.toThrow(/empezar con AC/);
    });

    it("el SID del servicio tiene que empezar con VA", async () => {
      await expect(loadConfig({ ...TWILIO, TWILIO_VERIFY_SID: "ACxxxxxxxx" })).rejects.toThrow(/empezar con VA/);
    });

    it("con las tres credenciales válidas arranca, con el idioma opcional", async () => {
      const { config } = await loadConfig({ ...TWILIO, TWILIO_LOCALE: "es" });
      expect(config.OTP_PROVIDER).toBe("twilio");
      expect(config.TWILIO_LOCALE).toBe("es");
    });
  });
});
