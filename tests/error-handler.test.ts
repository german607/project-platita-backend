import { Prisma } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { errorHandler } from "../src/lib/error-handler.js";

// Cuando la base no responde (por ejemplo, Neon despertando), la API tiene que
// decirlo con un 503 que se pueda reintentar y no con un 500 genérico.

function fakeReply() {
  const reply = {
    statusCode: 0,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    code(status: number) {
      reply.statusCode = status;
      return reply;
    },
    header(name: string, value: string) {
      reply.headers[name] = value;
      return reply;
    },
    send(body: unknown) {
      reply.body = body;
      return reply;
    },
  };
  return reply;
}

const req = { log: { warn() {}, error() {} } };

function handle(error: Error) {
  const reply = fakeReply();
  errorHandler(error, req as never, reply as never);
  return reply;
}

describe("errores de la base de datos", () => {
  it.each(["P1001", "P1002", "P1008", "P1017"])("el error de inicialización %s da 503 con Retry-After", (code) => {
    const reply = handle(new Prisma.PrismaClientInitializationError("no se puede conectar", "5.22.0", code));
    expect(reply.statusCode).toBe(503);
    expect(reply.headers["retry-after"]).toBe("2");
    expect(reply.body).toMatchObject({ code: "DATABASE_UNAVAILABLE" });
  });

  it("un P1017 (el servidor cerró la conexión) de una consulta también da 503", () => {
    const reply = handle(new Prisma.PrismaClientKnownRequestError("cerró la conexión", { code: "P1017", clientVersion: "5.22.0" }));
    expect(reply.statusCode).toBe(503);
    expect(reply.body).toMatchObject({ code: "DATABASE_UNAVAILABLE" });
  });

  it("no muestra detalles internos de la conexión", () => {
    const reply = handle(
      new Prisma.PrismaClientInitializationError("Can't reach database server at `ep-secreto.neon.tech:5432`", "5.22.0", "P1001"),
    );
    expect(JSON.stringify(reply.body)).not.toContain("ep-secreto");
  });

  it("una contraseña mal puesta (P1000) NO se disfraza de 'base no disponible': es un 500", () => {
    const reply = handle(new Prisma.PrismaClientInitializationError("autenticación fallida", "5.22.0", "P1000"));
    expect(reply.statusCode).toBe(500);
    expect(reply.body).toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("los demás errores de Prisma siguen igual (un registro que no existe es 404)", () => {
    const reply = handle(new Prisma.PrismaClientKnownRequestError("no existe", { code: "P2025", clientVersion: "5.22.0" }));
    expect(reply.statusCode).toBe(404);
  });

  it("un error cualquiera sigue siendo un 500 genérico", () => {
    const reply = handle(new Error("algo inesperado"));
    expect(reply.statusCode).toBe(500);
    expect(reply.body).toEqual({ error: "Error interno", code: "INTERNAL_ERROR" });
  });
});
