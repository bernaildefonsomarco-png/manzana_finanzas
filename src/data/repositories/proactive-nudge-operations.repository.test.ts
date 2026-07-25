import { describe, expect, it, vi } from "vitest";
import { getProactivePilotMetrics } from "./proactive-nudge-operations.repository";

describe("proactive nudge operational metrics", () => {
  it("no consulta datos globales cuando la cohorte esta vacia", async () => {
    const from = vi.fn();

    const result = await getProactivePilotMetrics(
      { from } as never,
      [],
      7,
      new Date("2026-07-20T12:00:00.000Z"),
    );

    expect(from).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      window_days: 7,
      scope_users: 0,
      truncated: false,
      candidates: { total: 0 },
      deliveries: { total: 0 },
      provider_attempts: { total: 0 },
      quality_signals: { false_positive_rate: null },
      template_usage: {
        paid_templates_today: 0,
        paid_templates_this_month: 0,
        monetary_cost: null,
      },
    });
  });
});
