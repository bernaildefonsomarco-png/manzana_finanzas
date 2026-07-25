import { getActiveAccounts, getActiveBoxes } from "@/data/repositories/accounts.repository";
import { deriveInitialOnboardingSummary } from "@/core/onboarding/onboarding-activation";
import { listDebtInstallmentCommitments } from "@/data/repositories/debts.repository";
import {
  listDashboardInsights,
  recordDashboardInsightsDisplayed,
} from "@/data/repositories/insights.repository";
import { listDashboardNudges } from "@/data/repositories/nudges.repository";
import { listPendingItems } from "@/data/repositories/pending.repository";
import { getProfile, upsertProfile } from "@/data/repositories/profiles.repository";
import { listUpcomingCommitments } from "@/data/repositories/recurring.repository";
import type { UpcomingCommitmentSummary } from "@/data/repositories/recurring.repository";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { createServiceClient } from "@/data/supabase/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
} from "@/app/api/_lib/http";
import type {
  Account,
  Box,
  InsightCandidate,
  Movement,
  NudgeCandidate,
  OnboardingStatus,
  PendingItem,
} from "@/shared/types/domain";
import type {
  HomeDashboardNudge,
  HomeDashboardSummary,
} from "@/features/home/home-types";
import { sortMovementsByRegistrationRecency } from "@/features/movements/movement-sort";

export const dynamic = "force-dynamic";

type Client = SupabaseClient<Database>;

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const [
      accounts,
      boxes,
      pendingItems,
      recurringCommitments,
      debtCommitments,
      dashboardNudges,
      dashboardInsights,
      recentMovementsResult,
      confirmedMovementsCountResult,
      movementsWithoutAccountCountResult,
      profile,
      debtCountResult,
    ] = await Promise.all([
      getActiveAccounts(auth.client, auth.userId),
      getActiveBoxes(auth.client, auth.userId),
      listPendingItems(auth.client, auth.userId, { limit: 30 }),
      listUpcomingCommitments(auth.client, auth.userId, 31),
      listDebtInstallmentCommitments(auth.client, auth.userId, 31),
      listDashboardNudges(auth.client, auth.userId, { limit: 5 }),
      listDashboardInsights(auth.client, auth.userId, { limit: 3 }),
      listRecentMovements(auth.client, auth.userId),
      countConfirmedMovements(auth.client, auth.userId),
      countConfirmedMovementsWithoutAccount(auth.client, auth.userId),
      getProfile(auth.client, auth.userId).then(
        (current) =>
          current ?? upsertProfile(createServiceClient(), auth.userId, {})
      ),
      countDebts(auth.client, auth.userId),
    ]);

    if (recentMovementsResult.error) {
      return errorJson(
        "INTERNAL_ERROR",
        "No pude leer los movimientos recientes.",
        meta,
        500
      );
    }

    if (
      confirmedMovementsCountResult.error ||
      movementsWithoutAccountCountResult.error ||
      debtCountResult.error
    ) {
      return errorJson(
        "INTERNAL_ERROR",
        "No pude calcular la calidad de datos.",
        meta,
        500
      );
    }

    const summary = buildHomeSummary({
      accounts,
      boxes,
      pendingItems,
      commitments: [...recurringCommitments, ...debtCommitments].sort(
        compareCommitments
      ),
      dashboardNudges,
      dashboardInsights,
      recentMovements: recentMovementsResult.movements,
      confirmedMovementsCount: confirmedMovementsCountResult.count,
      movementsWithoutAccountCount: movementsWithoutAccountCountResult.count,
      onboardingStatus: profile.onboarding_status,
      debtsCount: debtCountResult.count,
    });

    await recordDashboardInsightsDisplayed(
      createServiceClient(),
      auth.userId,
      dashboardInsights.map((insight) => insight.id),
      { traceId: trace_id },
    );

    return okJson(summary, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

async function listRecentMovements(
  client: Client,
  userId: string
): Promise<{ movements: Movement[]; error: unknown }> {
  const { data, error } = await client
    .from("movements")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("occurred_at", { ascending: false })
    .limit(6);

  return {
    movements: sortMovementsByRegistrationRecency((data ?? []) as Movement[]),
    error,
  };
}

async function countConfirmedMovements(
  client: Client,
  userId: string
): Promise<{ count: number; error: unknown }> {
  const { count, error } = await client
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .is("deleted_at", null);

  return { count: count ?? 0, error };
}

async function countConfirmedMovementsWithoutAccount(
  client: Client,
  userId: string
): Promise<{ count: number; error: unknown }> {
  const { count, error } = await client
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .is("account_origin_id", null)
    .is("account_destination_id", null);

  return { count: count ?? 0, error };
}

async function countDebts(
  client: Client,
  userId: string
): Promise<{ count: number; error: unknown }> {
  const { count, error } = await client
    .from("debts")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null);

  return { count: count ?? 0, error };
}

