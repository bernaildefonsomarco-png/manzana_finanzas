import { QueryClient } from "@tanstack/react-query";
import { beforeEach, describe, expect, it } from "vitest";
import { invalidateForMutation } from "./invalidation";
import { queryKeys } from "./query-keys";

function setUpQueryClient(): QueryClient {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: Infinity } },
  });
  // Sembrar una entrada por cada familia para poder distinguir "se marcó
  // obsoleta" de "no se tocó" tras cada mutación.
  const seeded: [readonly unknown[], unknown][] = [
    [queryKeys.movements.all, []],
    [queryKeys.summary, {}],
    [queryKeys.budgets.all, []],
    [queryKeys.discoveries.all, []],
    [queryKeys.pending.all, []],
    [queryKeys.accounts, []],
    [queryKeys.boxes, []],
    [queryKeys.debts.all, []],
    [queryKeys.debts.detail("deuda-1"), {}],
    [queryKeys.preferences, {}],
  ];
  for (const [key, data] of seeded) {
    queryClient.setQueryData(key as unknown as readonly unknown[], data);
  }
  return queryClient;
}

function isStale(queryClient: QueryClient, key: readonly unknown[]): boolean {
  const state = queryClient.getQueryState(key as unknown as readonly unknown[]);
  return state?.isInvalidated ?? false;
}

describe("invalidateForMutation (17 §2.3, caso difícil de WEB-D165)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = setUpQueryClient();
  });

  it("crear un movimiento invalida movimientos/resumen/presupuestos/descubrimientos, pero NO deudas ni preferencias", async () => {
    await invalidateForMutation(queryClient, "movement.create");

    expect(isStale(queryClient, queryKeys.movements.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.summary)).toBe(true);
    expect(isStale(queryClient, queryKeys.budgets.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.discoveries.all)).toBe(true);

    // La regla explícita que rompe con el patrón actual (`17` §1, `17` §2.3):
    // crear un movimiento no toca deudas, cuentas, cajas ni preferencias.
    expect(isStale(queryClient, queryKeys.debts.all)).toBe(false);
    expect(isStale(queryClient, queryKeys.debts.detail("deuda-1"))).toBe(false);
    expect(isStale(queryClient, queryKeys.accounts)).toBe(false);
    expect(isStale(queryClient, queryKeys.boxes)).toBe(false);
    expect(isStale(queryClient, queryKeys.preferences)).toBe(false);
  });

  it("pagar una deuda invalida la deuda concreta, el listado de deudas, movimientos y resumen, pero no presupuestos ni preferencias", async () => {
    await invalidateForMutation(queryClient, "debt.pay", { debtId: "deuda-1" });

    expect(isStale(queryClient, queryKeys.debts.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.debts.detail("deuda-1"))).toBe(true);
    expect(isStale(queryClient, queryKeys.movements.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.summary)).toBe(true);

    expect(isStale(queryClient, queryKeys.budgets.all)).toBe(false);
    expect(isStale(queryClient, queryKeys.preferences)).toBe(false);
  });

  it("cambiar una preferencia solo invalida preferencias", async () => {
    await invalidateForMutation(queryClient, "preferences.change");

    expect(isStale(queryClient, queryKeys.preferences)).toBe(true);
    expect(isStale(queryClient, queryKeys.movements.all)).toBe(false);
    expect(isStale(queryClient, queryKeys.summary)).toBe(false);
    expect(isStale(queryClient, queryKeys.debts.all)).toBe(false);
  });

  it("confirmar un pendiente invalida lo mismo que un movimiento, además de pendientes", async () => {
    await invalidateForMutation(queryClient, "pending.confirm");

    expect(isStale(queryClient, queryKeys.pending.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.movements.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.summary)).toBe(true);
    expect(isStale(queryClient, queryKeys.budgets.all)).toBe(true);

    expect(isStale(queryClient, queryKeys.debts.all)).toBe(false);
  });
});
