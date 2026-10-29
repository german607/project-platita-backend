// Borra TODA la base de desarrollo (comercios, personas, sesiones, movimientos:
// todo, también lo que cargaste a mano) y vuelve a cargar los datos de ejemplo.
//
//   npm run db:reset-seed
//
// Las personas tienen que volver a ingresar (las sesiones se borran). Las tablas
// siguen existiendo: no toca las migraciones.
//
// Freno de seguridad: se niega SIEMPRE con NODE_ENV=production (no hay forma de
// forzarlo) y, con una base que no sea local, salvo que se confirme con --yes
// (`npm run db:reset-seed -- --yes`). Dice contra qué base va a escribir.
import { db } from "../src/lib/db.js";
import { assertLocalDevelopment } from "./lib/dev-guard.js";
import { describeSeed, seedDevelopmentData } from "./lib/seed.js";

const guard = assertLocalDevelopment();

async function main() {
  if (guard.remote) console.warn("Se va a VACIAR esa base (todas las tablas) antes de cargar los datos de ejemplo.");
  await db.$executeRawUnsafe(
    `TRUNCATE "IdempotencyKey", "Transaction", "BonusRule", "Location", "Customer", "Session", "OtpRequest", "OtpChallenge", "User", "Merchant" RESTART IDENTITY CASCADE`,
  );
  console.log("Base de desarrollo vaciada.");
  console.log(describeSeed(await seedDevelopmentData(db)));
}

main()
  .catch((err) => {
    console.error("Falló:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
