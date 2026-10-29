import { Prisma } from "@prisma/client";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "./errors.js";

// Errores de Prisma que significan "la base no respondió" y no "algo está mal en el
// pedido" (P1001 no se puede conectar, P1002 timeout, P1008 timeout de la operación,
// P1017 el servidor cerró la conexión). Pasa sobre todo al despertar una base que se
// durmió (Neon gratis): se devuelve 503 con Retry-After para que el cliente reintente.
const DATABASE_UNAVAILABLE_CODES = new Set(["P1001", "P1002", "P1008", "P1017"]);

// Devuelve el código de Prisma si el error es de "base no disponible"; si no, null.
function databaseUnavailableCode(error: Error): string | null {
  const code =
    error instanceof Prisma.PrismaClientInitializationError
      ? error.errorCode
      : error instanceof Prisma.PrismaClientKnownRequestError
        ? error.code
        : undefined;
  return code && DATABASE_UNAVAILABLE_CODES.has(code) ? code : null;
}

// Forma única de error en toda la API: { error, code, details? }
export function errorHandler(error: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: error.issues });
  }

  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ error: error.message, code: error.code, details: error.details });
  }

  const unavailableCode = databaseUnavailableCode(error);
  if (unavailableCode) {
    req.log.warn({ prismaCode: unavailableCode }, "base de datos no disponible");
    return reply
      .code(503)
      .header("retry-after", "2")
      .send({ error: "La base de datos no está disponible un momento: probá de nuevo", code: "DATABASE_UNAVAILABLE" });
  }

  // Red de seguridad para errores de Prisma que los servicios no anticiparon.
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2025") {
      return reply.code(404).send({ error: "Registro no encontrado", code: "NOT_FOUND" });
    }
    if (error.code === "P2002") {
      return reply.code(409).send({ error: "Ya existe un registro igual", code: "CONFLICT" });
    }
    if (error.code === "P2003") {
      return reply.code(404).send({ error: "Referencia a un registro que no existe", code: "NOT_FOUND" });
    }
  }

  // Errores propios de Fastify (JSON mal formado, body demasiado grande, etc.).
  const statusCode = (error as FastifyError).statusCode;
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.code(statusCode).send({ error: error.message, code: (error as FastifyError).code ?? "BAD_REQUEST" });
  }

  req.log.error(error);
  return reply.code(500).send({ error: "Error interno", code: "INTERNAL_ERROR" });
}
