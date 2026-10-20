import { createHash, randomBytes } from "node:crypto";
import type { FastifyBaseLogger } from "fastify";
import { config } from "../../config.js";
import { db } from "../../lib/db.js";
import { AppError } from "../../lib/errors.js";
import { normalizeUyPhone } from "../../lib/phone.js";
import { getOtpProvider } from "./otp/index.js";
import type { OtpCheckResult } from "./otp/provider.js";
import type { RequestCodeInput, VerifyCodeInput } from "./schemas.js";

// Ingreso del cliente por código de un solo uso. La persona escribe su
// celular, recibe un código, lo escribe y queda con una sesión abierta. No hay
// usuario ni contraseña. Quién manda el código es intercambiable
// (ver otp/provider.ts); acá viven los límites, que son nuestros siempre: cada
// mensaje cuesta plata y sin límites alguien podría vaciar la cuenta.

const SECOND = 1000;
const HOUR = 60 * 60 * SECOND;
const DAY = 24 * HOUR;

export const CODE_TTL_MS = 5 * 60 * SECOND; // vida de un código
export const MAX_ATTEMPTS = 5; // intentos de verificar por cada código pedido
export const PHONE_COOLDOWN_MS = 30 * SECOND; // entre dos pedidos del mismo teléfono
export const PHONE_REQUESTS_PER_HOUR = 5;
export const IP_REQUESTS_PER_HOUR = 20;
const TOUCH_AFTER_MS = HOUR; // la sesión se renueva como mucho una vez por hora

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

const tooManyRequests = (retryAfterMs: number) =>
  new AppError(429, "TOO_MANY_REQUESTS", "Pediste demasiados códigos: esperá un momento y probá de nuevo", {
    retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / SECOND)),
  });
const tooManyAttempts = () =>
  new AppError(429, "TOO_MANY_ATTEMPTS", "Demasiados intentos: pedí un código nuevo");
const codeExpired = () => new AppError(422, "CODE_EXPIRED", "El código venció: pedí uno nuevo");
const codeIncorrect = (attemptsLeft: number) =>
  new AppError(422, "CODE_INCORRECT", "El código no es correcto", { attemptsLeft });
export const invalidSession = () =>
  new AppError(401, "INVALID_SESSION", "La sesión no es válida o venció: volvé a ingresar");

function parsePhone(raw: string) {
  const phone = normalizeUyPhone(raw);
  if (!phone) throw new AppError(400, "INVALID_PHONE", "Teléfono uruguayo inválido");
  return phone;
}

