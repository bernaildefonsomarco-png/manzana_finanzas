import type { Account, Box } from "@/shared/types/domain";

export type MoneyLayerSummary = {
  total_balance: number;
  separated_in_boxes: number;
  free_in_accounts: number;
  upcoming_uncovered_commitments: number;
  operational_free_money: number;
};

export type AccountBalanceStatus = "ok" | "negative" | "overspent";

export type AccountMoneySummary = Account & {
  boxes_total: number;
  free_balance: number;
  box_count: number;
  balance_status: AccountBalanceStatus;
};

export type BoxMoneySummary = Box & {
  account_name: string;
  currency: "PEN" | "USD";
};

export type CommitmentSummary = {
  id: string;
  title: string;
  amount: number;
  currency: "PEN" | "USD";
  due_at: string;
  kind: "debt" | "recurring";
  linked_box_id?: string | null;
};

export type MoneyDataQuality = {
  has_accounts: boolean;
  has_boxes: boolean;
  message: string;
  warnings: string[];
};

export type MoneyEmptyState = {
  reason: "no_accounts";
  title: string;
  description: string;
};

/** `GET /api/v1/money` — las cuatro capas (`09` §2-3, `24` §6). */
export type MoneyDashboardResponse = {
  /** Las claves históricas de las cuatro capas representan PEN. */
  base_currency: "PEN";
  /** Nunca se convierten ni suman monedas sin un tipo de cambio explícito. */
  currency_layers: Record<"PEN" | "USD", MoneyLayerSummary>;
  total_balance: number;
  free_in_accounts: number;
  operational_free_money: number;
  separated_in_boxes: number;
  upcoming_uncovered_commitments: number;
  accounts: AccountMoneySummary[];
  boxes: BoxMoneySummary[];
  commitments: CommitmentSummary[];
  data_quality: MoneyDataQuality;
  empty_state: MoneyEmptyState | null;
};
