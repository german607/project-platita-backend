import type { MerchantCategory, Plan, Prisma, PrismaClient } from "@prisma/client";
import { openingHoursSchema } from "../../src/lib/opening-hours.js";

// Datos de ejemplo para desarrollo. Todo lo que cuelga de los comercios del
// seed (clientes, movimientos, promos, locales) se borra y se vuelve a crear en
// cada corrida, así que repetirlo no duplica nada. Las personas se buscan por
// teléfono y no se borran (sus sesiones siguen valiendo).
//
// Los comercios, locales y promos tienen ids fijos con prefijo `seed_`. Los
// movimientos replican lo que hace la API (la carga con su bono según las
// promos del comercio, el cobro con saldo suficiente), solo que con fechas
// pasadas para probar historiales y "Reactivar".

const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (days: number, hour = 12) => {
  const date = new Date(Date.now() - days * DAY);
  date.setHours(hour, 0, 0, 0);
  return date;
};
const cents = (pesos: number) => Math.round(pesos * 100);

// Personas con teléfonos fijos y conocidos. Todas entran con 000000 (proveedor dev).
export const PEOPLE = {
  ana: { phone: "+59899000001", name: "Ana Rodríguez" }, // dueña de dos comercios
  beto: { phone: "+59899000002", name: "Beto Pérez" }, // solo cliente, con saldo en varios comercios
  carla: { phone: "+59899000003", name: "Carla Gómez" }, // dueña de tres comercios y clienta de otro
} as const;

// Nombre de la PERSONA (User.name) de cada teléfono; null = todavía no eligió uno.
const USER_NAMES: Record<string, string | null> = {
  [PEOPLE.ana.phone]: PEOPLE.ana.name,
  [PEOPLE.beto.phone]: PEOPLE.beto.name,
  [PEOPLE.carla.phone]: PEOPLE.carla.name,
  "+59899000010": "Juan Pérez",
  "+59899000011": "Marta Silva",
  "+59899000012": null,
  "+59899000013": "Rodrigo Díaz",
  "+59899000014": null,
  "+59899000015": "Gabriela Núñez",
  "+59899000016": "Hugo Benítez",
  "+59899000017": "Ignacio Vera",
};

type Event =
  | { daysAgo: number; hour?: number; type: "TOPUP"; pesos: number; paidWith?: string }
  | { daysAgo: number; hour?: number; type: "CHARGE"; pesos: number; note?: string };

type SeedCustomer = {
  phone: string;
  /** Cómo lo anota el comercio (Customer.name); puede diferir del nombre de la persona. */
  label?: string;
  events: Event[];
};

type SeedMerchant = {
  id: string;
  name: string;
  category: MerchantCategory;
  plan: Plan;
  phone: string;
  description: string;
  photoUrl: string;
  owner: keyof typeof PEOPLE;
  createdDaysAgo: number;
  locations: { label: string; address: string }[];
  hours: unknown; // se valida con openingHoursSchema
  promos: { name: string; description: string; minTopUp: number; bonusAmount: number }[];
  customers: SeedCustomer[];
};

const shift = (from: string, to: string) => [{ from, to }];
const week = (days: Partial<Record<"mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun", { from: string; to: string }[]>>) => days;