// Pide un código para un teléfono. Responde igual exista o no la persona: no
// se revela si alguien tiene cuenta.
export async function requestCode(input: RequestCodeInput, ip: string | undefined, log: FastifyBaseLogger) {
  const phone = parsePhone(input.phone);
  const provider = getOtpProvider();

  const requestId = await db.$transaction(async (tx) => {
    // Un pedido a la vez por teléfono, así dos pedidos simultáneos no
    // esquivan los límites.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${phone}))`;

    const now = Date.now();
    const since = new Date(now - HOUR);

    const recent = await tx.otpRequest.findMany({
      where: { phone, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (last && now - last.createdAt.getTime() < PHONE_COOLDOWN_MS) {
      throw tooManyRequests(PHONE_COOLDOWN_MS - (now - last.createdAt.getTime()));
    }
    if (recent.length >= PHONE_REQUESTS_PER_HOUR) {
      const oldest = recent[recent.length - 1];
      throw tooManyRequests(oldest.createdAt.getTime() + HOUR - now);
    }

    if (ip) {
      const fromIp = await tx.otpRequest.findMany({
        where: { ip, createdAt: { gte: since } },
        orderBy: { createdAt: "asc" },
        take: IP_REQUESTS_PER_HOUR,
        select: { createdAt: true },
      });
      if (fromIp.length >= IP_REQUESTS_PER_HOUR) {
        throw tooManyRequests(fromIp[0].createdAt.getTime() + HOUR - now);
      }
    }

    const request = await tx.otpRequest.create({ data: { phone, ip }, select: { id: true } });
    // Un código nuevo reinicia los intentos del anterior.
    await tx.otpChallenge.upsert({
      where: { phone },
      update: { requestedAt: new Date(now), attempts: 0 },
      create: { phone, requestedAt: new Date(now) },
    });
    return request.id;
  });

  try {
    await provider.start(phone, config.OTP_CHANNEL);
  } catch (err) {
    // No se pudo mandar: no cuenta contra el límite del teléfono.
    log.error({ err, provider: provider.name }, "falló el envío del código");
    await db.otpRequest.deleteMany({ where: { id: requestId } });
    throw new AppError(502, "OTP_PROVIDER_ERROR", "No pudimos mandar el código: probá de nuevo en un rato");
  }
}

// Comprueba el código y, si es correcto, abre una sesión. Si la persona no
// existía se crea (ya puede haberla creado un comercio al anotar su teléfono).
export async function verifyCode(input: VerifyCodeInput, userAgent: string | undefined, log: FastifyBaseLogger) {
  const phone = parsePhone(input.phone);
  const provider = getOtpProvider();

  const challenge = await db.otpChallenge.findUnique({ where: { phone } });
  if (!challenge || Date.now() - challenge.requestedAt.getTime() > CODE_TTL_MS) throw codeExpired();

  // El intento se cuenta ANTES de mirar el código y de forma atómica: varios
  // intentos a la vez no pueden pasar de MAX_ATTEMPTS.
  const counted = await db.otpChallenge.updateMany({
    where: { id: challenge.id, attempts: { lt: MAX_ATTEMPTS } },
    data: { attempts: { increment: 1 } },
  });
  if (counted.count === 0) throw tooManyAttempts();

  let result: OtpCheckResult;
  try {
    result = await provider.check(phone, input.code);
  } catch (err) {
    // El proveedor no respondió: no es culpa de la persona, no gasta un intento.
    log.error({ err, provider: provider.name }, "falló la comprobación del código");
    await db.otpChallenge.updateMany({
      where: { id: challenge.id, attempts: { gt: 0 } },
      data: { attempts: { decrement: 1 } },
    });
    throw new AppError(502, "OTP_PROVIDER_ERROR", "No pudimos comprobar el código: probá de nuevo en un rato");
  }
  if (result === "expired") throw codeExpired();
  if (result === "too_many_attempts") throw tooManyAttempts();
  if (result === "incorrect") throw codeIncorrect(Math.max(0, MAX_ATTEMPTS - (challenge.attempts + 1)));

  const token = randomBytes(32).toString("base64url");
  const now = new Date();

  return db.$transaction(async (tx) => {
    // El código sirve una sola vez: si otro pedido lo gastó primero, vence.
    const spent = await tx.otpChallenge.deleteMany({ where: { id: challenge.id } });
    if (spent.count === 0) throw codeExpired();

    let user = await tx.user.upsert({
      where: { phone },
      update: {},
      create: { phone, phoneVerifiedAt: now },
    });
    if (!user.phoneVerifiedAt) {
      user = await tx.user.update({ where: { id: user.id }, data: { phoneVerifiedAt: now } });
    }

    const session = await tx.session.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + config.SESSION_TTL_DAYS * DAY),
        userAgent: userAgent?.slice(0, 255),
      },
    });
    // El token se devuelve una sola vez; en la base solo queda su hash.
    return { token, expiresAt: session.expiresAt, user };
  });
}

export type AuthContext = { userId: string; sessionId: string };

// Valida el token de una sesión. Mientras se use, la sesión se renueva
// (a lo sumo una vez por hora, para no escribir en la base en cada pedido).
export async function authenticate(token: string): Promise<AuthContext> {
  const session = await db.session.findUnique({ where: { tokenHash: hashToken(token) } });
  const now = Date.now();
  if (!session || session.revokedAt || session.expiresAt.getTime() <= now) throw invalidSession();

  if (now - session.lastUsedAt.getTime() > TOUCH_AFTER_MS) {
    await db.session.update({
      where: { id: session.id },
      data: { lastUsedAt: new Date(now), expiresAt: new Date(now + config.SESSION_TTL_DAYS * DAY) },
    });
  }
  return { userId: session.userId, sessionId: session.id };
}

// Cierra la sesión: el token deja de servir al instante.
export async function logout(sessionId: string) {
  await db.session.updateMany({ where: { id: sessionId, revokedAt: null }, data: { revokedAt: new Date() } });
}
