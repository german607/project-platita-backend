import { defineConfig } from "vitest/config";
import { TEST_DATABASE_URL } from "./tests/test-env";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // Los tests comparten una sola base: de a un archivo por vez.
    fileParallelism: false,
    testTimeout: 20_000,
    env: {
      NODE_ENV: "test",
      DATABASE_URL: TEST_DATABASE_URL,
      // El proveedor de códigos de los tests es siempre el de prueba.
      OTP_PROVIDER: "dev",
      // Los tests no usan el modo mixto aunque el .env de quien los corre lo tenga.
      OTP_REAL_PHONES: "",
      // Tampoco la lista de quién crea comercios: en los tests puede cualquiera.
      ALLOWED_MERCHANT_PHONES: "",
      INSECURE_USER_ROUTES: "true",
      // Para probar que el preflight de CORS no pide sesión.
      CORS_ORIGINS: "http://localhost:5173",
    },
  },
});
