import type { SupabaseClient } from "@supabase/supabase-js";
import { CommandDispatcher } from "@/core/finance";
import { LearningEngine } from "@/core/learning";
import { handleMemoryControlFromText } from "@/core/learning/memory-control-from-text";
import type { Database, Json } from "@/data/supabase/types";
import {
  ConversationAgent,
  type ConversationContextPack,
  type ConversationReferencedMovement,
  type ConversationStyleProfile,
  type ConversationTurnState,
} from "@/agents/conversation-agent";
import { OrchestrationPlanningAgent } from "@/agents/orchestration-planning-agent/orchestration-planning-agent";
import { buildSafePlanningContext } from "@/agents/orchestration-planning-agent/types";
import { DataAgent, type DataContextPack } from "@/agents/data-agent";
import {
  CorrectionAgent,
  isCorrectionLikeText,
  type CorrectionMovementCandidate,
} from "@/agents/correction-agent";
import {
  ConversationalExecutiveAgent,
  readConversationalExecutiveMode,
  type ConversationalExecutiveContextPack,
  type ConversationalExecutiveMode,
} from "@/agents/conversational-executive-agent";
import { RiskSignalAgent, type RiskSignalAssessment } from "@/agents/risk-signal-agent";
import { DedupSignalAgent } from "@/agents/dedup-signal-agent";
import {
  reconcileEmailPendingAfterMovements,
  type EmailPendingReconciliationResult,
} from "@/core/dedup";
import {
  getActiveAccounts,
  getActiveBoxes,
} from "@/data/repositories/accounts.repository";
import { getAllCategories } from "@/data/repositories/categories.repository";
import { getClassificationCatalog } from "@/data/repositories/classification.repository";
import {
  listActiveDebtsForDataContext,
  listRecentCorrectionsForDataContext,
  listRecentMovementsForDataContext,
} from "@/data/repositories/data-context.repository";
import { DebtPaymentCommandHandler } from "@/core/debts/debt-payment-command";
import { SupabaseDebtPaymentExecutionPort } from "@/data/repositories/debt-payment-command.repository";
import { DebtCreationCommandHandler } from "@/core/debts/debt-creation-command";
import { SupabaseDebtCreationExecutionPort } from "@/data/repositories/debt-creation-command.repository";
import {
  listFinancialMemory,
  manageFinancialMemory,
  searchConfirmedFinancialMemory,
} from "@/data/repositories/financial-memory.repository";
import {
  getExternalEventById,
  updateExternalEventStatus,
} from "@/data/repositories/events.repository";
import { getProfile } from "@/data/repositories/profiles.repository";
import {
  listRecentMovementsForCorrection,
  listRecentMovementsForPreflight,
  SupabaseFinancialCoreRepository,
} from "@/data/repositories/movements.repository";
import type { Channel, PresentedTurn, TurnInput } from "@/core/channel/types";
import {
  planTurnBlocks,
  type PlanTurnBlocksResult,
} from "@/core/response/response-planner";
import { analyzeConversationTurn } from "@/core/conversation/conversation-kernel";
import {
  movementToConversationReference,
  rememberConversationPlanningState,
  rememberConversationOutcome,
  rememberConversationTurn,
} from "@/core/conversation/conversation-memory";
import { ToolGateway } from "@/core/conversation/tool-gateway";
import { buildTurnWorkspace } from "@/core/conversation/turn-workspace";
import {
  TurnCoordinator,
  type CoordinatedTurnPlan,
} from "@/core/conversation/turn-coordinator";
import {
  conversationContextFromExecutive,
  conversationResultFromExecutive,
  conversationResultFromPostCoreEvidence,
  correctionResultFromExecutive,
  dataAgentResultFromCaptureDraft,
  dataAgentResultFromExecutive,
} from "@/core/conversation/executive-adapters";
import {
  readPersistentConversationStyle,
  writePersistentConversationStyle,
} from "@/core/conversation/conversation-style-preferences";
import { getActiveConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import {
  clearCaptureDraftMemory,
  getCaptureDraftMissingFacts,
  getActiveCaptureDraftMemory,
  rememberCaptureDraft,
  resolveCaptureDraftFromNoActivePending,
  shouldRememberCaptureDraft,
  type CaptureDraftResolutionResult,
} from "./capture-draft-memory";
import { listPendingItems } from "@/data/repositories/pending.repository";
import { buildPendingItemReferenceCode } from "@/core/pending/reference-code";
import {
  executeReadyDataActionPlan,
  type DataActionExecutionResult,
  type ExecutedDataActionMovement,
} from "./data-action-executor";
import {
  createPendingItemsForDataActionPlan,
  type DataActionPendingCreationResult,
} from "./data-action-pending";
import { planDataAgentFinancialActions } from "./data-action-policy";
import {
  applyDedupPreflight,
  assessRiskSignals,
  calculateRecentAmountMedian,
} from "./financial-action-preflight";
import {
  isCorrectionCommandText,
  maybeResolveCorrection,
} from "./correction-resolution";
import {
  isConfirmationText,
  isDiscardText,
  isStructuredPendingResolutionText,
  maybeResolvePendingFromText,
  notPendingResolution,
  resolvePendingFromAction,
  type PendingResolutionResult,
} from "./pending-resolution-from-text";
import { logger } from "@/shared/telemetry/logger";
import { readThreadConversationHistory } from "@/core/assistant/conversation-history";
import {
  reconcileCompiledOrchestrationPlan,
  type CompiledOrchestrationPlan,
} from "./orchestration-plan";

type Client = SupabaseClient<Database>;
type ExternalEventLog = NonNullable<
  Awaited<ReturnType<typeof getExternalEventById>>
>;
type DataAgentExtractResult = Awaited<ReturnType<DataAgent["extract"]>>;
type OrchestrationPlanningTrace = CoordinatedTurnPlan;
type MixedConversationTrace = {
  contextPack: ConversationContextPack;
  result: Awaited<ReturnType<ConversationAgent["answer"]>>;
};

// El adaptador de cada canal construye este contexto a partir de su evento
// nativo (webhook, sesion web) y llama a handleTurn — el nucleo nunca ve el
// evento original ni sabe de que canal vino, salvo el campo turnInput.canal,
// que 21 S3 permite "solo para el registro" (WEB-D170).
export type TurnHandlingInput = {
  externalEventId: string;
  turnInput: TurnInput;
  traceId: string;
};

export type TurnOrchestrationResult = {
  externalEventId: string;
  status: "accepted" | "ignored";
  reason:
    | "accepted_for_agent_runtime"
    | "accepted_with_data_agent_proposal"
    | "accepted_with_conversation_response"
    | "accepted_with_core_execution"
    | "accepted_with_pending_confirmation"
    | "accepted_with_pending_confirmed"
    | "accepted_with_pending_discarded"
    | "accepted_with_pending_listed"
    | "accepted_with_pending_resolution_clarification"
    | "accepted_with_capture_draft_discarded"
    | "accepted_with_capture_draft_clarification"
    | "accepted_with_correction_applied"
    | "accepted_with_correction_cancelled"
    | "accepted_with_correction_confirmation"
    | "accepted_with_correction_selection"
    | "accepted_with_correction_clarification"
    | "accepted_with_memory_control"
    | "missing_external_event"
    | "missing_user"
    | "non_text_message";
};

export type PresentTurnContext = {
  turnInput: TurnInput;
  externalEventId: string;
  traceId: string;
  conversationTurnState: ConversationTurnState;
  timezone?: string;
  styleOverride?: ConversationStyleProfile | null;
  // La confirmacion de control de memoria se presenta verbatim, y un turno
  // resuelto por el modo ejecutivo unico ya paso por su propio pipeline de
  // estilo: pedirle al agente de respuesta que lo reescriba de nuevo
  // arriesgaria alterar contenido que ya se decidio fuera de su alcance.
  skipEnhancement?: boolean;
};

export type PresentTurn = (
  plan: PlanTurnBlocksResult,
  context: PresentTurnContext
) => Promise<PresentedTurn>;

export class FinancialOrchestrator {
  constructor(
    private readonly client: Client,
    private readonly options: {
      autoAckInbound?: boolean;
      correctionAgent?: CorrectionAgent;
      conversationalExecutiveAgent?: ConversationalExecutiveAgent;
      conversationalExecutiveMode?: ConversationalExecutiveMode;
      conversationAgent?: ConversationAgent;
      dataAgent?: DataAgent;
      dedupSignalAgent?: DedupSignalAgent;
      orchestrationPlanningAgent?: OrchestrationPlanningAgent;
      riskSignalAgent?: RiskSignalAgent;
      executeReadyDataActions?: boolean;
      presentTurn: PresentTurn;
    },
  ) {
    this.dataAgent = options.dataAgent ?? new DataAgent();
    const conversationalExecutiveAgent =
      options.conversationalExecutiveAgent ??
      new ConversationalExecutiveAgent();
    this.correctionAgent = options.correctionAgent ?? new CorrectionAgent();
    this.conversationAgent =
      options.conversationAgent ?? new ConversationAgent();
    const orchestrationPlanningAgent =
      options.orchestrationPlanningAgent ?? new OrchestrationPlanningAgent();
    this.turnCoordinator = new TurnCoordinator({
      executiveAgent: conversationalExecutiveAgent,
      legacyPlanningAgent: orchestrationPlanningAgent,
    });
    this.riskSignalAgent = options.riskSignalAgent ?? new RiskSignalAgent();
    this.dedupSignalAgent = options.dedupSignalAgent ?? new DedupSignalAgent();
    this.presentTurn = options.presentTurn;
  }

  private readonly dataAgent: DataAgent;
  private readonly correctionAgent: CorrectionAgent;
  private readonly conversationAgent: ConversationAgent;
  private readonly turnCoordinator: TurnCoordinator;
  private readonly riskSignalAgent: RiskSignalAgent;
  private readonly dedupSignalAgent: DedupSignalAgent;
  private readonly presentTurn: PresentTurn;

  private getConversationalExecutiveMode(): ConversationalExecutiveMode {
    return (
      this.options.conversationalExecutiveMode ??
      readConversationalExecutiveMode()
    );
  }

  async handleTurn(input: TurnHandlingInput): Promise<TurnOrchestrationResult> {
    const { turnInput } = input;
    const channel: Channel = turnInput.channel;
    const externalEvent = await getExternalEventById(
      this.client,
      input.externalEventId,
    );

    if (!externalEvent) {
      logger.warn("orchestrator.external_event_missing", {
        external_event_id: input.externalEventId,
      });
      return {
        externalEventId: input.externalEventId,
        status: "ignored",
        reason: "missing_external_event",
      };
    }

    if (!externalEvent.user_id) {
      await updateExternalEventStatus(this.client, {
        external_event_id: externalEvent.id,
        status: "processed",
        metadata: {
          orchestrator_status: "ignored",
          orchestrator_reason: "missing_user",
        },
      });
      return {
        externalEventId: externalEvent.id,
        status: "ignored",
        reason: "missing_user",
      };
    }

    if (!turnInput.text) {
      await updateExternalEventStatus(this.client, {
        external_event_id: externalEvent.id,
        status: "processed",
        metadata: {
          orchestrator_status: "ignored",
          orchestrator_reason: "non_text_message",
          agent_runtime_required: false,
        },
      });
      return {
        externalEventId: externalEvent.id,
        status: "ignored",
        reason: "non_text_message",
      };
    }

    const text = turnInput.text;
    const profile = await getProfile(this.client, externalEvent.user_id);
    const timezone = profile?.timezone ?? "America/Lima";
    let activeMemoryState = await getActiveConversationMemoryState(
      this.client,
      {
        userId: externalEvent.user_id,
        channel,
        now: externalEvent.received_at,
      },
    );
    const conversationTurn = analyzeConversationTurn({
      text,
      receivedAt: externalEvent.received_at,
      timezone,
      activeState: activeMemoryState,
    });

    const memoryControl = await handleMemoryControlFromText({
      client: this.client,
      userId: externalEvent.user_id,
      text,
      traceId: input.traceId,
    });
    if (memoryControl.handled && memoryControl.response_text) {
      const plan = planTurnBlocks({
        turnInput,
        userId: externalEvent.user_id,
        dataAgentCompleted: true,
        dataAgentIntent: "conversation",
        conversationTurnState: conversationTurn.turn_state,
        conversationAnswer: {
          response_text: memoryControl.response_text,
          answer_kind:
            memoryControl.action === "clarify"
              ? "clarification"
              : "memory_summary",
          confidence: 1,
          cited_facts: memoryControl.affected_memory_ids,
          used_tools: [],
          follow_up_question:
            memoryControl.action === "clarify"
              ? "¿Qué recuerdo quieres cambiar?"
              : null,
          safety_flags: ["memory_is_context_not_authorization"],
        },
      });
      const presented = await this.presentTurn(plan, {
        turnInput,
        externalEventId: externalEvent.id,
        traceId: input.traceId,
        conversationTurnState: conversationTurn.turn_state,
        skipEnhancement: true,
      });
      await rememberConversationOutcome({
        client: this.client,
        userId: externalEvent.user_id,
        channel,
        intent: "memory_control",
        userMessage: text,
        resultSummary: memoryControl.response_text,
        sourceRef: externalEvent.id,
        topic: "memory",
        goal: "review",
        actionKind:
          memoryControl.action === "clarify"
            ? "clarification_requested"
            : "query_answered",
        actionStatus:
          memoryControl.action === "clarify"
            ? "awaiting_confirmation"
            : "completed",
        unresolvedSlots:
          memoryControl.action === "clarify"
            ? ["memory_code"]
            : [],
        previous: activeMemoryState?.working_set ?? null,
        now: externalEvent.received_at,
      });
      await updateExternalEventStatus(this.client, {
        external_event_id: externalEvent.id,
        status: "accepted",
        metadata: {
          orchestrator_status: "accepted",
          orchestrator_reason: "accepted_with_memory_control",
          agent_runtime_required: false,
          memory_control_action: memoryControl.action,
          memory_control_affected_count:
            memoryControl.affected_memory_ids.length,
          ...presentedTurnMetadata(plan, presented),
        },
      });
      return {
        externalEventId: externalEvent.id,
        status: "accepted",
        reason: "accepted_with_memory_control",
      };
    }

    if (isCorrectionCommandText(text)) {
      const correctionResolution = await maybeResolveCorrection({
        client: this.client,
        userId: externalEvent.user_id,
        text,
        traceId: input.traceId,
      });
      const plan = planTurnBlocks({
        turnInput,
        userId: externalEvent.user_id,
        conversationTurnState: conversationTurn.turn_state,
        correctionResolution,
      });
      const presented = await this.presentTurn(plan, {
        turnInput,
        externalEventId: externalEvent.id,
        traceId: input.traceId,
        conversationTurnState: conversationTurn.turn_state,
        skipEnhancement: false,
      });
      const orchestratorReason =
        correctionResolution.kind === "applied"
          ? "accepted_with_correction_applied"
          : correctionResolution.kind === "cancelled"
            ? "accepted_with_correction_cancelled"
            : "accepted_with_correction_clarification";

      if (
        correctionResolution.kind === "applied" ||
        correctionResolution.kind === "cancelled"
      ) {
        await rememberConversationOutcome({
          client: this.client,
          userId: externalEvent.user_id,
          channel,
          intent: "correction",
          userMessage: text,
          resultSummary:
            presented.text ??
            (correctionResolution.kind === "applied"
              ? correctionResolution.summary
              : "La correccion fue cancelada."),
          sourceRef: externalEvent.id,
          topic: "movement",
          goal: "correct",
          actionKind:
            correctionResolution.kind === "applied"
              ? "correction_applied"
              : "correction_cancelled",
          actionStatus:
            correctionResolution.kind === "applied" ? "completed" : "cancelled",
          movements:
            correctionResolution.kind === "applied"
              ? [movementToConversationReference(correctionResolution.movement)]
              : [],
          commandIds: correctionResolution.command
            ? [correctionResolution.command.command_id]
            : [],
          previous: activeMemoryState?.working_set ?? null,
          now: externalEvent.received_at,
        });
      }

      await updateExternalEventStatus(this.client, {
        external_event_id: externalEvent.id,
        status: "accepted",
        metadata: {
          orchestrator_status: "accepted",
          orchestrator_reason: orchestratorReason,
          agent_runtime_required: false,
          correction_resolution_kind: correctionResolution.kind,
          correction_resolution_reason: correctionResolution.reason,
          correction_resolution_command:
            correctionResolution.command?.command_id ?? null,
          correction_resolution_target_type:
            correctionResolution.command &&
            (correctionResolution.command.kind === "loan_to" ||
              correctionResolution.command.kind === "loan_from")
              ? correctionResolution.command.target_type
              : null,
          correction_resolution_related_person:
            correctionResolution.command &&
            (correctionResolution.command.kind === "loan_to" ||
              correctionResolution.command.kind === "loan_from")
              ? correctionResolution.command.related_person_name
              : null,
          correction_resolution_movement_id:
            correctionResolution.movement?.id ?? null,
          correction_resolution_idempotent: correctionResolution.idempotent,
          correction_resolution_error_code:
            correctionResolution.kind === "failed"
              ? correctionResolution.error_code
              : null,
          ...presentedTurnMetadata(plan, presented),
        },
      });

      return {
        externalEventId: externalEvent.id,
        status: "accepted",
        reason: orchestratorReason,
      };
    }

    const initialDataContextPack = await this.buildDataContextPack(
      externalEvent,
      text,
      channel,
      timezone,
    );
    const initialOrchestrationPlanning = await this.planTurn({
      externalEvent,
      text,
      timezone,
      channel,
      conversationTurn,
      activeMemoryState,
      traceId: input.traceId,
      dataContextPack: initialDataContextPack,
    });
    if (initialOrchestrationPlanning) {
      activeMemoryState =
        (await rememberConversationPlanningState({
          client: this.client,
          userId: externalEvent.user_id,
          channel,
          userMessage: text,
          sourceRef: externalEvent.id,
          compiled: initialOrchestrationPlanning.compiled,
          previousState: activeMemoryState,
          now: externalEvent.received_at,
        })) ?? activeMemoryState;

      await this.persistExplicitConversationStyle({
        userId: externalEvent.user_id,
        styleUpdate: initialOrchestrationPlanning.compiled.styleUpdate,
        resetStyle: initialOrchestrationPlanning.compiled.resetStyle,
        evidenceRef: externalEvent.id,
        observedAt: externalEvent.received_at,
        traceId: input.traceId,
      });
    }
    const effectiveConversationTurnState =
      initialOrchestrationPlanning?.compiled.conversationTurnState ??
      conversationTurn.turn_state;
    const plannedFinancialResolution =
      initialOrchestrationPlanning?.compiled.financialResolution ?? null;
    const pendingResolution =
      plannedFinancialResolution?.action !== undefined &&
      plannedFinancialResolution.action !== "none"
        ? plannedFinancialResolution.target === "capture_draft"
          ? buildCaptureDraftResolutionBridge(plannedFinancialResolution.action)
          : await resolvePendingFromAction({
              client: this.client,
              userId: externalEvent.user_id,
              action: plannedFinancialResolution.action,
              pendingCode: plannedFinancialResolution.pending_code,
              accountOriginId:
                plannedFinancialResolution.account_origin_id,
              accountDestinationId:
                plannedFinancialResolution.account_destination_id,
              categoryId: plannedFinancialResolution.category_id,
              learnAccountAliases:
                plannedFinancialResolution.learn_account_aliases,
              userText: text,
              traceId: input.traceId,
              channel,
            })
        : isStructuredPendingResolutionText(text) ||
            !initialOrchestrationPlanning ||
            isConfirmationText(text) ||
            isDiscardText(text)
          ? await maybeResolvePendingFromText({
              client: this.client,
              userId: externalEvent.user_id,
              text,
              traceId: input.traceId,
              channel,
            })
          : notPendingResolution();

    logger.warn("diag.pending_resolution_debug", {
      trace_id: input.traceId,
      text,
      planned_financial_resolution: plannedFinancialResolution,
      pending_resolution_kind: pendingResolution.kind,
      pending_resolution_action: pendingResolution.action,
    });

    if (pendingResolution.kind !== "not_resolution") {
      const captureDraftResolution =
        await resolveCaptureDraftFromNoActivePending({
          client: this.client,
          userId: externalEvent.user_id,
          channel,
          pendingResolution,
          now: externalEvent.received_at,
        });

      logger.warn("diag.capture_draft_resolution_debug", {
        trace_id: input.traceId,
        capture_draft_resolution_kind: captureDraftResolution.kind,
        capture_draft_resolution_reason: captureDraftResolution.reason,
        has_draft: captureDraftResolution.draft !== null,
      });

      if (captureDraftResolution.kind === "ready_to_replay") {
        const draftDataContextPack = await this.buildDataContextPack(
          externalEvent,
          captureDraftResolution.draft.original_message,
          channel,
          timezone,
        );
        const draftDataAgentResult = dataAgentResultFromCaptureDraft(
          captureDraftResolution.draft,
        );

        return this.handleDataAgentFinancialActions({
          externalEvent,
          turnInput,
          conversationTurnState: effectiveConversationTurnState,
          dataContextPack: draftDataContextPack,
          dataAgentResult: draftDataAgentResult,
          originalMessage: captureDraftResolution.draft.original_message,
          traceId: input.traceId,
          captureDraftReplay: {
            draftStateId: captureDraftResolution.draft.state_id,
            draftSourceRef: captureDraftResolution.draft.source_ref,
            userText: text,
          },
        });
      }

      const shouldTryCorrectionAfterPendingMiss =
        shouldRoutePendingMissToCorrection({
          pendingResolution,
          captureDraftResolution,
          text,
          allowDeterministicFallback: !initialOrchestrationPlanning,
        });

      if (
        (captureDraftResolution.kind === "discarded" ||
          captureDraftResolution.kind === "needs_clarification") &&
        !shouldTryCorrectionAfterPendingMiss
      ) {
        const plan = planTurnBlocks({
          turnInput,
          userId: externalEvent.user_id,
          conversationTurnState: effectiveConversationTurnState,
          captureDraftResolution,
        });
        const presented = await this.presentTurn(plan, {
          turnInput,
          externalEventId: externalEvent.id,
          traceId: input.traceId,
          conversationTurnState: effectiveConversationTurnState,
          styleOverride: initialOrchestrationPlanning?.compiled.styleUpdate ?? null,
          skipEnhancement: initialOrchestrationPlanning?.executive != null,
        });
        const orchestratorReason =
          captureDraftResolution.kind === "discarded"
            ? "accepted_with_capture_draft_discarded"
            : "accepted_with_capture_draft_clarification";

        await updateExternalEventStatus(this.client, {
          external_event_id: externalEvent.id,
          status: "accepted",
          metadata: {
            orchestrator_status: "accepted",
            orchestrator_reason: orchestratorReason,
            agent_runtime_required: false,
            pending_resolution_kind: pendingResolution.kind,
            pending_resolution_action: pendingResolution.action,
            pending_resolution_reason: pendingResolution.reason,
            capture_draft_resolution_kind: captureDraftResolution.kind,
            capture_draft_resolution_reason: captureDraftResolution.reason,
            capture_draft_state_id:
              captureDraftResolution.draft?.state_id ?? null,
            ...presentedTurnMetadata(plan, presented),
          },
        });

        return {
          externalEventId: externalEvent.id,
          status: "accepted",
          reason: orchestratorReason,
        };
      }

      if (!shouldTryCorrectionAfterPendingMiss) {
        const plan = planTurnBlocks({
          turnInput,
          userId: externalEvent.user_id,
          conversationTurnState: effectiveConversationTurnState,
          pendingResolution,
        });
        const presented = await this.presentTurn(plan, {
          turnInput,
          externalEventId: externalEvent.id,
          traceId: input.traceId,
          conversationTurnState: effectiveConversationTurnState,
          styleOverride: initialOrchestrationPlanning?.compiled.styleUpdate ?? null,
          skipEnhancement: initialOrchestrationPlanning?.executive != null,
        });
        const orchestratorReason =
          pendingResolution.kind === "confirmed"
            ? "accepted_with_pending_confirmed"
            : pendingResolution.kind === "discarded"
              ? "accepted_with_pending_discarded"
              : pendingResolution.kind === "listed"
                ? "accepted_with_pending_listed"
                : "accepted_with_pending_resolution_clarification";

        if (
          pendingResolution.kind === "confirmed" ||
          pendingResolution.kind === "discarded"
        ) {
          await rememberConversationOutcome({
            client: this.client,
            userId: externalEvent.user_id!,
            channel,
            intent: "pending_resolution",
            userMessage: text,
            resultSummary:
              presented.text ??
              (pendingResolution.kind === "confirmed"
                ? "Pendiente confirmado."
                : "Pendiente descartado."),
            sourceRef: externalEvent.id,
            topic: "pending",
            goal: "confirm",
            actionKind: "pending_resolved",
            actionStatus:
              pendingResolution.kind === "confirmed"
                ? "completed"
                : "cancelled",
            movements:
              pendingResolution.kind === "confirmed" &&
              pendingResolution.movement
                ? [movementToConversationReference(pendingResolution.movement)]
                : [],
            pendingItemIds: pendingResolution.pending_item
              ? [pendingResolution.pending_item.id]
              : [],
            previous: activeMemoryState?.working_set ?? null,
            now: externalEvent.received_at,
          });
        }

        await updateExternalEventStatus(this.client, {
          external_event_id: externalEvent.id,
          status: "accepted",
          metadata: {
            orchestrator_status: "accepted",
            orchestrator_reason: orchestratorReason,
            agent_runtime_required: false,
            pending_resolution_kind: pendingResolution.kind,
            pending_resolution_action: pendingResolution.action,
            pending_resolution_code: pendingResolution.pending_code,
            pending_resolution_reason: pendingResolution.reason,
            pending_resolution_pending_count: pendingResolution.pending_count,
            pending_resolution_pending_item_id:
              pendingResolution.pending_item?.id ?? null,
            pending_resolution_movement_id:
              pendingResolution.movement?.id ?? null,
            pending_resolution_idempotent: pendingResolution.idempotent,
            ...presentedTurnMetadata(plan, presented),
          },
        });

        return {
          externalEventId: externalEvent.id,
          status: "accepted",
          reason: orchestratorReason,
        };
      }
    }

    const dataContextPack = initialDataContextPack;
    const dataAgentResult = initialOrchestrationPlanning?.executive != null
      ? dataAgentResultFromExecutive(initialOrchestrationPlanning)
      : await this.dataAgent.extract(dataContextPack, input.traceId);
    const orchestrationPlanning = initialOrchestrationPlanning
      ? {
          ...initialOrchestrationPlanning,
          compiled: reconcileCompiledOrchestrationPlan({
            compiled: initialOrchestrationPlanning.compiled,
            proposedActionCount: dataAgentResult.output.result.length,
            turnState: effectiveConversationTurnState,
          }),
        }
      : null;
    if (
      orchestrationPlanning?.compiled.route === "correction_agent" ||
      (!orchestrationPlanning &&
        (dataAgentResult.output.intent === "correction" ||
          isCorrectionLikeText(text)))
    ) {
      const correctionContextPack = await this.buildCorrectionContextPack({
        externalEvent,
        text,
        channel,
        timezone: dataContextPack.timezone,
      });
      const correctionAgentResult =
        initialOrchestrationPlanning?.executive != null
          ? correctionResultFromExecutive(
              initialOrchestrationPlanning,
              correctionContextPack,
            )
          : await this.correctionAgent.propose(
              correctionContextPack,
              input.traceId,
            );

      if (correctionAgentResult.output.kind !== "not_correction") {
        const plan = planTurnBlocks({
          turnInput,
          userId: externalEvent.user_id,
          conversationTurnState: effectiveConversationTurnState,
          dataAgentCompleted: true,
          dataAgentIntent: dataAgentResult.output.intent,
          correctionProposal: correctionAgentResult.output,
        });
        const presented = await this.presentTurn(plan, {
          turnInput,
          externalEventId: externalEvent.id,
          traceId: input.traceId,
          conversationTurnState: effectiveConversationTurnState,
          timezone: dataContextPack.timezone,
          styleOverride: orchestrationPlanning?.compiled.styleUpdate ?? null,
          skipEnhancement: orchestrationPlanning?.executive != null,
        });
        const orchestratorReason =
          correctionAgentResult.output.kind === "requires_confirmation"
            ? "accepted_with_correction_confirmation"
            : correctionAgentResult.output.kind ===
                "candidate_selection_required"
              ? "accepted_with_correction_selection"
              : "accepted_with_correction_clarification";

        if (
          correctionAgentResult.output.kind === "requires_confirmation" ||
          correctionAgentResult.output.kind === "candidate_selection_required"
        ) {
          const commands =
            correctionAgentResult.output.kind === "requires_confirmation"
              ? [correctionAgentResult.output.command]
              : correctionAgentResult.output.commands;
          await rememberConversationOutcome({
            client: this.client,
            userId: externalEvent.user_id!,
            channel,
            intent: "correction",
            userMessage: text,
            resultSummary:
              presented.text ??
              correctionAgentResult.output.safe_explanation,
            sourceRef: externalEvent.id,
            topic: "movement",
            goal: "correct",
            actionKind: "correction_proposed",
            actionStatus: "awaiting_confirmation",
            movements: correctionContextPack.recent_movements
              .filter((movement) =>
                commands.some((command) => command.movement_id === movement.id),
              )
              .map(correctionCandidateToConversationReference),
            commandIds: commands.map((command) => command.command_id),
            unresolvedSlots:
              correctionAgentResult.output.kind ===
              "candidate_selection_required"
                ? ["Seleccionar el movimiento que debe corregirse."]
                : [],
            previous: activeMemoryState?.working_set ?? null,
            now: externalEvent.received_at,
          });
        }

        await updateExternalEventStatus(this.client, {
          external_event_id: externalEvent.id,
          status: "accepted",
          metadata: {
            orchestrator_status: "accepted",
            orchestrator_reason: orchestratorReason,
            agent_runtime_required: false,
            data_agent_status: "completed",
            data_agent_intent: dataAgentResult.output.intent,
            data_agent_confidence: dataAgentResult.output.confidence,
            data_agent_requires_confirmation:
              dataAgentResult.output.requires_confirmation,
            proposed_actions_count: dataAgentResult.output.result.length,
            data_agent_ambiguities: dataAgentResult.output.ambiguities,
            agent_runtime_provider: dataAgentResult.runtime.provider,
            agent_runtime_model: dataAgentResult.runtime.model_name ?? null,
            agent_runtime_latency_ms: dataAgentResult.runtime.latency_ms,
            agent_policy_flags: dataAgentResult.safety.policy_flags,
            correction_agent_status: "completed",
            correction_agent_kind: correctionAgentResult.output.kind,
            correction_agent_reason: correctionAgentResult.output.reason,
            correction_agent_confidence:
              correctionAgentResult.output.confidence,
            correction_agent_provider: correctionAgentResult.runtime.provider,
            correction_agent_model: correctionAgentResult.runtime.model_name,
            correction_agent_latency_ms:
              correctionAgentResult.runtime.latency_ms,
            correction_agent_policy_flags:
              correctionAgentResult.safety.policy_flags,
            correction_recent_candidate_count:
              correctionContextPack.recent_movements.length,
            ...getOrchestrationPlanningMetadata(orchestrationPlanning),
            ...presentedTurnMetadata(plan, presented),
          },
        });

        return {
          externalEventId: externalEvent.id,
          status: "accepted",
          reason: orchestratorReason,
        };
      }
    }

    if (
      dataAgentResult.output.result.length === 0 &&
      effectiveConversationTurnState.act === "financial_capture"
    ) {
      await rememberCaptureDraft({
        client: this.client,
        userId: externalEvent.user_id,
        channel,
        originalMessage: text,
        receivedAt: externalEvent.received_at,
        sourceRef: externalEvent.id,
        reason: "financial_capture_no_action",
        dataAgentOutput: dataAgentResult.output,
        financialActionPlan: null,
        now: new Date(externalEvent.received_at),
      });
    }

    if (
      shouldRouteZeroActionTurnToConversation({
        proposedActionCount: dataAgentResult.output.result.length,
        dataAgentIntent: dataAgentResult.output.intent,
        orchestrationRoute: orchestrationPlanning?.compiled.route ?? null,
        turnState: effectiveConversationTurnState,
      })
    ) {
      const usePlanningConversationRoute =
        orchestrationPlanning?.compiled.route === "conversation_agent";
      const conversationQuery = usePlanningConversationRoute
        ? orchestrationPlanning.compiled.conversationQuery
        : conversationTurn.query;
      const executiveTrace = orchestrationPlanning?.executive ?? null;
      const executiveActive = executiveTrace !== null;
      const conversationContextPack = executiveActive
        ? conversationContextFromExecutive({
            planning: orchestrationPlanning,
            query: conversationQuery,
            turnState: effectiveConversationTurnState,
          })
        : await new ToolGateway(this.client).buildConversationContextPack({
            userId: externalEvent.user_id!,
            locale: "es-PE",
            timezone: dataContextPack.timezone,
            channel,
            originalMessage: text,
            receivedAt: externalEvent.received_at,
            query: conversationQuery,
            turnState: effectiveConversationTurnState,
            activeMemoryState,
            requestedTools: usePlanningConversationRoute
              ? orchestrationPlanning.compiled.selectedTools
              : undefined,
            styleOverride: orchestrationPlanning?.compiled.styleUpdate ?? null,
          });
      const conversationAgentResult = executiveActive
        ? conversationResultFromExecutive(executiveTrace)
        : await this.conversationAgent.answer(
            conversationContextPack,
            input.traceId,
          );
      await rememberConversationTurn({
        client: this.client,
        channel,
        contextPack: conversationContextPack,
        answer: conversationAgentResult.output,
        sourceRef: externalEvent.id,
        traceId: input.traceId,
      });
      const plan = planTurnBlocks({
        turnInput,
        userId: externalEvent.user_id,
        conversationTurnState: effectiveConversationTurnState,
        dataAgentCompleted: true,
        dataAgentIntent: dataAgentResult.output.intent,
        conversationAnswer: conversationAgentResult.output,
      });
      const presented = await this.presentTurn(plan, {
        turnInput,
        externalEventId: externalEvent.id,
        traceId: input.traceId,
        conversationTurnState: effectiveConversationTurnState,
        timezone: dataContextPack.timezone,
        styleOverride: orchestrationPlanning?.compiled.styleUpdate ?? null,
        skipEnhancement: executiveActive,
      });

      await updateExternalEventStatus(this.client, {
        external_event_id: externalEvent.id,
        status: "accepted",
        metadata: {
          orchestrator_status: "accepted",
          orchestrator_reason: "accepted_with_conversation_response",
          agent_runtime_required: false,
          data_agent_status: "completed",
          data_agent_intent: dataAgentResult.output.intent,
          data_agent_confidence: dataAgentResult.output.confidence,
          data_agent_requires_confirmation:
            dataAgentResult.output.requires_confirmation,
          proposed_actions_count: dataAgentResult.output.result.length,
          data_agent_ambiguities: dataAgentResult.output.ambiguities,
          agent_runtime_provider: dataAgentResult.runtime.provider,
          agent_runtime_model: dataAgentResult.runtime.model_name ?? null,
          agent_runtime_latency_ms: dataAgentResult.runtime.latency_ms,
          agent_policy_flags: dataAgentResult.safety.policy_flags,
          conversation_query_kind: conversationQuery.kind,
          conversation_query_confidence: conversationQuery.confidence,
          conversation_query_requested_amount:
            conversationQuery.requested_amount,
          conversation_query_date_label:
            conversationQuery.date_range?.label ?? null,
          conversation_turn_act: effectiveConversationTurnState.act,
          conversation_turn_continuity: effectiveConversationTurnState.continuity,
          conversation_turn_emotional_state:
            effectiveConversationTurnState.emotional_state,
          conversation_turn_experience_mode:
            effectiveConversationTurnState.experience_mode,
          conversation_turn_used_active_memory:
            effectiveConversationTurnState.should_use_active_memory,
          conversation_agent_status: "completed",
          conversation_agent_answer_kind:
            conversationAgentResult.output.answer_kind,
          conversation_agent_confidence:
            conversationAgentResult.output.confidence,
          conversation_agent_provider: conversationAgentResult.runtime.provider,
          conversation_agent_model:
            conversationAgentResult.runtime.model_name ?? null,
          conversation_agent_latency_ms:
            conversationAgentResult.runtime.latency_ms,
          conversation_agent_policy_flags:
            conversationAgentResult.safety.policy_flags,
          conversation_agent_safety_flags:
            conversationAgentResult.output.safety_flags,
          conversation_agent_used_tools:
            conversationAgentResult.output.used_tools,
          conversation_agent_runtime_tool_calls:
            conversationAgentResult.tool_calls,
          conversation_tool_results: conversationContextPack.tool_results.map(
            (toolResult) => ({
              tool_name: toolResult.tool_name,
              status: toolResult.status,
              facts: toolResult.facts,
              warnings: toolResult.warnings,
            }),
          ),
          ...getOrchestrationPlanningMetadata(orchestrationPlanning),
          ...presentedTurnMetadata(plan, presented),
        },
      });

      return {
        externalEventId: externalEvent.id,
        status: "accepted",
        reason: "accepted_with_conversation_response",
      };
    }

    return this.handleDataAgentFinancialActions({
      externalEvent,
      turnInput,
      conversationTurnState: effectiveConversationTurnState,
      dataContextPack,
      dataAgentResult,
      originalMessage: text,
      traceId: input.traceId,
      orchestrationPlanning,
    });
  }

  private async handleDataAgentFinancialActions(params: {
    externalEvent: ExternalEventLog;
    turnInput: TurnInput;
    conversationTurnState: ConversationTurnState;
    dataContextPack: DataContextPack;
    dataAgentResult: DataAgentExtractResult;
    originalMessage: string;
    traceId: string;
    orchestrationPlanning?: OrchestrationPlanningTrace | null;
    captureDraftReplay?: {
      draftStateId: string;
      draftSourceRef: string | null;
      userText: string;
    };
  }): Promise<TurnOrchestrationResult> {
    const { externalEvent, dataAgentResult, dataContextPack, turnInput } = params;
    const channel = turnInput.channel;
    const userId = externalEvent.user_id!;
    const preflightHistory = await listRecentMovementsForPreflight(
      this.client,
      userId,
      { limit: 100 },
    ).then((movements) => ({
      status: "available" as const,
      movements,
    })).catch((error) => {
      logger.warn("orchestrator.financial_preflight_history_unavailable", {
        error,
        user_id: userId,
        trace_id: params.traceId,
      });
      return {
        status: "unavailable" as const,
        movements: [],
      };
    });
    const preflightHistoryStatus = preflightHistory.status;
    const recentMovements = preflightHistory.movements;
    const recentMedianAmount = calculateRecentAmountMedian(recentMovements);
    const riskSignalResult = await assessRiskSignals({
      agent: this.riskSignalAgent,
      userId,
      locale: "es-PE",
      timezone: dataContextPack.timezone,
      originalMessage: params.originalMessage,
      actions: dataAgentResult.output.result.map((action) => {
        const category = dataContextPack.categories.find(
          (candidate) => candidate.id === action.category_id,
        );
        return {
          action_id: action.action_id,
          movement_type: action.movement_type,
          amount: action.amount,
          description: action.description,
          category_id: action.category_id,
          category_sensitive: category?.is_sensitive === true,
          confidence: action.confidence,
          source_evidence: action.source_evidence.map(
            (evidence) => `${evidence.field}:${evidence.source}`,
          ),
        };
      }),
      recentMedianAmount,
      recentMovementCount: recentMovements.length,
      traceId: params.traceId,
      channel,
    });
    const riskAssessments: RiskSignalAssessment[] = [
      ...riskSignalResult.assessments,
      ...(preflightHistoryStatus === "unavailable"
        ? dataAgentResult.output.result.map((action) => ({
            action_id: action.action_id,
            semantic_level: "medium" as const,
            signals: ["preflight_history_unavailable"],
            confidence: 1,
            requires_confirmation_advisory: true,
            safe_explanation:
              "No se pudo verificar el historial reciente de forma segura.",
          }))
        : []),
    ];
    const policyPlan = planDataAgentFinancialActions({
      dataAgentOutput: dataAgentResult.output,
      accounts: dataContextPack.accounts.map((account) => ({
        id: account.id,
        is_default: account.is_default,
        name: account.name,
        currency: account.currency,
      })),
      categories: dataContextPack.categories.map((category) => ({
        id: category.id,
        is_sensitive: category.is_sensitive,
      })),
      debts: dataContextPack.active_debts ?? [],
      sourceRef: `${channel}:${externalEvent.id}`,
      receivedAt: dataContextPack.received_at,
      sourceText: dataContextPack.original_message,
      riskAssessments,
      recentMedianAmount,
      confirmedByUser: Boolean(params.captureDraftReplay),
      channel,
    });
    const dedupPreflight = await applyDedupPreflight({
      client: this.client,
      agent: this.dedupSignalAgent,
      plan: policyPlan,
      recentMovements,
      userId,
      traceId: params.traceId,
    });
    const financialActionPlan = dedupPreflight.plan;

    logger.warn("diag.financial_action_plan_debug", {
      trace_id: params.traceId,
      confirmed_by_user: Boolean(params.captureDraftReplay),
      actions: financialActionPlan.actions.map((action) => ({
        decision: action.decision,
        reasons: action.reasons,
        has_debt_creation_input: action.debt_creation_input !== null,
      })),
      execute_ready_data_actions: this.options.executeReadyDataActions,
    });

    const dispatcher = new CommandDispatcher(
      new SupabaseFinancialCoreRepository(this.client),
      {
        debtPaymentHandler: new DebtPaymentCommandHandler(
          new SupabaseDebtPaymentExecutionPort(this.client)
        ),
        debtCreationHandler: new DebtCreationCommandHandler(
          new SupabaseDebtCreationExecutionPort(this.client),
        ),
      }
    );
    const financialActionExecution =
      this.options.executeReadyDataActions === true
        ? await executeReadyDataActionPlan({
            plan: financialActionPlan,
            dispatcher,
            userId,
            traceId: params.traceId,
            externalEventId: externalEvent.id,
            channel,
          })
        : ({
            kind: "not_executed",
            reason: "core_execution_disabled",
            created_count: 0,
            idempotent_count: 0,
            movements: [],
          } satisfies DataActionExecutionResult);

    let emailPendingReconciliation: EmailPendingReconciliationResult = {
      evaluated: 0,
      auto_resolved: 0,
      pending_item_ids: [],
    };
    let emailPendingReconciliationStatus:
      | "completed"
      | "failed"
      | "not_applicable" = "not_applicable";
    if (financialActionExecution.kind === "executed") {
      try {
        emailPendingReconciliation =
          await reconcileEmailPendingAfterMovements({
            client: this.client,
            userId,
            movements: financialActionExecution.movements,
            traceId: params.traceId,
            channel,
          });
        emailPendingReconciliationStatus = "completed";
      } catch (error) {
        emailPendingReconciliationStatus = "failed";
        logger.warn("dedup.email_pending_reconciliation_failed", {
          error,
          user_id: userId,
          trace_id: params.traceId,
        });
      }
    }

    const pendingCreation = await createPendingItemsForDataActionPlan({
      client: this.client,
      plan: financialActionPlan,
      userId,
      traceId: params.traceId,
      externalEventId: externalEvent.id,
      originalMessage: params.originalMessage,
      channel,
    });

    const captureDraftMemory = await this.syncCaptureDraftMemory({
      externalEvent,
      channel,
      conversationTurnState: params.conversationTurnState,
      dataAgentResult,
      financialActionPlan,
      financialActionExecution,
      pendingCreation,
      originalMessage: params.originalMessage,
      receivedAt: dataContextPack.received_at,
      sourceRef: params.captureDraftReplay?.draftSourceRef ?? externalEvent.id,
      replayed: Boolean(params.captureDraftReplay),
    });

    const mixedConversation = await this.answerMixedWorkflow({
      externalEvent,
      channel,
      dataContextPack,
      conversationTurnState: params.conversationTurnState,
      financialActionExecution,
      orchestrationPlanning: params.orchestrationPlanning ?? null,
      traceId: params.traceId,
    });

    const plan = planTurnBlocks({
      turnInput,
      userId: externalEvent.user_id,
      conversationTurnState: params.conversationTurnState,
      dataAgentCompleted: true,
      dataAgentIntent: dataAgentResult.output.intent,
      financialActionPlan,
      financialActionExecution,
      pendingCreation,
      supplementalConversationAnswer: mixedConversation?.result.output,
      autoAckEnabled: this.options.autoAckInbound,
    });
    const presented = mixedConversation
      ? presentedTurnForVerbatimAnswer(plan)
      : await this.presentTurn(plan, {
          turnInput,
          externalEventId: externalEvent.id,
          traceId: params.traceId,
          conversationTurnState: params.conversationTurnState,
          timezone: dataContextPack.timezone,
          styleOverride: params.orchestrationPlanning?.compiled.styleUpdate ?? null,
          skipEnhancement: params.orchestrationPlanning?.executive != null,
        });
    const orchestratorReason = getDataAgentOrchestratorReason({
      financialActionExecution,
      pendingCreation,
      plan,
    });

    if (
      financialActionExecution.kind === "executed" ||
      pendingCreation.kind === "created"
    ) {
      await rememberConversationOutcome({
        client: this.client,
        userId,
        channel,
        intent: dataAgentResult.output.intent,
        userMessage: params.originalMessage,
        resultSummary:
          presented.text ??
          (financialActionExecution.kind === "executed"
            ? "Movimiento financiero registrado."
            : "Movimiento separado para revision."),
        sourceRef: externalEvent.id,
        topic:
          financialActionExecution.kind === "executed" &&
          financialActionExecution.debts?.length
            ? "debt"
            : "movement",
        goal: "capture",
        actionKind:
          financialActionExecution.kind === "executed"
            ? financialActionExecution.debts?.length
              ? "debt_created"
              : "movement_created"
            : "pending_created",
        actionStatus:
          financialActionExecution.kind === "executed"
            ? "completed"
            : "awaiting_confirmation",
        movements:
          financialActionExecution.kind === "executed"
            ? financialActionExecution.movements.map(
                executedMovementToConversationReference,
              )
            : [],
        entities:
          financialActionExecution.kind === "executed"
            ? (financialActionExecution.debts ?? []).map((debt) => ({
                id: debt.debt_id,
                type: "debt",
                name: debt.name,
                direction: debt.direction,
                principal_amount: debt.principal_amount,
                currency: debt.currency,
                installment_count: debt.installment_count,
              }))
            : [],
        pendingItemIds:
          pendingCreation.kind === "created"
            ? pendingCreation.pending_items.map((item) => item.pending_item_id)
            : [],
        unresolvedSlots:
          pendingCreation.kind === "created"
            ? ["Confirmar o descartar el movimiento pendiente."]
            : [],
        now: externalEvent.received_at,
      });
    }

    await updateExternalEventStatus(this.client, {
      external_event_id: externalEvent.id,
      status: "accepted",
      metadata: {
        orchestrator_status: "accepted",
        orchestrator_reason: orchestratorReason,
        agent_runtime_required: false,
        data_agent_status: "completed",
        data_agent_intent: dataAgentResult.output.intent,
        data_agent_confidence: dataAgentResult.output.confidence,
        data_agent_requires_confirmation:
          dataAgentResult.output.requires_confirmation,
        proposed_actions_count: dataAgentResult.output.result.length,
        data_agent_ambiguities: dataAgentResult.output.ambiguities,
        agent_runtime_provider: dataAgentResult.runtime.provider,
        agent_runtime_model: dataAgentResult.runtime.model_name ?? null,
        agent_runtime_latency_ms: dataAgentResult.runtime.latency_ms,
        agent_policy_flags: dataAgentResult.safety.policy_flags,
        ...getOrchestrationPlanningMetadata(
          params.orchestrationPlanning ?? null,
        ),
        financial_action_plan_kind: financialActionPlan.kind,
        financial_action_plan_reason: financialActionPlan.reason,
        financial_action_ready_count: financialActionPlan.ready_count,
        financial_action_requires_confirmation_count:
          financialActionPlan.requires_confirmation_count,
        financial_action_blocked_count: financialActionPlan.blocked_count,
        financial_action_plan_actions: financialActionPlan.actions.map(
          (action) => ({
            action_id: action.action_id,
            decision: action.decision,
            reasons: action.reasons,
            movement_type: action.movement_input?.type ?? null,
          }),
        ),
        financial_action_execution_kind: financialActionExecution.kind,
        financial_action_execution_reason: financialActionExecution.reason,
        financial_action_execution_created_count:
          financialActionExecution.created_count,
        financial_action_execution_idempotent_count:
          financialActionExecution.idempotent_count,
        financial_action_execution_movements:
          financialActionExecution.movements,
        financial_action_execution_debts:
          financialActionExecution.kind === "executed"
            ? financialActionExecution.debts ?? []
            : [],
        pending_creation_kind: pendingCreation.kind,
        pending_creation_reason: pendingCreation.reason,
        pending_creation_created_count: pendingCreation.created_count,
        pending_creation_idempotent_count: pendingCreation.idempotent_count,
        pending_creation_items: pendingCreation.pending_items,
        capture_draft_memory_action: captureDraftMemory.action,
        capture_draft_memory_reason: captureDraftMemory.reason,
        capture_draft_replay: Boolean(params.captureDraftReplay),
        capture_draft_replay_state_id:
          params.captureDraftReplay?.draftStateId ?? null,
        capture_draft_replay_source_ref:
          params.captureDraftReplay?.draftSourceRef ?? null,
        capture_draft_replay_user_text:
          params.captureDraftReplay?.userText ?? null,
        mixed_conversation_status: mixedConversation
          ? "completed"
          : params.orchestrationPlanning?.compiled
                .runConversationAfterFinancialAction === true
            ? "not_completed"
            : "not_applicable",
        mixed_conversation_query_kind:
          mixedConversation?.contextPack.query.kind ?? null,
        mixed_conversation_tools:
          mixedConversation?.result.output.used_tools ?? [],
        mixed_conversation_runtime_tool_calls:
          mixedConversation?.result.tool_calls ?? [],
        mixed_conversation_provider:
          mixedConversation?.result.runtime.provider ?? null,
        mixed_conversation_model:
          mixedConversation?.result.runtime.model_name ?? null,
        mixed_conversation_latency_ms:
          mixedConversation?.result.runtime.latency_ms ?? null,
        mixed_conversation_tool_results:
          mixedConversation?.contextPack.tool_results.map((toolResult) => ({
            tool_name: toolResult.tool_name,
            status: toolResult.status,
            facts: toolResult.facts,
            warnings: toolResult.warnings,
          })) ?? [],
        financial_preflight_history_status: preflightHistoryStatus,
        financial_preflight_recent_movement_count:
          preflightHistoryStatus === "available"
            ? recentMovements.length
            : null,
        financial_preflight_recent_amount_median: recentMedianAmount,
        risk_signal_agent_status: riskSignalResult.agent_status,
        risk_signal_agent_provider: riskSignalResult.provider,
        risk_signal_agent_model: riskSignalResult.model,
        risk_signal_agent_latency_ms: riskSignalResult.latency_ms,
        risk_signal_assessment_count: riskAssessments.length,
        dedup_decisions: dedupPreflight.decisions,
        dedup_semantic_agent_runs: dedupPreflight.semantic_agent_runs,
        dedup_semantic_agent_failures: dedupPreflight.semantic_agent_failures,
        email_pending_reconciliation_status:
          emailPendingReconciliationStatus,
        email_pending_reconciliation_evaluated:
          emailPendingReconciliation.evaluated,
        email_pending_reconciliation_auto_resolved:
          emailPendingReconciliation.auto_resolved,
        email_pending_reconciliation_pending_ids:
          emailPendingReconciliation.pending_item_ids,
        ...presentedTurnMetadata(plan, presented),
      },
    });

    return {
      externalEventId: externalEvent.id,
      status: "accepted",
      reason: orchestratorReason,
    };
  }

  private async syncCaptureDraftMemory(params: {
    externalEvent: ExternalEventLog;
    channel: Channel;
    conversationTurnState: ConversationTurnState;
    dataAgentResult: DataAgentExtractResult;
    financialActionPlan: ReturnType<typeof planDataAgentFinancialActions>;
    financialActionExecution: DataActionExecutionResult;
    pendingCreation: DataActionPendingCreationResult;
    originalMessage: string;
    receivedAt: string;
    sourceRef: string | null;
    replayed: boolean;
  }): Promise<{
    action: "none" | "remembered" | "cleared";
    reason: string | null;
  }> {
    const { externalEvent, channel } = params;
    const userId = externalEvent.user_id!;
    const now = new Date(externalEvent.received_at);

    if (
      params.financialActionExecution.kind === "executed" ||
      params.pendingCreation.kind === "created"
    ) {
      await clearCaptureDraftMemory({
        client: this.client,
        userId,
        channel,
        reason: params.replayed ? "confirmed" : "superseded",
        now,
      });

      return {
        action: "cleared",
        reason: params.replayed ? "confirmed" : "superseded",
      };
    }

    const draftReason = shouldRememberCaptureDraft({
      turnState: params.conversationTurnState,
      dataAgentOutput: params.dataAgentResult.output,
      financialActionPlan: params.financialActionPlan,
    });

    if (!draftReason) {
      return {
        action: "none",
        reason: null,
      };
    }

    await rememberCaptureDraft({
      client: this.client,
      userId,
      channel,
      originalMessage: params.originalMessage,
      receivedAt: params.receivedAt,
      sourceRef: params.sourceRef,
      reason: draftReason,
      dataAgentOutput: params.dataAgentResult.output,
      financialActionPlan: params.financialActionPlan,
      now,
    });

    return {
      action: "remembered",
      reason: draftReason,
    };
  }

  private async answerMixedWorkflow(params: {
    externalEvent: ExternalEventLog;
    channel: Channel;
    dataContextPack: DataContextPack;
    conversationTurnState: ConversationTurnState;
    financialActionExecution: DataActionExecutionResult;
    orchestrationPlanning: OrchestrationPlanningTrace | null;
    traceId: string;
  }): Promise<MixedConversationTrace | null> {
    const planning = params.orchestrationPlanning?.compiled;
    if (
      !planning?.runConversationAfterFinancialAction ||
      params.financialActionExecution.kind !== "executed" ||
      planning.selectedTools.length === 0
    ) {
      return null;
    }

    const toolGateway = new ToolGateway(this.client);
    const turnState: ConversationTurnState = {
      ...params.conversationTurnState,
      act: "financial_question",
      continuity: "follow_up",
      experience_mode: "read_only_answer",
      should_route_to_conversation_agent: true,
      should_ask_clarification_first: false,
      response_guidance: [
        ...params.conversationTurnState.response_guidance,
        "El movimiento de este turno ya fue confirmado por Core; responde solo la pregunta adicional con evidencia actual.",
      ].slice(0, 8),
    };

    try {
      const executiveActive =
        params.orchestrationPlanning?.executive != null;
      const contextPack = await toolGateway.buildConversationContextPack({
        userId: params.externalEvent.user_id!,
        locale: "es-PE",
        timezone: params.dataContextPack.timezone,
        channel: params.channel,
        originalMessage: params.dataContextPack.original_message,
        receivedAt: params.dataContextPack.received_at,
        query: planning.conversationQuery,
        turnState,
        requestedTools: planning.selectedTools,
      });
      const result = executiveActive
        ? conversationResultFromPostCoreEvidence(
            contextPack,
            params.orchestrationPlanning?.executive ?? null,
          )
        : await this.conversationAgent.answer(
            contextPack,
            params.traceId,
          );

      await rememberConversationTurn({
        client: this.client,
        channel: params.channel,
        contextPack,
        answer: result.output,
        sourceRef: params.externalEvent.id,
        traceId: params.traceId,
      });

      return { contextPack, result };
    } catch (error) {
      // A failed read-only follow-up must not undo or hide a Core-confirmed action.
      logger.warn("orchestrator.mixed_conversation_failed", {
        trace_id: params.traceId,
        external_event_id: params.externalEvent.id,
        error,
      });
      return null;
    }
  }

  private async planTurn(params: {
    externalEvent: ExternalEventLog;
    text: string;
    timezone: string;
    channel: Channel;
    conversationTurn: ReturnType<typeof analyzeConversationTurn>;
    activeMemoryState: Awaited<
      ReturnType<typeof getActiveConversationMemoryState>
    >;
    traceId: string;
    dataContextPack: DataContextPack;
  }): Promise<OrchestrationPlanningTrace | null> {
    const activeState = params.activeMemoryState;
    try {
      const [captureDraft, pendingCandidates, accounts, categories] =
        await Promise.all([
        getActiveCaptureDraftMemory({
          client: this.client,
          userId: params.externalEvent.user_id!,
          channel: params.channel,
          now: params.externalEvent.received_at,
        }).then((draft) => {
          logger.warn("diag.capture_draft_at_plan_time", {
            trace_id: params.traceId,
            text: params.text,
            draft_reason: draft?.reason ?? null,
            draft_original_message: draft?.original_message ?? null,
            draft_proposed_actions_count:
              draft?.data_agent_output?.result.length ?? null,
            draft_debt_hint:
              draft?.data_agent_output?.result?.[0]?.debt_hint ?? null,
          });
          return draft;
        }),
        listPendingItems(this.client, params.externalEvent.user_id!, {
          limit: 5,
        }),
        getActiveAccounts(this.client, params.externalEvent.user_id!),
        getAllCategories(this.client),
      ]);
      const contextPack = buildSafePlanningContext({
        userId: params.externalEvent.user_id!,
        timezone: params.timezone,
        channel: params.channel,
        originalMessage: params.text,
        receivedAt: params.externalEvent.received_at,
        query: params.conversationTurn.query,
        turnState: params.conversationTurn.turn_state,
        activeMemoryState: {
          state_id: activeState?.id ?? null,
          last_intent: activeState?.last_intent ?? null,
          last_query_kind: activeState?.last_query_kind ?? null,
          last_query_text: activeState?.last_query_text ?? null,
          last_result_summary: activeState?.last_result_summary ?? null,
          referenced_movement_count:
            activeState?.referenced_movements.length ?? 0,
          referenced_entity_count:
            activeState?.referenced_entities.length ?? 0,
          continuity_hint: activeState?.continuity_hint ?? null,
          expires_at: activeState?.expires_at ?? null,
          working_set: activeState?.working_set ?? null,
        },
        activeFinancialState: {
          capture_draft: captureDraft
            ? {
                state_id: captureDraft.state_id,
                reason: captureDraft.reason,
                original_message: captureDraft.original_message,
                created_at: captureDraft.created_at,
                proposed_actions_count:
                  captureDraft.financial_plan?.proposed_actions_count ??
                  captureDraft.data_agent_output?.result.length ??
                  0,
                missing_facts: getCaptureDraftMissingFacts(captureDraft),
              }
            : null,
          pending_candidates: pendingCandidates.map((item) => ({
            pending_code: buildPendingItemReferenceCode(item),
            title: item.normalized_summary.title ?? null,
            subtitle: item.normalized_summary.subtitle ?? null,
            amount: item.normalized_summary.amount ?? null,
            currency: item.normalized_summary.currency ?? null,
            occurred_at: item.normalized_summary.occurred_at ?? null,
            created_at: item.created_at,
            proposed_action: readString(item.proposed_action.action),
            movement_type: readString(item.proposed_action.movement_type),
            account_hint:
              readString(item.metadata.account_hint) ??
              item.normalized_summary.account_hint ??
              null,
            account_origin_hint: readString(
              item.metadata.account_origin_hint,
            ),
            account_destination_hint: readString(
              item.metadata.account_destination_hint,
            ),
            account_origin_id: readString(
              item.proposed_action.account_origin_id,
            ),
            account_destination_id: readString(
              item.proposed_action.account_destination_id,
            ),
          })),
          account_options: accounts.map((account) => ({
            account_id: account.id,
            name: account.name,
            institution: account.institution,
            currency: account.currency,
            is_default: account.is_default,
          })),
          category_options: categories.map((category) => ({
            category_id: category.id,
            label: category.label,
          })),
        },
      });
      const executiveMode = this.getConversationalExecutiveMode();
      // El hilo del asistente web viaja en la metadata del evento externo
      // (`handle-web-turn.ts`); otros canales todavia no tienen hilo, y ahi
      // el historial queda vacio sin cambiar nada del turno.
      const conversationHistory =
        executiveMode === "off"
          ? []
          : await readThreadConversationHistory({
              client: this.client,
              userId: params.externalEvent.user_id!,
              threadId: readString(params.externalEvent.metadata.thread_id),
              excludeTraceId: params.traceId,
            });
      const toolGateway = new ToolGateway(this.client);
      const conversationContext = await toolGateway.buildConversationContextPack({
        userId: params.externalEvent.user_id!,
        locale: "es-PE",
        timezone: params.timezone,
        channel: params.channel,
        originalMessage: params.text,
        receivedAt: params.externalEvent.received_at,
        query: params.conversationTurn.query,
        turnState: params.conversationTurn.turn_state,
        activeMemoryState: activeState,
        providedToolResults: [],
      });
      const executiveContext: ConversationalExecutiveContextPack = {
        context_pack_type: "conversational_executive_context",
        version: "v1",
        planning_context: contextPack,
        data_context: params.dataContextPack,
        conversation_context: conversationContext,
        turn_workspace: buildTurnWorkspace({
          turnId: params.traceId,
          planningContext: contextPack,
          dataContext: params.dataContextPack,
          conversationContext,
        }),
        conversation_history: conversationHistory,
        constraints: [
          "La IA propone; el dominio valida; el Core ejecuta.",
          "Las tools son read-only y sus resultados son la unica fuente factual actual.",
          "Pendientes no afectan saldos.",
          "Memoria y focus_set no autorizan escrituras.",
          "Toda correccion accionable requiere confirmacion.",
        ],
      };
      return await this.turnCoordinator.coordinate({
        mode: executiveMode,
        executiveContext,
        traceId: params.traceId,
        workingSet: activeState?.working_set ?? null,
        executeReadOnlyTool: (toolName, toolInput) =>
          toolGateway.executeAuthorizedTool({
            toolName,
            userId: params.externalEvent.user_id!,
            query: toolInput.query,
            semanticQuery: toolInput.semantic_query,
            activeMemoryState: activeState,
            turnState: {
              ...params.conversationTurn.turn_state,
              should_use_active_memory:
                toolInput.should_use_active_memory,
            },
          }),
      });
    } catch (error) {
      // Shadow/legacy planning can improve a turn but must never block fallback.
      logger.warn("orchestrator.orchestration_planning_failed", {
        trace_id: params.traceId,
        external_event_id: params.externalEvent.id,
        error,
      });
      return null;
    }
  }

  private async buildDataContextPack(
    externalEvent: NonNullable<
      Awaited<ReturnType<typeof getExternalEventById>>
    >,
    text: string,
    channel: Channel,
    knownTimezone?: string,
  ) {
    const [
      profile,
      accounts,
      boxes,
      catalog,
      recentMovements,
       recentCorrections,
       activeDebts,
       preferences,
      learnedMemory,
      activeCaptureDraft,
    ] =
      await Promise.all([
      knownTimezone
        ? Promise.resolve(null)
        : getProfile(this.client, externalEvent.user_id!),
      getActiveAccounts(this.client, externalEvent.user_id!),
      getActiveBoxes(this.client, externalEvent.user_id!),
      getClassificationCatalog(this.client, externalEvent.user_id!),
      listRecentMovementsForDataContext(this.client, externalEvent.user_id!),
      listRecentCorrectionsForDataContext(this.client, externalEvent.user_id!),
      listActiveDebtsForDataContext(this.client, externalEvent.user_id!),
      this.client
        .from("user_preferences")
        .select(
          "tone_style,discreet_mode_enabled,default_account_id,metadata,quiet_hours_start,quiet_hours_end",
        )
        .eq("user_id", externalEvent.user_id!)
        .maybeSingle(),
      searchConfirmedFinancialMemory(this.client, {
        userId: externalEvent.user_id!,
        queryText: text,
        limit: 20,
        now: externalEvent.received_at,
      }),
      getActiveCaptureDraftMemory({
        client: this.client,
        userId: externalEvent.user_id!,
        channel,
        now: externalEvent.received_at,
      }),
    ]);

    const preferenceRow = preferences.error ? null : preferences.data;
    const persistentStyle = readPersistentConversationStyle({
      metadata: preferenceRow?.metadata,
      legacyToneStyle: preferenceRow?.tone_style,
    });
    const relatedPeople = catalog.related_people.map((person) => ({
      id: person.id,
      display_name: person.display_name,
      kind: person.kind ?? null,
      relationship_label: person.relationship_label ?? null,
      aliases: readStringArray(person.metadata, [
        "aliases",
        "alias",
        "nicknames",
        "apodos",
      ]),
    }));

    return {
      context_pack_type: "data_context" as const,
      version: "v2" as const,
      user_id: externalEvent.user_id!,
      locale: "es-PE" as const,
      timezone: knownTimezone ?? profile?.timezone ?? "America/Lima",
      discreet_mode: preferenceRow?.discreet_mode_enabled ?? false,
      preferences_summary: {
        tone_style: preferenceRow?.tone_style ?? null,
        conversation_style: persistentStyle,
        default_account_id: preferenceRow?.default_account_id ?? null,
        quiet_hours: {
          start: preferenceRow?.quiet_hours_start ?? null,
          end: preferenceRow?.quiet_hours_end ?? null,
        },
      },
      risk_context: {
        source: channel,
        external_event_id: externalEvent.id,
      },
      original_message: text,
      received_at: externalEvent.received_at,
      categories: catalog.categories.map((category) => ({
        id: category.id,
        label: category.label,
        is_sensitive: category.is_sensitive,
      })),
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        currency: (account.currency === "USD" ? "USD" : "PEN") as "PEN" | "USD",
        is_default: account.is_default,
      })),
      boxes: boxes.map((box) => ({
        id: box.id,
        account_id: box.account_id,
        name: box.name,
        type: box.type,
        current_balance: Number(box.current_balance),
        target_amount: box.target_amount === null ? null : Number(box.target_amount),
        target_date: box.target_date,
      })),
      subcategories: catalog.subcategories.map((subcategory) => ({
        id: subcategory.id,
        category_id: subcategory.category_id,
        label: subcategory.label,
        normalized_label: subcategory.normalized_label,
      })),
      tags: catalog.tags.map((tag) => ({
        id: tag.id,
        key: tag.key,
        label: tag.label,
        type: tag.type,
        is_system: tag.is_system,
      })),
      related_people: relatedPeople,
      active_debts: activeDebts,
      recent_movements: recentMovements,
      recent_corrections: recentCorrections,
      learned_vocabulary: learnedMemory
        .filter(
          (item) =>
            (item.kind === "alias" || item.kind === "correction_pattern") &&
            item.sensitivity === "normal",
        )
        .flatMap((item) => {
          const terms = item.search_terms.length > 0 ? item.search_terms : [item.canonical_key];
          return terms.slice(0, 5).map((term) => ({
            term,
            meaning: item.summary,
            kind: item.kind as "alias" | "correction_pattern",
            confidence: item.confidence,
            evidence_source: item.evidence_source,
          }));
        })
        .slice(0, 30),
      active_capture_draft: activeCaptureDraft,
    };
  }

  private async persistExplicitConversationStyle(input: {
    userId: string;
    styleUpdate: ConversationStyleProfile | null;
    resetStyle: boolean;
    evidenceRef: string;
    observedAt: string;
    traceId: string;
  }) {
    if (!input.resetStyle && input.styleUpdate?.scope !== "persistent") return;

    const styleMemories = (
      await listFinancialMemory(this.client, {
        userId: input.userId,
        statuses: ["confirmed", "suspended"],
        limit: 200,
      })
    ).filter((memory) =>
      memory.canonical_key.startsWith("preference:conversation_style:"),
    );

    if (input.resetStyle) {
      for (const memory of styleMemories) {
        await manageFinancialMemory(this.client, {
          userId: input.userId,
          memoryId: memory.id,
          action: "forget",
          reason: "explicit_conversation_style_reset",
          idempotencyKey:
            `conversation-style-reset:${input.evidenceRef}:${memory.id}`,
        });
      }
    } else if (input.styleUpdate) {
      const outcomes = await new LearningEngine(this.client).learnExplicitPreference({
        userId: input.userId,
        canonicalKey:
          `preference:conversation_style:${input.evidenceRef}`,
        summary:
          "Preferencia de conversación: " +
          formatConversationStyleInstruction(input.styleUpdate),
        searchTerms: [
          "preferencia",
          "conversacion",
          "estilo",
          input.styleUpdate.response_length,
          input.styleUpdate.formality,
          input.styleUpdate.directness,
        ],
        evidenceRef: input.evidenceRef,
        claimValue: {
          conversation_style: input.styleUpdate,
        },
        observedAt: input.observedAt,
        traceId: input.traceId,
      });
      const promoted = outcomes.find(
        (outcome) => outcome.promoted_to_memory && outcome.memory_id,
      );
      if (!promoted?.memory_id) {
        logger.warn("orchestrator.conversation_style_learning_not_promoted", {
          user_id: input.userId,
          trace_id: input.traceId,
          evidence_ref: input.evidenceRef,
          outcomes,
        });
        return;
      }
      for (const memory of styleMemories) {
        if (memory.id === promoted.memory_id) continue;
        await manageFinancialMemory(this.client, {
          userId: input.userId,
          memoryId: memory.id,
          action: "forget",
          reason: "superseded_by_explicit_conversation_style",
          idempotencyKey:
            `conversation-style-replace:${input.evidenceRef}:${memory.id}`,
        });
      }
    }

    const toneStyle = input.resetStyle
      ? null
      : formatConversationStyleInstruction(input.styleUpdate);
    const preferences = await this.client
      .from("user_preferences")
      .select("metadata")
      .eq("user_id", input.userId)
      .maybeSingle();

    if (preferences.error) {
      logger.warn("orchestrator.conversation_style_persist_failed", {
        user_id: input.userId,
        error: preferences.error,
      });
      return;
    }

    const metadata = writePersistentConversationStyle({
      metadata: preferences.data?.metadata,
      style: input.resetStyle ? null : input.styleUpdate,
    });
    const { error } = await this.client
      .from("user_preferences")
      .update({ tone_style: toneStyle, metadata: metadata as Json })
      .eq("user_id", input.userId);

    if (error) {
      logger.warn("orchestrator.conversation_style_persist_failed", {
        user_id: input.userId,
        error,
      });
    }
  }

  private async buildCorrectionContextPack(params: {
    externalEvent: NonNullable<
      Awaited<ReturnType<typeof getExternalEventById>>
    >;
    text: string;
    channel: Channel;
    timezone: string;
  }) {
    const userId = params.externalEvent.user_id!;
    const [recentMovements, accounts, categories, activeState, recentChanges] =
      await Promise.all([
        listRecentMovementsForCorrection(this.client, userId, { limit: 5 }),
        getActiveAccounts(this.client, userId),
        getAllCategories(this.client),
        getActiveConversationMemoryState(this.client, {
          userId,
          channel: params.channel,
          now: params.externalEvent.received_at,
        }),
        this.client
          .from("movement_audit_log")
          .select("movement_id,action,field_name,created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

    return {
      context_pack_type: "correction_context" as const,
      version: "v1" as const,
      user_id: userId,
      locale: "es-PE" as const,
      timezone: params.timezone,
      channel: params.channel,
      original_message: params.text,
      received_at: params.externalEvent.received_at,
      recent_movements: recentMovements,
      accounts: accounts.map((account) => ({
        id: account.id,
        name: account.name,
        type: account.type,
        is_default: account.is_default,
      })),
      categories: categories.map((category) => ({
        id: category.id,
        label: category.label,
        is_sensitive: category.is_sensitive,
      })),
      active_conversation_state: {
        last_response_summary: activeState?.last_result_summary ?? null,
        continuity_hint: activeState?.continuity_hint ?? null,
        referenced_movement_ids:
          activeState?.referenced_movements.map((movement) => movement.id) ??
          [],
        working_set: activeState?.working_set ?? null,
      },
      recent_changes: (recentChanges.data ?? []).map((change) => ({
        movement_id: change.movement_id,
        action: change.action,
        field_name: change.field_name,
        created_at: change.created_at,
      })),
      undo_rules: [
        "Toda correccion o eliminacion requiere confirmacion explicita antes de CommandDispatcher.",
        "Una eliminacion confirmada usa soft delete; no borra auditoria.",
        "No se corrigen movimientos eliminados, revertidos, transferencias ni asignaciones internas desde este flujo.",
        "Si la referencia no identifica un unico candidato seguro, se pide aclaracion.",
      ],
    };
  }
}

function correctionCandidateToConversationReference(
  movement: CorrectionMovementCandidate,
): ConversationReferencedMovement {
  return {
    id: movement.id,
    type: movement.type,
    amount: Number(movement.amount),
    currency: movement.currency,
    description: movement.description,
    merchant: movement.merchant,
    category_id: movement.category_id,
    occurred_at: movement.occurred_at,
    account_origin_id: movement.account_origin_id,
    account_destination_id: movement.account_destination_id,
    requires_review: movement.status === "needs_review",
  };
}

function executedMovementToConversationReference(
  movement: ExecutedDataActionMovement,
): ConversationReferencedMovement {
  return {
    id: movement.movement_id,
    type: movement.movement_type,
    amount: Number(movement.amount),
    currency: movement.currency,
    description: movement.description,
    category_id: movement.category_id,
    occurred_at: movement.occurred_at,
    account_origin_id: movement.account_origin_id,
    account_destination_id: movement.account_destination_id,
    requires_review: movement.status === "needs_review",
  };
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function readStringArray(metadata: unknown, keys: string[]): string[] {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) {
    return [];
  }
  const record = metadata as Record<string, unknown>;
  const values: string[] = [];
  for (const key of keys) {
    const value = record[key];
    if (Array.isArray(value)) {
      values.push(
        ...value.filter((item): item is string => typeof item === "string"),
      );
    } else if (typeof value === "string") {
      values.push(value);
    }
  }
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function presentedTurnMetadata(plan: PlanTurnBlocksResult, presented: PresentedTurn) {
  return {
    response_plan_block_kinds: plan.blocks.map((block) => block.kind),
    response_plan_intent: plan.intent,
    response_plan_reason: plan.reason,
    response_plan_text: presented.text,
    response_agent_status: presented.enhancement.status,
    response_agent_reason: presented.enhancement.reason,
    response_agent_confidence: presented.enhancement.confidence,
    response_agent_provider: presented.enhancement.provider,
    response_agent_model: presented.enhancement.model,
    response_agent_latency_ms: presented.enhancement.latencyMs,
    response_agent_safety_flags: presented.enhancement.safetyFlags,
    response_style_active: presented.enhancement.styleActive,
    response_style_scope: presented.enhancement.styleScope,
    response_style_adherence: presented.enhancement.styleAdherence,
    response_style_blocked_reasons: presented.enhancement.styleBlockedReasons,
    response_agent_attempt_count: presented.enhancement.attemptCount,
    response_interactive_option_count: presented.interactiveOptionCount,
    response_delivery_mode: presented.deliveryMode,
    response_send_status: presented.sendStatus,
    response_send_reason: presented.sendReason,
    response_send_idempotent: presented.idempotent,
    response_send_provider_message_id: presented.providerMessageId,
    response_send_error_code: presented.errorCode,
  };
}

// Cuando la respuesta a un flujo mixto ya se emitió tal cual (sin pasar por
// el agente de estilo), no hay presentador que llamar: solo se registra que
// se preservó verbatim.
function presentedTurnForVerbatimAnswer(plan: PlanTurnBlocksResult): PresentedTurn {
  return {
    text: plan.blocks.map((block) => ("text" in block ? block.text : "")).join("\n\n") || null,
    deliveryMode: null,
    interactiveOptionCount: null,
    sendStatus: "not_applicable",
    sendReason: "mixed_answer_preserved_verbatim",
    idempotent: false,
    providerMessageId: null,
    errorCode: null,
    enhancement: {
      status: "not_applicable",
      reason: "disabled",
      confidence: null,
      provider: null,
      model: null,
      latencyMs: null,
      safetyFlags: ["mixed_answer_preserved_verbatim"],
      styleActive: false,
      styleScope: null,
      styleAdherence: null,
      styleBlockedReasons: [],
      attemptCount: 0,
    },
  };
}

function getOrchestrationPlanningMetadata(
  planning: OrchestrationPlanningTrace | null,
) {
  if (!planning) {
    return {
      orchestration_planning_status: "fallback",
      orchestration_planning_raw_goal: null,
      orchestration_planning_raw_workflow: null,
      orchestration_planning_goal: null,
      orchestration_planning_workflow: null,
      orchestration_planning_route: null,
      orchestration_planning_selected_tools: [],
      orchestration_planning_confidence: null,
      orchestration_planning_provider: null,
      orchestration_planning_model: null,
      orchestration_planning_latency_ms: null,
      orchestration_planning_rejected_step_count: null,
      orchestration_planning_risk_flags: [],
      orchestration_planning_reconciled: false,
      conversational_executive_mode: "off",
      conversational_executive_status: "not_run",
      conversational_executive_provider: null,
      conversational_executive_model: null,
      conversational_executive_latency_ms: null,
      conversational_executive_confidence: null,
      conversational_executive_raw_goal: null,
      conversational_executive_raw_workflow: null,
      conversational_executive_query_kind: null,
      conversational_executive_selected_tools: [],
      conversational_executive_tool_calls: [],
      conversational_executive_financial_proposal_count: 0,
      conversational_executive_is_correction: false,
      conversational_executive_answer_kind: null,
      conversational_executive_used_tools: [],
      conversational_executive_reference_resolution: "none",
      conversational_executive_focus_id: null,
      conversational_executive_shadow_divergences: [],
      conversational_executive_shadow_match: null,
      conversational_executive_single_authority_active: false,
    };
  }

  const executive = planning.executive;

  return {
    orchestration_planning_status: "completed",
    orchestration_planning_raw_goal: planning.result.output.goal,
    orchestration_planning_raw_workflow: planning.result.output.workflow,
    orchestration_planning_goal: planning.compiled.goal,
    orchestration_planning_workflow: planning.compiled.workflow,
    orchestration_planning_route: planning.compiled.route,
    orchestration_planning_selected_tools: planning.compiled.selectedTools,
    orchestration_planning_confidence: planning.compiled.confidence,
    orchestration_planning_provider: planning.result.runtime.provider,
    orchestration_planning_model: planning.result.runtime.model_name ?? null,
    orchestration_planning_latency_ms: planning.result.runtime.latency_ms,
    orchestration_planning_rejected_step_count:
      planning.compiled.rejectedStepCount,
    orchestration_planning_risk_flags: planning.compiled.riskFlags,
    orchestration_planning_reconciled:
      planning.result.output.goal !== planning.compiled.goal ||
      planning.result.output.workflow !== planning.compiled.workflow,
    conversational_executive_mode: executive?.mode ?? "off",
    conversational_executive_status: executive ? "completed" : "not_run",
    conversational_executive_provider:
      executive?.result.runtime.provider ?? null,
    conversational_executive_model:
      executive?.result.runtime.model_name ?? null,
    conversational_executive_latency_ms:
      executive?.result.runtime.latency_ms ?? null,
    conversational_executive_confidence:
      executive?.result.output.confidence ?? null,
    conversational_executive_raw_goal:
      executive?.result.output.orchestration_plan.goal ?? null,
    conversational_executive_raw_workflow:
      executive?.result.output.orchestration_plan.workflow ?? null,
    conversational_executive_query_kind:
      executive?.result.output.orchestration_plan.semantic_query?.kind ?? null,
    conversational_executive_selected_tools:
      executive?.result.output.orchestration_plan.selected_tools ?? [],
    conversational_executive_tool_calls:
      executive?.result.tool_calls.map((call) => call.tool_name) ?? [],
    conversational_executive_financial_proposal_count:
      executive?.result.output.financial_proposals.result.length ?? 0,
    conversational_executive_is_correction:
      executive?.result.output.correction_proposal.is_correction ?? false,
    conversational_executive_answer_kind:
      executive?.result.output.response_composition.answer_kind ?? null,
    conversational_executive_used_tools:
      executive?.result.output.response_composition.used_tools ?? [],
    conversational_executive_reference_resolution:
      executive?.result.output.reference_resolution.resolution ?? "none",
    conversational_executive_focus_id:
      executive?.result.output.reference_resolution.focus_id ?? null,
    conversational_executive_shadow_divergences:
      executive?.divergences ?? [],
    conversational_executive_shadow_match:
      executive?.mode === "shadow"
        ? executive.divergences.length === 0
        : null,
    conversational_executive_single_authority_active:
      executive?.mode === "active",
  };
}

function normalizeConversationText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\w\s/.,?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatConversationStyleInstruction(
  style: ConversationStyleProfile | null,
): string | null {
  if (!style) return null;

  const dimensions = [
    style.response_length !== "inherit"
      ? `longitud=${style.response_length}`
      : null,
    style.formality !== "inherit" ? `formalidad=${style.formality}` : null,
    style.warmth !== "inherit" ? `calidez=${style.warmth}` : null,
    style.playfulness !== "inherit"
      ? `jocosidad=${style.playfulness}`
      : null,
    style.directness !== "inherit" ? `directitud=${style.directness}` : null,
    style.emoji_policy !== "inherit" ? `emojis=${style.emoji_policy}` : null,
  ].filter((value): value is string => Boolean(value));

  return dimensions.length > 0
    ? `${style.instruction} (${dimensions.join(", ")})`
    : style.instruction;
}

export function shouldRouteZeroActionTurnToConversation(input: {
  proposedActionCount: number;
  dataAgentIntent: DataAgentExtractResult["output"]["intent"];
  orchestrationRoute: CompiledOrchestrationPlan["route"] | null;
  turnState: ConversationTurnState;
}): boolean {
  if (input.proposedActionCount > 0) return false;

  // A compiled semantic plan is authoritative for free-form turns. The
  // DataAgent intent and local turn analyzer are degraded fallbacks only.
  if (input.orchestrationRoute !== null) {
    return input.orchestrationRoute === "conversation_agent";
  }

  return (
    input.dataAgentIntent === "conversation" ||
    input.dataAgentIntent === "unknown" ||
    input.turnState.should_route_to_conversation_agent
  );
}

function getDataAgentOrchestratorReason(params: {
  financialActionExecution: DataActionExecutionResult;
  pendingCreation: DataActionPendingCreationResult;
  plan: PlanTurnBlocksResult;
}): TurnOrchestrationResult["reason"] {
  if (params.financialActionExecution.kind === "executed") {
    return "accepted_with_core_execution";
  }

  if (params.pendingCreation.kind === "created") {
    return "accepted_with_pending_confirmation";
  }

  if (isConversationResponsePlan(params.plan)) {
    return "accepted_with_conversation_response";
  }

  return "accepted_with_data_agent_proposal";
}

function isConversationResponsePlan(plan: PlanTurnBlocksResult): boolean {
  return (
    plan.reason === "conversation_greeting" ||
    plan.reason === "conversation_help" ||
    plan.reason === "conversation_thanks" ||
    plan.reason === "conversation_answer"
  );
}

function buildCaptureDraftResolutionBridge(
  action: CompiledOrchestrationPlan["financialResolution"]["action"],
): PendingResolutionResult {
  if (action !== "confirm" && action !== "discard") {
    return notPendingResolution();
  }

  return {
    kind: "needs_clarification",
    reason: "no_active_pending",
    action,
    pending_code: null,
    pending_count: 0,
    pending_item: null,
    movement: null,
    idempotent: false,
  };
}

export function shouldRoutePendingMissToCorrection(params: {
  pendingResolution: PendingResolutionResult;
  captureDraftResolution: CaptureDraftResolutionResult;
  text: string;
  allowDeterministicFallback: boolean;
}): boolean {
  const normalizedText = normalizeConversationText(params.text);

  return (
    params.allowDeterministicFallback &&
    params.pendingResolution.kind === "needs_clarification" &&
    params.pendingResolution.reason === "no_active_pending" &&
    params.pendingResolution.action === "discard" &&
    params.captureDraftResolution.kind === "needs_clarification" &&
    params.captureDraftResolution.reason === "no_active_capture_draft" &&
    !/\bpendiente(s)?\b/.test(normalizedText) &&
    isCorrectionLikeText(params.text)
  );
}
