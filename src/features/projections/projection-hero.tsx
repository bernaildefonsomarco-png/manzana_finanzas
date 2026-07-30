"use client";

import { CalendarRange, ChevronRight } from "lucide-react";
import { Badge } from "@/ui/primitivas/badge";
import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { ProjectionEvidenceRefs } from "./projection-evidence-refs";
import type {
  PeriodProjectionView,
  ProjectionAssumptionView,
} from "./projections-types";

export function ProjectionHero({
  projection,
}: {
  projection: PeriodProjectionView;
}) {
  if (!projection.available) {
    const missingBalance = projection.reason === "no_balance_data";
    return (
      <Card className="p-6">
        <CalendarRange className="h-6 w-6 text-brand" />
        <h1 className="mt-4 font-heading text-xl font-semibold">
          {missingBalance ? "Falta un saldo conocido" : "Todavía faltan unos días"}
        </h1>
        <p className="mt-2 max-w-xl text-sm text-text-secondary">
          {missingBalance
            ? "Para calcular el cierre necesito al menos una cuenta en soles. Una cuenta conocida con saldo S/0 sí cuenta como dato."
            : "Con siete días civiles observables del mes podré mostrar el ritmo sin rellenar los huecos con una estimación."}
        </p>
        {missingBalance ? (
          <a
            href="/mi-dinero"
            className="mt-4 inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-medium"
          >
            Ir a Mi Dinero <ChevronRight className="h-4 w-4" />
          </a>
        ) : null}
      </Card>
    );
  }
  if (projection.assumptions.length === 0) {
    return (
      <Card className="p-6">
        <CalendarRange className="h-6 w-6 text-brand" />
        <h1 className="mt-4 font-heading text-xl font-semibold">
          No pude mostrar la proyección
        </h1>
        <p className="mt-2 max-w-xl text-sm text-text-secondary">
          El cálculo llegó sin sus supuestos obligatorios. No mostraré una
          cifra futura sin ellos.
        </p>
      </Card>
    );
  }
  return (
    <Card className="p-6">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm text-text-secondary">Al cierre de este mes</p>
          <h1 className="mt-2 font-heading text-3xl font-semibold tabular-nums">
            {projection.range ? (
              <>
                <MoneyText value={Number(projection.range.min)} /> a{" "}
                <MoneyText value={Number(projection.range.max)} />
              </>
            ) : (
              <MoneyText value={Number(projection.projection)} />
            )}
          </h1>
        </div>
        <Badge tone={projection.range ? "warning" : "info"}>
          {projection.range ? "Rango por variación" : "Cifra reproducible"}
        </Badge>
      </div>
      <p className="mt-5 text-sm text-text-secondary">
        Parte de <MoneyText value={Number(projection.free_money)} /> libres y
        aplica estos supuestos:
      </p>
      <ProjectionAssumptions assumptions={projection.assumptions} />
    </Card>
  );
}

function ProjectionAssumptions({
  assumptions,
}: {
  assumptions: ProjectionAssumptionView[];
}) {
  const hrefByRef = buildAssumptionReferenceHrefs(assumptions);
  return (
    <ul
      className="mt-3 grid gap-3 sm:grid-cols-2"
      aria-label="Supuestos de la proyección"
    >
      {assumptions.map((assumption) => (
        <li
          key={assumption.kind}
          className="rounded-lg border border-border bg-bg-surface px-3 py-3"
        >
          <p className="text-xs font-medium text-text-muted">
            {assumptionLabel(assumption)}
          </p>
          <p className="mt-1 text-sm font-medium">
            {assumptionValue(assumption)}
          </p>
          {assumption.kind === "daily_pace" ? (
            <p className="mt-1 text-xs text-text-secondary">
              {basisLabel(assumption.basis)}
            </p>
          ) : null}
          {assumption.kind === "future_income" ? (
            <p className="mt-1 text-xs text-text-secondary">
              Sin una fuente confirmada disponible en V1.
            </p>
          ) : null}
          <ProjectionEvidenceRefs
            refs={assumption.refs}
            hrefByRef={hrefByRef}
          />
        </li>
      ))}
    </ul>
  );
}

function buildAssumptionReferenceHrefs(
  assumptions: ProjectionAssumptionView[],
) {
  const result = new Map<string, string>();
  for (const assumption of assumptions) {
    if (assumption.kind === "commitments_already_discounted") {
      for (const ref of assumption.refs) {
        result.set(ref, "/pagos-que-vienen");
      }
    }
    if (assumption.kind === "daily_pace") {
      for (const ref of assumption.refs) {
        result.set(ref, `/movimientos/${encodeURIComponent(ref)}`);
      }
    }
  }
  return result;
}

function assumptionLabel(assumption: ProjectionAssumptionView) {
  if (assumption.kind === "commitments_already_discounted") {
    return "Compromisos ya descontados";
  }
  if (assumption.kind === "daily_pace") return "Ritmo diario";
  if (assumption.kind === "days_remaining") {
    return "Días restantes del mes Lima";
  }
  return "Ingresos futuros confirmados";
}

function assumptionValue(assumption: ProjectionAssumptionView) {
  if (assumption.kind === "days_remaining") {
    return `${assumption.value} días`;
  }
  return <MoneyText value={Number(assumption.amount)} />;
}

function basisLabel(basis: string) {
  return basis === "median_14_lima_calendar_days"
    ? "Mediana de 14 días civiles en Lima"
    : basis;
}
