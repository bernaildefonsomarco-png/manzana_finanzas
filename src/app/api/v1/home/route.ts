import type { SupabaseClient } from "@supabase/supabase-js";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import {
  calculateMoneyLayersForCurrency,
  COMMITMENT_HORIZON_DAYS,
} from "@/core/finance/money-layers";
import { composeHome, type Settled, type FreeMoneyComposition, type PeriodTotal, type ProjectionSummary } from "@/core/home/home-composer";
import { getActiveAccounts, getActiveBoxes } from "@/data/repositories/accounts.repository";
import { listBudgetsWithProgress } from "@/data/repositories/budgets.repository";
import { listDebtInstallmentCommitments } from "@/data/repositories/debts.repository";
import { getHomeHiddenBlocks } from "@/data/repositories/home.repository";
import {
  listDashboardInsights,
  recordDashboardInsightsDisplayed,
} from "@/data/repositories/insights.repository";
import { listPendingItems } from "@/data/repositories/pending.repository";
import { getProjectionSnapshot } from "@/data/repositories/projections.repository";
import { listUpcomingCommitments } from "@/data/repositories/recurring.repository";
import { listReminders } from "@/data/repositories/reminders.repository";
import { getReportPeriod } from "@/data/repositories/reports.repository";
import { createServiceClient } from "@/data/supabase/server";
import type { Database } from "@/data/supabase/types";
import { isoDateInLima } from "@/shared/dates/lima";
import { sortMovementsByRegistrationRecency } from "@/features/movements/movement-sort";
import type { Movement } from "@/shared/types/domain";

export const dynamic = "force-dynamic";

type Client = SupabaseClient<Database>;

function settle<T>(result: PromiseSettledResult<T>): Settled<T> {
  return result.status === "fulfilled" ? { ok: true, value: result.value } : { ok: false };
}

