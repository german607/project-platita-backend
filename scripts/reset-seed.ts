// Borra TODA la base de desarrollo (comercios, personas, sesiones, movimientos:
// todo, también lo que cargaste a mano) y vuelve a cargar los datos de ejemplo.
//
//   npm run db:reset-seed
//
// Las personas tienen que volver a ingresar (las sesiones se borran). Se niega
// a correr en producción o contra una base que no sea local. Las tablas siguen
// existiendo: no toca las migraciones.
import { db } from "../src/lib/db.js";
import { assertLocalDevelopment } from "./lib/dev-guard.js";
import { describeSeed, seedDevelopmentData } from "./lib/seed.js";

assertLocalDevelopment();

async function main() {
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
