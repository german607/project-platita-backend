import type { FastifyRequest } from "fastify";
import { db } from "../../lib/db.js";
import { AppError, notFound } from "../../lib/errors.js";
import { authOf } from "./guard.js";

// Permisos del comercio: todo lo de /merchants, /customers, /bonus-rules y
// /locations sale de la sesión y exige que la persona sea la DUEÑA del
// comercio al que apunta el pedido. Se aplica como un hook (ver
// modules/index.ts), así ningún servicio sabe de permisos.
//
// - Sin sesión o con una sesión inválida: 401 INVALID_SESSION (lo resuelve
//   `requireSession`, que corre antes).
// - Con un comercio ajeno: 403 FORBIDDEN.
// - Si el comercio (o el cliente, la regla o el local) no existe: 404.
// - Un comercio sin dueño (anterior a esta función y todavía sin asignar) no es
//   de nadie: da 403 para todos.
//
// Es CERRADO por defecto: una ruta protegida cuyo patrón no figura acá falla
// con 500 en vez de dejar pasar a cualquiera. Al agregar una ruta nueva en
// estos módulos hay que sumarle su regla.

export const forbidden = () => new AppError(403, "FORBIDDEN", "Este comercio no es tuyo");

async function ownerOfMerchant(id: string) {
  const merchant = await db.merchant.findUnique({ where: { id }, select: { ownerId: true } });
  if (!merchant) throw notFound("Comercio");
  return merchant.ownerId;
}

async function ownerOfCustomer(id: string) {
  const customer = await db.customer.findUnique({ where: { id }, select: { merchant: { select: { ownerId: true } } } });
  if (!customer) throw notFound("Cliente");
  return customer.merchant.ownerId;
}

async function ownerOfBonusRule(id: string) {
  const rule = await db.bonusRule.findUnique({ where: { id }, select: { merchant: { select: { ownerId: true } } } });
  if (!rule) throw notFound("Regla de bonificación");
  return rule.merchant.ownerId;
}

async function ownerOfLocation(id: string) {
  const location = await db.location.findUnique({ where: { id }, select: { merchant: { select: { ownerId: true } } } });
  if (!location) throw notFound("Local");
  return location.merchant.ownerId;
}

export async function authorizeMerchantAccess(req: FastifyRequest) {
  const { userId } = authOf(req);
  const params = (req.params ?? {}) as Record<string, string | undefined>;
  const pattern = req.routeOptions.url ?? "";

  // Crear un comercio y listar los propios no apuntan a un comercio: alcanza
  // con la sesión (el servicio usa el usuario de la sesión).
  if (pattern === "/merchants") return;

  let ownerId: string | null;
  if (params.merchantId) {
    ownerId = await ownerOfMerchant(params.merchantId); // /merchants/:merchantId/…
  } else if (pattern.startsWith("/merchants/:id") && params.id) {
    ownerId = await ownerOfMerchant(params.id);
  } else if (pattern.startsWith("/customers/:id") && params.id) {
    ownerId = await ownerOfCustomer(params.id);
  } else if (pattern.startsWith("/bonus-rules/:id") && params.id) {
    ownerId = await ownerOfBonusRule(params.id);
  } else if (pattern.startsWith("/locations/:id") && params.id) {
    ownerId = await ownerOfLocation(params.id);
  } else {
    // Ruta protegida sin regla de acceso: se rechaza (falla cerrado).
    throw new Error(`Ruta protegida sin regla de acceso: ${req.method} ${pattern}`);
  }

  if (ownerId !== userId) throw forbidden();
}
