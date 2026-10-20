import type { FastifyInstance } from "fastify";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../src/lib/db.js";
import { devProvider } from "../src/modules/auth/otp/dev.js";
import { api, clearOtpLimits, createTestApp, loginAs, resetDb, seedCustomer, seedMerchant } from "./helpers.js";

const PHONE = "099123456";
const PHONE_E164 = "+59899123456";

describe("ingreso del cliente por código", () => {
  let app: FastifyInstance;
  let http: ReturnType<typeof api>;

  beforeAll(async () => {
    app = await createTestApp();
    http = api(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
  });

  describe("proveedor dev (contrato de OtpProvider)", () => {
    it("aprueba 000000 y rechaza cualquier otro código", async () => {
      await expect(devProvider.check(PHONE_E164, "000000")).resolves.toBe("approved");
      await expect(devProvider.check(PHONE_E164, "123456")).resolves.toBe("incorrect");
    });
  });

  it("GET /auth/config avisa el proveedor y el código de prueba", async () => {
    const res = await http.get("/auth/config");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ otpProvider: "dev", devCode: "000000" });
  });

  describe("POST /auth/request-code", () => {
    it("rechaza un teléfono inválido con INVALID_PHONE", async () => {
      const res = await http.post("/auth/request-code", { phone: "123" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("INVALID_PHONE");
    });

    it("responde 204 y limita el segundo pedido seguido (30 s)", async () => {
      expect((await http.post("/auth/request-code", { phone: PHONE })).status).toBe(204);
      const again = await http.post("/auth/request-code", { phone: PHONE });
      expect(again.status).toBe(429);
      expect(again.body.code).toBe("TOO_MANY_REQUESTS");
      expect(again.body.details.retryAfterSeconds).toBeGreaterThan(0);
    });

    it("responde igual para un teléfono conocido y uno desconocido", async () => {
      await db.user.create({ data: { phone: PHONE_E164 } });
      const known = await http.post("/auth/request-code", { phone: PHONE });
      const unknown = await http.post("/auth/request-code", { phone: "098765432" });
      expect(known.status).toBe(204);
      expect(unknown.status).toBe(204);
      expect(known.raw).toBe(unknown.raw);
    });

    it("limita a 5 pedidos por hora por teléfono", async () => {
      await db.otpRequest.createMany({
        data: Array.from({ length: 5 }, (_, i) => ({ phone: PHONE_E164, createdAt: new Date(Date.now() - (120 + i) * 1000) })),
      });
      const res = await http.post("/auth/request-code", { phone: PHONE });
      expect(res.status).toBe(429);
      expect(res.body.details.retryAfterSeconds).toBeGreaterThan(3000);
    });

    it("limita a 20 pedidos por hora por IP", async () => {
      await db.otpRequest.createMany({
        data: Array.from({ length: 20 }, (_, i) => ({
          phone: `+598900000${String(i).padStart(2, "0")}`,
          ip: "127.0.0.1",
          createdAt: new Date(Date.now() - 60_000),
        })),
      });
      const res = await http.post("/auth/request-code", { phone: "098765432" });
      expect(res.status).toBe(429);
      expect(res.body.code).toBe("TOO_MANY_REQUESTS");
    });
  });

  describe("POST /auth/verify-code", () => {
    it("sin haber pedido un código, el código está vencido", async () => {
      const res = await http.post("/auth/verify-code", { phone: PHONE, code: "000000" });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("CODE_EXPIRED");
    });

    it("un código incorrecto cuenta intentos y al quinto bloquea, incluso con el código bueno", async () => {
      await http.post("/auth/request-code", { phone: PHONE });
      const left: number[] = [];
      for (let i = 0; i < 5; i++) {
        const res = await http.post("/auth/verify-code", { phone: PHONE, code: "111111" });
        expect(res.status).toBe(422);
        expect(res.body.code).toBe("CODE_INCORRECT");
        left.push(res.body.details.attemptsLeft);
      }
      expect(left).toEqual([4, 3, 2, 1, 0]);

      const locked = await http.post("/auth/verify-code", { phone: PHONE, code: "000000" });
      expect(locked.status).toBe(429);
      expect(locked.body.code).toBe("TOO_MANY_ATTEMPTS");

      // Pedir un código nuevo reinicia los intentos.
      await clearOtpLimits();
      await http.post("/auth/request-code", { phone: PHONE });
      expect((await http.post("/auth/verify-code", { phone: PHONE, code: "000000" })).status).toBe(200);
    });

    it("el código vence a los 5 minutos", async () => {
      await http.post("/auth/request-code", { phone: PHONE });
      await db.otpChallenge.update({
        where: { phone: PHONE_E164 },
        data: { requestedAt: new Date(Date.now() - 6 * 60 * 1000) },
      });
      const res = await http.post("/auth/verify-code", { phone: PHONE, code: "000000" });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("CODE_EXPIRED");
    });

    it("un código correcto abre la sesión, crea al usuario y no se puede usar dos veces", async () => {
      await http.post("/auth/request-code", { phone: PHONE });
      const res = await http.post("/auth/verify-code", { phone: "99 123 456", code: "000000" });
      expect(res.status).toBe(200);
      expect(res.body.token).toEqual(expect.any(String));
      expect(res.body.expiresAt).toEqual(expect.any(String));
      expect(res.body.user.phone).toBe(PHONE_E164);
      expect(res.body.user.phoneVerifiedAt).not.toBeNull();

      // En la base solo queda el hash del token.
      const session = await db.session.findFirstOrThrow();
      expect(session.tokenHash).not.toBe(res.body.token);

      const second = await http.post("/auth/verify-code", { phone: PHONE, code: "000000" });
      expect(second.status).toBe(422);
      expect(second.body.code).toBe("CODE_EXPIRED");
    });

    it("rechaza un código mal formado con 400", async () => {
      const res = await http.post("/auth/verify-code", { phone: PHONE, code: "12" });
      expect(res.status).toBe(400);
      expect(res.body.code).toBe("VALIDATION_ERROR");
    });

    it("la persona que un comercio ya había anotado entra con ese mismo usuario", async () => {
      const merchantId = await seedMerchant(app);
      const customer = await seedCustomer(app, merchantId, PHONE, "Juancito");
      const before = await db.user.findUniqueOrThrow({ where: { phone: PHONE_E164 } });
      expect(before.phoneVerifiedAt).toBeNull(); // existe, pero nunca verificó

      const { user } = await loginAs(app, PHONE);
      expect(user.id).toBe(customer.userId);
      expect(user.phoneVerifiedAt).not.toBeNull();
      expect(await db.user.count()).toBe(1);
    });
  });

  describe("si el proveedor del código falla", () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it("al mandar el código: 502 y no cuenta contra el límite del teléfono", async () => {
      vi.spyOn(devProvider, "start").mockRejectedValueOnce(new Error("sin red"));
      const failed = await http.post("/auth/request-code", { phone: PHONE });
      expect(failed.status).toBe(502);
      expect(failed.body.code).toBe("OTP_PROVIDER_ERROR");
      expect(await db.otpRequest.count()).toBe(0);

      // Se puede reintentar enseguida, sin esperar los 30 segundos.
      expect((await http.post("/auth/request-code", { phone: PHONE })).status).toBe(204);
    });

    it("al comprobar el código: 502 y no gasta un intento", async () => {
      await http.post("/auth/request-code", { phone: PHONE });
      vi.spyOn(devProvider, "check").mockRejectedValueOnce(new Error("sin red"));
      const failed = await http.post("/auth/verify-code", { phone: PHONE, code: "000000" });
      expect(failed.status).toBe(502);
      expect(failed.body.code).toBe("OTP_PROVIDER_ERROR");
      expect((await db.otpChallenge.findFirstOrThrow()).attempts).toBe(0);

      expect((await http.post("/auth/verify-code", { phone: PHONE, code: "000000" })).status).toBe(200);
    });

    it("traduce los resultados vencido y demasiados intentos del proveedor", async () => {
      await http.post("/auth/request-code", { phone: PHONE });
      vi.spyOn(devProvider, "check").mockResolvedValueOnce("expired");
      expect((await http.post("/auth/verify-code", { phone: PHONE, code: "000000" })).body.code).toBe("CODE_EXPIRED");
      vi.spyOn(devProvider, "check").mockResolvedValueOnce("too_many_attempts");
      expect((await http.post("/auth/verify-code", { phone: PHONE, code: "000000" })).body.code).toBe("TOO_MANY_ATTEMPTS");
    });
  });

  describe("sesión y /me", () => {
    it("sin token, con token falso o mal formado: 401 INVALID_SESSION", async () => {
      for (const headers of [{}, { authorization: "Bearer nada" }, { authorization: "Basic abc" }]) {
        const res = await http.get("/me", headers);
        expect(res.status).toBe(401);
        expect(res.body.code).toBe("INVALID_SESSION");
      }
    });

    it("GET y PATCH /me trabajan sobre el usuario de la sesión", async () => {
      const { authHeader, user } = await loginAs(app, PHONE);
      expect((await http.get("/me", authHeader)).body.id).toBe(user.id);

      const patched = await http.patch("/me", { name: "Juan Pérez" }, authHeader);
      expect(patched.status).toBe(200);
      expect(patched.body.name).toBe("Juan Pérez");
      expect((await http.get("/me", authHeader)).body.name).toBe("Juan Pérez");
    });

    it("logout deja de servir el token al instante", async () => {
      const { authHeader } = await loginAs(app, PHONE);
      expect((await http.post("/auth/logout", undefined, authHeader)).status).toBe(204);
      const res = await http.get("/me", authHeader);
      expect(res.status).toBe(401);
      expect(res.body.code).toBe("INVALID_SESSION");
    });

    it("una sesión vencida no sirve", async () => {
      const { authHeader } = await loginAs(app, PHONE);
      await db.session.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await http.get("/me", authHeader)).status).toBe(401);
    });

    it("usar la sesión la renueva (a lo sumo una vez por hora)", async () => {
      const { authHeader } = await loginAs(app, PHONE);
      await db.session.updateMany({
        data: {
          lastUsedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          expiresAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
        },
      });
      expect((await http.get("/me", authHeader)).status).toBe(200);
      const session = await db.session.findFirstOrThrow();
      expect(session.expiresAt.getTime()).toBeGreaterThan(Date.now() + 50 * 24 * 60 * 60 * 1000);
    });

    it("dos sesiones de la misma persona son independientes", async () => {
      const first = await loginAs(app, PHONE);
      const second = await loginAs(app, PHONE);
      await http.post("/auth/logout", undefined, first.authHeader);
      expect((await http.get("/me", first.authHeader)).status).toBe(401);
      expect((await http.get("/me", second.authHeader)).status).toBe(200);
    });
  });

  describe("GET /me/balances", () => {
    it("trae solo los saldos de la persona, también con saldo 0, y solo el perfil público del comercio", async () => {
      const cafe = await seedMerchant(app, "Café");
      const barber = await seedMerchant(app, "Barbería");

      const mine = await seedCustomer(app, cafe, PHONE, "Juancito");
      await seedCustomer(app, barber, PHONE); // ficha con saldo 0
      const other = await seedCustomer(app, cafe, "098765432", "Otra persona");

      await http.post(`/customers/${mine.id}/topups`, { amount: 1000 });
      await http.post(`/customers/${other.id}/topups`, { amount: 5000 });

      const { authHeader } = await loginAs(app, PHONE);
      const res = await http.get("/me/balances", authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2);

      const byName = Object.fromEntries(res.body.data.map((row: any) => [row.merchant.name, row]));
      expect(byName["Café"].balance).toBe(100000);
      expect(byName["Barbería"].balance).toBe(0);

      // Del comercio solo sale el perfil público mínimo.
      expect(Object.keys(byName["Café"].merchant).sort()).toEqual(["category", "id", "name", "photoUrl"]);
      // Nada de la otra persona.
      expect(res.raw).not.toContain("Otra persona");
      expect(res.raw).not.toContain("+59898765432");
    });

    it("sin sesión da 401", async () => {
      expect((await http.get("/me/balances")).status).toBe(401);
    });
  });
});
