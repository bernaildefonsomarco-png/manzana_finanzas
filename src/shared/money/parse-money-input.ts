// Único módulo de utilidades de moneda para toda la aplicación (`17` §6,
// `AC-PAT-09`), junto a `src/ui/primitivas/money.tsx` (presentación). Este
// módulo resuelve la entrada (`17` §7): acepta `1250.5`, `1,250.50` y
// `S/1250.50`, y normaliza a un número con 2 decimales exactos. Prohibido
// operar con dinero en el cliente más allá de esta normalización de
// entrada — totales, saldos y avances los calcula el servidor o el Core.

/** `null` si la cadena no es un monto interpretable. Nunca lanza. */
export function parseMoneyInput(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Quita el símbolo de moneda ("S/", "S/.", "PEN") y espacios internos.
  const withoutSymbol = trimmed.replace(/^(S\/\.?|PEN)\s*/i, "").trim();
  if (!withoutSymbol) return null;

  const isNegative = /^-/.test(withoutSymbol);
  const digitsOnly = withoutSymbol.replace(/^-/, "");

  // Un solo separador decimal permitido: el último `.` si hay comas de
  // miles antes ("1,250.50"), o el único `.` si no hay comas ("1250.5").
  if (!/^[\d,]*\.?\d*$/.test(digitsOnly) || digitsOnly === "") return null;

  const normalized = digitsOnly.replace(/,/g, "");
  if (normalized === "" || normalized === ".") return null;

  const value = Number(normalized);
  if (!Number.isFinite(value)) return null;

  const rounded = Math.round(value * 100) / 100;
  return isNegative ? -rounded : rounded;
}
