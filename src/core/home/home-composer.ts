import type { BudgetWithProgress } from "@/data/repositories/budgets.repository";
import type { PublicReminder } from "@/data/repositories/reminders.repository";
import type { UpcomingCommitmentSummary } from "@/data/repositories/recurring.repository";
import type { InsightCandidate, Movement } from "@/shared/types/domain";
import { selectNextAction } from "./home-precedence";

/**
 * `39` §5: umbrales sobre movimientos confirmados. Son de presentación, no de
 * capacidad (`AC-HOME-*` no dependen de este número salvo el estado
 * `vacio`, que sustituye toda la pantalla por `SCR-HOME-02`).
 */
export type HomeState = "vacio" | "temprano" | "funcional" | "completo";

export function computeHomeState(confirmedMovementsCount: number): HomeState {
  if (confirmedMovementsCount <= 0) return "vacio";
  if (confirmedMovementsCount <= 10) return "temprano";
  if (confirmedMovementsCount <= 50) return "funcional";
  return "completo";
}

export const HOME_BLOCK_KINDS = [
  "free_money",
  "next_action",
  "pending",
  "month",
  "upcoming",
  "insight",
  "movements",
] as const;

export type HomeBlockKind = (typeof HOME_BLOCK_KINDS)[number];

export type HomeBlockStatus = "ok" | "error" | "unavailable";

export type HomeBlock = {
  kind: HomeBlockKind;
  status: HomeBlockStatus;
  retryable?: boolean;
  data?: unknown;
};

export type HomeComposition = {
  state: HomeState;
  blocks: HomeBlock[];
};

/** `RUL-HOME-09`: cada fuente llega ya resuelta u ya fallida; ningún bloque
 * tumba a los demás. El compositor nunca hace `fetch`: solo compone. */
export type Settled<T> = { ok: true; value: T } | { ok: false };

export type FreeMoneyComposition =
  | { has_accounts: true; total_balance: number; separated_balance: number; free_balance: number; account_count: number; box_count: number }
  | { has_accounts: false };

export type PendingSummary = {
  active_count: number;
  needs_completion_count: number;
  high_risk_count: number;
};

export type PeriodTotal = { gasto_total: number; ingreso_total: number };

export type ProjectionSummary = {
  free_money: number;
  projected_close: number | null;
  currency: "PEN";
};

export type HomeComposerInput = {
  confirmedMovementsCount: number;
  hiddenBlocks: ReadonlySet<HomeBlockKind>;
  freeMoney: Settled<FreeMoneyComposition>;
  reminders: Settled<PublicReminder[]>;
  pending: Settled<PendingSummary>;
  budgets: Settled<BudgetWithProgress[]>;
  projection: Settled<ProjectionSummary | null>;
  periodTotal: Settled<PeriodTotal | null>;
  upcoming: Settled<UpcomingCommitmentSummary[]>;
  insight: Settled<InsightCandidate | null>;
  movements: Settled<Movement[]>;
};

const OPEN_REMINDER_STATUSES = new Set(["en_bandeja", "leido"]);
const MAX_UPCOMING = 5;
const MAX_BUDGETS = 3;
const MAX_MOVEMENTS = 6;

/**
 * `39` §10: compone los bloques del Inicio a partir de datos ya calculados
 * por sus módulos dueños (`RUL-HOME-02`, ninguna aritmética financiera
 * propia). Puro: sin I/O, para poder probar cada caso borde de §19 sin red
 * ni base de datos.
 */
export function composeHome(input: HomeComposerInput): HomeComposition {
  const state = computeHomeState(input.confirmedMovementsCount);

  // `RUL-HOME-05` excepción: en estado vacío la pantalla es el onboarding de
  // `SCR-HOME-02` (`WEB-D251`), no un Inicio con huecos. El cliente decide
  // qué renderizar por `state`, pero la API tampoco compone bloques que
  // nadie va a mostrar.
  if (state === "vacio") return { state, blocks: [] };

  const blocks: HomeBlock[] = [];

  pushBlock(blocks, input.hiddenBlocks, freeMoneyBlock(input.freeMoney));

  const nextAction = nextActionBlock(input.reminders);
  if (nextAction) pushBlock(blocks, input.hiddenBlocks, nextAction);

  const pending = pendingBlock(input.pending);
  if (pending) pushBlock(blocks, input.hiddenBlocks, pending);

  const month = monthBlock(input.budgets, input.projection, input.periodTotal);
  if (month) pushBlock(blocks, input.hiddenBlocks, month);

  const upcoming = upcomingBlock(input.upcoming);
  if (upcoming) pushBlock(blocks, input.hiddenBlocks, upcoming);

  const insight = insightBlock(input.insight);
  if (insight) pushBlock(blocks, input.hiddenBlocks, insight);

  const movements = movementsBlock(input.movements);
  if (movements) pushBlock(blocks, input.hiddenBlocks, movements);

  return { state, blocks };
}

