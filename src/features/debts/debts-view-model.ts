import type { DebtStatus, InstallmentStatus } from "@/shared/types/domain";
import type {
  DebtDetailViewModel,
  DebtDetailWithPayments,
  DebtInstallmentPaymentTarget,
  DebtSummary,
  DebtViewItem,
  DebtWithPerson,
} from "./debts-types";

export const debtDirectionLabels = {
  i_owe: "Yo debo",
  they_owe_me: "Me deben",
} as const;

export const debtKindLabels = {
  personal: "Personal",
  bank_loan: "Prestamo",
  credit_card: "Tarjeta",
  installment_purchase: "Compra en cuotas",
  service_or_bill: "Servicio o recibo",
  other: "Otro",
} as const;

export const debtStatusLabels: Record<DebtStatus, string> = {
  draft: "Borrador",
  active: "Activa",
  due_soon: "Pronto",
  overdue: "Vencida",
  paid: "Pagada",
  cancelled: "Cancelada",
  archived: "Archivada",
};

export function summarizeDebts(debts: DebtWithPerson[]): DebtSummary {
  return debts.reduce<DebtSummary>(
    (summary, debt) => {
      if (debt.direction === "i_owe") {
        summary.total_i_owe += debt.current_balance;
      } else {
        summary.total_they_owe_me += debt.current_balance;
      }

      if (debt.status === "due_soon") summary.due_soon_count += 1;
      if (debt.status === "overdue") summary.overdue_count += 1;
      summary.active_count += 1;
      summary.net_position = summary.total_they_owe_me - summary.total_i_owe;
      return summary;
    },
    {
      total_i_owe: 0,
      total_they_owe_me: 0,
      net_position: 0,
      active_count: 0,
      due_soon_count: 0,
      overdue_count: 0,
    }
  );
}

export function toDebtViewItem(debt: DebtWithPerson): DebtViewItem {
  const paidAmount = Math.max(0, debt.principal_amount - debt.current_balance);
  const progress =
    debt.principal_amount > 0
      ? Math.min(100, Math.round((paidAmount / debt.principal_amount) * 100))
      : 0;

  return {
    id: debt.id,
    title: debt.name,
    person_label: debt.related_person?.display_name ?? null,
    direction: debt.direction,
    direction_label: debtDirectionLabels[debt.direction],
    kind_label: debtKindLabels[debt.kind],
    status: debt.status,
    status_label: debtStatusLabels[debt.status],
    status_tone: getDebtStatusTone(debt.status),
    principal_amount: debt.principal_amount,
    current_balance: debt.current_balance,
    paid_amount: paidAmount,
    currency: debt.currency,
    progress,
    next_date_label: getNextDateLabel(debt.next_payment_date ?? debt.due_date),
  };
}

