import { describe, expect, it } from "vitest";
import { mergeUpcomingCommitments } from "./upcoming-commitments";

describe("merge upcoming commitments", () => {
  it("RUL-REC-09: excluye la recurrencia ligada a deuda y deja la cuota una vez", () => {
    const merged = mergeUpcomingCommitments(
      [
        {
          id: "occurrence-1",
          kind: "recurring" as const,
          due_at: "2026-07-10",
          recurring_rule_id: "rule-1",
          occurrence_id: "occurrence-1",
          linked_debt_id: "debt-1",
        },
      ],
      [
        {
          id: "installment-1",
          kind: "debt" as const,
          due_at: "2026-07-10",
          debt_id: "debt-1",
          installment_id: "installment-1",
        },
      ]
    );

    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      kind: "debt",
      installment_id: "installment-1",
    });
  });

  it("deduplica la misma ocurrencia sin colapsar pagos distintos por monto", () => {
    const recurring = {
      id: "occurrence-1",
      kind: "recurring" as const,
      due_at: "2026-07-10",
      recurring_rule_id: "rule-1",
      occurrence_id: "occurrence-1",
      amount: 100,
    };
    const merged = mergeUpcomingCommitments(
      [
        recurring,
        { ...recurring },
        {
          ...recurring,
          id: "occurrence-2",
          occurrence_id: "occurrence-2",
          recurring_rule_id: "rule-2",
        },
      ],
      []
    );

    expect(merged.map((item) => item.id)).toEqual([
      "occurrence-1",
      "occurrence-2",
    ]);
  });
});
