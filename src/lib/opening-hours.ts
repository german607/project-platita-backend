import { z } from "zod";

// Horarios de atención: la semana tipo, con uno o más tramos por día. Una
// lista vacía es "cerrado". Hora de Montevideo (la API no convierte husos).
//
//   { mon: [{ from: "09:00", to: "13:00" }, { from: "16:00", to: "20:00" }], ..., sun: [] }

export const WEEK_DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;
export type WeekDay = (typeof WEEK_DAYS)[number];
export type TimeRange = { from: string; to: string };
export type OpeningHours = Record<WeekDay, TimeRange[]>;

const fromTime = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inválida, usar HH:MM");
// "24:00" permite cerrar a medianoche (sino sería 00:00, que es antes que el from).
const toTime = z.string().regex(/^(([01]\d|2[0-3]):[0-5]\d|24:00)$/, "Hora inválida, usar HH:MM");

const range = z.object({ from: fromTime, to: toTime }).strict();

// Un día: from < to en cada tramo y sin tramos superpuestos (que uno termine
// justo cuando empieza el otro está bien). Se guarda ordenado. Como todas las
// horas son HH:MM de largo fijo, comparar como texto equivale a comparar horas.
const day = z
  .array(range)
  .max(6)
  .superRefine((ranges, ctx) => {
    ranges.forEach((r, index) => {
      if (r.from >= r.to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "`from` tiene que ser anterior a `to`", path: [index] });
      }
    });
    const sorted = [...ranges].sort((a, b) => a.from.localeCompare(b.from));
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].from < sorted[i - 1].to) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Los tramos del día se superponen" });
        break;
      }
    }
  })
  .transform((ranges) => [...ranges].sort((a, b) => a.from.localeCompare(b.from)))
  .default([]);

// Un día que no se manda queda cerrado. Días desconocidos se rechazan.
export const openingHoursSchema = z
  .object({
    mon: day,
    tue: day,
    wed: day,
    thu: day,
    fri: day,
    sat: day,
    sun: day,
  })
  .strict();

export const closedWeek = (): OpeningHours => ({ mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] });

// Para devolver siempre la misma forma, aunque el comercio nunca haya
// cargado horarios (null en la base) o el JSON guardado sea inválido.
export function normalizeOpeningHours(stored: unknown): OpeningHours {
  const parsed = openingHoursSchema.safeParse(stored ?? {});
  return parsed.success ? parsed.data : closedWeek();
}
