import { execSync } from "node:child_process";
import { assertSafeTestDatabase, TEST_DATABASE_URL } from "./test-env.js";

// Corre una vez antes de todos los tests: se asegura de que la base sea de
// pruebas y de que tenga todas las migraciones aplicadas.
export default function setup() {
  assertSafeTestDatabase(TEST_DATABASE_URL);
  execSync("npx prisma migrate deploy", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