export function toDebtDetailViewModel(
  debt: DebtDetailWithPayments,
  today = new Date()
): DebtDetailViewModel {
  const item = toDebtViewItem(debt);
  const installmentNumberById = new Map(
    debt.installments.map((installment) => [installment.id, installment.number])
  );
  const history = debt.payments
    .slice()
    .sort((left, right) => right.paid_at.localeCompare(left.paid_at))
    .map((payment) => {
      const movement = payment.movement;
      const linkedAccountId =
        movement?.account_origin_id ?? movement?.account_destination_id ?? null;
      const allocatedNumbers = payment.allocations
        .map((allocation) =>
          installmentNumberById.get(allocation.debt_installment_id)
        )
        .filter((number): number is number => number !== undefined);

      return {
        id: payment.id,
        movement_id: payment.movement_id,
        amount_label: formatDebtMoney(payment.amount, payment.currency),
        paid_at: payment.paid_at,
        paid_label: formatPaymentDate(payment.paid_at, today),
        type_label:
          debt.direction === "i_owe" ? "Pago de deuda" : "Devolucion recibida",
        source_label:
          payment.source === "dashboard_manual" ? "Dashboard" : payment.source,
        movement_label: movement
          ? linkedAccountId
            ? "Movimiento Core con cuenta"
            : "Movimiento Core sin cuenta"
          : "Sin movimiento vinculado",
        allocation_label: formatPaymentAllocationLabel(allocatedNumbers),
      };
    });
  const installments = debt.installments
    .slice()
    .sort((left, right) => left.number - right.number)
    .map((installment) => {
      const pendingAmount = Math.max(
        0,
        Number(installment.expected_amount) - Number(installment.paid_amount)
      );
      const status = getEffectiveInstallmentStatus(
        installment.status,
        installment.due_date,
        today
      );

      return {
        id: installment.id,
        number: installment.number,
        due_date: installment.due_date,
        due_label: formatDueDate(installment.due_date, today),
        expected_amount_label: formatDebtMoney(
          installment.expected_amount,
          debt.currency
        ),
        paid_amount_label: formatDebtMoney(installment.paid_amount, debt.currency),
        pending_amount_label: formatDebtMoney(pendingAmount, debt.currency),
        status_label: installmentStatusLabels[status],
        status_tone: getInstallmentStatusTone(status),
        movement_label:
          installment.allocations.length > 0
          ? installment.allocations.length === 1
            ? "1 abono vinculado"
            : `${installment.allocations.length} abonos vinculados`
          : installment.movement_id
          ? "Pago vinculado"
          : "Sin pago vinculado",
        allocation_count: installment.allocations.length,
      };
    });
  const scheduleExpectedAmount = roundMoney(
    debt.installments.reduce(
      (sum, installment) => sum + Number(installment.expected_amount),
      0
    )
  );
  const schedulePaidAmount = roundMoney(
    debt.installments.reduce(
      (sum, installment) => sum + Number(installment.paid_amount),
      0
    )
  );
  const schedulePendingAmount = roundMoney(
    debt.installments.reduce(
      (sum, installment) =>
        sum +
        Math.max(
          0,
          Number(installment.expected_amount) - Number(installment.paid_amount)
        ),
      0
    )
  );
  const scheduleBalanceGap = roundMoney(
    Number(debt.current_balance) - schedulePendingAmount
  );

  return {
    ...item,
    opened_label: formatDate(debt.opened_at),
    due_label: debt.due_date ? formatDate(debt.due_date) : null,
    installment_label: buildInstallmentLabel(debt),
    schedule_expected_amount: scheduleExpectedAmount,
    schedule_paid_amount: schedulePaidAmount,
    schedule_pending_amount: schedulePendingAmount,
    schedule_balance_gap: scheduleBalanceGap,
    schedule_warning:
      debt.installments.length > 0 && Math.abs(scheduleBalanceGap) > 0.01
        ? "El saldo pendiente actual es " +
          formatDebtMoney(debt.current_balance, debt.currency) +
          ", pero el calendario registra " +
          formatDebtMoney(schedulePendingAmount, debt.currency) +
          " pendiente. Los mostramos por separado para no asumir que son equivalentes."
        : null,
    last_payment_label: debt.last_payment_at
      ? formatPaymentDate(debt.last_payment_at, today)
      : null,
    history,
    installments,
  };
}

export function resolveDebtInstallmentPaymentTarget(
  debt: DebtDetailWithPayments,
  requestedInstallmentId?: string | null
): DebtInstallmentPaymentTarget | null {
  const nextOpen = debt.installments
    .filter(
      (installment) =>
        ["pending", "due_soon", "overdue"].includes(installment.status) &&
        Number(installment.paid_amount) < Number(installment.expected_amount)
    )
    .sort((left, right) => {
      const dueComparison = left.due_date.localeCompare(right.due_date);
      return dueComparison !== 0 ? dueComparison : left.number - right.number;
    })[0];

  if (!nextOpen) return null;
  if (requestedInstallmentId && nextOpen.id !== requestedInstallmentId) {
    return null;
  }

  return {
    installment_id: nextOpen.id,
    installment_number: nextOpen.number,
    amount: Math.max(
      0,
      roundMoney(
        Number(nextOpen.expected_amount) - Number(nextOpen.paid_amount)
      )
    ),
  };
}

