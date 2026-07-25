import type {
  HomeDashboardSummary,
  HomeMoneySummary,
  HomePendingSummary,
  HomeSuggestedAction,
} from "./home-types";

export type HomePrimaryState =
  | "initial_action"
  | "needs_account"
  | "needs_pending_review"
  | "ready";

export function getHomePrimaryState(summary: HomeDashboardSummary): HomePrimaryState {
  if (summary.pending_summary.active_count > 0) return "needs_pending_review";
  if (summary.onboarding.show_initial_prompt) return "initial_action";
  if (!summary.money_summary) return "needs_account";
  return "ready";
}

export function getMoneyHeadline(money: HomeMoneySummary | null): string {
  if (!money) return "Dinero libre pendiente";
  return "Dinero libre";
}

export function getMoneyExplanation(money: HomeMoneySummary | null): string {
  if (!money) {
    return "Tus movimientos ya se guardan. Para calcular dinero libre falta crear al menos una cuenta.";
  }

  if (money.separated_balance <= 0) {
    return "No tienes dinero separado en cajas. El dinero libre coincide con tu saldo registrado.";
  }

  return "Es tu saldo registrado menos el dinero separado en cajas.";
}

export function getPendingTone(pending: HomePendingSummary): {
  title: string;
  body: string;
} {
  if (pending.active_count === 0) {
    return {
      title: "Todo revisado",
      body: "No hay pendientes afectando decisiones. Nada entra a tus saldos sin tu confirmacion.",
    };
  }

  if (pending.needs_completion_count > 0) {
    return {
      title: `${pending.active_count} por revisar`,
      body: "Hay datos separados esperando que completes o confirmes. Aun no tocan tu saldo.",
    };
  }

  return {
    title: `${pending.active_count} pendiente${pending.active_count === 1 ? "" : "s"}`,
    body: "Manzana los separo para que decidas antes de registrarlos.",
  };
}

export function getSuggestedAction(
  summary: HomeDashboardSummary
): HomeSuggestedAction | null {
  if (summary.suggested_action) return summary.suggested_action;

  if (summary.pending_summary.active_count > 0) {
    return {
      label: "Revisar pendientes",
      description: "Confirma, edita o descarta lo que todavia no debe tocar tu saldo.",
      target_view: "pending",
      priority: "primary",
    };
  }

  if (summary.onboarding.show_initial_prompt) {
    return {
      label: "Registrar primer movimiento",
      description: "Empieza con un gasto o ingreso, sin configurar una cuenta.",
      target_view: "movements",
      priority: "primary",
    };
  }

  if (!summary.money_summary) {
    return {
      label: "Crear primera cuenta",
      description: "Activa calculos de saldos y dinero libre sin cambiar tus movimientos actuales.",
      target_view: "money",
      priority: "primary",
    };
  }

  return null;
}
