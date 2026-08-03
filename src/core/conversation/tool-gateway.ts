import type { SupabaseClient } from "@supabase/supabase-js";
import type { Channel } from "@/core/channel/types";
import type {
  ConversationContextPack,
  ConversationMemoryCorrection,
  ConversationMemoryPerson,
  ConversationQuery,
  ConversationToolName,
  ConversationTurnState,
  ConversationToolResult,
} from "@/agents/conversation-agent";
import { compileSemanticQuery, executeSemanticQuery } from "@/core/semantics/compiler";
import type { SemanticQuery } from "@/core/semantics/query";
import {
  getActiveAccounts,
  getActiveBoxes,
} from "@/data/repositories/accounts.repository";
import { getClassificationCatalog as loadClassificationCatalog } from "@/data/repositories/classification.repository";
import {
  getActiveConversationMemoryState,
  type ConversationMemoryState,
} from "@/data/repositories/conversation-memory.repository";
import {
  getDebtDetailById,
  listDebtInstallmentCommitments,
  listDebts,
  type DebtDetailWithPayments,
  type DebtInstallmentCommitmentSummary,
  type DebtWithPerson,
} from "@/data/repositories/debts.repository";
import { listPendingItems } from "@/data/repositories/pending.repository";
import { searchConfirmedFinancialMemory } from "@/data/repositories/financial-memory.repository";
import {
  getInsightEvidence as loadInsightEvidence,
  listInsights,
} from "@/data/repositories/insights.repository";
import { readPersistentConversationStyle } from "./conversation-style-preferences";
import {
  calculateMoneyLayers,
  COMMITMENT_HORIZON_DAYS,
} from "@/core/finance/money-layers";
import {
  listRecurringDashboard,
  listUpcomingCommitments,
} from "@/data/repositories/recurring.repository";
import type {
  RecurringRuleWithOccurrences,
  UpcomingCommitmentSummary,
} from "@/data/repositories/recurring.repository";
import type { Database } from "@/data/supabase/types";
import type { Account, Box, Movement } from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

const SPENDING_MOVEMENT_TYPES = new Set<Movement["type"]>([
  "gasto",
  "pago_deuda",
  "prestamo_dado",
  "pago_recurrente",
]);

type ConversationMovement = Omit<
  Pick<
    Movement,
    | "id"
    | "type"
    | "amount"
    | "currency"
    | "description"
    | "merchant"
    | "category_id"
    | "subcategory_id"
    | "related_person_id"
    | "occurred_at"
    | "created_at"
    | "status"
    | "source"
    | "source_ref"
    | "confidence"
    | "requires_review"
    | "account_origin_id"
    | "account_destination_id"
    | "box_origin_id"
    | "box_destination_id"
  >,
  "subcategory_id" | "related_person_id" | "box_origin_id" | "box_destination_id"
> & {
  subcategory_id?: string | null;
  related_person_id?: string | null;
  box_origin_id?: string | null;
  box_destination_id?: string | null;
};

type ConversationMovementWithLabels = ConversationMovement & {
  category_label: string | null;
  subcategory_label?: string | null;
  related_person_name?: string | null;
  tag_ids?: string[];
  tag_labels?: string[];
  account_origin_name: string | null;
  account_destination_name: string | null;
};

type UserPreferenceSummary = {
  tone_style: string | null;
  conversation_style: ConversationContextPack["preferences_summary"]["conversation_style"];
  discreet_mode: boolean;
  whatsapp_opt_in: boolean;
  email_opt_in: boolean;
  quiet_hours: { start: string | null; end: string | null } | null;
  default_account_id: string | null;
};

type FinancialMemoryFacet =
  | "preferences"
  | "people"
  | "corrections"
  | "active_conversation"
  | "patterns"
  | "narrative";

type FinancialMemorySource = {
  id: string;
  label: string;
  kind: FinancialMemoryFacet | "memory_limit";
  detail: string | null;
  status: string | null;
};

function defaultToolsForQuery(query: ConversationQuery): ConversationToolName[] {
  switch (query.kind) {
    case "balance_snapshot":
      return ["get_balance_snapshot"];
    case "movement_search":
      return ["query_movements"];
    case "pending_summary":
      return ["get_pending_summary"];
    case "debt_summary":
      return ["get_debt_summary", "get_debt_details"];
    case "recurring_summary":
      return ["get_recurring_summary"];
    case "financial_memory_search":
      return ["search_financial_memory"];
    default:
      return [];
  }
}

export class ToolGateway {
  constructor(private readonly client: Client) {}

  async buildConversationContextPack(input: {
    userId: string;
    locale: "es-PE";
    timezone: string;
    channel: Channel;
    originalMessage: string;
    receivedAt: string;
    query: ConversationQuery;
    turnState: ConversationTurnState;
    activeMemoryState?: ConversationMemoryState | null;
    requestedTools?: ConversationToolName[];
    providedToolResults?: ConversationToolResult[];
    styleOverride?: ConversationContextPack["preferences_summary"]["conversation_style"];
  }): Promise<ConversationContextPack> {
    const [activeMemoryState, preferences, frequentPeople, recentCorrections] =
      await Promise.all([
        input.activeMemoryState !== undefined
          ? Promise.resolve(input.activeMemoryState)
          : getActiveConversationMemoryState(this.client, {
              userId: input.userId,
              channel: input.channel,
              now: input.receivedAt,
            }),
        this.getUserPreferencesSummary(input.userId),
        this.getFrequentPeople(input.userId),
        this.getRecentCorrections(input.userId),
      ]);

    return {
      context_pack_type: "conversation_context",
      version: "v1",
      user_id: input.userId,
      locale: input.locale,
      timezone: input.timezone,
      original_message: input.originalMessage,
      received_at: input.receivedAt,
      query: input.query,
      turn_state: input.turnState,
      active_conversation_state: {
        state_id: activeMemoryState?.id ?? null,
        last_intent: activeMemoryState?.last_intent ?? null,
        last_query_kind: activeMemoryState?.last_query_kind ?? null,
        last_query_text: activeMemoryState?.last_query_text ?? null,
        last_query_date_range: activeMemoryState?.last_query_date_range ?? null,
        last_result_summary: activeMemoryState?.last_result_summary ?? null,
        referenced_movements: activeMemoryState?.referenced_movements ?? [],
        referenced_entities: activeMemoryState?.referenced_entities ?? [],
        continuity_hint: activeMemoryState?.continuity_hint ?? null,
        expires_at: activeMemoryState?.expires_at ?? null,
        working_set: activeMemoryState?.working_set ?? null,
      },
      preferences_summary: {
        ...preferences,
        conversation_style:
          input.styleOverride ??
          activeMemoryState?.working_set?.conversation_style ??
          preferences.conversation_style,
      },
      memory_summary: {
        frequent_people: frequentPeople,
        recent_corrections: recentCorrections,
      },
      permissions: {
        read_only: true,
        can_mutate_financial_data: false,
      },
      tool_results:
        input.providedToolResults ??
        (await this.executeTools(
          input.userId,
          input.query,
          activeMemoryState,
          input.turnState,
          input.requestedTools
        )),
      data_limits: [
        "Solo se usan datos confirmados para saldos y movimientos.",
        "Los pendientes se muestran separados y no afectan saldos hasta confirmacion.",
        "La memoria conversacional guarda referencias resumidas, no historial crudo.",
      ],
    };
  }

  private async executeTools(
    userId: string,
    query: ConversationQuery,
    activeMemoryState: ConversationMemoryState | null,
    turnState: ConversationTurnState,
    requestedTools?: ConversationToolName[]
  ): Promise<ConversationToolResult[]> {
    const toolNames: ConversationToolName[] =
      requestedTools && requestedTools.length > 0
        ? Array.from(new Set<ConversationToolName>(requestedTools)).slice(0, 8)
        : defaultToolsForQuery(query);
    const effectiveToolNames: ConversationToolName[] =
      query.kind === "debt_summary" &&
      !toolNames.includes("get_debt_details")
        ? ([...toolNames, "get_debt_details"].slice(0, 8) as ConversationToolName[])
        : toolNames;

    return Promise.all(
      effectiveToolNames.map((toolName) =>
        this.executeAuthorizedTool({
          toolName,
          userId,
          query,
          activeMemoryState,
          turnState,
        })
      )
    );
  }

  async executeAuthorizedTool(input: {
    toolName: ConversationToolName;
    userId: string;
    query: ConversationQuery | null;
    semanticQuery?: SemanticQuery | null;
    activeMemoryState: ConversationMemoryState | null;
    turnState: ConversationTurnState;
  }): Promise<ConversationToolResult> {
    if (input.toolName === "consultar_datos_abiertos") {
      return this.queryDatosAbiertos(input.userId, input.semanticQuery ?? null);
    }
    if (!input.query) {
      logger.error("tool_gateway.missing_query_for_closed_tool", {
        tool_name: input.toolName,
        user_id: input.userId,
      });
      return failedTool(input.toolName);
    }
    const query = input.query;
    switch (input.toolName) {
      case "get_balance_snapshot":
        return this.getBalanceSnapshot(input.userId);
      case "query_movements":
        return this.queryMovements(
          input.userId,
          query,
          input.activeMemoryState,
          input.turnState.should_use_active_memory
        );
      case "get_pending_summary":
        return this.getPendingSummary(input.userId);
      case "get_debt_summary":
        return this.getDebtSummary(input.userId, query);
      case "get_debt_details":
        return this.getDebtDetails(input.userId, query);
      case "get_recurring_summary":
        return this.getRecurringSummary(input.userId, query);
      case "search_financial_memory":
        return this.searchFinancialMemory(
          input.userId,
          query,
          input.activeMemoryState
        );
      case "get_classification_catalog":
        return this.getClassificationCatalog(input.userId);
      case "get_pending_details":
        return this.getPendingDetails(input.userId);
      case "get_financial_structure":
        return this.getFinancialStructure(input.userId);
      case "get_insights":
        return this.getInsights(input.userId, query);
      case "get_insight_evidence":
        return this.getInsightEvidence(input.userId, input.activeMemoryState);
      case "get_record_provenance":
        return this.getRecordProvenance(
          input.userId,
          query,
          input.activeMemoryState,
          input.turnState.should_use_active_memory,
        );
      case "get_user_context_summary":
        return this.getUserContextSummary(input.userId, input.activeMemoryState);
      case "get_spending_summary":
        return this.getSpendingSummary(
          input.userId,
          query,
          input.activeMemoryState,
          input.turnState.should_use_active_memory,
        );
    }
  }

