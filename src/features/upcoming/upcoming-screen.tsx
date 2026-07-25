"use client";

import type { FormEvent, ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarDays,
  ChevronRight,
  CheckCircle2,
  Clock,
  Edit3,
  History,
  HandCoins,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ShieldCheck,
  X,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import type { DebtScreenIntent } from "@/features/debts/debts-types";
import { ApiClientError } from "@/features/movements/movements-api";
import { Badge } from "@/shared/ui/badge";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";
import { FieldShell, Input, Select } from "@/shared/ui/field";
import { EmptyState, ErrorState, LoadingBlock } from "@/shared/ui/states";
import { DiscreetValue } from "@/shared/ui/money";
import type {
  Account,
  CategoryId,
  RecurringCandidate,
  RecurringAmountVariability,
  RecurringFrequency,
} from "@/shared/types/domain";
import { CATEGORY_IDS } from "@/shared/types/domain";
import {
  cancelRecurringRule,
  confirmRecurringCandidate,
  createRecurringRule,
  detectRecurringCandidates,
  discardRecurringCandidate,
  getRecurringRule,
  listRecurringAccounts,
  listUpcomingPayments,
  markRecurringPaid,
  updateRecurringRule,
} from "./upcoming-api";
import type {
  ConfirmRecurringCandidatePayload,
  CreateRecurringPayload,
  DebtInstallmentViewItem,
  RecurringRuleWithOccurrences,
  UpcomingDashboardResponse,
  UpdateRecurringPayload,
  UpcomingSummary,
  UpcomingViewItem,
} from "./upcoming-types";
import {
  categoryLabels,
  filterRulesCoveredByDebtInstallments,
  formatUpcomingMoney,
  frequencyLabels,
  groupUpcomingItems,
  summarizeUpcoming,
  toDebtInstallmentViewItems,
  toRecurringDetailViewModel,
  toSuggestedCandidateViewModel,
  toUpcomingViewItem,
  toUpcomingViewItems,
} from "./upcoming-view-model";

type UpcomingScreenProps = {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
  onOpenDebt?: (intent: DebtScreenIntent) => void;
};

type LoadState = "loading" | "ready" | "error";
type RuleModalMode = "create" | "edit";

const frequencyOptions: RecurringFrequency[] = [
  "monthly",
  "weekly",
  "biweekly",
  "yearly",
  "custom_window",
];

const amountVariabilityOptions: Array<{
  value: RecurringAmountVariability;
  label: string;
}> = [
  { value: "fixed", label: "Fijo" },
  { value: "estimated", label: "Estimado" },
  { value: "variable", label: "Variable" },
];

export function UpcomingScreen({
  onSignOut,
  onNavigate,
  onOpenDebt,
}: UpcomingScreenProps) {
  const [data, setData] = useState<UpcomingDashboardResponse | null>(null);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [uiError, setUiError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [detectingCandidates, setDetectingCandidates] = useState(false);
  const [candidateBusyId, setCandidateBusyId] = useState<string | null>(null);
  const [ruleModal, setRuleModal] = useState<{
    mode: RuleModalMode;
    rule?: RecurringRuleWithOccurrences;
  } | null>(null);
  const [paymentItem, setPaymentItem] = useState<UpcomingViewItem | null>(null);
  const [candidateModal, setCandidateModal] = useState<RecurringCandidate | null>(null);
  const [detailRuleId, setDetailRuleId] = useState<string | null>(null);
  const [detailRule, setDetailRule] =
    useState<RecurringRuleWithOccurrences | null>(null);
  const [detailLoadState, setDetailLoadState] = useState<LoadState>("ready");
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailRefreshKey, setDetailRefreshKey] = useState(0);

  const load = useCallback(async () => {
    setLoadState("loading");
    setUiError(null);

    try {
      const [nextData, accountsResponse] = await Promise.all([
        listUpcomingPayments(),
        listRecurringAccounts(),
      ]);
      setData(nextData);
      setAccounts(accountsResponse.accounts);
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
        const [nextData, accountsResponse] = await Promise.all([
          listUpcomingPayments(),
          listRecurringAccounts(),
        ]);
        if (!active) return;
        setData(nextData);
        setAccounts(accountsResponse.accounts);
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

  const summary = useMemo(
    () =>
      data
        ? summarizeUpcoming(data)
        : {
            active_count: 0,
            overdue_count: 0,
            paused_count: 0,
            suggested_count: 0,
            monthly_estimate: 0,
          },
    [data]
  );
  const visibleRules = useMemo(
    () =>
      filterRulesCoveredByDebtInstallments(
        data?.rules ?? [],
        data?.debt_installments ?? []
      ),
    [data]
  );
  const items = useMemo(
    () =>
      visibleRules
        .flatMap((rule) => toUpcomingViewItems(rule))
        .sort(compareUpcomingItems),
    [visibleRules]
  );
  const groups = useMemo(() => groupUpcomingItems(items), [items]);
  const debtInstallments = useMemo(
    () => toDebtInstallmentViewItems(data?.debt_installments ?? []),
    [data]
  );

  useEffect(() => {
    if (!detailRuleId) return;

    const ruleId = detailRuleId;
    let active = true;

    async function loadDetail() {
      try {
        const rule = await getRecurringRule(ruleId);
        if (!active) return;
        setDetailRule(rule);
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
  }, [detailRuleId, detailRefreshKey]);

  function handleOpenDetail(item: UpcomingViewItem) {
    setDetailRule(item.rule);
    setDetailRuleId(item.id);
    setDetailLoadState("loading");
    setDetailError(null);
    setDetailRefreshKey((value) => value + 1);
  }

  function handleCloseDetail() {
    setDetailRuleId(null);
    setDetailRule(null);
    setDetailError(null);
    setDetailLoadState("ready");
  }

  function refreshOpenDetail(ruleId: string | null) {
    if (ruleId && detailRuleId === ruleId) {
      setDetailLoadState("loading");
      setDetailError(null);
      setDetailRefreshKey((value) => value + 1);
    }
  }

  function handleRetryDetail() {
    setDetailLoadState("loading");
    setDetailError(null);
    setDetailRefreshKey((value) => value + 1);
  }

  async function handleRuleSaved(message: string) {
    const editedRuleId = ruleModal?.mode === "edit" ? ruleModal.rule?.id ?? null : null;
    setRuleModal(null);
    setActionError(null);
    setFeedback(message);
    await load();
    refreshOpenDetail(editedRuleId);
  }

  async function handlePaymentSaved() {
    const paidRuleId = paymentItem?.id ?? null;
    setPaymentItem(null);
    setActionError(null);
    setFeedback("Pago registrado por Core. Si elegiste cuenta, el saldo ya se actualizo.");
    await load();
    refreshOpenDetail(paidRuleId);
  }

  async function handleCandidateSaved() {
    setCandidateModal(null);
    setActionError(null);
    setFeedback("Sugerencia activada como pago que viene. Aun no toca saldos.");
    await load();
  }

  async function handleDetectCandidates() {
    if (detectingCandidates) return;

    setDetectingCandidates(true);
    setActionError(null);

    try {
      const response = await detectRecurringCandidates();
      const { result } = response;
      if (result.ready_to_suggest > 0) {
        setFeedback(
          result.ready_to_suggest === 1
            ? "Encontre una sugerencia lista para revisar."
            : `Encontre ${result.ready_to_suggest} sugerencias listas para revisar.`
        );
      } else if (result.detected > 0) {
        setFeedback("Guarde evidencia, pero todavia no hay sugerencias suficientemente claras.");
      } else {
        setFeedback("No encontre patrones recurrentes suficientes por ahora.");
      }
      await load();
    } catch (error) {
      setActionError(toUiError(error));
    } finally {
      setDetectingCandidates(false);
    }
  }

  async function handleAcceptCandidate(candidate: RecurringCandidate) {
    if (candidateBusyId) return;

    setCandidateBusyId(candidate.id);
    setActionError(null);

    try {
      await confirmRecurringCandidate(candidate.id);
      setFeedback("Sugerencia activada como pago que viene. Aun no toca saldos.");
      await load();
    } catch (error) {
      setActionError(toUiError(error));
    } finally {
      setCandidateBusyId(null);
    }
  }

  async function handleDiscardCandidate(candidate: RecurringCandidate) {
    if (candidateBusyId) return;

    setCandidateBusyId(candidate.id);
    setActionError(null);

    try {
      await discardRecurringCandidate(candidate.id);
      setFeedback("Sugerencia ignorada. No se creo ningun pago.");
      await load();
    } catch (error) {
      setActionError(toUiError(error));
    } finally {
      setCandidateBusyId(null);
    }
  }

  async function handlePause(item: UpcomingViewItem) {
    setActionError(null);
    setFeedback(null);
    const updatedRule = await updateRecurringRule(item.id, { status: "paused" });
    if (detailRuleId === item.id) setDetailRule(updatedRule);
    setFeedback("Pago pausado. No afecta saldos ni historial.");
    await load();
    refreshOpenDetail(item.id);
  }

  async function handleResume(item: UpcomingViewItem) {
    setActionError(null);
    setFeedback(null);
    const updatedRule = await updateRecurringRule(item.id, { status: "active" });
    if (detailRuleId === item.id) setDetailRule(updatedRule);
    setFeedback("Pago reactivado. Sigue como compromiso esperado.");
    await load();
    refreshOpenDetail(item.id);
  }

  async function handleCancel(item: UpcomingViewItem) {
    setActionError(null);
    setFeedback(null);
    await cancelRecurringRule(item.id);
    if (detailRuleId === item.id) handleCloseDetail();
    setFeedback("Pago cancelado. No borre movimientos pasados.");
    await load();
  }

  return (
    <AppShell
      title="Pagos que vienen"
      subtitle="Compromisos esperados para anticiparte sin tocar saldos hasta confirmar."
      activeView="upcoming"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setRuleModal({ mode: "create" })}
        >
          Agregar
        </Button>
      }
      mobilePrimaryAction={
        <Button
          size="icon"
          aria-label="Agregar pago"
          icon={<Plus className="h-5 w-5" />}
          onClick={() => setRuleModal({ mode: "create" })}
          className="h-12 w-12 rounded-full shadow-lg"
        >
          Agregar
        </Button>
      }
    >
      <div id="pagos-que-vienen" className="mx-auto max-w-[1040px] pb-10 pt-2 lg:pt-4">
        {loadState === "loading" ? (
          <LoadingBlock label="Ordenando pagos" />
        ) : loadState === "error" || !data ? (
          <ErrorState
            title="No pude cargar pagos que vienen"
            description={uiError ?? "Intenta de nuevo en un momento."}
            onRetry={() => void load()}
          />
        ) : (
          <div className="space-y-6">
            {feedback ? (
              <FeedbackMessage message={feedback} onClose={() => setFeedback(null)} />
            ) : null}
            {actionError ? (
              <ActionErrorMessage
                message={actionError}
                onClose={() => setActionError(null)}
              />
            ) : null}

            <UpcomingHero summary={summary} onCreate={() => setRuleModal({ mode: "create" })} />
            <UpcomingProtectionNotice />

            {items.length === 0 &&
            debtInstallments.length === 0 &&
            data.candidates.length === 0 ? (
              <div className="space-y-6">
                <EmptyUpcomingState onCreate={() => setRuleModal({ mode: "create" })} />
                <SuggestedSection
                  candidates={data.candidates}
                  detecting={detectingCandidates}
                  busyCandidateId={candidateBusyId}
                  onDetect={() => void handleDetectCandidates()}
                  onAccept={(candidate) => void handleAcceptCandidate(candidate)}
                  onEdit={setCandidateModal}
                  onDiscard={(candidate) => void handleDiscardCandidate(candidate)}
                />
              </div>
            ) : (
              <div className="space-y-6">
                <DebtInstallmentsSection
                  items={debtInstallments}
                  onOpenDebt={(item, action) => {
                    if (onOpenDebt) {
                      onOpenDebt({
                        debtId: item.debt_id,
                        installmentId: item.installment_id,
                        action,
                      });
                      return;
                    }

                    onNavigate?.("debts");
                  }}
                />
                <UpcomingSection
                  title="Vencidos"
                  description="Revisalos con calma. Siguen sin afectar saldos hasta marcarlos pagados."
                  items={groups.overdue}
                  emptyLabel={null}
                  onOpenDetail={handleOpenDetail}
                  onMarkPaid={setPaymentItem}
                  onEdit={(item) => setRuleModal({ mode: "edit", rule: item.rule })}
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                />
                <UpcomingSection
                  title="Pagados"
                  description="Ultimas ocurrencias confirmadas por Core."
                  items={groups.paid}
                  emptyLabel={null}
                  onOpenDetail={handleOpenDetail}
                  onMarkPaid={setPaymentItem}
                  onEdit={(item) => setRuleModal({ mode: "edit", rule: item.rule })}
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                />
                <UpcomingSection
                  title="Proximos"
                  description="Siguiente ocurrencia abierta de cada pago."
                  items={groups.active}
                  emptyLabel="No hay pagos proximos por ahora."
                  onOpenDetail={handleOpenDetail}
                  onMarkPaid={setPaymentItem}
                  onEdit={(item) => setRuleModal({ mode: "edit", rule: item.rule })}
                  onPause={handlePause}
                  onResume={handleResume}
                  onCancel={handleCancel}
                />
                {groups.paused.length > 0 ? (
                  <UpcomingSection
                    title="Pausados"
                    description="Estan guardados, pero fuera de la anticipacion activa."
                    items={groups.paused}
                    emptyLabel={null}
                    onOpenDetail={handleOpenDetail}
                    onMarkPaid={setPaymentItem}
                    onEdit={(item) => setRuleModal({ mode: "edit", rule: item.rule })}
                    onPause={handlePause}
                    onResume={handleResume}
                    onCancel={handleCancel}
                  />
                ) : null}
                <SuggestedSection
                  candidates={data.candidates}
                  detecting={detectingCandidates}
                  busyCandidateId={candidateBusyId}
                  onDetect={() => void handleDetectCandidates()}
                  onAccept={(candidate) => void handleAcceptCandidate(candidate)}
                  onEdit={setCandidateModal}
                  onDiscard={(candidate) => void handleDiscardCandidate(candidate)}
                />
              </div>
            )}
          </div>
        )}
      </div>

      {detailRule ? (
        <RecurringDetailModal
          rule={detailRule}
          accounts={accounts}
          loadState={detailLoadState}
          error={detailError}
          onClose={handleCloseDetail}
          onRetry={handleRetryDetail}
          onMarkPaid={setPaymentItem}
          onEdit={(rule) => {
            handleCloseDetail();
            setRuleModal({ mode: "edit", rule });
          }}
          onPause={(item) => void handlePause(item)}
          onResume={(item) => void handleResume(item)}
          onCancel={(item) => void handleCancel(item)}
        />
      ) : null}

      {ruleModal ? (
        <RuleModal
          mode={ruleModal.mode}
          rule={ruleModal.rule}
          accounts={accounts}
          onClose={() => setRuleModal(null)}
          onSaved={handleRuleSaved}
        />
      ) : null}

      {paymentItem ? (
        <MarkPaidModal
          item={paymentItem}
          accounts={accounts}
          onClose={() => setPaymentItem(null)}
          onSaved={handlePaymentSaved}
        />
      ) : null}

      {candidateModal ? (
        <CandidateConfirmModal
          candidate={candidateModal}
          accounts={accounts}
          onClose={() => setCandidateModal(null)}
          onSaved={handleCandidateSaved}
        />
      ) : null}
    </AppShell>
  );
}

function FeedbackMessage({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-success-subtle bg-success-subtle/60 px-4 py-3 text-sm text-text-secondary">
      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-success" />
      <span>{message}</span>
      <button
        type="button"
        aria-label="Cerrar mensaje"
        className="ml-auto text-text-muted hover:text-text"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function ActionErrorMessage({
  message,
  onClose,
}: {
  message: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-error-subtle bg-error-subtle/60 px-4 py-3 text-sm text-error">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message}</span>
      <button
        type="button"
        aria-label="Cerrar error"
        className="ml-auto text-error hover:text-text"
        onClick={onClose}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function UpcomingHero({
  summary,
  onCreate,
}: {
  summary: UpcomingSummary;
  onCreate: () => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs sm:p-7">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            anticipacion
          </p>
          <h1 className="mt-3 max-w-2xl font-heading text-3xl font-semibold leading-tight tracking-normal text-text sm:text-4xl">
            Lo que viene, separado de lo que ya paso.
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary">
            Manzana te ayuda a ver compromisos esperados. No descuenta nada de
            cuentas hasta que confirmes un pago real.
          </p>
        </div>
        <Button variant="secondary" icon={<RefreshCw className="h-4 w-4" />} onClick={onCreate}>
          Nuevo pago
        </Button>
      </div>

      <div className="mt-7 grid gap-3 sm:grid-cols-4">
        <UpcomingFact label="Proximos" value={summary.active_count} icon={<CheckCircle2 className="h-4 w-4" />} />
        <UpcomingFact label="Vencidos" value={summary.overdue_count} icon={<AlertTriangle className="h-4 w-4" />} tone="warning" />
        <UpcomingFact label="Pausados" value={summary.paused_count} icon={<Pause className="h-4 w-4" />} />
        <UpcomingFact
          label="Estimado mes"
          value={
            <DiscreetValue>
              {formatUpcomingMoney(summary.monthly_estimate)}
            </DiscreetValue>
          }
          icon={<CalendarDays className="h-4 w-4" />}
        />
      </div>
    </section>
  );
}

function UpcomingFact({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  tone?: "neutral" | "warning";
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-primary px-4 py-4">
      <div className="flex items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            tone === "warning"
              ? "bg-warning-subtle text-warning"
              : "bg-brand-subtle text-brand"
          )}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-text-muted">{label}</p>
          <p className="mt-1 truncate font-heading text-xl font-semibold text-text">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function UpcomingProtectionNotice() {
  return (
    <section className="flex items-start gap-3 rounded-xl border border-brand-subtle bg-brand-subtle/35 px-4 py-4 text-sm leading-6 text-text-secondary">
      <Clock className="mt-0.5 h-5 w-5 shrink-0 text-brand" />
      <div>
        <p className="font-medium text-text">Esperado no es pagado.</p>
        <p>
          Un pago que viene no baja saldos. Los recurrentes se confirman aqui y
          las cuotas vinculadas se gestionan desde Deudas. Toda escritura pasa
          por Core.
        </p>
      </div>
    </section>
  );
}

function EmptyUpcomingState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={<CalendarDays className="h-6 w-6" />}
      title="Aun no hay pagos guardados"
      description="Agrega alquiler, suscripciones, servicios o cuotas fijas para verlos antes de que lleguen."
      action={
        <Button icon={<Plus className="h-4 w-4" />} onClick={onCreate}>
          Agregar primer pago
        </Button>
      }
    />
  );
}

export function DebtInstallmentsSection({
  items,
  onOpenDebt,
}: {
  items: DebtInstallmentViewItem[];
  onOpenDebt: (
    item: DebtInstallmentViewItem,
    action: DebtScreenIntent["action"]
  ) => void;
}) {
  if (items.length === 0) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-normal text-text">
          Cuotas de deuda
        </h2>
        <p className="mt-1 text-sm text-text-secondary">
          Cuotas abiertas vencidas y dentro de los proximos 31 dias.
        </p>
      </div>

      <div className="grid gap-3">
        {items.map((item) => (
          <article
            key={item.installment_id}
            className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs"
          >
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={item.status_tone}>{item.status_label}</Badge>
                  <Badge tone="debt">Vinculada a deuda</Badge>
                </div>
                <h3 className="mt-3 font-heading text-xl font-semibold tracking-normal text-text">
                  {item.title}
                </h3>
                <p className="mt-1 text-sm text-text-secondary">
                  Vencimiento: {item.due_label}
                </p>
              </div>

              <div className="shrink-0 text-left lg:text-right">
                <p className="text-xs font-medium text-text-muted">Pendiente</p>
                <p className="mt-1 font-heading text-2xl font-semibold text-text">
                  <DiscreetValue>
                    {formatUpcomingMoney(item.amount, item.currency)}
                  </DiscreetValue>
                </p>
                <p className="mt-1 text-xs text-text-muted">Debt Engine</p>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <CalendarDays className="h-4 w-4 text-text-muted" />
                <span>{item.due_at}</span>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={<ChevronRight className="h-4 w-4" />}
                onClick={() => onOpenDebt(item, "detail")}
              >
                Ver deuda
              </Button>
              {item.can_register_payment ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={<HandCoins className="h-4 w-4" />}
                  onClick={() => onOpenDebt(item, "pay")}
                >
                  {item.payment_action_label}
                </Button>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function UpcomingSection({
  title,
  description,
  items,
  emptyLabel,
  onOpenDetail,
  onMarkPaid,
  onEdit,
  onPause,
  onResume,
  onCancel,
}: {
  title: string;
  description: string;
  items: UpcomingViewItem[];
  emptyLabel: string | null;
  onOpenDetail: (item: UpcomingViewItem) => void;
  onMarkPaid: (item: UpcomingViewItem) => void;
  onEdit: (item: UpcomingViewItem) => void;
  onPause: (item: UpcomingViewItem) => void | Promise<void>;
  onResume: (item: UpcomingViewItem) => void | Promise<void>;
  onCancel: (item: UpcomingViewItem) => void | Promise<void>;
}) {
  if (items.length === 0 && !emptyLabel) return null;

  return (
    <section className="space-y-3">
      <div>
        <h2 className="font-heading text-lg font-semibold tracking-normal text-text">
          {title}
        </h2>
        <p className="mt-1 text-sm text-text-secondary">{description}</p>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-surface-raised px-5 py-6 text-sm text-text-secondary">
          {emptyLabel}
        </div>
      ) : (
        <div className="grid gap-3">
          {items.map((item) => (
            <UpcomingCard
              key={`${item.id}:${item.occurrence_id ?? "rule"}`}
              item={item}
              onOpenDetail={() => onOpenDetail(item)}
              onMarkPaid={() => onMarkPaid(item)}
              onEdit={() => onEdit(item)}
              onPause={() => void onPause(item)}
              onResume={() => void onResume(item)}
              onCancel={() => void onCancel(item)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function UpcomingCard({
  item,
  onOpenDetail,
  onMarkPaid,
  onEdit,
  onPause,
  onResume,
  onCancel,
}: {
  item: UpcomingViewItem;
  onOpenDetail: () => void;
  onMarkPaid: () => void;
  onEdit: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={item.status_tone}>{item.status_label}</Badge>
            <Badge tone="neutral">{item.cadence_label}</Badge>
          </div>
          <h3 className="mt-3 font-heading text-xl font-semibold tracking-normal text-text">
            {item.title}
          </h3>
          <p className="mt-1 text-sm text-text-secondary">
            {item.group === "paid" ? "Pagado" : "Proximo pago"}: {item.due_label}
            {item.category_id ? ` - ${categoryLabels[item.category_id]}` : ""}
          </p>
        </div>

        <div className="shrink-0 text-left lg:text-right">
          <p className="text-xs font-medium text-text-muted">Estimado</p>
          <p className="mt-1 font-heading text-2xl font-semibold text-text">
            <DiscreetValue>
              {formatUpcomingMoney(item.amount, item.currency)}
            </DiscreetValue>
          </p>
          <p className="mt-1 text-xs text-text-muted">
            {item.account_id ? "Cuenta sugerida" : "Sin cuenta sugerida"}
          </p>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-text-secondary">
          <CalendarDays className="h-4 w-4 text-text-muted" />
          <span>{item.due_at ?? "Fecha por revisar"}</span>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<CheckCircle2 className="h-4 w-4" />}
            disabled={!item.can_mark_paid}
            onClick={onMarkPaid}
          >
            {item.payment_action_label}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<ChevronRight className="h-4 w-4" />}
            onClick={onOpenDetail}
          >
            Detalle
          </Button>
          <Button
            variant="ghost"
            size="sm"
            icon={<Edit3 className="h-4 w-4" />}
            onClick={onEdit}
          >
            Editar
          </Button>
          {item.status === "paused" ? (
            <Button
              variant="ghost"
              size="sm"
              icon={<Play className="h-4 w-4" />}
              onClick={onResume}
            >
              Reactivar
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              icon={<Pause className="h-4 w-4" />}
              onClick={onPause}
            >
              Pausar
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancelar
          </Button>
        </div>
      </div>
    </article>
  );
}

function RecurringDetailModal({
  rule,
  accounts,
  loadState,
  error,
  onClose,
  onRetry,
  onMarkPaid,
  onEdit,
  onPause,
  onResume,
  onCancel,
}: {
  rule: RecurringRuleWithOccurrences;
  accounts: Account[];
  loadState: LoadState;
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
  onMarkPaid: (item: UpcomingViewItem) => void;
  onEdit: (rule: RecurringRuleWithOccurrences) => void;
  onPause: (item: UpcomingViewItem) => void | Promise<void>;
  onResume: (item: UpcomingViewItem) => void | Promise<void>;
  onCancel: (item: UpcomingViewItem) => void | Promise<void>;
}) {
  const detail = useMemo(() => toRecurringDetailViewModel(rule), [rule]);
  const paymentItem = useMemo(() => toUpcomingViewItem(rule), [rule]);
  const account =
    accounts.find((item) => item.id === detail.account_id) ?? null;
  const accountLabel = account?.name ?? "Sin cuenta sugerida";
  const categoryLabel = detail.category_label ?? "Sin categoria";
  const isPaused = rule.status === "paused";

  return (
    <div className="fixed inset-0 z-modal flex items-end justify-center bg-black/35 px-3 py-4 sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="recurring-detail-title"
        className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <ModalHeader
          titleId="recurring-detail-title"
          eyebrow="Detalle de pago"
          title={detail.title}
          onClose={onClose}
        />

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
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={detail.status_tone}>{detail.status_label}</Badge>
                  <Badge tone="neutral">{detail.cadence_label}</Badge>
                </div>
                <p className="mt-4 font-heading text-3xl font-semibold tracking-normal text-text">
                  <DiscreetValue>{detail.amount_label}</DiscreetValue>
                </p>
                <p className="mt-2 text-sm text-text-secondary">
                  Proximo: {detail.next_due_label}
                  {detail.next_due_at ? ` - ${detail.next_due_at}` : ""}
                </p>
              </div>
              <div className="grid gap-2 text-sm text-text-secondary sm:min-w-56">
                <DetailInfoRow label="Categoria" value={categoryLabel} />
                <DetailInfoRow label="Cuenta" value={accountLabel} />
                <DetailInfoRow
                  label="Ultimo pago"
                  value={detail.last_paid_label ?? "Sin pagos cerrados"}
                />
              </div>
            </div>
          </section>

          {detail.linked_debt ? (
            <div className="rounded-lg border border-warning-subtle bg-warning-subtle/55 px-4 py-3 text-sm leading-6 text-text-secondary">
              Este pago esta vinculado a una deuda. Registralo desde Deudas para
              evitar duplicar cambios sobre el saldo pendiente.
            </div>
          ) : null}

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/35 px-4 py-3 text-sm leading-6 text-text-secondary">
            Este detalle solo ordena pagos esperados e historial. El saldo cambia
            recien cuando marcas pagado y Core confirma el movimiento.
          </div>

          <div className="flex flex-wrap gap-2 border-y border-border py-4">
            <Button
              variant="secondary"
              size="sm"
              icon={<CheckCircle2 className="h-4 w-4" />}
              disabled={!paymentItem.can_mark_paid}
              onClick={() => onMarkPaid(paymentItem)}
            >
              {paymentItem.payment_action_label}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon={<Edit3 className="h-4 w-4" />}
              onClick={() => onEdit(rule)}
            >
              Editar
            </Button>
            {isPaused ? (
              <Button
                variant="ghost"
                size="sm"
                icon={<Play className="h-4 w-4" />}
                onClick={() => void onResume(paymentItem)}
              >
                Reactivar
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                icon={<Pause className="h-4 w-4" />}
                onClick={() => void onPause(paymentItem)}
              >
                Pausar
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => void onCancel(paymentItem)}>
              Cancelar
            </Button>
          </div>

          <section>
            <div className="flex items-center gap-2">
              <History className="h-4 w-4 text-text-muted" />
              <h3 className="font-heading text-base font-semibold tracking-normal text-text">
                Historial
              </h3>
            </div>

            {detail.timeline.length === 0 ? (
              <div className="mt-3 rounded-lg border border-dashed border-border bg-bg-surface px-4 py-5 text-sm text-text-secondary">
                Aun no hay ocurrencias para mostrar.
              </div>
            ) : (
              <div className="mt-3 divide-y divide-border rounded-lg border border-border bg-bg-primary">
                {detail.timeline.map((occurrence) => (
                  <div
                    key={occurrence.id}
                    className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={occurrence.status_tone}>
                          {occurrence.status_label}
                        </Badge>
                        <span className="text-sm text-text-secondary">
                          {occurrence.date_label} - {occurrence.expected_date}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-text-muted">
                        {occurrence.paid_label
                          ? `${occurrence.paid_label} por Core`
                          : occurrence.can_mark_paid
                          ? "Pendiente de confirmacion real"
                          : "Sin accion financiera pendiente"}
                      </p>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="font-heading text-lg font-semibold text-text">
                        <DiscreetValue>
                          {occurrence.amount_label}
                        </DiscreetValue>
                      </p>
                      <p className="mt-1 text-xs text-text-muted">
                        {occurrence.paid_movement_id
                          ? "Movimiento vinculado"
                          : "Sin movimiento"}
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

function DetailInfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border py-2 last:border-b-0">
      <span className="text-text-muted">{label}</span>
      <span className="truncate font-medium text-text">{value}</span>
    </div>
  );
}

function SuggestedSection({
  candidates,
  detecting,
  busyCandidateId,
  onDetect,
  onAccept,
  onEdit,
  onDiscard,
}: {
  candidates: UpcomingDashboardResponse["candidates"];
  detecting: boolean;
  busyCandidateId: string | null;
  onDetect: () => void;
  onAccept: (candidate: RecurringCandidate) => void;
  onEdit: (candidate: RecurringCandidate) => void;
  onDiscard: (candidate: RecurringCandidate) => void;
}) {
  return (
    <section className="space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="font-heading text-lg font-semibold tracking-normal text-text">
            Sugeridos
          </h2>
          <p className="mt-1 text-sm text-text-secondary">
            Patrones detectados desde movimientos confirmados.
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw className="h-4 w-4" />}
          loading={detecting}
          onClick={onDetect}
        >
          Buscar
        </Button>
      </div>

      {candidates.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-bg-surface-raised px-5 py-6 text-sm text-text-secondary">
          Aun no hay sugerencias automaticas.
        </div>
      ) : (
        <div className="grid gap-3">
          {candidates.map((candidate) => {
            const view = toSuggestedCandidateViewModel(candidate);
            const busy = busyCandidateId === candidate.id;

            return (
              <article
                key={candidate.id}
                className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">Sugerido</Badge>
                      <Badge tone="neutral">{view.frequency_label}</Badge>
                    </div>
                    <h3 className="mt-3 font-heading text-xl font-semibold tracking-normal text-text">
                      {view.title}
                    </h3>
                    <p className="mt-1 text-sm text-text-secondary">
                      {view.evidence_label} - {view.confidence_label}
                      {view.category_label ? ` - ${view.category_label}` : ""}
                    </p>
                  </div>

                  <div className="shrink-0 text-left lg:text-right">
                    <p className="text-xs font-medium text-text-muted">Estimado</p>
                    <p className="mt-1 font-heading text-2xl font-semibold text-text">
                      <DiscreetValue>{view.amount_label}</DiscreetValue>
                    </p>
                    <p className="mt-1 text-xs text-text-muted">
                      {view.category_label ?? "Categoria por revisar"}
                    </p>
                  </div>
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-2 text-sm text-text-secondary">
                    <CalendarDays className="h-4 w-4 text-text-muted" />
                    <span>{view.next_expected_date ?? "Fecha por revisar"}</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      icon={<CheckCircle2 className="h-4 w-4" />}
                      loading={busy}
                      disabled={Boolean(busyCandidateId && !busy)}
                      onClick={() => onAccept(candidate)}
                    >
                      Aceptar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={<Edit3 className="h-4 w-4" />}
                      disabled={Boolean(busyCandidateId)}
                      onClick={() => onEdit(candidate)}
                    >
                      Editar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={Boolean(busyCandidateId && !busy)}
                      onClick={() => onDiscard(candidate)}
                    >
                      Ignorar
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function CandidateConfirmModal({
  candidate,
  accounts,
  onClose,
  onSaved,
}: {
  candidate: RecurringCandidate;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const candidateView = useMemo(
    () => toSuggestedCandidateViewModel(candidate),
    [candidate]
  );
  const [name, setName] = useState(candidateView.title);
  const [amount, setAmount] = useState(
    candidateView.amount ? formatInputMoney(candidateView.amount) : ""
  );
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    candidateView.frequency
  );
  const [amountVariability, setAmountVariability] =
    useState<RecurringAmountVariability>(candidateView.amount_variability);
  const [nextDate, setNextDate] = useState(
    candidateView.next_expected_date ?? todayInputDate()
  );
  const [accountId, setAccountId] = useState("");
  const [categoryId, setCategoryId] = useState<CategoryId | "">(
    candidateView.category_id ?? "servicios_suscripciones"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount);
  const canSubmit =
    name.trim().length >= 2 &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    Boolean(nextDate);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    const payload: ConfirmRecurringCandidatePayload = {
      name: name.trim(),
      expected_amount: roundMoney(numericAmount),
      amount_variability: amountVariability,
      currency: candidateView.currency,
      frequency,
      next_expected_date: nextDate,
      category_id: categoryId || null,
      default_account_id: accountId || null,
    };

    try {
      await confirmRecurringCandidate(candidate.id, payload);
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
        aria-labelledby="candidate-confirm-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <ModalHeader
          titleId="candidate-confirm-title"
          eyebrow="Sugerencia detectada"
          title="Aceptar como pago que viene"
          onClose={onClose}
        />

        <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/35 px-4 py-3 text-sm leading-6 text-text-secondary">
            {candidateView.evidence_label}. Al aceptarla, Manzana crea un pago
            esperado; no registra pago real ni mueve saldos.
          </div>

          <FieldShell label="Nombre" htmlFor="candidate-name">
            <Input
              id="candidate-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
            />
          </FieldShell>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Monto estimado" htmlFor="candidate-amount">
              <Input
                id="candidate-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                type="number"
                min="0.01"
                step="0.01"
              />
            </FieldShell>

            <FieldShell label="Tipo de monto" htmlFor="candidate-variability">
              <Select
                id="candidate-variability"
                value={amountVariability}
                onChange={(event) =>
                  setAmountVariability(event.target.value as RecurringAmountVariability)
                }
              >
                {amountVariabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FieldShell>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Frecuencia" htmlFor="candidate-frequency">
              <Select
                id="candidate-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as RecurringFrequency)}
              >
                {frequencyOptions.map((option) => (
                  <option key={option} value={option}>
                    {frequencyLabels[option]}
                  </option>
                ))}
              </Select>
            </FieldShell>

            <FieldShell label="Proxima fecha" htmlFor="candidate-date">
              <Input
                id="candidate-date"
                value={nextDate}
                onChange={(event) => setNextDate(event.target.value)}
                type="date"
              />
            </FieldShell>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Cuenta sugerida"
              htmlFor="candidate-account"
              hint="Opcional. Aceptar la sugerencia no descuenta saldos."
            >
              <Select
                id="candidate-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Sin cuenta por ahora</option>
                {accounts
                  .filter((account) => account.currency === candidateView.currency)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} -{" "}
                      {formatUpcomingMoney(account.current_balance, candidateView.currency)}
                    </option>
                  ))}
              </Select>
            </FieldShell>

            <FieldShell label="Categoria" htmlFor="candidate-category">
              <Select
                id="candidate-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value as CategoryId | "")}
              >
                <option value="">Sin categoria</option>
                {CATEGORY_IDS.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </Select>
            </FieldShell>
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
              Aceptar sugerencia
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function RuleModal({
  mode,
  rule,
  accounts,
  onClose,
  onSaved,
}: {
  mode: RuleModalMode;
  rule?: RecurringRuleWithOccurrences;
  accounts: Account[];
  onClose: () => void;
  onSaved: (message: string) => void | Promise<void>;
}) {
  const [name, setName] = useState(rule?.name ?? "");
  const [amount, setAmount] = useState(
    rule?.expected_amount ? formatInputMoney(rule.expected_amount) : ""
  );
  const [frequency, setFrequency] = useState<RecurringFrequency>(
    rule?.frequency ?? "monthly"
  );
  const [amountVariability, setAmountVariability] =
    useState<RecurringAmountVariability>(rule?.amount_variability ?? "fixed");
  const [nextDate, setNextDate] = useState(rule?.next_expected_date ?? todayInputDate());
  const [accountId, setAccountId] = useState(rule?.default_account_id ?? "");
  const [categoryId, setCategoryId] = useState<CategoryId | "">(
    rule?.category_id ?? "servicios_suscripciones"
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const numericAmount = Number(amount);
  const canSubmit =
    name.trim().length >= 2 &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0 &&
    Boolean(nextDate);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || submitting) return;

    setSubmitting(true);
    setError(null);

    const payload: CreateRecurringPayload = {
      name: name.trim(),
      expected_amount: roundMoney(numericAmount),
      amount_variability: amountVariability,
      currency: "PEN",
      frequency,
      next_expected_date: nextDate,
      category_id: categoryId || null,
      default_account_id: accountId || null,
    };

    try {
      if (mode === "edit" && rule) {
        const updatePayload: UpdateRecurringPayload = {
          name: payload.name,
          expected_amount: payload.expected_amount,
          amount_variability: payload.amount_variability,
          frequency: payload.frequency,
          next_expected_date: payload.next_expected_date,
          category_id: payload.category_id,
          default_account_id: payload.default_account_id,
        };
        await updateRecurringRule(rule.id, updatePayload);
        await onSaved("Pago actualizado. Sigue sin tocar saldos hasta confirmarlo.");
      } else {
        await createRecurringRule(payload);
        await onSaved("Pago guardado. Queda como esperado, sin mover saldos.");
      }
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
        aria-labelledby="recurring-rule-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <ModalHeader
          titleId="recurring-rule-title"
          eyebrow={mode === "edit" ? "Editar pago" : "Registro manual"}
          title={mode === "edit" ? "Editar pago que viene" : "Agregar pago que viene"}
          onClose={onClose}
        />

        <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
          <FieldShell label="Nombre" htmlFor="recurring-name" hint="Ej. Netflix, alquiler, internet.">
            <Input
              id="recurring-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ej. Internet"
              maxLength={120}
            />
          </FieldShell>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Monto estimado" htmlFor="recurring-amount">
              <Input
                id="recurring-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                type="number"
                min="0.01"
                step="0.01"
              />
            </FieldShell>

            <FieldShell label="Tipo de monto" htmlFor="recurring-variability">
              <Select
                id="recurring-variability"
                value={amountVariability}
                onChange={(event) =>
                  setAmountVariability(event.target.value as RecurringAmountVariability)
                }
              >
                {amountVariabilityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </FieldShell>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Frecuencia" htmlFor="recurring-frequency">
              <Select
                id="recurring-frequency"
                value={frequency}
                onChange={(event) => setFrequency(event.target.value as RecurringFrequency)}
              >
                {frequencyOptions.map((option) => (
                  <option key={option} value={option}>
                    {frequencyLabels[option]}
                  </option>
                ))}
              </Select>
            </FieldShell>

            <FieldShell label="Proxima fecha" htmlFor="recurring-date">
              <Input
                id="recurring-date"
                value={nextDate}
                onChange={(event) => setNextDate(event.target.value)}
                type="date"
              />
            </FieldShell>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell
              label="Cuenta sugerida"
              htmlFor="recurring-account"
              hint="Opcional. Puedes pagar sin cuenta si aun no quieres tocar saldos."
            >
              <Select
                id="recurring-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Sin cuenta por ahora</option>
                {accounts
                  .filter((account) => account.currency === "PEN")
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} - {formatUpcomingMoney(account.current_balance)}
                    </option>
                  ))}
              </Select>
            </FieldShell>

            <FieldShell label="Categoria" htmlFor="recurring-category">
              <Select
                id="recurring-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value as CategoryId | "")}
              >
                <option value="">Sin categoria</option>
                {CATEGORY_IDS.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabels[category]}
                  </option>
                ))}
              </Select>
            </FieldShell>
          </div>

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/35 px-4 py-3 text-sm leading-6 text-text-secondary">
            Te avisare para que no se te pase. Guardarlo no descuenta dinero ni
            crea movimiento financiero.
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
              Guardar pago
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function MarkPaidModal({
  item,
  accounts,
  onClose,
  onSaved,
}: {
  item: UpcomingViewItem;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const [accountId, setAccountId] = useState(item.account_id ?? "");
  const [amount, setAmount] = useState(formatInputMoney(item.amount));
  const [paidDate, setPaidDate] = useState(todayInputDate());
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const matchingAccounts = accounts.filter(
    (account) => account.currency === item.currency
  );
  const selectedAccount =
    matchingAccounts.find((account) => account.id === accountId) ?? null;
  const numericAmount = Number(amount);
  const canSubmit =
    Boolean(item.occurrence_id) &&
    Number.isFinite(numericAmount) &&
    numericAmount > 0;
  const submitLabel = item.is_future ? "Guardar adelanto" : "Guardar pago";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !item.occurrence_id || submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      await markRecurringPaid(item.id, item.occurrence_id, {
        amount: roundMoney(numericAmount),
        account_id: accountId || null,
        paid_at: toPaymentIso(paidDate),
        note: note.trim() || null,
      });
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
        aria-labelledby="mark-paid-title"
        className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl border border-border bg-bg-surface-raised shadow-xl"
      >
        <ModalHeader
          titleId="mark-paid-title"
          eyebrow={item.is_future ? "Pago adelantado" : "Pago confirmado"}
          title={item.title}
          onClose={onClose}
        />

        <form className="space-y-5 px-5 py-5" onSubmit={handleSubmit}>
          {item.is_future ? (
            <div className="rounded-lg border border-warning-subtle bg-warning-subtle/55 px-4 py-3 text-sm leading-6 text-text-secondary">
              Estas registrando antes de fecha la ocurrencia del{" "}
              <span className="font-medium text-text">
                {item.due_at ?? "proximo vencimiento"}
              </span>
              . Manzana cerrara esa ocurrencia y dejara listo el siguiente ciclo.
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <FieldShell label="Monto pagado" htmlFor="mark-paid-amount">
              <Input
                id="mark-paid-amount"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                inputMode="decimal"
                type="number"
                min="0.01"
                step="0.01"
              />
            </FieldShell>

            <FieldShell label="Fecha" htmlFor="mark-paid-date">
              <Input
                id="mark-paid-date"
                value={paidDate}
                onChange={(event) => setPaidDate(event.target.value)}
                type="date"
              />
            </FieldShell>
          </div>

          <FieldShell
            label="Cuenta desde donde pagaste"
            htmlFor="mark-paid-account"
            hint="Si lo dejas sin cuenta, Manzana registra el pago sin tocar saldos."
          >
            <Select
              id="mark-paid-account"
              value={accountId}
              onChange={(event) => setAccountId(event.target.value)}
            >
              <option value="">Sin cuenta por ahora</option>
              {matchingAccounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name} - {formatUpcomingMoney(account.current_balance, item.currency)}
                </option>
              ))}
            </Select>
          </FieldShell>

          <FieldShell label="Nota" htmlFor="mark-paid-note" hint="Opcional.">
            <Input
              id="mark-paid-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Ej. Pagado desde app"
              maxLength={180}
            />
          </FieldShell>

          <div className="rounded-lg border border-brand-subtle bg-brand-subtle/35 px-4 py-3 text-sm leading-6 text-text-secondary">
            {selectedAccount ? (
              <>
                Manzana creara un movimiento recurrente y descontara saldo de{" "}
                <span className="font-medium text-text">{selectedAccount.name}</span>{" "}
                por Core.
              </>
            ) : (
              "Manzana creara un movimiento recurrente confirmado, pero no tocara saldos de cuenta."
            )}
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
              {submitLabel}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalHeader({
  titleId,
  eyebrow,
  title,
  onClose,
}: {
  titleId: string;
  eyebrow: string;
  title: string;
  onClose: () => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
      <div>
        <p className="text-xs font-medium text-text-muted">{eyebrow}</p>
        <h2
          id={titleId}
          className="font-heading text-xl font-semibold tracking-normal text-text"
        >
          {title}
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
  );
}

function compareUpcomingItems(left: UpcomingViewItem, right: UpcomingViewItem): number {
  const leftDue = left.due_at ?? "9999-12-31";
  const rightDue = right.due_at ?? "9999-12-31";
  return leftDue.localeCompare(rightDue);
}

function formatInputMoney(value: number): string {
  return value.toFixed(2).replace(/\.00$/, "");
}

function todayInputDate(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function toPaymentIso(dateValue: string): string {
  const fallback = new Date();

  if (dateValue === todayInputDate()) {
    return fallback.toISOString();
  }

  const date = dateValue ? new Date(`${dateValue}T12:00:00`) : fallback;

  if (Number.isNaN(date.getTime())) return fallback.toISOString();
  return date.toISOString();
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function toUiError(error: unknown): string {
  if (error instanceof ApiClientError) return error.message;
  if (error instanceof Error && error.message.trim()) return error.message;
  return "Ocurrio un error inesperado.";
}
