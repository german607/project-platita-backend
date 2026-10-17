import { z } from "zod";

// Node >= 20.12 trae loadEnvFile. No pisa variables que ya vengan del shell
// (por eso `PORT=3001 npm run dev` sigue mandando sobre el .env).
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables del entorno tal cual.
}

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().min(1),
  // Orígenes del frontend autorizados a llamar a la API desde el navegador,
  // separados por coma (ej. "https://app.platita.uy,http://localhost:5173").
  // Vacío = no se habilita CORS (solo mismo origen o proxy).
  CORS_ORIGINS: z
    .string()
    .default("")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim().replace(/\/$/, ""))
        .filter(Boolean),
    ),
  // Rutas de usuarios SIN verificación (identificarse solo con el teléfono).
  // Por defecto activas fuera de producción y apagadas en producción; se
  // pueden forzar con "true"/"false". Se reemplazan por la sesión real.
  INSECURE_USER_ROUTES: z
    .enum(["true", "false"])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
});

// Toda variable de entorno se lee acá, validada. Nada de process.env suelto
// en el resto del código: si se suma configuración, se suma a este esquema.
export const config = schema.parse(process.env);
export const isProduction = config.NODE_ENV === "production";
export const insecureUserRoutes = config.INSECURE_USER_ROUTES ?? !isProduction;
