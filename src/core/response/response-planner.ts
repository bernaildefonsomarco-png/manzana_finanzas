import type { Block, BlockOption, EvidenceReference, TurnInput } from "@/core/channel/types";
import { verifyBlocks } from "@/core/channel/types";
import type { DataAgentIntent } from "@/agents/data-agent";
import { buildPendingItemReferenceCode, buildPendingReferenceCode } from "@/core/pending/reference-code";
import type { DataActionExecutionResult } from "@/core/orchestrator/data-action-executor";
import type { DataActionPendingCreationResult } from "@/core/orchestrator/data-action-pending";
import type { DataActionPlan } from "@/core/orchestrator/data-action-policy";
import type { CorrectionAgentOutput } from "@/agents/correction-agent";
import type {
  ConversationalAnswer,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import type { CorrectionResolutionResult } from "@/core/orchestrator/correction-resolution";
import type { CaptureDraftResolutionResult } from "@/core/orchestrator/capture-draft-memory";
import type { PendingResolutionResult } from "@/core/orchestrator/pending-resolution-from-text";
import {
  buildStructureCommandText,
  entityLabel,
  STRUCTURE_CANCEL_COMMAND_ID,
  type StructureProposal,
} from "@/core/structure/structure-proposal";
import type { StructureResolutionResult } from "@/core/structure/structure-resolution";
import { buildDashboardDeepLink } from "@/shared/app-links";
import type { PendingItem } from "@/shared/types/domain";

export type TurnResponsePlannerInput = {
  turnInput: TurnInput;
  userId: string | null;
  dataAgentCompleted?: boolean;
  dataAgentIntent?: DataAgentIntent;
  financialActionPlan?: DataActionPlan;
  financialActionExecution?: DataActionExecutionResult;
  pendingCreation?: DataActionPendingCreationResult;
  pendingResolution?: PendingResolutionResult;
  captureDraftResolution?: CaptureDraftResolutionResult;
  correctionProposal?: CorrectionAgentOutput;
  correctionResolution?: CorrectionResolutionResult;
  /** Borrador de caja, meta o presupuesto que este turno propone (`RUL-ESTR-03`). */
  structureProposal?: StructureProposal;
  /** Lectura ambigua caja/meta/presupuesto: se pregunta, no se escribe (`RUL-PRES-01`). */
  structureAmbiguityQuestion?: string;
  structureResolution?: StructureResolutionResult;
  conversationAnswer?: ConversationalAnswer;
  supplementalConversationAnswer?: ConversationalAnswer;
  conversationTurnState?: ConversationTurnState;
  autoAckEnabled?: boolean;
};

export type PlanTurnBlocksResult = {
  blocks: Block[];
  // pending_confirmation: este turno espera una respuesta corta del usuario
  // sobre un pendiente concreto, y algunos canales dan a eso una ventana de
  // entrega distinta a una respuesta informativa cualquiera. No es un campo
  // de canal: es de qué habla el turno.
  intent: "direct_response" | "pending_confirmation";
  reason:
    | "agent_runtime_required"
    | "response_agent_required"
    | "non_text_input"
    | "missing_user"
    | "auto_ack_disabled"
    | ProductResponseReason
    | "conversation_greeting"
    | "conversation_help"
    | "conversation_thanks"
    | "conversation_answer"
    | "local_auto_ack";
};

/**
 * Puerto de salida (21 S5, S8): decide que comunicar este turno y lo
 * devuelve como bloques, sin saber que canal los va a presentar. La forma
 * de entrega (texto libre, botones interactivos, ventana de mensajeria) es
 * responsabilidad de cada adaptador de canal, no de este planificador.
 */
export function planTurnBlocks(input: TurnResponsePlannerInput): PlanTurnBlocksResult {
  if (!input.userId) {
    return { blocks: [], intent: "direct_response", reason: "missing_user" };
  }

  if (!input.turnInput.text) {
    return { blocks: [], intent: "direct_response", reason: "non_text_input" };
  }

  const productResponse = buildProductResponse(input);
  if (productResponse) {
    const blocks = appendSupplementalAnswer(
      toBlocks(productResponse),
      input.supplementalConversationAnswer
    );
    return {
      blocks: verifyBlocks(blocks),
      intent: productResponse.intent,
      reason: productResponse.reason,
    };
  }

  const conversationAgentResponse = buildConversationAgentResponse(input);
  if (conversationAgentResponse) {
    return {
      blocks: [{ kind: "texto", text: conversationAgentResponse.text }],
      intent: "direct_response",
      reason: conversationAgentResponse.reason,
    };
  }

  const conversationResponse = buildConversationBasicResponse(input);
  if (conversationResponse) {
    return {
      blocks: [{ kind: "texto", text: conversationResponse.text }],
      intent: "direct_response",
      reason: conversationResponse.reason,
    };
  }

  if (!input.autoAckEnabled) {
    return {
      blocks: [],
      intent: "direct_response",
      reason: input.dataAgentCompleted
        ? "response_agent_required"
        : "agent_runtime_required",
    };
  }

  return {
    blocks: [{ kind: "texto", text: "Te leí. En breve lo reviso contigo." }],
    intent: "direct_response",
    reason: "local_auto_ack",
  };
}

type ProductResponseReason =
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
  | "structure_needs_confirmation"
  | "structure_needs_clarification"
  | "structure_applied"
  | "structure_cancelled"
  | "structure_failed"
  | "ready_for_core_not_executed";

type ProductResponse = {
  reason: ProductResponseReason;
  intent: "direct_response" | "pending_confirmation";
  text: string;
  shape: "texto" | "propuesta" | "pregunta" | "lista" | "limite";
  options?: BlockOption[];
  proposalCommandId?: string;
  references?: EvidenceReference[];
  amount?: { value: number; currency: "PEN" | "USD" };
  listItems?: PendingItem[];
  manualPath?: string | null;
};

function toBlocks(response: ProductResponse): Block[] {
  if (response.shape === "propuesta") {
    return [
      {
        kind: "propuesta",
        text: response.text,
        commandId: response.proposalCommandId ?? "",
        options: response.options ?? [],
      },
    ];
  }

  if (response.shape === "pregunta") {
    return [{ kind: "pregunta", text: response.text, options: response.options ?? [] }];
  }

  if (response.shape === "limite") {
    return [{ kind: "limite", text: response.text, manualPath: response.manualPath ?? null }];
  }

  if (response.shape === "lista" && response.listItems) {
    return [
      {
        kind: "lista",
        text: response.text,
        items: response.listItems.map((item) => ({
          label: composePendingListRowLabel(item),
          references: [{ kind: "pendiente", id: item.id }],
        })),
      },
    ];
  }

  if (response.amount && response.references && response.references.length > 0) {
    return [
      {
        kind: "cifra",
        text: response.text,
        amount: response.amount.value,
        currency: response.amount.currency,
        references: response.references,
      },
    ];
  }

  return [{ kind: "texto", text: response.text }];
}

// Una pregunta de solo-lectura hecha en el mismo turno que una accion
// financiera se añade a la respuesta ya decidida (21 S7: mostrar no
// interrumpe). No aplica a bloques con opciones: interrumpir una propuesta
// con una respuesta aparte confundiria cual de las dos se esta confirmando.
function appendSupplementalAnswer(
  blocks: Block[],
  supplemental: ConversationalAnswer | undefined
): Block[] {
  if (!supplemental || blocks.length === 0) return blocks;

  const [first, ...rest] = blocks;
  if (!("text" in first) || "options" in first) return blocks;

  return [{ ...first, text: `${first.text}\n\n${supplemental.response_text}` }, ...rest];
}

/**
 * `RUL-ESTR-03` / `RUL-PRES-01`: todo lo que este turno puede decir sobre
 * crear o cambiar una caja, una meta o un presupuesto.
 *
 * El orden importa: primero lo que ya paso (aplicado, cancelado, fallido),
 * luego la ambiguedad —que pregunta en vez de escribir— y por ultimo la
 * propuesta que espera confirmacion. Nunca se propone y se ejecuta en el mismo
 * turno.
 */
function buildStructureResponse(
  input: TurnResponsePlannerInput,
): ProductResponse | null {
  const resolution = input.structureResolution;

  if (resolution?.kind === "applied") {
    return {
      reason: "structure_applied",
      intent: "direct_response",
      shape: "texto",
      text: composeStructureAppliedText(resolution),
    };
  }

  if (resolution?.kind === "cancelled") {
    return {
      reason: "structure_cancelled",
      intent: "direct_response",
      shape: "texto",
      text: "Listo, no creé nada.",
    };
  }

  if (resolution?.kind === "failed") {
    return {
      reason: "structure_failed",
      intent: "direct_response",
      shape: "texto",
      text: composeStructureFailedText(resolution),
    };
  }

  // Ambiguo entre caja, meta y presupuesto: preguntar de mas es mas barato que
  // crear algo que el usuario no pidio (`RUL-PRES-01`).
  if (input.structureAmbiguityQuestion) {
    return {
      reason: "structure_needs_clarification",
      intent: "direct_response",
      shape: "texto",
      text: input.structureAmbiguityQuestion,
    };
  }

  const proposal = input.structureProposal;
  if (proposal) {
    const commandId = buildStructureCommandText(proposal.proposal_id);
    return {
      reason: "structure_needs_confirmation",
      intent: "direct_response",
      shape: "propuesta",
      text: proposal.summary,
      proposalCommandId: commandId,
      options: [
        { id: commandId, label: proposal.confirm_label },
        { id: STRUCTURE_CANCEL_COMMAND_ID, label: "No, cancelar" },
      ],
    };
  }

  return null;
}

function composeStructureAppliedText(
  resolution: Extract<StructureResolutionResult, { kind: "applied" }>,
): string {
  if (resolution.idempotent) {
    return `Eso ya estaba hecho: ${resolution.summary} sigue como estaba. No lo dupliqué.`;
  }

  if (resolution.operation === "update") {
    return `Listo. Actualicé ${resolution.summary}.`;
  }

  // `RUL-PRES-01`: un presupuesto se nombra como referencia, nunca como dinero
  // apartado, para que nadie crea que le bloqueó saldo.
  if (resolution.entity === "presupuesto") {
    return `Listo. Creé ${resolution.summary}. Es una referencia: no aparta ni bloquea tu dinero.`;
  }

  if (resolution.entity === "caja") {
    return `Listo. Creé ${resolution.summary}. Ese dinero deja de contar como libre.`;
  }

  return `Listo. Creé ${resolution.summary}.`;
}

function composeStructureFailedText(
  resolution: Extract<StructureResolutionResult, { kind: "failed" }>,
): string {
  if (resolution.reason === "proposal_lapsed") {
    return "Esa propuesta ya venció, así que no la ejecuté. Si todavía la quieres, dímelo otra vez y la vuelvo a armar.";
  }

  if (resolution.detail) return resolution.detail;

  const que = resolution.entity ? entityLabel(resolution.entity) : "eso";
  return `No pude crear esa ${que} y no cambié nada. Puedes intentarlo otra vez o hacerlo desde la pantalla.`;
}

function buildProductResponse(input: TurnResponsePlannerInput): ProductResponse | null {
  const execution = input.financialActionExecution;
  const pendingResolution = input.pendingResolution;
  const captureDraftResolution = input.captureDraftResolution;
  const structureResponse = buildStructureResponse(input);
  if (structureResponse) return structureResponse;

  const correctionResolution = input.correctionResolution;
  if (correctionResolution?.kind === "applied") {
    const isDeleteCorrection = correctionResolution.command.kind === "delete";
    return {
      reason: "correction_applied",
      intent: "direct_response",
      shape: "texto",
      text:
        correctionResolution.reason === "already_applied"
          ? isDeleteCorrection
            ? "Listo. Ese movimiento ya estaba eliminado."
            : `Listo. Ese movimiento ya estaba como ${correctionResolution.summary}.`
          : isDeleteCorrection
            ? `Listo. Eliminé ${correctionResolution.summary}. Tus saldos ya se recalcularon.`
            : `Listo. Cambié ${correctionResolution.summary}. Tus saldos ya se recalcularon.`,
    };
  }

  if (correctionResolution?.kind === "cancelled") {
    return {
      reason: "correction_cancelled",
      intent: "direct_response",
      shape: "texto",
      text: "Listo, no cambié nada.",
    };
  }

  if (correctionResolution?.kind === "failed") {
    return {
      reason: "correction_needs_clarification",
      intent: "direct_response",
      shape: "texto",
      text:
        correctionResolution.reason === "proposal_lapsed"
          ? composeCorrectionLapsedText()
          : composeCorrectionFailedText(),
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
      intent: "direct_response",
      shape: "propuesta",
      text,
      proposalCommandId: correctionProposal.command.command_id,
      options: [
        {
          id: correctionProposal.command.command_id,
          label: isDeleteCorrection ? "Sí, eliminar" : "Sí, cambiar",
        },
        { id: "corr:cancel", label: "No cambiar" },
      ],
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
      intent: "direct_response",
      shape: "pregunta",
      text,
      options: correctionProposal.commands.map((command) => ({
        id: command.command_id,
        label: command.button_title,
      })),
    };
  }

  if (
    correctionProposal?.kind === "no_candidate" ||
    correctionProposal?.kind === "needs_clarification" ||
    correctionProposal?.kind === "unsupported"
  ) {
    return {
      reason: "correction_needs_clarification",
      intent: "direct_response",
      shape: "texto",
      text: composeCorrectionClarificationText(correctionProposal),
    };
  }

  if (pendingResolution?.kind === "confirmed") {
    const description =
      humanizeDescription(pendingResolution.movement.description) ?? "movimiento";
    if (pendingResolution.reason === "pending_auto_resolved_duplicate") {
      return {
        reason: "pending_confirmed",
        intent: "direct_response",
        shape: "texto",
        text: `Ese ${description} ya estaba registrado. Quité el pendiente duplicado sin volver a tocar tu saldo.`,
      };
    }
    return {
      reason: "pending_confirmed",
      intent: "direct_response",
      shape: "texto",
      text: `Listo. ${description} por ${formatMoney(
        pendingResolution.movement.amount,
        pendingResolution.movement.currency
      )} confirmado.`,
      amount: {
        value: pendingResolution.movement.amount,
        currency: pendingResolution.movement.currency,
      },
      references: [{ kind: "movimiento", id: pendingResolution.movement.id }],
    };
  }

  if (pendingResolution?.kind === "discarded") {
    return {
      reason: "pending_discarded",
      intent: "direct_response",
      shape: "texto",
      text: "Listo. Ese pendiente quedó descartado. No tocaba tu saldo.",
    };
  }

  if (pendingResolution?.kind === "reviewed") {
    return {
      reason: "pending_reviewed",
      intent: "direct_response",
      shape: "texto",
      text: composePendingAccountReviewText(pendingResolution),
    };
  }

  if (pendingResolution?.kind === "updated") {
    const text = composePendingUpdatedText(pendingResolution);
    if (pendingResolution.ready_for_confirmation) {
      const code = buildPendingItemReferenceCode(pendingResolution.pending_item);
      return {
        reason: "pending_updated",
        intent: "pending_confirmation",
        shape: "propuesta",
        text,
        proposalCommandId: code,
        options: buildPendingResolutionOptions(pendingResolution.pending_item),
      };
    }
    return { reason: "pending_updated", intent: "direct_response", shape: "texto", text };
  }

  if (captureDraftResolution?.kind === "discarded") {
    return {
      reason: "capture_draft_discarded",
      intent: "direct_response",
      shape: "texto",
      text: "Listo. No registre eso y no toque tu saldo.",
    };
  }

  if (captureDraftResolution?.kind === "needs_clarification") {
    return {
      reason: "capture_draft_needs_clarification",
      intent: "direct_response",
      shape: "texto",
      text: composeCaptureDraftClarificationText(captureDraftResolution),
    };
  }

  if (pendingResolution?.kind === "needs_clarification") {
    return {
      reason: "pending_resolution_needs_clarification",
      intent: "direct_response",
      shape: "texto",
      text: composePendingResolutionClarificationText(pendingResolution),
    };
  }

  if (pendingResolution?.kind === "listed") {
    return {
      reason: "pending_listed",
      intent: "direct_response",
      shape: "lista",
      text: composePendingListText(pendingResolution),
      listItems: pendingResolution.pending_items,
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
    const options = buildPendingCreatedOptions(pending, input.userId!);
    if (options) {
      return {
        reason: "mixed_actions_processed",
        intent: "pending_confirmation",
        shape: "propuesta",
        text,
        proposalCommandId: buildPendingReferenceCode({
          userId: input.userId!,
          pendingItemId: pending.pending_items[0]!.pending_item_id,
        }),
        options,
      };
    }
    return { reason: "mixed_actions_processed", intent: "direct_response", shape: "texto", text };
  }

  if (
    execution?.kind === "executed" &&
    (execution.movements.length > 0 || (execution.debts?.length ?? 0) > 0)
  ) {
    return {
      reason:
        execution.created_count === 1 ? "movement_created" : "movements_created",
      intent: "direct_response",
      shape: "texto",
      text: composeMovementCreatedText(execution),
      amount:
        execution.movements.length === 1
          ? { value: execution.movements[0].amount, currency: execution.movements[0].currency }
          : undefined,
      references:
        execution.movements.length > 0
          ? execution.movements.map((movement) => ({ kind: "movimiento", id: movement.movement_id }))
          : undefined,
    };
  }

  if (pending?.kind === "created" && pending.pending_items.length > 0) {
    const text = composePendingCreatedText(pending);
    const options = buildPendingCreatedOptions(pending, input.userId!);
    if (options) {
      return {
        reason: "pending_created",
        intent: "pending_confirmation",
        shape: "propuesta",
        text,
        proposalCommandId: buildPendingReferenceCode({
          userId: input.userId!,
          pendingItemId: pending.pending_items[0]!.pending_item_id,
        }),
        options,
      };
    }
    return { reason: "pending_created", intent: "direct_response", shape: "texto", text };
  }

  if (
    input.financialActionPlan?.kind === "ready_for_core" &&
    execution?.kind === "not_executed" &&
    input.pendingCreation?.kind !== "created"
  ) {
    return {
      reason: "ready_for_core_not_executed",
      intent: "direct_response",
      shape: "limite",
      text: "Confirmaste, pero todavia no pude aplicarlo. Intenta de nuevo en un momento; si sigue sin registrarse, avisame.",
      manualPath: null,
    };
  }

  if (
    input.financialActionPlan?.kind === "blocked" &&
    execution?.kind === "not_executed" &&
    input.pendingCreation?.kind !== "created"
  ) {
    return {
      reason: "blocked_financial_action",
      intent: "direct_response",
      shape: "limite",
      text: composeBlockedFinancialActionText(input),
      manualPath: isCorrectionLikeInput(input) ? buildDashboardDeepLink("movements") : null,
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
      intent: "direct_response",
      shape: "limite",
      text: composeBlockedFinancialActionText(input),
      manualPath: buildDashboardDeepLink("movements"),
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
      intent: "direct_response",
      shape: "texto",
      text:
        "Entendí que quieres registrar un movimiento, pero me falta un dato para hacerlo con seguridad. Dime el monto y qué fue, por ejemplo: \"20 en desayuno\".",
    };
  }

  return null;
}

function buildConversationAgentResponse(
  input: TurnResponsePlannerInput
): { reason: "conversation_answer"; text: string } | null {
  if (!input.dataAgentCompleted || !input.conversationAnswer) return null;
  const canUseConversationAnswer =
    !input.dataAgentIntent ||
    input.dataAgentIntent === "conversation" ||
    input.dataAgentIntent === "unknown" ||
    input.conversationTurnState?.should_route_to_conversation_agent === true;

  if (!canUseConversationAnswer) {
    return null;
  }

  return { reason: "conversation_answer", text: input.conversationAnswer.response_text };
}

function buildConversationBasicResponse(
  input: TurnResponsePlannerInput
): { reason: "conversation_greeting" | "conversation_help" | "conversation_thanks"; text: string } | null {
  if (!input.dataAgentCompleted) return null;
  if (
    input.dataAgentIntent &&
    input.dataAgentIntent !== "conversation" &&
    input.dataAgentIntent !== "unknown"
  ) {
    return null;
  }

  const text = normalizeForIntent(input.turnInput.text ?? "");
  if (!text) return null;

  if (isGreetingText(text)) {
    const hasActiveThread =
      input.conversationTurnState?.personalization_cues.includes(
        "hay memoria conversacional activa"
      ) === true;
    return {
      reason: "conversation_greeting",
      text: hasActiveThread
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
      text: 'De nada. Cuando quieras, me escribes un gasto, una correccion o "ver pendientes".',
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

function composePendingListRowLabel(item: PendingItem): string {
  const summary = item.normalized_summary;
  const code = buildPendingItemReferenceCode(item);
  const title = humanizeDescription(summary.title ?? null) ?? "Pendiente";
  const amount =
    typeof summary.amount === "number" && Number.isFinite(summary.amount)
      ? ` - ${formatMoney(summary.amount, summary.currency ?? "PEN")}`
      : "";
  return `${code} - ${title}${amount}`;
}

function composePendingListText(
  pendingResolution: Extract<PendingResolutionResult, { kind: "listed" }>
): string {
  if (pendingResolution.pending_items.length === 0) {
    return "No tienes pendientes por revisar. Nada pendiente esta tocando tu saldo.";
  }

  const rows = pendingResolution.pending_items
    .map((item, index) => `${index + 1}. ${composePendingListRowLabel(item)}`)
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
  pendingResolution: Extract<PendingResolutionResult, { kind: "needs_clarification" }>
): string {
  const verb =
    pendingResolution.action === "discard" ? "descartar" : "confirmar";

  if (
    pendingResolution.reason === "possible_duplicate" &&
    pendingResolution.pending_item
  ) {
    const code = buildPendingItemReferenceCode(pendingResolution.pending_item);
    return withPendingLink(
      `Encontré un movimiento muy parecido ya registrado. Si son dos operaciones distintas, confirma ${code} otra vez; si no, puedes descartarlo.`
    );
  }

  if (
    pendingResolution.reason === "pending_requires_details" &&
    pendingResolution.pending_item
  ) {
    const code = buildPendingItemReferenceCode(pendingResolution.pending_item);
    const movementType = pendingResolution.pending_item.proposed_action.movement_type;
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
      `${detail}\n${composeAccountOptions(pendingResolution.account_options ?? [])}`
    );
  }

  if (pendingResolution.reason === "pending_account_action_not_supported") {
    return withPendingLink(
      "Ese Pendiente necesita otro motor especializado. No cambié nada; revísalo en Pendientes para completar sus datos."
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
  pendingResolution: Extract<PendingResolutionResult, { kind: "reviewed" }>
): string {
  const pending = pendingResolution.pending_item;
  const code = buildPendingItemReferenceCode(pending);
  const originHint = readString(pending.metadata.account_origin_hint);
  const destinationHint = readString(pending.metadata.account_destination_hint);
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
    ].join("\n")
  );
}

function composePendingUpdatedText(
  pendingResolution: Extract<PendingResolutionResult, { kind: "updated" }>
): string {
  const pending = pendingResolution.pending_item;
  const code = buildPendingItemReferenceCode(pending);
  if (!pendingResolution.ready_for_confirmation) {
    return withPendingLink(
      [
        `Actualicé ${code}, pero aún falta otra cuenta para completar la transferencia.`,
        composeAccountOptions(pendingResolution.account_options),
        "No registré nada ni toqué tus saldos.",
      ].join("\n")
    );
  }

  const origin = pendingResolution.account_options.find(
    (account) => account.id === pending.proposed_action.account_origin_id
  );
  const destination = pendingResolution.account_options.find(
    (account) => account.id === pending.proposed_action.account_destination_id
  );
  const movementType = readString(pending.proposed_action.movement_type);
  const category = pending.normalized_summary.category_id;
  const detail =
    movementType === "transferencia"
      ? `transferencia de ${origin?.name ?? "la cuenta elegida"} a ${
          destination?.name ?? "la cuenta elegida"
        }`
      : movementType === "ingreso"
        ? `ingreso${destination ? ` a ${destination.name}` : " sin cuenta asignada"}${category ? ` en ${category}` : ""}`
        : `gasto${origin ? ` desde ${origin.name}` : " sin cuenta asignada"}${category ? ` en ${category}` : ""}`;
  const learned =
    pendingResolution.learned_account_hints.length > 0
      ? " También recordé la asociación bancaria que pediste."
      : "";
  return `Actualicé ${code} como ${detail}. Aún no registré nada ni toqué tus saldos.${learned} ¿Lo confirmo?`;
}

function composeAccountOptions(
  accounts: Array<{ name: string; institution: string | null }>
): string {
  if (accounts.length === 0) {
    return "No tienes cuentas compatibles con esa moneda. No crearé ninguna automáticamente.";
  }
  return [
    "Tus cuentas compatibles:",
    ...accounts.map(
      (account, index) =>
        `${index + 1}. ${account.name}${account.institution ? ` (${account.institution})` : ""}`
    ),
  ].join("\n");
}

function composeCaptureDraftClarificationText(
  captureDraftResolution: Extract<CaptureDraftResolutionResult, { kind: "needs_clarification" }>
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
            debt.first_due_date ? ` desde el ${formatDateOnly(debt.first_due_date)}` : ""
          }.`
        : "";
    const balanceNote = debt.movement_id
      ? " El movimiento vinculado fue confirmado por Core."
      : " La deuda no cambio el saldo de ninguna cuenta porque no indicaste una cuenta vinculada.";
    return `Listo. Cree ${debt.name} por ${formatMoney(
      debt.principal_amount,
      debt.currency
    )}.${schedule}${balanceNote}`;
  }

  if (execution.movements.length === 1) {
    const movement = execution.movements[0];
    if (
      movement.movement_type === "pago_deuda" ||
      movement.movement_type === "devolucion_recibida"
    ) {
      const actionLabel = movement.movement_type === "pago_deuda" ? "pago" : "devolucion";
      const debtLabel = movement.debt_name ? ` de ${movement.debt_name}` : " de la deuda";
      const remaining =
        movement.debt_remaining_balance === null ||
        movement.debt_remaining_balance === undefined
          ? ""
          : ` Saldo pendiente: ${formatMoney(movement.debt_remaining_balance, movement.currency)}.`;
      return `Listo. Registre el ${actionLabel}${debtLabel} por ${formatMoney(
        movement.amount,
        movement.currency
      )}.${remaining}${composeNoAccountSuffix([movement])}`;
    }
    const description = humanizeDescription(movement.description) ?? "Movimiento";
    const base = `Listo. ${description} por ${formatMoney(movement.amount, movement.currency)} registrado.`;
    return `${base}${composeNoAccountSuffix([movement])}`;
  }

  const total = execution.movements.reduce((sum, movement) => sum + movement.amount, 0);
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
    if (movement.movement_type === "gasto") return !movement.account_origin_id;
    if (movement.movement_type === "ingreso") return !movement.account_destination_id;
    if (movement.movement_type === "pago_deuda") return !movement.account_origin_id;
    if (movement.movement_type === "devolucion_recibida") return !movement.account_destination_id;
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

    return withPendingLink("Lo separé para revisar. Falta confirmar un dato y no toca tu saldo.");
  }

  return withPendingLink(
    `Separé ${pending.pending_items.length} movimientos para revisar. No tocan tu saldo hasta que confirmes.`
  );
}

function composeBlockedFinancialActionText(input: TurnResponsePlannerInput): string {
  if (!isCorrectionLikeInput(input)) {
    return composeBlockedCaptureText(input.financialActionPlan);
  }

  const movementsUrl = buildDashboardDeepLink("movements");
  const text =
    "Te entendí. No cambié nada todavía: esa corrección necesita revisión antes de tocar dinero.";

  if (!movementsUrl) return text;

  return `${text}\nPuedes editarla desde Movimientos: ${movementsUrl}`;
}

function composeBlockedCaptureText(financialActionPlan: DataActionPlan | undefined): string {
  const reasons = financialActionPlan?.actions.flatMap((action) => action.reasons) ?? [];
  const debtCreation = financialActionPlan?.actions.find(
    (action) => action.debt_creation_input
  )?.debt_creation_input;
  if (reasons.includes("debt_creation_first_due_date_missing")) {
    return "Entendi la deuda y las cuotas. ¿Cuando vence la primera cuota?";
  }
  if (reasons.includes("debt_creation_type_invalid")) {
    return "Entendi que hay una deuda, pero no me quedo claro si tu le debes a la otra persona o si ella te debe a ti. Cual de las dos es?";
  }
  if (reasons.includes("debt_creation_contract_missing")) {
    return "Entendi que quieres registrar una deuda, pero me falto informacion para armarla. Cuentame de nuevo: quien le debe a quien, cuanto y desde cuando.";
  }
  if (reasons.includes("debt_creation_direction_mismatch")) {
    return "Hay algo que no cuadra entre si tu le debes a la persona o si ella te debe a ti. Me lo confirmas?";
  }
  if (reasons.includes("debt_creation_person_missing")) {
    return "Entendi la deuda, pero me falta saber con quien es. Como se llama la persona?";
  }
  if (reasons.includes("debt_creation_installment_count_invalid")) {
    return "El numero de cuotas que me diste no es valido. Dime un numero entre 1 y 240.";
  }
  if (reasons.includes("debt_creation_account_not_found")) {
    return "No encontre la cuenta que mencionaste para esta deuda. Cual cuenta es?";
  }
  if (reasons.includes("debt_creation_confirmation_required") && debtCreation) {
    const installmentText = debtCreation.installment_count
      ? ` en ${debtCreation.installment_count} cuotas`
      : "";
    return `Borrador: ${debtCreation.name}, ${formatMoney(
      debtCreation.principal_amount,
      debtCreation.currency
    )}${installmentText}. Todavia no la cree ni cambie tu saldo. ¿La confirmas?`;
  }
  if (reasons.includes("debt_reference_ambiguous")) {
    return "Entendi el pago, pero hay mas de una deuda compatible. Dime el nombre de la deuda o la persona para elegirla sin asumir.";
  }
  if (reasons.includes("debt_reference_missing") || reasons.includes("debt_not_found")) {
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
    missing.length > 0 ? `me falta ${formatSpanishList(missing)}` : "me falta un dato";

  const hasDebtReason = reasons.some((reason) => reason.startsWith("debt_"));
  const example = hasDebtReason
    ? ""
    : ' Escribeme algo como: "gaste 20 en desayuno".';

  return `Te entendi, pero no lo registre todavia: ${missingText} para hacerlo sin asumir.${example}`;
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

/**
 * `23` §5b.1 / `AC-RT-13`: una propuesta caducada **se dice**, no se ejecuta ni
 * se descarta en silencio. Tampoco se vuelve a armar sola: el usuario la pide
 * otra vez y Manzana la prepara de nuevo, para que la confirmacion siguiente
 * hable de algo que el usuario si tiene presente.
 */
function composeCorrectionLapsedText(): string {
  return (
    "La operación que te propuse quedó pendiente y ya venció, así que no cambié nada. " +
    "Si todavía la quieres, pídemela otra vez y la preparo de nuevo."
  );
}

function composeCorrectionFailedText(): string {
  const movementsUrl = buildDashboardDeepLink("movements");
  const base = "No pude aplicar esa corrección de forma segura. No cambié ningún movimiento.";

  if (!movementsUrl) return base;
  return `${base}\nPuedes revisarlo desde Movimientos: ${movementsUrl}`;
}

function isCorrectionLikeInput(input: TurnResponsePlannerInput): boolean {
  if (input.dataAgentIntent === "correction") return true;

  const text = normalizeForIntent(input.turnInput.text ?? "");
  if (!text) return false;

  const hasCorrectionVerb = /\b(no fue|corrige|corregir|correccion|cambia|cambiar|era)\b/.test(text);
  const hasFinancialObject = /\b(gasto|ingreso|movimiento|prestamo|deuda|pago)\b/.test(text);

  return hasCorrectionVerb && hasFinancialObject;
}

function normalizeForIntent(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildPendingCreatedOptions(
  pending: Extract<DataActionPendingCreationResult, { kind: "created" }>,
  userId: string
): BlockOption[] | null {
  if (pending.pending_items.length !== 1) return null;

  const item = pending.pending_items[0];
  if (item.risk_level === "sensitive" || item.risk_level === "high") {
    return null;
  }

  const pendingCode = buildPendingReferenceCode({
    userId,
    pendingItemId: item.pending_item_id,
  });

  return [
    { id: `confirmar ${pendingCode}`, label: "Confirmar" },
    { id: `descartar ${pendingCode}`, label: "Descartar" },
  ];
}

function buildPendingResolutionOptions(pendingItem: PendingItem): BlockOption[] {
  const pendingCode = buildPendingItemReferenceCode(pendingItem);
  return [
    { id: `confirmar ${pendingCode}`, label: "Confirmar" },
    { id: `descartar ${pendingCode}`, label: "Descartar" },
  ];
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

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}
