import type { SupabaseClient } from "@supabase/supabase-js";
import {
  budgetPeriodContaining,
  buildBudgetSuggestion,
  calculateBudgetProgress,
  calculateGoalMonthlyPace,
  previousBudgetPeriod,
  selectTopBudgetSummaries,
  type BudgetKind,
  type BudgetMovement,
  type BudgetPeriodKind,
  type BudgetProgress,
  type BudgetSuggestion,
} from "@/core/budgets";
import type { Database, Json } from "@/data/supabase/types";
import {
  addCalendarDays,
  isoDateInLima,
  limaLocalInputToUtcIso,
} from "@/shared/dates/lima";
import {
  CATEGORY_IDS,
  type Box,
  type CategoryId,
  type Movement,
} from "@/shared/types/domain";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;
type BudgetStatus = "activo" | "pausado" | "archivado";
type GoalStatus = "activa" | "alcanzada" | "pausada" | "archivada";

export type BudgetRecord = {
  id: string;
  user_id: string;
  category_id: CategoryId | null;
  currency: "PEN";
  period_kind: BudgetPeriodKind;
  period_start: string;
  period_end: string;
  base_amount: number;
  rollover_amount: number;
  amount: number;
  kind: BudgetKind;
  rollover: boolean;
  auto_renew: boolean;
  alerted_thresholds: number[];
  source: "manual" | "sugerido";
  status: BudgetStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
};

export type BudgetWithProgress = BudgetRecord &
  BudgetProgress & {
    category_name: string | null;
  };

export type BudgetDetail = BudgetWithProgress & {
  movements: Movement[];
  snapshots: BudgetProgressSnapshot[];
};

export type BudgetProgressSnapshot = {
  id: string;
  user_id: string;
  budget_id: string;
  as_of: string;
  spent: number;
  remaining: number;
  pct: number;
  created_at: string;
};

export type GoalRecord = {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  target_date: string | null;
  box_id: string | null;
  currency: "PEN";
  status: GoalStatus;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  metadata: Record<string, unknown>;
};

export type GoalWithProgress = GoalRecord & {
  box: Box | null;
  current_balance: number | null;
  progress_pct: number | null;
  monthly_pace: number | null;
};

export type BudgetOperationResult = {
  budget: BudgetRecord | null;
  budgets?: BudgetRecord[];
  idempotent: boolean;
};

export type GoalOperationResult = {
  goal: GoalRecord;
  idempotent: boolean;
};

export type SuggestionDecisionResult = {
  decision: {
    suggestion_key: string;
    resolution: "accepted" | "dismissed";
    budget_id: string | null;
  };
  budget?: BudgetRecord | null;
  idempotent: boolean;
};

export class BudgetOperationError extends Error {
  constructor(
    readonly code:
      | "BUDGET_NOT_FOUND"
      | "GOAL_NOT_FOUND"
      | "BUDGET_CONFLICT"
      | "GOAL_CONFLICT"
      | "IDEMPOTENCY_CONFLICT"
      | "BUDGET_INVALID"
      | "GOAL_INVALID",
    message: string
  ) {
    super(message);
    this.name = "BudgetOperationError";
  }
}

