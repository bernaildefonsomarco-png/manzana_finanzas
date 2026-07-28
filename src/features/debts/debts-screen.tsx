"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CalendarDays,
  ChevronRight,
  HandCoins,
  History,
  Info,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { ApiClientError } from "@/features/movements/movements-api";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { DiscreetValue } from "@/ui/primitivas/money";
import { cn } from "@/ui/primitivas/cn";
import { FieldShell, Input, Select } from "@/ui/primitivas/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import type { Account, DebtDirection, DebtKind } from "@/shared/types/domain";
import {
  createDebt,
  createDebtPayment,
  getDebtDetail,
  listDebtPaymentAccounts,
  listDebts,
} from "./debts-api";
import type {
  CreateDebtPayload,
  CreateDebtPaymentPayload,
  DebtDetailWithPayments,
  DebtScreenIntent,
  DebtSummary,
  DebtViewItem,
  DebtWithPerson,
} from "./debts-types";
import {
  debtDirectionLabels,
  debtKindLabels,
  formatDebtMoney,
  resolveDebtInstallmentPaymentTarget,
  summarizeDebts,
  toDebtDetailViewModel,
  toDebtViewItem,
} from "./debts-view-model";

type DebtsScreenProps = {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
  debtIntent?: DebtScreenIntent | null;
  onDebtIntentConsumed?: () => void;
};

type LoadState = "loading" | "ready" | "error";
type PaymentSelection = {
  item: DebtViewItem;
  initialAmount?: number;
  installmentNumber?: number;
};

const debtDirections: DebtDirection[] = ["i_owe", "they_owe_me"];
const debtKinds: DebtKind[] = [
  "personal",
  "bank_loan",
  "credit_card",
  "installment_purchase",
  "service_or_bill",
  "other",
];

