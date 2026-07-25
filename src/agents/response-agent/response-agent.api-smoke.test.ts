import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ResponseAgent } from "@/agents/response-agent";
import type { ConversationStyleProfile } from "@/agents/conversation-agent";
import type { ExternalEventLog } from "@/core/events/domain-events";
import { countEmoji } from "@/core/response/conversation-style-policy";
import { maybeEnhanceWhatsAppResponseWithAgent } from "@/core/response/response-agent-enhancer";
import type { ResponseAgentEnhancementTrace } from "@/core/response/response-agent-enhancer";
import type { ResponsePlannerResult } from "@/core/response/response-planner";

const shouldRunSmoke = process.env.RUN_OPENAI_AGENT_SMOKE === "true";
const describeIf = shouldRunSmoke ? describe : describe.skip;
const originalEnv = new Map<string, string | undefined>();

describeIf("ResponseAgent OpenAI API smoke", () => {
  beforeAll(() => {
    loadEnvLocalIfNeeded();
    setEnv("AGENT_RUNTIME_RESPONSE_AGENT_PROVIDER", "api");
    setEnv("AGENT_RUNTIME_DEFAULT_PROVIDER", "local_fixture");
    setEnv("AGENT_RUNTIME_API_KIND", "openai");
    setEnv("AGENT_RUNTIME_FALLBACK_LOCAL", "false");

    if (!process.env.OPENAI_API_KEY && !process.env.AGENT_RUNTIME_API_TOKEN) {
      throw new Error(
        "RUN_OPENAI_AGENT_SMOKE=true requiere OPENAI_API_KEY o AGENT_RUNTIME_API_TOKEN."
      );
    }

    if (!process.env.AGENT_RUNTIME_API_MODEL) {
      throw new Error(
        "RUN_OPENAI_AGENT_SMOKE=true requiere AGENT_RUNTIME_API_MODEL."
      );
    }
  });

  afterAll(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it(
    "preserva hechos y montos de un registro confirmado",
    async () => {
      const result = await enhanceWithRealApi(
        whatsappFreeformPlan({
          reason: "movement_created",
          text: "Listo. Desayuno por S/10.00 registrado.",
        }),
        "gasté 10 en desayuno",
        "trace-response-agent-api-movement"
      );

      expectCompletedApiTrace(result.trace);
      const text = expectSendableResponseText(result.responsePlan);
      expect(result.responsePlan).toMatchObject({ kind: "whatsapp_freeform" });
      expect(text).toContain("S/10.00");
      expect(text.toLowerCase()).toContain("registr");
    },
    60_000
  );

  it(
    "preserva link, confirmacion y saldo protegido en pendientes",
    async () => {
      const baseText =
        "Lo separé para revisar. No toca tu saldo hasta que confirmes.\n" +
        "También puedes abrir Pendientes: https://manzana.website/?view=pending";
      const result = await enhanceWithRealApi(
        whatsappInteractivePlan({
          reason: "pending_created",
          text: baseText,
        }),
        "gasté 10 en desayuno",
        "trace-response-agent-api-pending"
      );

      expectCompletedApiTrace(result.trace);
      const text = expectSendableResponseText(result.responsePlan);
      expect(result.responsePlan).toMatchObject({
        kind: "whatsapp_interactive",
      });
      expect(text).toContain(
        "https://manzana.website/?view=pending"
      );
      expect(text.toLowerCase()).toContain(
        "no toca tu saldo"
      );
      expect(text.toLowerCase()).toContain("confirm");
    },
    60_000
  );

  it(
    "aplica una instruccion libre de sesion sin alterar los hechos financieros",
    async () => {
      const result = await enhanceWithRealApi(
        whatsappFreeformPlan({
          reason: "movement_created",
          text: "Listo. Desayuno por S/10.00 registrado.",
        }),
        "gaste 10 en desayuno",
        "trace-response-agent-api-style-session",
        {
          instruction:
            "Responde como una guia de expedicion serena: usa una comparacion breve, se calido, directo y agrega un solo emoji cuando sea seguro.",
          response_length: "shorter",
          formality: "inherit",
          warmth: "warm",
          playfulness: "light",
          directness: "direct",
          emoji_policy: "limited",
          scope: "session",
          source: "explicit_user_request",
          updated_at: "2026-07-21T12:00:00.000-05:00",
        },
      );

      expectCompletedApiTrace(result.trace);
      expect(result.trace).toMatchObject({
        style_active: true,
        style_scope: "session",
        style_adherence: "applied",
      });
      const text = expectSendableResponseText(result.responsePlan);
      expect(text).toContain("S/10.00");
      expect(text.toLowerCase()).toContain("registr");
      expect(countEmoji(text)).toBe(1);
    },
    60_000
  );
});

async function enhanceWithRealApi(
  responsePlan: Extract<
    ResponsePlannerResult,
    { kind: "whatsapp_freeform" | "whatsapp_interactive" }
  >,
  text: string,
  traceId: string,
  conversationStyle: ConversationStyleProfile | null = null,
) {
  const result = await maybeEnhanceWhatsAppResponseWithAgent({
    externalEvent: externalEvent(text),
    responsePlan,
    responseAgent: new ResponseAgent(),
    traceId,
    conversationStyle,
    conversationTurnState: {
      act: "financial_capture",
      continuity: "new_topic",
      emotional_state: "neutral",
      experience_mode: "quick_capture",
      should_use_active_memory: false,
      should_route_to_conversation_agent: false,
      should_ask_clarification_first: false,
      response_guidance: ["confirmar sin friccion"],
      personalization_cues: ["personalizacion ligera"],
      risk_notes: [],
    },
  });

  console.info("ResponseAgent API smoke", {
    trace: result.trace,
    text: result.responsePlan.kind === "no_response"
      ? null
      : result.responsePlan.text,
  });

  return result;
}

function expectCompletedApiTrace(trace: ResponseAgentEnhancementTrace) {
  expect(trace.status).toBe("completed");
  if (trace.status !== "completed") {
    throw new Error(`ResponseAgent smoke no fue aceptado: ${JSON.stringify(trace)}`);
  }

  expect(trace.provider).toBe("api");
  expect(trace.safety_flags.some((flag) => flag.startsWith("runtime_fallback_from")))
    .toBe(false);
}

function expectSendableResponseText(responsePlan: ResponsePlannerResult) {
  if (
    responsePlan.kind !== "whatsapp_freeform" &&
    responsePlan.kind !== "whatsapp_interactive"
  ) {
    throw new Error(`ResponsePlan no enviable: ${JSON.stringify(responsePlan)}`);
  }

  return responsePlan.text;
}

function whatsappFreeformPlan(params: {
  reason: Extract<ResponsePlannerResult, { kind: "whatsapp_freeform" }>["reason"];
  text: string;
}): Extract<ResponsePlannerResult, { kind: "whatsapp_freeform" }> {
  return {
    kind: "whatsapp_freeform",
    reason: params.reason,
    text: params.text,
    deliveryPlan: {
      mode: "freeform",
      windowStatus: "open",
      hoursUntilClose: 24,
      requiresPaidTemplate: false,
      reason: "user_initiated_response",
    },
  };
}

function whatsappInteractivePlan(params: {
  reason: Extract<ResponsePlannerResult, { kind: "whatsapp_interactive" }>["reason"];
  text: string;
}): Extract<ResponsePlannerResult, { kind: "whatsapp_interactive" }> {
  return {
    kind: "whatsapp_interactive",
    reason: params.reason,
    text: params.text,
    interactive: {
      type: "button",
      bodyText: params.text,
      buttons: [
        { id: "confirmar", title: "Confirmar" },
        { id: "descartar", title: "Descartar" },
      ],
    },
    deliveryPlan: {
      mode: "interactive",
      windowStatus: "open",
      hoursUntilClose: 24,
      requiresPaidTemplate: false,
      reason: "user_initiated_response",
    },
  };
}

function externalEvent(text: string): ExternalEventLog {
  return {
    id: "00000000-0000-4000-8000-000000000101",
    source: "whatsapp",
    event_type: "whatsapp.message_received",
    idempotency_key: `kapso:message:${text}`,
    user_id: "00000000-0000-4000-8000-000000000102",
    received_at: "2026-07-14T12:00:00.000Z",
    status: "received",
    payload_hash: "hash",
    payload_ref: null,
    trace_id: "00000000-0000-4000-8000-000000000103",
    metadata: {
      message_type: "text",
      text,
    },
    created_at: "2026-07-14T12:00:00.000Z",
    updated_at: "2026-07-14T12:00:00.000Z",
  };
}

function loadEnvLocalIfNeeded() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;

  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquote(trimmed.slice(separatorIndex + 1).trim());
    if (!process.env[key]) {
      setEnv(key, value);
    }
  }
}

function setEnv(key: string, value: string) {
  if (!originalEnv.has(key)) {
    originalEnv.set(key, process.env[key]);
  }
  process.env[key] = value;
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}