const MERCHANTS: SeedMerchant[] = [
  {
    id: "seed_cafe",
    name: "Café de la Esquina",
    category: "CAFETERIA",
    plan: "BASIC",
    phone: "099000101",
    description: "Café de especialidad, medialunas caseras y desayunos todo el día.",
    photoUrl: "https://picsum.photos/seed/platita-cafe/800/600",
    owner: "ana",
    createdDaysAgo: 130,
    locations: [{ label: "Pocitos", address: "Av. Brasil 2500, Pocitos" }],
    hours: week({
      mon: shift("08:00", "20:00"),
      tue: shift("08:00", "20:00"),
      wed: shift("08:00", "20:00"),
      thu: shift("08:00", "20:00"),
      fri: shift("08:00", "21:00"),
      sat: shift("09:00", "21:00"),
      sun: shift("09:00", "14:00"),
    }),
    promos: [
      { name: "Promo $1.000", description: "Cargá $1.000 y llevate $200 de regalo", minTopUp: 1000, bonusAmount: 200 },
      { name: "Promo $2.000", description: "Cargá $2.000 y llevate $500 de regalo", minTopUp: 2000, bonusAmount: 500 },
    ],
    customers: [
      {
        phone: PEOPLE.beto.phone,
        label: "Beto",
        events: [
          { daysAgo: 40, type: "TOPUP", pesos: 1000, paidWith: "efectivo" },
          { daysAgo: 20, type: "CHARGE", pesos: 350, note: "Café + medialuna" },
          { daysAgo: 5, type: "CHARGE", pesos: 400, note: "Desayuno" },
        ],
      },
      { phone: PEOPLE.carla.phone, label: "Carla G.", events: [{ daysAgo: 5, type: "TOPUP", pesos: 1000, paidWith: "mercadopago" }] },
      {
        phone: "+59899000010",
        label: "Juanito",
        events: [
          { daysAgo: 3, type: "TOPUP", pesos: 2000, paidWith: "efectivo" },
          { daysAgo: 1, type: "CHARGE", pesos: 300, note: "Café" },
        ],
      },
      {
        // Saldo 0 y sin venir hace más de 30 días.
        phone: "+59899000011",
        label: "Marta",
        events: [
          { daysAgo: 60, type: "TOPUP", pesos: 1000, paidWith: "efectivo" },
          { daysAgo: 50, type: "CHARGE", pesos: 600 },
          { daysAgo: 45, type: "CHARGE", pesos: 600 },
        ],
      },
      {
        // Sin bono (500 no llega a ninguna promo), con saldo y sin venir hace 80 días.
        phone: "+59899000012",
        label: "Lucía",
        events: [
          { daysAgo: 90, type: "TOPUP", pesos: 500, paidWith: "efectivo" },
          { daysAgo: 80, type: "CHARGE", pesos: 200 },
        ],
      },
    ],
  },
  {
    id: "seed_barberia",
    name: "Barbería Don Pablo",
    category: "BARBERIA_PELUQUERIA",
    plan: "PRO",
    phone: "099000102",
    description: "Cortes clásicos y barba. Sin turno, de martes a sábado.",
    photoUrl: "https://picsum.photos/seed/platita-barberia/800/600",
    owner: "ana",
    createdDaysAgo: 125,
    locations: [
      { label: "Pocitos", address: "Benito Blanco 1100, Pocitos" },
      { label: "Centro", address: "18 de Julio 1200, Centro" },
    ],
    hours: week({
      tue: [...shift("10:00", "13:00"), ...shift("15:00", "20:00")],
      wed: [...shift("10:00", "13:00"), ...shift("15:00", "20:00")],
      thu: [...shift("10:00", "13:00"), ...shift("15:00", "20:00")],
      fri: [...shift("10:00", "13:00"), ...shift("15:00", "20:00")],
      sat: shift("10:00", "14:00"),
    }),
    promos: [
      { name: "3 cortes", description: "Cargá $1.000 y te llevás 3 cortes ($200 de regalo)", minTopUp: 1000, bonusAmount: 200 },
    ],
    customers: [
      {
        // Gastó todo el saldo, pero vino hace poco: saldo 0 y activo.
        phone: PEOPLE.beto.phone,
        label: "Beto",
        events: [
          { daysAgo: 30, type: "TOPUP", pesos: 1000, paidWith: "efectivo" },
          { daysAgo: 25, type: "CHARGE", pesos: 400, note: "Corte" },
          { daysAgo: 10, type: "CHARGE", pesos: 400, note: "Corte" },
          { daysAgo: 2, type: "CHARGE", pesos: 400, note: "Corte y barba" },
        ],
      },
      {
        phone: "+59899000013",
        label: "Rodri",
        events: [
          { daysAgo: 12, type: "TOPUP", pesos: 3000, paidWith: "mercadopago" },
          { daysAgo: 6, type: "CHARGE", pesos: 400, note: "Corte" },
        ],
      },
      {
        phone: "+59899000014",
        label: "Sofi",
        events: [
          { daysAgo: 120, type: "TOPUP", pesos: 1000, paidWith: "efectivo" },
          { daysAgo: 110, type: "CHARGE", pesos: 400, note: "Corte" },
        ],
      },
    ],
  },
  {
    id: "seed_panaderia",
    name: "Panadería La Espiga",
    category: "PANADERIA",
    plan: "BASIC",
    phone: "099000103",
    description: "Pan del día, facturas y tortas por encargo.",
    photoUrl: "https://picsum.photos/seed/platita-panaderia/800/600",
    owner: "carla",
    createdDaysAgo: 110,
    locations: [{ label: "Tres Cruces", address: "Bulevar Artigas 1500, Tres Cruces" }],
    hours: week({
      mon: shift("07:00", "20:00"),
      tue: shift("07:00", "20:00"),
      wed: shift("07:00", "20:00"),
      thu: shift("07:00", "20:00"),
      fri: shift("07:00", "20:00"),
      sat: shift("07:00", "20:00"),
      sun: shift("08:00", "13:00"),
    }),
    promos: [{ name: "Docena de facturas", description: "Cargá $500 y te regalamos $100", minTopUp: 500, bonusAmount: 100 }],
    customers: [
      {
        phone: PEOPLE.beto.phone,
        label: "Beto",
        events: [
          { daysAgo: 15, type: "TOPUP", pesos: 500, paidWith: "efectivo" },
          { daysAgo: 14, type: "CHARGE", pesos: 150, note: "Facturas" },
        ],
      },
      {
        phone: PEOPLE.ana.phone,
        label: "Ana",
        events: [
          { daysAgo: 8, type: "TOPUP", pesos: 1000, paidWith: "mercadopago" },
          { daysAgo: 2, type: "CHARGE", pesos: 250, note: "Pan y facturas" },
        ],
      },
      {
        // Inactiva hace poco más de 30 días, con saldo.
        phone: "+59899000015",
        label: "Gabi",
        events: [
          { daysAgo: 35, type: "TOPUP", pesos: 500, paidWith: "efectivo" },
          { daysAgo: 34, type: "CHARGE", pesos: 300 },
        ],
      },
    ],
  },
  {
    id: "seed_lavadero",
    name: "Lavadero Brillo",
    category: "LAVADERO",
    plan: "BASIC",
    phone: "099000104",
    description: "Lavado completo, aspirado y encerado.",
    photoUrl: "https://picsum.photos/seed/platita-lavadero/800/600",
    owner: "carla",
    createdDaysAgo: 100,
    locations: [{ label: "Pocitos", address: "Rivera 3300, Pocitos" }],
    hours: week({
      mon: shift("09:00", "19:00"),
      tue: shift("09:00", "19:00"),
      wed: shift("09:00", "19:00"),
      thu: shift("09:00", "19:00"),
      fri: shift("09:00", "19:00"),
      sat: shift("09:00", "17:00"),
    }),
    promos: [{ name: "Lavado + encerado", description: "Cargá $1.000 y llevate $250 de regalo", minTopUp: 1000, bonusAmount: 250 }],
    customers: [
      {
        phone: "+59899000010",
        label: "Juan",
        events: [
          { daysAgo: 20, type: "TOPUP", pesos: 1000, paidWith: "efectivo" },
          { daysAgo: 9, type: "CHARGE", pesos: 500, note: "Lavado" },
        ],
      },
      {
        // Saldo 0 y sin venir hace 50 días.
        phone: "+59899000017",
        label: "Nacho",
        events: [
          { daysAgo: 50, type: "TOPUP", pesos: 1000, paidWith: "efectivo" },
          { daysAgo: 50, hour: 15, type: "CHARGE", pesos: 1250, note: "Lavado completo" },
        ],
      },
    ],
  },
  {
    id: "seed_pilates",
    name: "Estudio Pilates & Yoga Sol",
    category: "PILATES_YOGA",
    plan: "PRO",
    phone: "099000105",
    description: "Clases de pilates y yoga en grupos reducidos.",
    photoUrl: "https://picsum.photos/seed/platita-pilates/800/600",
    owner: "carla",
    createdDaysAgo: 95,
    locations: [{ label: "Pocitos", address: "Benito Blanco 900, Pocitos" }],
    hours: week({
      mon: [...shift("07:00", "11:00"), ...shift("17:00", "21:00")],
      tue: [...shift("07:00", "11:00"), ...shift("17:00", "21:00")],
      wed: [...shift("07:00", "11:00"), ...shift("17:00", "21:00")],
      thu: [...shift("07:00", "11:00"), ...shift("17:00", "21:00")],
      fri: [...shift("07:00", "11:00"), ...shift("17:00", "21:00")],
      sat: shift("09:00", "12:00"),
    }),
    promos: [{ name: "Pack de 10 clases", description: "Cargá $5.000 y llevate $1.000 de regalo", minTopUp: 5000, bonusAmount: 1000 }],
    customers: [
      {
        // Mucho saldo y sin venir hace 70 días: el caso para "Reactivar".
        phone: "+59899000016",
        label: "Hugo",
        events: [
          { daysAgo: 75, type: "TOPUP", pesos: 5000, paidWith: "mercadopago" },
          { daysAgo: 70, type: "CHARGE", pesos: 800, note: "Clase" },
        ],
      },
      {
        phone: "+59899000012",
        label: "Lucía",
        events: [
          { daysAgo: 3, type: "TOPUP", pesos: 5000, paidWith: "mercadopago" },
          { daysAgo: 1, type: "CHARGE", pesos: 900, note: "Clase" },
        ],
      },
    ],
  },
];

