import { config } from "../../src/config.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]", "db"];

export type GuardResult =
  | { ok: true; remote: boolean; host: string; database: string }
  | { ok: false; message: string };

// El freno de seguridad de las herramientas que escriben datos de prueba (seed y
// reset-seed). Las reglas, en una función pura para poder probarlas:
//  - Con NODE_ENV=production se niegan SIEMPRE, sin ninguna forma de forzarlo: así
//    no se puede vaciar ni llenar de datos de prueba una base real por error.
//  - Con una base que no es local (otro host que localhost) se niegan salvo que se
//    pida a propósito con --yes. Siempre dicen contra qué base van a escribir.
export function evaluateGuard(input: { nodeEnv: string; databaseUrl: string; args: string[] }): GuardResult {
  if (input.nodeEnv === "production") {
    return { ok: false, message: "Me niego: NODE_ENV=production. Estas herramientas nunca corren en producción." };
  }

  const url = new URL(input.databaseUrl);
  const host = url.hostname;
  const database = url.pathname.slice(1);
  const remote = !LOCAL_HOSTS.includes(host);

  if (remote && !input.args.includes("--yes")) {
    return {
      ok: false,
      message: `La base no es local: "${database}" en "${host}". Si de verdad querés escribir ahí, repetí el comando con --yes (por ejemplo: npm run db:seed -- --yes).`,
    };
  }
  return { ok: true, remote, host, database };
}

// Corta el proceso si el freno no deja seguir; si la base no es local y se confirmó
// con --yes, avisa en grande contra cuál va a escribir. Devuelve el resultado para
// que la herramienta pueda decirlo (por ejemplo, reset-seed).
export function assertLocalDevelopment(args = process.argv.slice(2)) {
  const result = evaluateGuard({ nodeEnv: config.NODE_ENV, databaseUrl: config.DATABASE_URL, args });
  if (!result.ok) {
    console.error(result.message);
    process.exit(1);
  }
  if (result.remote) {
    console.warn(`ATENCIÓN: se va a escribir en una base NO local: "${result.database}" en "${result.host}".`);
  }
  return result;
}