  /** `20b` S5.3/S5.4: consulta abierta compilada contra `src/core/semantics`. */
  private async queryDatosAbiertos(
    userId: string,
    semanticQuery: SemanticQuery | null,
  ): Promise<ConversationToolResult> {
    if (!semanticQuery) {
      return {
        tool_name: "consultar_datos_abiertos",
        status: "failed",
        facts: [],
        warnings: ["consultar_datos_abiertos se llamo sin semantic_query."],
        data: {},
      };
    }
    const compiled = compileSemanticQuery(semanticQuery, userId);
    if (!compiled.ok) {
      return {
        tool_name: "consultar_datos_abiertos",
        status: "failed",
        facts: [],
        warnings: compiled.issues.map((issue) => `${issue.code}: ${issue.message}`),
        data: { issues: compiled.issues },
      };
    }
    try {
      const executed = await executeSemanticQuery(this.client, compiled.plan);
      if (!executed.ok) {
        logger.error("tool_gateway.semantic_query_failed", {
          error: executed.error,
          user_id: userId,
          entidad: compiled.plan.entidad,
        });
        return failedTool("consultar_datos_abiertos");
      }
      return {
        tool_name: "consultar_datos_abiertos",
        status: "called",
        facts: [
          `entidad=${compiled.plan.entidad}`,
          `filas=${executed.filas.length}`,
        ],
        warnings: [],
        data: { filas: executed.filas, referencias: executed.referencias },
      };
    } catch (error) {
      logger.error("tool_gateway.semantic_query_threw", { error, user_id: userId });
      return failedTool("consultar_datos_abiertos");
    }
  }

  private async getBalanceSnapshot(
    userId: string
  ): Promise<ConversationToolResult> {
    try {
      const [accounts, boxes, recurringCommitments, debtCommitments] =
        await Promise.all([
          getActiveAccounts(this.client, userId),
          getActiveBoxes(this.client, userId),
          listUpcomingCommitments(this.client, userId, COMMITMENT_HORIZON_DAYS),
          listDebtInstallmentCommitments(this.client, userId, COMMITMENT_HORIZON_DAYS),
        ]);
      const commitments = [...recurringCommitments, ...debtCommitments];
      const snapshot = buildBalanceSnapshot(accounts, boxes, commitments);

      return {
        tool_name: "get_balance_snapshot",
        status: "called",
        facts: [
          `total_balance=${formatMoney(snapshot.total_balance)}`,
          `free_in_accounts=${formatMoney(snapshot.free_in_accounts)}`,
          `operational_free_money=${formatMoney(snapshot.operational_free_money)}`,
          `upcoming_uncovered_commitments=${formatMoney(snapshot.upcoming_uncovered_commitments)}`,
        ],
        warnings: snapshot.warnings,
        data: snapshot,
      };
    } catch (error) {
      logger.error("tool_gateway.balance_snapshot_failed", { error, user_id: userId });
      return failedTool("get_balance_snapshot");
    }
  }