export type SeedSummary = {
  people: { phone: string; name: string; owns: string[] }[];
  customers: {
    merchant: string;
    phone: string;
    label: string;
    userName: string | null;
    balance: number; // en centésimos
    daysSinceVisit: number;
  }[];
};

// Borra lo que cuelga de los comercios del seed (no las personas ni lo demás).
async function clearSeedData(tx: Prisma.TransactionClient) {
  const merchantIds = MERCHANTS.map((m) => m.id);
  const customerIds = (await tx.customer.findMany({ where: { merchantId: { in: merchantIds } }, select: { id: true } })).map(
    (c) => c.id,
  );
  await tx.idempotencyKey.deleteMany({ where: { customerId: { in: customerIds } } });
  await tx.transaction.deleteMany({ where: { customerId: { in: customerIds } } });
  await tx.customer.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await tx.location.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await tx.bonusRule.deleteMany({ where: { merchantId: { in: merchantIds } } });
  await tx.merchant.deleteMany({ where: { id: { in: merchantIds } } });
}

// Carga (o vuelve a cargar) los datos de ejemplo. Se puede repetir sin duplicar.
export async function seedDevelopmentData(client: PrismaClient): Promise<SeedSummary> {
  const summary: SeedSummary = { people: [], customers: [] };

  await client.$transaction(
    async (tx) => {
      await clearSeedData(tx);

      // Las personas: una por teléfono, con el nombre que se eligió para cada una.
      const userIds = new Map<string, string>();
      for (const [phone, name] of Object.entries(USER_NAMES)) {
        const user = await tx.user.upsert({ where: { phone }, update: { name }, create: { phone, name } });
        userIds.set(phone, user.id);
      }

      for (const merchant of MERCHANTS) {
        // Los horarios se validan con el mismo esquema que usa la API.
        const openingHours = openingHoursSchema.parse(merchant.hours);

        await tx.merchant.create({
          data: {
            id: merchant.id,
            name: merchant.name,
            phone: merchant.phone,
            plan: merchant.plan,
            description: merchant.description,
            photoUrl: merchant.photoUrl,
            category: merchant.category,
            categoryChangedAt: daysAgo(100), // ya se puede cambiar la categoría
            visible: true,
            openingHours: openingHours as Prisma.InputJsonValue,
            ownerId: userIds.get(PEOPLE[merchant.owner].phone)!,
            createdAt: daysAgo(merchant.createdDaysAgo),
          },
        });

        await tx.location.createMany({
          data: merchant.locations.map((location, index) => ({
            id: `${merchant.id}_local_${index + 1}`,
            merchantId: merchant.id,
            label: location.label,
            address: location.address,
            createdAt: daysAgo(merchant.createdDaysAgo),
          })),
        });

        const rules = merchant.promos.map((promo, index) => ({
          id: `${merchant.id}_promo_${index + 1}`,
          merchantId: merchant.id,
          name: promo.name,
          description: promo.description,
          minTopUp: cents(promo.minTopUp),
          bonusAmount: cents(promo.bonusAmount),
        }));
        await tx.bonusRule.createMany({ data: rules });

        for (const seedCustomer of merchant.customers) {
          const events = [...seedCustomer.events].sort((a, b) => b.daysAgo - a.daysAgo || (a.hour ?? 12) - (b.hour ?? 12));
          const first = events[0];
          const last = events[events.length - 1];
          const lastVisitAt = daysAgo(last.daysAgo, last.hour);

          const customer = await tx.customer.create({
            data: {
              merchantId: merchant.id,
              userId: userIds.get(seedCustomer.phone)!,
              phone: seedCustomer.phone,
              name: seedCustomer.label,
              createdAt: daysAgo(first.daysAgo, first.hour),
              lastVisitAt,
            },
          });

          let balance = 0;
          const transactions: Prisma.TransactionCreateManyInput[] = [];
          for (const event of events) {
            const at = daysAgo(event.daysAgo, event.hour);
            const amount = cents(event.pesos);

            if (event.type === "TOPUP") {
              transactions.push({ customerId: customer.id, type: "TOPUP", amount, paidWith: event.paidWith, createdAt: at });
              balance += amount;
              // Igual que la carga real: la promo de mayor mínimo que se alcance (empate: menor id).
              const rule = rules
                .filter((r) => r.minTopUp <= amount)
                .sort((a, b) => b.minTopUp - a.minTopUp || a.id.localeCompare(b.id))[0];
              if (rule) {
                transactions.push({
                  customerId: customer.id,
                  type: "BONUS",
                  amount: rule.bonusAmount,
                  bonusRuleId: rule.id,
                  createdAt: new Date(at.getTime() + 1000),
                });
                balance += rule.bonusAmount;
              }
            } else {
              if (balance < amount) {
                throw new Error(`Seed inválido: ${merchant.name} / ${seedCustomer.phone} cobra más de lo que tiene`);
              }
              transactions.push({ customerId: customer.id, type: "CHARGE", amount: -amount, note: event.note, createdAt: at });
              balance -= amount;
            }
          }
          await tx.transaction.createMany({ data: transactions });

          summary.customers.push({
            merchant: merchant.name,
            phone: seedCustomer.phone,
            label: seedCustomer.label ?? "",
            userName: USER_NAMES[seedCustomer.phone] ?? null,
            balance,
            daysSinceVisit: Math.floor((Date.now() - lastVisitAt.getTime()) / DAY),
          });
        }
      }
    },
    { timeout: 60_000, maxWait: 10_000 },
  );

  for (const person of Object.values(PEOPLE)) {
    summary.people.push({
      phone: person.phone,
      name: person.name,
      owns: MERCHANTS.filter((m) => PEOPLE[m.owner].phone === person.phone).map((m) => m.name),
    });
  }
  return summary;
}