export function DebtsScreen({
  onSignOut,
  onNavigate,
  debtIntent = null,
  onDebtIntentConsumed,
}: DebtsScreenProps) {
  const [debts, setDebts] = useState<DebtWithPerson[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [uiError, setUiError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [paymentSelection, setPaymentSelection] =
    useState<PaymentSelection | null>(null);
  const [detailDebtId, setDetailDebtId] = useState<string | null>(null);
  const [detailDebt, setDetailDebt] = useState<DebtDetailWithPayments | null>(null);
  const [detailLoadState, setDetailLoadState] = useState<LoadState>("ready");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);
  const consumedIntentKeyRef = useRef<string | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setUiError(null);

    try {
      const response = await listDebts();
      setDebts(response.debts);
      setLoadState("ready");
    } catch (error) {
      setLoadState("error");
      setUiError(toUiError(error));
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function loadInitial() {
      try {
        const response = await listDebts();
        if (!active) return;
        setDebts(response.debts);
        setLoadState("ready");
      } catch (error) {
        if (!active) return;
        setLoadState("error");
        setUiError(toUiError(error));
      }
    }

    void loadInitial();

    return () => {
      active = false;
    };
  }, []);

  const summary = useMemo(() => summarizeDebts(debts), [debts]);
  const items = useMemo(() => debts.map(toDebtViewItem), [debts]);

  useEffect(() => {
    if (!debtIntent) {
      consumedIntentKeyRef.current = null;
      return;
    }

    const intent = debtIntent;
    const intentKey = `${intent.debtId}:${intent.installmentId ?? ""}:${intent.action}`;
    if (consumedIntentKeyRef.current === intentKey) return;
    consumedIntentKeyRef.current = intentKey;

    let active = true;

    async function openDebtIntent() {
      try {
        const debt = await getDebtDetail(intent.debtId);
        if (!active) return;

        if (intent.action === "pay") {
          const target = resolveDebtInstallmentPaymentTarget(
            debt,
            intent.installmentId
          );

          if (target) {
            setPaymentSelection({
              item: toDebtDetailViewModel(debt),
              initialAmount: target.amount,
              installmentNumber: target.installment_number,
            });
          } else {
            setDetailDebt(debt);
            setDetailDebtId(debt.id);
            setDetailLoadState("ready");
            setDetailError(null);
            setFeedback(
              "Abri la deuda, pero esa cuota ya no es la siguiente pagable. Revisa el calendario actualizado."
            );
          }
        } else {
          setDetailDebt(debt);
          setDetailDebtId(debt.id);
          setDetailLoadState("ready");
          setDetailError(null);
        }
      } catch (error) {
        if (!active) return;
        setDetailDebtId(intent.debtId);
        setDetailLoadState("error");
        setDetailError(toUiError(error));
      }

      onDebtIntentConsumed?.();
    }

    void openDebtIntent();

    return () => {
      active = false;
    };
  }, [debtIntent, onDebtIntentConsumed]);

  useEffect(() => {
    if (!detailDebtId) return;

    const debtId = detailDebtId;
    let active = true;

    async function loadDetail() {
      try {
        const debt = await getDebtDetail(debtId);
        if (!active) return;
        setDetailDebt(debt);
        setDetailLoadState("ready");
      } catch (error) {
        if (!active) return;
        setDetailLoadState("error");
        setDetailError(toUiError(error));
      }
    }

    void loadDetail();

    return () => {
      active = false;
    };
  }, [detailDebtId, detailRefreshKey]);

  function handleOpenDetail(item: DebtViewItem) {
    const debt = debts.find((entry) => entry.id === item.id) ?? null;
    setDetailDebt(debt ? { ...debt, payments: [], installments: [] } : null);
    setDetailDebtId(item.id);
    setDetailLoadState("loading");
    setDetailError(null);
    setDetailRefreshKey((value) => value + 1);
  }

  function handleCloseDetail() {
    setDetailDebtId(null);
    setDetailDebt(null);
    setDetailLoadState("ready");
    setDetailError(null);
  }

  function handleRetryDetail() {
    setDetailLoadState("loading");
    setDetailError(null);
    setDetailRefreshKey((value) => value + 1);
  }

  function refreshOpenDetail(debtId: string | null) {
    if (debtId && detailDebtId === debtId) {
      setDetailLoadState("loading");
      setDetailError(null);
      setDetailRefreshKey((value) => value + 1);
    }
  }

  async function handleDebtCreated() {
    setModalOpen(false);
    setFeedback("Deuda guardada. No movi saldos; queda lista para registrar pagos despues.");
    await load();
  }

  async function handlePaymentSaved() {
    const paidDebtId = paymentSelection?.item.id ?? null;
    const paidDirection = paymentSelection?.item.direction ?? "i_owe";
    setPaymentSelection(null);
    setFeedback(
      paidDirection === "i_owe"
        ? "Pago registrado por Core. Actualice deuda, cuotas y los saldos que correspondian."
        : "Devolucion registrada por Core. Actualice cobro, cuotas y los saldos que correspondian."
    );
    await load();
    refreshOpenDetail(paidDebtId);
  }

  return (
    <AppShell
      title="Deudas"
      subtitle="Compromisos, prestamos y cobros pendientes sin mezclar con gastos comunes."
      activeView="debts"
      hideMobileNavigation={
        modalOpen || Boolean(detailDebt) || Boolean(paymentSelection)
      }
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button icon={<Plus className="h-4 w-4" />} onClick={() => setModalOpen(true)}>
          Crear deuda
        </Button>
      }
      mobilePrimaryAction={
        !modalOpen && !detailDebt && !paymentSelection ? (
          <Button
            size="icon"
            aria-label="Crear deuda"
            icon={<Plus className="h-5 w-5" />}
            onClick={() => setModalOpen(true)}
            className="h-12 w-12 rounded-full shadow-lg"
          >
            Crear deuda
          </Button>
        ) : undefined
      }
    >
      <div id="deudas" className="mx-auto max-w-[1040px] pb-10 pt-2 lg:pt-4">
        {loadState === "loading" ? (
          <LoadingBlock label="Ordenando deudas" />
        ) : loadState === "error" ? (
          <ErrorState
            title="No pude cargar tus deudas"
            description={uiError ?? "Intenta de nuevo en un momento."}
            onRetry={() => void load()}
          />
        ) : (
          <div className="space-y-6">
            {feedback ? (
              <div className="flex items-start gap-2 rounded-lg border border-success-subtle bg-success-subtle/60 px-4 py-3 text-sm text-text-secondary">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>{feedback}</span>
                <button
                  type="button"
                  aria-label="Cerrar mensaje"
                  className="ml-auto text-text-muted hover:text-text"
                  onClick={() => setFeedback(null)}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : null}

            <DebtsHero summary={summary} onCreate={() => setModalOpen(true)} />
            <DebtProtectionNotice />

            {items.length === 0 ? (
              <EmptyDebtState onCreate={() => setModalOpen(true)} />
            ) : (
              <DebtList
                items={items}
                onOpenDetail={handleOpenDetail}
                onRegisterPayment={(item) => setPaymentSelection({ item })}
              />
            )}
          </div>
        )}
      </div>

      {modalOpen ? (
        <CreateDebtModal
          onClose={() => setModalOpen(false)}
          onCreated={() => void handleDebtCreated()}
        />
      ) : null}

      {detailDebt ? (
        <DebtDetailModal
          debt={detailDebt}
          loadState={detailLoadState}
          error={detailError}
          onClose={handleCloseDetail}
          onRetry={handleRetryDetail}
          onRegisterPayment={(item) => setPaymentSelection({ item })}
        />
      ) : null}

      {paymentSelection ? (
        <DebtPaymentModal
          item={paymentSelection.item}
          initialAmount={paymentSelection.initialAmount}
          installmentNumber={paymentSelection.installmentNumber}
          onClose={() => setPaymentSelection(null)}
          onSaved={handlePaymentSaved}
        />
      ) : null}
    </AppShell>
  );
}

