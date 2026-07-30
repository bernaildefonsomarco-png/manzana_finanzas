"use client";

import { useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import {
  budgetPeriodContaining,
  previousBudgetPeriod,
  type BudgetPeriodKind,
} from "@/core/budgets";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { isoDateInLima } from "@/shared/dates/lima";
import { queryKeys } from "@/shared/data/query-keys";
import { Button } from "@/ui/primitivas/button";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import {
  archiveBudget,
  archiveGoal,
  budgetAction,
  copyPreviousBudgets,
  goalAction,
  listBudgets,
  listBudgetSuggestions,
  listGoals,
  resolveBudgetSuggestion,
} from "./budgets-api";
import { BudgetCreateDialog } from "./budget-create-dialog";
import { BudgetList } from "./budget-list";
import { parsePeriodKind } from "./budget-options";
import { BudgetPeriodPanel } from "./budget-period-panel";
import { BudgetSuggestions } from "./budget-suggestions";
import { CopyPreviousDialog } from "./copy-previous-dialog";
import { GoalCreateDialog } from "./goal-create-dialog";
import { GoalList } from "./goal-list";

type Props = {
  onNavigate?: (view: AppView) => void;
  onSignOut?: () => void;
};

export function BudgetsScreen({ onNavigate, onSignOut }: Props) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const periodKind = parsePeriodKind(searchParams.get("periodo"));
  const asOfDate = isoDateInLima();
  const previousPeriod = previousBudgetPeriod(
    budgetPeriodContaining(asOfDate, periodKind),
    periodKind
  );
  const [tab, setTab] = useState<"budgets" | "goals">("budgets");
  const [createKind, setCreateKind] = useState<"budget" | "goal" | null>(null);
  const [copyOpen, setCopyOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  const budgetsQuery = useQuery({
    queryKey: queryKeys.budgets.period(periodKind),
    queryFn: () => listBudgets(periodKind),
  });
  const goalsQuery = useQuery({
    queryKey: queryKeys.goals.all,
    queryFn: listGoals,
  });
  const suggestionsQuery = useQuery({
    queryKey: [...queryKeys.budgets.suggestions, periodKind],
    queryFn: () => listBudgetSuggestions(periodKind),
  });
  const previousBudgetsQuery = useQuery({
    queryKey: [
      ...queryKeys.budgets.all,
      "periodo-anterior",
      periodKind,
      previousPeriod.end,
    ],
    queryFn: () => listBudgets(periodKind, previousPeriod.end),
    enabled: copyOpen,
  });

  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
      queryClient.invalidateQueries({ queryKey: queryKeys.goals.all }),
    ]);
  };
  const budgetStatusMutation = useMutation({
    mutationFn: (input: {
      id: string;
      action: "pause" | "resume" | "archive";
    }) =>
      input.action === "archive"
        ? archiveBudget(input.id)
        : budgetAction(input.id, input.action),
    onSuccess: async () => {
      setFeedback("El presupuesto quedó actualizado.");
      await refresh();
    },
  });
  const goalStatusMutation = useMutation({
    mutationFn: (input: {
      id: string;
      action: "pause" | "resume" | "archive";
    }) =>
      input.action === "archive"
        ? archiveGoal(input.id)
        : goalAction(input.id, input.action),
    onSuccess: async () => {
      setFeedback("La meta quedó actualizada.");
      await refresh();
    },
  });
  const suggestionMutation = useMutation({
    mutationFn: (input: { id: string; action: "accept" | "dismiss" }) =>
      resolveBudgetSuggestion(input.id, input.action),
    onSuccess: async (_, input) => {
      setFeedback(
        input.action === "accept"
          ? "Se creó el presupuesto sugerido."
          : "No volveremos a mostrar esta misma sugerencia."
      );
      await refresh();
    },
  });
  const copyMutation = useMutation({
    mutationFn: () => copyPreviousBudgets(periodKind, asOfDate),
    onSuccess: async (budgets) => {
      setCopyOpen(false);
      setFeedback(
        budgets.length === 1
          ? "Se copió 1 presupuesto del periodo anterior."
          : `Se copiaron ${budgets.length} presupuestos del periodo anterior.`
      );
      await refresh();
    },
  });

  function changePeriod(nextPeriod: BudgetPeriodKind) {
    const next = new URLSearchParams(searchParams.toString());
    next.set("periodo", nextPeriod);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }

  const loading = budgetsQuery.isLoading || goalsQuery.isLoading;
  const error = budgetsQuery.isError || goalsQuery.isError;

  return (
    <AppShell
      title="Presupuestos"
      subtitle="Planifica sin apartar dinero. Para separar saldo, usa una caja."
      activeView="budgets"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setCreateKind(tab === "budgets" ? "budget" : "goal")}
        >
          {tab === "budgets" ? "Nuevo presupuesto" : "Nueva meta"}
        </Button>
      }
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        <div
          role="tablist"
          aria-label="Presupuestos y metas"
          className="flex w-fit gap-1 rounded-lg border border-border bg-bg-surface p-1"
        >
          <TabButton
            active={tab === "budgets"}
            onClick={() => setTab("budgets")}
          >
            Presupuestos
          </TabButton>
          <TabButton active={tab === "goals"} onClick={() => setTab("goals")}>
            Metas
          </TabButton>
        </div>

        {tab === "budgets" ? (
          <BudgetPeriodPanel
            budgets={budgetsQuery.data?.budgets ?? []}
            periodKind={periodKind}
            onPeriodChange={changePeriod}
            onCopy={() => setCopyOpen(true)}
          />
        ) : null}
        {feedback ? (
          <p
            role="status"
            className="rounded-lg bg-success-subtle px-4 py-3 text-sm text-text"
          >
            {feedback}
          </p>
        ) : null}
        {loading ? <LoadingBlock label="Cargando tu planificación" /> : null}
        {error ? (
          <ErrorState
            description="Tus saldos no cambiaron. Reintenta para ver la planificación."
            onRetry={() => void refresh()}
          />
        ) : null}
        {!loading && !error && tab === "budgets" ? (
          <BudgetList
            budgets={budgetsQuery.data?.budgets ?? []}
            pending={budgetStatusMutation.isPending}
            onAction={(id, action) =>
              budgetStatusMutation.mutate({ id, action })
            }
            onCreate={() => setCreateKind("budget")}
          />
        ) : null}
        {!loading && !error && tab === "goals" ? (
          <GoalList
            goals={goalsQuery.data?.goals ?? []}
            pending={goalStatusMutation.isPending}
            onAction={(id, action) => goalStatusMutation.mutate({ id, action })}
            onCreate={() => setCreateKind("goal")}
          />
        ) : null}
        {tab === "budgets" ? (
          <BudgetSuggestions
            suggestions={suggestionsQuery.data?.suggestions ?? []}
            onResolve={(id, action) =>
              suggestionMutation.mutate({ id, action })
            }
          />
        ) : null}
      </div>

      <BudgetCreateDialog
        open={createKind === "budget"}
        periodKind={periodKind}
        onOpenChange={(open) => setCreateKind(open ? "budget" : null)}
        onCreated={async () => {
          setCreateKind(null);
          setFeedback("Se creó el presupuesto. Tu dinero libre no cambió.");
          await refresh();
        }}
      />
      <GoalCreateDialog
        open={createKind === "goal"}
        onOpenChange={(open) => setCreateKind(open ? "goal" : null)}
        onCreated={async () => {
          setCreateKind(null);
          setFeedback("Se creó la meta.");
          await refresh();
        }}
      />
      <CopyPreviousDialog
        open={copyOpen}
        periodKind={periodKind}
        periodStart={previousPeriod.start}
        periodEnd={previousPeriod.end}
        budgets={previousBudgetsQuery.data?.budgets ?? []}
        loading={previousBudgetsQuery.isLoading}
        failed={previousBudgetsQuery.isError}
        saving={copyMutation.isPending}
        saveFailed={copyMutation.isError}
        onOpenChange={setCopyOpen}
        onRetry={() => void previousBudgetsQuery.refetch()}
        onCopy={() => copyMutation.mutate()}
      />
    </AppShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      className={`rounded-md px-4 py-2 text-sm font-medium ${
        active
          ? "bg-bg-surface-raised text-text shadow-xs"
          : "text-text-secondary"
      }`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
