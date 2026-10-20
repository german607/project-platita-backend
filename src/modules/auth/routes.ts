import type { FastifyInstance } from "fastify";
import { config, otpProviderName } from "../../config.js";
import { getUser, getUserBalances, updateUser } from "../users/service.js";
import { updateUserBody } from "../users/schemas.js";
import { authOf, requireSession } from "./guard.js";
import { DEV_CODE } from "./otp/dev.js";
import { requestCodeBody, verifyCodeBody } from "./schemas.js";
import { logout, requestCode, verifyCode } from "./service.js";

// Ingreso real del cliente (código por mensaje) y su sesión. Las rutas /me/*
// son las únicas que leen los saldos y el perfil de una persona: siempre del
// usuario de la sesión, nunca de un id que mande el cliente.
export async function authRoutes(app: FastifyInstance) {
  app.decorateRequest("auth", null);

  // Qué proveedor hay, para que el front sepa si mostrar la ayuda del código
  // de prueba. `devCode` solo viene con el proveedor "dev".
  app.get("/auth/config", async () => ({
    otpProvider: otpProviderName,
    channel: config.OTP_CHANNEL,
    devCode: otpProviderName === "dev" ? DEV_CODE : null,
  }));

  // 204 siempre que el teléfono sea válido y no se pase de los límites.
  app.post("/auth/request-code", async (req, reply) => {
    await requestCode(requestCodeBody.parse(req.body), req.ip, req.log);
    return reply.code(204).send();
  });

  app.post("/auth/verify-code", async (req) =>
    verifyCode(verifyCodeBody.parse(req.body), req.headers["user-agent"], req.log),
  );

  // Todo lo que sigue exige sesión.
  await app.register(async (protectedApp) => {
    protectedApp.addHook("onRequest", requireSession);

    protectedApp.post("/auth/logout", async (req, reply) => {
      await logout(authOf(req).sessionId);
      return reply.code(204).send();
    });

    protectedApp.get("/me", async (req) => getUser(authOf(req).userId));

    protectedApp.patch("/me", async (req) => updateUser(authOf(req).userId, updateUserBody.parse(req.body)));

    // Misma forma que GET /users/:id/balances.
    protectedApp.get("/me/balances", async (req) => getUserBalances(authOf(req).userId));
  });
}
