// RUL-BUS-02/SCR-BUS-03: la corrección ortográfica se calcula por distancia
// sobre los comercios que el usuario ya tiene, nunca sobre un diccionario
// general. Se ofrece como enlace explícito, no se aplica sola.

function levenshtein(a: string, b: string): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const matrix: number[][] = Array.from({ length: rows }, (_, i) => [
    i,
    ...Array.from({ length: cols - 1 }, () => 0),
  ]);
  for (let j = 1; j < cols; j += 1) matrix[0]![j] = j;

  for (let i = 1; i < rows; i += 1) {
    for (let j = 1; j < cols; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,
        matrix[i]![j - 1]! + 1,
        matrix[i - 1]![j - 1]! + cost,
      );
    }
  }
  return matrix[rows - 1]![cols - 1]!;
}

export function suggestSpelling(query: string, knownMerchants: string[]): string | null {
  const normalized = query.trim().toLowerCase();
  if (!normalized || knownMerchants.length === 0) return null;

  let best: { merchant: string; distance: number } | null = null;
  for (const merchant of knownMerchants) {
    const distance = levenshtein(normalized, merchant.toLowerCase());
    if (!best || distance < best.distance) {
      best = { merchant, distance };
    }
  }
  if (!best) return null;
  // Solo se sugiere si está razonablemente cerca (no es la misma palabra ni
  // algo completamente distinto): a lo más 40% de la longitud como distancia.
  const threshold = Math.max(1, Math.floor(normalized.length * 0.4));
  if (best.distance === 0 || best.distance > threshold) return null;
  return best.merchant;
}
