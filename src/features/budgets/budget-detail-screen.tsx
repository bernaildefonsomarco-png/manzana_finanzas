"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { queryKeys } from "@/shared/data/query-keys";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import {
  budgetAction,
  getBudget,
  getGoal,
  goalAction,
  linkGoalBox,
  listGoalBoxes,
  updateBudget,
} from "./budgets-api";
import { BudgetDetailContent } from "./budget-detail-content";
import { BudgetEditDialog } from "./budget-edit-dialog";
import type {
  BudgetDetailView,
  BudgetUpdatePayload,
  GoalView,
} from "./budgets-types";
import { GoalBoxLinkDialog } from "./goal-box-link-dialog";
import { GoalDetailContent } from "./goal-detail-content";

export function BudgetDetailScreen({
  id,
  entity,
  onNavigate,
  onSignOut,
}: {
  id: string;
  entity: "budget" | "goal";
  onNavigate?: (view: AppView) => void;
  onSignOut?: () => void;
}) {
  const queryClient = useQueryClient();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const adjustmentRequested =
    entity === "budget" && searchParams.get("accion") === "ajustar";
  const [manualAdjustmentOpen, setManualAdjustmentOpen] = useState(false);
  const [boxLinkOpen, setBoxLinkOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const adjustmentOpen = adjustmentRequested || manualAdjustmentOpen;
  const detailKey =
    entity === "budget"
      ? queryKeys.budgets.detail(id)
      : queryKeys.goals.detail(id);

  const query = useQuery<BudgetDetailView | GoalView>({
    queryKey: detailKey,
    queryFn: async () =>
      entity === "budget" ? await getBudget(id) : await getGoal(id),
  });
  const statusMutation = useMutation({
    mutationFn: async (action: "pause" | "resume" | "unlink-box") => {
      if (entity === "budget") {
        return budgetAction(id, action === "unlink-box" ? "pause" : action);
      }
      return goalAction(id, action);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: detailKey });
      setFeedback(
        entity === "budget"
          ? "El presupuesto quedó actualizado."
          : "La meta quedó actualizada."
      );
    },
  });
  const updateMutation = useMutation({
    mutationFn: (payload: BudgetUpdatePayload) => updateBudget(id, payload),
    onSuccess: async () => {
      setFeedback("El ajuste quedó guardado.");
      changeAdjustmentOpen(false);
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: queryKeys.budgets.detail(id),
        }),
        queryClient.invalidateQueries({ queryKey: queryKeys.budgets.all }),
      ]);
    },
  });
  const boxesQuery = useQuery({
    queryKey: [...queryKeys.boxes, "objetivo"],
    queryFn: listGoalBoxes,
    enabled: entity === "goal" && boxLinkOpen,
  });
  const linkMutation = useMutation({
    mutationFn: (boxId: string) => linkGoalBox(id, boxId),
    onSuccess: async () => {
      setBoxLinkOpen(false);
      setFeedback("La caja quedó vinculada a la meta.");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.detail(id) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.goals.all }),
        queryClient.invalidateQueries({ queryKey: queryKeys.boxes }),
      ]);
    },
  });

  function changeAdjustmentOpen(open: boolean) {
    setManualAdjustmentOpen(open);
    const next = new URLSearchParams(searchParams.toString());
    if (open) next.set("accion", "ajustar");
    else next.delete("accion");
    const queryString = next.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }

  const budget =
    query.data && entity === "budget" && "spent" in query.data
      ? query.data
      : null;
  const goal =
    query.data && entity === "goal" && "name" in query.data
      ? query.data
      : null;

  return (
    <AppShell
      title={entity === "budget" ? "Detalle de presupuesto" : "Detalle de meta"}
      activeView="budgets"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-3xl space-y-5 px-4 py-6 sm:px-6">
        <Link
          href="/presupuestos"
          className="inline-flex items-center gap-2 text-sm font-medium text-text-secondary hover:text-text"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver a presupuestos
        </Link>
        {query.isLoading ? <LoadingBlock label="Cargando detalle" /> : null}
        {query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : null}
        {feedback ? (
          <p
            role="status"
            className="rounded-lg bg-success-subtle px-4 py-3 text-sm text-text"
          >
            {feedback}
          </p>
        ) : null}
        {budget ? (
          <BudgetDetailContent
            budget={budget}
            pending={statusMutation.isPending}
            onStatus={(action) => statusMutation.mutate(action)}
            onAdjust={() => changeAdjustmentOpen(true)}
          />
        ) : null}
        {goal ? (
          <GoalDetailContent
            goal={goal}
            pending={statusMutation.isPending}
            onStatus={(action) => statusMutation.mutate(action)}
            onLinkBox={() => setBoxLinkOpen(true)}
          />
        ) : null}
      </div>
      {adjustmentOpen && budget ? (
        <BudgetEditDialog
          budget={budget}
          open
          pending={updateMutation.isPending}
          failed={updateMutation.isError}
          onOpenChange={changeAdjustmentOpen}
          onSubmit={(payload) => updateMutation.mutate(payload)}
        />
      ) : null}
      {boxLinkOpen && goal ? (
        <GoalBoxLinkDialog
          open
          boxes={boxesQuery.data ?? []}
          loading={boxesQuery.isLoading}
          failed={boxesQuery.isError}
          saving={linkMutation.isPending}
          saveFailed={linkMutation.isError}
          onOpenChange={setBoxLinkOpen}
          onRetry={() => void boxesQuery.refetch()}
          onLink={(boxId) => linkMutation.mutate(boxId)}
        />
      ) : null}
    </AppShell>
  );
}
