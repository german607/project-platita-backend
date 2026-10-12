// Montos: la API recibe pesos, la base guarda centésimos de peso (enteros).
export const pesosToCents = (pesos: number) => Math.round(pesos * 100);
