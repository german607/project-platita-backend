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
});

// Toda variable de entorno se lee acá, validada. Nada de process.env suelto
// en el resto del código: si se suma configuración, se suma a este esquema.
export const config = schema.parse(process.env);
export const isProduction = config.NODE_ENV === "production";
