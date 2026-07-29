import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { queryKeys } from "./query-keys";

// Mapa de invalidación de `17` §2.3. La regla que rompe con el patrón
// actual (`WEB-D`, `17` §1): "crear un movimiento no invalida las deudas,
// la configuración ni los hilos del asistente" — cada mutación invalida
// *solo* las claves de su fila, nunca la caché completa (`AC-ARQ-06`,
// `AC-PAT-02`).
export type MutationType =
  | "movement.create"
  | "movement.edit"
  | "movement.delete"
  | "pending.confirm"
  | "account.upsert"
  | "box.upsert"
  | "subcategory.edit"
  | "debt.pay"
  | "debt.create"
  | "budget.edit"
  | "import.confirm"
  | "preferences.change";

function keysFor(mutation: MutationType, params?: { debtId?: string }): QueryKey[] {
  switch (mutation) {
    case "movement.create":
    case "movement.edit":
    case "movement.delete":
      return [queryKeys.movements.all, queryKeys.summary, queryKeys.budgets.all, queryKeys.discoveries.all];
    case "pending.confirm":
      return [
        queryKeys.pending.all,
        queryKeys.movements.all,
        queryKeys.summary,
        queryKeys.budgets.all,
        queryKeys.discoveries.all,
      ];
    case "account.upsert":
      return [queryKeys.accounts, queryKeys.summary];
    case "box.upsert":
      return [queryKeys.boxes, queryKeys.summary];
    case "subcategory.edit":
      return [queryKeys.subcategories.all, queryKeys.categories, queryKeys.movements.all];
    case "debt.pay":
    case "debt.create":
      return [
        queryKeys.debts.all,
        ...(params?.debtId ? [queryKeys.debts.detail(params.debtId)] : []),
        queryKeys.movements.all,
        queryKeys.summary,
      ];
    case "budget.edit":
      return [queryKeys.budgets.all];
    case "import.confirm":
      return [queryKeys.movements.all, queryKeys.pending.all, queryKeys.summary, queryKeys.budgets.all];
    case "preferences.change":
      return [queryKeys.preferences];
  }
}

export async function invalidateForMutation(
  queryClient: QueryClient,
  mutation: MutationType,
  params?: { debtId?: string }
): Promise<void> {
  await Promise.all(
    keysFor(mutation, params).map((key) => queryClient.invalidateQueries({ queryKey: key }))
  );
}
