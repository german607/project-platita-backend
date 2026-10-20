import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { api, createTestApp, resetDb, seedMerchant } from "./helpers.js";

const WEEK = {
  mon: [{ from: "09:00", to: "13:00" }, { from: "16:00", to: "20:00" }],
  tue: [{ from: "09:00", to: "20:00" }],
  sun: [],
};

describe("perfil público, locales y lugares", () => {
  let app: FastifyInstance;
  let http: ReturnType<typeof api>;
  let merchantId: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = api(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
    merchantId = await seedMerchant(app, "Café de la Esquina");
  });

  const addLocation = (address = "Av. Brasil 2500, Pocitos", label = "Pocitos") =>
    http.post(`/merchants/${merchantId}/locations`, { label, address });

  async function makeVisible() {
    await addLocation();
    return http.patch(`/merchants/${merchantId}`, { category: "CAFETERIA", visible: true });
  }

  describe("visibilidad", () => {
    it("un comercio nuevo no es visible y trae los 7 días de horarios cerrados", async () => {
      const res = await http.get(`/merchants/${merchantId}`);
      expect(res.body.visible).toBe(false);
      expect(res.body.category).toBeNull();
      expect(Object.keys(res.body.openingHours)).toEqual(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]);
      expect(res.body.openingHours.mon).toEqual([]);
    });

    it("no se puede aparecer sin local ni categoría (PROFILE_INCOMPLETE)", async () => {
      const res = await http.patch(`/merchants/${merchantId}`, { visible: true });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("PROFILE_INCOMPLETE");
      expect(res.body.details.missing).toEqual(["location", "category"]);
    });

    it("con un local falta solo la categoría, y se puede mandar junto con visible", async () => {
      await addLocation();
      const missing = await http.patch(`/merchants/${merchantId}`, { visible: true });
      expect(missing.body.details.missing).toEqual(["category"]);

      const ok = await http.patch(`/merchants/${merchantId}`, { category: "CAFETERIA", visible: true });
      expect(ok.status).toBe(200);
      expect(ok.body.visible).toBe(true);
    });

    it("no se puede dar de baja el único local activo mientras es visible", async () => {
      const location = (await addLocation()).body;
      await http.patch(`/merchants/${merchantId}`, { category: "CAFETERIA", visible: true });

      const res = await http.patch(`/locations/${location.id}`, { active: false });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("LOCATION_REQUIRED_WHILE_VISIBLE");

      // Con otro local activo sí se puede.
      await addLocation("Av. 18 de Julio 1000", "Centro");
      expect((await http.patch(`/locations/${location.id}`, { active: false })).status).toBe(200);
    });
  });

  describe("categoría", () => {
    it("la primera vez es libre; cambiarla antes de 90 días da CATEGORY_CHANGE_TOO_SOON", async () => {
      expect((await http.patch(`/merchants/${merchantId}`, { category: "CAFETERIA" })).status).toBe(200);

      const res = await http.patch(`/merchants/${merchantId}`, { category: "PANADERIA" });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("CATEGORY_CHANGE_TOO_SOON");
      const days = (new Date(res.body.details.availableAt).getTime() - Date.now()) / 86_400_000;
      expect(days).toBeGreaterThan(89);
      expect(days).toBeLessThanOrEqual(90);
    });

    it("elegir la misma categoría no cuenta como cambio", async () => {
      await http.patch(`/merchants/${merchantId}`, { category: "CAFETERIA" });
      expect((await http.patch(`/merchants/${merchantId}`, { category: "CAFETERIA" })).status).toBe(200);
    });

    it("pasados los 90 días se puede cambiar", async () => {
      await http.patch(`/merchants/${merchantId}`, { category: "CAFETERIA" });
      const { db } = await import("../src/lib/db.js");
      await db.merchant.update({
        where: { id: merchantId },
        data: { categoryChangedAt: new Date(Date.now() - 91 * 86_400_000) },
      });
      const res = await http.patch(`/merchants/${merchantId}`, { category: "PANADERIA" });
      expect(res.status).toBe(200);
      expect(res.body.category).toBe("PANADERIA");
    });
  });

  describe("horarios", () => {
    it("se guardan ordenados y el GET devuelve siempre los 7 días", async () => {
      const res = await http.patch(`/merchants/${merchantId}`, {
        openingHours: { ...WEEK, mon: [{ from: "16:00", to: "20:00" }, { from: "09:00", to: "13:00" }] },
      });
      expect(res.status).toBe(200);
      expect(res.body.openingHours.mon).toEqual(WEEK.mon);
      expect(res.body.openingHours.wed).toEqual([]);
    });

    it("rechaza tramos superpuestos, invertidos o con hora inválida", async () => {
      for (const mon of [
        [{ from: "09:00", to: "13:00" }, { from: "12:00", to: "15:00" }],
        [{ from: "13:00", to: "09:00" }],
        [{ from: "25:00", to: "26:00" }],
      ]) {
        const res = await http.patch(`/merchants/${merchantId}`, { openingHours: { mon } });
        expect(res.status).toBe(400);
        expect(res.body.code).toBe("VALIDATION_ERROR");
      }
    });

    it("dos tramos pegados (uno termina donde empieza el otro) son válidos", async () => {
      const res = await http.patch(`/merchants/${merchantId}`, {
        openingHours: { mon: [{ from: "09:00", to: "13:00" }, { from: "13:00", to: "17:00" }] },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /places", () => {
    it("un comercio oculto no aparece ni en la lista ni en el detalle (mismo 404)", async () => {
      expect((await http.get("/places")).body.data).toEqual([]);
      const hidden = await http.get(`/places/${merchantId}`);
      const missing = await http.get("/places/no-existe");
      expect(hidden.status).toBe(404);
      expect(hidden.body).toEqual(missing.body);
    });

    it("un comercio visible aparece con sus locales activos y hasActivePromo", async () => {
      await makeVisible();
      await http.post(`/merchants/${merchantId}/locations`, { address: "Local dado de baja" }).then(async (r) => {
        await http.patch(`/locations/${r.body.id}`, { active: false });
      });

      const list = await http.get("/places");
      expect(list.body.nextCursor).toBeNull();
      expect(list.body.data).toHaveLength(1);
      expect(list.body.data[0]).toEqual({
        id: merchantId,
        name: "Café de la Esquina",
        category: "CAFETERIA",
        photoUrl: null,
        locations: [{ label: "Pocitos", address: "Av. Brasil 2500, Pocitos" }],
        hasActivePromo: false,
      });

      await http.post(`/merchants/${merchantId}/bonus-rules`, { minTopUp: 1000, bonusAmount: 200 });
      expect((await http.get("/places")).body.data[0].hasActivePromo).toBe(true);
    });

    it("filtra por categoría y por nombre", async () => {
      await makeVisible();
      expect((await http.get("/places?category=CAFETERIA")).body.data).toHaveLength(1);
      expect((await http.get("/places?category=PANADERIA")).body.data).toHaveLength(0);
      expect((await http.get("/places?search=esquina")).body.data).toHaveLength(1);
      expect((await http.get("/places?search=zzz")).body.data).toHaveLength(0);
    });

    it("el detalle trae horarios, locales y solo las promos activas, sin datos privados", async () => {
      await http.patch(`/merchants/${merchantId}`, {
        phone: "099000111",
        description: "Café de especialidad.",
        openingHours: WEEK,
      });
      await makeVisible();
      await http.post(`/merchants/${merchantId}/bonus-rules`, { minTopUp: 1000, bonusAmount: 200, name: "Promo 1000" });
      const off = await http.post(`/merchants/${merchantId}/bonus-rules`, { minTopUp: 500, bonusAmount: 50 });
      await http.patch(`/bonus-rules/${off.body.id}`, { active: false });

      const res = await http.get(`/places/${merchantId}`);
      expect(res.status).toBe(200);
      expect(res.body.description).toBe("Café de especialidad.");
      expect(res.body.openingHours.mon).toEqual(WEEK.mon);
      expect(res.body.openingHours.sat).toEqual([]);
      expect(res.body.promos).toEqual([
        { id: expect.any(String), name: "Promo 1000", description: null, minTopUp: 100000, bonusAmount: 20000 },
      ]);
      // Nada privado del comercio.
      expect(res.raw).not.toContain("099000111");
      expect(res.body).not.toHaveProperty("phone");
      expect(res.body).not.toHaveProperty("plan");
      expect(res.body).not.toHaveProperty("visible");
    });
  });
});
