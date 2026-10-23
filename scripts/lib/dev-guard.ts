import { config } from "../../src/config.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]", "db"];

// Las herramientas de desarrollo que escriben datos de prueba se niegan a
// correr en producción o contra una base que no sea local.
export function assertLocalDevelopment() {
  const host = new URL(config.DATABASE_URL).hostname;
  if (config.NODE_ENV === "production" || !LOCAL_HOSTS.includes(host)) {
    console.error(
      `Me niego: esto solo corre en desarrollo y contra una base local (NODE_ENV=${config.NODE_ENV}, base en "${host}").`,
    );
    process.exit(1);
  }
}