  private async queryMovements(
    userId: string,
    query: ConversationQuery,
    activeMemoryState: ConversationMemoryState | null,
    shouldUseActiveMemory: boolean
  ): Promise<ConversationToolResult> {
    try {
      const useActiveReferences = shouldUseActiveReferencedMovements(
        query,
        activeMemoryState,
        shouldUseActiveMemory
      );
      const referencedIds =
        useActiveReferences
          ? getActiveMovementReferenceIds(activeMemoryState)
          : [];
      let builder = this.client
        .from("movements")
        .select(
          [
            "id",
            "type",
            "amount",
            "currency",
            "description",
            "merchant",
            "category_id",
            "subcategory_id",
            "related_person_id",
            "occurred_at",
            "created_at",
            "status",
            "source",
            "source_ref",
            "confidence",
            "requires_review",
            "account_origin_id",
            "account_destination_id",
            "box_origin_id",
            "box_destination_id",
          ].join(",")
        )
        .eq("user_id", userId)
        .in("status", ["confirmed", "corrected"])
        .is("deleted_at", null)
        .order("occurred_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(referencedIds.length > 0 ? Math.min(referencedIds.length, 80) : 80);

      if (referencedIds.length > 0) {
        builder = builder.in("id", referencedIds);
      } else if (query.date_range) {
        builder = builder
          .gte("occurred_at", query.date_range.start)
          .lte("occurred_at", query.date_range.end);
      }

      const { data, error } = await builder;
      if (error) throw error;

      const loadedMovements = (data ?? []) as unknown as ConversationMovement[];
      const orderedLoadedMovements =
        referencedIds.length > 0
          ? orderMovementsByReference(loadedMovements, referencedIds)
          : loadedMovements;
      const scopedMovements =
        referencedIds.length > 0
          ? filterReferencedMovements(
              orderedLoadedMovements,
              query.normalized_text
            )
          : orderedLoadedMovements;
      const enrichedScopedMovements = await this.enrichMovements(
        userId,
        scopedMovements
      );
      const enrichedMovements =
        referencedIds.length > 0
          ? enrichedScopedMovements
          : filterMovementsForConversationQuery(
              enrichedScopedMovements,
              query,
            );
      const total = enrichedMovements.reduce(
        (sum, movement) =>
          movement.type === "ingreso"
            ? sum + Number(movement.amount)
            : sum - Number(movement.amount),
        0
      );

      return {
        tool_name: "query_movements",
        status: "called",
        facts: [
          `movement_count=${enrichedMovements.length}`,
          `date_label=${query.date_range?.label ?? (referencedIds.length > 0 ? "referencia conversacional activa" : "sin rango explicito")}`,
          `net_amount=${formatMoney(roundMoney(total))}`,
        ],
        warnings:
          query.date_range === null && referencedIds.length === 0
            ? [
                "La consulta no tenia fecha explicita ni referencia activa; se muestran movimientos recientes.",
              ]
            : [],
        data: {
          movements: enrichedMovements,
          date_label:
            query.date_range?.label ??
            (referencedIds.length > 0
              ? activeMemoryState?.last_query_date_range?.label ??
                "la respuesta anterior"
              : "movimientos recientes"),
          reference_source:
            referencedIds.length > 0 ? "focus_set" : null,
          net_amount: roundMoney(total),
        },
      };
    } catch (error) {
      logger.error("tool_gateway.query_movements_failed", { error, user_id: userId });
      return failedTool("query_movements");
    }
  }

  private async enrichMovements(
    userId: string,
    movements: ConversationMovement[]
  ): Promise<ConversationMovementWithLabels[]> {
    if (movements.length === 0) return [];

    try {
      const [accounts, catalog, movementTags] = await Promise.all([
        getActiveAccounts(this.client, userId),
        loadClassificationCatalog(this.client, userId),
        this.client
          .from("movement_tags")
          .select("movement_id,tag_id")
          .in("movement_id", movements.map((movement) => movement.id)),
      ]);
      if (movementTags.error) throw movementTags.error;
      const accountsById = new Map(accounts.map((account) => [account.id, account]));
      const categoriesById = new Map(catalog.categories.map((category) => [category.id, category]));
      const subcategoriesById = new Map(catalog.subcategories.map((item) => [item.id, item]));
      const peopleById = new Map(catalog.related_people.map((item) => [item.id, item]));
      const tagsById = new Map(catalog.tags.map((item) => [item.id, item]));
      const tagsByMovement = new Map<string, string[]>();
      for (const row of movementTags.data ?? []) {
        const current = tagsByMovement.get(row.movement_id) ?? [];
        current.push(row.tag_id);
        tagsByMovement.set(row.movement_id, current);
      }

      return movements.map((movement) => {
        const tagIds = [...new Set(tagsByMovement.get(movement.id) ?? [])];
        return {
          ...movement,
          category_label: movement.category_id
            ? categoriesById.get(movement.category_id)?.label ?? null
            : null,
          subcategory_label: movement.subcategory_id
            ? subcategoriesById.get(movement.subcategory_id)?.label ?? null
            : null,
          related_person_name: movement.related_person_id
            ? peopleById.get(movement.related_person_id)?.display_name ?? null
            : null,
          tag_ids: tagIds,
          tag_labels: tagIds
            .map((tagId) => tagsById.get(tagId)?.label)
            .filter((label): label is string => Boolean(label)),
          account_origin_name: movement.account_origin_id
            ? accountsById.get(movement.account_origin_id)?.name ?? null
            : null,
          account_destination_name: movement.account_destination_id
            ? accountsById.get(movement.account_destination_id)?.name ?? null
            : null,
        };
      });
    } catch (error) {
      logger.warn("tool_gateway.movement_labels_failed", { error, user_id: userId });
      return movements.map((movement) => ({
        ...movement,
        category_label: null,
        subcategory_label: null,
        related_person_name: null,
        tag_ids: [],
        tag_labels: [],
        account_origin_name: null,
        account_destination_name: null,
      }));
    }
  }

  private async getPendingSummary(
    userId: string
  ): Promise<ConversationToolResult> {
    try {
      const pendingItems = await listPendingItems(this.client, userId, {
        limit: 10,
      });

      return {
        tool_name: "get_pending_summary",
        status: "called",
        facts: [`active_pending_count=${pendingItems.length}`],
        warnings: [],
        data: {
          active_count: pendingItems.length,
          items: pendingItems.slice(0, 5).map((item) => ({
            id: item.id,
            status: item.status,
            risk_level: item.risk_level,
            title: item.normalized_summary.title ?? null,
            amount: item.normalized_summary.amount ?? null,
            currency: item.normalized_summary.currency ?? null,
            created_at: item.created_at,
          })),
        },
      };
    } catch (error) {
      logger.error("tool_gateway.pending_summary_failed", { error, user_id: userId });
      return failedTool("get_pending_summary");
    }
  }

  private async getClassificationCatalog(
    userId: string,
  ): Promise<ConversationToolResult> {
    try {
      const catalog = await loadClassificationCatalog(this.client, userId);
      return {
        tool_name: "get_classification_catalog",
        status: "called",
        facts: [
          `category_count=${catalog.categories.length}`,
          `subcategory_count=${catalog.subcategories.length}`,
          `tag_count=${catalog.tags.length}`,
          `related_people_count=${catalog.related_people.length}`,
        ],
        warnings: [],
        data: {
          version: catalog.version,
          categories: catalog.categories.map((item) => ({
            id: item.id,
            label: item.label,
            is_sensitive: item.is_sensitive,
          })),
          subcategories: catalog.subcategories.map((item) => ({
            id: item.id,
            category_id: item.category_id,
            label: item.label,
            normalized_label: item.normalized_label,
          })),
          tags: catalog.tags.map((item) => ({
            id: item.id,
            key: item.key,
            label: item.label,
            type: item.type,
            is_system: item.is_system,
          })),
          related_people: catalog.related_people.map((item) => ({
            id: item.id,
            display_name: item.display_name,
            kind: item.kind,
            relationship_label: item.relationship_label,
            aliases: readMetadataStringArray(item.metadata, [
              "aliases",
              "alias",
              "nicknames",
              "apodos",
            ]),
          })),
        },
      };
    } catch (error) {
      logger.error("tool_gateway.classification_catalog_failed", {
        error,
        user_id: userId,
      });
      return failedTool("get_classification_catalog");
    }
  }

  private async getPendingDetails(
    userId: string,
  ): Promise<ConversationToolResult> {
    try {
      const pendingItems = await listPendingItems(this.client, userId, {
        limit: 25,
      });
      return {
        tool_name: "get_pending_details",
        status: "called",
        facts: [`active_pending_count=${pendingItems.length}`],
        warnings: [],
        data: {
          active_count: pendingItems.length,
          items: pendingItems.map((item) => ({
            id: item.id,
            type: item.type,
            status: item.status,
            source: item.source,
            risk_level: item.risk_level,
            title: item.normalized_summary.title ?? null,
            subtitle: item.normalized_summary.subtitle ?? null,
            amount: item.normalized_summary.amount ?? null,
            currency: item.normalized_summary.currency ?? null,
            occurred_at: item.normalized_summary.occurred_at ?? null,
            category_id: item.normalized_summary.category_id ?? null,
            account_hint: item.normalized_summary.account_hint ?? null,
            confidence_label: item.normalized_summary.confidence_label ?? null,
            created_at: item.created_at,
            expires_at: item.expires_at,
          })),
        },
      };
    } catch (error) {
      logger.error("tool_gateway.pending_details_failed", { error, user_id: userId });
      return failedTool("get_pending_details");
    }
  }

  private async getFinancialStructure(
    userId: string,
  ): Promise<ConversationToolResult> {
    try {
      const [accounts, boxes] = await Promise.all([
        getActiveAccounts(this.client, userId),
        getActiveBoxes(this.client, userId),
      ]);
      const boxesByAccount = new Map<string, Box[]>();
      for (const box of boxes) {
        const current = boxesByAccount.get(box.account_id) ?? [];
        current.push(box);
        boxesByAccount.set(box.account_id, current);
      }
      return {
        tool_name: "get_financial_structure",
        status: "called",
        facts: [
          `account_count=${accounts.length}`,
          `box_count=${boxes.length}`,
        ],
        warnings: [],
        data: {
          accounts: accounts.map((account) => ({
            id: account.id,
            name: account.name,
            type: account.type,
            currency: account.currency,
            current_balance: Number(account.current_balance),
            is_default: account.is_default,
            boxes: (boxesByAccount.get(account.id) ?? []).map((box) => ({
              id: box.id,
              name: box.name,
              type: box.type,
              current_balance: Number(box.current_balance),
              target_amount: box.target_amount,
              target_date: box.target_date,
            })),
          })),
        },
      };
    } catch (error) {
      logger.error("tool_gateway.financial_structure_failed", {
        error,
        user_id: userId,
      });
      return failedTool("get_financial_structure");
    }
  }

  private async getInsights(
    userId: string,
    query: ConversationQuery,
  ): Promise<ConversationToolResult> {
    try {
      const insights = await listInsights(this.client, userId, { limit: 12 });
      const tokens = extractSearchTokens(query.normalized_text, COMMON_SEARCH_STOP_WORDS);
      const filtered = tokens.length === 0
        ? insights
        : insights.filter((insight) =>
            tokens.some((token) =>
              normalizeForSearch(
                [insight.title, insight.body, insight.type, insight.evidence_text].join(" "),
              ).includes(token),
            ),
          );
      return {
        tool_name: "get_insights",
        status: "called",
        facts: [`insight_count=${filtered.length}`],
        warnings: [],
        data: {
          insights: filtered.slice(0, 10).map((insight) => ({
            id: insight.id,
            type: insight.type,
            status: insight.status,
            title: insight.title,
            body: insight.body,
            evidence_text: insight.evidence_text,
            period_start: insight.period_start,
            period_end: insight.period_end,
            confidence: insight.confidence,
            quality_score: insight.quality_score,
            rank_score: insight.rank_score,
            risk_level: insight.risk_level,
            action: insight.action,
            expires_at: insight.expires_at,
          })),
        },
      };
    } catch (error) {
      logger.error("tool_gateway.insights_failed", { error, user_id: userId });
      return failedTool("get_insights");
    }
  }

  private async getInsightEvidence(
    userId: string,
    activeMemoryState: ConversationMemoryState | null,
  ): Promise<ConversationToolResult> {
    try {
      const insightId = readReferencedEntityId(activeMemoryState, "insight");
      if (!insightId) {
        return {
          tool_name: "get_insight_evidence",
          status: "called",
          facts: ["insight_reference_missing=true"],
          warnings: ["No hay un descubrimiento especifico referenciado para abrir evidencia."],
          data: { evidence: null },
        };
      }
      const evidence = await loadInsightEvidence(this.client, userId, insightId);
      return {
        tool_name: "get_insight_evidence",
        status: "called",
        facts: [`insight_found=${Boolean(evidence)}`],
        warnings: evidence ? [] : ["No se encontro el descubrimiento referenciado."],
        data: { insight_id: insightId, evidence },
      };
    } catch (error) {
      logger.error("tool_gateway.insight_evidence_failed", { error, user_id: userId });
      return failedTool("get_insight_evidence");
    }
  }

  private async getRecordProvenance(
    userId: string,
    query: ConversationQuery,
    activeMemoryState: ConversationMemoryState | null,
    shouldUseActiveMemory: boolean,
  ): Promise<ConversationToolResult> {
    try {
      const references = shouldUseActiveMemory
        ? (activeMemoryState?.referenced_movements ?? []).map((movement) => movement.id)
        : [];
      const movementResult = references.length > 0
        ? null
        : await this.queryMovements(userId, query, activeMemoryState, false);
      const movementData = movementResult?.data as
        | { movements?: Array<{ id: string }> }
        | undefined;
      const movementIds = references.length > 0
        ? references
        : movementResult?.status === "called" && Array.isArray(movementData?.movements)
          ? movementData.movements.map((movement) => movement.id)
          : [];
      if (movementIds.length === 0) {
        return {
          tool_name: "get_record_provenance",
          status: "called",
          facts: ["movement_count=0"],
          warnings: ["No hay movimientos confirmados para mostrar origen."],
          data: { movements: [] },
        };
      }
      const { data, error } = await this.client
        .from("movement_audit_log")
        .select("movement_id,action,field_name,source,actor_type,created_at")
        .eq("user_id", userId)
        .in("movement_id", movementIds.slice(0, 10))
        .order("created_at", { ascending: false });
      if (error) throw error;
      return {
        tool_name: "get_record_provenance",
        status: "called",
        facts: [`movement_count=${movementIds.length}`],
        warnings: [],
        data: {
          movements: movementIds.slice(0, 10).map((movementId) => ({
            movement_id: movementId,
            audit: (data ?? []).filter((item) => item.movement_id === movementId),
          })),
        },
      };
    } catch (error) {
      logger.error("tool_gateway.record_provenance_failed", {
        error,
        user_id: userId,
      });
      return failedTool("get_record_provenance");
    }
  }

  private async getUserContextSummary(
    userId: string,
    activeMemoryState: ConversationMemoryState | null,
  ): Promise<ConversationToolResult> {
    try {
      const [preferences, frequentPeople, recentCorrections, learnedMemory] =
        await Promise.all([
          this.getUserPreferencesSummary(userId),
          this.getFrequentPeople(userId),
          this.getRecentCorrections(userId),
          searchConfirmedFinancialMemory(this.client, {
            userId,
            queryText: "",
            limit: 20,
          }),
        ]);
      return {
        tool_name: "get_user_context_summary",
        status: "called",
        facts: [
          `people_count=${frequentPeople.length}`,
          `correction_count=${recentCorrections.length}`,
          `memory_count=${learnedMemory.length}`,
        ],
        warnings: [],
        data: {
          preferences,
          frequent_people: frequentPeople,
          recent_corrections: recentCorrections,
          learned_memory: learnedMemory.map((item) => ({
            id: item.id,
            kind: item.kind,
            summary: item.summary,
            search_terms: item.search_terms,
            confidence: item.confidence,
            evidence_source: item.evidence_source,
            updated_at: item.updated_at,
          })),
          active_conversation: activeMemoryState
            ? {
                last_intent: activeMemoryState.last_intent,
                last_query_kind: activeMemoryState.last_query_kind,
                last_query_text: activeMemoryState.last_query_text,
                last_result_summary: activeMemoryState.last_result_summary,
                continuity_hint: activeMemoryState.continuity_hint,
                working_set: activeMemoryState.working_set,
              }
            : null,
        },
      };
    } catch (error) {
      logger.error("tool_gateway.user_context_summary_failed", {
        error,
        user_id: userId,
      });
      return failedTool("get_user_context_summary");
    }
  }

  private async getSpendingSummary(
    userId: string,
    query: ConversationQuery,
    activeMemoryState: ConversationMemoryState | null,
    shouldUseActiveMemory: boolean,
  ): Promise<ConversationToolResult> {
    const movementsResult = await this.queryMovements(
      userId,
      query,
      activeMemoryState,
      shouldUseActiveMemory,
    );
    if (movementsResult.status !== "called") {
      return { ...movementsResult, tool_name: "get_spending_summary" };
    }
    const movements = Array.isArray(movementsResult.data.movements)
      ? movementsResult.data.movements
      : [];
    const groups = new Map<string, { label: string; count: number; total: number }>();
    for (const movement of movements) {
      if (!SPENDING_MOVEMENT_TYPES.has(movement.type)) continue;
      const label = movement.subcategory_label ?? movement.category_label ?? "Sin categoria";
      const group = groups.get(label) ?? { label, count: 0, total: 0 };
      group.count += 1;
      group.total += Number(movement.amount);
      groups.set(label, group);
    }
    const summaries = [...groups.values()]
      .map((group) => ({ ...group, total: roundMoney(group.total) }))
      .sort((left, right) => right.total - left.total);
    return {
      tool_name: "get_spending_summary",
      status: "called",
      facts: [
        `movement_count=${movements.length}`,
        `group_count=${summaries.length}`,
      ],
      warnings: [],
      data: {
        date_label: movementsResult.data.date_label ?? null,
        groups: summaries,
        movement_count: movements.length,
        total_expense: roundMoney(
          movements
            .filter((movement) => SPENDING_MOVEMENT_TYPES.has(movement.type))
            .reduce((sum, movement) => sum + Number(movement.amount), 0),
        ),
      },
    };
  }

  private async getDebtSummary(
    userId: string,
    query: ConversationQuery
  ): Promise<ConversationToolResult> {
    try {
      const horizonDays = horizonDaysFromQuery(query);
      const [debts, installments] = await Promise.all([
        listDebts(this.client, userId),
        listDebtInstallmentCommitments(this.client, userId, horizonDays),
      ]);
      const filteredDebts = filterDebtsByNaturalQuery(
        debts,
        query.normalized_text
      );
      const debtIds = new Set(filteredDebts.map((debt) => debt.id));
      const filteredInstallments = filterDebtInstallmentsByNaturalQuery(
        installments,
        query.normalized_text,
        debtIds
      );
      const totals = summarizeDebtTotals(filteredDebts);

      return {
        tool_name: "get_debt_summary",
        status: "called",
        facts: [
          `debt_count=${filteredDebts.length}`,
          `i_owe_total=${formatMoney(totals.i_owe_total)}`,
          `they_owe_me_total=${formatMoney(totals.they_owe_me_total)}`,
          `upcoming_installment_count=${filteredInstallments.length}`,
        ],
        warnings: [],
        data: {
          date_label: query.date_range?.label ?? `proximos ${horizonDays} dias`,
          debts: filteredDebts.map(formatDebtForTool),
          installments: filteredInstallments.map(formatDebtInstallmentForTool),
          totals,
          matched_filter:
            filteredDebts.length !== debts.length
              ? "texto/persona mencionada"
              : null,
        },
      };
    } catch (error) {
      logger.error("tool_gateway.debt_summary_failed", {
        error,
        user_id: userId,
      });
      return failedTool("get_debt_summary");
    }
  }

  private async getDebtDetails(
    userId: string,
    query: ConversationQuery
  ): Promise<ConversationToolResult> {
    try {
      const debts = await listDebts(this.client, userId);
      const matchedDebts = filterDebtsByNaturalQuery(
        debts,
        query.normalized_text
      ).slice(0, 5);

      const details = (
        await Promise.all(
          matchedDebts.map((debt) =>
            getDebtDetailById(this.client, userId, debt.id)
          )
        )
      ).filter(
        (detail): detail is DebtDetailWithPayments => detail !== null
      );

      const warnings = details.flatMap((detail) =>
        buildDebtDetailWarnings(detail)
      );

      return {
        tool_name: "get_debt_details",
        status: "called",
        facts: [
          `debt_count=${details.length}`,
          `installment_count=${details.reduce(
            (sum, detail) => sum + detail.installments.length,
            0
          )}`,
          `payment_count=${details.reduce(
            (sum, detail) => sum + detail.payments.length,
            0
          )}`,
        ],
        warnings,
        data: {
          date_label: query.date_range?.label ?? null,
          debts: matchedDebts.map(formatDebtForTool),
          details: details.map(formatDebtDetailForTool),
          matched_filter:
            matchedDebts.length !== debts.length
              ? "texto/persona mencionada"
              : null,
        },
      };
    } catch (error) {
      logger.error("tool_gateway.debt_details_failed", {
        error,
        user_id: userId,
      });
      return failedTool("get_debt_details");
    }
  }

  private async getRecurringSummary(
    userId: string,
    query: ConversationQuery
  ): Promise<ConversationToolResult> {
    try {
      const horizonDays = horizonDaysFromQuery(query);
      const [recurringDashboard, recurringCommitments, debtCommitments] =
        await Promise.all([
          listRecurringDashboard(this.client, userId, [
            "active",
            "suggested",
            "paused",
          ]),
          listUpcomingCommitments(this.client, userId, horizonDays),
          listDebtInstallmentCommitments(this.client, userId, horizonDays),
        ]);
      const filteredRecurringCommitments = filterCommitmentsByNaturalQuery(
        recurringCommitments,
        query.normalized_text
      );
      const filteredDebtCommitments = filterDebtInstallmentsByNaturalQuery(
        debtCommitments,
        query.normalized_text,
        new Set()
      );
      const activeRules = recurringDashboard.rules.filter(
        (rule) => rule.status === "active"
      );
      const total = roundMoney(
        [...filteredRecurringCommitments, ...filteredDebtCommitments].reduce(
          (sum, commitment) => sum + commitment.amount,
          0
        )
      );

      return {
        tool_name: "get_recurring_summary",
        status: "called",
        facts: [
          `recurring_rule_count=${activeRules.length}`,
          `upcoming_recurring_count=${filteredRecurringCommitments.length}`,
          `upcoming_debt_installment_count=${filteredDebtCommitments.length}`,
          `upcoming_total=${formatMoney(total)}`,
        ],
        warnings: [],
        data: {
          date_label: query.date_range?.label ?? `proximos ${horizonDays} dias`,
          commitments: [
            ...filteredRecurringCommitments.map(formatCommitmentForTool),
            ...filteredDebtCommitments.map(formatDebtInstallmentForTool),
          ],
          recurring_commitments: filteredRecurringCommitments.map(
            formatCommitmentForTool
          ),
          debt_commitments: filteredDebtCommitments.map(
            formatDebtInstallmentForTool
          ),
          rules: activeRules.slice(0, 10).map(formatRecurringRuleForTool),
          suggested_count: recurringDashboard.candidates.length,
          total_amount: total,
        },
      };
    } catch (error) {
      logger.error("tool_gateway.recurring_summary_failed", {
        error,
        user_id: userId,
      });
      return failedTool("get_recurring_summary");
    }
  }

  private async searchFinancialMemory(
    userId: string,
    query: ConversationQuery,
    activeMemoryState: ConversationMemoryState | null
  ): Promise<ConversationToolResult> {
    try {
      const [preferences, frequentPeople, recentCorrections, learnedMemory] = await Promise.all([
        this.getUserPreferencesSummary(userId),
        this.getFrequentPeople(userId),
        this.getRecentCorrections(userId),
        searchConfirmedFinancialMemory(this.client, {
          userId,
          queryText: query.normalized_text,
          limit: 12,
        }),
      ]);
      const requestedFacets = inferFinancialMemoryFacets(query.normalized_text);
      const tokens = extractMemorySearchTokens(query.normalized_text);
      const matchedPeople = filterMemoryPeople(frequentPeople, tokens);
      const matchedCorrections = filterMemoryCorrections(
        recentCorrections,
        tokens
      );
      const sources = buildFinancialMemorySources({
        requestedFacets,
        preferences,
        frequentPeople,
        matchedPeople,
        recentCorrections,
        matchedCorrections,
        activeMemoryState,
      });
      const hasPatternMemory = learnedMemory.some(
        (item) => item.kind === "correction_pattern"
      );
      const hasNarrativeMemory = learnedMemory.some(
        (item) => item.kind === "narrative_fact"
      );
      const limitedFacets = requestedFacets.filter(
        (facet) =>
          (facet === "patterns" && !hasPatternMemory) ||
          (facet === "narrative" && !hasNarrativeMemory)
      );

      return {
        tool_name: "search_financial_memory",
        status: "called",
        facts: [
          `requested_facets=${requestedFacets.join(",")}`,
          `frequent_people_count=${frequentPeople.length}`,
          `matched_people_count=${matchedPeople.length}`,
          `recent_corrections_count=${recentCorrections.length}`,
          `matched_corrections_count=${matchedCorrections.length}`,
          `learned_memory_count=${learnedMemory.length}`,
          `has_active_conversation=${Boolean(activeMemoryState)}`,
          `has_preferences=${Boolean(
            preferences.tone_style ||
              preferences.discreet_mode ||
              preferences.quiet_hours ||
              preferences.default_account_id
          )}`,
        ],
        warnings:
          limitedFacets.length > 0
            ? [
              "La memoria semantica/narrativa profunda todavia esta limitada; se responde con preferencias, personas, correcciones y contexto activo.",
              ]
            : [],
        data: {
          query_text: query.normalized_text,
          requested_facets: requestedFacets,
          memory_levels_available: [
            "preferences",
            "frequent_people",
            "recent_corrections",
            "active_conversation",
            "confirmed_learned_memory",
          ],
          memory_levels_limited: limitedFacets,
          preferences,
          frequent_people: frequentPeople,
          matched_people: matchedPeople,
          recent_corrections: recentCorrections,
          matched_corrections: matchedCorrections,
          learned_memory: learnedMemory.map((item) => ({
            id: item.id,
            kind: item.kind,
            summary: item.summary,
            confidence: item.confidence,
            evidence_source: item.evidence_source,
            evidence_ref: item.evidence_ref,
            updated_at: item.updated_at,
          })),
          active_conversation: activeMemoryState
            ? {
                last_query_kind: activeMemoryState.last_query_kind,
                last_query_text: activeMemoryState.last_query_text,
                last_result_summary: activeMemoryState.last_result_summary,
                referenced_movements_count:
                  activeMemoryState.referenced_movements.length,
                referenced_entities:
                  activeMemoryState.referenced_entities.slice(0, 10),
                continuity_hint: activeMemoryState.continuity_hint,
                working_set: activeMemoryState.working_set,
              }
            : null,
          sources: [
            ...sources,
            ...learnedMemory.map((item) => ({
              id: `memory:${item.id}`,
              label: item.summary,
              kind:
                item.kind === "narrative_fact"
                  ? ("narrative" as const)
                  : ("patterns" as const),
              detail: item.evidence_source,
              status: item.confirmation_status,
            })),
          ],
        },
      };
    } catch (error) {
      logger.error("tool_gateway.memory_search_failed", {
        error,
        user_id: userId,
      });
      return failedTool("search_financial_memory");
    }
  }

  private async getUserPreferencesSummary(
    userId: string
  ): Promise<UserPreferenceSummary> {
    try {
      const { data, error } = await this.client
        .from("user_preferences")
        .select(
          "tone_style,discreet_mode_enabled,whatsapp_opt_in,email_opt_in,quiet_hours_start,quiet_hours_end,default_account_id,metadata"
        )
        .eq("user_id", userId)
        .maybeSingle();

      if (error) throw error;

      return {
        tone_style: data?.tone_style ?? null,
        conversation_style: readPersistentConversationStyle({
          metadata: data?.metadata,
          legacyToneStyle: data?.tone_style,
        }),
        discreet_mode: data?.discreet_mode_enabled ?? false,
        whatsapp_opt_in: data?.whatsapp_opt_in ?? false,
        email_opt_in: data?.email_opt_in ?? false,
        quiet_hours:
          data?.quiet_hours_start || data?.quiet_hours_end
            ? {
                start: data.quiet_hours_start ?? null,
                end: data.quiet_hours_end ?? null,
              }
            : null,
        default_account_id: data?.default_account_id ?? null,
      };
    } catch (error) {
      logger.warn("tool_gateway.preferences_failed", { error, user_id: userId });
      return {
        tone_style: null,
        conversation_style: null,
        discreet_mode: false,
        whatsapp_opt_in: false,
        email_opt_in: false,
        quiet_hours: null,
        default_account_id: null,
      };
    }
  }

  private async getFrequentPeople(
    userId: string
  ): Promise<ConversationMemoryPerson[]> {
    try {
      const { data, error } = await this.client
        .from("related_persons")
        .select("id,display_name,kind,relationship_label,metadata,updated_at")
        .eq("user_id", userId)
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data ?? []).map((person) => ({
        id: person.id,
        display_name: person.display_name,
        kind: person.kind ?? null,
        relationship_label: person.relationship_label ?? null,
        aliases: readMetadataStringArray(person.metadata, [
          "aliases",
          "alias",
          "nicknames",
          "apodos",
        ]),
        last_seen_at: person.updated_at ?? null,
      }));
    } catch (error) {
      logger.warn("tool_gateway.people_memory_failed", { error, user_id: userId });
      return [];
    }
  }

