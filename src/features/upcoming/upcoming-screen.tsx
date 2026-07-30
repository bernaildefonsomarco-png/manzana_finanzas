"use client";

import {
  useState,
  type FormEvent,
} from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarDays,
  Check,
  History,
  List,
  Pause,
  Play,
  Plus,
  SkipForward,
  WalletCards,
} from "lucide-react";
import {
  AppShell,
  type AppView,
} from "@/features/app-shell/app-shell";
import {
  ApiClientError,
  clientIdempotencyKey,
} from "@/shared/api/http-client";
import { queryKeys } from "@/shared/data/query-keys";
import {
  limaLocalInputToUtcIso,
  todayInLima,
  toIsoDate,
} from "@/shared/dates/lima";
import { parseMoneyInput } from "@/shared/money/parse-money-input";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import type {
  Account,
  CategoryId,
  RecurringAmountVariability,
  RecurringFrequency,
} from "@/shared/types/domain";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/ui/primitivas/alert-dialog";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";
import { DatePicker } from "@/ui/primitivas/date-picker";
import { Dialog, DialogContent } from "@/ui/primitivas/dialog";
import {
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/ui/primitivas/dialog-parts";
import { FieldShell, Input, Label, Select } from "@/ui/primitivas/field";
import { DiscreetValue, MoneyText } from "@/ui/primitivas/money";
import {
  EmptyState,
  ErrorState,
  SkeletonCard,
} from "@/ui/primitivas/states";
import { Textarea } from "@/ui/primitivas/textarea";
import {
  cancelRecurringRule,
  confirmRecurringCandidate,
  createRecurringRule,
  discardRecurringCandidate,
  listRecurringAccounts,
  listRecurringOccurrences,
  listUpcomingPayments,
  markRecurringPaid,
  pauseRecurringRule,
  resumeRecurringRule,
  skipRecurringOccurrence,
  updateRecurringRule,
} from "./upcoming-api";
import type {
  ConfirmRecurringCandidatePayload,
  CreateRecurringPayload,
  RecurringRuleWithOccurrences,
  SuggestedCandidateViewModel,
  UpcomingViewItem,
} from "./upcoming-types";
import {
  amountVariabilityLabels,
  buildUpcomingViewModel,
  categoryLabels,
  formatFullDate,
  formatUpcomingMoney,
  frequencyLabels,
  toRecurringHistoryView,
  type UpcomingViewModel,
} from "./upcoming-view-model";

const UPCOMING_QUERY_KEY = [
  ...queryKeys.recurringRules.all,
  "upcoming",
] as const;

type UpcomingScreenProps = {
  onNavigate?: (view: AppView) => void;
  onSignOut?: () => void;
  onOpenDebt?: (intent: {
    debtId: string;
    installmentId?: string;
    action: "detail" | "pay";
  }) => void;
};

type EditorTarget =
  | { mode: "create" }
  | { mode: "edit"; rule: RecurringRuleWithOccurrences }
  | { mode: "candidate"; candidate: SuggestedCandidateViewModel };

type RiskAction =
  | { kind: "skip"; item: UpcomingViewItem }
  | { kind: "cancel"; item: UpcomingViewItem };

type QuickAction =
  | { kind: "pause"; ruleId: string }
  | { kind: "resume"; ruleId: string }
  | { kind: "discard"; candidateId: string }
  | { kind: "skip"; ruleId: string; occurrenceId: string }
  | { kind: "cancel"; ruleId: string };

export function UpcomingScreen({
  onNavigate,
  onSignOut,
  onOpenDebt,
}: UpcomingScreenProps) {
  const queryClient = useQueryClient();
  const { discreet } = useDiscreetMode();
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const [paymentItem, setPaymentItem] = useState<UpcomingViewItem | null>(null);
  const [historyItem, setHistoryItem] = useState<UpcomingViewItem | null>(null);
  const [riskAction, setRiskAction] = useState<RiskAction | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const todayParts = todayInLima();
  const todayIso = toIsoDate(
    todayParts.year,
    todayParts.month,
    todayParts.day
  );

  const upcomingQuery = useQuery({
    queryKey: UPCOMING_QUERY_KEY,
    queryFn: listUpcomingPayments,
  });
  const accountsQuery = useQuery({
    queryKey: queryKeys.accounts,
    queryFn: listRecurringAccounts,
  });
  const view = upcomingQuery.data
    ? buildUpcomingViewModel(upcomingQuery.data, todayIso)
    : null;

  const quickMutation = useMutation({
    mutationFn: async (action: QuickAction) => {
      if (action.kind === "pause") return pauseRecurringRule(action.ruleId);
      if (action.kind === "resume") return resumeRecurringRule(action.ruleId);
      if (action.kind === "discard") {
        return discardRecurringCandidate(action.candidateId);
      }
      if (action.kind === "skip") {
        return skipRecurringOccurrence(
          action.ruleId,
          action.occurrenceId
        );
      }
      return cancelRecurringRule(action.ruleId);
    },
    onSuccess: async (_result, action) => {
      await queryClient.invalidateQueries({
        queryKey: queryKeys.recurringRules.all,
      });
      setRiskAction(null);
      setFeedback({
        tone: "success",
        message: successMessage(action.kind),
      });
    },
    onError: (error) => {
      setFeedback({ tone: "error", message: mutationErrorMessage(error) });
    },
  });

  function runQuickAction(action: QuickAction) {
    setFeedback(null);
    quickMutation.mutate(action);
  }

  const primaryAction = (
    <Button icon={<Plus className="h-4 w-4" />} onClick={() => setEditor({ mode: "create" })}>
      Agregar
    </Button>
  );

  return (
    <AppShell
      title="Pagos que vienen"
      subtitle="Compromisos próximos, pendientes y sugerencias que tú controlas."
      activeView="upcoming"
      primaryAction={primaryAction}
      mobilePrimaryAction={primaryAction}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto max-w-5xl space-y-6">
        {feedback ? (
          <div
            role={feedback.tone === "error" ? "alert" : "status"}
            className={
              feedback.tone === "error"
                ? "rounded-lg border border-error-subtle bg-error-subtle/30 px-4 py-3 text-sm text-error-on-subtle"
                : feedback.tone === "warning"
                  ? "rounded-lg border border-warning-subtle bg-warning-subtle px-4 py-3 text-sm text-warning-on-subtle"
                  : "rounded-lg border border-success-subtle bg-success-subtle px-4 py-3 text-sm text-success-on-subtle"
            }
          >
            {feedback.message}
          </div>
        ) : null}

        {upcomingQuery.isLoading ? (
          <div role="status" aria-label="Cargando pagos que vienen" className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : upcomingQuery.isError ? (
          <ErrorState
            title="No pude cargar tus pagos que vienen"
            description="Tus datos no cambiaron. Intenta de nuevo en un momento."
            onRetry={() => void upcomingQuery.refetch()}
          />
        ) : view ? (
          <>
            <UpcomingSummaryCard view={view} />
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-text-secondary">
                Horizonte de {upcomingQuery.data?.horizon_days ?? 30} días ·{" "}
                {upcomingQuery.data?.timezone ?? "America/Lima"}
              </p>
              {view.has_commitments ? (
                <div
                  role="group"
                  aria-label="Vista de compromisos"
                  className="inline-flex rounded-lg border border-border bg-bg-surface-raised p-1"
                >
                  <Button
                    size="sm"
                    variant={viewMode === "list" ? "quiet" : "ghost"}
                    aria-pressed={viewMode === "list"}
                    icon={<List className="h-4 w-4" />}
                    onClick={() => setViewMode("list")}
                  >
                    Lista
                  </Button>
                  <Button
                    size="sm"
                    variant={viewMode === "calendar" ? "quiet" : "ghost"}
                    aria-pressed={viewMode === "calendar"}
                    icon={<CalendarDays className="h-4 w-4" />}
                    onClick={() => setViewMode("calendar")}
                  >
                    Calendario
                  </Button>
                </div>
              ) : null}
            </div>

            {!view.has_commitments && view.candidates.length === 0 ? (
              <EmptyState
                icon={<CalendarDays className="h-6 w-6" />}
                title="No tienes pagos que vienen registrados"
                description="Cuando note que algo se repite, te lo sugiero."
                action={
                  <Button onClick={() => setEditor({ mode: "create" })}>
                    Agregar un pago que viene
                  </Button>
                }
              />
            ) : (
              <>
                {viewMode === "calendar" ? (
                  <CommitmentsCalendar
                    items={view.calendar_items}
                    discreet={discreet}
                    onOpen={(item) => {
                      if (item.kind === "debt" && item.debt_id) {
                        onOpenDebt?.({
                          debtId: item.debt_id,
                          installmentId: item.installment_id ?? undefined,
                          action: "detail",
                        });
                      } else {
                        setHistoryItem(item);
                      }
                    }}
                  />
                ) : view.has_commitments ? (
                  <UpcomingSectionsList
                    view={view}
                    discreet={discreet}
                    mutationPending={quickMutation.isPending}
                    onEdit={(item) => {
                      if (item.rule) {
                        setEditor({ mode: "edit", rule: item.rule });
                      }
                    }}
                    onHistory={setHistoryItem}
                    onMarkPaid={setPaymentItem}
                    onPause={(item) => {
                      if (item.recurring_rule_id) {
                        runQuickAction({
                          kind: "pause",
                          ruleId: item.recurring_rule_id,
                        });
                      }
                    }}
                    onResume={(item) => {
                      if (item.recurring_rule_id) {
                        runQuickAction({
                          kind: "resume",
                          ruleId: item.recurring_rule_id,
                        });
                      }
                    }}
                    onRisk={setRiskAction}
                    onOpenDebt={onOpenDebt}
                  />
                ) : null}

                <SuggestionsSection
                  candidates={view.candidates}
                  discreet={discreet}
                  mutationPending={quickMutation.isPending}
                  onAccept={(candidate) =>
                    setEditor({ mode: "candidate", candidate })
                  }
                  onDiscard={(candidate) =>
                    runQuickAction({
                      kind: "discard",
                      candidateId: candidate.id,
                    })
                  }
                />
              </>
            )}
          </>
        ) : null}
      </div>

      {editor ? (
        <RecurringEditorDialog
          target={editor}
          accounts={accountsQuery.data?.accounts ?? []}
          todayIso={todayIso}
          onClose={() => setEditor(null)}
          onSaved={async (message) => {
            await queryClient.invalidateQueries({
              queryKey: queryKeys.recurringRules.all,
            });
            setEditor(null);
            setFeedback({ tone: "success", message });
          }}
        />
      ) : null}

      {paymentItem ? (
        <PaymentDialog
          item={paymentItem}
          accounts={accountsQuery.data?.accounts ?? []}
          todayIso={todayIso}
          onClose={() => setPaymentItem(null)}
          onSaved={async (expectedUpdateFailed) => {
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: queryKeys.recurringRules.all,
              }),
              queryClient.invalidateQueries({
                queryKey: queryKeys.movements.all,
              }),
              queryClient.invalidateQueries({
                queryKey: queryKeys.summary,
              }),
            ]);
            setPaymentItem(null);
            setFeedback(
              expectedUpdateFailed
                ? {
                    tone: "warning",
                    message:
                      "El pago sí quedó registrado. No pude actualizar el monto esperado; puedes editarlo después.",
                  }
                : {
                    tone: "success",
                    message: "El pago quedó registrado como movimiento real.",
                  }
            );
          }}
        />
      ) : null}

      {historyItem?.rule ? (
        <HistoryDialog
          item={historyItem}
          todayIso={todayIso}
          onClose={() => setHistoryItem(null)}
        />
      ) : null}

      <RiskActionDialog
        action={riskAction}
        pending={quickMutation.isPending}
        onClose={() => setRiskAction(null)}
        onConfirm={() => {
          if (!riskAction?.item.recurring_rule_id) return;
          if (riskAction.kind === "cancel") {
            runQuickAction({
              kind: "cancel",
              ruleId: riskAction.item.recurring_rule_id,
            });
          } else if (riskAction.item.occurrence_id) {
            runQuickAction({
              kind: "skip",
              ruleId: riskAction.item.recurring_rule_id,
              occurrenceId: riskAction.item.occurrence_id,
            });
          }
        }}
      />
    </AppShell>
  );
}

