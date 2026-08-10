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
    [queryKeys.goals.all, []],
    [queryKeys.projections.all, {}],
    [queryKeys.discoveries.all, []],
    [queryKeys.pending.all, []],
    [queryKeys.accounts, []],
    [queryKeys.boxes, []],
    [queryKeys.debts.all, []],
    [queryKeys.debts.detail("deuda-1"), {}],
    [queryKeys.preferences, {}],
    [queryKeys.recurringRules.all, []],
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

  it("crear un movimiento invalida movimientos/resumen/presupuestos/metas/descubrimientos, pero NO deudas ni preferencias", async () => {
    await invalidateForMutation(queryClient, "movement.create");

    expect(isStale(queryClient, queryKeys.movements.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.summary)).toBe(true);
    expect(isStale(queryClient, queryKeys.budgets.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.goals.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.discoveries.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.projections.all)).toBe(true);

    // La regla explícita que rompe con el patrón actual (`17` §1, `17` §2.3):
    // crear un movimiento no toca deudas, cuentas, cajas ni preferencias.
    expect(isStale(queryClient, queryKeys.debts.all)).toBe(false);
    expect(isStale(queryClient, queryKeys.debts.detail("deuda-1"))).toBe(false);
    expect(isStale(queryClient, queryKeys.accounts)).toBe(false);
    expect(isStale(queryClient, queryKeys.boxes)).toBe(false);
    expect(isStale(queryClient, queryKeys.preferences)).toBe(false);
  });

  it("pagar una deuda invalida deuda, movimientos, resumen y presupuestos, pero no metas", async () => {
    await invalidateForMutation(queryClient, "debt.pay", { debtId: "deuda-1" });

    expect(isStale(queryClient, queryKeys.debts.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.debts.detail("deuda-1"))).toBe(true);
    expect(isStale(queryClient, queryKeys.movements.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.summary)).toBe(true);

    expect(isStale(queryClient, queryKeys.budgets.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.projections.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.goals.all)).toBe(false);
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
    expect(isStale(queryClient, queryKeys.goals.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.projections.all)).toBe(true);

    expect(isStale(queryClient, queryKeys.debts.all)).toBe(false);
  });

  it("editar una caja invalida metas y editar una meta no toca presupuestos", async () => {
    await invalidateForMutation(queryClient, "box.upsert");
    expect(isStale(queryClient, queryKeys.boxes)).toBe(true);
    expect(isStale(queryClient, queryKeys.goals.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.budgets.all)).toBe(false);

    queryClient = setUpQueryClient();
    await invalidateForMutation(queryClient, "goal.edit");
    expect(isStale(queryClient, queryKeys.goals.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.budgets.all)).toBe(false);
    expect(isStale(queryClient, queryKeys.movements.all)).toBe(false);
  });
});

describe("RUL-ESTR-06: confirmar estructura en el asistente refresca lo que se escribió", () => {
  it("marca obsoletas las cinco familias de estructura, y solo esas", async () => {
    const queryClient = setUpQueryClient();

    await invalidateForMutation(queryClient, "assistant.structure_written");

    // El turno solo devuelve mensajes: no dice cuál de las cinco tocó, así
    // que se refrescan las cinco. Sin esto, el usuario creaba la caja
    // conversando, volvía a Mi dinero y no estaba.
    expect(isStale(queryClient, queryKeys.accounts)).toBe(true);
    expect(isStale(queryClient, queryKeys.boxes)).toBe(true);
    expect(isStale(queryClient, queryKeys.goals.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.budgets.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.recurringRules.all)).toBe(true);
    expect(isStale(queryClient, queryKeys.summary)).toBe(true);
    expect(isStale(queryClient, queryKeys.projections.all)).toBe(true);

    // No es "invalidar toda la caché" (`AC-ARQ-06`): una escritura de
    // estructura no toca movimientos, pendientes, deudas ni preferencias.
    expect(isStale(queryClient, queryKeys.movements.all)).toBe(false);
    expect(isStale(queryClient, queryKeys.pending.all)).toBe(false);
    expect(isStale(queryClient, queryKeys.debts.all)).toBe(false);
    expect(isStale(queryClient, queryKeys.preferences)).toBe(false);
  });
});
