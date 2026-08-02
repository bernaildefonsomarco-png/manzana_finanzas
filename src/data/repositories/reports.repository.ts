import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import {
  computeReportPeriod,
  type ReportMovement,
  type ReportPeriodResult,
} from "@/core/reports/report-engine";

type Client = SupabaseClient<Database>;

async function loadPeriodMovements(
  client: Client,
  userId: string,
  from: string,
  to: string,
): Promise<ReportMovement[]> {
  const { data, error } = await client
    .from("movements")
    .select("id,type,status,amount,currency,category_id,deleted_at")
    .eq("user_id", userId)
    .gte("occurred_at", `${from}T00:00:00`)
    .lte("occurred_at", `${to}T23:59:59`);
  if (error) throw error;
  return (data ?? []) as ReportMovement[];
}

async function countUnconfirmedInPeriod(
  client: Client,
  userId: string,
  from: string,
  to: string,
): Promise<number> {
  const { count, error } = await client
    .from("movements")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .eq("status", "needs_review")
    .gte("occurred_at", `${from}T00:00:00`)
    .lte("occurred_at", `${to}T23:59:59`);
  if (error) throw error;
  return count ?? 0;
}

export async function getReportPeriod(
  client: Client,
  userId: string,
  input: { from: string; to: string },
): Promise<ReportPeriodResult> {
  const [movements, pendingUnconfirmedCount] = await Promise.all([
    loadPeriodMovements(client, userId, input.from, input.to),
    countUnconfirmedInPeriod(client, userId, input.from, input.to),
  ]);
  return computeReportPeriod({ movements, pendingUnconfirmedCount });
}
