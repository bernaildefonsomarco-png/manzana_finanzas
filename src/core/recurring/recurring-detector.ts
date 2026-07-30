import type {
  CategoryId,
  RecurringAmountVariability,
  RecurringCandidateStatus,
  RecurringFrequency,
} from "@/shared/types/domain";
import { CATEGORY_IDS } from "@/shared/types/domain";

type SupportedCurrency = "PEN" | "USD";

export type RecurringDetectorMovement = {
  id: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  occurred_at: string;
  description: string | null;
  merchant: string | null;
  category_id: string | null;
  debt_id: string | null;
  recurring_rule_id: string | null;
  recurring_occurrence_id: string | null;
  deleted_at: string | null;
};

export type RecurringCandidateEvidence = {
  detector_version: "recurring-detector-v1";
  source: "confirmed_movements";
  movement_ids: string[];
  movement_count: number;
  dates: string[];
  amounts: number[];
  sample_titles: string[];
  first_seen: string;
  last_seen: string;
  display_name: string;
  inferred_frequency: RecurringFrequency;
  inferred_amount: number;
  amount_variability: RecurringAmountVariability;
  amount_variation_ratio: number;
  next_expected_date: string;
  day_of_month: number | null;
  date_window_start_day: number | null;
  date_window_end_day: number | null;
  category_id: CategoryId | null;
  currency: SupportedCurrency;
  interval_days: number | null;
};

export type RecurringCandidateSuggestion = {
  merchant_key: string;
  category_id: CategoryId | null;
  confidence: number;
  status: RecurringCandidateStatus;
  evidence: RecurringCandidateEvidence;
};

type DetectRecurringCandidatesInput = {
  movements: RecurringDetectorMovement[];
  existingMerchantKeys?: string[];
  now?: Date;
};

type MovementSample = {
  id: string;
  date: Date;
  dateOnly: string;
  amount: number;
  currency: SupportedCurrency;
  title: string;
  category_id: CategoryId | null;
};

type CadenceInference = {
  frequency: RecurringFrequency;
  intervalDays: number | null;
  nextExpectedDate: string;
  dayOfMonth: number | null;
  dateWindowStartDay: number | null;
  dateWindowEndDay: number | null;
  score: number;
};

const categorySet = new Set<string>(CATEGORY_IDS);
const genericMerchantKeys = new Set([
  "compra",
  "consumo",
  "cuenta",
  "gasto",
  "online",
  "otros",
  "pago",
  "servicio",
  "servicios",
  "tarjeta",
]);

export function detectRecurringCandidates({
  movements,
  existingMerchantKeys = [],
  now = new Date(),
}: DetectRecurringCandidatesInput): RecurringCandidateSuggestion[] {
  const existingKeys = new Set(
    existingMerchantKeys
      .map((key) => normalizeRecurringMerchantKey(key))
      .filter((key): key is string => Boolean(key))
  );
  const groups = new Map<string, MovementSample[]>();

  for (const movement of movements) {
    if (!isDetectableMovement(movement)) continue;

    const sourceTitle = movement.merchant?.trim() || movement.description?.trim();
    const merchantKey = normalizeRecurringMerchantKey(sourceTitle);
    if (!merchantKey || existingKeys.has(merchantKey)) continue;

    const date = parseDateOnly(movement.occurred_at);
    const currency = asSupportedCurrency(movement.currency);
    if (!date || !currency) continue;

    const current = groups.get(merchantKey) ?? [];
    current.push({
      id: movement.id,
      date,
      dateOnly: formatDateOnly(date),
      amount: roundMoney(Math.abs(Number(movement.amount))),
      currency,
      title: cleanDisplayTitle(sourceTitle ?? merchantKey),
      category_id: asCategoryId(movement.category_id),
    });
    groups.set(merchantKey, current);
  }

  return [...groups.entries()]
    .map(([merchantKey, samples]) => analyzeGroup(merchantKey, samples, now))
    .filter((candidate): candidate is RecurringCandidateSuggestion => candidate !== null)
    .sort((left, right) => right.confidence - left.confidence);
}

