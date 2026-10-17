import { db } from "../../lib/db.js";
import { notFound } from "../../lib/errors.js";
import { normalizeOpeningHours } from "../../lib/opening-hours.js";
import { pageArgs, toPage } from "../../lib/pagination.js";
import type { ListPlacesQuery } from "./schemas.js";

// Lugares: la vista PÚBLICA de los comercios, la que ve el cliente. Solo
// entran los comercios con `visible = true`, y solo se exponen campos del
// perfil público: nunca teléfono, plan, clientes ni saldos. Todo se arma con
// `select` explícito, así un campo nuevo del comercio no se filtra solo.

// Orden: por nombre y, como desempate, por id (así el cursor es estable).
export async function listPlaces(query: ListPlacesQuery) {
  const rows = await db.merchant.findMany({
    where: {
      visible: true,
      category: query.category,
      name: query.search ? { contains: query.search, mode: "insensitive" } : undefined,
    },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      category: true,
      photoUrl: true,
      locations: {
        where: { active: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { label: true, address: true },
      },
    },
    ...pageArgs(query),
  });
  const page = toPage(rows, query.limit);

  const withPromo = await db.bonusRule.groupBy({
    by: ["merchantId"],
    where: { active: true, merchantId: { in: page.data.map((m) => m.id) } },
  });
  const promoIds = new Set(withPromo.map((r) => r.merchantId));

  return { ...page, data: page.data.map((m) => ({ ...m, hasActivePromo: promoIds.has(m.id) })) };
}

// Detalle de un lugar. Si el comercio no existe o no es visible, es un 404
// idéntico: no se revela que existe.
export async function getPlace(merchantId: string) {
  const merchant = await db.merchant.findFirst({
    where: { id: merchantId, visible: true },
    select: {
      id: true,
      name: true,
      category: true,
      description: true,
      photoUrl: true,
      openingHours: true,
      locations: {
        where: { active: true },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: { label: true, address: true },
      },
      bonuses: {
        where: { active: true },
        orderBy: [{ minTopUp: "asc" }, { id: "asc" }],
        select: { id: true, name: true, description: true, minTopUp: true, bonusAmount: true },
      },
    },
  });
  if (!merchant) throw notFound("Lugar");

  const { bonuses, openingHours, ...rest } = merchant;
  return { ...rest, openingHours: normalizeOpeningHours(openingHours), promos: bonuses };
}