// `39` §10: `GET /home` compone las nueve fuentes en una sola llamada, en
// paralelo, y cada una puede fallar sola (`RUL-HOME-09`). Colección sin
// recurso identificable: aislamiento se prueba con 200 y datos exclusivos
// del autenticado (`WEB-D230`), igual que `GET /reminders`.
export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const now = new Date();
    const today = isoDateInLima(now);
    const monthValue = today.slice(0, 7);
    const monthFrom = `${monthValue}-01`;
    const lastDay = new Date(Date.UTC(Number(monthValue.slice(0, 4)), Number(monthValue.slice(5, 7)), 0)).getUTCDate();
    const monthTo = `${monthValue}-${String(lastDay).padStart(2, "0")}`;

    const [
      accounts,
      boxes,
      recurring,
      debtCommitments,
      pendingItems,
      budgets,
      projectionSnapshot,
      reportPeriod,
      insights,
      reminders,
      recentMovements,
      confirmedMovementsCount,
      hiddenBlocks,
    ] = await Promise.allSettled([
      getActiveAccounts(auth.client, auth.userId),
      getActiveBoxes(auth.client, auth.userId),
      listUpcomingCommitments(auth.client, auth.userId, COMMITMENT_HORIZON_DAYS, now),
      listDebtInstallmentCommitments(auth.client, auth.userId, COMMITMENT_HORIZON_DAYS, now),
      listPendingItems(auth.client, auth.userId, { limit: 30 }),
      listBudgetsWithProgress(auth.client, auth.userId, { date: today, periodKind: "mensual" }),
      getProjectionSnapshot(auth.client, auth.userId, now),
      getReportPeriod(auth.client, auth.userId, { from: monthFrom, to: monthTo }),
      listDashboardInsights(auth.client, auth.userId, { limit: 1, now }),
      listReminders(auth.client, auth.userId, { estado: "abiertos" }),
      listRecentMovements(auth.client, auth.userId),
      countConfirmedMovements(auth.client, auth.userId),
      getHomeHiddenBlocks(auth.client, auth.userId),
    ]);

    // Compromisos próximos: se combinan recurrentes y cuotas de deuda antes
    // de calcular capas de dinero, igual que `/api/v1/money` (`RUL-HOME-02`).
    const commitmentsSettled: Settled<Array<{ id: string; amount: number; linked_box_id: string | null; due_at: string; currency: "PEN" | "USD"; title: string; kind: "recurring" | "debt" }>> =
      recurring.status === "fulfilled" && debtCommitments.status === "fulfilled"
        ? { ok: true, value: [...recurring.value, ...debtCommitments.value] }
        : { ok: false };

    const freeMoney: Settled<FreeMoneyComposition> =
      accounts.status === "fulfilled" && boxes.status === "fulfilled" && commitmentsSettled.ok
        ? buildFreeMoney(accounts.value, boxes.value, commitmentsSettled.value)
        : { ok: false };

    const projection: Settled<ProjectionSummary | null> =
      projectionSnapshot.status === "fulfilled"
        ? { ok: true, value: toProjectionSummary(projectionSnapshot.value) }
        : { ok: false };

    const periodTotal: Settled<PeriodTotal | null> =
      reportPeriod.status === "fulfilled"
        ? {
            ok: true,
            value:
              reportPeriod.value.gastoMovementCount + reportPeriod.value.ingresoMovementCount > 0
                ? { gasto_total: reportPeriod.value.gastoTotal, ingreso_total: reportPeriod.value.ingresoTotal }
                : null,
          }
        : { ok: false };

    const insight = insights.status === "fulfilled" ? { ok: true as const, value: insights.value[0] ?? null } : { ok: false as const };
    const pending = pendingItems.status === "fulfilled" ? { ok: true as const, value: buildPendingSummary(pendingItems.value) } : { ok: false as const };

    const composition = composeHome({
      confirmedMovementsCount: confirmedMovementsCount.status === "fulfilled" ? confirmedMovementsCount.value : 0,
      hiddenBlocks: new Set(hiddenBlocks.status === "fulfilled" ? hiddenBlocks.value : []),
      freeMoney,
      reminders: settle(reminders),
      pending,
      budgets: settle(budgets),
      projection,
      periodTotal,
      upcoming: commitmentsSettled,
      insight,
      movements: recentMovements.status === "fulfilled" ? { ok: true, value: recentMovements.value } : { ok: false },
    });

    if (insights.status === "fulfilled" && insights.value.length > 0) {
      await recordDashboardInsightsDisplayed(
        createServiceClient(),
        auth.userId,
        insights.value.map((row) => row.id),
        { now, traceId: trace_id },
      );
    }

    return okJson(composition, meta, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

function buildFreeMoney(
  accounts: Awaited<ReturnType<typeof getActiveAccounts>>,
  boxes: Awaited<ReturnType<typeof getActiveBoxes>>,
  commitments: Array<{ id: string; amount: number; linked_box_id: string | null; due_at: string; currency: "PEN" | "USD" }>,
): Settled<FreeMoneyComposition> {
  if (accounts.length === 0) return { ok: true, value: { has_accounts: false } };

  const layers = calculateMoneyLayersForCurrency(
    "PEN",
    accounts.map((account) => ({ id: account.id, current_balance: Number(account.current_balance), currency: account.currency })),
    boxes.map((box) => ({ id: box.id, account_id: box.account_id, current_balance: Number(box.current_balance) })),
    commitments.map((commitment) => ({ ...commitment, id: commitment.id })),
  );

  return {
    ok: true,
    value: {
      has_accounts: true,
      total_balance: layers.total_balance,
      separated_balance: layers.separated_in_boxes,
      free_balance: layers.operational_free_money,
      account_count: accounts.filter((account) => account.currency === "PEN").length,
      box_count: boxes.length,
    },
  };
}

function toProjectionSummary(
  snapshot: Awaited<ReturnType<typeof getProjectionSnapshot>>,
): ProjectionSummary | null {
  if (!snapshot.has_pen_accounts || !snapshot.projection.sufficient_data) return null;
  return {
    free_money: snapshot.projection.free_money_cents / 100,
    projected_close: snapshot.projection.projection_cents !== null ? snapshot.projection.projection_cents / 100 : null,
    currency: "PEN",
  };
}

function buildPendingSummary(pendingItems: Awaited<ReturnType<typeof listPendingItems>>) {
  return {
    active_count: pendingItems.length,
    needs_completion_count: pendingItems.filter((item) => {
      const summary = item.normalized_summary as { amount?: unknown; category_id?: unknown };
      return typeof summary.amount !== "number" || !summary.category_id;
    }).length,
    high_risk_count: pendingItems.filter((item) => item.risk_level === "high" || item.risk_level === "sensitive").length,
  };
}

async function listRecentMovements(client: Client, userId: string): Promise<Movement[]> {
  const { data, error } = await client
    .from("movements")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .order("occurred_at", { ascending: false })
    .limit(6);
  if (error) throw error;
  return sortMovementsByRegistrationRecency((data ?? []) as Movement[]);
}

async function countConfirmedMovements(client: Client, userId: string): Promise<number> {
  const { count, error } = await client
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("status", "confirmed")
    .is("deleted_at", null);
  if (error) throw error;
  return count ?? 0;
}
