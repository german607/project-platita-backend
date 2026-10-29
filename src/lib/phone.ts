// Normaliza un teléfono uruguayo a formato +598XXXXXXXX (8 dígitos locales).
// Devuelve null si no tiene forma de teléfono uruguayo.
export function normalizeUyPhone(raw: string): string | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("598")) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return /^[2-9]\d{7}$/.test(digits) ? `+598${digits}` : null;
}

// Fragmento de dígitos para buscar "contiene" dentro de los teléfonos
// guardados (+598XXXXXXXX). Sirve para búsquedas parciales: se saca el 0 de
// discado nacional ("099…" → "99…") y el prefijo de país cuando es evidente
// (más de 8 dígitos). Devuelve "" si no queda nada que buscar.
export function phoneSearchFragment(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("598") && digits.length > 8) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits;
}
