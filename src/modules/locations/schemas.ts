import { z } from "zod";

const label = z.string().trim().min(1).max(60);
// Solo texto: no hay mapa ni coordenadas (el front arma "Cómo llegar").
const address = z.string().trim().min(3).max(200);

export const createLocationBody = z.object({
  label: label.optional(),
  address,
});

// label acepta null para borrarlo. No hay DELETE: active=false da de baja.
export const updateLocationBody = z
  .object({
    label: label.nullable().optional(),
    address: address.optional(),
    active: z.boolean().optional(),
  })
  .refine((body) => Object.keys(body).length > 0, { message: "Hay que enviar al menos un campo" });

export type CreateLocationInput = z.infer<typeof createLocationBody>;
export type UpdateLocationInput = z.infer<typeof updateLocationBody>;
