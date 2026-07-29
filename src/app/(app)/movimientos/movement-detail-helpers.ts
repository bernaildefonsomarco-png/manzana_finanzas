import type { Movement } from "@/shared/types/domain";

export function statusLabel(status: Movement["status"], isDeleted: boolean): string {
  if (isDeleted) return "Eliminado";
  switch (status) {
    case "needs_review":
      return "Por revisar";
    case "corrected":
      return "Corregido";
    case "reversed":
      return "Revertido";
    default:
      return "Confirmado";
  }
}

/** Explica el impacto en lenguaje del usuario (`AC-MOV-16`) a partir de lo
 * que el movimiento mismo ya sabe — sin inventar presupuestos que el
 * producto todavia no construye (`W-12`). */
export function buildImpactExplanation(movement: Movement): string {
  if (movement.deleted_at) return "Este movimiento está eliminado: no afecta ningún saldo.";
  if (!movement.affects_account_balance) {
    return movement.debt_id
      ? "No afecta el saldo de ninguna cuenta: es un registro de deuda."
      : "No afecta el saldo de ninguna cuenta.";
  }
  const direction = movement.account_destination_id || movement.box_destination_id ? "subió" : "bajó";
  return `Esto ${direction} el saldo de la cuenta o caja vinculada.`;
}
