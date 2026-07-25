import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  DEBT_DUE_SOON_DAYS,
} from "@/core/debts/debt-lifecycle";
import {
  refreshDebtInstallmentLifecycle,
  type DebtLifecycleRefreshResult,
} from "@/data/repositories/debts.repository";
import {
  evaluateDashboardNudges,
  type DashboardNudgeEvaluationResult,
} from "@/data/repositories/nudges.repository";
import { getProfile } from "@/data/repositories/profiles.repository";
import type { Database } from "@/data/supabase/types";

type Client = SupabaseClient<Database>;

export type RefreshDebtLifecycleResult = {
  lifecycle: DebtLifecycleRefreshResult;
  nudges: DashboardNudgeEvaluationResult | null;
  timezone: string;
};

export async function refreshDebtLifecycle(
  client: Client,
  userId: string,
  options: {
    now?: Date;
    asOfDate?: string;
    dueSoonDays?: number;
    traceId?: string;
    evaluateNudges?: boolean;
  } = {}
): Promise<RefreshDebtLifecycleResult> {
  const now = options.now ?? new Date();
  const dueSoonDays = options.dueSoonDays ?? DEBT_DUE_SOON_DAYS;
  const traceId = options.traceId ?? randomUUID();
  const profile = await getProfile(client, userId);
  const timezone = profile?.timezone || "America/Lima";
  const asOfDate = options.asOfDate ?? localIsoDate(now, timezone);
  const lifecycle = await refreshDebtInstallmentLifecycle(client, {
    userId,
    asOfDate,
    dueSoonDays,
    traceId,
  });
  const nudges =
    options.evaluateNudges === false
      ? null
      : await evaluateDashboardNudges(client, userId, {
          now,
          horizonDays: dueSoonDays,
          traceId,
        });

  return {
    lifecycle,
    nudges,
    timezone,
  };
}

function localIsoDate(date: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}
