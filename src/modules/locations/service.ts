import { db } from "../../lib/db.js";
import { notFound, unprocessable } from "../../lib/errors.js";
import { lockMerchant, requireMerchant } from "../merchants/service.js";
import type { CreateLocationInput, UpdateLocationInput } from "./schemas.js";

export async function createLocation(merchantId: string, input: CreateLocationInput) {
  await requireMerchant(merchantId);
  return db.location.create({ data: { merchantId, label: input.label, address: input.address } });
}

// Todos los locales del comercio, también los dados de baja (el comercio los
// administra). Los más viejos primero. Son pocos, así que no se pagina.
export async function listLocations(merchantId: string) {
  await requireMerchant(merchantId);
  const data = await db.location.findMany({
    where: { merchantId },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  return { data };
}

// No hay DELETE: un local se da de baja con { active: false }. Mientras el
// comercio aparezca en la app tiene que quedarle al menos un local activo.
export async function updateLocation(id: string, input: UpdateLocationInput) {
  const found = await db.location.findUnique({ where: { id }, select: { merchantId: true } });
  if (!found) throw notFound("Local");

  return db.$transaction(async (tx) => {
    await lockMerchant(tx, found.merchantId);
    const location = await tx.location.findUniqueOrThrow({ where: { id } });

    if (input.active === false && location.active) {
      const merchant = await tx.merchant.findUniqueOrThrow({
        where: { id: location.merchantId },
        select: { visible: true },
      });
      if (merchant.visible) {
        const otherActive = await tx.location.count({
          where: { merchantId: location.merchantId, active: true, id: { not: id } },
        });
        if (otherActive === 0) {
          throw unprocessable(
            "LOCATION_REQUIRED_WHILE_VISIBLE",
            "No se puede dar de baja el único local activo mientras el comercio aparece en la app: primero desactivá \"Aparecer en la app\" o agregá otro local",
          );
        }
      }
    }

    return tx.location.update({ where: { id }, data: input });
  });
}