export const formatPesos = (centsAmount: number) =>
  `$${(centsAmount / 100).toLocaleString("es-UY", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

// Resumen para imprimir al terminar: qué teléfono entra a qué cuenta.
export function describeSeed(summary: SeedSummary): string {
  const lines: string[] = ["", "Listo. Todas estas personas entran con el código 000000 (proveedor dev):", ""];

  for (const person of summary.people) {
    const owns = person.owns.length > 0 ? `dueña de ${person.owns.length}: ${person.owns.join(", ")}` : "solo clienta";
    const clientOf = summary.customers.filter((c) => c.phone === person.phone);
    const balances = clientOf.length > 0 ? ` · saldo en ${clientOf.map((c) => `${c.merchant} ${formatPesos(c.balance)}`).join(", ")}` : "";
    lines.push(`  ${person.phone}  ${person.name}  →  ${owns}${balances}`);
  }

  lines.push("", "Clientes de los comercios (los teléfonos +598990000xx también entran con 000000):");
  for (const c of summary.customers) {
    const state = c.balance === 0 ? "saldo 0" : formatPesos(c.balance);
    const inactive = c.daysSinceVisit > 30 ? ` · INACTIVO hace ${c.daysSinceVisit} días` : "";
    const names = c.userName && c.userName !== c.label ? `${c.label} (${c.userName})` : c.label || c.userName || "sin nombre";
    lines.push(`  ${c.merchant.padEnd(28)} ${c.phone}  ${names.padEnd(26)} ${state}${inactive}`);
  }
  lines.push("", "Los comercios están visibles en /places. Una persona nueva (cualquier otro teléfono) entra como solo clienta.");
  return lines.join("\n");
}