export async function listBudgetsWithProgress(
  client: Client,
  userId: string,
  options: {
    date: string;
    periodKind: BudgetPeriodKind;
    statuses?: BudgetStatus[];
    kind?: BudgetKind;
    categoryId?: string;
    limit?: number;
    cursorFilter?: string;
  }
): Promise<BudgetWithProgress[]> {
  const period = budgetPeriodContaining(options.date, options.periodKind);
  let query = client
    .from("budgets")
    .select("*, categories(id, label)")
    .eq("user_id", userId)
    .eq("period_kind", options.periodKind)
    .lte("period_start", options.date)
    .gte("period_end", options.date)
    .in("status", options.statuses ?? ["activo", "pausado"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (options.kind) query = query.eq("kind", options.kind);
  if (options.categoryId) {
    query =
      options.categoryId === "general"
        ? query.is("category_id", null)
        : query.eq("category_id", options.categoryId);
  }
  if (options.cursorFilter) query = query.or(options.cursorFilter);
  if (options.limit !== undefined) query = query.limit(options.limit);

  const [{ data: budgetRows, error: budgetError }, movements] =
    await Promise.all([
      query,
      listBudgetMovements(client, userId, period.start, period.end),
    ]);
  if (budgetError) {
    logger.error("budgets.list_failed", { error: budgetError, user_id: userId });
    throw budgetError;
  }

  return (budgetRows ?? []).map((row) =>
    withBudgetProgress(row as unknown as BudgetRowWithCategory, movements)
  );
}

export async function getBudgetDetail(
  client: Client,
  userId: string,
  budgetId: string
): Promise<BudgetDetail | null> {
  const { data: row, error } = await client
    .from("budgets")
    .select("*, categories(id, label)")
    .eq("id", budgetId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    logger.error("budgets.get_failed", {
      error,
      user_id: userId,
      budget_id: budgetId,
    });
    throw error;
  }
  if (!row) return null;

  const budgetRow = row as unknown as BudgetRowWithCategory;
  const [movements, snapshotsResult] = await Promise.all([
    listBudgetMovements(
      client,
      userId,
      budgetRow.period_start,
      budgetRow.period_end
    ),
    client
      .from("budget_progress_snapshots")
      .select("*")
      .eq("user_id", userId)
      .eq("budget_id", budgetId)
      .order("as_of", { ascending: false })
      .limit(100),
  ]);
  if (snapshotsResult.error) throw snapshotsResult.error;

  const progress = withBudgetProgress(budgetRow, movements);
  const movementIds = new Set(progress.movement_ids);
  return {
    ...progress,
    movements: movements.filter((movement) => movementIds.has(movement.id)),
    snapshots: (snapshotsResult.data ?? []) as BudgetProgressSnapshot[],
  };
}

export async function listBudgetSuggestions(
  client: Client,
  userId: string,
  input: { periodKind: BudgetPeriodKind; date: string }
): Promise<BudgetSuggestion[]> {
  const current = budgetPeriodContaining(input.date, input.periodKind);
  const periods: Array<{ start: string; end: string }> = [];
  let cursor = current;
  for (let index = 0; index < 6; index += 1) {
    cursor = previousBudgetPeriod(cursor, input.periodKind);
    periods.unshift(cursor);
  }
  const movements = await listBudgetMovements(
    client,
    userId,
    periods[0].start,
    periods.at(-1)?.end ?? periods[0].end
  );
  const categoryIds = new Set<CategoryId>();
  for (const movement of movements) {
    if (movement.category_id && isCategoryId(movement.category_id)) {
      categoryIds.add(movement.category_id);
    }
  }

  const suggestions = [...categoryIds].flatMap((categoryId) => {
    const suggestion = buildBudgetSuggestion({
      category_id: categoryId,
      period_kind: input.periodKind,
      as_of: input.date,
      periods: periods.map((period) => ({
        period_start: period.start,
        period_end: period.end,
        spent: calculateBudgetProgress({
          amount: 1,
          category_id: categoryId,
          movements: movements
            .filter((movement) => movementOccursInPeriod(movement, period))
            .map(toBudgetMovement),
        }).spent,
      })),
    });
    return suggestion ? [suggestion] : [];
  });
  if (suggestions.length === 0) return [];

  const { data: decisions, error } = await client
    .from("budget_suggestion_decisions")
    .select("suggestion_key")
    .eq("user_id", userId)
    .in(
      "suggestion_key",
      suggestions.map((suggestion) => suggestion.id)
    );
  if (error) throw error;
  const decided = new Set(
    (decisions ?? []).map((decision) => decision.suggestion_key)
  );
  return suggestions.filter((suggestion) => !decided.has(suggestion.id));
}

export async function getBudgetSummary(
  client: Client,
  userId: string,
  input: { periodKind: BudgetPeriodKind; date: string }
) {
  const budgets = await listBudgetsWithProgress(client, userId, {
    date: input.date,
    periodKind: input.periodKind,
    statuses: ["activo"],
    limit: 100,
  });
  return {
    period: budgetPeriodContaining(input.date, input.periodKind),
    total: budgets.length,
    top: selectTopBudgetSummaries(budgets),
  };
}

export async function listGoals(
  client: Client,
  userId: string,
  options: {
    statuses?: GoalStatus[];
    limit?: number;
    cursorFilter?: string;
    asOf: string;
  }
): Promise<GoalWithProgress[]> {
  let query = client
    .from("goals")
    .select("*, boxes(*)")
    .eq("user_id", userId)
    .in("status", options.statuses ?? ["activa", "alcanzada", "pausada"])
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });
  if (options.cursorFilter) query = query.or(options.cursorFilter);
  if (options.limit !== undefined) query = query.limit(options.limit);
  const { data, error } = await query;
  if (error) {
    logger.error("goals.list_failed", { error, user_id: userId });
    throw error;
  }
  return (data ?? []).map((row) =>
    withGoalProgress(row as unknown as GoalRowWithBox, options.asOf)
  );
}

