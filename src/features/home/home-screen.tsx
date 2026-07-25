"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Compass,
  ListChecks,
  MessageCircle,
  PencilLine,
  Plus,
  RefreshCw,
  ShieldCheck,
  WalletCards,
  X,
} from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import type { DebtScreenIntent } from "@/features/debts/debts-types";
import {
  isIncomeType,
  isTransferType,
  toMovementViewItem,
  type MovementViewItem,
} from "@/features/movements/movement-view-model";
import { ApiClientError } from "@/features/movements/movements-api";
import { startDashboardOnboarding } from "@/features/onboarding/onboarding-api";
import { Button } from "@/shared/ui/button";
import { cn } from "@/shared/ui/cn";
import { MoneyText } from "@/shared/ui/money";
import { ErrorState, LoadingBlock } from "@/shared/ui/states";
import { dismissHomeNudge, getHomeDashboard } from "./home-api";
import type {
  HomeDashboardSummary,
  HomeCommitmentSummary,
  HomeDataQualitySummary,
  HomeDashboardNudge,
  HomeInsightCard,
  HomeMoneySummary,
  HomePendingSummary,
  HomeSuggestedAction,
} from "./home-types";
import {
  getMoneyExplanation,
  getMoneyHeadline,
  getPendingTone,
  getSuggestedAction,
} from "./home-view-model";

type LoadState = "loading" | "loaded" | "error";

type UiError = {
  title: string;
  message: string;
};

