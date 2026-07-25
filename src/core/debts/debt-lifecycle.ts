import type {
  DebtStatus,
  InstallmentStatus,
} from "@/shared/types/domain";

export const DEBT_DUE_SOON_DAYS = 3;

const openInstallmentStatuses = new Set<InstallmentStatus>([
  "pending",
  "due_soon",
  "overdue",
]);

const openDebtStatuses = new Set<DebtStatus>([
  "active",
  "due_soon",
  "overdue",
]);

export function deriveDebtInstallmentLifecycleStatus(input: {
  currentStatus: InstallmentStatus;
  dueDate: string;
  asOfDate: string;
  dueSoonDays?: number;
}): InstallmentStatus {
  if (!openInstallmentStatuses.has(input.currentStatus)) {
    return input.currentStatus;
  }

  const dueSoonDays = clampDueSoonDays(
    input.dueSoonDays ?? DEBT_DUE_SOON_DAYS
  );
  const daysUntilDue = daysBetweenIsoDates(input.asOfDate, input.dueDate);

  if (daysUntilDue < 0) return "overdue";
  if (daysUntilDue <= dueSoonDays) return "due_soon";
  return "pending";
}

export function deriveDebtLifecycleStatus(input: {
  currentStatus: DebtStatus;
  installmentStatuses: InstallmentStatus[];
}): DebtStatus {
  if (!openDebtStatuses.has(input.currentStatus)) {
    return input.currentStatus;
  }

  if (input.installmentStatuses.includes("overdue")) return "overdue";
  if (input.installmentStatuses.includes("due_soon")) return "due_soon";
  return "active";
}

function clampDueSoonDays(value: number): number {
  if (!Number.isFinite(value)) return DEBT_DUE_SOON_DAYS;
  return Math.min(14, Math.max(1, Math.trunc(value)));
}

function daysBetweenIsoDates(from: string, to: string): number {
  return Math.round((isoDateToUtcMs(to) - isoDateToUtcMs(from)) / 86_400_000);
}

function isoDateToUtcMs(value: string): number {
  const [year, month, day] = value.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
