import type {
  DebtDirection,
  DebtKind,
  DebtStatus,
  InstallmentStatus,
} from "@/shared/types/domain";
import type {
  DebtDetailViewModel,
  DebtDetailWithPayments,
  DebtInstallmentPaymentTarget,
  DebtSummary,
  DebtViewItem,
  DebtWithPerson,
  InstallmentSchedulePreview,
} from "./debts-types";

const LIMA_TIMEZONE = "America/Lima";
const OPEN_DEBT_STATUSES = new Set<DebtStatus>([
  "active",
  "due_soon",
  "overdue",
]);
const OPEN_INSTALLMENT_STATUSES = new Set<InstallmentStatus>([
  "pending",
  "due_soon",
  "overdue",
]);

export const debtDirectionLabels: Record<DebtDirection, string> = {
  i_owe: "Debo",
  they_owe_me: "Me deben",
};

export const debtKindLabels: Record<DebtKind, string> = {
  personal: "Personal",
  bank_loan: "Préstamo bancario",
  credit_card: "Tarjeta como deuda simple",
  installment_purchase: "Compra en cuotas",
  service_or_bill: "Servicio o recibo",
  other: "Otra",
};

export const debtStatusLabels: Record<DebtStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  due_soon: "Por vencer",
  overdue: "Vencida",
  paid: "Pagada",
  cancelled: "Condonada",
  archived: "Archivada",
};

export function summarizeDebts(debts: DebtWithPerson[]): DebtSummary {
  return debts.reduce<DebtSummary>(
    (summary, debt) => {
      const open = OPEN_DEBT_STATUSES.has(debt.status);
      if (open && debt.direction === "i_owe") {
        const key =
          debt.currency === "USD" ? "total_i_owe_usd" : "total_i_owe";
        summary[key] = roundMoney(
          summary[key] + Number(debt.current_balance)
        );
        summary.active_i_owe += 1;
      }
      if (open && debt.direction === "they_owe_me") {
        const key =
          debt.currency === "USD"
            ? "total_they_owe_me_usd"
            : "total_they_owe_me";
        summary[key] = roundMoney(
          summary[key] + Number(debt.current_balance)
        );
        summary.active_they_owe_me += 1;
      }
      if (!open) summary.closed_count += 1;
      return summary;
    },
    {
      total_i_owe: 0,
      total_they_owe_me: 0,
      total_i_owe_usd: 0,
      total_they_owe_me_usd: 0,
      active_i_owe: 0,
      active_they_owe_me: 0,
      closed_count: 0,
    }
  );
}

export function splitDebtsByState(
  debts: DebtWithPerson[],
  direction: DebtDirection
): { open: DebtViewItem[]; closed: DebtViewItem[] } {
  const matching = debts.filter((debt) => debt.direction === direction);
  return {
    open: matching
      .filter((debt) => OPEN_DEBT_STATUSES.has(debt.status))
      .sort((left, right) => {
        const leftDate =
          left.next_payment_date ?? left.due_date ?? "9999-12-31";
        const rightDate =
          right.next_payment_date ?? right.due_date ?? "9999-12-31";
        const byDate = leftDate.localeCompare(rightDate);
        return byDate !== 0 ? byDate : left.id.localeCompare(right.id);
      })
      .map(toDebtViewItem),
    closed: matching
      .filter((debt) => !OPEN_DEBT_STATUSES.has(debt.status))
      .map(toDebtViewItem),
  };
}

export function toDebtViewItem(debt: DebtWithPerson): DebtViewItem {
  const forgivenBalance =
    debt.status === "cancelled" &&
    typeof debt.metadata?.forgiven_balance === "number"
      ? Number(debt.metadata.forgiven_balance)
      : 0;
  const paidAmount =
    debt.status === "cancelled"
      ? Math.max(0, Number(debt.principal_amount) - forgivenBalance)
      : Math.max(
          0,
          Number(debt.principal_amount) - Number(debt.current_balance)
        );
  const progress =
    Number(debt.principal_amount) > 0
      ? Math.min(
          100,
          Math.round((paidAmount / Number(debt.principal_amount)) * 100)
        )
      : 0;
  const linkedBox = debt.linked_box ?? null;

  return {
    id: debt.id,
    title: debt.name,
    person_label: debt.related_person?.display_name ?? null,
    direction: debt.direction,
    direction_label: debtDirectionLabels[debt.direction],
    kind_label: debtKindLabels[debt.kind],
    status: debt.status,
    status_label: debtStatusLabels[debt.status],
    status_tone: debtStatusTone(debt.status),
    principal_amount: Number(debt.principal_amount),
    current_balance: Number(debt.current_balance),
    paid_amount: paidAmount,
    currency: debt.currency,
    progress,
    next_date_label: formatRelativeDate(
      debt.next_payment_date ?? debt.due_date
    ),
    linked_box_name: linkedBox?.name ?? null,
    linked_box_balance:
      linkedBox === null ? null : Number(linkedBox.current_balance),
    is_closed: !OPEN_DEBT_STATUSES.has(debt.status),
  };
}

