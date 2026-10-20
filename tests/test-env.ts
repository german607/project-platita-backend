// Base de datos de los tests. NUNCA la de desarrollo: los tests la vacían.
//
// - En el CI (CI=true) se usa la DATABASE_URL del job, que es una base
//   descartable.
// - En local se usa TEST_DATABASE_URL o, si no está, platita_test en el mismo
//   Postgres del docker-compose. Hay que crearla una vez:
//     docker compose exec db createdb -U platita platita_test
//   Las migraciones se aplican solas al empezar (global-setup.ts).
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  (process.env.CI ? process.env.DATABASE_URL : undefined) ??
  "postgresql://platita:platita@localhost:5432/platita_test";

// Resguardo: fuera del CI, la base tiene que terminar en "_test".
export function assertSafeTestDatabase(url: string) {
  const name = new URL(url).pathname.slice(1);
  if (!process.env.CI && !name.endsWith("_test")) {
    throw new Error(
      `Los tests vacían la base: se niegan a correr contra "${name}". Usá una base que termine en _test (TEST_DATABASE_URL).`,
    );
  }
}
