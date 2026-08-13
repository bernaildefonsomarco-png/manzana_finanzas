/**
 * `26` §14.2: lo que pasa de verdad al restaurar o duplicar un movimiento,
 * dicho antes de tocar nada. Mismo contrato que
 * `debt-action-consequences.ts` — texto deterministico, no lo redacta el
 * modelo.
 */

export function describeRestoreConsequence(input: {
  description: string | null;
  amount: number;
  currency: "PEN" | "USD";
}): string {
  const cifra = formatMovementActionAmount(input.amount, input.currency);
  const detalle = input.description ? ` (${input.description})` : "";
  return `Vas a restaurar el movimiento de ${cifra}${detalle}. Vuelve a contar en tus saldos como si nunca lo hubieras eliminado.`;
}

export function describeDuplicateConsequence(input: {
  description: string | null;
  amount: number;
  currency: "PEN" | "USD";
  whenLabel: string;
}): string {
  const cifra = formatMovementActionAmount(input.amount, input.currency);
  const detalle = input.description ? ` (${input.description})` : "";
  return `Vas a duplicar el movimiento${detalle} como uno nuevo de ${cifra}, fechado ${input.whenLabel}. El original no cambia.`;
}

export function formatMovementActionAmount(
  amount: number,
  currency: "PEN" | "USD",
): string {
  const symbol = currency === "USD" ? "$" : "S/";
  return `${symbol}${amount.toFixed(2)}`;
}
