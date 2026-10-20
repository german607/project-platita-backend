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

  // Ingreso del cliente por código de un solo uso.
  // Proveedor del mensaje: "dev" (acepta 000000, no manda ni cuesta nada) o
  // "twilio" (Twilio Verify). Sumar uno nuevo: ver docs/BACKEND.md ("Ingreso real").
  OTP_PROVIDER: z.enum(["dev", "twilio"]).optional(),
  // Credenciales de Twilio Verify. SOLO en variables de entorno, nunca en el
  // código ni en el repo. Obligatorias con OTP_PROVIDER=twilio.
  TWILIO_ACCOUNT_SID: z.string().trim().optional(),
  TWILIO_AUTH_TOKEN: z.string().trim().optional(),
  TWILIO_VERIFY_SID: z.string().trim().optional(),
  // Idioma del texto del SMS (opcional, ej. "es"). Sin esto Twilio usa el suyo.
  TWILIO_LOCALE: z.string().trim().optional(),
  // Canal por el que se manda el código. Se elige acá, no en el front.
  OTP_CHANNEL: z.enum(["sms", "whatsapp"]).default("sms"),
  // Permite el proveedor "dev" en producción (SOLO para demos): sin esto, el
  // backend se niega a arrancar en producción con un proveedor de prueba.
  ALLOW_INSECURE_AUTH: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // Días que dura una sesión sin usarse (se renueva al usarla).
  SESSION_TTL_DAYS: z.coerce.number().int().positive().max(365).default(60),
  // Poner en "true" si hay un proxy delante (Railway, Render, nginx…): sin
  // esto todas las IPs parecen la del proxy y los límites por IP no sirven.
  TRUST_PROXY: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
}).superRefine((env, ctx) => {
  // Producción no arranca con el proveedor de prueba salvo opt-in explícito.
  if (env.NODE_ENV === "production" && (env.OTP_PROVIDER ?? "dev") === "dev" && !env.ALLOW_INSECURE_AUTH) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["OTP_PROVIDER"],
      message:
        "En producción hace falta un OTP_PROVIDER real. Para una demo con el proveedor de prueba (acepta 000000) hay que pedirlo a propósito con ALLOW_INSECURE_AUTH=true",
    });
  }

  // Con Twilio tienen que estar las tres credenciales. Los mensajes nombran
  // las variables, nunca sus valores.
  if (env.OTP_PROVIDER === "twilio") {
    const missing = (["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_VERIFY_SID"] as const).filter((k) => !env[k]);
    if (missing.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["OTP_PROVIDER"],
        message: `OTP_PROVIDER=twilio necesita estas variables de entorno: ${missing.join(", ")}`,
      });
    }
    if (env.TWILIO_ACCOUNT_SID && !env.TWILIO_ACCOUNT_SID.startsWith("AC")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["TWILIO_ACCOUNT_SID"], message: "TWILIO_ACCOUNT_SID tiene que empezar con AC" });
    }
    if (env.TWILIO_VERIFY_SID && !env.TWILIO_VERIFY_SID.startsWith("VA")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["TWILIO_VERIFY_SID"], message: "TWILIO_VERIFY_SID tiene que empezar con VA (es el SID del servicio de Verify, no el de la cuenta)" });
    }
  }
});

// Toda variable de entorno se lee acá, validada. Nada de process.env suelto
// en el resto del código: si se suma configuración, se suma a este esquema.
export const config = schema.parse(process.env);
export const isProduction = config.NODE_ENV === "production";
// Nombre del proveedor de códigos en uso ("dev" si no se configuró otro).
export const otpProviderName = config.OTP_PROVIDER ?? "dev";
// Proveedor de prueba en producción (solo demos, con ALLOW_INSECURE_AUTH).
export const usingInsecureAuth = isProduction && otpProviderName === "dev";
export const insecureUserRoutes = config.INSECURE_USER_ROUTES ?? !isProduction;
