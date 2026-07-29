"use client";

import { Plus, ArrowLeftRight } from "lucide-react";
import { Card } from "@/ui/primitivas/card";
import { Button } from "@/ui/primitivas/button";
import { MoneyText } from "@/ui/primitivas/money";
import { getMoneyHeroCopy } from "@/shared/copy/money-copy";
import type { MoneyDashboardResponse } from "@/shared/api/money-types";

/** SCR-CUENTAS-01: cabecera con las cuatro capas (09 §2-3). */
export function HeroCard({
  data,
  hasAccounts,
  onCreateAccount,
  onMoveMoney,
}: {
  data: MoneyDashboardResponse;
  hasAccounts: boolean;
  onCreateAccount: () => void;
  onMoveMoney: () => void;
}) {
  const heroCopy = getMoneyHeroCopy({
    hasAccounts,
    separatedInBoxes: data.separated_in_boxes,
    upcomingUncoveredCommitments: data.upcoming_uncovered_commitments,
  });

  return (
    <Card elevated className="p-6">
      {hasAccounts ? (
        <>
          <p className="text-sm font-medium text-text-secondary">Dinero libre</p>
          <MoneyText value={data.operational_free_money} className="mt-1 block text-4xl font-heading font-semibold" />
        </>
      ) : (
        <p className="text-2xl font-heading font-semibold text-text">Todavia no calculamos saldos</p>
      )}
      <p className="mt-2 text-sm text-text-secondary">{heroCopy}</p>

      <dl className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <MoneyMetric label="Total" value={data.total_balance} disabled={!hasAccounts} />
        <MoneyMetric label="Separado" value={data.separated_in_boxes} disabled={!hasAccounts} />
        <MoneyMetric label="Libre en cuentas" value={data.free_in_accounts} disabled={!hasAccounts} />
        <MoneyMetric
          label="Compromisos sin cubrir"
          value={data.upcoming_uncovered_commitments}
          disabled={!hasAccounts}
        />
      </dl>

      <div className="mt-5 flex flex-wrap gap-2">
        {hasAccounts ? (
          <>
            <Button variant="secondary" icon={<ArrowLeftRight className="h-4 w-4" aria-hidden="true" />} onClick={onMoveMoney}>
              Mover dinero
            </Button>
            <Button variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={onCreateAccount}>
              Agregar cuenta
            </Button>
          </>
        ) : (
          <Button onClick={onCreateAccount}>Crear primera cuenta</Button>
        )}
      </div>
    </Card>
  );
}

function MoneyMetric({ label, value, disabled }: { label: string; value: number; disabled: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-text">
        {disabled ? <span className="text-text-muted">Sin dato</span> : <MoneyText value={value} />}
      </dd>
    </div>
  );
}
