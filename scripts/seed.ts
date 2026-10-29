// Carga datos de ejemplo para desarrollo: personas con teléfonos fijos,
// comercios visibles con locales, horarios y promos, y clientes con saldos y
// movimientos. Se puede repetir sin duplicar (solo reemplaza lo del seed):
//
//   npm run db:seed
//
// Para borrar TODA la base de desarrollo y volver a cargar, `npm run db:reset-seed`.
//
// Freno de seguridad: se niega con NODE_ENV=production, y con una base que no sea
// local salvo que se confirme con --yes (`npm run db:seed -- --yes`).
import { db } from "../src/lib/db.js";
import { assertLocalDevelopment } from "./lib/dev-guard.js";
import { describeSeed, seedDevelopmentData } from "./lib/seed.js";

assertLocalDevelopment();

seedDevelopmentData(db)
  .then((summary) => console.log(describeSeed(summary)))
  .catch((err) => {
    console.error("Falló el seed:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