export function HomeScreen({
  onSignOut,
  onNavigate,
  onOpenDebt,
  onStartMovement,
}: {
  onSignOut?: () => void;
  onNavigate?: (view: AppView) => void;
  onOpenDebt?: (intent: DebtScreenIntent) => void;
  onStartMovement?: () => void;
}) {
  const [summary, setSummary] = useState<HomeDashboardSummary | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [uiError, setUiError] = useState<UiError | null>(null);
  const [dismissingNudgeId, setDismissingNudgeId] = useState<string | null>(null);
  const [startingOnboarding, setStartingOnboarding] = useState(false);

  const reloadHome = useCallback(async () => {
    setLoadState("loading");
    setUiError(null);

    try {
      const nextSummary = await getHomeDashboard();
      setSummary(nextSummary);
      setLoadState("loaded");
    } catch (error) {
      setLoadState("error");
      setUiError(toUiError(error));
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadInitialHome() {
      try {
        const nextSummary = await getHomeDashboard();
        if (cancelled) return;
        setSummary(nextSummary);
        setLoadState("loaded");
      } catch (error) {
        if (cancelled) return;
        setLoadState("error");
        setUiError(toUiError(error));
      }
    }

    void loadInitialHome();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleDismissNudge = useCallback(async (nudgeId: string) => {
    setDismissingNudgeId(nudgeId);

    try {
      await dismissHomeNudge(nudgeId);
      setSummary((current) =>
        current
          ? {
              ...current,
              dashboard_nudges: current.dashboard_nudges.filter(
                (nudge) => nudge.id !== nudgeId
              ),
            }
          : current
      );
    } catch (error) {
      setUiError(toUiError(error));
    } finally {
      setDismissingNudgeId(null);
    }
  }, []);

  const movements = useMemo(
    () => summary?.recent_movements.map(toMovementViewItem) ?? [],
    [summary]
  );
  const suggestedAction = summary ? getSuggestedAction(summary) : null;

  const handleStartOnboarding = useCallback(async () => {
    setStartingOnboarding(true);
    setUiError(null);

    try {
      const result = await startDashboardOnboarding();
      setSummary((current) =>
        current ? { ...current, onboarding: result.onboarding } : current
      );
      if (onStartMovement) onStartMovement();
      else onNavigate?.("movements");
    } catch (error) {
      setUiError(toUiError(error));
    } finally {
      setStartingOnboarding(false);
    }
  }, [onNavigate, onStartMovement]);

  return (
    <AppShell
      title="Home"
      subtitle="Tu estado financiero de hoy, sin ruido."
      activeView="home"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() =>
            onStartMovement ? onStartMovement() : onNavigate?.("movements")
          }
        >
          Nuevo movimiento
        </Button>
      }
      mobilePrimaryAction={
        <Button
          size="icon"
          aria-label="Nuevo movimiento"
          icon={<Plus className="h-5 w-5" />}
          onClick={() =>
            onStartMovement ? onStartMovement() : onNavigate?.("movements")
          }
          className="h-12 w-12 rounded-full shadow-lg"
        >
          Nuevo movimiento
        </Button>
      }
    >
      <div id="home" className="mx-auto max-w-[1040px] pb-8 pt-2 lg:pt-4">
        {loadState === "loading" ? (
          <LoadingBlock label="Ordenando tu resumen" />
        ) : uiError || !summary ? (
          <ErrorState
            title={uiError?.title}
            description={uiError?.message}
            onRetry={() => void reloadHome()}
          />
        ) : (
          <div className="space-y-6">
            {summary.onboarding.show_initial_prompt ? (
              <OnboardingWelcomeCard
                loading={startingOnboarding}
                onStart={() => void handleStartOnboarding()}
              />
            ) : null}

            {summary.onboarding.show_first_value_tip ? (
              <FirstValueControlTip
                kind={summary.onboarding.first_value_kind}
                onNavigate={onNavigate}
              />
            ) : null}

            <section
              className={cn(
                "grid gap-5",
                !summary.onboarding.show_initial_prompt &&
                  "lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]"
              )}
            >
              <MoneyHero money={summary.money_summary} />
              {!summary.onboarding.show_initial_prompt ? (
                <SuggestedActionCard
                  action={suggestedAction}
                  pending={summary.pending_summary}
                  onNavigate={onNavigate}
                />
              ) : null}
            </section>

            <section className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
              <RecentMovementsCard
                movements={movements}
                onNavigate={onNavigate}
              />
              <div className="space-y-5">
                <DashboardNudgesCard
                  nudges={summary.dashboard_nudges}
                  dismissingId={dismissingNudgeId}
                  onDismiss={(id) => void handleDismissNudge(id)}
                  onNavigate={onNavigate}
                  onOpenDebt={onOpenDebt}
                />
                <PendingProtectionCard
                  pending={summary.pending_summary}
                  onNavigate={onNavigate}
                />
                <NextCommitmentsCard
                  commitments={summary.next_commitments}
                  onNavigate={onNavigate}
                />
                <DataQualityCard quality={summary.data_quality} />
                <InsightCard
                  insight={summary.featured_insight}
                  onNavigate={onNavigate}
                />
              </div>
            </section>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function OnboardingWelcomeCard({
  loading,
  onStart,
}: {
  loading: boolean;
  onStart: () => void;
}) {
  return (
    <section className="overflow-hidden rounded-xl border border-brand-subtle bg-brand-subtle/40 shadow-xs">
      <div className="grid gap-6 p-6 sm:p-7 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-brand">
            Tu primera accion
          </p>
          <h1 className="mt-3 max-w-2xl font-heading text-3xl font-semibold leading-tight text-text sm:text-4xl">
            Empieza por una sola cosa
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-text-secondary sm:text-base">
            Registra un gasto o ingreso real. No necesitas crear cuentas,
            configurar categorias ni conectar otros canales para empezar.
          </p>
          <Button
            className="mt-6"
            icon={<PencilLine className="h-4 w-4" />}
            loading={loading}
            onClick={onStart}
          >
            Registrar primer movimiento
          </Button>
        </div>

        <div className="rounded-xl border border-border/80 bg-bg-surface-raised p-5">
          <div className="flex items-center gap-2 text-sm font-semibold text-text">
            <MessageCircle className="h-4 w-4 text-brand" />
            Tambien puedes escribir por WhatsApp
          </div>
          <p className="mt-3 rounded-lg bg-bg-primary px-4 py-3 text-sm text-text-secondary">
            “Gaste 8 en cafe”
          </p>
          <p className="mt-3 text-xs leading-5 text-text-muted">
            Si algo queda mal, puedes corregirlo. Manzana no te obliga a
            completar una configuracion antes de darte valor.
          </p>
        </div>
      </div>
    </section>
  );
}

function FirstValueControlTip({
  kind,
  onNavigate,
}: {
  kind: "movement" | "debt" | null;
  onNavigate?: (view: AppView) => void;
}) {
  return (
    <section className="rounded-xl border border-success-subtle bg-success-subtle/45 px-5 py-4 shadow-xs sm:px-6">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-surface-raised text-success">
          <CheckCircle2 className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-text">
            {kind === "debt"
              ? "Tu primera deuda ya esta ordenada"
              : "Tu primer registro ya esta en Manzana"}
          </h2>
          <p className="mt-1 text-sm leading-6 text-text-secondary">
            Si algo no quedo bien, puedes corregirlo sin empezar de nuevo. Tus
            cambios siguen pasando por el Core y quedan auditados.
          </p>
          <button
            type="button"
            className="mt-2 text-sm font-semibold text-success transition hover:opacity-80"
            onClick={() => onNavigate?.(kind === "debt" ? "debts" : "movements")}
          >
            Revisar {kind === "debt" ? "deuda" : "movimiento"}
          </button>
        </div>
      </div>
    </section>
  );
}

function MoneyHero({ money }: { money: HomeMoneySummary | null }) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-6 shadow-xs sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-text-muted">
            {getMoneyHeadline(money)}
          </p>
          <div className="mt-4">
            {money ? (
              <MoneyText
                value={money.free_balance}
                sign="none"
                className="font-heading text-5xl font-semibold leading-none text-text sm:text-6xl"
              />
            ) : (
              <p className="max-w-md font-heading text-3xl font-semibold leading-tight text-text sm:text-4xl">
                Falta una cuenta para calcularlo
              </p>
            )}
          </div>
          <p className="mt-4 max-w-xl text-sm leading-6 text-text-secondary">
            {getMoneyExplanation(money)}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <WalletCards className="h-6 w-6" />
        </div>
      </div>

      {money ? (
        <div className="mt-7 grid gap-3 sm:grid-cols-3">
          <MoneyFact label="Saldo registrado" value={money.total_balance} />
          <MoneyFact label="Separado" value={money.separated_balance} />
          <MoneyFact label="Cuentas" value={money.account_count} plain />
        </div>
      ) : (
        <div className="mt-7 rounded-lg border border-brand-subtle bg-brand-subtle/45 px-4 py-3 text-sm leading-6 text-text-secondary">
          Los gastos de WhatsApp pueden quedar confirmados aunque no tengan cuenta.
          Simplemente no mueven saldos hasta que agregues una cuenta.
        </div>
      )}
    </section>
  );
}

function MoneyFact({
  label,
  value,
  plain,
}: {
  label: string;
  value: number;
  plain?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-bg-primary px-4 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      {plain ? (
        <p className="mt-1 font-heading text-xl font-semibold text-text">
          {value}
        </p>
      ) : (
        <MoneyText
          value={value}
          sign="none"
          className="mt-1 block font-heading text-xl font-semibold text-text"
        />
      )}
    </div>
  );
}

function SuggestedActionCard({
  action,
  pending,
  onNavigate,
}: {
  action: HomeSuggestedAction | null;
  pending: HomePendingSummary;
  onNavigate?: (view: AppView) => void;
}) {
  const tone = getPendingTone(pending);
  const target = action?.target_view ?? "movements";
  const title = action?.label ?? tone.title;
  const body = action?.description ?? tone.body;

  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            pending.active_count > 0
              ? "bg-warning-subtle text-warning"
              : "bg-success-subtle text-success"
          )}
        >
          {pending.active_count > 0 ? (
            <AlertCircle className="h-5 w-5" />
          ) : (
            <CheckCircle2 className="h-5 w-5" />
          )}
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold tracking-normal text-text">
            {title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">{body}</p>
        </div>
      </div>

      <Button
        className="mt-5 w-full"
        variant={action?.priority === "secondary" ? "secondary" : "primary"}
        icon={<ArrowRight className="h-4 w-4" />}
        onClick={() => onNavigate?.(target)}
      >
        {action?.label ?? "Ver movimientos"}
      </Button>
    </section>
  );
}

function RecentMovementsCard({
  movements,
  onNavigate,
}: {
  movements: MovementViewItem[];
  onNavigate?: (view: AppView) => void;
}) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs sm:p-6">
      <div className="flex items-center justify-between gap-4 border-b border-border/70 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle text-brand">
            <ListChecks className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-xl font-semibold tracking-normal text-text">
              Movimientos recientes
            </h2>
            <p className="mt-1 text-sm text-text-secondary">
              Confirmados por Core, con origen trazable.
            </p>
          </div>
        </div>
        <button
          type="button"
          className="hidden text-sm font-medium text-text-brand hover:text-brand-hover sm:block"
          onClick={() => onNavigate?.("movements")}
        >
          Ver todos
        </button>
      </div>

      {movements.length > 0 ? (
        <div className="divide-y divide-border/70">
          {movements.slice(0, 5).map((movement) => (
            <HomeMovementRow key={movement.id} movement={movement} />
          ))}
        </div>
      ) : (
        <div className="flex min-h-52 flex-col items-center justify-center px-4 py-10 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle text-brand">
            <Plus className="h-5 w-5" />
          </div>
          <h3 className="mt-4 font-heading text-lg font-semibold text-text">
            Aun no hay movimientos
          </h3>
          <p className="mt-2 max-w-sm text-sm leading-6 text-text-secondary">
            Escribe por WhatsApp o registra uno desde el Dashboard. Cuando quede
            confirmado, aparecera aqui.
          </p>
        </div>
      )}
    </section>
  );
}