function UpcomingSummaryCard({ view }: { view: UpcomingViewModel }) {
  return (
    <Card className="grid gap-4 p-5 sm:grid-cols-3">
      <div>
        <p className="text-xs font-medium text-text-muted">Este mes</p>
        <p className="mt-1 font-heading text-2xl font-semibold text-text">
          <MoneyText value={view.summary.month_totals.PEN} />
          {view.summary.month_totals.USD > 0 ? (
            <span className="ml-2 text-base">
              +{" "}
              <DiscreetValue>
                {formatUpcomingMoney(view.summary.month_totals.USD, "USD")}
              </DiscreetValue>
            </span>
          ) : null}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          {view.summary.month_count} compromisos
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-text-muted">Pendientes</p>
        <p className="mt-1 font-heading text-2xl font-semibold text-text">
          {view.summary.pending_count}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          Incluye atrasos con lenguaje prudente
        </p>
      </div>
      <div>
        <p className="text-xs font-medium text-text-muted">Con caja vinculada</p>
        <p className="mt-1 font-heading text-2xl font-semibold text-text">
          {view.summary.linked_box_count}
        </p>
        <p className="mt-1 text-xs text-text-secondary">
          La cobertura exacta se calcula en tu dinero libre
        </p>
      </div>
    </Card>
  );
}