export function normalizeRecurringMerchantKey(
  value: string | null | undefined
): string | null {
  if (!value) return null;

  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bs\/|\$/g, " ")
    .replace(/\b(soles?|pen|usd|dolares?)\b/g, " ")
    .replace(/\b(pago|pagado|pague|pagar|compra|de|del|a|en|el|la|los|las|por|para)\b/g, " ")
    .replace(/\d+([.,]\d+)?/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");

  if (normalized.length < 3 || genericMerchantKeys.has(normalized)) return null;
  return normalized;
}

function analyzeGroup(
  merchantKey: string,
  samples: MovementSample[],
  now: Date
): RecurringCandidateSuggestion | null {
  const ordered = dedupeSameDay(samples)
    .filter((sample) => sample.amount > 0)
    .sort((left, right) => left.date.getTime() - right.date.getTime());

  if (ordered.length < 2) return null;
  if (new Set(ordered.map((sample) => sample.currency)).size > 1) return null;

  const cadence = inferCadence(ordered, now);
  if (!cadence) return null;

  const amounts = ordered.map((sample) => sample.amount);
  const inferredAmount = roundMoney(median(amounts));
  const amountVariationRatio = getAmountVariationRatio(amounts);
  const amountVariability = getAmountVariability(amountVariationRatio);
  const categoryId = mostFrequent(
    ordered
      .map((sample) => sample.category_id)
      .filter((category): category is CategoryId => category !== null)
  );
  const displayName = mostFrequent(ordered.map((sample) => sample.title)) ?? toTitleCase(merchantKey);
  const confidence = getConfidence({
    sampleCount: ordered.length,
    cadenceScore: cadence.score,
    amountVariationRatio,
    hasCategory: Boolean(categoryId),
  });
  const status: RecurringCandidateStatus =
    ordered.length >= 3 && confidence >= 0.75
      ? "ready_to_suggest"
      : "candidate";

  return {
    merchant_key: merchantKey,
    category_id: categoryId,
    confidence,
    status,
    evidence: {
      detector_version: "recurring-detector-v1",
      source: "confirmed_movements",
      movement_ids: ordered.map((sample) => sample.id).slice(-8),
      movement_count: ordered.length,
      dates: ordered.map((sample) => sample.dateOnly).slice(-8),
      amounts: amounts.slice(-8),
      sample_titles: [...new Set(ordered.map((sample) => sample.title))].slice(0, 5),
      first_seen: ordered[0].dateOnly,
      last_seen: ordered[ordered.length - 1].dateOnly,
      display_name: displayName,
      inferred_frequency: cadence.frequency,
      inferred_amount: inferredAmount,
      amount_variability: amountVariability,
      amount_variation_ratio: amountVariationRatio,
      next_expected_date: cadence.nextExpectedDate,
      day_of_month: cadence.dayOfMonth,
      date_window_start_day: cadence.dateWindowStartDay,
      date_window_end_day: cadence.dateWindowEndDay,
      category_id: categoryId,
      currency: ordered[0].currency,
      interval_days: cadence.intervalDays,
    },
  };
}

function isDetectableMovement(movement: RecurringDetectorMovement): boolean {
  if (movement.status !== "confirmed" || movement.deleted_at) return false;
  if (!["gasto", "pago_recurrente"].includes(movement.type)) return false;
  if (movement.debt_id || movement.category_id === "deudas") return false;
  if (movement.recurring_rule_id || movement.recurring_occurrence_id) return false;
  return Number.isFinite(Number(movement.amount)) && Number(movement.amount) > 0;
}

function inferCadence(
  samples: MovementSample[],
  now: Date
): CadenceInference | null {
  const dates = samples.map((sample) => sample.date);
  const gaps = dates.slice(1).map((date, index) => daysBetween(dates[index], date));
  const days = dates.map((date) => date.getUTCDate());
  const daySpread = Math.max(...days) - Math.min(...days);
  const targetDay = Math.round(median(days));

  if (gaps.length === 0) return null;

  if (gaps.every((gap) => gap >= 6 && gap <= 8)) {
    return buildCadence("weekly", dates[dates.length - 1], now, 7, null, null, null, 0.92);
  }

  if (gaps.every((gap) => gap >= 12 && gap <= 18)) {
    return buildCadence("biweekly", dates[dates.length - 1], now, 14, null, null, null, 0.88);
  }

  if (gaps.every((gap) => gap >= 25 && gap <= 35) && daySpread <= 10) {
    return buildCadence(
      "monthly",
      dates[dates.length - 1],
      now,
      null,
      targetDay,
      daySpread > 0 ? Math.min(...days) : null,
      daySpread > 0 ? Math.max(...days) : null,
      daySpread <= 4 ? 0.95 : 0.86
    );
  }

  return null;
}

