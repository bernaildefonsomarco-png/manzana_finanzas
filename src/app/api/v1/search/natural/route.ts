import { z } from "zod";
import { ConversationAgent } from "@/agents/conversation-agent";
import type {
  ConversationalAnswer,
  ConversationContextPack,
  ConversationQuery,
  ConversationToolResult,
  ConversationTurnState,
} from "@/agents/conversation-agent";
import { analyzeConversationTurn } from "@/core/conversation/conversation-kernel";
import { rememberConversationTurn } from "@/core/conversation/conversation-memory";
import { ToolGateway } from "@/core/conversation/tool-gateway";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { createServiceClient } from "@/data/supabase/server";
import { getActiveConversationMemoryState } from "@/data/repositories/conversation-memory.repository";
import { getProfile } from "@/data/repositories/profiles.repository";
import type { Database } from "@/data/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const NaturalSearchRequestSchema = z.object({
  query: z.string().trim().min(2).max(500),
  scope: z
    .enum(["movements", "money", "debts", "recurring", "pending", "memory", "all"])
    .default("all"),
});

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const body = await readJsonBody(request);
    const parsed = NaturalSearchRequestSchema.parse(body);

    if (isWriteAttempt(parsed.query)) {
      return okJson(
        {
          query: parsed.query,
          scope: parsed.scope,
          mode: "action_redirect",
          answer: {
            response_text:
              "La busqueda natural es solo de lectura. Para registrar, editar o borrar, usa el flujo estructurado correspondiente.",
            answer_kind: "unsupported",
            confidence: 0.95,
            cited_facts: [],
            used_tools: [],
            follow_up_question: "Quieres abrir Movimientos para hacerlo con control?",
            safety_flags: ["read_only", "write_attempt_redirected"],
          },
          sources: [],
          data_limits: [
            "Busqueda natural no crea, edita ni borra datos en V1.",
          ],
        },
        meta
      );
    }

    const profile = await getProfile(auth.client, auth.userId);
    const timezone = profile?.timezone ?? "America/Lima";
    const receivedAt = new Date().toISOString();
    const activeMemoryState = await getActiveConversationMemoryState(
      auth.client,
      {
        userId: auth.userId,
        channel: "dashboard",
        now: receivedAt,
      }
    );
    const conversationTurn = analyzeConversationTurn({
      text: parsed.query,
      receivedAt,
      timezone,
      activeState: activeMemoryState,
    });
    const conversationQuery = applyDashboardSearchFallback(
      applySearchScope(conversationTurn.query, parsed.scope),
      parsed.query,
      parsed.scope
    );
    const turnState =
      conversationQuery === conversationTurn.query
        ? conversationTurn.turn_state
        : forceReadOnlyTurnState(conversationTurn.turn_state, conversationQuery);
    const toolGateway = new ToolGateway(auth.client);
    const contextPack = await toolGateway.buildConversationContextPack({
      userId: auth.userId,
      locale: "es-PE",
      timezone,
      channel: "dashboard",
      originalMessage: parsed.query,
      receivedAt,
      query: conversationQuery,
      turnState,
      activeMemoryState,
    });
    const result = await new ConversationAgent().answer(contextPack, trace_id);
    await rememberWithServiceClient({
      fallbackClient: auth.client,
      contextPack,
      answer: result.output,
      sourceRef: trace_id,
    });

    return okJson(
      {
        query: parsed.query,
        scope: parsed.scope,
        mode: "answer",
        answer: result.output,
        query_interpretation: {
          kind: conversationQuery.kind,
          date_range: conversationQuery.date_range,
          confidence: conversationQuery.confidence,
          turn_state: turnState,
        },
        sources: buildSources(contextPack.tool_results),
        tool_results: contextPack.tool_results.map((tool) => ({
          tool_name: tool.tool_name,
          status: tool.status,
          facts: tool.facts,
          warnings: tool.warnings,
        })),
        data_limits: contextPack.data_limits,
      },
      meta
    );
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

function isWriteAttempt(query: string): boolean {
  const text = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  return /\b(registra|registrar|agrega|agregar|crea|crear|edita|editar|corrige|corregir|borra|borrar|elimina|eliminar|confirma|confirmar|descarta|descartar)\b/.test(
    text
  );
}

