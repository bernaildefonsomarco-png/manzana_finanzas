export type UnifiedUpcomingCommitment = {
  id: string;
  kind: "recurring" | "debt";
  due_at: string;
  recurring_rule_id?: string;
  occurrence_id?: string | null;
  linked_debt_id?: string | null;
  debt_id?: string;
  installment_id?: string;
  [key: string]: unknown;
};

/**
 * RUL-REC-09: una regla que representa una cuota de deuda nunca comparte la
 * agenda con la cuota dueña. Las demás entradas se deduplican por identidad
 * de dominio, no por título o monto (dos pagos iguales sí pueden ser reales).
 */
export function mergeUpcomingCommitments<
  T extends UnifiedUpcomingCommitment
>(recurring: T[], debts: T[]): T[] {
  const result = new Map<string, T>();

  for (const commitment of recurring) {
    if (commitment.linked_debt_id) continue;
    const key = `recurring:${
      commitment.occurrence_id ??
      `${commitment.recurring_rule_id ?? commitment.id}:${commitment.due_at}`
    }`;
    if (!result.has(key)) result.set(key, commitment);
  }

  for (const commitment of debts) {
    const key = `debt:${
      commitment.installment_id ??
      `${commitment.debt_id ?? commitment.id}:${commitment.due_at}`
    }`;
    if (!result.has(key)) result.set(key, commitment);
  }

  return [...result.values()].sort((left, right) => {
    const byDate = left.due_at.localeCompare(right.due_at);
    return byDate === 0 ? left.id.localeCompare(right.id) : byDate;
  });
}
