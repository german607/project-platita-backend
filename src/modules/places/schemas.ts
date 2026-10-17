import { MerchantCategory } from "@prisma/client";
import { z } from "zod";
import { pageQuery } from "../../lib/schemas.js";

export const listPlacesQuery = pageQuery.extend({
  category: z.nativeEnum(MerchantCategory).optional(),
  // Por nombre del comercio, sin distinguir mayúsculas.
  search: z.string().trim().min(1).max(80).optional(),
});

export type ListPlacesQuery = z.infer<typeof listPlacesQuery>;