function applySearchScope(
  query: ConversationQuery,
  scope: z.infer<typeof NaturalSearchRequestSchema>["scope"]
): ConversationQuery {
  if (scope === "all") return query;

  const kindByScope: Record<
    Exclude<typeof scope, "all">,
    ConversationQuery["kind"]
  > = {
    movements: "movement_search",
    money: "balance_snapshot",
    debts: "debt_summary",
    recurring: "recurring_summary",
    pending: "pending_summary",
    memory: "financial_memory_search",
  };
  const kind = kindByScope[scope];

  if (query.kind === kind) return query;

  return {
    ...query,
    kind,
    requested_amount: kind === "balance_snapshot" ? query.requested_amount : null,
    date_range:
      kind === "movement_search" ||
      kind === "debt_summary" ||
      kind === "recurring_summary"
        ? query.date_range
        : null,
    confidence: Math.max(query.confidence, 0.72),
  };
}

function applyDashboardSearchFallback(
  query: ConversationQuery,
  originalText: string,
  scope: z.infer<typeof NaturalSearchRequestSchema>["scope"]
): ConversationQuery {
  if (scope !== "all" || query.kind !== "unsupported") return query;
  if (!shouldFallbackToTextualMovementSearch(originalText)) return query;

  return {
    ...query,
    kind: "movement_search",
    requested_amount: null,
    confidence: Math.max(query.confidence, 0.48),
  };
}