  private async getRecentCorrections(
    userId: string
  ): Promise<ConversationMemoryCorrection[]> {
    try {
      const { data, error } = await this.client
        .from("movement_audit_log")
        .select("action,field_name,created_at,movement_id,metadata")
        .eq("user_id", userId)
        .eq("action", "corrected")
        .order("created_at", { ascending: false })
        .limit(5);

      if (error) throw error;
      return (data ?? []).map((item) =>
        ({
          action: item.action,
          field_name: item.field_name ?? null,
          created_at: item.created_at,
          movement_id: item.movement_id ?? null,
          summary: summarizeCorrectionMemory(item),
        }) satisfies ConversationMemoryCorrection
      );
    } catch (error) {
      logger.warn("tool_gateway.corrections_memory_failed", {
        error,
        user_id: userId,
      });
      return [];
    }
  }
}

function buildBalanceSnapshot(
  accounts: Account[],
  boxes: Box[],
  commitments: UpcomingCommitmentSummary[]
) {
  const boxesByAccount = new Map<string, Box[]>();
  for (const box of boxes) {
    const current = boxesByAccount.get(box.account_id) ?? [];
    current.push(box);
    boxesByAccount.set(box.account_id, current);
  }

  const accountSummaries = accounts.map((account) => {
    const accountBoxes = boxesByAccount.get(account.id) ?? [];
    const boxesTotal = roundMoney(
      accountBoxes.reduce((sum, box) => sum + Number(box.current_balance), 0)
    );
    const currentBalance = roundMoney(Number(account.current_balance));
    return {
      id: account.id,
      name: account.name,
      type: account.type,
      currency: account.currency,
      current_balance: currentBalance,
      boxes_total: boxesTotal,
      free_balance: roundMoney(currentBalance - boxesTotal),
      is_default: account.is_default,
    };
  });

  const layers = calculateMoneyLayers({
    accounts: accounts.map((account) => ({ current_balance: Number(account.current_balance) })),
    boxes: boxes.map((box) => ({ id: box.id, current_balance: Number(box.current_balance) })),
    commitments: commitments.map((commitment) => ({
      id: commitment.id,
      amount: commitment.amount,
      linked_box_id: commitment.linked_box_id,
      due_at: commitment.due_at,
    })),
  });

  return {
    total_balance: layers.total_balance,
    free_in_accounts: layers.free_in_accounts,
    operational_free_money: layers.operational_free_money,
    separated_in_boxes: layers.separated_in_boxes,
    upcoming_uncovered_commitments: layers.upcoming_uncovered_commitments,
    has_accounts: accounts.length > 0,
    account_count: accounts.length,
    box_count: boxes.length,
    commitment_count: commitments.length,
    accounts: accountSummaries,
    warnings: buildBalanceWarnings(accountSummaries, accounts.length),
  };
}