function pushBlock(
  blocks: HomeBlock[],
  hidden: ReadonlySet<HomeBlockKind>,
  block: HomeBlock | null,
) {
  if (!block) return;
  // `WEB-D064`: un bloque oculto a mano no reaparece, ni con `status:"error"`.
  if (hidden.has(block.kind)) return;
  blocks.push(block);
}

function freeMoneyBlock(freeMoney: Settled<FreeMoneyComposition>): HomeBlock {
  if (!freeMoney.ok) return { kind: "free_money", status: "error", retryable: true };
  if (!freeMoney.value.has_accounts) {
    return { kind: "free_money", status: "unavailable", data: { reason: "no_accounts" } };
  }
  return { kind: "free_money", status: "ok", data: freeMoney.value };
}

/** `RUL-HOME-04`: como máximo una, y solo de los niveles 1 a 4 — nunca una
 * pospuesta ni una que ya se degradó fuera de la bandeja. Compartida entre
 * `composeHome` y `GET /home/next` para que ambos elijan exactamente igual. */
export function pickNextAction(reminders: PublicReminder[]): PublicReminder | null {
  const openCandidates = reminders.filter((reminder) => OPEN_REMINDER_STATUSES.has(reminder.status));
  return selectNextAction(openCandidates);
}

function nextActionBlock(reminders: Settled<PublicReminder[]>): HomeBlock | null {
  if (!reminders.ok) return { kind: "next_action", status: "error", retryable: true };
  const winner = pickNextAction(reminders.value);
  if (!winner) return null;
  return { kind: "next_action", status: "ok", data: winner };
}

function pendingBlock(pending: Settled<PendingSummary>): HomeBlock | null {
  if (!pending.ok) return { kind: "pending", status: "error", retryable: true };
  if (pending.value.active_count <= 0) return null;
  return { kind: "pending", status: "ok", data: pending.value };
}

function monthBlock(
  budgets: Settled<BudgetWithProgress[]>,
  projection: Settled<ProjectionSummary | null>,
  periodTotal: Settled<PeriodTotal | null>,
): HomeBlock | null {
  const topBudgets = budgets.ok ? budgets.value.slice(0, MAX_BUDGETS) : [];
  const hasProjection = projection.ok && projection.value !== null;

  if (topBudgets.length > 0 || hasProjection) {
    return {
      kind: "month",
      status: "ok",
      data: {
        variant: "budgets_projection",
        budgets: topBudgets,
        projection: hasProjection ? projection.value : null,
      },
    };
  }

  // Sin presupuestos ni proyección calculable: cae al total simple del
  // periodo (`35` `SCR-REP-05`), típico de estado `temprano` (`39` §12).
  if (periodTotal.ok && periodTotal.value) {
    return { kind: "month", status: "ok", data: { variant: "period_total", period_total: periodTotal.value } };
  }

  // `RUL-HOME-09`: sin contenido positivo de ninguna de las tres fuentes, si
  // alguna realmente falló (no solo "no hay nada que mostrar todavía") el
  // bloque avisa y ofrece reintentar en vez de desaparecer en silencio.
  if (!budgets.ok || !projection.ok || !periodTotal.ok) {
    return { kind: "month", status: "error", retryable: true };
  }

  return null;
}

function upcomingBlock(upcoming: Settled<UpcomingCommitmentSummary[]>): HomeBlock | null {
  if (!upcoming.ok) return { kind: "upcoming", status: "error", retryable: true };
  if (upcoming.value.length === 0) return null;
  const items = [...upcoming.value]
    .sort((left, right) => left.due_at.localeCompare(right.due_at))
    .slice(0, MAX_UPCOMING);
  const total = items.reduce((sum, item) => sum + Number(item.amount), 0);
  return { kind: "upcoming", status: "ok", data: { items, total, count: upcoming.value.length } };
}

function insightBlock(insight: Settled<InsightCandidate | null>): HomeBlock | null {
  if (!insight.ok) return { kind: "insight", status: "error", retryable: true };
  if (!insight.value) return null;
  return { kind: "insight", status: "ok", data: insight.value };
}

function movementsBlock(movements: Settled<Movement[]>): HomeBlock | null {
  if (!movements.ok) return { kind: "movements", status: "error", retryable: true };
  if (movements.value.length === 0) return null;
  return { kind: "movements", status: "ok", data: movements.value.slice(0, MAX_MOVEMENTS) };
}
