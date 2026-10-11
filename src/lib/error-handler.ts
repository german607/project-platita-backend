import { Prisma } from "@prisma/client";
import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";
import { AppError } from "./errors.js";

// Forma única de error en toda la API: { error, code, details? }
export function errorHandler(error: FastifyError | Error, req: FastifyRequest, reply: FastifyReply) {
  if (error instanceof ZodError) {
    return reply.code(400).send({ error: "Datos inválidos", code: "VALIDATION_ERROR", details: error.issues });
  }

  if (error instanceof AppError) {
    return reply.code(error.statusCode).send({ error: error.message, code: error.code, details: error.details });
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
