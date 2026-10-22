// Herramienta de ADMINISTRACIÓN: le asigna un dueño a un comercio que ya
// existe (por ejemplo, los anteriores a los dueños, que quedaron sin ninguno y
// por eso nadie puede operarlos).
//
//   npm run db:assign-merchant -- <idDelComercio> <teléfonoDelDueño>
//   npm run db:assign-merchant -- --list            (comercios sin dueño)
//
// La persona se busca por teléfono y, si todavía no existe, se crea (queda sin
// verificar: se verifica sola la primera vez que entre con el código). Si el
// comercio ya tenía otro dueño, se lo cambia.
//
// Por seguridad solo corre contra una base local y fuera de producción. Para
// asignar en una base remota hay que pedirlo a propósito con --force-remote.
import { config } from "../src/config.js";
import { db } from "../src/lib/db.js";
import { normalizeUyPhone } from "../src/lib/phone.js";

const LOCAL_HOSTS = ["localhost", "127.0.0.1", "::1", "[::1]", "db"];
const USAGE = "Uso: npm run db:assign-merchant -- <idDelComercio> <teléfonoDelDueño>  |  --list";

async function main() {
  const args = process.argv.slice(2);
  const forceRemote = args.includes("--force-remote");
  const positional = args.filter((arg) => !arg.startsWith("--"));

  const host = new URL(config.DATABASE_URL).hostname;
  const isRemote = config.NODE_ENV === "production" || !LOCAL_HOSTS.includes(host);
  if (isRemote && !forceRemote) {
    console.error(
      `Me niego: la base no es local (NODE_ENV=${config.NODE_ENV}, base en "${host}"). Si de verdad querés asignar acá, agregá --force-remote.`,
    );
    process.exit(1);
  }
  if (isRemote) console.warn(`ATENCIÓN: se va a escribir en una base NO local ("${host}").`);

  if (args.includes("--list")) {
    const orphans = await db.merchant.findMany({
      where: { ownerId: null },
      orderBy: { createdAt: "asc" },
      select: { id: true, name: true, phone: true },
    });
    console.log(orphans.length === 0 ? "Todos los comercios tienen dueño." : `Comercios sin dueño (${orphans.length}):`);
    for (const m of orphans) console.log(`  ${m.id}  ${m.name}${m.phone ? `  (${m.phone})` : ""}`);
    return;
  }

  const [merchantId, rawPhone] = positional;
  if (!merchantId || !rawPhone) {
    console.error(USAGE);
    process.exit(1);
  }

  const phone = normalizeUyPhone(rawPhone);
  if (!phone) {
    console.error("Eso no es un teléfono uruguayo válido.");
    process.exit(1);
  }

  const merchant = await db.merchant.findUnique({
    where: { id: merchantId },
    select: { id: true, name: true, owner: { select: { phone: true } } },
  });
  if (!merchant) {
    console.error(`No existe un comercio con id "${merchantId}". Probá con --list.`);
    process.exit(1);
  }

  const user = await db.user.upsert({ where: { phone }, update: {}, create: { phone } });
  await db.merchant.update({ where: { id: merchant.id }, data: { ownerId: user.id } });

  console.log(`Comercio "${merchant.name}" (${merchant.id})`);
  console.log(merchant.owner ? `Dueño anterior: ${merchant.owner.phone}` : "Dueño anterior: ninguno");
  console.log(`Dueño nuevo: ${phone}`);
}

main()
  .catch((err) => {
    console.error("Falló:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
