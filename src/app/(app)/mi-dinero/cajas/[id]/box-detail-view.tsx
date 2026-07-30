"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/ui/primitivas/card";
import { MoneyText } from "@/ui/primitivas/money";
import { Progress } from "@/ui/primitivas/progress";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { queryKeys } from "@/shared/data/query-keys";
import { getBoxDetail } from "@/shared/api/money";
import type { BoxMoneySummary } from "@/shared/api/money-types";
import { EditBoxDialog } from "../../edit-box-dialog";
import { DeleteBoxDialog } from "../../delete-box-dialog";
import { MoveMoneyDialog } from "../../move-money-dialog";
import { BoxDetailHeader } from "./box-detail-header";

/** SCR-CUENTAS-03: detalle de caja. */
export function BoxDetailView({ boxId }: { boxId: string }) {
  const [dialog, setDialog] = useState<"none" | "edit" | "delete" | "move">("none");
  const query = useQuery({
    queryKey: [...queryKeys.boxes, "detalle", boxId],
    queryFn: () => getBoxDetail(boxId),
  });

  if (query.isLoading) return <LoadingBlock label="Cargando caja…" />;

  if (query.isError || !query.data) {
    return (
      <ErrorState
        title="No pude cargar esta caja"
        description="Puede que ya no exista o que haya un problema temporal."
      />
    );
  }

  const { box, account } = query.data;
  const currency = account?.currency === "USD" ? "USD" : "PEN";
  const boxSummary: BoxMoneySummary = {
    ...box,
    account_name: account?.name ?? "Cuenta",
    currency,
  };
  const progress = box.target_amount ? Math.min(100, (box.current_balance / box.target_amount) * 100) : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card elevated className="p-6">
        <BoxDetailHeader
          box={box}
          accountName={account?.name}
          accountId={account?.id}
          onMove={() => setDialog("move")}
          onEdit={() => setDialog("edit")}
          onDelete={() => setDialog("delete")}
        />

        <MoneyText
          value={box.current_balance}
          currency={currency}
          className="mt-4 block text-3xl font-heading font-semibold"
        />

        {box.target_amount ? (
          <div className="mt-4">
            <div className="flex items-baseline justify-between text-sm text-text-secondary">
              <span>Meta</span>
              <MoneyText value={box.target_amount} currency={currency} />
            </div>
            <Progress
              value={box.current_balance}
              max={box.target_amount}
              aria-label={`${box.name}, ${box.current_balance.toFixed(0)} de ${box.target_amount.toFixed(0)} ${currency === "USD" ? "dolares" : "soles"}, ${progress?.toFixed(0)} por ciento`}
              className="mt-2"
            />
            {box.target_date ? (
              <p className="mt-2 text-xs text-text-muted">Fecha objetivo: {box.target_date}</p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Link href="/mi-dinero" className="inline-flex text-sm font-medium text-brand hover:text-brand-hover">
        Volver a Mi Dinero
      </Link>

      {dialog === "edit" ? (
        <EditBoxDialog
          box={boxSummary}
          open
          onOpenChange={(open) => !open && setDialog("none")}
          onDone={() => {
            setDialog("none");
            void query.refetch();
          }}
        />
      ) : null}
      {dialog === "delete" ? (
        <DeleteBoxDialog
          box={boxSummary}
          open
          onOpenChange={(open) => !open && setDialog("none")}
          onDone={() => {
            setDialog("none");
            void query.refetch();
          }}
        />
      ) : null}
      {dialog === "move" ? (
        <MoveMoneyDialog
          open
          onOpenChange={(open) => !open && setDialog("none")}
          intent={{ kind: "release_from_box", boxId: box.id }}
          accounts={
            account
              ? [{ ...account, boxes_total: 0, free_balance: 0, box_count: 0, balance_status: "ok" }]
              : []
          }
          boxes={[boxSummary]}
          onDone={() => {
            setDialog("none");
            void query.refetch();
          }}
        />
      ) : null}
    </div>
  );
}