function buildBalanceWarnings(
  accounts: Array<{ current_balance: number; free_balance: number }>,
  accountCount: number
): string[] {
  const warnings: string[] = [];
  if (accountCount === 0) {
    warnings.push("No hay cuentas configuradas; no se calcula dinero libre.");
  }
  if (accounts.some((account) => account.current_balance < 0)) {
    warnings.push("Hay una cuenta con saldo negativo.");
  }
  if (accounts.some((account) => account.free_balance < 0)) {
    warnings.push("Hay una cuenta con mas dinero separado que saldo disponible.");
  }
  return warnings;
}

function failedTool(toolName: string): ConversationToolResult {
  return {
    tool_name: toolName,
    status: "failed",
    facts: [],
    warnings: ["No se pudo consultar esta herramienta."],
    data: {},
  };
}

function inferFinancialMemoryFacets(text: string): FinancialMemoryFacet[] {
  const facets = new Set<FinancialMemoryFacet>();

  if (
    /\b(preferencia|preferencias|tono|estilo|modo discreto|privacidad|horario|notificacion|notificaciones|whatsapp|correo|cuenta por defecto)\b/.test(
      text
    )
  ) {
    facets.add("preferences");
  }

  if (
    /\b(persona|personas|frecuente|frecuentes|alias|apodo|apodos|luis|ana|quien|quienes|debo|me debe|me deben|preste|prestamo)\b/.test(
      text
    )
  ) {
    facets.add("people");
  }

  if (
    /\b(correccion|correcciones|corrig|corregi|error|errores|arregl|cambie|aprendiste)\b/.test(
      text
    )
  ) {
    facets.add("corrections");
  }

  if (
    /\b(hilo|conversacion|contexto actual|venimos|anterior|lo anterior|eso|estos|estas)\b/.test(
      text
    )
  ) {
    facets.add("active_conversation");
  }

  if (
    /\b(patron|patrones|habito|habitos|suelo|acostumbro|normalmente|siempre|ultimamente|tiendo|forma de gastar|como gasto|gasto mucho|gasto poco)\b/.test(
      text
    )
  ) {
    facets.add("patterns");
  }

  if (
    /\b(que sabes de mi|que sabes de|sabes sobre mi|sabes algo de|recuerdas de mi|contexto de mi|historia|autodescubrimiento|quien soy|como soy)\b/.test(
      text
    )
  ) {
    facets.add("narrative");
    facets.add("preferences");
    facets.add("people");
  }

  if (facets.size === 0) {
    return ["preferences", "people", "corrections", "active_conversation"];
  }

  return [...facets];
}

