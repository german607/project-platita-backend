import type { FastifyRequest } from "fastify";
import { authenticate, invalidSession, type AuthContext } from "./service.js";

declare module "fastify" {
  interface FastifyRequest {
    // Quién hace el pedido, una vez pasado `requireSession` (null antes).
    auth: AuthContext | null;
  }
}

// Hook `onRequest` para las rutas que exigen sesión: lee `Authorization:
// Bearer <token>` y deja el usuario en `req.auth`. Cualquier problema (sin
// header, token desconocido, vencido o revocado) es el mismo 401 INVALID_SESSION.
export async function requireSession(req: FastifyRequest) {
  const match = /^Bearer\s+(\S+)$/i.exec(req.headers.authorization ?? "");
  if (!match) throw invalidSession();
  req.auth = await authenticate(match[1]);
}

// Para los handlers de rutas protegidas: el contexto, ya validado.
export function authOf(req: FastifyRequest): AuthContext {
  if (!req.auth) throw invalidSession();
  return req.auth;
}
