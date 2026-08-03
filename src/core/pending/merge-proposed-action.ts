// Fusiona un parche de `proposed_action` sobre el pendiente actual (`RUL-PEND-01`).
// Extraido de `pending/[id]/route.ts` para que `assistant/proposals/[id]/route.ts`
// (`41`, `W-17`) edite un pendiente con la misma logica exacta, en vez de
// repetirla con el riesgo real de que las dos copias diverjan.

export type ProposedActionPatch = {
  action?: string;
  account_id?: string | null;
  account_origin_id?: string | null;
  account_destination_id?: string | null;
  debt_id?: string | null;
  recurring_rule_id?: string | null;
  recurring_occurrence_id?: string | null;
};

export function mergeProposedAction(
  current: Record<string, unknown>,
  patch: ProposedActionPatch
): Record<string, unknown> {
  const action = patch.action ?? readString(current.action) ?? "create_movement";
  const movementInput =
    current.movement_input &&
    typeof current.movement_input === "object" &&
    !Array.isArray(current.movement_input)
      ? { ...(current.movement_input as Record<string, unknown>) }
      : {};
  if (action === "record_transfer") {
    movementInput.type = "transferencia";
    movementInput.account_origin_id = patch.account_origin_id ?? null;
    movementInput.account_destination_id = patch.account_destination_id ?? null;
  } else if (action === "record_debt_payment") {
    movementInput.type = "pago_deuda";
    movementInput.debt_id = patch.debt_id ?? null;
    movementInput.account_origin_id = patch.account_id ?? null;
  } else if (action === "record_recurring_payment") {
    movementInput.type = "pago_recurrente";
    movementInput.recurring_rule_id = patch.recurring_rule_id ?? null;
    movementInput.recurring_occurrence_id = patch.recurring_occurrence_id ?? null;
    movementInput.account_origin_id = patch.account_id ?? null;
  }
  return {
    ...current,
    ...patch,
    action,
    movement_input: movementInput,
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
