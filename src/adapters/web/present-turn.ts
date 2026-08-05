import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/data/supabase/types";
import type { ExternalEventLog } from "@/core/events/domain-events";
import type { Block, EvidenceReference, PresentedTurn } from "@/core/channel/types";
import type {
  PresentTurn,
  PresentTurnContext,
} from "@/core/orchestrator/financial-orchestrator";
import type { PlanTurnBlocksResult } from "@/core/response/response-planner";
import { listPendingItemsBySourceRefPrefix } from "@/data/repositories/pending.repository";
import { logger } from "@/shared/telemetry/logger";
import { ResponseAgent } from "@/agents/response-agent";
import { getActiveConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import { readPersistentConversationStyle } from "@/core/conversation/conversation-style-preferences";
import { formatConversationStyleInstruction } from "@/core/response/conversation-style-policy";
import {
  enhanceResponseText,
  type ResponseAgentEnhancementTrace,
} from "@/core/response/response-agent-enhancement";

type Client = SupabaseClient<Database>;

/**
 * Construye el `presentTurn` inyectado en `FinancialOrchestrator` (21 S6)
 * para el canal web (`41`): el nucleo nunca importa nada de aqui, solo
 * llama la funcion que este adaptador le entrega.
 *
 * A diferencia de WhatsApp, no "traduce" los bloques a texto: los persiste
 * tal cual en `assistant_messages.content` (13 S7.5 — "bloques neutrales de
 * canal, no texto renderizado") y el frontend (fase 4/5) los renderiza como
 * componentes.
 */
export async function buildWebPresentTurn(params: {
  client: Client;
  externalEvent: ExternalEventLog;
  threadId: string;
  responseAgent?: ResponseAgent;
  useResponseAgent: boolean;
}): Promise<PresentTurn> {
  const client = params.client;
  const externalEvent = params.externalEvent;
  const responseAgent = params.responseAgent ?? new ResponseAgent();

  return async (
    plan: PlanTurnBlocksResult,
    context: PresentTurnContext
  ): Promise<PresentedTurn> => {
    const userId = externalEvent.user_id;
    if (!userId) {
      return notPresentable("missing_user");
    }

    // `RSP-WEB-01`: a diferencia de WhatsApp, un turno web casi siempre
    // persiste varios bloques tipados (propuesta, pregunta, cifra...) que
    // el frontend renderiza como componentes propios. Solo el bloque
    // `texto` puro (respuesta conversacional sin UI propia) pasa por
    // `ResponseAgent`; el resto se persiste exactamente como lo entrego
    // `response-planner.ts`.
    const { blocks: presentedBlocks, enhancement } = await enhanceTextoBlockForWeb({
      client,
      externalEvent,
      userId,
      plan,
      context,
      responseAgent,
      useResponseAgent: params.useResponseAgent,
    });

    // `WEB-D263`: un bloque `propuesta`/`previsualizacion` se enlaza con su
    // pendiente real correlacionando por `source_ref`
    // (`"{channel}:{externalEventId}:{actionId}"`, ya escrito por
    // `data-action-pending.ts`) en vez de inventar una segunda forma de
    // transportar el pendiente hasta el presentador.
    const sourceRefPrefix = `dashboard:${externalEvent.id}:`;
    const pendingItems = await listPendingItemsBySourceRefPrefix(
      client,
      userId,
      sourceRefPrefix
    ).catch((error) => {
      logger.error("web_present_turn.list_pending_failed", {
        error,
        external_event_id: externalEvent.id,
      });
      return [];
    });

    const hasProposalBlock = presentedBlocks.some(
      (block) => block.kind === "propuesta" || block.kind === "previsualizacion"
    );
    const proposedAction: Json | null =
      hasProposalBlock && pendingItems.length > 0
        ? ({
            kind: "pending_item",
            pending_item_ids: pendingItems.map((item) => item.id),
          } as Json)
        : null;
    const actionStatus = proposedAction ? ("propuesta" as const) : null;

    const evidenceRefs = collectEvidenceRefs(presentedBlocks);
    const text = presentedBlocks
      .map((block) => ("text" in block ? block.text : null))
      .filter((value): value is string => Boolean(value))
      .join("\n\n");

    const { error } = await client.from("assistant_messages").insert({
      user_id: userId,
      thread_id: params.threadId,
      role: "asistente",
      content: presentedBlocks as unknown as Json,
      evidence_refs: evidenceRefs,
      proposed_action: proposedAction,
      action_status: actionStatus,
      trace_id: context.traceId,
      idempotency_key: `assistant-response:${externalEvent.id}`,
    });

    if (error) {
      // `assistant_messages_unique_idempotency` puede rechazar un reintento
      // exacto del mismo turno: no es un fallo de presentacion, es la
      // idempotencia funcionando.
      if (error.code !== "23505") {
        logger.error("web_present_turn.insert_failed", {
          error,
          external_event_id: externalEvent.id,
        });
      }
      return notPresentable(error.code === "23505" ? "duplicate" : "insert_failed");
    }

    return {
      text: text || null,
      deliveryMode: "web_panel",
      interactiveOptionCount: countOptions(presentedBlocks),
      sendStatus: "sent",
      sendReason: plan.reason,
      idempotent: false,
      providerMessageId: null,
      errorCode: null,
      enhancement,
    };
  };
}

/**
 * Mejora el unico bloque `texto` del turno (si existe) con `ResponseAgent`,
 * con las mismas salvaguardas que ya usa WhatsApp
 * (`whatsapp/response-enhancer.ts`, via el nucleo compartido en
 * `core/response/response-agent-enhancement.ts`): nunca inventa ni pierde
 * un monto, un link, un codigo de pendiente o una frase de seguridad, y si
 * el intento se rechaza o falla, el texto original se mantiene sin cambios.
 */
async function enhanceTextoBlockForWeb(params: {
  client: Client;
  externalEvent: ExternalEventLog;
  userId: string;
  plan: PlanTurnBlocksResult;
  context: PresentTurnContext;
  responseAgent: ResponseAgent;
  useResponseAgent: boolean;
}): Promise<{ blocks: Block[]; enhancement: PresentedTurn["enhancement"] }> {
  const { client, externalEvent, userId, plan, context, responseAgent, useResponseAgent } =
    params;

  const textoIndex = plan.blocks.findIndex((block) => block.kind === "texto");
  if (context.skipEnhancement || !useResponseAgent || textoIndex === -1) {
    return {
      blocks: plan.blocks,
      enhancement: noEnhancementStub("web_channel_no_enhancement"),
    };
  }

  const [activeConversationState, preferencesResult] = await Promise.all([
    getActiveConversationMemoryState(client, {
      userId,
      channel: "dashboard",
      now: externalEvent.received_at,
    }),
    client
      .from("user_preferences")
      .select("tone_style,discreet_mode_enabled,metadata")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);

  const persistentStyle =
    preferencesResult.error === null
      ? readPersistentConversationStyle({
          metadata: preferencesResult.data?.metadata,
          legacyToneStyle: preferencesResult.data?.tone_style,
        })
      : null;
  const effectiveStyle =
    context.styleOverride ??
    activeConversationState?.working_set?.conversation_style ??
    persistentStyle ??
    null;
  const preferredTone =
    formatConversationStyleInstruction(effectiveStyle) ??
    (preferencesResult.error === null
      ? (preferencesResult.data?.tone_style ?? null)
      : null);

  const textoBlock = plan.blocks[textoIndex] as Extract<Block, { kind: "texto" }>;

  const { text, trace } = await enhanceResponseText({
    baseText: textoBlock.text,
    channel: "dashboard",
    reason: plan.reason,
    externalEvent,
    responseAgent,
    traceId: context.traceId,
    timezone: context.timezone,
    discreetMode:
      preferencesResult.error === null &&
      preferencesResult.data?.discreet_mode_enabled === true,
    conversationTurnState: context.conversationTurnState,
    activeConversationState,
    preferredTone,
    conversationStyle: effectiveStyle,
  });

  const blocks = plan.blocks.map((block, index) =>
    index === textoIndex ? { ...block, text } : block
  );

  return { blocks, enhancement: traceToPresentedEnhancement(trace) };
}

function traceToPresentedEnhancement(
  trace: ResponseAgentEnhancementTrace
): PresentedTurn["enhancement"] {
  return {
    status: trace.status,
    reason: trace.reason,
    confidence: trace.confidence,
    provider: trace.provider,
    model: trace.model_name,
    latencyMs: trace.latency_ms,
    safetyFlags: trace.safety_flags,
    styleActive: trace.style_active ?? false,
    styleScope: trace.style_scope ?? null,
    styleAdherence: trace.style_adherence ?? null,
    styleBlockedReasons: trace.style_blocked_reasons ?? [],
    attemptCount: trace.attempt_count ?? 0,
  };
}

function notPresentable(reason: string): PresentedTurn {
  return {
    text: null,
    deliveryMode: null,
    interactiveOptionCount: null,
    sendStatus: "not_sent",
    sendReason: reason,
    idempotent: false,
    providerMessageId: null,
    errorCode: null,
    enhancement: noEnhancementStub("web_channel_no_enhancement"),
  };
}

function noEnhancementStub(reason: string): PresentedTurn["enhancement"] {
  return {
    status: "not_applicable",
    reason,
    confidence: null,
    provider: null,
    model: null,
    latencyMs: null,
    safetyFlags: [],
    styleActive: false,
    styleScope: null,
    styleAdherence: null,
    styleBlockedReasons: [],
    attemptCount: 0,
  };
}

function collectEvidenceRefs(blocks: Block[]): string[] {
  const refs: EvidenceReference[] = [];
  for (const block of blocks) {
    if (block.kind === "cifra" || block.kind === "hallazgo") {
      refs.push(...block.references);
    }
  }
  return refs.map((ref) => `${ref.kind}:${ref.id}`);
}

function countOptions(blocks: Block[]): number | null {
  for (const block of blocks) {
    if (block.kind === "pregunta") return block.options.length;
    if (block.kind === "propuesta") return block.options.length;
  }
  return null;
}
