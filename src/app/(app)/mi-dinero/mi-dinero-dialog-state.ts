import type { AccountMoneySummary, BoxMoneySummary } from "@/shared/api/money-types";
import type { MoveMoneyIntent } from "./move-money-logic";

export type DialogState =
  | { kind: "none" }
  | { kind: "create-account" }
  | { kind: "edit-account"; account: AccountMoneySummary }
  | { kind: "archive-account"; account: AccountMoneySummary }
  | { kind: "adjust-balance"; account: AccountMoneySummary }
  | { kind: "create-box"; accountId?: string }
  | { kind: "edit-box"; box: BoxMoneySummary }
  | { kind: "delete-box"; box: BoxMoneySummary }
  | { kind: "move-money"; intent: MoveMoneyIntent };
