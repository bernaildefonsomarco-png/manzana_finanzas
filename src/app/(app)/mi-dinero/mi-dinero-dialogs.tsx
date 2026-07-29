"use client";

import type { MoneyDashboardResponse } from "@/shared/api/money-types";
import { CreateAccountDialog } from "./create-account-dialog";
import { EditAccountDialog } from "./edit-account-dialog";
import { ArchiveAccountDialog } from "./archive-account-dialog";
import { CreateBoxDialog } from "./create-box-dialog";
import { EditBoxDialog } from "./edit-box-dialog";
import { DeleteBoxDialog } from "./delete-box-dialog";
import { MoveMoneyDialog } from "./move-money-dialog";
import { AdjustBalanceDialog } from "./adjust-balance-dialog";
import type { DialogState } from "./mi-dinero-dialog-state";

/** Todos los dialogos de SCR-CUENTAS-01, cableados a `dialog` (mi-dinero-dialog-state.ts). */
export function MiDineroDialogs({
  dialog,
  data,
  onClose,
  onDone,
}: {
  dialog: DialogState;
  data: MoneyDashboardResponse;
  onClose: () => void;
  onDone: (message: string) => void;
}) {
  const onOpenChange = (open: boolean) => !open && onClose();

  switch (dialog.kind) {
    case "create-account":
      return <CreateAccountDialog open onOpenChange={onOpenChange} onDone={onDone} />;
    case "edit-account":
      return <EditAccountDialog account={dialog.account} open onOpenChange={onOpenChange} onDone={onDone} />;
    case "archive-account":
      return <ArchiveAccountDialog account={dialog.account} open onOpenChange={onOpenChange} onDone={onDone} />;
    case "adjust-balance":
      return <AdjustBalanceDialog account={dialog.account} open onOpenChange={onOpenChange} onDone={onDone} />;
    case "create-box":
      return (
        <CreateBoxDialog
          open
          onOpenChange={onOpenChange}
          accounts={data.accounts}
          defaultAccountId={dialog.accountId}
          onDone={onDone}
        />
      );
    case "edit-box":
      return <EditBoxDialog box={dialog.box} open onOpenChange={onOpenChange} onDone={onDone} />;
    case "delete-box":
      return <DeleteBoxDialog box={dialog.box} open onOpenChange={onOpenChange} onDone={onDone} />;
    case "move-money":
      return (
        <MoveMoneyDialog
          open
          onOpenChange={onOpenChange}
          intent={dialog.intent}
          accounts={data.accounts}
          boxes={data.boxes}
          onDone={onDone}
        />
      );
    case "none":
      return null;
  }
}
