import type { FastifyInstance } from "fastify";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/lib/db.js";
import { api, loginAs, resetDb } from "./helpers.js";

// Quién puede CREAR comercios depende de la configuración (ALLOWED_MERCHANT_PHONES),
// que se lee al importar. Cada caso arma la app de nuevo con otras variables.

const original = { ...process.env };
const opened: FastifyInstance[] = [];

async function appWith(env: Record<string, string>) {
  vi.resetModules();
  vi.spyOn(process, "loadEnvFile").mockImplementation(() => {});
  Object.assign(process.env, env);
  const { buildApp } = await import("../src/app.js");
  const app = await buildApp();
  await app.ready();
  opened.push(app);
  return app;
}

async function policyWith(env: Record<string, string>) {
  vi.resetModules();
  vi.spyOn(process, "loadEnvFile").mockImplementation(() => {});
  Object.assign(process.env, env);
  return import("../src/modules/merchants/policy.js");
}

describe("quién puede crear un comercio", () => {
  beforeEach(async () => {
    await resetDb();
  });
  afterEach(async () => {
    vi.restoreAllMocks();
    while (opened.length > 0) await opened.pop()!.close();
    for (const key of Object.keys(process.env)) if (!(key in original)) delete process.env[key];
    Object.assign(process.env, original);
  });

  describe("con una lista de teléfonos habilitados", () => {
    const ENV = { ALLOWED_MERCHANT_PHONES: "098000111, 099 555 777" };

    it("los de la lista pueden (en cualquier formato) y los demás reciben 403", async () => {
      const app = await appWith(ENV);
      const allowed = await loginAs(app, "098000111");
      const alsoAllowed = await loginAs(app, "+59899555777");
      const outsider = await loginAs(app, "098000222");

      expect((await api(app, allowed.authHeader).post("/merchants", { name: "Café" })).status).toBe(201);
      expect((await api(app, alsoAllowed.authHeader).post("/merchants", { name: "Panadería" })).status).toBe(201);

      const denied = await api(app, outsider.authHeader).post("/merchants", { name: "Intruso" });
      expect(denied.status).toBe(403);
      expect(denied.body.code).toBe("MERCHANT_CREATION_NOT_ALLOWED");
      expect(await db.merchant.count()).toBe(2); // el de afuera no creó nada
    });

    it("GET /me avisa si la persona puede crear comercios", async () => {
      const app = await appWith(ENV);
      const allowed = await loginAs(app, "098000111");
      const outsider = await loginAs(app, "098000222");

      expect((await api(app, allowed.authHeader).get("/me")).body.canCreateMerchant).toBe(true);
      expect((await api(app, outsider.authHeader).get("/me")).body.canCreateMerchant).toBe(false);
    });

    it("quien ya tiene un comercio lo sigue operando aunque no esté en la lista", async () => {
      // El comercio se creó antes (por ejemplo con el seed o asignado a mano).
      const app = await appWith(ENV);
      const outsider = await loginAs(app, "098000222");
      const merchant = await db.merchant.create({ data: { name: "Ya existía", ownerId: outsider.user.id } });

      const http = api(app, outsider.authHeader);
      expect((await http.get(`/merchants/${merchant.id}`)).status).toBe(200);
      expect((await http.get("/me")).body.merchants).toHaveLength(1);
    });
  });

  describe("sin lista", () => {
    it("fuera de producción puede cualquiera, para poder probar", async () => {
      const app = await appWith({});
      const anyone = await loginAs(app, "098000333");
      expect((await api(app, anyone.authHeader).post("/merchants", { name: "Cualquiera" })).status).toBe(201);
      expect((await api(app, anyone.authHeader).get("/me")).body.canCreateMerchant).toBe(true);
    });

    it("en producción NADIE puede (no se abre por un olvido de configuración)", async () => {
      const { canCreateMerchant } = await policyWith({ NODE_ENV: "production", ALLOW_INSECURE_AUTH: "true" });
      expect(canCreateMerchant("+59898000111")).toBe(false);
    });
  });

  describe("la política", () => {
    it("con lista, solo los listados, también en producción", async () => {
      const { canCreateMerchant } = await policyWith({
        NODE_ENV: "production",
        ALLOW_INSECURE_AUTH: "true",
        ALLOWED_MERCHANT_PHONES: "098000111",
      });
      expect(canCreateMerchant("+59898000111")).toBe(true);
      expect(canCreateMerchant("+59898000222")).toBe(false);
    });

    it("assertCanCreateMerchant lanza el 403 con su código", async () => {
      const { assertCanCreateMerchant } = await policyWith({ ALLOWED_MERCHANT_PHONES: "098000111" });
      expect(() => assertCanCreateMerchant("+59898000222")).toThrow(/habilitado/);
      expect(() => assertCanCreateMerchant("+59898000111")).not.toThrow();
    });
  });
});
