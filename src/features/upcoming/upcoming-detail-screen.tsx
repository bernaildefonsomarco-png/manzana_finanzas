"use client";

import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, History, WalletCards } from "lucide-react";
import {
  AppShell,
  type AppView,
} from "@/features/app-shell/app-shell";
import { queryKeys } from "@/shared/data/query-keys";
import { todayInLima, toIsoDate } from "@/shared/dates/lima";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { Card, SectionHeader } from "@/ui/primitivas/card";
import { DiscreetValue, MoneyText } from "@/ui/primitivas/money";
import {
  EmptyState,
  ErrorState,
  SkeletonCard,
} from "@/ui/primitivas/states";
import {
  getRecurringRule,
  listRecurringOccurrences,
} from "./upcoming-api";
import {
  amountVariabilityLabels,
  formatFullDate,
  formatUpcomingMoney,
  frequencyLabels,
  toRecurringHistoryView,
} from "./upcoming-view-model";

export function UpcomingDetailScreen({
  ruleId,
  onBack,
  onNavigate,
  onSignOut,
}: {
  ruleId: string;
  onBack: () => void;
  onNavigate?: (view: AppView) => void;
  onSignOut?: () => void;
}) {
  const { discreet } = useDiscreetMode();
  const today = todayInLima();
  const todayIso = toIsoDate(today.year, today.month, today.day);
  const ruleQuery = useQuery({
    queryKey: [...queryKeys.recurringRules.all, ruleId, "detail"],
    queryFn: () => getRecurringRule(ruleId),
  });
  const occurrencesQuery = useQuery({
    queryKey: [...queryKeys.recurringRules.all, ruleId, "occurrences"],
    queryFn: () => listRecurringOccurrences(ruleId),
  });
  const rule = ruleQuery.data;
  const history =
    rule && occurrencesQuery.data
      ? toRecurringHistoryView(
          occurrencesQuery.data.occurrences,
          rule,
          todayIso
        )
      : [];

  return (
    <AppShell
      title="Pago que viene"
      activeView="upcoming"
      onNavigate={onNavigate}
      onSignOut={onSignOut}
      primaryAction={
        <Button
          variant="secondary"
          icon={<ArrowLeft className="h-4 w-4" />}
          onClick={onBack}
        >
          Volver
        </Button>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6">
        {ruleQuery.isLoading || occurrencesQuery.isLoading ? (
          <div role="status" aria-label="Cargando detalle" className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ) : ruleQuery.isError || occurrencesQuery.isError || !rule ? (
          <ErrorState
            title="No pude cargar este pago que viene"
            description="Puede que ya no esté disponible o que la conexión haya fallado."
            onRetry={() => {
              void ruleQuery.refetch();
              void occurrencesQuery.refetch();
            }}
          />
        ) : (
          <>
            <Card className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium text-text-muted">
                    Detalle del compromiso
                  </p>
                  <h2 className="mt-1 font-heading text-2xl font-semibold text-text">
                    {discreet ? "Pago que viene" : rule.name}
                  </h2>
                </div>
                <Badge tone={statusTone(rule.status)}>
                  {statusLabel(rule.status)}
                </Badge>
              </div>
              <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <DetailValue label="Monto esperado">
                  <CurrencyAmount
                    amount={rule.expected_amount}
                    currency={rule.currency}
                  />
                </DetailValue>
                <DetailValue label="Variabilidad">
                  {amountVariabilityLabels[rule.amount_variability]}
                </DetailValue>
                <DetailValue label="Frecuencia">
                  {frequencyLabels[rule.frequency]}
                </DetailValue>
                <DetailValue label="Próxima fecha">
                  {rule.next_expected_date
                    ? formatFullDate(rule.next_expected_date)
                    : "Por definir"}
                </DetailValue>
              </dl>
            </Card>

            <Card className="p-5">
              <SectionHeader title="Vínculos y efecto en tu dinero" />
              <div className="mt-4 space-y-3 text-sm text-text-secondary">
                {rule.linked_box_id ? (
                  <p className="flex items-start gap-2">
                    <WalletCards
                      className="mt-0.5 h-4 w-4 shrink-0"
                      aria-hidden="true"
                    />
                    Está vinculado a una caja. La cobertura exacta, incluida
                    cualquier diferencia, se calcula en tu dinero libre.
                  </p>
                ) : null}
                {rule.linked_debt_id ? (
                  <p>
                    Está vinculado a una deuda. El saldo y el pago de cuota se
                    gestionan desde Deudas para no contarlo dos veces.
                  </p>
                ) : (
                  <p>
                    Un pago esperado no cambia el saldo de una cuenta. Dentro
                    del horizonte sí cuenta como compromiso hasta que confirmes
                    el pago.
                  </p>
                )}
              </div>
            </Card>

            <section aria-labelledby="recurring-history-title">
              <p className="mb-1 text-xs font-medium text-text-muted">
                Fechas y estados guardados
              </p>
              <h2
                id="recurring-history-title"
                className="font-heading text-lg font-semibold text-text"
              >
                Historial de ocurrencias
              </h2>
              {history.length === 0 ? (
                <EmptyState
                  className="mt-3 min-h-56"
                  icon={<History className="h-6 w-6" />}
                  title="Aún no hay ocurrencias"
                  description="El trabajo diario genera las próximas fechas; abrir el detalle no crea ninguna."
                />
              ) : (
                <Card className="mt-3 overflow-hidden p-0">
                  <ul className="divide-y divide-border">
                    {history.map((occurrence) => (
                      <li
                        key={occurrence.id}
                        className="grid gap-3 px-4 py-4 sm:grid-cols-[1fr_auto_auto] sm:items-center"
                      >
                        <div className="flex items-start gap-2">
                          <CalendarDays
                            className="mt-0.5 h-4 w-4 text-text-muted"
                            aria-hidden="true"
                          />
                          <div>
                            <p className="font-medium text-text">
                              {formatFullDate(occurrence.expected_date)}
                            </p>
                            <p className="text-xs text-text-muted">
                              {occurrence.date_label}
                            </p>
                          </div>
                        </div>
                        <CurrencyAmount
                          amount={occurrence.amount}
                          currency={rule.currency}
                        />
                        <Badge tone={occurrence.status_tone}>
                          {occurrence.status_label}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
              <p className="mt-3 text-xs text-text-muted">
                El contrato actual expone el monto guardado en la ocurrencia;
                todavía no distingue aquí el monto real del movimiento pagado.
              </p>
            </section>

            <Button
              variant="secondary"
              icon={<ArrowLeft className="h-4 w-4" />}
              onClick={onBack}
            >
              Volver a pagos que vienen
            </Button>
          </>
        )}
      </div>
    </AppShell>
  );
}

function DetailValue({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-text">{children}</dd>
    </div>
  );
}

function CurrencyAmount({
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

function statusLabel(status: string): string {
  if (status === "active") return "Activo";
  if (status === "paused") return "Pausado";
  if (status === "cancelled") return "Cancelado";
  if (status === "archived") return "Archivado";
  return "Sugerido";
}

function statusTone(
  status: string
): "neutral" | "success" | "warning" | "info" {
  if (status === "active") return "success";
  if (status === "paused") return "warning";
  if (status === "suggested") return "info";
  return "neutral";
}
