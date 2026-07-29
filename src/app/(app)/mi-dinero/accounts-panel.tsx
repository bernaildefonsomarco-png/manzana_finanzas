"use client";

import Link from "next/link";
import { Plus, Settings2, ArrowLeftRight, Pencil, Archive } from "lucide-react";
import { Card, SectionHeader } from "@/ui/primitivas/card";
import { Badge } from "@/ui/primitivas/badge";
import { Button } from "@/ui/primitivas/button";
import { MoneyText } from "@/ui/primitivas/money";
import { accountTypeLabels, getAccountStatusLabel } from "@/shared/copy/money-copy";
import type { AccountMoneySummary } from "@/shared/api/money-types";

/** Parte de SCR-CUENTAS-01: lista de cuentas con sus acciones. */
export function AccountsPanel({
  accounts,
  onCreate,
  onEdit,
  onArchive,
  onAdjust,
  onTransfer,
}: {
  accounts: AccountMoneySummary[];
  onCreate: () => void;
  onEdit: (account: AccountMoneySummary) => void;
  onArchive: (account: AccountMoneySummary) => void;
  onAdjust: (account: AccountMoneySummary) => void;
  onTransfer: (account: AccountMoneySummary) => void;
}) {
  return (
    <Card className="p-5">
      <SectionHeader
        title="Cuentas"
        action={
          <Button size="sm" variant="secondary" icon={<Plus className="h-4 w-4" aria-hidden="true" />} onClick={onCreate}>
            Nueva
          </Button>
        }
      />
      <ul className="mt-4 divide-y divide-border">
        {accounts.map((account) => (
          <li key={account.id} className="flex items-center justify-between gap-3 py-3">
            <Link href={`/mi-dinero/cuentas/${account.id}`} className="min-w-0 flex-1">
              <p className="truncate font-medium text-text">{account.name}</p>
              <p className="truncate text-xs text-text-muted">
                {account.institution ?? accountTypeLabels[account.type]}
              </p>
            </Link>
            <div className="flex items-center gap-2">
              {account.balance_status !== "ok" ? (
                <Badge tone={account.balance_status === "negative" ? "error" : "warning"}>
                  {getAccountStatusLabel(account)}
                </Badge>
              ) : (
                <span className="text-xs text-text-muted">{getAccountStatusLabel(account)}</span>
              )}
              <MoneyText value={account.current_balance} className="w-24 text-right" />
              <Button
                size="icon"
                variant="ghost"
                title={`Ajustar saldo de ${account.name}`}
                aria-label={`Ajustar saldo de ${account.name}`}
                onClick={() => onAdjust(account)}
              >
                <Settings2 className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title={`Transferir desde ${account.name}`}
                aria-label={`Transferir desde ${account.name}`}
                onClick={() => onTransfer(account)}
              >
                <ArrowLeftRight className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title={`Editar cuenta ${account.name}`}
                aria-label={`Editar cuenta ${account.name}`}
                onClick={() => onEdit(account)}
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                title={`Archivar cuenta ${account.name}`}
                aria-label={`Archivar cuenta ${account.name}`}
                onClick={() => onArchive(account)}
              >
                <Archive className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );
}