function UpcomingSectionsList({
  view,
  discreet,
  mutationPending,
  onEdit,
  onHistory,
  onMarkPaid,
  onPause,
  onResume,
  onRisk,
  onOpenDebt,
}: {
  view: UpcomingViewModel;
  discreet: boolean;
  mutationPending: boolean;
  onEdit: (item: UpcomingViewItem) => void;
  onHistory: (item: UpcomingViewItem) => void;
  onMarkPaid: (item: UpcomingViewItem) => void;
  onPause: (item: UpcomingViewItem) => void;
  onResume: (item: UpcomingViewItem) => void;
  onRisk: (action: RiskAction) => void;
  onOpenDebt?: UpcomingScreenProps["onOpenDebt"];
}) {
  const sections = [
    {
      key: "this_week" as const,
      title: "Esta semana",
      empty: "No hay compromisos en los próximos siete días.",
    },
    {
      key: "later" as const,
      title: "Más adelante",
      empty: "No hay otros compromisos en el horizonte.",
    },
    {
      key: "pending" as const,
      title: "Pendientes",
      empty: "No hay pagos pendientes.",
    },
  ];

  return (
    <div className="space-y-7">
      {sections.map((section) => (
        <section key={section.key} aria-labelledby={`upcoming-${section.key}`}>
          <h2
            id={`upcoming-${section.key}`}
            className="font-heading text-lg font-semibold text-text"
          >
            {section.title}
          </h2>
          {view.sections[section.key].length === 0 ? (
            <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-text-muted">
              {section.empty}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {view.sections[section.key].map((item) => (
                <UpcomingItemCard
                  key={item.key}
                  item={item}
                  discreet={discreet}
                  mutationPending={mutationPending}
                  onEdit={() => onEdit(item)}
                  onHistory={() => onHistory(item)}
                  onMarkPaid={() => onMarkPaid(item)}
                  onPause={() => onPause(item)}
                  onResume={() => onResume(item)}
                  onSkip={() => onRisk({ kind: "skip", item })}
                  onCancel={() => onRisk({ kind: "cancel", item })}
                  onOpenDebt={(action) => {
                    if (!item.debt_id) return;
                    onOpenDebt?.({
                      debtId: item.debt_id,
                      installmentId: item.installment_id ?? undefined,
                      action,
                    });
                  }}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}

function UpcomingItemCard({
  item,
  discreet,
  mutationPending,
  onEdit,
  onHistory,
  onMarkPaid,
  onPause,
  onResume,
  onSkip,
  onCancel,
  onOpenDebt,
}: {
  item: UpcomingViewItem;
  discreet: boolean;
  mutationPending: boolean;
  onEdit: () => void;
  onHistory: () => void;
  onMarkPaid: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkip: () => void;
  onCancel: () => void;
  onOpenDebt: (action: "detail" | "pay") => void;
}) {
  const visibleTitle = discreet ? item.discreet_title : item.title;

  return (
    <Card
      className="grid gap-4 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
      aria-label={`${visibleTitle}, ${item.due_label}, ${item.status_label}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-heading font-semibold text-text">
            {visibleTitle}
          </h3>
          <Badge tone={item.status_tone}>{item.status_label}</Badge>
          {item.kind === "debt" ? <Badge tone="debt">Cuota de deuda</Badge> : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-text-secondary">
          <span>{item.due_label}</span>
          <UpcomingMoney amount={item.amount} currency={item.currency} />
          {item.linked_box_label ? (
            <span className="inline-flex items-center gap-1">
              <WalletCards className="h-4 w-4" aria-hidden="true" />
              {item.linked_box_label}
            </span>
          ) : null}
        </div>
        {item.alert ? (
          <p role="alert" className="mt-2 text-sm text-warning-on-subtle">
            Este pago lleva al menos tres días pendiente con una fecha confirmada.
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2 sm:justify-end">
        {item.kind === "debt" ? (
          <>
            <Button size="sm" variant="secondary" onClick={() => onOpenDebt("detail")}>
              Ver deuda
            </Button>
            <Button size="sm" onClick={() => onOpenDebt("pay")}>
              Registrar pago
            </Button>
          </>
        ) : (
          <>
            {item.can_mark_paid ? (
              <Button
                size="sm"
                icon={<Check className="h-4 w-4" />}
                onClick={onMarkPaid}
              >
                Pagué
              </Button>
            ) : null}
            {item.can_resume ? (
              <Button
                size="sm"
                variant="secondary"
                loading={mutationPending}
                icon={<Play className="h-4 w-4" />}
                onClick={onResume}
              >
                Reactivar
              </Button>
            ) : null}
            <Button size="sm" variant="ghost" onClick={onHistory}>
              Historial
            </Button>
            {item.rule ? (
              <Button size="sm" variant="ghost" onClick={onEdit}>
                Editar
              </Button>
            ) : null}
            {item.recurring_rule_id ? (
              <a
                href={`/pagos-que-vienen/${item.recurring_rule_id}`}
                className="inline-flex h-9 items-center rounded-md border border-transparent px-3 font-heading text-sm font-medium text-text-secondary transition hover:bg-bg-surface hover:text-text focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
              >
                Detalle
              </a>
            ) : null}
            {item.can_skip ? (
              <Button
                size="sm"
                variant="ghost"
                icon={<SkipForward className="h-4 w-4" />}
                onClick={onSkip}
              >
                Saltar
              </Button>
            ) : null}
            {item.can_pause ? (
              <Button
                size="sm"
                variant="ghost"
                loading={mutationPending}
                icon={<Pause className="h-4 w-4" />}
                onClick={onPause}
              >
                Pausar
              </Button>
            ) : null}
            {item.rule ? (
              <Button size="sm" variant="ghost" onClick={onCancel}>
                Cancelar
              </Button>
            ) : null}
          </>
        )}
      </div>
    </Card>
  );
}

function SuggestionsSection({
  candidates,
  discreet,
  mutationPending,
  onAccept,
  onDiscard,
}: {
  candidates: SuggestedCandidateViewModel[];
  discreet: boolean;
  mutationPending: boolean;
  onAccept: (candidate: SuggestedCandidateViewModel) => void;
  onDiscard: (candidate: SuggestedCandidateViewModel) => void;
}) {
  return (
    <section aria-labelledby="upcoming-suggestions">
      <h2
        id="upcoming-suggestions"
        className="font-heading text-lg font-semibold text-text"
      >
        Sugerencias
      </h2>
      {candidates.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-border px-4 py-5 text-sm text-text-muted">
          No hay sugerencias nuevas.
        </p>
      ) : (
        <div className="mt-3 space-y-3">
          {candidates.map((candidate) => (
            <Card key={candidate.id} className="p-4">
              <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
                <div>
                  <h3 className="font-heading font-semibold text-text">
                    ¿{discreet ? candidate.discreet_title : candidate.title} se repite?
                  </h3>
                  <p className="mt-1 text-sm text-text-secondary">
                    <UpcomingMoney
                      amount={candidate.amount}
                      currency={candidate.currency}
                    />{" "}
                    · {candidate.frequency_label} · {candidate.next_label}
                  </p>
                  <p className="mt-3 text-sm text-text-secondary">
                    {discreet
                      ? "Evidencia oculta por modo discreto."
                      : candidate.evidence_label}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 sm:justify-end">
                  <Button size="sm" onClick={() => onAccept(candidate)}>
                    Sí, es un pago que viene
                  </Button>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={mutationPending}
                    onClick={() => onDiscard(candidate)}
                  >
                    No
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

function CommitmentsCalendar({
  items,
  discreet,
  onOpen,
}: {
  items: UpcomingViewItem[];
  discreet: boolean;
  onOpen: (item: UpcomingViewItem) => void;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={<CalendarDays className="h-6 w-6" />}
        title="No hay compromisos en el calendario"
        description="Las sugerencias aparecen debajo y no entran al calendario hasta que tú las confirmas."
      />
    );
  }

  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] border-collapse text-left text-sm">
        <caption className="sr-only">
          Calendario accesible de compromisos de los próximos treinta días
        </caption>
        <thead>
          <tr className="border-b border-border bg-bg-surface">
            <th scope="col" className="px-4 py-3 font-medium text-text-secondary">
              Fecha
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-text-secondary">
              Compromiso
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-text-secondary">
              Monto
            </th>
            <th scope="col" className="px-4 py-3 font-medium text-text-secondary">
              Estado
            </th>
            <th scope="col" className="px-4 py-3">
              <span className="sr-only">Acciones</span>
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.key} className="border-b border-border last:border-b-0">
              <td className="whitespace-nowrap px-4 py-3">
                {formatFullDate(item.due_at)}
              </td>
              <td className="px-4 py-3 font-medium text-text">
                {discreet ? item.discreet_title : item.title}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <UpcomingMoney amount={item.amount} currency={item.currency} />
              </td>
              <td className="px-4 py-3">
                <Badge tone={item.status_tone}>{item.status_label}</Badge>
              </td>
              <td className="px-4 py-3 text-right">
                <Button size="sm" variant="ghost" onClick={() => onOpen(item)}>
                  Abrir
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function UpcomingMoney({
  amount,
  currency,
}: {
  amount: number | null;
  currency: "PEN" | "USD";
}) {
  if (currency === "PEN") return <MoneyText value={amount} />;
  return (
    <DiscreetValue>
      {amount === null ? "Monto por revisar" : formatUpcomingMoney(amount, currency)}
    </DiscreetValue>
  );
}

function RecurringEditorDialog({
  target,
  accounts,
  todayIso,
  onClose,
  onSaved,
}: {
  target: EditorTarget;
  accounts: Account[];
  todayIso: string;
  onClose: () => void;
  onSaved: (message: string) => Promise<void>;
}) {
  const base =
    target.mode === "edit"
      ? {
          name: target.rule.name,
          amount: target.rule.expected_amount?.toString() ?? "",
          amountVariability: target.rule.amount_variability,
          currency: target.rule.currency,
          frequency: target.rule.frequency,
          nextDate: target.rule.next_expected_date ?? todayIso,
          categoryId: target.rule.category_id ?? "",
          accountId: target.rule.default_account_id ?? "",
        }
      : target.mode === "candidate"
        ? {
            name: target.candidate.title,
            amount: target.candidate.amount?.toString() ?? "",
            amountVariability: target.candidate.amount_variability,
            currency: target.candidate.currency,
            frequency: target.candidate.frequency,
            nextDate: target.candidate.next_expected_date ?? todayIso,
            categoryId: target.candidate.category_id ?? "",
            accountId: "",
          }
        : {
            name: "",
            amount: "",
            amountVariability: "fixed" as RecurringAmountVariability,
            currency: "PEN" as const,
            frequency: "monthly" as RecurringFrequency,
            nextDate: todayIso,
            categoryId: "",
            accountId: "",
          };
  const [name, setName] = useState(base.name);
  const [amountRaw, setAmountRaw] = useState(base.amount);
  const [amountVariability, setAmountVariability] =
    useState<RecurringAmountVariability>(base.amountVariability);
  const [currency, setCurrency] = useState<"PEN" | "USD">(base.currency);
  const [frequency, setFrequency] =
    useState<RecurringFrequency>(base.frequency);
  const [nextDate, setNextDate] = useState(base.nextDate);
  const [categoryId, setCategoryId] = useState(base.categoryId);
  const [accountId, setAccountId] = useState(base.accountId);
  const [validationError, setValidationError] = useState<string | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      const normalizedName = name.trim();
      const amount = parseMoneyInput(amountRaw);
      if (normalizedName.length < 1 || normalizedName.length > 60) {
        throw new FormValidationError(
          "El nombre debe tener entre 1 y 60 caracteres."
        );
      }
      if (
        (amountRaw.trim() !== "" && (amount === null || amount <= 0)) ||
        (amountVariability === "fixed" && amount === null)
      ) {
        throw new FormValidationError(
          amountVariability === "fixed"
            ? "¿De cuánto suele ser?"
            : "Si agregas una estimación, tiene que ser mayor que cero."
        );
      }
      if (nextDate < todayIso && target.mode !== "edit") {
        throw new FormValidationError(
          "La próxima fecha no puede ser anterior a hoy."
        );
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) {
        throw new FormValidationError("Elige una fecha válida.");
      }

      const payload: CreateRecurringPayload = {
        name: normalizedName,
        expected_amount: amount,
        amount_variability: amountVariability,
        currency,
        frequency,
        next_expected_date: nextDate,
        category_id: (categoryId || null) as CategoryId | null,
        default_account_id: accountId || null,
      };

      if (target.mode === "create") {
        await createRecurringRule(payload);
        return "Pago que viene agregado.";
      }
      if (target.mode === "candidate") {
        const candidatePayload: ConfirmRecurringCandidatePayload = payload;
        await confirmRecurringCandidate(target.candidate.id, candidatePayload);
        return "Sugerencia confirmada y activada.";
      }
      await updateRecurringRule(target.rule.id, {
        name: payload.name,
        expected_amount: payload.expected_amount,
        amount_variability: payload.amount_variability,
        frequency: payload.frequency,
        next_expected_date: payload.next_expected_date,
        category_id: payload.category_id,
        default_account_id: payload.default_account_id,
      });
      return "Pago que viene actualizado.";
    },
    onSuccess: onSaved,
    onError: (error) => {
      setValidationError(mutationErrorMessage(error));
    },
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setValidationError(null);
    mutation.mutate();
  }

  const title =
    target.mode === "create"
      ? "Agregar pago que viene"
      : target.mode === "candidate"
        ? "Confirmar sugerencia"
        : "Editar pago que viene";
  const description =
    target.mode === "candidate"
      ? "Revisa la evidencia y los datos. Solo se activa cuando tú confirmas."
      : "Esto crea o cambia un compromiso esperado; no mueve dinero de ninguna cuenta.";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {target.mode === "candidate" ? (
          <div className="mb-4 rounded-lg border border-info-subtle bg-info-subtle px-4 py-3 text-sm text-info-on-subtle">
            <p className="font-medium">Evidencia</p>
            <p className="mt-1">{target.candidate.evidence_label}</p>
          </div>
        ) : null}
        <form onSubmit={submit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <FieldShell
                label="Nombre"
                htmlFor="recurring-name"
                 hint="Entre 1 y 60 caracteres."
                required
              >
                <Input
                  id="recurring-name"
                  value={name}
                  maxLength={60}
                  autoComplete="off"
                  onChange={(event) => setName(event.target.value)}
                />
              </FieldShell>
            </div>
            <FieldShell
              label="Monto esperado"
              htmlFor="recurring-amount"
               hint={
                 amountVariability === "fixed"
                   ? "Obligatorio para un pago fijo."
                   : "Opcional. Sin estimación no descuenta del dinero libre."
               }
               required={amountVariability === "fixed"}
            >
              <Input
                id="recurring-amount"
                inputMode="decimal"
                prefix={currency === "PEN" ? "S/" : "$"}
                value={amountRaw}
                onChange={(event) => setAmountRaw(event.target.value)}
              />
            </FieldShell>
            <FieldShell
              label="Cómo suele variar"
              htmlFor="recurring-variability"
              required
            >
              <Select
                id="recurring-variability"
                value={amountVariability}
                onChange={(event) =>
                  setAmountVariability(
                    event.target.value as RecurringAmountVariability
                  )
                }
              >
                {Object.entries(amountVariabilityLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FieldShell>
            <FieldShell label="Frecuencia" htmlFor="recurring-frequency" required>
              <Select
                id="recurring-frequency"
                value={frequency}
                onChange={(event) =>
                  setFrequency(event.target.value as RecurringFrequency)
                }
              >
                {Object.entries(frequencyLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FieldShell>
            <FieldShell label="Moneda" htmlFor="recurring-currency" required>
              <Select
                id="recurring-currency"
                value={currency}
                disabled={target.mode === "edit"}
                onChange={(event) =>
                  setCurrency(event.target.value as "PEN" | "USD")
                }
              >
                <option value="PEN">Soles (PEN)</option>
                <option value="USD">Dólares (USD)</option>
              </Select>
            </FieldShell>
            <div>
              <Label>Próxima fecha</Label>
              <DatePicker
                value={nextDate}
                onValueChange={setNextDate}
                aria-label="Próxima fecha esperada"
                className="mt-2"
              />
            </div>
            <FieldShell label="Categoría" htmlFor="recurring-category">
              <Select
                id="recurring-category"
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
              >
                <option value="">Sin clasificar</option>
                {Object.entries(categoryLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </FieldShell>
            <FieldShell
              label="Cuenta sugerida al pagar"
              htmlFor="recurring-account"
              hint="Elegirla no mueve dinero todavía."
            >
              <Select
                id="recurring-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Elegir al pagar</option>
                {accounts
                  .filter((account) => account.currency === currency)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </Select>
            </FieldShell>
          </div>

          {validationError ? (
            <p role="alert" className="mt-4 text-sm text-error">
              {validationError}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Volver
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {target.mode === "candidate"
                ? "Activar pago que viene"
                : target.mode === "edit"
                  ? "Guardar cambios"
                  : "Agregar pago que viene"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDialog({
  item,
  accounts,
  todayIso,
  onClose,
  onSaved,
}: {
  item: UpcomingViewItem;
  accounts: Account[];
  todayIso: string;
  onClose: () => void;
  onSaved: (expectedUpdateFailed: boolean) => Promise<void>;
}) {
  const [amountRaw, setAmountRaw] = useState(item.amount?.toString() ?? "");
  const [paidDate, setPaidDate] = useState(todayIso);
  const [accountId, setAccountId] = useState(
    item.rule?.default_account_id ?? ""
  );
  const [note, setNote] = useState("");
  const [amountDecision, setAmountDecision] = useState<
    "update_expected" | "one_time" | null
  >(null);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() =>
    clientIdempotencyKey("dashboard-recurring-payment")
  );
  const expectedAmount = item.rule?.expected_amount ?? item.amount;
  const parsedAmount = parseMoneyInput(amountRaw);
  const amountChanged =
    parsedAmount !== null &&
    expectedAmount !== null &&
    Math.round(parsedAmount * 100) !== Math.round(expectedAmount * 100);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!item.recurring_rule_id || !item.occurrence_id || !item.rule) {
        throw new FormValidationError(
          "No encuentro la ocurrencia que quieres pagar."
        );
      }
      const amount = parseMoneyInput(amountRaw);
      if (amount === null || amount <= 0) {
        throw new FormValidationError("Escribe un monto mayor que cero.");
      }
      if (paidDate > todayIso) {
        throw new FormValidationError("Esa fecha todavía no llega.");
      }
      if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
        throw new FormValidationError("Elige una fecha de pago válida.");
      }
      if (amountChanged && !amountDecision) {
        throw new FormValidationError(
          "Dime si este cambio actualiza lo que suele costar o fue algo puntual."
        );
      }

      await markRecurringPaid(
        item.recurring_rule_id,
        item.occurrence_id,
        {
          amount,
          account_id: accountId || null,
          paid_at: limaLocalInputToUtcIso(`${paidDate}T00:00`),
          note: note.trim() || null,
        },
        idempotencyKey
      );
      if (amountChanged && amountDecision === "update_expected") {
        try {
          await updateRecurringRule(item.recurring_rule_id, {
            expected_amount: amount,
          });
        } catch {
          return { expectedUpdateFailed: true };
        }
      }
      return { expectedUpdateFailed: false };
    },
    onSuccess: (result) => onSaved(result.expectedUpdateFailed),
    onError: (thrown) => setError(mutationErrorMessage(thrown)),
  });

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    mutation.mutate();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>Marcar pago como realizado</DialogTitle>
          <DialogDescription>
            Revisa monto, fecha y cuenta. Al confirmar se crea un movimiento
            real y recién entonces cambia el saldo.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit}>
          <div className="space-y-4">
            <FieldShell
              label="Monto pagado"
              htmlFor="recurring-payment-amount"
              required
            >
              <Input
                id="recurring-payment-amount"
                inputMode="decimal"
                prefix={item.currency === "PEN" ? "S/" : "$"}
                value={amountRaw}
                onChange={(event) => {
                  setAmountRaw(event.target.value);
                  setAmountDecision(null);
                }}
              />
            </FieldShell>
            {amountChanged && parsedAmount !== null ? (
              <fieldset className="rounded-lg border border-warning-subtle bg-warning-subtle/40 p-4">
                <legend className="px-1 text-sm font-medium text-text">
                  El monto cambió
                </legend>
                <p className="text-sm text-text-secondary">
                  Este pago fue de {formatUpcomingMoney(parsedAmount, item.currency)};
                  antes esperabas {formatUpcomingMoney(expectedAmount ?? 0, item.currency)}.
                  No voy a cambiar lo esperado en silencio.
                </p>
                <div className="mt-3 space-y-2">
                  <label className="flex items-start gap-2 text-sm text-text">
                    <input
                      type="radio"
                      name="amount-decision"
                      value="update_expected"
                      checked={amountDecision === "update_expected"}
                      onChange={() => setAmountDecision("update_expected")}
                    />
                    <span>Actualizar lo que suele ser</span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-text">
                    <input
                      type="radio"
                      name="amount-decision"
                      value="one_time"
                      checked={amountDecision === "one_time"}
                      onChange={() => setAmountDecision("one_time")}
                    />
                    <span>Fue algo puntual</span>
                  </label>
                </div>
              </fieldset>
            ) : null}
            <div>
              <Label>Fecha del pago</Label>
              <DatePicker
                value={paidDate}
                onValueChange={setPaidDate}
                aria-label="Fecha del pago"
                className="mt-2"
              />
            </div>
            <FieldShell
              label="Cuenta"
              htmlFor="recurring-payment-account"
              hint="Opcional si no quieres asociar una cuenta."
            >
              <Select
                id="recurring-payment-account"
                value={accountId}
                onChange={(event) => setAccountId(event.target.value)}
              >
                <option value="">Sin cuenta asociada</option>
                {accounts
                  .filter((account) => account.currency === item.currency)
                  .map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
              </Select>
            </FieldShell>
            <FieldShell label="Nota" htmlFor="recurring-payment-note">
              <Textarea
                id="recurring-payment-note"
                value={note}
                maxLength={500}
                onChange={(event) => setNote(event.target.value)}
              />
            </FieldShell>
          </div>
          {error ? (
            <p role="alert" className="mt-4 text-sm text-error">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              Volver
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              Registrar este pago
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function HistoryDialog({
  item,
  todayIso,
  onClose,
}: {
  item: UpcomingViewItem;
  todayIso: string;
  onClose: () => void;
}) {
  const rule = item.rule;
  const query = useQuery({
    queryKey: [
      ...queryKeys.recurringRules.all,
      rule?.id ?? "missing",
      "occurrences",
    ],
    queryFn: () => listRecurringOccurrences(rule?.id ?? ""),
    enabled: Boolean(rule),
  });
  const history =
    query.data && rule
      ? toRecurringHistoryView(query.data.occurrences, rule, todayIso)
      : [];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="lg">
        <DialogHeader>
          <DialogTitle>Historial del pago que viene</DialogTitle>
          <DialogDescription>
            Fechas, estados y montos guardados en las ocurrencias de esta regla.
          </DialogDescription>
        </DialogHeader>
        {query.isLoading ? (
          <div role="status" aria-label="Cargando historial" className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : query.isError ? (
          <ErrorState
            className="min-h-56"
            title="No pude cargar el historial"
            onRetry={() => void query.refetch()}
          />
        ) : history.length === 0 ? (
          <EmptyState
            className="min-h-56"
            icon={<History className="h-6 w-6" />}
            title="Aún no hay ocurrencias"
            description="El trabajo diario genera las próximas fechas; no se inventan al abrir esta pantalla."
          />
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {history.map((occurrence) => (
              <li
                key={occurrence.id}
                className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto_auto] sm:items-center"
              >
                <div>
                  <p className="font-medium text-text">
                    {formatFullDate(occurrence.expected_date)}
                  </p>
                  <p className="text-xs text-text-muted">
                    {occurrence.date_label}
                  </p>
                </div>
                <MoneyText value={occurrence.amount} />
                <Badge tone={occurrence.status_tone}>
                  {occurrence.status_label}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        <p className="mt-4 text-xs text-text-muted">
          Este endpoint aún no distingue el monto real del movimiento pagado
          del monto guardado en la ocurrencia.
        </p>
        <DialogFooter>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cerrar historial
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function RiskActionDialog({
  action,
  pending,
  onClose,
  onConfirm,
}: {
  action: RiskAction | null;
  pending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const cancelling = action?.kind === "cancel";

  return (
    <AlertDialog open={Boolean(action)} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {cancelling
              ? "¿Cancelar este pago que viene?"
              : "¿Saltar este periodo?"}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {cancelling
              ? "Dejará de generar compromisos. El historial se conserva."
              : "Esta ocurrencia dejará de contar como pendiente y la regla seguirá activa para el próximo periodo."}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending} onClick={onClose}>
            Volver
          </AlertDialogCancel>
          <AlertDialogAction
            disabled={pending}
            onClick={onConfirm}
          >
            {cancelling
              ? "Cancelar pago que viene"
              : "Saltar este periodo"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

class FormValidationError extends Error {}

function mutationErrorMessage(error: unknown): string {
  if (error instanceof FormValidationError) return error.message;
  if (error instanceof ApiClientError) {
    if (error.code === "CONFLICT") {
      if (error.message.toLowerCase().includes("pagado")) {
        return "Ese pago ya lo marcaste.";
      }
      return error.message || "Ese cambio entra en conflicto con tus datos.";
    }
    if (error.code === "NOT_FOUND") {
      return "Ese elemento ya no está disponible. Actualiza la pantalla.";
    }
    return error.message;
  }
  return "No pude guardar el cambio. Tus datos anteriores siguen igual.";
}

function successMessage(kind: QuickAction["kind"]): string {
  if (kind === "pause") return "Pago que viene pausado.";
  if (kind === "resume") return "Pago que viene reactivado.";
  if (kind === "discard") return "Sugerencia descartada.";
  if (kind === "skip") return "Este periodo quedó saltado.";
  return "Pago que viene cancelado; su historial se conserva.";
}
