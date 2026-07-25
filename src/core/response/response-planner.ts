import {
  planWhatsAppDelivery,
  type WhatsAppDeliveryPlan,
} from "@/adapters/whatsapp/window-manager";
import type { WhatsAppInteractivePayload } from "@/adapters/whatsapp/types";
import type { WhatsAppWindowState } from "@/data/repositories/whatsapp-window.repository";
import type { ExternalEventLog } from "@/core/events/domain-events";
import type { DataAgentIntent } from "@/agents/data-agent";
import {
  buildPendingItemWhatsAppCode,
  buildPendingWhatsAppCode,
} from "@/core/pending/whatsapp-pending-code";
import type { DataActionExecutionResult } from "@/core/orchestrator/data-action-executor";
import type { DataActionPendingCreationResult } from "@/core/orchestrator/data-action-pending";
import type { DataActionPlan } from "@/core/orchestrator/data-action-policy";
import type { CorrectionAgentOutput } from "@/agents/correction-agent";
import type {
  ConversationalAnswer,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import type { WhatsAppCorrectionResolutionResult } from "@/core/orchestrator/whatsapp-correction";
import type { CaptureDraftResolutionResult } from "@/core/orchestrator/capture-draft-memory";
import type { WhatsAppPendingResolutionResult } from "@/core/orchestrator/whatsapp-pending-confirmation";
import { buildDashboardDeepLink } from "@/shared/app-links";
import type { PendingItem } from "@/shared/types/domain";

export type ResponsePlannerResult =
  | {
      kind: "no_response";
      reason:
        | "agent_runtime_required"
        | "response_agent_required"
        | "non_text_message"
        | "missing_user"
        | "auto_ack_disabled";
      deliveryPlan: null;
    }
  | {
      kind: "whatsapp_freeform";
      reason:
        | "movement_created"
        | "movements_created"
        | "mixed_actions_processed"
        | "pending_created"
        | "pending_confirmed"
        | "pending_discarded"
        | "pending_listed"
        | "pending_reviewed"
        | "pending_updated"
        | "pending_resolution_needs_clarification"
        | "capture_draft_discarded"
        | "capture_draft_needs_clarification"
        | "correction_applied"
        | "correction_cancelled"
        | "correction_needs_confirmation"
        | "correction_needs_selection"
        | "correction_needs_clarification"
        | "blocked_financial_action"
        | "capture_needs_clarification"
        | "conversation_greeting"
        | "conversation_help"
        | "conversation_thanks"
        | "conversation_answer"
        | "local_auto_ack";
      text: string;
      deliveryPlan: WhatsAppDeliveryPlan;
    }
  | {
      kind: "whatsapp_interactive";
      reason:
        | "movement_created"
        | "movements_created"
        | "mixed_actions_processed"
        | "pending_created"
        | "pending_confirmed"
        | "pending_discarded"
        | "pending_listed"
        | "pending_reviewed"
        | "pending_updated"
        | "pending_resolution_needs_clarification"
        | "capture_draft_discarded"
        | "capture_draft_needs_clarification"
        | "correction_applied"
        | "correction_cancelled"
        | "correction_needs_confirmation"
        | "correction_needs_selection"
        | "correction_needs_clarification"
        | "blocked_financial_action"
        | "capture_needs_clarification"
        | "conversation_greeting"
        | "conversation_help"
        | "conversation_thanks"
        | "conversation_answer"
        | "local_auto_ack";
      text: string;
      interactive: WhatsAppInteractivePayload;
      deliveryPlan: WhatsAppDeliveryPlan;
    };

export type WhatsAppInboundResponsePlannerInput = {
  externalEvent: ExternalEventLog;
  windowState: WhatsAppWindowState | null;
  dataAgentCompleted?: boolean;
  dataAgentIntent?: DataAgentIntent;
  financialActionPlan?: DataActionPlan;
  financialActionExecution?: DataActionExecutionResult;
  pendingCreation?: DataActionPendingCreationResult;
  pendingResolution?: WhatsAppPendingResolutionResult;
  captureDraftResolution?: CaptureDraftResolutionResult;
  correctionProposal?: CorrectionAgentOutput;
  correctionResolution?: WhatsAppCorrectionResolutionResult;
  conversationAnswer?: ConversationalAnswer;
  supplementalConversationAnswer?: ConversationalAnswer;
  conversationTurnState?: ConversationTurnState;
  autoAckEnabled?: boolean;
  now?: Date;
};

export function planWhatsAppInboundResponse(
  input: WhatsAppInboundResponsePlannerInput
): ResponsePlannerResult {
  const messageType = readString(input.externalEvent.metadata.message_type);
  const text = readString(input.externalEvent.metadata.text);

  if (!input.externalEvent.user_id) {
    return {
      kind: "no_response",
      reason: "missing_user",
      deliveryPlan: null,
    };
  }

  if (!isActionableWhatsAppMessageType(messageType) || !text) {
    return {
      kind: "no_response",
      reason: "non_text_message",
      deliveryPlan: null,
    };
  }

  const productResponse = buildProductResponse(input);
  if (productResponse) {
    const deliveryPlan = planWhatsAppDelivery({
      state: input.windowState,
      intent: productResponse.intent,
      hasActionableValue: true,
      userInitiatedResponse: true,
      preferInteractive: Boolean(productResponse.interactive),
      now: input.now,
    });

    if (deliveryPlan.mode === "interactive" && productResponse.interactive) {
      return {
        kind: "whatsapp_interactive",
        reason: productResponse.reason,
        text: productResponse.text,
        interactive: productResponse.interactive,
        deliveryPlan,
      };
    }

    if (deliveryPlan.mode !== "freeform") {
      return {
        kind: "no_response",
        reason: "auto_ack_disabled",
        deliveryPlan: null,
      };
    }

    const text = composeProductResponseText(
      productResponse.text,
      productResponse.interactive,
      input.supplementalConversationAnswer
    );

    return {
      kind: "whatsapp_freeform",
      reason: productResponse.reason,
      text,
      deliveryPlan,
    };
  }

  const conversationAgentResponse = buildConversationAgentResponse(input);
  if (conversationAgentResponse) {
    const deliveryPlan = planWhatsAppDelivery({
      state: input.windowState,
      intent: "direct_response",
      hasActionableValue: true,
      userInitiatedResponse: true,
      now: input.now,
    });

    if (deliveryPlan.mode !== "freeform") {
      return {
        kind: "no_response",
        reason: "auto_ack_disabled",
        deliveryPlan: null,
      };
    }

    return {
      kind: "whatsapp_freeform",
      reason: conversationAgentResponse.reason,
      text: conversationAgentResponse.text,
      deliveryPlan,
    };
  }

  const conversationResponse = buildConversationBasicResponse(input);
  if (conversationResponse) {
    const deliveryPlan = planWhatsAppDelivery({
      state: input.windowState,
      intent: "direct_response",
      hasActionableValue: true,
      userInitiatedResponse: true,
      now: input.now,
    });

    if (deliveryPlan.mode !== "freeform") {
      return {
        kind: "no_response",
        reason: "auto_ack_disabled",
        deliveryPlan: null,
      };
    }

    return {
      kind: "whatsapp_freeform",
      reason: conversationResponse.reason,
      text: conversationResponse.text,
      deliveryPlan,
    };
  }

  if (!input.autoAckEnabled) {
    return {
      kind: "no_response",
      reason: input.dataAgentCompleted
        ? "response_agent_required"
        : "agent_runtime_required",
      deliveryPlan: null,
    };
  }

  const deliveryPlan = planWhatsAppDelivery({
    state: input.windowState,
    intent: "direct_response",
    hasActionableValue: true,
    userInitiatedResponse: true,
    now: input.now,
  });

  if (deliveryPlan.mode !== "freeform") {
    return {
      kind: "no_response",
      reason: "auto_ack_disabled",
      deliveryPlan: null,
    };
  }

  return {
    kind: "whatsapp_freeform",
    reason: "local_auto_ack",
    text: "Te leí. En breve lo reviso contigo.",
    deliveryPlan,
  };
}

function composeProductResponseText(
  productText: string,
  interactive: WhatsAppInteractivePayload | undefined,
  supplementalConversationAnswer: ConversationalAnswer | undefined
): string {
  // Interactive prompts must stay focused on the pending action. A completed
  // Core action can safely carry a separate read-only answer in the same turn.
  if (interactive || !supplementalConversationAnswer) return productText;

  return `${productText}\n\n${supplementalConversationAnswer.response_text}`;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isActionableWhatsAppMessageType(messageType: string | null): boolean {
  return (
    messageType === "text" ||
    messageType === "button" ||
    messageType === "interactive"
  );
}

function buildProductResponse(
  input: WhatsAppInboundResponsePlannerInput
): {
  reason: Extract<
    ResponsePlannerResult,
    { kind: "whatsapp_freeform" }
  >["reason"];
  text: string;
  intent: "direct_response" | "pending_confirmation";
  interactive?: WhatsAppInteractivePayload;
} | null {
  const execution = input.financialActionExecution;
  const pendingResolution = input.pendingResolution;
  const captureDraftResolution = input.captureDraftResolution;
  const correctionResolution = input.correctionResolution;
  if (correctionResolution?.kind === "applied") {
    const isDeleteCorrection = correctionResolution.command.kind === "delete";
    return {
      reason: "correction_applied",
      text:
        correctionResolution.reason === "already_applied"
          ? isDeleteCorrection
            ? "Listo. Ese movimiento ya estaba eliminado."
            : `Listo. Ese movimiento ya estaba como ${correctionResolution.summary}.`
          : isDeleteCorrection
            ? `Listo. Eliminé ${correctionResolution.summary}. Tus saldos ya se recalcularon.`
            : `Listo. Cambié ${correctionResolution.summary}. Tus saldos ya se recalcularon.`,
      intent: "direct_response",
    };
  }

  if (correctionResolution?.kind === "cancelled") {
    return {
      reason: "correction_cancelled",
      text: "Listo, no cambié nada.",
      intent: "direct_response",
    };
  }

  if (correctionResolution?.kind === "failed") {
    return {
      reason: "correction_needs_clarification",
      text: composeCorrectionFailedText(),
      intent: "direct_response",
    };
  }

  const correctionProposal = input.correctionProposal;
  if (correctionProposal?.kind === "requires_confirmation") {
    const isDeleteCorrection = correctionProposal.command.operation === "delete";
    const text = isDeleteCorrection
      ? `Creo que te refieres a ${correctionProposal.command.movement_label}. ¿Lo elimino?`
      : `Creo que te refieres a ${correctionProposal.command.movement_label}. ¿Lo cambio a ${correctionProposal.command.target_label}?`;
    return {
      reason: "correction_needs_confirmation",
      text,
      intent: "direct_response",
      interactive: {
        type: "button",
        bodyText: text,
        buttons: [
          {
            id: correctionProposal.command.command_id,
            title: isDeleteCorrection ? "Sí, eliminar" : "Sí, cambiar",
          },
          {
            id: "corr:cancel",
            title: "No cambiar",
          },
        ],
      },
    };
  }

  if (correctionProposal?.kind === "candidate_selection_required") {
    const isDeleteCorrection =
      correctionProposal.commands[0]?.operation === "delete";
    const text = isDeleteCorrection
      ? "¿Cuál movimiento elimino?"
      : `¿Cuál cambio a ${
          correctionProposal.commands[0]?.target_label ?? "esa corrección"
        }?`;
    return {
      reason: "correction_needs_selection",
      text,
      intent: "direct_response",
      interactive: {
        type: "button",
        bodyText: text,
        buttons: correctionProposal.commands.map((command) => ({
          id: command.command_id,
          title: command.button_title,
        })),
      },
    };
  }

  if (
    correctionProposal?.kind === "no_candidate" ||
    correctionProposal?.kind === "needs_clarification" ||
    correctionProposal?.kind === "unsupported"
  ) {
    return {
      reason: "correction_needs_clarification",
      text: composeCorrectionClarificationText(correctionProposal),
      intent: "direct_response",
    };
  }

  if (pendingResolution?.kind === "confirmed") {
    const description =
      humanizeDescription(pendingResolution.movement.description) ??
      "movimiento";
    if (pendingResolution.reason === "pending_auto_resolved_duplicate") {
      return {
        reason: "pending_confirmed",
        text: `Ese ${description} ya estaba registrado. Quité el pendiente duplicado sin volver a tocar tu saldo.`,
        intent: "direct_response",
      };
    }
    return {
      reason: "pending_confirmed",
      text: `Listo. ${description} por ${formatMoney(
        pendingResolution.movement.amount,
        pendingResolution.movement.currency
      )} confirmado.`,
      intent: "direct_response",
    };
  }

  if (pendingResolution?.kind === "discarded") {
    return {
      reason: "pending_discarded",
      text: "Listo. Ese pendiente quedó descartado. No tocaba tu saldo.",
      intent: "direct_response",
    };
  }

  if (pendingResolution?.kind === "reviewed") {
    return {
      reason: "pending_reviewed",
      text: composePendingAccountReviewText(pendingResolution),
      intent: "direct_response",
    };
  }

  if (pendingResolution?.kind === "updated") {
    const text = composePendingUpdatedText(pendingResolution);
    return {
      reason: "pending_updated",
      text,
      intent: pendingResolution.ready_for_confirmation
        ? "pending_confirmation"
        : "direct_response",
      interactive: pendingResolution.ready_for_confirmation
        ? buildPendingResolutionInteractive(
            pendingResolution.pending_item,
            text,
          )
        : undefined,
    };
  }

  if (captureDraftResolution?.kind === "discarded") {
    return {
      reason: "capture_draft_discarded",
      text: "Listo. No registre eso y no toque tu saldo.",
      intent: "direct_response",
    };
  }

  if (captureDraftResolution?.kind === "needs_clarification") {
    return {
      reason: "capture_draft_needs_clarification",
      text: composeCaptureDraftClarificationText(captureDraftResolution),
      intent: "direct_response",
    };
  }

  if (pendingResolution?.kind === "needs_clarification") {
    return {
      reason: "pending_resolution_needs_clarification",
      text: composePendingResolutionClarificationText(pendingResolution),
      intent: "direct_response",
    };
  }

  if (pendingResolution?.kind === "listed") {
    return {
      reason: "pending_listed",
      text: composePendingListText(pendingResolution),
      intent: "direct_response",
    };
  }

  const pending = input.pendingCreation;
  if (
    execution?.kind === "executed" &&
    execution.movements.length > 0 &&
    pending?.kind === "created" &&
    pending.pending_items.length > 0
  ) {
    const text = `${composeMovementCreatedText(execution)}\n${composePendingCreatedText(pending)}`;
    return {
      reason: "mixed_actions_processed",
      text,
      intent: "pending_confirmation",
      interactive:
        buildPendingCreatedInteractive(
          pending,
          text,
          input.externalEvent.user_id!
        ) ?? undefined,
    };
  }

  if (
    execution?.kind === "executed" &&
    (execution.movements.length > 0 || (execution.debts?.length ?? 0) > 0)
  ) {
    return {
      reason:
        execution.created_count === 1
          ? "movement_created"
          : "movements_created",
      text: composeMovementCreatedText(execution),
      intent: "direct_response",
    };
  }

  if (pending?.kind === "created" && pending.pending_items.length > 0) {
    const text = composePendingCreatedText(pending);
    return {
      reason: "pending_created",
      text,
      intent: "pending_confirmation",
      interactive:
        buildPendingCreatedInteractive(pending, text, input.externalEvent.user_id!) ??
        undefined,
    };
  }

  if (
    input.financialActionPlan?.kind === "blocked" &&
    execution?.kind === "not_executed" &&
    input.pendingCreation?.kind !== "created"
  ) {
    return {
      reason: "blocked_financial_action",
      text: composeBlockedFinancialActionText(input),
      intent: "direct_response",
    };
  }

  if (
    input.financialActionPlan?.kind === "no_action" &&
    input.dataAgentCompleted &&
    execution?.kind === "not_executed" &&
    input.pendingCreation?.kind !== "created" &&
    isCorrectionLikeInput(input)
  ) {
    return {
      reason: "blocked_financial_action",
      text: composeBlockedFinancialActionText(input),
      intent: "direct_response",
    };
  }

  if (
    input.financialActionPlan?.kind === "no_action" &&
    input.dataAgentCompleted &&
    execution?.kind === "not_executed" &&
    input.pendingCreation?.kind !== "created" &&
    input.conversationTurnState?.act === "financial_capture"
  ) {
    return {
      reason: "capture_needs_clarification",
      text:
        "Entendí que quieres registrar un movimiento, pero me falta un dato para hacerlo con seguridad. Dime el monto y qué fue, por ejemplo: \"20 en desayuno\".",
      intent: "direct_response",
    };
  }

  return null;
}

function buildConversationAgentResponse(
  input: WhatsAppInboundResponsePlannerInput
): {
  reason: Extract<
    ResponsePlannerResult,
    { kind: "whatsapp_freeform" }
  >["reason"];
  text: string;
} | null {
  if (!input.dataAgentCompleted || !input.conversationAnswer) return null;
  const canUseConversationAnswer =
    !input.dataAgentIntent ||
    input.dataAgentIntent === "conversation" ||
    input.dataAgentIntent === "unknown" ||
    input.conversationTurnState?.should_route_to_conversation_agent === true;

  if (!canUseConversationAnswer) {
    return null;
  }

  return {
    reason: "conversation_answer",
    text: input.conversationAnswer.response_text,
  };
}

function buildConversationBasicResponse(
  input: WhatsAppInboundResponsePlannerInput
): {
  reason: Extract<
    ResponsePlannerResult,
    { kind: "whatsapp_freeform" }
  >["reason"];
  text: string;
} | null {
  if (!input.dataAgentCompleted) return null;
  if (
    input.dataAgentIntent &&
    input.dataAgentIntent !== "conversation" &&
    input.dataAgentIntent !== "unknown"
  ) {
    return null;
  }

  const text = normalizeForIntent(
    readString(input.externalEvent.metadata.text) ?? ""
  );
  if (!text) return null;

  if (isGreetingText(text)) {
    const hasActiveThread =
      input.conversationTurnState?.personalization_cues.includes(
        "hay memoria conversacional activa"
      ) === true;
    return {
      reason: "conversation_greeting",
      text:
        hasActiveThread
          ? "Hola. Sigo por aqui y tengo el hilo reciente a la mano. Puedes pedirme la hora, cuenta, origen o detalle de lo anterior, o cambiar de tema con un gasto o duda de dinero."
          : "Hola. Estoy aqui para ayudarte a registrar gastos, revisar pendientes y entender tu dinero sin culpa.\n" +
            'Puedes escribirme algo como: "gaste 8 en cafe" o "ver pendientes".',
    };
  }

  if (isHelpText(text)) {
    return {
      reason: "conversation_help",
      text:
        "Puedes escribirme en natural. Por ahora puedo ayudarte con:\n" +
        "1. Registrar gastos o ingresos.\n" +
        "2. Separar movimientos dudosos en Pendientes.\n" +
        "3. Confirmar, descartar o ver pendientes.\n" +
        "4. Corregir movimientos recientes.\n" +
        'Prueba: "gaste 8 en cafe" o "ver pendientes".',
    };
  }

  if (isThanksText(text)) {
    return {
      reason: "conversation_thanks",
      text:
        'De nada. Cuando quieras, me escribes un gasto, una correccion o "ver pendientes".',
    };
  }

  return null;
}

function isGreetingText(text: string): boolean {
  return /^(hola|ola|holi|buenas|buenos dias|buenas tardes|buenas noches|hey|hello|hi|manzana)( manzana)?[.!?]*$/.test(
    text
  );
}

function isHelpText(text: string): boolean {
  return /^(ayuda|help|que puedes hacer|que haces|como funciona|como uso manzana|para que sirves|que puedo hacer|como empiezo)[.!?]*$/.test(
    text
  );
}

function isThanksText(text: string): boolean {
  return /^(gracias|muchas gracias|ok gracias|listo gracias|vale gracias|genial gracias|perfecto gracias|thanks)[.!?]*$/.test(
    text
  );
}

function composePendingListText(
  pendingResolution: Extract<WhatsAppPendingResolutionResult, { kind: "listed" }>
): string {
  if (pendingResolution.pending_items.length === 0) {
    return "No tienes pendientes por revisar. Nada pendiente esta tocando tu saldo.";
  }

  const rows = pendingResolution.pending_items
    .map((item, index) => {
      const summary = item.normalized_summary;
      const code = buildPendingItemWhatsAppCode(item);
      const title = humanizeDescription(summary.title ?? null) ?? "Pendiente";
      const amount =
        typeof summary.amount === "number" && Number.isFinite(summary.amount)
          ? ` - ${formatMoney(summary.amount, summary.currency ?? "PEN")}`
          : "";

      return `${index + 1}. ${code} - ${title}${amount}`;
    })
    .join("\n");

  const suffix =
    pendingResolution.pending_items.length >= 5
      ? "\nMostre los mas recientes."
      : "";

  return withPendingLink(
    `Tienes ${pendingResolution.pending_count} pendientes por revisar:\n${rows}${suffix}\nPara resolver uno: confirma P-XXXX o cancela P-XXXX.`
  );
}

function composePendingResolutionClarificationText(
  pendingResolution: Extract<
    WhatsAppPendingResolutionResult,
    { kind: "needs_clarification" }
  >
): string {
  const verb =
    pendingResolution.action === "discard" ? "descartar" : "confirmar";

  if (
    pendingResolution.reason === "possible_duplicate" &&
    pendingResolution.pending_item
  ) {
    const code = buildPendingItemWhatsAppCode(pendingResolution.pending_item);
    return withPendingLink(
      `Encontré un movimiento muy parecido ya registrado. Si son dos operaciones distintas, confirma ${code} otra vez; si no, puedes descartarlo.`
    );
  }

  if (
    pendingResolution.reason === "pending_requires_details" &&
    pendingResolution.pending_item
  ) {
    const code = buildPendingItemWhatsAppCode(
      pendingResolution.pending_item,
    );
    const movementType =
      pendingResolution.pending_item.proposed_action.movement_type;
    const required =
      movementType === "transferencia"
        ? "la cuenta de origen y la cuenta de destino"
        : movementType === "pago_deuda"
          ? "la deuda y la cuenta del pago"
          : "los datos financieros que faltan";
    return withPendingLink(
      `Antes de confirmar ${code}, necesito que completes ${required}. Revísalo en Pendientes y luego podrás confirmarlo sin que el sistema adivine.`
    );
  }

  if (
    pendingResolution.reason === "account_not_found" ||
    pendingResolution.reason === "account_currency_mismatch" ||
    pendingResolution.reason === "transfer_accounts_must_differ"
  ) {
    const detail =
      pendingResolution.reason === "account_not_found"
        ? "No encontré una de esas cuentas activas."
        : pendingResolution.reason === "account_currency_mismatch"
          ? "La cuenta elegida no usa la misma moneda que el movimiento."
          : "La cuenta de origen y destino deben ser distintas.";
    return withPendingLink(
      `${detail}\n${composeAccountOptions(
        pendingResolution.account_options ?? [],
      )}`,
    );
  }

  if (pendingResolution.reason === "pending_account_action_not_supported") {
    return withPendingLink(
      "Ese Pendiente necesita otro motor especializado. No cambié nada; revísalo en Pendientes para completar sus datos.",
    );
  }

  if (pendingResolution.reason === "pending_code_not_found") {
    return `No encontre ${pendingResolution.pending_code} entre tus pendientes activos. Escribe "ver pendientes" para ver la lista actual.`;
  }

  if (pendingResolution.reason === "pending_code_ambiguous") {
    return withPendingLink(
      "Ese código no fue suficiente para elegir un pendiente con seguridad."
    );
  }

  if (pendingResolution.reason === "multiple_active_pending") {
    return withPendingLink(
      `Tienes varios pendientes. Escribe "ver pendientes" para ver los códigos y elegir cuál ${verb}.`
    );
  }

  return `No encontre pendientes activos para ${verb}.`;
}

function composePendingAccountReviewText(
  pendingResolution: Extract<
    WhatsAppPendingResolutionResult,
    { kind: "reviewed" }
  >,
): string {
  const pending = pendingResolution.pending_item;
  const code = buildPendingItemWhatsAppCode(pending);
  const originHint = readString(pending.metadata.account_origin_hint);
  const destinationHint = readString(
    pending.metadata.account_destination_hint,
  );
  const hintText = [
    originHint ? `origen ${originHint}` : null,
    destinationHint ? `destino ${destinationHint}` : null,
  ]
    .filter(Boolean)
    .join(" y ");
  const options = composeAccountOptions(pendingResolution.account_options);
  const example =
    pendingResolution.account_options.length >= 2
      ? `Respóndeme, por ejemplo: "${code} fue de ${pendingResolution.account_options[0]!.name} a ${pendingResolution.account_options[1]!.name}".`
      : "Para una transferencia propia necesito dos cuentas existentes y distintas.";
  const externalExample =
    pendingResolution.account_options.length > 0
      ? `Si fue un pago a otra persona o comercio: "${code} fue un gasto desde ${pendingResolution.account_options[0]!.name}", o "${code} fue un gasto sin cuenta".`
      : `Si fue un pago externo, puedes decir: "${code} fue un gasto sin cuenta".`;
  return withPendingLink(
    [
      `Para revisar ${code}${hintText ? ` detecté ${hintText}` : ""}.`,
      options,
      example,
      externalExample,
      `Si no quieres registrarlo, responde "descartar ${code}".`,
    ].join("\n"),
  );
}

function composePendingUpdatedText(
  pendingResolution: Extract<
    WhatsAppPendingResolutionResult,
    { kind: "updated" }
  >,
): string {
  const pending = pendingResolution.pending_item;
  const code = buildPendingItemWhatsAppCode(pending);
  if (!pendingResolution.ready_for_confirmation) {
    return withPendingLink(
      [
        `Actualicé ${code}, pero aún falta otra cuenta para completar la transferencia.`,
        composeAccountOptions(pendingResolution.account_options),
        "No registré nada ni toqué tus saldos.",
      ].join("\n"),
    );
  }

  const origin = pendingResolution.account_options.find(
    (account) => account.id === pending.proposed_action.account_origin_id,
  );
  const destination = pendingResolution.account_options.find(
    (account) => account.id === pending.proposed_action.account_destination_id,
  );
  const movementType = readString(pending.proposed_action.movement_type);
  const category = pending.normalized_summary.category_id;
  const detail =
    movementType === "transferencia"
      ? `transferencia de ${origin?.name ?? "la cuenta elegida"} a ${
          destination?.name ?? "la cuenta elegida"
        }`
      : movementType === "ingreso"
        ? `ingreso${
            destination ? ` a ${destination.name}` : " sin cuenta asignada"
          }${category ? ` en ${category}` : ""}`
        : `gasto${
            origin ? ` desde ${origin.name}` : " sin cuenta asignada"
          }${category ? ` en ${category}` : ""}`;
  const learned =
    pendingResolution.learned_account_hints.length > 0
      ? " También recordé la asociación bancaria que pediste."
      : "";
  return `Actualicé ${code} como ${detail}. Aún no registré nada ni toqué tus saldos.${learned} ¿Lo confirmo?`;
}

function composeAccountOptions(
  accounts: Array<{ name: string; institution: string | null }>,
): string {
  if (accounts.length === 0) {
    return "No tienes cuentas compatibles con esa moneda. No crearé ninguna automáticamente.";
  }
  return [
    "Tus cuentas compatibles:",
    ...accounts.map(
      (account, index) =>
        `${index + 1}. ${account.name}${
          account.institution ? ` (${account.institution})` : ""
        }`,
    ),
  ].join("\n");
}

function composeCaptureDraftClarificationText(
  captureDraftResolution: Extract<
    CaptureDraftResolutionResult,
    { kind: "needs_clarification" }
  >
): string {
  if (captureDraftResolution.action === "discard") {
    return "No encontre algo reciente para descartar. Nada se cambio.";
  }

  return (
    "No encontre algo reciente para registrar con seguridad. " +
    'Escribeme el movimiento completo, por ejemplo: "gaste 20 en desayuno".'
  );
}

function composeMovementCreatedText(
  execution: Extract<DataActionExecutionResult, { kind: "executed" }>
): string {
  if (execution.debts?.length) {
    const debt = execution.debts[0]!;
    const schedule =
      debt.installment_count > 0
        ? ` Cree el calendario de ${debt.installment_count} cuotas${
            debt.first_due_date
              ? ` desde el ${formatDateOnly(debt.first_due_date)}`
              : ""
          }.`
        : "";
    const balanceNote = debt.movement_id
      ? " El movimiento vinculado fue confirmado por Core."
      : " La deuda no cambio el saldo de ninguna cuenta porque no indicaste una cuenta vinculada.";
    return `Listo. Cree ${debt.name} por ${formatMoney(
      debt.principal_amount,
      debt.currency,
    )}.${schedule}${balanceNote}`;
  }

  if (execution.movements.length === 1) {
    const movement = execution.movements[0];
    if (
      movement.movement_type === "pago_deuda" ||
      movement.movement_type === "devolucion_recibida"
    ) {
      const actionLabel =
        movement.movement_type === "pago_deuda" ? "pago" : "devolucion";
      const debtLabel = movement.debt_name
        ? ` de ${movement.debt_name}`
        : " de la deuda";
      const remaining =
        movement.debt_remaining_balance === null ||
        movement.debt_remaining_balance === undefined
          ? ""
          : ` Saldo pendiente: ${formatMoney(
              movement.debt_remaining_balance,
              movement.currency
            )}.`;
      return `Listo. Registre el ${actionLabel}${debtLabel} por ${formatMoney(
        movement.amount,
        movement.currency
      )}.${remaining}${composeNoAccountSuffix([movement])}`;
    }
    const description = humanizeDescription(movement.description) ?? "Movimiento";
    const base = `Listo. ${description} por ${formatMoney(
      movement.amount,
      movement.currency
    )} registrado.`;
    return `${base}${composeNoAccountSuffix([movement])}`;
  }

  const total = execution.movements.reduce(
    (sum, movement) => sum + movement.amount,
    0
  );
  const currency = execution.movements[0]?.currency ?? "PEN";
  const base = `Listo. ${execution.movements.length} movimientos registrados por ${formatMoney(
    total,
    currency
  )}.`;
  return `${base}${composeNoAccountSuffix(execution.movements)}`;
}

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split("-");
  return `${day}/${month}/${year}`;
}

function composeNoAccountSuffix(
  movements: Extract<DataActionExecutionResult, { kind: "executed" }>["movements"]
): string {
  const hasMovementWithoutAccount = movements.some((movement) => {
    if (movement.movement_type === "gasto") {
      return !movement.account_origin_id;
    }
    if (movement.movement_type === "ingreso") {
      return !movement.account_destination_id;
    }
    if (movement.movement_type === "pago_deuda") {
      return !movement.account_origin_id;
    }
    if (movement.movement_type === "devolucion_recibida") {
      return !movement.account_destination_id;
    }

    return false;
  });

  if (!hasMovementWithoutAccount) return "";

  return " Quedó sin cuenta por ahora, así que no moví ningún saldo de cuenta.";
}

function composePendingCreatedText(
  pending: Extract<DataActionPendingCreationResult, { kind: "created" }>
): string {
  if (pending.pending_items.length === 1) {
    const item = pending.pending_items[0];
    if (item.risk_level === "sensitive" || item.risk_level === "high") {
      return withPendingLink(
        "Lo separé para revisar con calma. No toca tu saldo hasta que confirmes."
      );
    }

    return withPendingLink(
      "Lo separé para revisar. Falta confirmar un dato y no toca tu saldo."
    );
  }

  return withPendingLink(
    `Separé ${pending.pending_items.length} movimientos para revisar. No tocan tu saldo hasta que confirmes.`
  );
}

function composeBlockedFinancialActionText(
  input: WhatsAppInboundResponsePlannerInput
): string {
  if (!isCorrectionLikeInput(input)) {
    return composeBlockedCaptureText(input.financialActionPlan);
  }

  const movementsUrl = buildDashboardDeepLink("movements");
  const text =
    "Te entendí. No cambié nada todavía: esa corrección necesita revisión antes de tocar dinero.";

  if (!movementsUrl) return text;

  return `${text}\nPuedes editarla desde Movimientos: ${movementsUrl}`;
}

function composeBlockedCaptureText(
  financialActionPlan: DataActionPlan | undefined
): string {
  const reasons =
    financialActionPlan?.actions.flatMap((action) => action.reasons) ?? [];
  const debtCreation = financialActionPlan?.actions.find(
    (action) => action.debt_creation_input,
  )?.debt_creation_input;
  if (reasons.includes("debt_creation_first_due_date_missing")) {
    return "Entendi la deuda y las cuotas. ¿Cuando vence la primera cuota?";
  }
  if (
    reasons.includes("debt_creation_confirmation_required") &&
    debtCreation
  ) {
    const installmentText = debtCreation.installment_count
      ? ` en ${debtCreation.installment_count} cuotas`
      : "";
    return `Borrador: ${debtCreation.name}, ${formatMoney(
      debtCreation.principal_amount,
      debtCreation.currency,
    )}${installmentText}. Todavia no la cree ni cambie tu saldo. ¿La confirmas?`;
  }
  if (reasons.includes("debt_reference_ambiguous")) {
    return "Entendi el pago, pero hay mas de una deuda compatible. Dime el nombre de la deuda o la persona para elegirla sin asumir.";
  }
  if (
    reasons.includes("debt_reference_missing") ||
    reasons.includes("debt_not_found")
  ) {
    return "Entendi el pago, pero no pude identificar la deuda. Dime el nombre de la deuda o la persona a quien pagaste.";
  }
  if (reasons.includes("debt_payment_exceeds_balance")) {
    return "No registre el pago porque supera el saldo pendiente de esa deuda. Revisa el monto y enviamelo otra vez.";
  }
  if (reasons.includes("debt_payment_currency_mismatch")) {
    return "No registre el pago porque la moneda no coincide con la deuda.";
  }
  if (reasons.includes("debt_payment_account_currency_mismatch")) {
    return "No registre el pago porque la moneda no coincide con la cuenta elegida.";
  }
  if (
    reasons.includes("debt_installment_not_found") ||
    reasons.includes("debt_installment_not_actionable")
  ) {
    return "No registre el pago porque esa cuota no es la cuota abierta que corresponde pagar primero.";
  }
  const missing: string[] = [];
  if (reasons.includes("missing_amount")) missing.push("el monto");
  if (reasons.includes("missing_description")) missing.push("que fue");

  const missingText =
    missing.length > 0
      ? `me falta ${formatSpanishList(missing)}`
      : "me falta un dato";

  return (
    `Te entendi, pero no lo registre todavia: ${missingText} para hacerlo sin asumir. ` +
    'Escribeme algo como: "gaste 20 en desayuno".'
  );
}

function formatSpanishList(items: string[]): string {
  if (items.length <= 1) return items[0] ?? "un dato";
  return `${items.slice(0, -1).join(", ")} y ${items[items.length - 1]}`;
}

function composeCorrectionClarificationText(
  correctionProposal: Extract<
    CorrectionAgentOutput,
    { kind: "no_candidate" | "needs_clarification" | "unsupported" }
  >
): string {
  const movementsUrl = buildDashboardDeepLink("movements");
  const base =
    correctionProposal.kind === "unsupported"
      ? "Te entendí, pero esa corrección todavía necesita revisión manual antes de tocar dinero."
      : "Te entendí, pero no pude elegir un movimiento con seguridad.";

  if (!movementsUrl) return base;
  return `${base}\nPuedes revisarlo desde Movimientos: ${movementsUrl}`;
}

function composeCorrectionFailedText(): string {
  const movementsUrl = buildDashboardDeepLink("movements");
  const base =
    "No pude aplicar esa corrección de forma segura. No cambié ningún movimiento.";

  if (!movementsUrl) return base;
  return `${base}\nPuedes revisarlo desde Movimientos: ${movementsUrl}`;
}

function isCorrectionLikeInput(
  input: WhatsAppInboundResponsePlannerInput
): boolean {
  if (input.dataAgentIntent === "correction") return true;

  const text = normalizeForIntent(
    readString(input.externalEvent.metadata.text) ?? ""
  );
  if (!text) return false;

  const hasCorrectionVerb = /\b(no fue|corrige|corregir|correccion|cambia|cambiar|era)\b/.test(
    text
  );
  const hasFinancialObject = /\b(gasto|ingreso|movimiento|prestamo|deuda|pago)\b/.test(
    text
  );

  return hasCorrectionVerb && hasFinancialObject;
}

function normalizeForIntent(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPendingCreatedInteractive(
  pending: Extract<DataActionPendingCreationResult, { kind: "created" }>,
  text: string,
  userId: string
): WhatsAppInteractivePayload | null {
  if (pending.pending_items.length !== 1) return null;

  const item = pending.pending_items[0];
  if (item.risk_level === "sensitive" || item.risk_level === "high") {
    return null;
  }

  const pendingCode = buildPendingWhatsAppCode({
    userId,
    pendingItemId: item.pending_item_id,
  });

  return {
    type: "button",
    bodyText: text,
    buttons: [
      { id: `confirmar ${pendingCode}`, title: "Confirmar" },
      { id: `descartar ${pendingCode}`, title: "Descartar" },
    ],
  };
}

function buildPendingResolutionInteractive(
  pendingItem: PendingItem,
  text: string,
): WhatsAppInteractivePayload {
  const pendingCode = buildPendingItemWhatsAppCode(pendingItem);
  return {
    type: "button",
    bodyText: text,
    buttons: [
      { id: `confirmar ${pendingCode}`, title: "Confirmar" },
      { id: `descartar ${pendingCode}`, title: "Descartar" },
    ],
  };
}

function withPendingLink(text: string): string {
  const pendingUrl = buildDashboardDeepLink("pending");
  if (!pendingUrl) return text;

  return `${text}\nTambién puedes abrir Pendientes: ${pendingUrl}`;
}

function cleanDescription(value: string | null): string | null {
  const text = value?.trim();
  return text || null;
}

function humanizeDescription(value: string | null): string | null {
  const text = cleanDescription(value);
  if (!text) return null;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatMoney(amount: number, currency: "PEN" | "USD"): string {
  const symbol = currency === "USD" ? "$" : "S/";
  return `${symbol}${amount.toFixed(2)}`;
}
