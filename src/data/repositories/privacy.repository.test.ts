import { describe, expect, it, vi } from "vitest";
import { exportUserData } from "./privacy.repository";

describe("exportUserData", () => {
  it("incluye los datos de W-12 y los limita al usuario autenticado", async () => {
    const queries = new Map<string, ReturnType<typeof thenableQuery>>();
    const from = vi.fn((table: string) => {
      const query = thenableQuery(
        ["profiles", "user_preferences", "learning_preferences"].includes(table)
          ? null
          : [{ id: `${table}-1` }],
      );
      queries.set(table, query);
      return query;
    });

    const exported = await exportUserData({ from } as never, "user-1");

    expect(exported).toMatchObject({
      budgets: [{ id: "budgets-1" }],
      goals: [{ id: "goals-1" }],
      budget_progress_snapshots: [{ id: "budget_progress_snapshots-1" }],
      budget_suggestion_decisions: [
        { id: "budget_suggestion_decisions-1" },
      ],
    });
    for (const table of [
      "budgets",
      "goals",
      "budget_progress_snapshots",
      "budget_suggestion_decisions",
    ]) {
      expect(queries.get(table)?.eq).toHaveBeenCalledWith("user_id", "user-1");
    }
  });
});

function thenableQuery(data: Record<string, unknown>[] | null) {
  const result = { data, error: null };
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      onfulfilled?: (value: typeof result) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onfulfilled, onrejected),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(result);
  return query;
}
