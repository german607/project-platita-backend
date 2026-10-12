// Error de negocio con status HTTP y código estable. Los servicios lanzan
// estos errores; el manejador central (error-handler.ts) los convierte en
// respuesta. Los clientes de la API se apoyan en `code`, no en el mensaje.
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
  }
}

export const notFound = (what: string) => new AppError(404, "NOT_FOUND", `${what} no encontrado`);
export const badRequest = (message: string, details?: unknown) => new AppError(400, "BAD_REQUEST", message, details);
export const conflict = (message: string, details?: unknown) => new AppError(409, "CONFLICT", message, details);
export const unprocessable = (code: string, message: string, details?: unknown) =>
  new AppError(422, code, message, details);