function DebtsHero({
  summary,
  onCreate,
}: {
  summary: DebtSummary;
  onCreate: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            mapa de compromisos
          </p>
          <h2 className="mt-3 max-w-2xl font-heading text-3xl font-semibold leading-tight tracking-normal text-text sm:text-4xl">
            Tus deudas y cobros, separados del ruido diario.
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Aqui ves lo que debes, lo que te deben y el neto. Crear una deuda no
            toca cuentas ni cajas hasta registrar un pago por Core.
          </p>
        </div>
        <Button
          variant="secondary"
          icon={<RefreshCw className="h-4 w-4" />}
          onClick={onCreate}
          className="lg:mt-1"
        >
          Nueva deuda
        </Button>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-3">
        <DebtFact
          label="Yo debo"
          value={<DiscreetValue>{formatDebtMoney(summary.total_i_owe)}</DiscreetValue>}
          tone="debt"
          icon={<ArrowUpRight className="h-4 w-4" />}
        />
        <DebtFact
          label="Me deben"
          value={<DiscreetValue>{formatDebtMoney(summary.total_they_owe_me)}</DiscreetValue>}
          tone="success"
          icon={<ArrowDownLeft className="h-4 w-4" />}
        />
        <DebtFact
          label="Neto"
          value={<DiscreetValue>{formatDebtMoney(summary.net_position)}</DiscreetValue>}
          tone={summary.net_position >= 0 ? "success" : "warning"}
          icon={<HandCoins className="h-4 w-4" />}
        />
      </div>
    </section>
  );
}

function DebtFact({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: ReactNode;
  tone: "debt" | "success" | "warning";
  icon: ReactNode;
}) {
  const iconClass =
    tone === "success"
      ? "bg-success-subtle text-success"
      : tone === "warning"
      ? "bg-warning-subtle text-amber-800"
      : "bg-debt-subtle text-debt";

  return (
    <div className="rounded-lg border border-border bg-bg-primary px-4 py-4">
      <div className="flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconClass)}>
          {icon}
        </div>
        <div>
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-1 font-heading text-xl font-semibold text-text">{value}</p>
        </div>
      </div>
    </div>
  );
}

function DebtProtectionNotice() {
  return (
    <section className="flex items-start gap-3 rounded-xl border border-brand-subtle bg-brand-subtle/35 px-4 py-4 text-sm leading-6 text-text-secondary">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
      <div>
        <p className="font-medium text-text">Deudas no son gastos genericos.</p>
        <p>
          Un pago de deuda reducira la deuda y, si eliges cuenta, tambien movera
          saldo. Por eso lo registraremos en un flujo separado.
        </p>
      </div>
    </section>
  );
}

