"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Settings2 } from "lucide-react";
import { Card, SectionHeader } from "@/ui/primitivas/card";
import { Button } from "@/ui/primitivas/button";
import { MoneyText } from "@/ui/primitivas/money";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { queryKeys } from "@/shared/data/query-keys";
import { getAccountDetail } from "@/shared/api/money";
import { accountTypeLabels } from "@/shared/copy/money-copy";
import { AdjustBalanceDialog } from "../../adjust-balance-dialog";
import { AccountRecentMovements } from "./account-recent-movements";

/** SCR-CUENTAS-02: detalle de cuenta. */
export function AccountDetailView({ accountId }: { accountId: string }) {
  const [adjustOpen, setAdjustOpen] = useState(false);
  const query = useQuery({
    queryKey: [...queryKeys.accounts, "detalle", accountId],
    queryFn: () => getAccountDetail(accountId),
  });

  if (query.isLoading) return <LoadingBlock label="Cargando cuenta…" />;

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No pude cargar esta cuenta"
        description="Puede que ya no exista o que haya un problema temporal."
      />
    );
  }

  const { account, free_balance, boxes } = query.data;
  const isNegative = account.current_balance < 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card elevated className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-medium text-text-muted">
              {account.institution ?? accountTypeLabels[account.type]}
            </p>
            <h1 className="mt-1 font-heading text-2xl font-semibold text-text">{account.name}</h1>
          </div>
          <Button
            size="sm"
            variant="secondary"
            icon={<Settings2 className="h-4 w-4" aria-hidden="true" />}
            onClick={() => setAdjustOpen(true)}
          >
            Ajustar saldo
          </Button>
        </div>

        <MoneyText
          value={account.current_balance}
          currency={account.currency === "USD" ? "USD" : "PEN"}
          className="mt-4 block text-3xl font-heading font-semibold"
        />

        {isNegative ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-error-subtle bg-error-subtle/40 px-3 py-2 text-sm text-error-on-subtle">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Esta cuenta tiene saldo negativo. Puedes ajustarlo si el dato real es distinto.</span>
          </div>
        ) : null}

        <dl className="mt-5 grid grid-cols-2 gap-4">
          <div>
            <dt className="text-xs font-medium text-text-muted">Saldo inicial</dt>
            <dd className="mt-1 text-sm text-text">
              <MoneyText
                value={account.initial_balance}
                currency={account.currency === "USD" ? "USD" : "PEN"}
              />
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium text-text-muted">Libre en esta cuenta</dt>
            <dd className="mt-1 text-sm text-text">
              <MoneyText
                value={free_balance}
                currency={account.currency === "USD" ? "USD" : "PEN"}
              />
            </dd>
          </div>
        </dl>
      </Card>

      <Card className="p-5">
        <SectionHeader title="Cajas de esta cuenta" />
        {boxes.length === 0 ? (
          <p className="mt-3 text-sm text-text-muted">Sin cajas.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border">
            {boxes.map((box) => (
              <li key={box.id} className="flex items-center justify-between py-2">
                <Link href={`/mi-dinero/cajas/${box.id}`} className="text-sm font-medium text-text hover:text-brand">
                  {box.name}
                </Link>
                <MoneyText
                  value={box.current_balance}
                  currency={account.currency === "USD" ? "USD" : "PEN"}
                  className="text-sm"
                />
              </li>
            ))}
          </ul>
        )}
      </Card>

      <AccountRecentMovements accountId={accountId} />

      <Link
        href="/mi-dinero"
        className="inline-flex text-sm font-medium text-brand hover:text-brand-hover"
      >
        Volver a Mi Dinero
      </Link>

      <AdjustBalanceDialog
        account={{ ...account, boxes_total: 0, free_balance, box_count: boxes.length, balance_status: isNegative ? "negative" : "ok" }}
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        onDone={() => {
          setAdjustOpen(false);
          void query.refetch();
        }}
      />
    </div>
  );
}
