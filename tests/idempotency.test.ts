import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "../src/lib/db.js";
import { api, createTestApp, resetDb, seedCustomer, seedMerchant } from "./helpers.js";

describe("idempotencia de cargas, cobros y ajustes", () => {
  let app: FastifyInstance;
  let http: ReturnType<typeof api>;
  let customerId: string;

  beforeAll(async () => {
    app = await createTestApp();
    http = api(app);
  });
  afterAll(async () => {
    await app.close();
  });
  beforeEach(async () => {
    await resetDb();
    const merchantId = await seedMerchant(app);
    customerId = (await seedCustomer(app, merchantId, "099123456")).id;
  });

  const movements = () => db.transaction.count({ where: { customerId } });

  it("la misma clave y el mismo cuerpo devuelve la misma respuesta y no registra de nuevo", async () => {
    const key = { "idempotency-key": "carga-001" };
    const first = await http.post(`/customers/${customerId}/topups`, { amount: 1000 }, key);
    const second = await http.post(`/customers/${customerId}/topups`, { amount: 1000 }, key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.headers["idempotent-replayed"]).toBe("true");
    expect(first.headers["idempotent-replayed"]).toBeUndefined();
    expect(second.body).toEqual(first.body);
    expect(second.body.balance).toBe(100000);
    expect(await movements()).toBe(1);
  });

  it("la misma clave con otro cuerpo da 422 IDEMPOTENCY_KEY_REUSED", async () => {
    const key = { "idempotency-key": "carga-002" };
    await http.post(`/customers/${customerId}/topups`, { amount: 1000 }, key);
    const res = await http.post(`/customers/${customerId}/topups`, { amount: 2000 }, key);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
    expect(await movements()).toBe(1);
  });

  it("la misma clave en otra operación también se rechaza", async () => {
    const key = { "idempotency-key": "clave-compartida" };
    await http.post(`/customers/${customerId}/topups`, { amount: 1000 }, key);
    const res = await http.post(`/customers/${customerId}/charges`, { amount: 1000 }, key);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("IDEMPOTENCY_KEY_REUSED");
  });

  it("sin clave todo funciona como antes: dos pedidos, dos movimientos", async () => {
    await http.post(`/customers/${customerId}/topups`, { amount: 1000 });
    await http.post(`/customers/${customerId}/topups`, { amount: 1000 });
    expect(await movements()).toBe(2);
  });

  it("un error no se guarda: reintentar con la misma clave vuelve a evaluar", async () => {
    const key = { "idempotency-key": "cobro-001" };
    const rejected = await http.post(`/customers/${customerId}/charges`, { amount: 400 }, key);
    expect(rejected.status).toBe(422);
    expect(rejected.body.code).toBe("INSUFFICIENT_BALANCE");

    await http.post(`/customers/${customerId}/topups`, { amount: 1000 });
    const retried = await http.post(`/customers/${customerId}/charges`, { amount: 400 }, key);
    expect(retried.status).toBe(201);
    expect(retried.body.balance).toBe(60000);
  });

  it("dos pedidos simultáneos con la misma clave registran un solo movimiento", async () => {
    const key = { "idempotency-key": "carga-simultanea" };
    const results = await Promise.all([
      http.post(`/customers/${customerId}/topups`, { amount: 1000 }, key),
      http.post(`/customers/${customerId}/topups`, { amount: 1000 }, key),
    ]);
    expect(results.map((r) => r.status)).toEqual([201, 201]);
    expect(await movements()).toBe(1);
  });

  it("dos cobros simultáneos no gastan dos veces el mismo saldo", async () => {
    await http.post(`/customers/${customerId}/topups`, { amount: 500 });
    const results = await Promise.all([
      http.post(`/customers/${customerId}/charges`, { amount: 400 }),
      http.post(`/customers/${customerId}/charges`, { amount: 400 }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([201, 422]);
    const balance = await http.get(`/customers/${customerId}/balance`);
    expect(balance.body.balance).toBe(10000);
  });
});
