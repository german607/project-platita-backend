// Herramienta de DESARROLLO: borra a una persona (por teléfono) y todo lo que
// cuelga de ella, para volver a probar el ingreso desde cero.
//
//   npm run db:delete-user -- 099123456
//
// Borra: sus sesiones, sus fichas en los comercios con sus movimientos y claves
// de idempotencia, el usuario, y los pedidos de código de ese teléfono (así no
// molesta el límite de "1 cada 30 segundos"). Los movimientos son parte del
// libro mayor: esto es SOLO para datos de prueba. Se niega a correr en
// producción o contra una base que no sea local.
import { config } from "../src/config.js";
import { db } from "../src/lib/db.js";
import { normalizeUyPhone } from "../src/lib/phone.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]", "db"];

async function main() {
  const raw = process.argv[2];
  if (!raw) {
    console.error("Uso: npm run db:delete-user -- 099123456");
    process.exit(1);
  }

  const phone = normalizeUyPhone(raw);
  if (!phone) {
    console.error("Eso no es un teléfono uruguayo válido.");
    process.exit(1);
  }

  const host = new URL(config.DATABASE_URL).hostname;
  if (config.NODE_ENV === "production" || !LOCAL_HOSTS.includes(host)) {
    console.error(`Me niego: esto solo corre en desarrollo y contra una base local (NODE_ENV=${config.NODE_ENV}, base en "${host}").`);
    process.exit(1);
  }

  const user = await db.user.findUnique({
    where: { phone },
    include: { customers: { select: { id: true } } },
  });
  const customerIds = user?.customers.map((c) => c.id) ?? [];

  const userId = user?.id ?? "";
  // Todo junto o nada, y en este orden: primero lo que cuelga de las fichas.
  const [keys, movements, customers, sessions, users, requests, challenges] = await db.$transaction([
    db.idempotencyKey.deleteMany({ where: { customerId: { in: customerIds } } }),
    db.transaction.deleteMany({ where: { customerId: { in: customerIds } } }),
    db.customer.deleteMany({ where: { userId } }),
    db.session.deleteMany({ where: { userId } }),
    db.user.deleteMany({ where: { id: userId } }),
    db.otpRequest.deleteMany({ where: { phone } }),
    db.otpChallenge.deleteMany({ where: { phone } }),
  ]);

  console.log(`Teléfono ${phone}`);
  console.log(users.count > 0 ? "Usuario borrado." : "No había usuario con ese teléfono.");
  console.log(
    `Sesiones: ${sessions.count} · fichas de comercio: ${customers.count} · movimientos: ${movements.count} · claves de idempotencia: ${keys.count}`,
  );
  console.log(`Pedidos de código: ${requests.count} · códigos vigentes: ${challenges.count}`);
}

main()
  .catch((err) => {
    console.error("Falló:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