function HomeMovementRow({ movement }: { movement: MovementViewItem }) {
  const isIncome = isIncomeType(movement.type);
  const isTransfer = isTransferType(movement.type);

  return (
    <article className="flex min-w-0 items-center gap-4 py-4">
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-full",
          isIncome
            ? "bg-success-subtle text-success"
            : isTransfer
            ? "bg-info-subtle text-info"
            : "bg-bg-surface text-text-secondary"
        )}
      >
        {isIncome ? (
          <ArrowRight className="h-5 w-5 rotate-[-45deg]" />
        ) : (
          <ListChecks className="h-5 w-5" />
        )}
      </div>
      <div className="min-w-0">
        <h3 className="truncate font-heading text-base font-semibold text-text">
          {movement.title}
        </h3>
        <p className="mt-1 truncate text-sm text-text-secondary">
          {movement.categoryLabel} · {movement.accountLabel}
        </p>
      </div>
      <div className="ml-auto shrink-0 text-right">
        <MoneyText
          value={movement.amount}
          sign={isIncome ? "positive" : isTransfer ? "none" : "negative"}
          className={cn(
            "font-heading text-base font-semibold",
            isIncome ? "text-success" : "text-text"
          )}
        />
        <p className="mt-1 text-xs text-text-muted">{movement.timeLabel}</p>
      </div>
    </article>
  );
}

