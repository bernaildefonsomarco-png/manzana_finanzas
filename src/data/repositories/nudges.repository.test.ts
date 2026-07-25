import { describe, expect, it } from "vitest";
import type { NudgePreference } from "@/shared/types/domain";
import { resolveDashboardNudgePreferences } from "./nudges.repository";

describe("dashboard nudge preferences", () => {
  it("mantiene avisos internos activos mientras el usuario no los configure", () => {
    expect(
      resolveDashboardNudgePreferences(
        [],
        new Date("2026-07-01T12:00:00.000Z")
      )
    ).toEqual([
      {
        nudge_type: "payment_due",
        enabled: true,
        configured: false,
        channel: "dashboard",
        paused_until: null,
      },
      {
        nudge_type: "debt_due",
        enabled: true,
        configured: false,
        channel: "dashboard",
        paused_until: null,
      },
    ]);
  });

  it("respeta desactivacion y pausa vigente", () => {
    const rows: NudgePreference[] = [
      preferenceFixture("payment_due", false, null),
      preferenceFixture("debt_due", true, "2026-07-02T12:00:00.000Z"),
    ];

    const resolved = resolveDashboardNudgePreferences(
      rows,
      new Date("2026-07-01T12:00:00.000Z")
    );

    expect(resolved.map((preference) => preference.enabled)).toEqual([
      false,
      false,
    ]);
  });
});

function preferenceFixture(
  nudgeType: "payment_due" | "debt_due",
  enabled: boolean,
  pausedUntil: string | null
): NudgePreference {
  return {
    id: `${nudgeType}-preference`,
    user_id: "11111111-1111-4111-8111-111111111111",
    nudge_type: nudgeType,
    enabled,
    channel: "dashboard",
    quiet_hours_override: null,
    paused_until: pausedUntil,
    metadata: {},
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  };
}