export function toDebtDetailViewModel(
  debt: DebtDetailWithPayments,
  now = new Date()
): DebtDetailViewModel {
  const base = toDebtViewItem(debt);
  const numberById = new Map(
    debt.installments.map((installment) => [
      installment.id,
      installment.number,
    ])
  );
  const installments = [...debt.installments]
    .sort((left, right) => left.number - right.number)
    .map((installment) => {
      const expected = Number(installment.expected_amount);
      const paid = Number(installment.paid_amount);
      const pending = Math.max(0, roundMoney(expected - paid));
      return {
        id: installment.id,
        number: installment.number,
        due_date: installment.due_date,
        due_label:
          formatRelativeDate(installment.due_date, now) ?? "Fecha por revisar",
        expected_amount: expected,
        paid_amount: paid,
        pending_amount: pending,
        expected_amount_label: formatDebtMoney(expected, debt.currency),
        paid_amount_label: formatDebtMoney(paid, debt.currency),
        pending_amount_label: formatDebtMoney(pending, debt.currency),
        status: installment.status,
        status_label: installmentStatusLabels[installment.status],
        status_tone: installmentStatusTone(installment.status),
        allocation_count: installment.allocations.length,
        is_open:
          OPEN_INSTALLMENT_STATUSES.has(installment.status) && pending > 0,
      };
    });
  const schedulePending = roundMoney(
    installments
      .filter((installment) => installment.is_open)
      .reduce((sum, installment) => sum + installment.pending_amount, 0)
  );
  const scheduleGap = roundMoney(
    Number(debt.current_balance) - schedulePending
  );
  const history = [...debt.payments]
    .sort((left, right) => right.paid_at.localeCompare(left.paid_at))
    .map((payment) => {
      const isReversed = Boolean(payment.reversed_at);
      return {
        id: payment.id,
        movement_id: payment.movement_id,
        amount_label: formatDebtMoney(payment.amount, payment.currency),
        paid_label: formatDateTime(payment.paid_at, now),
        type_label: isReversed
          ? "Pago revertido"
          : debt.direction === "i_owe"
            ? "Pago de deuda"
            : "Devolución recibida",
        source_label:
          payment.source === "dashboard_manual" ? "Dashboard" : payment.source,
        movement_label: payment.movement
          ? payment.movement.account_origin_id ||
            payment.movement.account_destination_id
            ? "Movimiento Core con cuenta"
            : "Movimiento Core sin cuenta"
          : "Sin movimiento vinculado",
        allocation_lines: [...payment.allocations]
          .sort((left, right) => left.allocation_order - right.allocation_order)
          .map((allocation) => {
            const number = numberById.get(allocation.debt_installment_id);
            return `${formatDebtMoney(
              Number(allocation.allocated_amount),
              debt.currency
            )} a ${number ? `cuota ${number}` : "cuota registrada"}`;
          }),
        is_reversed: isReversed,
        reversal_reason: payment.reversal_reason ?? null,
      };
    });

  return {
    ...base,
    opened_label: formatDate(debt.opened_at),
    due_label: debt.due_date ? formatDate(debt.due_date) : null,
    schedule_pending_amount: schedulePending,
    schedule_balance_gap: scheduleGap,
    schedule_warning:
      installments.length > 0 && Math.abs(scheduleGap) > 0.01
        ? `El saldo actual es ${formatDebtMoney(
            debt.current_balance,
            debt.currency
          )}, mientras las cuotas abiertas suman ${formatDebtMoney(
            schedulePending,
            debt.currency
          )}. Los mostramos separados y no asumimos que son equivalentes.`
        : null,
    last_payment_label: debt.last_payment_at
      ? formatDateTime(debt.last_payment_at, now)
      : null,
    history,
    installments,
  };
}