function buildHomeSummary(input: {
  accounts: Account[];
  boxes: Box[];
  pendingItems: PendingItem[];
  commitments: UpcomingCommitmentSummary[];
  dashboardNudges: NudgeCandidate[];
  dashboardInsights: InsightCandidate[];
  recentMovements: Movement[];
  confirmedMovementsCount: number;
  movementsWithoutAccountCount: number;
  onboardingStatus: OnboardingStatus;
  debtsCount: number;
}): HomeDashboardSummary {
  const moneySummary = buildMoneySummary(input.accounts, input.boxes);
  const pendingSummary = buildPendingSummary(input.pendingItems);
  const dataQuality = buildDataQualitySummary({
    hasAccounts: input.accounts.length > 0,
    confirmedMovementsCount: input.confirmedMovementsCount,
    movementsWithoutAccountCount: input.movementsWithoutAccountCount,
  });

  return {
    money_summary: moneySummary,
    pending_summary: pendingSummary,
    recent_movements: input.recentMovements,
    next_commitments: input.commitments.slice(0, 3).map((commitment) => ({
      id: commitment.id,
      title: commitment.title,
      amount: commitment.amount,
      due_at: commitment.due_at,
      kind: commitment.kind,
    })),
    dashboard_nudges: input.dashboardNudges.map(toHomeDashboardNudge),
    featured_insight: input.dashboardInsights[0]
      ? toHomeInsight(input.dashboardInsights[0])
      : null,
    suggested_action: buildSuggestedAction({
      hasMoneySummary: moneySummary !== null,
      pendingCount: pendingSummary.active_count,
      movementCount: input.confirmedMovementsCount,
    }),
    data_quality: dataQuality,
    onboarding: deriveInitialOnboardingSummary({
      persistedStatus: input.onboardingStatus,
      confirmedMovementsCount: input.confirmedMovementsCount,
      debtsCount: input.debtsCount,
    }),
  };
}

function buildMoneySummary(accounts: Account[], boxes: Box[]) {
  if (accounts.length === 0) return null;

  const totalBalance = accounts.reduce(
    (sum, account) => sum + Number(account.current_balance),
    0
  );
  const separatedBalance = boxes.reduce(
    (sum, box) => sum + Number(box.current_balance),
    0
  );

  return {
    total_balance: roundMoney(totalBalance),
    separated_balance: roundMoney(separatedBalance),
    free_balance: roundMoney(totalBalance - separatedBalance),
    currency: "PEN" as const,
    account_count: accounts.length,
    box_count: boxes.length,
  };
}

function buildPendingSummary(pendingItems: PendingItem[]) {
  return {
    active_count: pendingItems.length,
    needs_completion_count: pendingItems.filter((item) => {
      const summary = item.normalized_summary;
      return typeof summary.amount !== "number" || !summary.category_id;
    }).length,
    high_risk_count: pendingItems.filter(
      (item) => item.risk_level === "high" || item.risk_level === "sensitive"
    ).length,
  };
}

