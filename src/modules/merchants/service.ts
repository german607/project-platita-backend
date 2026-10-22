import type { Merchant, Prisma } from "@prisma/client";
import { db } from "../../lib/db.js";
import { notFound, unprocessable } from "../../lib/errors.js";
import { normalizeOpeningHours } from "../../lib/opening-hours.js";
import { pageArgs, toPage } from "../../lib/pagination.js";
import type { PageQuery } from "../../lib/schemas.js";
import type { CreateMerchantInput, UpdateMerchantInput } from "./schemas.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// Desde que se elige la categoría, no se puede cambiar antes de este plazo.
// Si un comercio necesita cambiarla antes, se corrige a mano en la base.
export const CATEGORY_LOCK_DAYS = 90;

// Forma pública del comercio: los horarios salen siempre con los 7 días,
// aunque nunca se hayan cargado.
function toResponse(merchant: Merchant) {
  return { ...merchant, openingHours: normalizeOpeningHours(merchant.openingHours) };
}

export async function createMerchant(input: CreateMerchantInput, ownerId: string) {
  return toResponse(await db.merchant.create({ data: { ...input, ownerId } }));
}

// Solo los comercios de esa persona, del más nuevo al más viejo.
export async function listMerchants(ownerId: string, page: PageQuery) {
  const rows = await db.merchant.findMany({
    where: { ownerId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    ...pageArgs(page),
  });
  const result = toPage(rows, page.limit);
  return { ...result, data: result.data.map(toResponse) };
}

export async function getMerchant(id: string) {
  const merchant = await db.merchant.findUnique({ where: { id } });
  if (!merchant) throw notFound("Comercio");
  return toResponse(merchant);
}

// Para otros módulos: falla con 404 si el comercio no existe.
export async function requireMerchant(id: string) {
  const merchant = await db.merchant.findUnique({ where: { id }, select: { id: true } });
  if (!merchant) throw notFound("Comercio");
}

// Bloquea la fila del comercio hasta que termine la transacción. Se usa para
// que "poner visible" y "dar de baja un local" no se crucen y dejen un
// comercio visible sin ningún local activo.
export async function lockMerchant(tx: Prisma.TransactionClient, id: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM "Merchant" WHERE id = ${id} FOR UPDATE`;
  if (rows.length === 0) throw notFound("Comercio");
}

const MISSING_LABEL = {
  location: "al menos un local activo",
  category: "elegir una categoría",
} as const;

export function updateMerchant(id: string, input: UpdateMerchantInput) {
  const { category, visible, openingHours, ...rest } = input;

  return db.$transaction(async (tx) => {
    await lockMerchant(tx, id);
    const current = await tx.merchant.findUniqueOrThrow({ where: { id } });
    const data: Prisma.MerchantUpdateInput = { ...rest };

    // Categoría: la primera vez es libre; después, 90 días entre cambios.
    // Elegir la que ya tiene no cuenta como cambio.
    if (category !== undefined && category !== current.category) {
      if (current.category !== null && current.categoryChangedAt) {
        const availableAt = new Date(current.categoryChangedAt.getTime() + CATEGORY_LOCK_DAYS * DAY_MS);
        if (Date.now() < availableAt.getTime()) {
          throw unprocessable(
            "CATEGORY_CHANGE_TOO_SOON",
            "La categoría no se puede cambiar todavía",
            { availableAt: availableAt.toISOString() },
          );
        }
      }
      data.category = category;
      data.categoryChangedAt = new Date();
    }

    // Aparecer en la app: hace falta un local activo y una categoría (se
    // evalúa con la categoría que quedaría después de este mismo cambio).
    if (visible === true) {
      const missing: (keyof typeof MISSING_LABEL)[] = [];
      if ((await tx.location.count({ where: { merchantId: id, active: true } })) === 0) missing.push("location");
      if (!(category ?? current.category)) missing.push("category");
      if (missing.length > 0) {
        throw unprocessable(
          "PROFILE_INCOMPLETE",
          `Para aparecer en la app falta: ${missing.map((m) => MISSING_LABEL[m]).join(" y ")}`,
          { missing },
        );
      }
    }
    if (visible !== undefined) data.visible = visible;

    if (openingHours !== undefined) data.openingHours = openingHours as Prisma.InputJsonValue;

    return toResponse(await tx.merchant.update({ where: { id }, data }));
  });
}
