import { describe, expect, it } from "vitest";
import { NudgeExperienceAgent } from "./nudge-experience-agent";
import { LocalFixtureNudgeExperienceAgentRuntime } from "./local-fixture-runtime";

describe("NudgeExperienceAgent", () => {
  it("solo enmarca el copy ya aprobado y no solicita herramientas", async () => {
    const result = await new NudgeExperienceAgent(
      new LocalFixtureNudgeExperienceAgentRuntime(),
    ).frame(
      {
        context_pack_type: "nudge_experience_context",
        version: "v1",
        locale: "es-PE",
        candidate: { type: "payment_due", risk_level: "medium", priority: 80 },
        approved_delivery: {
          channel: "whatsapp",
          delivery_mode: "freeform",
          disclosure_level: "standard",
          redaction_applied: false,
        },
        user_context: {
          tone_style: "calido y breve",
          discreet_mode_enabled: false,
        },
        safe_facts: { due_date: "2026-07-20" },
        deterministic_base_text: "Tu pago se acerca. Puedes revisarlo en Manzana.",
      },
      "trace-1",
    );

    expect(result.output.response_text).toBe(
      "Tu pago se acerca. Puedes revisarlo en Manzana.",
    );
    expect(result.output.tone_applied).toBe("calido y breve");
    expect(result.tool_calls).toEqual([]);
    expect(result.safety.policy_flags).toContain(
      "send_channel_and_timing_are_deterministic",
    );
  });
});