function formatPaymentAllocationLabel(installmentNumbers: number[]): string {
  if (installmentNumbers.length === 0) return "Sin asignacion de cuota";
  if (installmentNumbers.length === 1) {
    return `Aplicado a cuota ${installmentNumbers[0]}`;
  }

  return `Aplicado a cuotas ${installmentNumbers.join(", ")}`;
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function formatDebtMoney(value: number, currency: "PEN" | "USD" = "PEN") {
  const formatter = new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  });

  return formatter.format(value).replace("PEN", "S/");
}

function buildInstallmentLabel(debt: DebtWithPerson): string | null {
  if (!debt.installment_count && !debt.installment_amount) return null;

  const parts: string[] = [];
  if (debt.installment_count) parts.push(`${debt.installment_count} cuotas`);
  if (debt.installment_amount) {
    parts.push(formatDebtMoney(debt.installment_amount, debt.currency));
  }
  return parts.join(" de ");
}

function getDebtStatusTone(
  status: DebtStatus
): "neutral" | "success" | "warning" | "error" | "info" | "debt" {
  if (status === "paid") return "success";
  if (status === "due_soon") return "warning";
  if (status === "overdue") return "error";
  if (status === "draft") return "info";
  return "debt";
}

const installmentStatusLabels: Record<InstallmentStatus, string> = {
  pending: "Pendiente",
  due_soon: "Por vencer",
  overdue: "Vencida",
  paid: "Pagada",
  rescheduled: "Reprogramada",
  skipped: "Saltada",
};

function getInstallmentStatusTone(
  status: InstallmentStatus
): "neutral" | "success" | "warning" | "error" | "info" | "debt" {
  if (status === "paid") return "success";
  if (status === "due_soon") return "warning";
  if (status === "overdue") return "error";
  if (status === "rescheduled") return "info";
  return "neutral";
}

function getEffectiveInstallmentStatus(
  status: InstallmentStatus,
  dueDate: string,
  today: Date
): InstallmentStatus {
  if (status !== "pending") return status;

  const date = new Date(`${dueDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return status;

  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - current.getTime()) / 86_400_000);

  if (diffDays < 0) return "overdue";
  if (diffDays <= 3) return "due_soon";
  return status;
}

function getNextDateLabel(value: string | null): string | null {
  if (!value) return null;

  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - today.getTime()) / 86_400_000);

  if (diffDays === 0) return "Vence hoy";
  if (diffDays === 1) return "Vence manana";
  if (diffDays > 1 && diffDays <= 7) return `Vence en ${diffDays} dias`;
  if (diffDays < 0) return `Hace ${Math.abs(diffDays)} dias`;

  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatPaymentDate(value: string, today: Date): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha registrada";

  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  const paidDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.round((current.getTime() - paidDay.getTime()) / 86_400_000);

  if (diffDays === 0) return "Hoy";
  if (diffDays === 1) return "Ayer";

  return formatDate(value);
}

function formatDate(value: string): string {
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Fecha por revisar";

  return date.toLocaleDateString("es-PE", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDueDate(value: string, today: Date): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "Fecha por revisar";

  const current = new Date(today);
  current.setHours(0, 0, 0, 0);
  const diffDays = Math.round((date.getTime() - current.getTime()) / 86_400_000);

  if (diffDays === 0) return "Vence hoy";
  if (diffDays === 1) return "Vence manana";
  if (diffDays > 1 && diffDays <= 7) return `Vence en ${diffDays} dias`;
  if (diffDays < 0) return `Hace ${Math.abs(diffDays)} dias`;

  return formatDate(value);
}
