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
      INSECURE_USER_ROUTES: "true",
    },
  },
});
