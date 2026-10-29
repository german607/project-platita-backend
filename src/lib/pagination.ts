import type { PageQuery } from "./schemas.js";

// Paginación por cursor sobre Prisma. Uso en un servicio:
//
//   const rows = await db.x.findMany({ where, orderBy: [..., { id: "asc" }], ...pageArgs(page) });
//   return toPage(rows, page.limit);
//
// Siempre hay que ordenar con `id` como último criterio para que el orden
// sea estable. Se pide una fila de más para saber si hay página siguiente.
export function pageArgs(page: PageQuery) {
  return {
    take: page.limit + 1,
    ...(page.cursor ? { cursor: { id: page.cursor }, skip: 1 } : {}),
  };
}

export function toPage<T extends { id: string }>(rows: T[], limit: number) {
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return { data, nextCursor: hasMore ? data[data.length - 1].id : null };
}
