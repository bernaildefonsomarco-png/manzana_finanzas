"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Plus, Wallet, ShieldCheck, X } from "lucide-react";
import { Card, SectionHeader } from "@/ui/primitivas/card";
import { Button } from "@/ui/primitivas/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { queryKeys } from "@/shared/data/query-keys";
import { getMoneyDashboard } from "@/shared/api/money";
import { HeroCard } from "./hero-card";
import { AccountsPanel } from "./accounts-panel";
import { ArchivedAccountsPanel } from "./archived-accounts-panel";
import { BoxesPanel } from "./boxes-panel";
import { MiDineroDialogs } from "./mi-dinero-dialogs";
import type { DialogState } from "./mi-dinero-dialog-state";

/** SCR-CUENTAS-01: Mi Dinero — las cuatro capas, cuentas y cajas. */
export function MiDineroScreen() {
  const [dialog, setDialog] = useState<DialogState>({ kind: "none" });
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.summary,
    queryFn: getMoneyDashboard,
  });

  function onDone(message: string) {
    setDialog({ kind: "none" });
    setFeedback(message);
  }

  if (query.isLoading) return <LoadingBlock label="Calculando Mi Dinero" />;

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No pude cargar Mi Dinero"
        description="Intenta de nuevo en un momento."
        onRetry={() => void query.refetch()}
      />
    );
  }

  const data = query.data;
  const hasAccounts = data.accounts.length > 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24">
      {feedback ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-lg border border-success-subtle bg-success-subtle/40 px-4 py-3 text-sm text-success-on-subtle"
        >
          <div className="flex items-start gap-2">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <span>{feedback}</span>
          </div>
          <button type="button" aria-label="Cerrar mensaje" onClick={() => setFeedback(null)}>
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <HeroCard
        data={data}
        hasAccounts={hasAccounts}
        onCreateAccount={() => setDialog({ kind: "create-account" })}
        onMoveMoney={() => setDialog({ kind: "move-money", intent: { kind: "transfer" } })}
      />

      {!hasAccounts ? (
        <EmptyState
          icon={<Wallet className="h-6 w-6" aria-hidden="true" />}
          title="Agrega tu primera cuenta"
          description="Puedes empezar con Yape, efectivo o una cuenta bancaria. No hace falta que el saldo sea perfecto: Manzana lo marcara como dato declarado por ti."
          action={<Button onClick={() => setDialog({ kind: "create-account" })}>Agregar cuenta</Button>}
        />
      ) : (
        <>
          <AccountsPanel
            accounts={data.accounts}
            onCreate={() => setDialog({ kind: "create-account" })}
            onEdit={(account) => setDialog({ kind: "edit-account", account })}
            onArchive={(account) => setDialog({ kind: "archive-account", account })}
            onAdjust={(account) => setDialog({ kind: "adjust-balance", account })}
            onTransfer={(account) =>
              setDialog({ kind: "move-money", intent: { kind: "transfer", fromAccountId: account.id } })
            }
          />
          <ArchivedAccountsPanel show={showArchived} onToggle={() => setShowArchived((v) => !v)} onDone={onDone} />
          <BoxesPanel
            boxes={data.boxes}
            hasAccounts={hasAccounts}
            onCreate={() => setDialog({ kind: "create-box" })}
            onEdit={(box) => setDialog({ kind: "edit-box", box })}
            onDelete={(box) => setDialog({ kind: "delete-box", box })}
            onMove={(box) => setDialog({ kind: "move-money", intent: { kind: "release_from_box", boxId: box.id } })}
          />
        </>
      )}

      {data.data_quality.warnings.length > 0 ? (
        <Card className="p-5">
          <SectionHeader title="Algo merece revision" />
          <ul className="mt-3 space-y-2 text-sm text-text-secondary">
            {data.data_quality.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="p-5">
        <SectionHeader title="Pendientes no cuentan" />
        <p className="mt-2 text-sm text-text-secondary">
          Lo detectado por WhatsApp o email no afecta saldos hasta que lo confirmes. Si algo esta
          esperando, vive en Pendientes.
        </p>
        <Link href="/pendientes" className="mt-3 inline-flex text-sm font-medium text-brand hover:text-brand-hover">
          Ver pendientes
        </Link>
      </Card>

      <MiDineroDialogs dialog={dialog} data={data} onClose={() => setDialog({ kind: "none" })} onDone={onDone} />

      <Button
        className="fixed bottom-24 right-4 rounded-full shadow-lg sm:hidden"
        size="icon"
        aria-label="Agregar cuenta"
        onClick={() => setDialog({ kind: "create-account" })}
      >
        <Plus className="h-5 w-5" aria-hidden="true" />
      </Button>
    </div>
  );
}
