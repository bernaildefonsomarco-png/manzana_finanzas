import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import type { Block, TurnContext, TurnInput } from "@/core/channel/types";
import type { PresentTurn } from "@/core/orchestrator/financial-orchestrator";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import {
  getExternalEventByIdempotencyKey,
  recordExternalEvent,
} from "@/data/repositories/events.repository";
import { FinancialOrchestrator } from "@/core/orchestrator/financial-orchestrator";
import { buildWebPresentTurn } from "@/adapters/web/present-turn";
import { getCurrentDegradation } from "@/core/degradation/current-grade";
import { createServiceClient } from "@/data/supabase/server";
import { logger } from "@/shared/telemetry/logger";

// `AC-ASI-17`: en `solo_lectura` no se emiten tarjetas ni siquiera
// deshabilitadas — se quitan del plan antes de que el presentador las
// escriba, en vez de confiar en que el motor nunca las proponga.
const ACTION_BLOCK_KINDS = new Set<Block["kind"]>(["propuesta", "previsualizacion", "accion"]);

function withoutActionBlocks(plan: PlanTurnBlocksResult): PlanTurnBlocksResult {
  return {
    ...plan,
    blocks: plan.blocks.filter((block: Block) => !ACTION_BLOCK_KINDS.has(block.kind)),
  };
}

type Client = SupabaseClient<Database>;

export type HandleWebAssistantTurnInput = {
  client: Client;
  userId: string;
  threadId: string;
  text: string;
  /** `Idempotency-Key` de `POST /assistant/turns` (`41` §14, `WEB-D262`). */
  idempotencyKey: string;
  traceId: string;
  /** `RUL-ASI-11`: contexto de pantalla, llenado por el llamador con lo que la web ya sabe. */
  screenContext?: TurnContext;
};

export type HandleWebAssistantTurnResult =
  | { status: "accepted"; externalEventId: string; duplicate: false }
  | { status: "accepted"; externalEventId: string; duplicate: true }
  | { status: "rejected"; reason: "empty_text" };

const EMPTY_SCREEN_CONTEXT: TurnContext = {
  where: null,
  filters: null,
  selected: null,
  visible: [],
};

/**
 * Puente sincrono entre una peticion web y el motor (`41`: "no diseña
 * motor"). Otro canal de mensajeria encola el evento y lo procesa un
 * worker del outbox porque su webhook debe responder rapido; aqui no hay
 * ninguna urgencia de reconocimiento previa: el navegador ya esta esperando
 * la respuesta, asi que `FinancialOrchestrator.handleTurn` se llama
 * directamente, sin pasar por `transactional_outbox` (`WEB-D263`).
 */