function buildFinancialMemorySources(input: {
  requestedFacets: FinancialMemoryFacet[];
  preferences: UserPreferenceSummary;
  frequentPeople: ConversationMemoryPerson[];
  matchedPeople: ConversationMemoryPerson[];
  recentCorrections: ConversationMemoryCorrection[];
  matchedCorrections: ConversationMemoryCorrection[];
  activeMemoryState: ConversationMemoryState | null;
}): FinancialMemorySource[] {
  const sources: FinancialMemorySource[] = [];

  if (
    input.requestedFacets.includes("preferences") &&
    hasPreferenceMemory(input.preferences)
  ) {
    sources.push({
      id: "memory-preferences",
      label: "Preferencias del usuario",
      kind: "preferences",
      detail: "tono, privacidad, opt-ins y cuenta por defecto cuando existen",
      status: "available",
    });
  }

  if (input.requestedFacets.includes("people")) {
    const people =
      input.matchedPeople.length > 0 ? input.matchedPeople : input.frequentPeople;
    for (const person of people.slice(0, 4)) {
      sources.push({
        id: `memory-person-${person.id}`,
        label: person.display_name,
        kind: "people",
        detail:
          person.relationship_label ??
          (person.aliases.length > 0
            ? `alias: ${person.aliases.slice(0, 2).join(", ")}`
            : "persona relacionada"),
        status: person.kind ?? null,
      });
    }
  }

  if (input.requestedFacets.includes("corrections")) {
    const corrections =
      input.matchedCorrections.length > 0
        ? input.matchedCorrections
        : input.recentCorrections;
    for (const correction of corrections.slice(0, 3)) {
      sources.push({
        id: `memory-correction-${correction.movement_id ?? correction.created_at}`,
        label: correction.summary,
        kind: "corrections",
        detail: correction.field_name,
        status: correction.action,
      });
    }
  }

  if (
    input.requestedFacets.includes("active_conversation") &&
    input.activeMemoryState
  ) {
    sources.push({
      id: `memory-active-${input.activeMemoryState.id}`,
      label: "Contexto conversacional activo",
      kind: "active_conversation",
      detail:
        input.activeMemoryState.continuity_hint ??
        input.activeMemoryState.last_query_text,
      status: input.activeMemoryState.last_query_kind,
    });
  }

  for (const facet of input.requestedFacets) {
    if (facet === "patterns" || facet === "narrative") {
      sources.push({
        id: `memory-limit-${facet}`,
        label:
          facet === "patterns"
            ? "Memoria de patrones limitada"
            : "Memoria narrativa limitada",
        kind: "memory_limit",
        detail:
          "V1 usa memoria estructurada y movimientos confirmados; no inventa una historia profunda del usuario.",
        status: "limited",
      });
    }
  }

  if (sources.length === 0) {
    sources.push({
      id: "financial-memory",
      label: "Memoria financiera resumida",
      kind: "active_conversation",
      detail: "no hay memoria especifica suficiente para esta consulta",
      status: "limited",
    });
  }

  return sources;
}

function hasPreferenceMemory(preferences: UserPreferenceSummary): boolean {
  return Boolean(
    preferences.tone_style ||
      preferences.discreet_mode ||
      preferences.whatsapp_opt_in ||
      preferences.email_opt_in ||
      preferences.quiet_hours ||
      preferences.default_account_id
  );
}

function filterMemoryPeople(
  people: ConversationMemoryPerson[],
  tokens: string[]
): ConversationMemoryPerson[] {
  if (tokens.length === 0) return [];
  return people.filter((person) => {
    const haystack = normalizeForSearch(
      [
        person.display_name,
        person.kind,
        person.relationship_label,
        ...person.aliases,
      ]
        .filter(Boolean)
        .join(" ")
    );
    return tokens.some((token) => haystack.includes(token));
  });
}

function filterMemoryCorrections(
  corrections: ConversationMemoryCorrection[],
  tokens: string[]
): ConversationMemoryCorrection[] {
  if (tokens.length === 0) return [];
  return corrections.filter((correction) => {
    const haystack = normalizeForSearch(
      [correction.summary, correction.field_name, correction.action]
        .filter(Boolean)
        .join(" ")
    );
    return tokens.some((token) => haystack.includes(token));
  });
}

function extractMemorySearchTokens(text: string): string[] {
  return extractSearchTokens(text, MEMORY_SEARCH_STOP_WORDS);
}

