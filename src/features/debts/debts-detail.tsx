"use client";

import type { ReactNode } from "react";
import {
  CalendarDays,
  HandCoins,
  History,
  Landmark,
  Pencil,
  RefreshCw,
  RotateCcw,
} from "lucide-react";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { DiscreetValue } from "@/ui/primitivas/money";
import { MoneyWithProvenance } from "@/ui/domain/money-with-provenance";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/ui/primitivas/sheet";
import { buildDebtProvenance } from "./debt-provenance";
import type {
  DebtDetailViewModel,
  DebtDetailWithPayments,
  DebtInstallmentViewItem,
} from "./debts-types";
import {
  formatDebtMoney,
  toDebtDetailViewModel,
} from "./debts-view-model";

export function DebtDetailSheet({
  debt,
  loading,
  error,
  onClose,
  onRetry,
  onEdit,
  onPayment,
  onCloseDebt,
  onReopen,
  onReschedule,
  onSkip,
}: {
  debt: DebtDetailWithPayments;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onEdit: () => void;
  onPayment: () => void;
  onCloseDebt: () => void;
  onReopen: () => void;
  onReschedule: (installment: DebtInstallmentViewItem) => void;
  onSkip: (installment: DebtInstallmentViewItem) => void;
}) {
  const detail = toDebtDetailViewModel(debt);
  const canPay =
    detail.current_balance > 0 &&
    ["active", "due_soon", "overdue"].includes(detail.status);

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>
            <DiscreetValue>{detail.title}</DiscreetValue>
          </SheetTitle>
          <SheetDescription>
            Saldo, cuotas, caja e historial conciliado.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 pb-8">
          {loading ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface p-3 text-sm text-text-secondary">
              <RefreshCw className="h-4 w-4 animate-spin" />
              Actualizando detalle
            </div>
          ) : null}
          {error ? (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 rounded-lg border border-error-subtle bg-error-subtle/50 p-3 text-sm text-error"
            >
              <span>{error}</span>
              <Button variant="secondary" size="sm" onClick={onRetry}>
                Reintentar
              </Button>
            </div>
          ) : null}

          <section className="rounded-xl border border-border bg-bg-primary p-5">
            <div className="flex flex-wrap gap-2">
              <Badge tone={detail.status_tone}>{detail.status_label}</Badge>
              <Badge tone={detail.direction === "i_owe" ? "debt" : "success"}>
                {detail.direction_label}
              </Badge>
              <Badge tone="neutral">{detail.kind_label}</Badge>
            </div>
            <p className="mt-4 text-sm text-text-muted">Saldo pendiente</p>
            <p className="mt-1 font-heading text-3xl font-semibold text-text">
              <MoneyWithProvenance
                ariaLabel={`Ver de dónde sale este saldo pendiente de ${formatDebtMoney(detail.current_balance, detail.currency)}`}
                loadProvenance={async () => buildDebtProvenance(debt)}
              >
                <DiscreetValue>
                  {formatDebtMoney(detail.current_balance, detail.currency)}
                </DiscreetValue>
              </MoneyWithProvenance>
            </p>
            <p className="mt-2 text-sm text-text-secondary">
              Pagado confirmado:{" "}
              <DiscreetValue>
                {formatDebtMoney(detail.paid_amount, detail.currency)}
              </DiscreetValue>{" "}
              de{" "}
              <DiscreetValue>
                {formatDebtMoney(detail.principal_amount, detail.currency)}
              </DiscreetValue>
            </p>
            <div className="mt-4">
              <div className="flex justify-between text-xs text-text-muted">
                <span>Progreso pagado</span>
                <span>{detail.progress}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-progress-track">
                <div
                  className="h-full rounded-full bg-progress-fill"
                  style={{ width: `${detail.progress}%` }}
                />
              </div>
            </div>
          </section>

          <section className="grid gap-2 rounded-xl border border-border p-4 text-sm">
            <InfoRow
              label="Persona o entidad"
              value={
                <DiscreetValue>
                  {detail.person_label ?? "Sin persona vinculada"}
                </DiscreetValue>
              }
            />
            <InfoRow label="Apertura" value={detail.opened_label} />
            <InfoRow label="Vencimiento" value={detail.due_label ?? "Sin fecha"} />
            <InfoRow
              label="Último pago"
              value={detail.last_payment_label ?? "Sin pagos"}
            />
          </section>

          {detail.linked_box_name ? (
            <section className="rounded-xl border border-brand-subtle bg-brand-subtle/35 p-4">
              <p className="flex items-center gap-2 font-medium text-text">
                <Landmark className="h-4 w-4" />
                Caja vinculada
              </p>
              <p className="mt-2 text-sm text-text-secondary">
                <DiscreetValue>{detail.linked_box_name}</DiscreetValue> tiene{" "}
                <DiscreetValue>
                  {formatDebtMoney(detail.linked_box_balance ?? 0)}
                </DiscreetValue>{" "}
                reservado. Esa cobertura evita doble descuento, pero no se
                consume automáticamente al pagar.
              </p>
            </section>
          ) : null}

          {debt.interest_notes ? (
            <section className="rounded-xl border border-border p-4">
              <h3 className="font-medium text-text">Notas del acuerdo</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm text-text-secondary">
                {debt.interest_notes}
              </p>
              <p className="mt-2 text-xs text-text-muted">
                Es texto recordatorio; Manzana no calcula interés ni mora.
              </p>
            </section>
          ) : null}

          {detail.schedule_warning ? (
            <div className="rounded-lg border border-warning-subtle bg-warning-subtle/45 p-3 text-sm text-text-secondary">
              <DiscreetValue>{detail.schedule_warning}</DiscreetValue>
            </div>
          ) : null}

          <div className="flex flex-wrap gap-2 border-y border-border py-4">
            <Button
              variant="secondary"
              icon={<HandCoins className="h-4 w-4" />}
              disabled={!canPay}
              onClick={onPayment}
            >
              {detail.direction === "i_owe"
                ? "Registrar pago"
                : "Registrar devolución"}
            </Button>
            <Button
              variant="secondary"
              icon={<Pencil className="h-4 w-4" />}
              disabled={detail.is_closed}
              onClick={onEdit}
            >
              Editar datos
            </Button>
            {!detail.is_closed ? (
              <Button variant="ghost" onClick={onCloseDebt}>
                Cerrar deuda
              </Button>
            ) : detail.status === "cancelled" ? (
              <Button
                variant="secondary"
                icon={<RotateCcw className="h-4 w-4" />}
                onClick={onReopen}
              >
                Reabrir condonada
              </Button>
            ) : (
              <span className="self-center text-sm text-text-muted">
                Una deuda pagada requiere un ajuste o deuda nueva para volver.
              </span>
            )}
          </div>

          <InstallmentSection
            detail={detail}
            onReschedule={onReschedule}
            onSkip={onSkip}
          />
          <HistorySection detail={detail} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