export async function getGoalDetail(
  client: Client,
  userId: string,
  goalId: string,
  asOf: string
): Promise<GoalWithProgress | null> {
  const { data, error } = await client
    .from("goals")
    .select("*, boxes(*)")
    .eq("id", goalId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data
    ? withGoalProgress(data as unknown as GoalRowWithBox, asOf)
    : null;
}

export async function commitBudgetOperation(
  client: Client,
  _userId: string,
  input: {
    operation:
      | "create"
      | "update"
      | "archive"
      | "pause"
      | "resume"
      | "restore"
      | "copy_previous";
    budgetId: string | null;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    traceId: string;
  }
): Promise<BudgetOperationResult> {
  const { data, error } = await client.rpc("commit_budget_operation", {
    p_operation: input.operation,
    // El generador de tipos no refleja que Postgres acepta NULL aqui
    // (el parametro no tiene NOT NULL, solo carece de DEFAULT).
    p_budget_id: input.budgetId as string,
    p_payload: toJson({ ...input.payload, trace_id: input.traceId }),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throwBudgetRpcError(error);
  return normalizeBudgetOperationResult(data);
}

export async function commitGoalOperation(
  client: Client,
  _userId: string,
  input: {
    operation:
      | "create"
      | "update"
      | "archive"
      | "pause"
      | "resume"
      | "restore"
      | "link_box"
      | "unlink_box";
    goalId: string | null;
    payload: Record<string, unknown>;
    idempotencyKey: string;
    traceId: string;
  }
): Promise<GoalOperationResult> {
  const { data, error } = await client.rpc("commit_goal_operation", {
    p_operation: input.operation,
    // El generador de tipos no refleja que Postgres acepta NULL aqui
    // (el parametro no tiene NOT NULL, solo carece de DEFAULT).
    p_goal_id: input.goalId as string,
    p_payload: toJson({ ...input.payload, trace_id: input.traceId }),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throwBudgetRpcError(error);
  const record = asRecord(data);
  return {
    goal: (record.goal ?? record) as GoalRecord,
    idempotent: record.idempotent === true,
  };
}

export async function resolveBudgetSuggestion(
  client: Client,
  _userId: string,
  input: {
    suggestionKey: string;
    resolution: "accepted" | "dismissed";
    payload: Record<string, unknown>;
    idempotencyKey: string;
    traceId: string;
  }
): Promise<SuggestionDecisionResult> {
  const { data, error } = await client.rpc("resolve_budget_suggestion", {
    p_suggestion_key: input.suggestionKey,
    p_resolution: input.resolution,
    p_payload: toJson({ ...input.payload, trace_id: input.traceId }),
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) throwBudgetRpcError(error);
  const record = asRecord(data);
  return {
    decision: (record.decision ?? {
      suggestion_key: input.suggestionKey,
      resolution: input.resolution,
      budget_id: null,
    }) as SuggestionDecisionResult["decision"],
    budget: (record.budget as BudgetRecord | null | undefined) ?? null,
    idempotent: record.idempotent === true,
  };
}

export async function runBudgetDailyLifecycle(
  client: Client,
  input: { asOf?: string; userId?: string }
): Promise<Record<string, unknown>> {
  const { data, error } = await client.rpc("run_budget_daily_lifecycle", {
    // El generador de tipos no refleja que Postgres acepta NULL aqui
    // (los parametros no tienen NOT NULL, solo carecen de NULL como
    // DEFAULT explicito).
    p_as_of: (input.asOf ?? null) as string,
    p_user_id: (input.userId ?? null) as string,
  });
  if (error) {
    logger.error("budgets.daily_lifecycle_failed", {
      error,
      user_id: input.userId,
      as_of: input.asOf ?? null,
    });
    throw error;
  }
  return asRecord(data);
}

async function listBudgetMovements(
  client: Client,
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<Movement[]> {
  const from = limaLocalInputToUtcIso(`${periodStart}T00:00`);
  const until = limaLocalInputToUtcIso(
    `${addCalendarDays(periodEnd, 1)}T00:00`
  );
  const { data, error } = await client
    .from("movements")
    .select("*")
    .eq("user_id", userId)
    .eq("currency", "PEN")
    .in("status", ["confirmed", "needs_review", "corrected"])
    .gte("occurred_at", from)
    .lt("occurred_at", until)
    .order("occurred_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) {
    logger.error("budgets.movements_failed", {
      error,
      user_id: userId,
      period_start: periodStart,
      period_end: periodEnd,
    });
    throw error;
  }
  return (data ?? []) as Movement[];
}

function withBudgetProgress(
  row: BudgetRowWithCategory,
  movements: Movement[]
): BudgetWithProgress {
  const plain = toBudgetRecord(row);
  const progress = calculateBudgetProgress({
    amount: Number(plain.amount),
    category_id: plain.category_id,
    movements: movements.map(toBudgetMovement),
  });
  return {
    ...plain,
    ...progress,
    category_name: row.categories?.label ?? null,
  };
}

function toBudgetRecord(row: BudgetRowWithCategory): BudgetRecord {
  const { categories: _category, ...plain } = row;
  return {
    ...plain,
    base_amount: Number(plain.base_amount),
    rollover_amount: Number(plain.rollover_amount),
    amount: Number(plain.amount),
    alerted_thresholds: plain.alerted_thresholds ?? [],
    metadata: asRecord(plain.metadata),
  };
}

function toBudgetMovement(movement: Movement): BudgetMovement {
  return {
    id: movement.id,
    type: movement.type,
    status: movement.status,
    amount: Number(movement.amount),
    currency: movement.currency,
    category_id: movement.category_id,
    deleted_at: movement.deleted_at,
  };
}

function movementOccursInPeriod(
  movement: Movement,
  period: { start: string; end: string }
): boolean {
  const date = isoDateInLima(new Date(movement.occurred_at));
  return date >= period.start && date <= period.end;
}

function withGoalProgress(
  row: GoalRowWithBox,
  asOf: string
): GoalWithProgress {
  const { boxes, ...plain } = row;
  const box = boxes && !boxes.deleted_at ? boxes : null;
  const targetAmount = box?.target_amount
    ? Number(box.target_amount)
    : Number(plain.target_amount);
  const targetDate = box?.target_date ?? plain.target_date;
  const currentBalance = box ? Number(box.current_balance) : null;
  return {
    ...plain,
    target_amount: targetAmount,
    target_date: targetDate,
    metadata: asRecord(plain.metadata),
    box,
    current_balance: currentBalance,
    progress_pct:
      currentBalance === null
        ? null
        : Math.round((currentBalance / targetAmount) * 10_000) / 100,
    monthly_pace: calculateGoalMonthlyPace({
      target_amount: targetAmount,
      current_balance: currentBalance ?? 0,
      target_date: targetDate,
      as_of: asOf,
    }),
  };
}

function normalizeBudgetOperationResult(data: unknown): BudgetOperationResult {
  const record = asRecord(data);
  const budget = (record.budget ?? null) as BudgetRecord | null;
  return {
    budget,
    budgets: Array.isArray(record.budgets)
      ? (record.budgets as BudgetRecord[])
      : undefined,
    idempotent: record.idempotent === true,
  };
}

function throwBudgetRpcError(error: {
  message?: string;
  details?: string | null;
  code?: string;
}): never {
  const message = `${error.message ?? ""} ${error.details ?? ""}`;
  if (
    includesAny(message, [
      "BUDGET_NOT_FOUND",
      "BUDGET_CATEGORY_NOT_FOUND",
      "BUDGET_PREVIOUS_PERIOD_NOT_FOUND",
      "BUDGET_SUGGESTION_NOT_FOUND",
    ])
  ) {
    throw new BudgetOperationError(
      "BUDGET_NOT_FOUND",
      message.includes("CATEGORY")
        ? "No encontre esa categoria."
        : message.includes("PREVIOUS_PERIOD")
          ? "Todavia no hay un periodo anterior que copiar."
          : message.includes("SUGGESTION")
            ? "No encontre esa sugerencia."
            : "No encontre ese presupuesto."
    );
  }
  if (
    includesAny(message, [
      "GOAL_NOT_FOUND",
      "GOAL_BOX_NOT_FOUND",
      "BOX_NOT_FOUND",
    ])
  ) {
    throw new BudgetOperationError(
      "GOAL_NOT_FOUND",
      "No encontre esa meta o caja."
    );
  }
  if (
    includesAny(message, [
      "BUDGET_IDEMPOTENCY_CONFLICT",
      "BUDGET_SUGGESTION_IDEMPOTENCY_CONFLICT",
      "GOAL_IDEMPOTENCY_CONFLICT",
    ])
  ) {
    throw new BudgetOperationError(
      "IDEMPOTENCY_CONFLICT",
      "La misma llave ya se uso con otros datos."
    );
  }
  if (
    error.code === "23505" ||
    message.includes("BUDGET_CONFLICT") ||
    message.includes("BUDGET_DUPLICATE") ||
    message.includes("BUDGET_STATE_CONFLICT") ||
    message.includes("BUDGET_PERIOD_CLOSED") ||
    message.includes("BUDGET_SUGGESTION_ALREADY_RESOLVED")
  ) {
    throw new BudgetOperationError(
      "BUDGET_CONFLICT",
      "Ya existe un presupuesto activo para ese periodo."
    );
  }
  if (
    message.includes("GOAL_CONFLICT") ||
    message.includes("GOAL_DUPLICATE") ||
    message.includes("BOX_ALREADY_LINKED") ||
    message.includes("GOAL_STATE_CONFLICT")
  ) {
    throw new BudgetOperationError(
      "GOAL_CONFLICT",
      "Ya existe esa meta o la caja respalda otra meta."
    );
  }
  if (
    includesAny(message, [
      "BUDGET_AMOUNT_INVALID",
      "BUDGET_CURRENCY_UNSUPPORTED",
      "BUDGET_IDEMPOTENCY_KEY_REQUIRED",
      "BUDGET_OPERATION_INVALID",
      "BUDGET_SUGGESTION_INVALID",
      "BUDGET_SUGGESTION_RESOLUTION_INVALID",
    ])
  ) {
    throw new BudgetOperationError(
      "BUDGET_INVALID",
      "Los datos del presupuesto no son validos."
    );
  }
  if (
    includesAny(message, [
      "GOAL_AMOUNT_INVALID",
      "GOAL_BOX_INVALID",
      "GOAL_CURRENCY_UNSUPPORTED",
      "GOAL_IDEMPOTENCY_KEY_REQUIRED",
      "GOAL_NAME_INVALID",
      "GOAL_OPERATION_INVALID",
      "GOAL_TARGET_DATE_INVALID",
    ])
  ) {
    throw new BudgetOperationError(
      "GOAL_INVALID",
      "Los datos de la meta no son validos."
    );
  }
  throw error;
}

function includesAny(message: string, codes: string[]): boolean {
  return codes.some((code) => message.includes(code));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function toJson(value: Record<string, unknown>): Json {
  return value as Json;
}

function isCategoryId(value: string): value is CategoryId {
  return (CATEGORY_IDS as readonly string[]).includes(value);
}

type BudgetRowWithCategory = BudgetRecord & {
  categories: { id: string; label: string } | null;
};

type GoalRowWithBox = GoalRecord & {
  boxes: Box | null;
};
