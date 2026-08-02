import type { Movement } from "@/shared/types/domain";

export type HomeState = "vacio" | "temprano" | "funcional" | "completo";

export type HomeBlockKind =
  | "free_money"
  | "next_action"
  | "pending"
  | "month"
  | "upcoming"
  | "insight"
  | "movements";

export type HomeBlockStatus = "ok" | "error" | "unavailable";

export type HomeFreeMoneyData =
  | {
      has_accounts: true;
      total_balance: number;
      separated_balance: number;
      free_balance: number;
      account_count: number;
      box_count: number;
    }
  | { has_accounts: false; reason?: "no_accounts" };

export type HomeReminderKind =
  | "pago_proximo"
  | "pago_vencido"
  | "cuota_proxima"
  | "cuota_vencida"
  | "presupuesto_umbral"
  | "pendientes_acumulados"
  | "sin_registrar"
  | "correo_desconectado"
  | "descarga_lista"
  | "confirmar_hecho";

export type HomeNextAction = {
  id: string;
  kind: HomeReminderKind;
  title: string;
  body: string;
  action_url: string | null;
};

export type HomePendingData = {
  active_count: number;
  needs_completion_count: number;
  high_risk_count: number;
};

export type HomeBudgetSummary = {
  id: string;
  category_name: string | null;
  amount: number;
  currency: string;
  spent: number;
  percentage: number;
  band: string;
};

export type HomeMonthData =
  | { variant: "budgets_projection"; budgets: HomeBudgetSummary[]; projection: { free_money: number; projected_close: number | null; currency: "PEN" } | null }
  | { variant: "period_total"; period_total: { gasto_total: number; ingreso_total: number } };

export type HomeCommitmentItem = {
  id: string;
  title: string;
  amount: number;
  currency: "PEN" | "USD";
  due_at: string;
  kind: "recurring" | "debt";
};

export type HomeUpcomingData = {
  items: HomeCommitmentItem[];
  total: number;
  count: number;
};

export type HomeInsightData = {
  id: string;
  title: string;
  body: string;
  evidence_text: string;
};

export type HomeBlockDataByKind = {
  free_money: HomeFreeMoneyData;
  next_action: HomeNextAction;
  pending: HomePendingData;
  month: HomeMonthData;
  upcoming: HomeUpcomingData;
  insight: HomeInsightData;
  movements: Movement[];
};

export type HomeBlock<K extends HomeBlockKind = HomeBlockKind> = {
  kind: K;
  status: HomeBlockStatus;
  retryable?: boolean;
  data?: HomeBlockDataByKind[K];
};

export type HomeComposition = {
  state: HomeState;
  blocks: HomeBlock[];
};
