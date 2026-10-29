import type { FastifyInstance, FastifyRequest } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/lib/db.js";
import { authorizeMerchantAccess } from "../src/modules/auth/access.js";
import { api, createTestApp, loginAs, resetDb, seedCustomer, seedMerchant } from "./helpers.js";

// Todo lo del comercio sale de la sesión y exige ser la dueña del comercio.

type Client = ReturnType<typeof api>;
const call = (http: Client, method: "GET" | "POST" | "PATCH", url: string, body?: unknown) =>
  method === "GET" ? http.get(url) : method === "POST" ? http.post(url, body) : http.patch(url, body);

describe("dueños de comercio y permisos", () => {
  let app: FastifyInstance;
  let anon: ReturnType<typeof api>;
  let alice: Awaited<ReturnType<typeof loginAs>>; // dueña del comercio de los tests
  let bob: Awaited<ReturnType<typeof loginAs>>; // otra persona, con sesión
  let aliceHttp: ReturnType<typeof api>;
  let bobHttp: ReturnType<typeof api>;

  // Lo que crea Alice y Bob no debería poder tocar.
  let merchantId: string;
  let customerId: string;
  let ruleId: string;
  let locationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    anon = api(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
    alice = await loginAs(app, "098000111");
    bob = await loginAs(app, "098000222");
    aliceHttp = api(app, alice.authHeader);
    bobHttp = api(app, bob.authHeader);

    merchantId = await seedMerchant(app, "Café de Alice", alice.authHeader);
    customerId = (await seedCustomer(app, merchantId, "099123456", "Juancito", alice.authHeader)).id;
    ruleId = (await aliceHttp.post(`/merchants/${merchantId}/bonus-rules`, { minTopUp: 1000, bonusAmount: 200 })).body.id;
    locationId = (await aliceHttp.post(`/merchants/${merchantId}/locations`, { address: "Av. Brasil 2500" })).body.id;
  });

  // Todas las rutas protegidas, con ids de verdad cuando hacen falta.
  const protectedRoutes = () => [
    ["GET", "/merchants"],
    ["POST", "/merchants", { name: "Otro" }],
    ["GET", `/merchants/${merchantId}`],
    ["PATCH", `/merchants/${merchantId}`, { name: "Cambiado" }],
    ["GET", `/merchants/${merchantId}/locations`],
    ["POST", `/merchants/${merchantId}/locations`, { address: "Otra dirección" }],
    ["PATCH", `/locations/${locationId}`, { address: "Cambiada" }],
    ["GET", `/merchants/${merchantId}/bonus-rules`],
    ["POST", `/merchants/${merchantId}/bonus-rules`, { minTopUp: 500, bonusAmount: 50 }],
    ["PATCH", `/bonus-rules/${ruleId}`, { active: false }],
    ["GET", `/merchants/${merchantId}/bonus-preview?amount=1000`],
    ["GET", `/merchants/${merchantId}/customers`],
    ["POST", `/merchants/${merchantId}/customers`, { phone: "098765432" }],
    ["GET", `/merchants/${merchantId}/inactive`],
    ["GET", `/merchants/${merchantId}/transactions`],
    ["GET", `/customers/${customerId}`],
    ["PATCH", `/customers/${customerId}`, { name: "Cambiado" }],
    ["GET", `/customers/${customerId}/balance`],
    ["GET", `/customers/${customerId}/transactions`],
    ["POST", `/customers/${customerId}/topups`, { amount: 1000 }],
    ["POST", `/customers/${customerId}/charges`, { amount: 100 }],
    ["POST", `/customers/${customerId}/adjustments`, { amount: 100, note: "x" }],
  ] as [("GET" | "POST" | "PATCH"), string, unknown?][];

  describe("sin sesión", () => {
    it("todo lo del comercio da 401 INVALID_SESSION, existan o no los ids", async () => {
      for (const [method, url, body] of protectedRoutes()) {
        const res = await call(anon, method, url, body);
        expect(res.status, `${method} ${url}`).toBe(401);
        expect(res.body.code).toBe("INVALID_SESSION");
      }
    });

    it("con un token falso también", async () => {
      const res = await api(app, { authorization: "Bearer inventado" }).get(`/merchants/${merchantId}`);
      expect(res.status).toBe(401);
    });
  });

  describe("crear y listar comercios", () => {
    it("crear un comercio con sesión deja a la persona como dueña", async () => {
      const created = await bobHttp.post("/merchants", { name: "Barbería de Bob" });
      expect(created.status).toBe(201);
      expect(created.body.ownerId).toBe(bob.user.id);

      const me = await bobHttp.get("/me");
      expect(me.body.user.id).toBe(bob.user.id);
      expect(me.body.merchants).toEqual([{ id: created.body.id, name: "Barbería de Bob" }]);
    });

    it("GET /me lista las cuentas de comercio de la sesión (una persona puede tener varias)", async () => {
      await aliceHttp.post("/merchants", { name: "Segundo local de Alice" });
      const me = await aliceHttp.get("/me");
      expect(me.body.merchants.map((m: any) => m.name)).toEqual(["Café de Alice", "Segundo local de Alice"]);
      expect((await bobHttp.get("/me")).body.merchants).toEqual([]);
    });

    it("GET /merchants lista solo los comercios propios", async () => {
      await bobHttp.post("/merchants", { name: "Barbería de Bob" });
      const mine = await aliceHttp.get("/merchants");
      expect(mine.body.data.map((m: any) => m.name)).toEqual(["Café de Alice"]);
      expect(mine.body.nextCursor).toBeNull();
      expect((await bobHttp.get("/merchants")).body.data.map((m: any) => m.name)).toEqual(["Barbería de Bob"]);
    });
  });

  describe("la dueña", () => {
    it("opera su comercio con normalidad", async () => {
      expect((await aliceHttp.get(`/merchants/${merchantId}`)).body.name).toBe("Café de Alice");
      expect((await aliceHttp.patch(`/merchants/${merchantId}`, { name: "Café nuevo" })).status).toBe(200);
      const topup = await aliceHttp.post(`/customers/${customerId}/topups`, { amount: 1000 });
      expect(topup.status).toBe(201);
      expect((await aliceHttp.get(`/customers/${customerId}/balance`)).body.balance).toBe(120000);
    });
  });

  describe("una persona que no es la dueña", () => {
    it("recibe 403 FORBIDDEN en todas las rutas del comercio ajeno", async () => {
      for (const [method, url, body] of protectedRoutes()) {
        // Crear un comercio y listar los propios no apuntan a uno ajeno.
        if (url === "/merchants") continue;
        const res = await call(bobHttp, method, url, body);
        expect(res.status, `${method} ${url}`).toBe(403);
        expect(res.body.code).toBe("FORBIDDEN");
      }
    });

    it("y no cambia nada del comercio ajeno", async () => {
      await bobHttp.post(`/customers/${customerId}/topups`, { amount: 1000 });
      await bobHttp.patch(`/merchants/${merchantId}`, { name: "Hackeado" });
      await bobHttp.patch(`/bonus-rules/${ruleId}`, { active: false });

      expect((await aliceHttp.get(`/customers/${customerId}/balance`)).body.balance).toBe(0);
      expect((await aliceHttp.get(`/merchants/${merchantId}`)).body.name).toBe("Café de Alice");
      expect((await aliceHttp.get(`/merchants/${merchantId}/bonus-rules`)).body.data[0].active).toBe(true);
    });

    it("no ve datos del comercio ajeno en el 403", async () => {
      const res = await bobHttp.get(`/customers/${customerId}`);
      expect(res.raw).not.toContain("Juancito");
      expect(res.raw).not.toContain("+59899123456");
    });
  });

  describe("recursos que no existen", () => {
    it("dan 404 y no 403", async () => {
      for (const url of ["/merchants/no-existe", "/customers/no-existe", "/merchants/no-existe/locations"]) {
        const res = await aliceHttp.get(url);
        expect(res.status, url).toBe(404);
        expect(res.body.code).toBe("NOT_FOUND");
      }
      expect((await aliceHttp.patch("/bonus-rules/no-existe", { active: false })).status).toBe(404);
      expect((await aliceHttp.patch("/locations/no-existe", { address: "x" })).status).toBe(404);
    });
  });

  describe("comercios sin dueño y reasignación", () => {
    it("un comercio sin dueño no es de nadie: 403 para todos", async () => {
      const orphan = await db.merchant.create({ data: { name: "Comercio viejo" } });
      expect((await aliceHttp.get(`/merchants/${orphan.id}`)).status).toBe(403);
      expect((await bobHttp.get(`/merchants/${orphan.id}`)).status).toBe(403);
    });

    it("al asignarle un dueño, solo esa persona lo opera", async () => {
      const orphan = await db.merchant.create({ data: { name: "Comercio viejo" } });
      await db.merchant.update({ where: { id: orphan.id }, data: { ownerId: bob.user.id } });

      expect((await bobHttp.get(`/merchants/${orphan.id}`)).status).toBe(200);
      expect((await aliceHttp.get(`/merchants/${orphan.id}`)).status).toBe(403);
      expect((await bobHttp.get("/me")).body.merchants.map((m: any) => m.name)).toContain("Comercio viejo");
    });
  });

  describe("lo público sigue público", () => {
    it("/places se ve sin sesión y por cualquiera, aunque el comercio sea de otra persona", async () => {
      await aliceHttp.patch(`/merchants/${merchantId}`, { category: "CAFETERIA", visible: true });

      const anonymous = await anon.get("/places");
      expect(anonymous.status).toBe(200);
      expect(anonymous.body.data).toHaveLength(1);
      expect((await bobHttp.get(`/places/${merchantId}`)).status).toBe(200);
      // El perfil público no trae al dueño ni nada privado.
      expect(anonymous.raw).not.toContain("ownerId");
      expect(anonymous.raw).not.toContain(alice.user.id);
    });
  });

  describe("CORS", () => {
    it("el preflight del navegador (que no lleva sesión) se contesta sin pedir sesión", async () => {
      const res = await app.inject({
        method: "OPTIONS",
        url: "/merchants",
        headers: {
          origin: "http://localhost:5173",
          "access-control-request-method": "POST",
          "access-control-request-headers": "authorization,content-type",
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
      expect(String(res.headers["access-control-allow-headers"]).toLowerCase()).toContain("authorization");
    });
  });

  describe("falla cerrado", () => {
    it("una ruta protegida sin regla de acceso se rechaza en vez de dejar pasar", async () => {
      const req = {
        auth: { userId: alice.user.id, sessionId: "s" },
        params: {},
        method: "GET",
        routeOptions: { url: "/ruta-nueva-sin-regla" },
      } as unknown as FastifyRequest;
      await expect(authorizeMerchantAccess(req)).rejects.toThrow(/sin regla de acceso/);
    });
  });
});
