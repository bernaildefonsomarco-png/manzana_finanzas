import { describe, expect, it } from "vitest";
import { buildLocalLearningSignal } from "./local-fixture-runtime";
import type { LearningSignalContextPack } from "./types";

describe("LearningSignalAgent local fixture", () => {
  it("solo propone y conserva la evidencia confirmada", () => {
    const output = buildLocalLearningSignal(contextPack());

    expect(output.candidates[0]).toMatchObject({
      kind: "correction_pattern",
      basis: "confirmed_correction",
      requires_user_confirmation: false,
    });
  });
});

function contextPack(): LearningSignalContextPack {
  return {
    context_pack_type: "learning_signal_context",
    version: "v1",
    user_id: "user-1",
    locale: "es-PE",
    timezone: "America/Lima",
    signal_type: "confirmed_correction",
    event_confirmed: true,
    evidence_source: "confirmed_correction",
    evidence_ref: "correction-1",
    movement: {
      id: "movement-1",
      type: "gasto",
      description: "desayuno",
      merchant: null,
      category_id: "alimentacion",
      source: "whatsapp",
      occurred_at: "2026-07-18T10:00:00-05:00",
    },
    correction: {
      kind: "loan_to",
      related_person_name: "Luis",
      target_value: "Luis",
    },
  };
}
