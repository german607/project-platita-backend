import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getBalances, db } from "../src/lib/db.js";
import { describeSeed, PEOPLE, seedDevelopmentData } from "../scripts/lib/seed.js";
import { api, createTestApp, loginAs, resetDb } from "./helpers.js";

// El seed de desarrollo se prueba como cualquier otra cosa: si se rompe, el
// frontend se queda sin datos para probar.

describe("seed de desarrollo", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
  });

  const counts = async () => ({
    users: await db.user.count(),
    merchants: await db.merchant.count(),
    locations: await db.location.count(),
    rules: await db.bonusRule.count(),
    customers: await db.customer.count(),
    transactions: await db.transaction.count(),
  });

  it("carga 5 comercios visibles en categorías distintas, con locales, horarios y promos con nombre", async () => {
    await seedDevelopmentData(db);
    const merchants = await db.merchant.findMany({ include: { locations: true, bonuses: true } });

    expect(merchants).toHaveLength(5);
    expect(new Set(merchants.map((m) => m.category)).size).toBe(5);
    for (const m of merchants) {
      expect(m.visible).toBe(true);
      expect(m.description).toBeTruthy();
      expect(m.photoUrl).toMatch(/^https:\/\//);
      expect(m.openingHours).not.toBeNull();
      expect(m.locations.length).toBeGreaterThanOrEqual(1);
      expect(m.bonuses.length).toBeGreaterThanOrEqual(1);
      expect(m.bonuses.every((rule) => rule.name && rule.description)).toBe(true);
    }
    expect(merchants.some((m) => m.locations.length === 2)).toBe(true);

    const places = await api(app).get("/places");
    expect(places.body.data).toHaveLength(5);
  });

  it("se puede repetir sin duplicar nada", async () => {
    await seedDevelopmentData(db);
    const first = await counts();
    await seedDevelopmentData(db);
    await seedDevelopmentData(db);
    expect(await counts()).toEqual(first);
  });

  it("respeta lo que ya había en la base que no es del seed", async () => {
    const mine = await db.merchant.create({ data: { name: "Mi comercio de prueba" } });
    await seedDevelopmentData(db);
    await seedDevelopmentData(db);
    expect(await db.merchant.findUnique({ where: { id: mine.id } })).not.toBeNull();
  });

  it("ningún saldo queda negativo y el saldo de cada ficha coincide con el resumen", async () => {
    const summary = await seedDevelopmentData(db);
    const customers = await db.customer.findMany({ include: { merchant: true } });
    const balances = await getBalances(customers.map((c) => c.id));

    for (const customer of customers) {
      const expected = summary.customers.find((s) => s.merchant === customer.merchant.name && s.phone === customer.phone);
      expect(expected, `${customer.merchant.name} ${customer.phone}`).toBeDefined();
      expect(balances.get(customer.id) ?? 0).toBe(expected!.balance);
      expect(expected!.balance).toBeGreaterThanOrEqual(0);
    }
  });

  it("incluye los casos para probar: saldo 0, inactivos, saldo en varios comercios y nombres distintos", async () => {
    const summary = await seedDevelopmentData(db);

    expect(summary.customers.some((c) => c.balance === 0)).toBe(true);
    expect(summary.customers.some((c) => c.balance === 0 && c.daysSinceVisit <= 30)).toBe(true); // saldo 0 pero activo
    expect(summary.customers.filter((c) => c.daysSinceVisit > 30).length).toBeGreaterThanOrEqual(3);
    expect(summary.customers.some((c) => c.balance > 0 && c.daysSinceVisit > 30)).toBe(true); // inactivo con saldo

    const merchantsByPhone = new Map<string, Set<string>>();
    for (const c of summary.customers) {
      merchantsByPhone.set(c.phone, (merchantsByPhone.get(c.phone) ?? new Set()).add(c.merchant));
    }
    expect([...merchantsByPhone.values()].some((merchants) => merchants.size > 1)).toBe(true);
    expect(summary.customers.some((c) => c.userName && c.userName !== c.label)).toBe(true); // "Juanito (Juan Pérez)"
    expect(summary.customers.some((c) => !c.userName)).toBe(true); // una persona sin nombre propio

    // Con movimientos de los tres tipos que se cargan por la API, en fechas distintas.
    const types = new Set((await db.transaction.findMany({ select: { type: true } })).map((t) => t.type));
    expect(types).toEqual(new Set(["TOPUP", "BONUS", "CHARGE"]));
    const days = new Set((await db.transaction.findMany({ select: { createdAt: true } })).map((t) => t.createdAt.toDateString()));
    expect(days.size).toBeGreaterThan(10);
  });

  it("los bonos del seed salen de las promos de su comercio", async () => {
    await seedDevelopmentData(db);
    const bonuses = await db.transaction.findMany({
      where: { type: "BONUS" },
      include: { bonusRule: true, customer: true },
    });
    expect(bonuses.length).toBeGreaterThan(0);
    for (const bonus of bonuses) {
      expect(bonus.bonusRule?.merchantId).toBe(bonus.customer.merchantId);
      expect(bonus.amount).toBe(bonus.bonusRule!.bonusAmount);
    }
  });

  describe("quién entra a qué cuenta (con el código 000000)", () => {
    it("Ana es dueña de dos comercios y Carla de tres; Beto es solo cliente", async () => {
      await seedDevelopmentData(db);

      const ana = await loginAs(app, PEOPLE.ana.phone);
      const anaMe = await api(app, ana.authHeader).get("/me");
      expect(anaMe.body.merchants.map((m: any) => m.name)).toEqual(["Café de la Esquina", "Barbería Don Pablo"]);

      const carla = await loginAs(app, PEOPLE.carla.phone);
      expect((await api(app, carla.authHeader).get("/me")).body.merchants).toHaveLength(3);

      const beto = await loginAs(app, PEOPLE.beto.phone);
      const betoHttp = api(app, beto.authHeader);
      expect((await betoHttp.get("/me")).body.merchants).toEqual([]);

      // Beto tiene saldo en varios comercios, también uno en 0.
      const balances = await betoHttp.get("/me/balances");
      expect(balances.body.data).toHaveLength(3);
      expect(balances.body.data.some((b: any) => b.balance === 0)).toBe(true);
    });

    it("la dueña opera sus comercios y no los de otra", async () => {
      await seedDevelopmentData(db);
      const ana = await loginAs(app, PEOPLE.ana.phone);
      const anaHttp = api(app, ana.authHeader);

      expect((await anaHttp.get("/merchants/seed_cafe/customers")).body.data).toHaveLength(5);
      expect((await anaHttp.get("/merchants/seed_panaderia/customers")).status).toBe(403);
      expect((await anaHttp.get("/merchants/seed_cafe/inactive?days=30")).body.data.length).toBeGreaterThanOrEqual(2);
    });
  });

  it("imprime qué teléfono entra a qué cuenta", async () => {
    const text = describeSeed(await seedDevelopmentData(db));
    expect(text).toContain("+59899000001");
    expect(text).toContain("Café de la Esquina");
    expect(text).toContain("000000");
    expect(text).toContain("INACTIVO");
  });
});