function EmptyDebtState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={<HandCoins className="h-6 w-6" />}
      title="Aun no tienes deudas guardadas"
      description='Puedes guardar deudas o prestamos con un mensaje como "le debo 50 a Luis", o crearlas desde aqui si ya estas en el Dashboard.'
      action={
        <Button icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
          Crear primera deuda
        </Button>
      }
    />
  );
}

function DebtList({
  items,
  onOpenDetail,
  onRegisterPayment,
}: {
  items: DebtViewItem[];
  onOpenDetail: (item: DebtViewItem) => void;
  onRegisterPayment: (item: DebtViewItem) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-normal text-text">
            Deudas activas
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Lista confiable para revisar, no para juzgar.
          </p>
        </div>
      </div>
      <div className="grid gap-3">
        {items.map((item) => (
          <DebtCard
            key={item.id}
            item={item}
            onOpenDetail={() => onOpenDetail(item)}
            onRegisterPayment={() => onRegisterPayment(item)}
          />
        ))}
      </div>
    </section>
  );
}

function DebtCard({
  item,
  onOpenDetail,
  onRegisterPayment,
}: {
  item: DebtViewItem;
  onOpenDetail: () => void;
  onRegisterPayment: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.status_tone}>{item.status_label}</Badge>
            <Badge tone="neutral">{item.kind_label}</Badge>
            <Badge tone={item.direction === "i_owe" ? "debt" : "success"}>
              {item.direction_label}
            </Badge>
          </div>
          <h3 className="mt-3 font-heading text-xl font-semibold tracking-normal text-text">
            {item.title}
          </h3>
          {item.person_label ? (
            <p className="mt-1 text-sm text-text-secondary">{item.person_label}</p>
          ) : null}
        </div>

        <div className="shrink-0 text-left lg:text-right">
          <p className="text-xs font-medium text-text-muted">Pendiente</p>
          <p className="mt-1 font-heading text-2xl font-semibold text-text">
            <DiscreetValue>
              {formatDebtMoney(item.current_balance, item.currency)}
            </DiscreetValue>
          </p>
          <p className="mt-1 text-xs text-text-muted">
            de{" "}
            <DiscreetValue>
              {formatDebtMoney(item.principal_amount, item.currency)}
            </DiscreetValue>
          </p>
        </div>
      </div>

      <div className="mt-5">
        <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
          <span>Progreso pagado</span>
          <span>{item.progress}%</span>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-progress-track">
          <div
            className="h-full rounded-full bg-progress-fill"
            style={{ width: `${item.progress}%` }}
          />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <CalendarDays className="h-4 w-4 text-text-muted" />
          <span>{item.next_date_label ?? "Sin fecha proxima"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            icon={<HandCoins className="h-4 w-4" />}
            onClick={onRegisterPayment}
          >
            {item.direction === "i_owe" ? "Registrar pago" : "Registrar devolucion"}
          </Button>
          <Button
            variant="ghost"
            icon={<ChevronRight className="h-4 w-4" />}
            onClick={onOpenDetail}
          >
            Detalle
          </Button>
        </div>
      </div>
    </article>
  );
}

