import { describe, expect, it } from "vitest";
import { ResponseAgent } from "./response-agent";
import type { ResponseContextPack } from "./types";

function context(
  overrides: Partial<ResponseContextPack> = {}
): ResponseContextPack {
  return {
    context_pack_type: "response_context",
    version: "v2",
    user_id: "00000000-0000-4000-8000-000000000001",
    locale: "es-PE",
    timezone: "America/Lima",
    channel: "whatsapp",
    scenario: "movement_created",
    base_text: "Listo. Cafe por S/8.00 registrado.",
    original_user_text: "gaste 8 cafe",
    constraints: {
      max_chars: 900,
      preserve_amounts: true,
      preserve_pending_codes: true,
      preserve_links: true,
      no_emoji: true,
      discreet_mode: false,
    },
    style_contract: {
      active: false,
      instruction: null,
      scope: null,
      attempt: 1,
      retry_feedback: null,
      requested_dimensions: [],
      allowed_dimensions: [],
      blocked_dimensions: [],
      blocked_reasons: [],
      must_apply: false,
      emoji_mode: "forbidden",
      max_emoji_count: 1,
      max_lines_with_emoji: 2,
    },
    facts: {
      amounts: ["S/8.00"],
      pending_codes: [],
      links: [],
      movement_count: 1,
      pending_count: null,
      risk_level: null,
    },
    experience: {
      emotional_state: "neutral",
      continuity: "new_topic",
      experience_mode: "quick_capture",
      response_guidance: ["confirmar sin friccion"],
      personalization_cues: ["personalizacion ligera"],
      preferred_tone: null,
      conversation_style: null,
      last_result_summary: null,
      working_goal: "capture",
      avoid_repetition: false,
    },
    ...overrides,
  };
}

describe("ResponseAgent", () => {
  it("redacta una confirmacion mas humana sin perder el monto", async () => {
    const result = await new ResponseAgent().compose(context(), "trace-1");

    expect(result.output.response_text).toContain("S/8.00");
    expect(result.output.response_text).toContain("Ya quedó en tus movimientos");
    expect(result.output.safety_flags).toContain("no_financial_write");
    expect(result.runtime.provider).toBe("local_fixture");
  });

  it("mantiene el link de Pendientes cuando separa una confirmacion", async () => {
    const result = await new ResponseAgent().compose(
      context({
        scenario: "pending_created",
        base_text:
          "Lo separé para revisar. Falta confirmar un dato y no toca tu saldo.\n" +
          "También puedes abrir Pendientes: http://127.0.0.1:3100/?view=pending",
        facts: {
          amounts: [],
          pending_codes: [],
          links: ["http://127.0.0.1:3100/?view=pending"],
          movement_count: null,
          pending_count: 1,
          risk_level: "medium",
        },
      }),
      "trace-2"
    );

    expect(result.output.response_text).toContain("No toca tu saldo");
    expect(result.output.response_text).toContain(
      "http://127.0.0.1:3100/?view=pending"
    );
  });

  it("mantiene la respuesta conversacional basica sin inventar accion financiera", async () => {
    const baseText =
      "Hola. Estoy aqui para ayudarte a registrar gastos, revisar pendientes y entender tu dinero sin culpa.";
    const result = await new ResponseAgent().compose(
      context({
        scenario: "conversation_greeting",
        base_text: baseText,
        original_user_text: "hola",
        facts: {
          amounts: [],
          pending_codes: [],
          links: [],
          movement_count: null,
          pending_count: null,
          risk_level: null,
        },
      }),
      "trace-3"
    );

    expect(result.output.response_text).toBe(baseText);
    expect(result.output.safety_flags).toContain("no_financial_write");
    expect(result.output.response_text).not.toContain("registrado");
  });
});
