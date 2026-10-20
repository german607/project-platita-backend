import type { FastifyInstance } from "fastify";
import { buildApp } from "../src/app.js";
import { db } from "../src/lib/db.js";
import { assertSafeTestDatabase } from "./test-env.js";

export async function createTestApp(): Promise<FastifyInstance> {
  assertSafeTestDatabase(process.env.DATABASE_URL ?? "");
  const app = await buildApp();
  await app.ready();
  return app;
}

// Vacía todas las tablas (la base de tests es descartable).
export async function resetDb() {
  await db.$executeRawUnsafe(
    `TRUNCATE "IdempotencyKey", "Transaction", "BonusRule", "Location", "Customer", "Session", "OtpRequest", "OtpChallenge", "User", "Merchant" RESTART IDENTITY CASCADE`,
  );
}

// Los límites de pedidos de código se miden contra OtpRequest: para pedir
// varios códigos seguidos en un test se limpia.
export async function clearOtpLimits() {
  await db.otpRequest.deleteMany();
}

type Json = Record<string, any>;

// Atajos para llamar a la API sin levantar el puerto.
export function api(app: FastifyInstance) {
  const call = async (method: "GET" | "POST" | "PATCH", url: string, body?: unknown, headers: Record<string, string> = {}) => {
    const res = await app.inject({ method, url, payload: body as any, headers });
    const text = res.body;
    return { status: res.statusCode, headers: res.headers, body: (text ? JSON.parse(text) : null) as Json, raw: text };
  };
  return {
    get: (url: string, headers?: Record<string, string>) => call("GET", url, undefined, headers),
    post: (url: string, body?: unknown, headers?: Record<string, string>) => call("POST", url, body, headers),
    patch: (url: string, body?: unknown, headers?: Record<string, string>) => call("PATCH", url, body, headers),
  };
}

// Entra como esa persona con el proveedor de prueba y devuelve el token.
export async function loginAs(app: FastifyInstance, phone: string) {
  const http = api(app);
  await clearOtpLimits();
  const requested = await http.post("/auth/request-code", { phone });
  if (requested.status !== 204) throw new Error(`request-code falló: ${requested.raw}`);
  const verified = await http.post("/auth/verify-code", { phone, code: "000000" });
  if (verified.status !== 200) throw new Error(`verify-code falló: ${verified.raw}`);
  return { token: verified.body.token as string, user: verified.body.user as Json, authHeader: { authorization: `Bearer ${verified.body.token}` } };
}

// Un comercio nuevo; devuelve su id.
export async function seedMerchant(app: FastifyInstance, name = "Café de la Esquina") {
  const res = await api(app).post("/merchants", { name });
  if (res.status !== 201) throw new Error(`crear comercio falló: ${res.raw}`);
  return res.body.id as string;
}

// La ficha de una persona en un comercio (busca o crea).
export async function seedCustomer(app: FastifyInstance, merchantId: string, phone: string, name?: string) {
  const res = await api(app).post(`/merchants/${merchantId}/customers`, { phone, name });
  if (res.status !== 200) throw new Error(`crear cliente falló: ${res.raw}`);
  return res.body;
}