function toHomeDashboardNudge(candidate: NudgeCandidate): HomeDashboardNudge {
  const metadata = asRecord(candidate.metadata);
  const target = asHomeNudgeTarget(metadata.target_view);

  return {
    id: candidate.id,
    type: asHomeNudgeType(candidate.type),
    title:
      getRecordString(metadata, "title") ??
      (candidate.type === "overdue_payment"
        ? "Hay un pago pendiente"
        : "Hay un pago cerca"),
    body:
      getRecordString(metadata, "body") ??
      "Conviene revisarlo desde tus pagos esperados.",
    evidence: getRecordString(metadata, "evidence"),
    action_label: getRecordString(metadata, "action_label") ?? "Ver",
    target_view: target,
    priority: candidate.priority,
    scheduled_for: candidate.scheduled_for,
    debt_id: getRecordString(metadata, "debt_id"),
    installment_id: getRecordString(metadata, "installment_id"),
  };
}

function asHomeNudgeType(value: NudgeCandidate["type"]) {
  if (
    value === "payment_due" ||
    value === "overdue_payment" ||
    value === "pending_review" ||
    value === "debt_due" ||
    value === "insight_prompt"
  ) {
    return value;
  }

  return "insight_prompt";
}

function asHomeNudgeTarget(value: unknown): HomeDashboardNudge["target_view"] {
  if (
    value === "upcoming" ||
    value === "pending" ||
    value === "debts" ||
    value === "insights"
  ) {
    return value;
  }

  return "upcoming";
}

function buildDataQualitySummary(input: {
  hasAccounts: boolean;
  confirmedMovementsCount: number;
  movementsWithoutAccountCount: number;
}) {
  if (!input.hasAccounts) {
    return {
      confirmed_movements_count: input.confirmedMovementsCount,
      movements_without_account_count: input.movementsWithoutAccountCount,
      has_accounts: false,
      message:
        "Tus registros estan guardados, pero sin cuentas no calculamos saldos ni dinero libre.",
    };
  }

  if (input.movementsWithoutAccountCount > 0) {
    return {
      confirmed_movements_count: input.confirmedMovementsCount,
      movements_without_account_count: input.movementsWithoutAccountCount,
      has_accounts: true,
      message:
        "Hay movimientos sin cuenta. Estan en tu historial, pero no movieron saldos de cuenta.",
    };
  }

  return {
    confirmed_movements_count: input.confirmedMovementsCount,
    movements_without_account_count: 0,
    has_accounts: true,
    message: "Tus movimientos confirmados tienen contexto suficiente para saldos.",
  };
}

function toHomeInsight(insight: InsightCandidate) {
  return {
    title: insight.title,
    body: insight.body,
    evidence: insight.evidence_text,
    tone:
      insight.type === "progress" || insight.type === "learning_progress"
        ? ("progress" as const)
        : insight.type === "anomaly" || insight.type === "data_quality"
          ? ("attention" as const)
          : ("useful" as const),
  };
}

function buildSuggestedAction(input: {
  hasMoneySummary: boolean;
  pendingCount: number;
  movementCount: number;
}) {
  if (input.pendingCount > 0) {
    return {
      label: "Revisar pendientes",
      description: "Confirma, edita o descarta lo que Manzana separo.",
      target_view: "pending" as const,
      priority: "primary" as const,
    };
  }

  if (input.movementCount === 0) {
    return {
      label: "Registrar primer movimiento",
      description: "Empieza con un gasto o ingreso, sin configurar una cuenta.",
      target_view: "movements" as const,
      priority: "primary" as const,
    };
  }

  if (!input.hasMoneySummary) {
    return {
      label: "Crear primera cuenta",
      description: "Activa dinero libre y saldos sin cambiar tu historial.",
      target_view: "money" as const,
      priority: "primary" as const,
    };
  }

  return null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function getRecordString(
  record: Record<string, unknown>,
  key: string
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function compareCommitments(
  left: UpcomingCommitmentSummary,
  right: UpcomingCommitmentSummary
): number {
  return left.due_at.localeCompare(right.due_at);
}
