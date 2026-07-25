import { describe, expect, it } from "vitest";
import { sortMovementsByRegistrationRecency } from "./movement-sort";

describe("sortMovementsByRegistrationRecency", () => {
  it("prioriza el movimiento confirmado recien aunque su occurred_at sea mas temprano", () => {
    const sorted = sortMovementsByRegistrationRecency([
      movement({
        id: "old-noon",
        occurred_at: "2026-06-29T17:00:00.000Z",
        created_at: "2026-06-29T14:24:43.000Z",
      }),
      movement({
        id: "fresh-before-noon",
        occurred_at: "2026-06-29T16:28:54.000Z",
        created_at: "2026-06-29T16:28:56.000Z",
      }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual([
      "fresh-before-noon",
      "old-noon",
    ]);
  });

  it("usa occurred_at como desempate cuando fueron creados al mismo tiempo", () => {
    const sorted = sortMovementsByRegistrationRecency([
      movement({
        id: "earlier",
        occurred_at: "2026-06-29T15:00:00.000Z",
        created_at: "2026-06-29T16:00:00.000Z",
      }),
      movement({
        id: "later",
        occurred_at: "2026-06-29T17:00:00.000Z",
        created_at: "2026-06-29T16:00:00.000Z",
      }),
    ]);

    expect(sorted.map((item) => item.id)).toEqual(["later", "earlier"]);
  });
});

function movement(overrides: {
  id: string;
  occurred_at: string;
  created_at: string;
}) {
  return {
    id: overrides.id,
    occurred_at: overrides.occurred_at,
    created_at: overrides.created_at,
  };
}