function shouldFallbackToTextualMovementSearch(query: string): boolean {
  const text = normalizeSearchText(query);
  if (!text || isWriteAttempt(query)) return false;
  if (/^(hola|ola|holi|buenas|buenos dias|buenas tardes|buenas noches|gracias|ok|ayuda|help)$/.test(text)) {
    return false;
  }

  const tokens = text
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .filter((token) => !DASHBOARD_SEARCH_FALLBACK_STOP_WORDS.has(token));

  return (
    tokens.length > 0 &&
    (/\b(gasto|gastos|gaste|pague|compre|compra|movimiento|movimientos|yape|plin|taxi|cafe|almuerzo|desayuno|cena|delivery|supermercado|tienda|uber|netflix|spotify|correo|email|pendiente|categoria|cuenta)\b/.test(
      text
    ) ||
      tokens.length >= 2)
  );
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\w\s/.,?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function forceReadOnlyTurnState(
  current: ConversationTurnState,
  query: ConversationQuery
): ConversationTurnState {
  return {
    ...current,
    act:
      current.continuity === "follow_up"
        ? "financial_follow_up"
        : "financial_question",
    experience_mode: "read_only_answer",
    should_route_to_conversation_agent: true,
    should_ask_clarification_first: false,
    response_guidance: [
      ...current.response_guidance,
      `respetar alcance seleccionado: ${query.kind}`,
      "usar solo herramientas read-only y fuentes disponibles",
    ],
    risk_notes: [...current.risk_notes, "alcance forzado desde busqueda natural"],
  };
}

function buildSources(toolResults: ConversationToolResult[]) {
  return toolResults.flatMap((tool) => {
    if (tool.tool_name === "query_movements") {
      return readArray(tool.data.movements)
        .map((movement) => sourceFromRecord("movement", movement))
        .filter(isSource);
    }

    if (tool.tool_name === "get_debt_summary") {
      return [
        ...readArray(tool.data.debts).map((debt) =>
          sourceFromRecord("debt", debt)
        ),
        ...readArray(tool.data.installments).map((installment) =>
          sourceFromRecord("debt_installment", installment)
        ),
      ].filter(isSource);
    }

    if (tool.tool_name === "get_recurring_summary") {
      return [
        ...readArray(tool.data.commitments).map((commitment) =>
          sourceFromRecord("recurring_commitment", commitment)
        ),
        ...readArray(tool.data.rules).map((rule) =>
          sourceFromRecord("recurring_rule", rule)
        ),
      ].filter(isSource);
    }

    if (tool.tool_name === "get_pending_summary") {
      return readArray(tool.data.items)
        .map((pending) => sourceFromRecord("pending", pending))
        .filter(isSource);
    }

    if (tool.tool_name === "get_balance_snapshot") {
      const source: NaturalSearchSource = {
        type: "balance",
        id: "balance-snapshot",
        label: "Dinero libre",
        amount:
          typeof tool.data.operational_free_money === "number"
            ? tool.data.operational_free_money
            : null,
        currency: "PEN",
        occurred_at: null,
        due_at: null,
        status: null,
        source_detail: "snapshot financiero",
      };
      return [source];
    }

    if (tool.tool_name === "search_financial_memory") {
      const memorySources = readArray(tool.data.sources)
        .map(sourceFromMemoryRecord)
        .filter(isSource);

      if (memorySources.length > 0) return memorySources;

      return [
        {
          type: "memory",
          id: "financial-memory",
          label: "Memoria financiera resumida",
          amount: null,
          currency: "PEN",
          occurred_at: null,
          due_at: null,
          status: null,
          source_detail: "preferencias y contexto resumido",
        } satisfies NaturalSearchSource,
      ];
    }

    return [];
  });
}

function sourceFromMemoryRecord(
  record: Record<string, unknown>
): NaturalSearchSource | null {
  const id = readString(record.id);
  const label = readString(record.label);
  if (!id || !label) return null;

  return {
    type: "memory",
    id,
    label,
    amount: null,
    currency: "PEN",
    occurred_at: null,
    due_at: null,
    status: readString(record.status),
    source_detail:
      readString(record.detail) ?? readString(record.kind) ?? "memoria segura",
  };
}

type NaturalSearchSourceType =
  | "movement"
  | "debt"
  | "debt_installment"
  | "recurring_commitment"
  | "recurring_rule"
  | "pending"
  | "balance"
  | "memory";

type NaturalSearchSource = {
  type: NaturalSearchSourceType;
  id: string;
  label: string;
  amount: number | null;
  currency: "PEN" | "USD";
  occurred_at: string | null;
  due_at: string | null;
  status: string | null;
  source_detail: string | null;
};

function sourceFromRecord(
  type: Exclude<NaturalSearchSourceType, "balance" | "memory">,
  record: Record<string, unknown>
): NaturalSearchSource | null {
  const id = readString(record.id);
  if (!id) return null;

  return {
    type,
    id,
    label:
      readString(record.description) ??
      readString(record.title) ??
      readString(record.name) ??
      readString(record.person_name) ??
      fallbackSourceLabel(type),
    amount:
      typeof record.amount === "number"
        ? record.amount
        : typeof record.expected_amount === "number"
          ? record.expected_amount
          : null,
    currency: record.currency === "USD" ? "USD" : ("PEN" as const),
    occurred_at: readString(record.occurred_at) ?? readString(record.created_at),
    due_at:
      readString(record.due_at) ??
      readString(record.due_date) ??
      readString(record.next_expected_date) ??
      readString(record.next_payment_date),
    status: readString(record.status),
    source_detail:
      readString(record.source) ??
      readString(record.kind) ??
      readString(record.risk_level),
  };
}

function fallbackSourceLabel(
  type: Exclude<NaturalSearchSourceType, "balance" | "memory">
): string {
  const labels: Record<Exclude<NaturalSearchSourceType, "balance" | "memory">, string> = {
    movement: "Movimiento",
    debt: "Deuda",
    debt_installment: "Cuota de deuda",
    recurring_commitment: "Pago que viene",
    recurring_rule: "Regla recurrente",
    pending: "Pendiente",
  };
  return labels[type];
}

function readArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object" && !Array.isArray(item)
      )
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function isSource(value: NaturalSearchSource | null): value is NaturalSearchSource {
  return value !== null;
}

async function rememberWithServiceClient(input: {
  fallbackClient: SupabaseClient<Database>;
  contextPack: ConversationContextPack;
  answer: ConversationalAnswer;
  sourceRef?: string | null;
}) {
  try {
    await rememberConversationTurn({
      client: createServiceClient(),
      contextPack: input.contextPack,
      answer: input.answer,
      sourceRef: input.sourceRef,
      traceId: input.sourceRef,
    });
  } catch {
    await rememberConversationTurn({
      client: input.fallbackClient,
      contextPack: input.contextPack,
      answer: input.answer,
      sourceRef: input.sourceRef,
      traceId: input.sourceRef,
    });
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}

const DASHBOARD_SEARCH_FALLBACK_STOP_WORDS = new Set([
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
  "me",
  "mi",
  "mis",
  "hoy",
  "ayer",
  "esta",
  "este",
  "semana",
  "mes",
  "ultimo",
  "ultima",
  "ver",
  "dime",
  "puedes",
  "podrias",
  "decir",
]);
