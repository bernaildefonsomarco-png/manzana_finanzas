"use client";

import { useQuery } from "@tanstack/react-query";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { queryKeys } from "@/shared/data/query-keys";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { ProjectionBreakdown } from "./projection-breakdown";
import { ProjectionHero } from "./projection-hero";
import { SimulationCard } from "./projection-simulation-card";
import { ProjectionSituationCard } from "./projection-situation-card";
import {
  getMonthlySituation,
  getPeriodProjection,
  getProjectionBreakdown,
} from "./projections-api";

type Props = {
  onNavigate?: (view: AppView) => void;
  onSignOut?: () => void;
};

export function ProjectionsScreen({ onNavigate, onSignOut }: Props) {
  const projectionQuery = useQuery({
    queryKey: queryKeys.projections.period,
    queryFn: getPeriodProjection,
  });
  const situationQuery = useQuery({
    queryKey: queryKeys.projections.situation,
    queryFn: getMonthlySituation,
  });
  const breakdownQuery = useQuery({
    queryKey: queryKeys.projections.breakdown,
    queryFn: getProjectionBreakdown,
  });
  const loading =
    projectionQuery.isLoading ||
    situationQuery.isLoading ||
    breakdownQuery.isLoading;
  const error =
    projectionQuery.isError ||
    situationQuery.isError ||
    breakdownQuery.isError;

  return (
    <AppShell
      title="Proyecciones"
      subtitle="Una lectura reproducible del mes, con cada supuesto a la vista."
      activeView="projections"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
    >
      <div className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6">
        {loading ? <LoadingBlock label="Calculando con tus datos" /> : null}
        {error ? (
          <ErrorState
            title="No pude calcular la proyección"
            description="No mostraré una cifra aproximada. Reintenta para calcularla con el estado actual."
            onRetry={() => {
              void projectionQuery.refetch();
              void situationQuery.refetch();
              void breakdownQuery.refetch();
            }}
          />
        ) : null}
        {!loading && !error && projectionQuery.data ? (
          <>
            <ProjectionHero projection={projectionQuery.data} />
            <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
              <ProjectionBreakdown
                breakdown={breakdownQuery.data ?? null}
              />
              <ProjectionSituationCard
                facts={situationQuery.data?.summary_facts ?? []}
              />
            </div>
            <SimulationCard projection={projectionQuery.data} />
          </>
        ) : null}
      </div>
    </AppShell>
  );
}