export function resolveDebtInstallmentPaymentTarget(
  debt: DebtDetailWithPayments,
  requestedInstallmentId?: string | null
): DebtInstallmentPaymentTarget | null {
  const next = [...debt.installments]
    .filter(
      (installment) =>
        OPEN_INSTALLMENT_STATUSES.has(installment.status) &&
        Number(installment.paid_amount) < Number(installment.expected_amount)
    )
    .sort((left, right) => {
      const byDate = left.due_date.localeCompare(right.due_date);
      return byDate !== 0 ? byDate : left.number - right.number;
    })[0];
  if (!next || (requestedInstallmentId && requestedInstallmentId !== next.id)) {
    return null;
  }
  return {
    installment_id: next.id,
    installment_number: next.number,
    amount: roundMoney(
      Number(next.expected_amount) - Number(next.paid_amount)
    ),
  };
}

export function buildInstallmentSchedulePreview(input: {
  principalAmount: number;
  installmentCount: number;
  installmentAmount: number | null;
  firstDueDate: string;
}): InstallmentSchedulePreview[] {
  const count = Math.trunc(input.installmentCount);
  if (
    count < 1 ||
    count > 360 ||
    input.principalAmount <= 0 ||
    !isIsoDate(input.firstDueDate)
  ) {
    return [];
  }
  const base =
    input.installmentAmount && input.installmentAmount > 0
      ? roundMoney(input.installmentAmount)
      : roundMoney(input.principalAmount / count);
  return Array.from({ length: count }, (_, index) => {
    const number = index + 1;
    return {
      number,
      due_date: addMonthsIsoDate(input.firstDueDate, index),
      amount:
        number === count && !input.installmentAmount
          ? roundMoney(input.principalAmount - base * (count - 1))
          : base,
    };
  });
}

export function formatDebtMoney(
  value: number,
  currency: "PEN" | "USD" = "PEN"
): string {
  return new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  })
    .format(value)
    .replace(/^S\/\s*/, "S/")
    .replace(/^PEN\s*/, "S/");
}

export function limaTodayIso(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: LIMA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function debtStatusTone(
  status: DebtStatus
): DebtViewItem["status_tone"] {
  if (status === "paid") return "success";
  if (status === "due_soon") return "warning";
  if (status === "overdue") return "error";
  if (status === "cancelled") return "info";
  if (status === "draft") return "neutral";
  return "debt";
}

const installmentStatusLabels: Record<InstallmentStatus, string> = {
  pending: "Pendiente",
  due_soon: "Por vencer",
  overdue: "Vencida",
  paid: "Pagada",
  rescheduled: "Reprogramada",
  skipped: "Omitida",
};

function installmentStatusTone(
  status: InstallmentStatus
): DebtViewItem["status_tone"] {
  if (status === "paid") return "success";
  if (status === "due_soon") return "warning";
  if (status === "overdue") return "error";
  if (status === "rescheduled") return "info";
  return "neutral";
}

function formatRelativeDate(value: string | null, now = new Date()): string | null {
  if (!value || !isIsoDate(value)) return null;
  const today = limaTodayIso(now);
  const diff = daysBetween(today, value);
  if (diff === 0) return "Vence hoy";
  if (diff === 1) return "Vence mañana";
  if (diff > 1 && diff <= 7) return `Vence en ${diff} días`;
  if (diff < 0) return `Venció hace ${Math.abs(diff)} días`;
  return formatDate(value);
}

function formatDate(value: string): string {
  const date = value.includes("T")
    ? new Date(value)
    : new Date(`${value}T12:00:00-05:00`);
  if (Number.isNaN(date.getTime())) return "Fecha por revisar";
  return new Intl.DateTimeFormat("es-PE", {
    timeZone: LIMA_TIMEZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value: string, now: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha registrada";
  const paidDate = limaTodayIso(date);
  const today = limaTodayIso(now);
  const diff = daysBetween(paidDate, today);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  return formatDate(value);
}

function addMonthsIsoDate(value: string, monthsToAdd: number): string {
  const [year, month, day] = value.split("-").map(Number);
  const target = new Date(Date.UTC(year!, month! - 1 + monthsToAdd, 1));
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  return `${target.getUTCFullYear()}-${String(
    target.getUTCMonth() + 1
  ).padStart(2, "0")}-${String(Math.min(day!, lastDay)).padStart(2, "0")}`;
}

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00.000Z`);
  const toMs = Date.parse(`${to}T00:00:00.000Z`);
  return Math.round((toMs - fromMs) / 86_400_000);
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