function DebtDetailModal({
  debt,
  loadState,
  error,
  onClose,
  onRetry,
  onRegisterPayment,
}: {
  debt: DebtDetailWithPayments;
  loadState: LoadState;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onRegisterPayment: (item: DebtViewItem) => void;
}) {
  const detail = useMemo(() => toDebtDetailViewModel(debt), [debt]);
  const canRegisterPayment =
    detail.current_balance > 0 &&
    !["paid", "cancelled", "archived"].includes(detail.status);

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/35 px-3 py-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-detail-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-medium text-text-muted">Detalle de deuda</p>
            <h2
              id="debt-detail-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              {detail.title}
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            className="rounded-md p-2 text-text-muted hover:bg-bg-surface hover:text-text"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-5 px-5 py-5">
          {loadState === "loading" ? (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-bg-surface px-4 py-3 text-sm text-text-secondary">
              <RefreshCw className="h-4 w-4 animate-spin text-text-muted" />
              Actualizando historial
            </div>
          ) : null}

          {error ? (
            <div className="flex flex-col gap-3 rounded-lg border border-warning-subtle bg-warning-subtle/55 px-4 py-3 text-sm text-text-secondary sm:flex-row sm:items-center sm:justify-between">
              <span>{error}</span>
              <Button type="button" variant="secondary" size="sm" onClick={onRetry}>
                Reintentar
              </Button>
            </div>
          ) : null}

          <section className="rounded-lg border border-border bg-bg-primary px-4 py-4">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={detail.status_tone}>{detail.status_label}</Badge>
                  <Badge tone={detail.direction === "i_owe" ? "debt" : "success"}>
                    {detail.direction_label}
                  </Badge>
                  <Badge tone="neutral">{detail.kind_label}</Badge>
                </div>
                <p className="mt-4 text-sm text-text-muted">
                  Saldo pendiente actual
                </p>
                <p className="mt-1 font-heading text-3xl font-semibold tracking-normal text-text">
                  <DiscreetValue>
                    {formatDebtMoney(detail.current_balance, detail.currency)}
                  </DiscreetValue>
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  Pagado:{" "}
                  <DiscreetValue>
                    {formatDebtMoney(detail.paid_amount, detail.currency)}
                  </DiscreetValue>{" "}
                  de{" "}
                  <DiscreetValue>
                    {formatDebtMoney(detail.principal_amount, detail.currency)}
                  </DiscreetValue>
                </p>
              </div>

              <div className="grid gap-2 text-sm text-text-secondary sm:min-w-64">
                <DebtDetailInfoRow
                  label="Persona"
                  value={detail.person_label ?? "Sin persona vinculada"}
                />
                <DebtDetailInfoRow label="Inicio" value={detail.opened_label} />
                <DebtDetailInfoRow
                  label="Vencimiento"
                  value={detail.due_label ?? "Sin fecha"}
                />
                <DebtDetailInfoRow
                  label="Ultimo pago"
                  value={detail.last_payment_label ?? "Sin pagos"}
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-xs text-text-muted">
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

          {detail.installment_label ? (
            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3 text-sm text-text-secondary">
              Calendario configurado:{" "}
              <span className="font-medium text-text">{detail.installment_label}</span>
            </div>
          ) : null}

          {detail.installments.length > 0 ? (
            <div className="rounded-lg border border-border bg-bg-surface px-4 py-3 text-sm text-text-secondary">
              Calendario registrado:{" "}
              <span className="font-medium text-text">
                {detail.installments.length} cuotas -{" "}
                <DiscreetValue>
                  {formatDebtMoney(detail.schedule_pending_amount, detail.currency)}
                </DiscreetValue>{" "}
                pendientes
              </span>
            </div>
          ) : null}

          {detail.schedule_warning ? (
            <div className="rounded-lg border border-warning-subtle bg-warning-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
              {detail.schedule_warning}
            </div>
          ) : null}

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/35 px-4 py-3 text-sm leading-6 text-text-secondary">
            Este detalle muestra la deuda y pagos confirmados. Registrar un pago
            reduce la deuda, concilia sus cuotas y solo toca cuenta si eliges una
            cuenta en el flujo Core.
          </div>

          <div className="flex flex-wrap gap-2 border-y border-border py-4">
            <Button
              variant="secondary"
              icon={<HandCoins className="h-4 w-4" />}
              disabled={!canRegisterPayment}
              onClick={() => onRegisterPayment(detail)}
            >
              {detail.direction === "i_owe" ? "Registrar pago" : "Registrar devolucion"}
            </Button>
          </div>

          <section>
            <div className="flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-text-muted" />
              <h3 className="font-heading text-base font-semibold tracking-normal text-text">
                Cuotas
              </h3>
            </div>

            {detail.installments.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-bg-surface px-4 py-5 text-sm text-text-secondary">
                Aun no hay calendario de cuotas para esta deuda.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-bg-primary">
                {detail.installments.map((installment) => (
                  <div
                    key={installment.id}
                    className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={installment.status_tone}>
                          {installment.status_label}
                        </Badge>
                        <span className="text-sm text-text-secondary">
                          Cuota {installment.number} - {installment.due_label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-muted">
                        {installment.movement_label}. Esperado:{" "}
                        <DiscreetValue>
                          {installment.expected_amount_label}
                        </DiscreetValue>
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-heading text-lg font-semibold text-text">
                        <DiscreetValue>
                          {installment.pending_amount_label}
                        </DiscreetValue>
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        pendiente de cuota
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-text-muted" />
              <h3 className="font-heading text-base font-semibold tracking-normal text-text">
                Historial
              </h3>
            </div>

            {detail.history.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-bg-surface px-4 py-5 text-sm text-text-secondary">
                Aun no hay pagos registrados para esta deuda.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-bg-primary">
                {detail.history.map((payment) => (
                  <div
                    key={payment.id}
                    className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone="success">{payment.type_label}</Badge>
                        <span className="text-sm text-text-secondary">
                          {payment.paid_label}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-muted">
                        {payment.movement_label} - {payment.source_label}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {payment.allocation_label}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-heading text-lg font-semibold text-text">
                        {payment.amount_label}
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {payment.movement_id ? "Movimiento vinculado" : "Sin movimiento"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function DebtDetailInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="text-text-muted">{label}</span>
      <span className="truncate font-medium text-text">{value}</span>
    </div>
  );
}

function DebtPaymentModal({
  item,
  initialAmount,
  installmentNumber,
  onClose,
  onSaved,
}: {
  item: DebtViewItem;
  initialAmount?: number;
  installmentNumber?: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountsState, setAccountsState] = useState<LoadState>("loading");
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState(
    formatInputMoney(
      Math.min(
        item.current_balance,
        initialAmount && initialAmount > 0
          ? initialAmount
          : item.current_balance
      )
    )
  );
  const [paidDate, setPaidDate] = useState(todayInputDate());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadAccounts() {
      setAccountsState("loading");
      try {
        const response = await listDebtPaymentAccounts();
        if (!active) return;
        setAccounts(response.accounts);
        setAccountsState("ready");
      } catch {
        if (!active) return;
        setAccountsState("error");
      }
    }

    void loadAccounts();

    return () => {
      active = false;
    };
  }, []);

  const matchingAccounts = useMemo(
    () => accounts.filter((account) => account.currency === item.currency),
    [accounts, item.currency]
  );
  const selectedAccount =
    matchingAccounts.find((account) => account.id === accountId) ?? null;
  const numericAmount = Number(amount);
  const canSubmit =
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    numericAmount <= item.current_balance;
  const isPayment = item.direction === "i_owe";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    const payload: CreateDebtPaymentPayload = {
      amount: numericAmount,
      account_id: accountId || null,
      paid_at: toLocalNoonIso(paidDate),
      note: note.trim() || null,
    };

    try {
      await createDebtPayment(item.id, payload);
      await onSaved();
    } catch (caught) {
      setError(toUiError(caught));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/35 px-3 py-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="debt-payment-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-medium text-text-muted">
              {installmentNumber
                ? `Cuota ${installmentNumber}`
                : isPayment
                ? "Pago de deuda"
                : "Devolucion recibida"}
            </p>
            <h2
              id="debt-payment-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              {item.title}
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Pendiente:{" "}
              <DiscreetValue>
                {formatDebtMoney(item.current_balance, item.currency)}
              </DiscreetValue>
            </p>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            className="rounded-md p-2 text-text-muted hover:bg-bg-surface hover:text-text"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              label={isPayment ? "Monto pagado" : "Monto recibido"}
              htmlFor="debt-payment-amount"
              error={
                numericAmount > item.current_balance
                  ? "No puede superar el saldo pendiente."
                  : undefined
              }
            >
              <Input
                id="debt-payment-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                type="number"
                min="0.01"
                max={item.current_balance}
                step="0.01"
              />
            </FieldShell>

            <FieldShell label="Fecha" htmlFor="debt-payment-date">
              <Input
                id="debt-payment-date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
                type="date"
              />
            </FieldShell>
          </div>

          <FieldShell
            label={isPayment ? "Cuenta desde donde pagaste" : "Cuenta donde recibiste"}
            htmlFor="debt-payment-account"
            hint="Puedes dejarlo sin cuenta si solo quieres reducir la deuda por ahora."
          >
            <Select
              id="debt-payment-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
              disabled={accountsState === "loading"}
            >
              <option value="">
                {accountsState === "loading"
                  ? "Cargando cuentas..."
                  : "Sin cuenta por ahora"}
              </option>
              {matchingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {formatDebtMoney(account.current_balance, item.currency)}
                </option>
              ))}
            </Select>
          </FieldShell>

          {accountsState === "error" ? (
            <div className="rounded-lg border border-warning-subtle bg-warning-subtle/55 px-4 py-3 text-sm text-text-secondary">
              No pude cargar tus cuentas. Igual puedes registrar el pago sin
              cuenta y asignarla despues.
            </div>
          ) : null}

          <FieldShell label="Nota" htmlFor="debt-payment-note" hint="Opcional.">
            <Input
              id="debt-payment-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder={isPayment ? "Ej. Pague cuota de junio" : "Ej. Ana me devolvio"}
              maxLength={180}
            />
          </FieldShell>

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/35 px-4 py-3 text-sm leading-6 text-text-secondary">
            {selectedAccount ? (
              <>
                Manzana reducira la deuda y actualizara el saldo de{" "}
                <span className="font-medium text-text">{selectedAccount.name}</span>{" "}
                por Core.
              </>
            ) : (
              <>
                Manzana reducira la deuda. Como no elegiste cuenta, no tocara
                saldos de cuentas.
              </>
            )}
            <p className="mt-2">
              Si hay cuotas abiertas, Core aplica el monto primero a la mas
              antigua y continua con las siguientes.
            </p>
          </div>

          {error ? (
            <div className="rounded-lg border border-error-subtle bg-error-subtle/60 px-4 py-3 text-sm text-error">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} disabled={!canSubmit}>
              {isPayment ? "Guardar pago" : "Guardar devolucion"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateDebtModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [direction, setDirection] = useState<DebtDirection>("i_owe");
  const [kind, setKind] = useState<DebtKind>("personal");
  const [name, setName] = useState("");
  const [relatedPersonName, setRelatedPersonName] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN");
  const [dueDate, setDueDate] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");
  const [installmentAmount, setInstallmentAmount] = useState("");
  const [interestNotes, setInterestNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount);
  const hasInstallments = Boolean(installmentCount);
  const canSubmit =
    name.trim().length > 0 &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    (!hasInstallments || Boolean(dueDate));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    const payload: CreateDebtPayload = {
      direction,
      kind,
      name: name.trim(),
      related_person_name: relatedPersonName.trim() || null,
      principal_amount: numericAmount,
      currency,
      due_date: dueDate || null,
      next_payment_date: dueDate || null,
      installment_count: installmentCount ? Number(installmentCount) : null,
      installment_amount: installmentAmount ? Number(installmentAmount) : null,
      interest_notes: interestNotes.trim() || null,
    };

    try {
      await createDebt(payload);
      onCreated();
    } catch (caught) {
      setError(toUiError(caught));
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/35 px-3 py-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-debt-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div>
            <p className="text-xs font-medium text-text-muted">Registro manual</p>
            <h2
              id="create-debt-title"
              className="font-heading text-xl font-semibold tracking-normal text-text"
            >
              Crear deuda
            </h2>
          </div>
          <button
            type="button"
            aria-label="Cerrar modal"
            className="rounded-md p-2 text-text-muted hover:bg-bg-surface hover:text-text"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
          <div className="grid gap-3 sm:grid-cols-2">
            {debtDirections.map((option) => (
              <button
                key={option}
                type="button"
                className={cn(
                  "rounded-lg border px-4 py-3 text-left transition",
                  direction === option
                    ? "border-brand bg-brand-subtle text-text"
                    : "border-border bg-bg-surface-raised text-text-secondary hover:border-border-strong"
                )}
                onClick={() => setDirection(option)}
              >
                <span className="font-medium">{debtDirectionLabels[option]}</span>
                <span className="mt-1 block text-xs text-text-muted">
                  {option === "i_owe"
                    ? "Algo que tengo pendiente por pagar."
                    : "Alguien tiene pendiente devolverme."}
                </span>
              </button>
            ))}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Tipo" htmlFor="debt-kind">
              <Select
                id="debt-kind"
                value={kind}
                onChange={(event) => setKind(event.target.value as DebtKind)}
              >
                {debtKinds.map((option) => (
                  <option key={option} value={option}>
                    {debtKindLabels[option]}
                  </option>
                ))}
              </Select>
            </FieldShell>

            <FieldShell label="Moneda" htmlFor="debt-currency">
              <Select
                id="debt-currency"
                value={currency}
                onChange={(event) => setCurrency(event.target.value as "PEN" | "USD")}
              >
                <option value="PEN">Soles</option>
                <option value="USD">Dolares</option>
              </Select>
            </FieldShell>
          </div>

          <FieldShell
            label="Nombre"
            htmlFor="debt-name"
            hint="Ej. Prestamo con Luis, Tarjeta BCP o Laptop en cuotas."
          >
            <Input
              id="debt-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Prestamo con Luis"
              maxLength={120}
            />
          </FieldShell>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Persona o entidad"
              htmlFor="debt-person"
              hint="Opcional, ayuda a agrupar saldos por persona."
            >
              <Input
                id="debt-person"
                value={relatedPersonName}
                onChange={(event) => setRelatedPersonName(event.target.value)}
                placeholder="Luis, BCP, tienda..."
                maxLength={120}
              />
            </FieldShell>

            <FieldShell label="Monto pendiente" htmlFor="debt-amount">
              <Input
                id="debt-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="150.00"
                inputMode="decimal"
                type="number"
                min="0.01"
                step="0.01"
              />
            </FieldShell>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <FieldShell
              label="Fecha proxima"
              htmlFor="debt-due-date"
              hint={
                hasInstallments
                  ? "Necesaria para crear el calendario mensual de cuotas."
                  : "Opcional."
              }
              error={
                hasInstallments && !dueDate
                  ? "Agrega la primera fecha de cuota."
                  : undefined
              }
            >
              <Input
                id="debt-due-date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
              />
            </FieldShell>

            <FieldShell label="Cuotas" htmlFor="debt-installments" hint="Opcional.">
              <Input
                id="debt-installments"
                value={installmentCount}
                onChange={(event) => setInstallmentCount(event.target.value)}
                type="number"
                min="1"
                step="1"
                placeholder="6"
              />
            </FieldShell>

            <FieldShell label="Monto cuota" htmlFor="debt-installment-amount" hint="Opcional.">
              <Input
                id="debt-installment-amount"
                value={installmentAmount}
                onChange={(event) => setInstallmentAmount(event.target.value)}
                type="number"
                min="0.01"
                step="0.01"
                placeholder="50.00"
              />
            </FieldShell>
          </div>

          <FieldShell label="Nota" htmlFor="debt-notes" hint="Opcional.">
            <textarea
              id="debt-notes"
              value={interestNotes}
              onChange={(event) => setInterestNotes(event.target.value)}
              maxLength={300}
              placeholder="Interes, acuerdo, contexto..."
              className="min-h-24 w-full rounded-lg border border-border bg-bg-surface-raised px-3 py-3 text-sm text-text shadow-xs transition placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-subtle"
            />
          </FieldShell>

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/35 px-4 py-3 text-sm leading-6 text-text-secondary">
            Crear esta deuda no mueve saldos. Cuando registres un pago, Manzana
            reducira la deuda y actualizara cuentas solo si corresponde.
          </div>

          {error ? (
            <div className="rounded-lg border border-error-subtle bg-error-subtle/60 px-4 py-3 text-sm text-error">
              {error}
            </div>
          ) : null}

          <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" loading={submitting} disabled={!canSubmit}>
              Guardar deuda
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function toUiError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error) return error.message;
  return "Ocurrio un error inesperado.";
}

function formatInputMoney(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

function todayInputDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function toLocalNoonIso(dateValue: string): string {
  const fallback = new Date();
  const date = dateValue ? new Date(`${dateValue}T12:00:00`) : fallback;

  if (Number.isNaN(date.getTime())) return fallback.toISOString();
  return date.toISOString();
}