function readMetadataStringArray(
  metadata: unknown,
  keys: string[]
): string[] {
  if (!isRecord(metadata)) return [];

  const values: string[] = [];
  for (const key of keys) {
    const value = metadata[key];
    if (Array.isArray(value)) {
      values.push(
        ...value.filter((item): item is string => typeof item === "string")
      );
    } else if (typeof value === "string") {
      values.push(value);
    }
  }

  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function summarizeCorrectionMemory(item: {
  field_name: string | null;
  metadata: unknown;
}): string {
  const field = item.field_name ? humanizeMemoryField(item.field_name) : null;
  const metadata = isRecord(item.metadata) ? item.metadata : null;
  const from = metadata ? readMetadataText(metadata, ["old", "old_value", "from"]) : null;
  const to = metadata ? readMetadataText(metadata, ["new", "new_value", "to"]) : null;

  if (field && from && to) {
    return `Corrigio ${field} de ${from} a ${to}`;
  }

  if (field) return `Corrigio ${field}`;
  return "Corrigio un movimiento";
}

function readMetadataText(
  metadata: Record<string, unknown>,
  keys: string[]
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return null;
}

function humanizeMemoryField(value: string): string {
  const labels: Record<string, string> = {
    category_id: "categoria",
    account_origin_id: "cuenta",
    account_destination_id: "cuenta destino",
    description: "descripcion",
    amount: "monto",
    occurred_at: "fecha",
    type: "tipo",
  };
  return labels[value] ?? value.replace(/_/g, " ");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function formatMoney(amount: number): string {
  return `S/${amount.toFixed(2)}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function horizonDaysFromQuery(query: ConversationQuery): number {
  if (!query.date_range) return 31;

  const start = new Date(query.date_range.start).getTime();
  const end = new Date(query.date_range.end).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 31;
  }

  const days = Math.ceil((end - start) / 86_400_000);
  return Math.min(Math.max(days, 1), 120);
}

function summarizeDebtTotals(debts: DebtWithPerson[]) {
  return {
    i_owe_total: roundMoney(
      debts
        .filter((debt) => debt.direction === "i_owe")
        .reduce((sum, debt) => sum + Number(debt.current_balance), 0)
    ),
    they_owe_me_total: roundMoney(
      debts
        .filter((debt) => debt.direction === "they_owe_me")
        .reduce((sum, debt) => sum + Number(debt.current_balance), 0)
    ),
    i_owe_count: debts.filter((debt) => debt.direction === "i_owe").length,
    they_owe_me_count: debts.filter((debt) => debt.direction === "they_owe_me")
      .length,
  };
}

function formatDebtForTool(debt: DebtWithPerson) {
  return {
    type: "debt",
    id: debt.id,
    name: debt.name,
    person_name: debt.related_person?.display_name ?? null,
    direction: debt.direction,
    kind: debt.kind,
    status: debt.status,
    amount: roundMoney(Number(debt.current_balance)),
    currency: debt.currency,
    due_date: debt.due_date,
    next_payment_date: debt.next_payment_date,
    installment_count: debt.installment_count,
    installment_amount:
      typeof debt.installment_amount === "number"
        ? roundMoney(debt.installment_amount)
        : debt.installment_amount,
    source: debt.source,
    confidence: debt.confidence,
  };
}

function formatDebtDetailForTool(detail: DebtDetailWithPayments) {
  const expectedTotal = roundMoney(
    detail.installments.reduce(
      (sum, installment) => sum + Number(installment.expected_amount),
      0
    )
  );
  const paidScheduleTotal = roundMoney(
    detail.installments.reduce(
      (sum, installment) => sum + Number(installment.paid_amount),
      0
    )
  );
  const remainingScheduleTotal = roundMoney(
    detail.installments.reduce(
      (sum, installment) =>
        sum +
        Math.max(
          0,
          Number(installment.expected_amount) -
            Number(installment.paid_amount)
        ),
      0
    )
  );
  const currentBalance = roundMoney(Number(detail.current_balance));

  return {
    ...formatDebtForTool(detail),
    principal_amount: roundMoney(Number(detail.principal_amount)),
    current_balance: currentBalance,
    schedule: {
      installment_count: detail.installments.length,
      configured_installment_count: detail.installment_count,
      configured_installment_amount:
        detail.installment_amount === null
          ? null
          : roundMoney(Number(detail.installment_amount)),
      expected_total: expectedTotal,
      paid_total: paidScheduleTotal,
      remaining_total: remainingScheduleTotal,
      balance_gap: roundMoney(currentBalance - remainingScheduleTotal),
      source: "debt_installments_authoritative",
    },
    installments: detail.installments.map((installment) => ({
      id: installment.id,
      debt_id: installment.debt_id,
      number: installment.number,
      due_date: installment.due_date,
      expected_amount: roundMoney(Number(installment.expected_amount)),
      paid_amount: roundMoney(Number(installment.paid_amount)),
      remaining_amount: roundMoney(
        Math.max(
          0,
          Number(installment.expected_amount) - Number(installment.paid_amount)
        )
      ),
      status: installment.status,
      movement_id: installment.movement_id,
      allocation_count: installment.allocations.length,
      allocations: installment.allocations.map((allocation) => ({
        id: allocation.id,
        payment_id: allocation.debt_payment_id,
        allocated_amount: roundMoney(Number(allocation.allocated_amount)),
        allocation_order: allocation.allocation_order,
        policy: allocation.policy,
        created_at: allocation.created_at,
      })),
    })),
    payments: detail.payments.map((payment) => ({
      id: payment.id,
      amount: roundMoney(Number(payment.amount)),
      currency: payment.currency,
      paid_at: payment.paid_at,
      movement_id: payment.movement_id,
      allocation_count: payment.allocations.length,
      allocations: payment.allocations.map((allocation) => ({
        installment_id: allocation.debt_installment_id,
        allocated_amount: roundMoney(Number(allocation.allocated_amount)),
        allocation_order: allocation.allocation_order,
        policy: allocation.policy,
      })),
    })),
  };
}

function buildDebtDetailWarnings(detail: DebtDetailWithPayments): string[] {
  const warnings: string[] = [];
  const expectedTotal = roundMoney(
    detail.installments.reduce(
      (sum, installment) => sum + Number(installment.expected_amount),
      0
    )
  );
  const remainingScheduleTotal = roundMoney(
    detail.installments.reduce(
      (sum, installment) =>
        sum +
        Math.max(
          0,
          Number(installment.expected_amount) -
            Number(installment.paid_amount)
        ),
      0
    )
  );
  const currentBalance = roundMoney(Number(detail.current_balance));

  if (detail.installments.length === 0) {
    if (detail.installment_count !== null || detail.installment_amount !== null) {
      warnings.push(
        `${detail.name}: existe una configuracion agregada de cuotas, pero no hay calendario individual disponible; no se deben inventar cuotas.`
      );
    }
    return warnings;
  }

  if (Math.abs(currentBalance - remainingScheduleTotal) > 0.01) {
    warnings.push(
      `${detail.name}: el saldo actual (${formatMoney(currentBalance)}) no coincide con el saldo restante del calendario (${formatMoney(remainingScheduleTotal)}); se muestran ambos sin asumir que son equivalentes.`
    );
  }

  if (
    detail.installment_count !== null &&
    detail.installment_count !== detail.installments.length
  ) {
    warnings.push(
      `${detail.name}: la cantidad configurada de cuotas (${detail.installment_count}) no coincide con las filas del calendario (${detail.installments.length}); las filas individuales tienen prioridad.`
    );
  }

  if (
    detail.installment_amount !== null &&
    detail.installments.some(
      (installment) =>
        Math.abs(Number(installment.expected_amount) - detail.installment_amount!) >
        0.01
    )
  ) {
    warnings.push(
      `${detail.name}: el importe configurado de cuota no coincide con todas las cuotas individuales; se usa el importe de cada fila.`
    );
  }

  if (expectedTotal <= 0) {
    warnings.push(`${detail.name}: el calendario no tiene importes esperados validos.`);
  }

  return warnings;
}

function formatDebtInstallmentForTool(
  installment: DebtInstallmentCommitmentSummary
) {
  return {
    type: "debt_installment",
    id: installment.id,
    debt_id: installment.debt_id,
    installment_id: installment.installment_id,
    installment_number: installment.installment_number,
    title: installment.title,
    name: installment.debt_name,
    direction: installment.direction,
    amount: roundMoney(installment.amount),
    currency: installment.currency,
    due_at: installment.due_at,
    kind: installment.kind,
    linked_box_id: installment.linked_box_id,
  };
}

function formatCommitmentForTool(commitment: UpcomingCommitmentSummary) {
  return {
    type: "recurring_commitment",
    id: commitment.id,
    title: commitment.title,
    name: commitment.title,
    amount: roundMoney(commitment.amount),
    currency: "PEN" as const,
    due_at: commitment.due_at,
    kind: commitment.kind,
    linked_box_id: commitment.linked_box_id,
  };
}

function formatRecurringRuleForTool(rule: RecurringRuleWithOccurrences) {
  return {
    type: "recurring_rule",
    id: rule.id,
    name: rule.name,
    status: rule.status,
    expected_amount: roundMoney(Number(rule.expected_amount)),
    currency: rule.currency,
    frequency: rule.frequency,
    next_expected_date: rule.next_expected_date,
    category_id: rule.category_id,
    default_account_id: rule.default_account_id,
    requires_confirmation_for_payment: rule.requires_confirmation_for_payment,
    occurrence_count: rule.occurrences.length,
  };
}

function filterDebtsByNaturalQuery(
  debts: DebtWithPerson[],
  normalizedText: string
): DebtWithPerson[] {
  const tokens = extractSearchTokens(normalizedText, DEBT_SEARCH_STOP_WORDS);
  if (tokens.length === 0) return debts;

  return debts.filter((debt) => {
    const haystack = normalizeForSearch(
      [
        debt.name,
        debt.kind,
        debt.status,
        debt.direction,
        debt.related_person?.display_name,
        debt.related_person?.relationship_label,
      ]
        .filter(Boolean)
        .join(" ")
    );
    return tokens.some((token) => haystack.includes(token));
  });
}

function filterDebtInstallmentsByNaturalQuery(
  installments: DebtInstallmentCommitmentSummary[],
  normalizedText: string,
  debtIds: Set<string>
): DebtInstallmentCommitmentSummary[] {
  const tokens = extractSearchTokens(normalizedText, DEBT_SEARCH_STOP_WORDS);
  if (tokens.length === 0 && debtIds.size === 0) return installments;

  return installments.filter((installment) => {
    if (debtIds.has(installment.debt_id)) return true;
    const haystack = normalizeForSearch(
      [
        installment.title,
        installment.debt_name,
        installment.direction,
        installment.kind,
      ].join(" ")
    );
    return tokens.some((token) => haystack.includes(token));
  });
}

function filterCommitmentsByNaturalQuery(
  commitments: UpcomingCommitmentSummary[],
  normalizedText: string
): UpcomingCommitmentSummary[] {
  const tokens = extractSearchTokens(normalizedText, RECURRING_SEARCH_STOP_WORDS);
  if (tokens.length === 0) return commitments;

  return commitments.filter((commitment) => {
    const haystack = normalizeForSearch(
      [commitment.title, commitment.kind].join(" ")
    );
    return tokens.some((token) => haystack.includes(token));
  });
}

function readReferencedEntityId(
  activeMemoryState: ConversationMemoryState | null,
  prefix: string,
): string | null {
  const refs = activeMemoryState?.referenced_entities ?? [];
  const match = refs.find((ref) => {
    const candidate = ref[`${prefix}_id`] ?? ref.id;
    const kind = ref.type ?? ref.entity_type ?? ref.kind;
    return typeof candidate === "string" &&
      (kind === prefix || `${prefix}_id` in ref || `${prefix}Id` in ref);
  });
  if (!match) return null;
  const candidate = match[`${prefix}_id`] ?? match.id;
  return typeof candidate === "string" && candidate.trim()
    ? candidate
    : null;
}

export function filterMovementsForConversationQuery<
  TMovement extends ConversationMovementWithLabels,
>(
  movements: TMovement[],
  query: ConversationQuery,
): TMovement[] {
  if (query.movement_filters) {
    return filterMovementsBySemanticFilters(movements, query.movement_filters);
  }

  return filterMovementsByNaturalQuery(movements, query.normalized_text);
}

function filterMovementsBySemanticFilters<
  TMovement extends ConversationMovementWithLabels,
>(
  movements: TMovement[],
  filters: NonNullable<ConversationQuery["movement_filters"]>,
): TMovement[] {
  const searchTerms = filters.search_terms.map(normalizeForSearch);
  const accountTerms = filters.account_terms.map(normalizeForSearch);
  const subcategoryTerms = (filters.subcategory_terms ?? []).map(normalizeForSearch);
  const personTerms = (filters.person_terms ?? []).map(normalizeForSearch);
  const tagTerms = (filters.tag_terms ?? []).map(normalizeForSearch);

  return movements.filter((movement) => {
    if (filters.uncategorized_only && movement.category_id) return false;
    if (
      filters.movement_types.length > 0 &&
      !filters.movement_types.includes(movement.type)
    ) {
      return false;
    }
    if (
      filters.category_ids.length > 0 &&
      (!movement.category_id ||
        !filters.category_ids.includes(movement.category_id))
    ) {
      return false;
    }
    if (
      filters.sources.length > 0 &&
      !filters.sources.includes(movement.source)
    ) {
      return false;
    }

    const accountHaystack = normalizeForSearch(
      [movement.account_origin_name, movement.account_destination_name]
        .filter(Boolean)
        .join(" "),
    );
    if (
      accountTerms.length > 0 &&
      !accountTerms.some((term) => accountHaystack.includes(term))
    ) {
      return false;
    }

    const subcategoryHaystack = normalizeForSearch(movement.subcategory_label ?? "");
    if (
      subcategoryTerms.length > 0 &&
      !subcategoryTerms.some((term) => subcategoryHaystack.includes(term))
    ) {
      return false;
    }

    const personHaystack = normalizeForSearch(movement.related_person_name ?? "");
    if (
      personTerms.length > 0 &&
      !personTerms.some((term) => personHaystack.includes(term))
    ) {
      return false;
    }

    const tagHaystack = normalizeForSearch((movement.tag_labels ?? []).join(" "));
    if (
      tagTerms.length > 0 &&
      !tagTerms.some((term) => tagHaystack.includes(term))
    ) {
      return false;
    }

    if (searchTerms.length === 0) return true;
    const haystack = normalizeForSearch(
      [
        movement.description,
        movement.merchant,
        movement.category_id,
        movement.category_label,
        movement.subcategory_label,
        movement.related_person_name,
        (movement.tag_labels ?? []).join(" "),
        movement.type,
        movement.account_origin_name,
        movement.account_destination_name,
      ]
        .filter(Boolean)
        .join(" "),
    );
    return searchTerms.some((term) => haystack.includes(term));
  });
}

function filterMovementsByNaturalQuery<
  TMovement extends ConversationMovementWithLabels,
>(
  movements: TMovement[],
  normalizedText: string,
): TMovement[] {
  if (/\b(sin clasificar|sin categoria)\b/.test(normalizedText)) {
    return movements.filter((movement) => !movement.category_id);
  }

  const sourceFilter = readSourceFilter(normalizedText);
  const tokens = extractSearchTokens(normalizedText, MOVEMENT_SEARCH_STOP_WORDS);
  const shouldFilter = sourceFilter !== null || tokens.length > 0;
  if (!shouldFilter) return movements;

  const matched = movements.filter((movement) => {
    if (sourceFilter && movement.source !== sourceFilter) return false;
    if (tokens.length === 0) return true;

    const haystack = normalizeForSearch(
      [
        movement.description,
        movement.merchant,
        movement.category_id,
        movement.category_label,
        movement.subcategory_label,
        movement.related_person_name,
        (movement.tag_labels ?? []).join(" "),
        movement.type,
        movement.source,
        movement.account_origin_name,
        movement.account_destination_name,
      ]
        .filter(Boolean)
        .join(" ")
    );
    return tokens.some((token) => haystack.includes(token));
  });

  return matched;
}

function readSourceFilter(text: string): string | null {
  if (/\bwhatsapp|wsp|wasap\b/.test(text)) return "whatsapp";
  if (/\bemail|correo\b/.test(text)) return "email_confirmed";
  if (/\bdashboard|manual\b/.test(text)) return "dashboard_manual";
  if (/\brecurrente|recurrencia\b/.test(text)) return "recurring_confirmed";
  return null;
}

function extractSearchTokens(text: string, stopWords: Set<string>): string[] {
  const tokens = normalizeForSearch(text)
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2)
    .filter((token) => !stopWords.has(token))
    .filter((token) => !/^\d+$/.test(token));
  return [...new Set(tokens)];
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function filterReferencedMovements(
  movements: ConversationMovement[],
  normalizedText: string
): ConversationMovement[] {
  const ordinal = readOrdinalReference(normalizedText);
  if (ordinal !== null && movements[ordinal]) {
    return [movements[ordinal]];
  }

  const tokens = normalizedText
    .split(/\s+/)
    .filter((token) => token.length > 2 && !REFERENCE_STOP_WORDS.has(token));
  if (tokens.length === 0) return movements;

  const matched = movements.filter((movement) => {
    const haystack = [
      movement.description,
      movement.merchant,
      movement.category_id,
      movement.type,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    return tokens.some((token) => haystack.includes(token));
  });

  return matched.length > 0 ? matched : movements;
}

function readOrdinalReference(text: string): number | null {
  if (/\b(primero|primer|1ro|1)\b/.test(text)) return 0;
  if (/\b(segundo|2do|2)\b/.test(text)) return 1;
  if (/\b(tercero|tercer|3ro|3)\b/.test(text)) return 2;
  if (/\b(cuarto|4to|4)\b/.test(text)) return 3;
  if (/\b(quinto|5to|5)\b/.test(text)) return 4;
  return null;
}

export function shouldUseActiveReferencedMovements(
  query: ConversationQuery,
  activeMemoryState: ConversationMemoryState | null,
  shouldUseActiveMemory: boolean
): boolean {
  if (
    query.kind !== "movement_search" ||
    !shouldUseActiveMemory ||
    !activeMemoryState ||
    getActiveMovementReferenceIds(activeMemoryState).length === 0
  ) {
    return false;
  }

  if (hasExplicitNewPeriod(query.normalized_text)) return false;

  return true;
}

function getActiveMovementReferenceIds(
  activeMemoryState: ConversationMemoryState | null
): string[] {
  if (!activeMemoryState) return [];

  const focusSet = activeMemoryState.working_set?.focus_set;
  if (
    focusSet?.subject === "movements" &&
    Date.parse(focusSet.expires_at) > Date.now()
  ) {
    return focusSet.ordered_ids.slice(0, 80);
  }

  return activeMemoryState.referenced_movements
    .map((movement) => movement.id)
    .filter(Boolean)
    .slice(0, 80);
}

function orderMovementsByReference(
  movements: ConversationMovement[],
  orderedIds: string[]
): ConversationMovement[] {
  const movementsById = new Map(
    movements.map((movement) => [movement.id, movement])
  );
  return orderedIds
    .map((movementId) => movementsById.get(movementId))
    .filter((movement): movement is ConversationMovement => Boolean(movement));
}

function hasExplicitNewPeriod(text: string): boolean {
  return /\b(hoy|ayer|esta semana|semana pasada|ultimo viernes|viernes|hace \d{1,2} meses|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.test(
    text
  );
}

const REFERENCE_STOP_WORDS = new Set([
  "puedes",
  "decir",
  "dime",
  "hora",
  "horas",
  "cada",
  "uno",
  "una",
  "movimiento",
  "movimientos",
  "gasto",
  "gastos",
  "registro",
  "registros",
  "anterior",
  "ultimo",
  "ultima",
  "detalle",
  "detalles",
  "fuente",
  "donde",
  "salio",
  "salio",
]);

const COMMON_SEARCH_STOP_WORDS = new Set([
  "que",
  "quien",
  "quienes",
  "cual",
  "cuales",
  "cuanto",
  "cuanta",
  "cuantos",
  "cuantas",
  "cuando",
  "como",
  "donde",
  "porque",
  "por",
  "para",
  "con",
  "sin",
  "los",
  "las",
  "del",
  "de",
  "la",
  "el",
  "un",
  "una",
  "unos",
  "unas",
  "me",
  "mi",
  "mis",
  "tu",
  "tus",
  "le",
  "te",
  "se",
  "lo",
  "y",
  "o",
  "tambien",
  "ademas",
  "hoy",
  "ayer",
  "esta",
  "este",
  "semana",
  "mes",
  "proximo",
  "siguiente",
  "ultimo",
  "ultima",
  "hacer",
  "hice",
  "tengo",
  "tiene",
  "tienes",
  "ver",
  "dime",
  "puedes",
  "podrias",
  "decir",
]);

const MOVEMENT_SEARCH_STOP_WORDS = new Set([
  ...COMMON_SEARCH_STOP_WORDS,
  "gaste",
  "gasto",
  "gastos",
  "movimiento",
  "movimientos",
  "historial",
  "monto",
  "montos",
  "total",
  "hora",
  "horas",
  "fecha",
  "fuente",
  "origen",
  "cuenta",
  "categoria",
  "categorias",
  "clasificar",
  "categoria",
]);

const DEBT_SEARCH_STOP_WORDS = new Set([
  ...COMMON_SEARCH_STOP_WORDS,
  "deuda",
  "deudas",
  "debo",
  "debe",
  "deben",
  "debemos",
  "prestamo",
  "prestamos",
  "cuota",
  "cuotas",
  "pagar",
  "cobrar",
  "cobro",
]);

const RECURRING_SEARCH_STOP_WORDS = new Set([
  ...COMMON_SEARCH_STOP_WORDS,
  "pago",
  "pagos",
  "vienen",
  "viene",
  "recurrente",
  "recurrentes",
  "suscripcion",
  "suscripciones",
  "compromiso",
  "compromisos",
  "comprometido",
  "vencimiento",
  "vencimientos",
]);

const MEMORY_SEARCH_STOP_WORDS = new Set([
  ...COMMON_SEARCH_STOP_WORDS,
  "recuerdas",
  "recordar",
  "sabes",
  "sobre",
  "preferencia",
  "preferencias",
  "persona",
  "personas",
  "frecuente",
  "frecuentes",
  "correccion",
  "correcciones",
  "aprendiste",
  "aprendido",
  "memoria",
  "contexto",
  "forma",
  "gastar",
  "gasto",
  "habito",
  "habitos",
  "patron",
  "patrones",
]);
