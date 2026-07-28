import type { DebtScreenIntent } from "@/features/debts/debts-types";

// Validación del deep-link a una deuda concreta (antes vivía en
// `dashboard-app.tsx`, que desapareció en `W-07`: `/deudas/[id]` es ahora
// una ruta real, y esta validación sigue siendo necesaria para el parámetro
// `accion` de esa ruta). El tipo se reutiliza de `debts-types.ts`, no se
// redeclara (`17` §6, un solo lugar por concepto).
export function parseDebtScreenIntent(
  params: Pick<URLSearchParams, "get">
): DebtScreenIntent | null {
  const debtId = params.get("debt");
  const installmentId = params.get("installment");
  const action = params.get("action");

  if (!debtId || !isUuid(debtId)) return null;
  if (installmentId && !isUuid(installmentId)) return null;
  if (action !== "detail" && action !== "pay") return null;

  return {
    debtId,
    installmentId,
    action,
  };
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value
  );
}