function PendingProtectionCard({
  pending,
  onNavigate,
}: {
  pending: HomePendingSummary;
  onNavigate?: (view: AppView) => void;
}) {
  const tone = getPendingTone(pending);

  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-text">
            {tone.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {tone.body}
          </p>
        </div>
      </div>
      {pending.active_count > 0 ? (
        <button
          type="button"
          className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-text-brand hover:text-brand-hover"
          onClick={() => onNavigate?.("pending")}
        >
          Abrir pendientes
          <ArrowRight className="h-4 w-4" />
        </button>
      ) : null}
    </section>
  );
}

function NextCommitmentsCard({
  commitments,
  onNavigate,
}: {
  commitments: HomeCommitmentSummary[];
  onNavigate?: (view: AppView) => void;
}) {
  if (commitments.length === 0) return null;

  const first = commitments[0];
  const total = commitments.reduce(
    (sum, commitment) => sum + Number(commitment.amount),
    0
  );

  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-subtle text-info">
          <CalendarDays className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-text">
            Pagos que vienen
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Proximo: {first.title} · {formatHomeDate(first.due_at)}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat label="En vista" value={commitments.length} />
        <div className="rounded-lg border border-border bg-bg-primary px-3 py-3">
          <p className="text-xs text-text-muted">Estimado</p>
          <MoneyText
            value={total}
            sign="none"
            className="mt-1 block font-heading text-xl font-semibold text-text"
          />
        </div>
      </div>
      <button
        type="button"
        className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-text-brand hover:text-brand-hover"
        onClick={() => onNavigate?.("upcoming")}
      >
        Ver pagos
        <ArrowRight className="h-4 w-4" />
      </button>
    </section>
  );
}

