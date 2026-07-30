"use client";

import { use } from "react";
import { useSearchParams } from "next/navigation";
import { BudgetDetailScreen } from "@/features/budgets/budget-detail-screen";
import {
  useLegacyNavigate,
  useLegacySignOut,
} from "@/shared/legacy-nav/legacy-view-routes";

export default function PresupuestoDetallePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const searchParams = useSearchParams();
  const onNavigate = useLegacyNavigate();
  const onSignOut = useLegacySignOut();
  return (
    <BudgetDetailScreen
      id={id}
      entity={searchParams.get("tipo") === "meta" ? "goal" : "budget"}
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    />
  );
}