export async function handleWebAssistantTurn(
  input: HandleWebAssistantTurnInput
): Promise<HandleWebAssistantTurnResult> {
  const text = input.text.trim();
  if (!text) {
    return { status: "rejected", reason: "empty_text" };
  }

  // `external_event_log` solo concede acceso a `service_role` (`008`,
  // `RLS` sin políticas para `authenticated`) — igual que el webhook de
  // WhatsApp, que ya usa `createServiceClient` para esta misma tabla. El
  // resto del turno sigue con `input.client` para no perder el alcance de
  // RLS sobre los datos propios del usuario.
  const serviceClient = createServiceClient();

  const existing = await getExternalEventByIdempotencyKey(serviceClient, {
    source: "dashboard",
    idempotency_key: input.idempotencyKey,
  });
  if (existing) {
    return { status: "accepted", externalEventId: existing.id, duplicate: true };
  }

  const payload = { text, thread_id: input.threadId };
  const externalEvent = await recordExternalEvent(serviceClient, {
    source: "dashboard",
    event_type: "assistant.turn_received",
    idempotency_key: input.idempotencyKey,
    user_id: input.userId,
    payload_hash: hashPayload(payload),
    trace_id: input.traceId,
    metadata: { thread_id: input.threadId, text },
  });

  await input.client.from("assistant_messages").insert({
    user_id: input.userId,
    thread_id: input.threadId,
    role: "usuario",
    content: [{ kind: "texto", text }],
    trace_id: input.traceId,
    idempotency_key: `assistant-request:${externalEvent.id}`,
  });

  const degradation = getCurrentDegradation();

  // `RUL-ASI-13`/`ERR-ASI-01`: sin modelo no hay respuesta aproximada — ni
  // siquiera se intenta el turno, se declara el limite con su via manual.
  if (degradation.decision.grado === "sin_modelo") {
    await insertUnavailableModelResponse(input.client, {
      userId: input.userId,
      threadId: input.threadId,
      traceId: input.traceId,
      externalEventId: externalEvent.id,
    });
    return { status: "accepted", externalEventId: externalEvent.id, duplicate: false };
  }

  const turnInput: TurnInput = {
    actor: "user",
    text,
    choice: null,
    confirmation: null,
    attachments: [],
    context: input.screenContext ?? EMPTY_SCREEN_CONTEXT,
    channel: "dashboard",
  };

  const rawPresentTurn = await buildWebPresentTurn({
    client: serviceClient,
    externalEvent,
    threadId: input.threadId,
    useResponseAgent: true,
  });

  // `AC-ASI-17`: en `solo_lectura` el motor puede seguir respondiendo, pero
  // el canal nunca emite una tarjeta de accion (ni deshabilitada).
  const presentTurn: PresentTurn = degradation.decision.puedeProponerAcciones
    ? rawPresentTurn
    : (plan, context) => rawPresentTurn(withoutActionBlocks(plan), context);

  // `FinancialOrchestrator` siempre corre con el cliente de servicio — el
  // mismo contrato que ya usa el canal de WhatsApp
  // (`whatsapp-orchestration-handler.ts`): el motor lee `external_event_log`
  // internamente (solo `service_role`) y filtra por `user_id` en sus propias
  // consultas, no depende de RLS del cliente que lo invoca.
  const orchestrator = new FinancialOrchestrator(serviceClient, {
    executeReadyDataActions: shouldExecuteReadyDataActionsForAssistant(),
    presentTurn,
  });

  try {
    await orchestrator.handleTurn({
      externalEventId: externalEvent.id,
      turnInput,
      traceId: input.traceId,
    });
  } catch (error) {
    logger.error("assistant.handle_web_turn_failed", {
      error,
      external_event_id: externalEvent.id,
      trace_id: input.traceId,
    });
    throw error;
  }

  return { status: "accepted", externalEventId: externalEvent.id, duplicate: false };
}

/**
 * Mismo interruptor de seguridad que ya usa el otro canal de mensajeria
 * (su propio manejador de orquestacion del outbox): en producción, ninguna
 * acción de nivel `ninguna` se ejecuta sola a menos que se habilite
 * explícitamente por variable de entorno. El asistente web no hereda un
 * valor más permisivo por defecto solo por ser un canal nuevo.
 */
function shouldExecuteReadyDataActionsForAssistant(): boolean {
  if (process.env.ASSISTANT_EXECUTE_READY_ACTIONS === "true") return true;
  return process.env.APP_ENV === "local";
}

/** `ERR-ASI-01`: "No puedo ayudarte con eso ahora mismo." + la via manual concreta que da `41` §9. */
async function insertUnavailableModelResponse(
  client: Client,
  input: { userId: string; threadId: string; traceId: string; externalEventId: string }
): Promise<void> {
  const blocks: Block[] = [
    {
      kind: "limite",
      text: "No puedo ayudarte con eso ahora mismo.",
      manualPath: "/movimientos/nuevo",
    },
  ];

  const { error } = await client.from("assistant_messages").insert({
    user_id: input.userId,
    thread_id: input.threadId,
    role: "asistente",
    content: blocks as unknown as Json,
    trace_id: input.traceId,
    idempotency_key: `assistant-response:${input.externalEventId}`,
  });

  if (error && error.code !== "23505") {
    logger.error("assistant.sin_modelo_insert_failed", {
      error,
      external_event_id: input.externalEventId,
    });
  }
}

function hashPayload(payload: unknown): string {
  return createHash("sha256")
    .update(JSON.stringify(payload), "utf8")
    .digest("hex");
}