function DashboardNudgesCard({
  nudges,
  dismissingId,
  onDismiss,
  onNavigate,
  onOpenDebt,
}: {
  nudges: HomeDashboardNudge[];
  dismissingId: string | null;
  onDismiss: (id: string) => void;
  onNavigate?: (view: AppView) => void;
  onOpenDebt?: (intent: DebtScreenIntent) => void;
}) {
  if (nudges.length === 0) return null;

  return (
    <section className="rounded-xl border border-warning-subtle bg-warning-subtle/35 p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-surface-raised text-warning">
          <Bell className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h2 className="font-heading text-lg font-semibold text-text">
            Avisos utiles
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            Lo que conviene mirar hoy.
          </p>
        </div>
      </div>

      <div className="mt-4 divide-y divide-border/70">
        {nudges.map((nudge) => (
          <article key={nudge.id} className="py-4 first:pt-0 last:pb-0">
            <div className="flex min-w-0 items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-bg-surface-raised text-warning">
                <Clock3 className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="font-heading text-base font-semibold text-text">
                  {nudge.title}
                </h3>
                <p className="mt-1 text-sm leading-6 text-text-secondary">
                  {nudge.body}
                </p>
                {nudge.evidence ? (
                  <p className="mt-2 text-xs font-medium uppercase tracking-[0.1em] text-text-muted">
                    {nudge.evidence}
                  </p>
                ) : null}
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Ocultar aviso"
                title="Ocultar aviso"
                icon={<X className="h-4 w-4" />}
                loading={dismissingId === nudge.id}
                onClick={() => onDismiss(nudge.id)}
              >
                Ocultar aviso
              </Button>
            </div>

            <Button
              className="mt-3"
              variant="secondary"
              size="sm"
              icon={<ArrowRight className="h-4 w-4" />}
              onClick={() => {
                if (nudge.debt_id && nudge.installment_id && onOpenDebt) {
                  onOpenDebt({
                    debtId: nudge.debt_id,
                    installmentId: nudge.installment_id,
                    action: "detail",
                  });
                  return;
                }

                onNavigate?.(nudge.target_view);
              }}
            >
              {nudge.action_label}
            </Button>
          </article>
        ))}
      </div>
    </section>
  );
}

function DataQualityCard({ quality }: { quality: HomeDataQualitySummary }) {
  return (
    <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-info-subtle text-info">
          <RefreshCw className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-text">
            Calidad de datos
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {quality.message}
          </p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <MiniStat label="Confirmados" value={quality.confirmed_movements_count} />
        <MiniStat label="Sin cuenta" value={quality.movements_without_account_count} />
      </div>
    </section>
  );
}

function InsightCard({
  insight,
  onNavigate,
}: {
  insight: HomeInsightCard | null;
  onNavigate?: (view: AppView) => void;
}) {
  if (!insight) {
    return (
      <section className="rounded-xl border border-border bg-bg-surface-raised p-5 shadow-xs">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-surface text-text-secondary">
            <Compass className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-semibold text-text">
              Descubrimientos
            </h2>
            <p className="mt-2 text-sm leading-6 text-text-secondary">
              Todavia estamos juntando evidencia. Mejor esperar un poco que
              mostrarte un patron flojo.
            </p>
            <button
              type="button"
              className="mt-3 text-sm font-semibold text-brand transition hover:text-brand-hover"
              onClick={() => onNavigate?.("insights")}
            >
              Abrir Descubrimientos
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-brand-subtle bg-brand-subtle/35 p-5 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-bg-surface-raised text-brand">
          <Compass className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-heading text-lg font-semibold text-text">
            {insight.title}
          </h2>
          <p className="mt-2 text-sm leading-6 text-text-secondary">
            {insight.body}
          </p>
          <p className="mt-3 text-xs font-medium uppercase tracking-[0.1em] text-text-muted">
            {insight.evidence}
          </p>
          <button
            type="button"
            className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-brand transition hover:text-brand-hover"
            onClick={() => onNavigate?.("insights")}
          >
            Entender por qué
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </section>
  );
}

function formatHomeDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "fecha por revisar";

  return new Intl.DateTimeFormat("es-PE", {
    day: "numeric",
    month: "short",
  }).format(date);
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-bg-primary px-3 py-3">
      <p className="text-xs text-text-muted">{label}</p>
      <p className="mt-1 font-heading text-xl font-semibold text-text">{value}</p>
    </div>
  );
}

function toUiError(error: unknown): UiError {
  if (error instanceof ApiClientError) {
    if (error.code === "AUTH_REQUIRED" || error.status === 401) {
      return {
        title: "Sesion requerida",
        message:
          "Necesitas iniciar sesion para ver tu resumen real. Vuelve a entrar y Manzana recargara tu Home.",
      };
    }

    return {
      title: "No pude cargar Home",
      message: error.message,
    };
  }

  return {
    title: "No pude cargar Home",
    message: "Intenta de nuevo en un momento.",
  };
}