function InstallmentSection({
  detail,
  onReschedule,
  onSkip,
}: {
  detail: DebtDetailViewModel;
  onReschedule: (installment: DebtInstallmentViewItem) => void;
  onSkip: (installment: DebtInstallmentViewItem) => void;
}) {
  return (
    <section>
      <h3 className="flex items-center gap-2 font-heading font-semibold text-text">
        <CalendarDays className="h-4 w-4" />
        Cuotas
      </h3>
      {detail.installments.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-text-secondary">
          Esta deuda no tiene calendario. Los pagos siguen siendo válidos y no
          inventarán asignaciones.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">
              Calendario de cuotas de la deuda
            </caption>
            <thead className="bg-bg-surface text-xs text-text-muted">
              <tr>
                <th className="px-3 py-2">Cuota</th>
                <th className="px-3 py-2">Fecha</th>
                <th className="px-3 py-2">Estado</th>
                <th className="px-3 py-2">Pendiente</th>
                <th className="px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {detail.installments.map((installment) => (
                <tr key={installment.id}>
                  <td className="px-3 py-3 font-medium text-text">
                    {installment.number}
                  </td>
                  <td className="px-3 py-3 text-text-secondary">
                    {installment.due_label}
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={installment.status_tone}>
                      {installment.status_label}
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-text">
                    <DiscreetValue>
                      {installment.pending_amount_label}
                    </DiscreetValue>
                  </td>
                  <td className="px-3 py-3">
                    {installment.is_open ? (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onReschedule(installment)}
                        >
                          Reprogramar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onSkip(installment)}
                        >
                          Omitir
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-text-muted">
                        Estado terminal
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function HistorySection({ detail }: { detail: DebtDetailViewModel }) {
  return (
    <section>
      <h3 className="flex items-center gap-2 font-heading font-semibold text-text">
        <History className="h-4 w-4" />
        Historial y asignaciones
      </h3>
      {detail.history.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border p-4 text-sm text-text-secondary">
          Aún no hay pagos confirmados.
        </p>
      ) : (
        <ol className="mt-3 divide-y divide-border rounded-lg border border-border">
          {detail.history.map((payment) => (
            <li key={payment.id} className="p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Badge tone={payment.is_reversed ? "error" : "success"}>
                    {payment.type_label}
                  </Badge>
                  <p className="mt-2 text-sm text-text-secondary">
                    {payment.paid_label} · {payment.source_label}
                  </p>
                  <p className="mt-1 text-xs text-text-muted">
                    {payment.movement_label}
                  </p>
                  {payment.is_reversed ? (
                    <p className="mt-1 text-xs text-error">
                      No afecta el saldo.
                      {payment.reversal_reason
                        ? ` Motivo: ${payment.reversal_reason}`
                        : ""}
                    </p>
                  ) : null}
                </div>
                <p className="font-heading font-semibold text-text">
                  <DiscreetValue>{payment.amount_label}</DiscreetValue>
                </p>
              </div>
              {payment.allocation_lines.length > 0 ? (
                <ul className="mt-3 space-y-1 rounded-md bg-bg-surface p-3 text-sm text-text-secondary">
                  {payment.allocation_lines.map((line) => (
                    <li key={line}>
                      → <DiscreetValue>{line}</DiscreetValue>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-3 text-sm text-text-muted">
                  Sin asignaciones: deuda sin calendario abierto.
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: ReactNode;
}) {
  return (
    <div className="flex justify-between gap-4 border-b border-border pb-2 last:border-0 last:pb-0">
      <span className="text-text-muted">{label}</span>
      <span className="text-right font-medium text-text">{value}</span>
    </div>
  );
}