function buildCadence(
  frequency: RecurringFrequency,
  lastDate: Date,
  now: Date,
  intervalDays: number | null,
  dayOfMonth: number | null,
  dateWindowStartDay: number | null,
  dateWindowEndDay: number | null,
  score: number
): CadenceInference {
  const today = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  );
  let next =
    frequency === "monthly"
      ? addMonthsUtc(lastDate, 1, dayOfMonth ?? lastDate.getUTCDate())
      : addDaysUtc(lastDate, intervalDays ?? 7);

  while (next.getTime() < today.getTime()) {
    next =
      frequency === "monthly"
        ? addMonthsUtc(next, 1, dayOfMonth ?? next.getUTCDate())
        : addDaysUtc(next, intervalDays ?? 7);
  }

  return {
    frequency,
    intervalDays,
    nextExpectedDate: formatDateOnly(next),
    dayOfMonth,
    dateWindowStartDay,
    dateWindowEndDay,
    score,
  };
}

function getConfidence(params: {
  sampleCount: number;
  cadenceScore: number;
  amountVariationRatio: number;
  hasCategory: boolean;
}): number {
  const sampleScore = params.sampleCount >= 3 ? 0.18 : 0.06;
  const amountScore =
    params.amountVariationRatio <= 0.02
      ? 0.08
      : params.amountVariationRatio <= 0.15
      ? 0.05
      : -0.08;
  const categoryScore = params.hasCategory ? 0.02 : 0;
  return roundRatio(
    Math.min(0.95, 0.55 + sampleScore + params.cadenceScore * 0.12 + amountScore + categoryScore)
  );
}

function getAmountVariationRatio(amounts: number[]): number {
  const min = Math.min(...amounts);
  const max = Math.max(...amounts);
  const center = median(amounts);
  if (center <= 0) return 1;
  return roundRatio((max - min) / center);
}

function getAmountVariability(
  variationRatio: number
): RecurringAmountVariability {
  if (variationRatio <= 0.02) return "fixed";
  if (variationRatio <= 0.15) return "estimated";
  return "variable";
}

function dedupeSameDay(samples: MovementSample[]): MovementSample[] {
  const byDate = new Map<string, MovementSample>();
  for (const sample of samples) {
    const current = byDate.get(sample.dateOnly);
    if (!current || sample.amount > current.amount) {
      byDate.set(sample.dateOnly, sample);
    }
  }
  return [...byDate.values()];
}

function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateOnly(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDaysUtc(date: Date, days: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days)
  );
}

function addMonthsUtc(date: Date, months: number, targetDay: number): Date {
  const firstOfTargetMonth = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)
  );
  const lastDay = new Date(
    Date.UTC(
      firstOfTargetMonth.getUTCFullYear(),
      firstOfTargetMonth.getUTCMonth() + 1,
      0
    )
  ).getUTCDate();

  return new Date(
    Date.UTC(
      firstOfTargetMonth.getUTCFullYear(),
      firstOfTargetMonth.getUTCMonth(),
      Math.min(Math.max(targetDay, 1), lastDay)
    )
  );
}

function daysBetween(left: Date, right: Date): number {
  return Math.round((right.getTime() - left.getTime()) / 86_400_000);
}

function median(values: number[]): number {
  const ordered = [...values].sort((left, right) => left - right);
  const middle = Math.floor(ordered.length / 2);
  if (ordered.length % 2 === 1) return ordered[middle];
  return (ordered[middle - 1] + ordered[middle]) / 2;
}

function mostFrequent<T extends string>(values: T[]): T | null {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? null;
}

function asCategoryId(value: string | null): CategoryId | null {
  return value && categorySet.has(value) ? (value as CategoryId) : null;
}

function asSupportedCurrency(value: string): SupportedCurrency | null {
  return value === "PEN" || value === "USD" ? value : null;
}

function cleanDisplayTitle(value: string): string {
  const cleaned = value
    .replace(/^\s*(pago|pagado|pague|pagar|compra)\s+(de|a|en)?\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || value.trim();
}

function toTitleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
