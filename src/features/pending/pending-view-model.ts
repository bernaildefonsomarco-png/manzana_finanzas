import type { PendingItem, PendingSource, PendingType } from "@/shared/types/domain";

export type PendingViewItem = {
  id: string;
  title: string;
  subtitle: string;
  amount: number | null;
  currency: "PEN" | "USD";
  moneySign: "positive" | "negative" | "none";
  source: PendingSource;
  sourceLabel: string;
  type: PendingType;
  typeLabel: string;
  ageLabel: string;
  confidenceLabel: string;
  reasonLabel: string;
  riskLabel: string;
  needsCompletion: boolean;
};

const sourceLabels: Record<PendingSource, string> = {
  email_pending: "Email detectado",
  backfill_pending: "Reconstrucción",
  recurring_candidate: "Pago posible",
  ambiguous_movement: "WhatsApp",
  risk_confirmation: "Por seguridad",
};

const typeLabels: Record<PendingType, string> = {
  email_detected: "Movimiento detectado",
  ambiguous_movement: "Dato incompleto",
  recurring_candidate: "Posible recurrente",
  backfill_item: "Registro historico",
  data_quality: "Calidad de datos",
  risk_confirmation: "Confirmación sensible",
};

export function toPendingViewItem(item: PendingItem): PendingViewItem {
  const summary = item.normalized_summary;
  const title = cleanText(summary.title) ?? typeLabels[item.type];
  const subtitle = cleanText(summary.subtitle) ?? defaultSubtitle(item);
  const amount =
    typeof summary.amount === "number" && Number.isFinite(summary.amount)
      ? summary.amount
      : null;
  const completion = getCompletionState(item, amount);

  return {
    id: item.id,
    title,
    subtitle,
    amount,
    currency: summary.currency ?? "PEN",
    moneySign: getMoneySign(item),
    source: item.source,
    sourceLabel: sourceLabels[item.source],
    type: item.type,
    typeLabel: typeLabels[item.type],
    ageLabel: formatPendingAge(item.created_at),
    confidenceLabel: summary.confidence_label ?? "Por confirmar",
    reasonLabel: getReasonLabel(item),
    riskLabel: getRiskLabel(item.risk_level),
    needsCompletion: completion.needsCompletion,
  };
}

function getMoneySign(item: PendingItem): "positive" | "negative" | "none" {
  const sign = item.metadata.money_sign;

  if (sign === "positive" || sign === "negative" || sign === "none") {
    return sign;
  }

  return "negative";
}

export function formatPendingAge(value: string, now = new Date()): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Fecha por revisar";

  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60_000));

  if (diffMinutes < 60) {
    return diffMinutes <= 1 ? "Hace un momento" : `Hace ${diffMinutes} min`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return diffHours === 1 ? "Hace 1 hora" : `Hace ${diffHours} horas`;
  }

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} dias`;

  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
  }).format(date);
}

function getReasonLabel(item: PendingItem): string {
  if (item.dedup_status === "possible_duplicate") {
    return "Se parece a algo ya registrado";
  }

  const action = cleanText(
    typeof item.proposed_action.action === "string"
      ? item.proposed_action.action
      : null,
  );
  if (action === "review_specialized") {
    return "Falta resolver deuda, recurrente o cuentas";
  }
  if (action === "record_debt_payment") {
    return "Pago de deuda listo para validar";
  }
  if (action === "record_recurring_payment") {
    return "Pago recurrente listo para validar";
  }
  if (action === "record_transfer") {
    return "Transferencia lista para validar";
  }

  if (!item.normalized_summary.category_id) {
    return "Falta categoría";
  }

  if (item.type === "email_detected") {
    return "Detectado, no registrado";
  }

  if (item.type === "ambiguous_movement") {
    return "Necesita una confirmación";
  }

  return "Listo para revisar";
}

function getCompletionState(
  item: PendingItem,
  amount: number | null,
): { needsCompletion: boolean } {
  if (amount === null) return { needsCompletion: true };
  const action =
    typeof item.proposed_action.action === "string"
      ? item.proposed_action.action
      : "create_movement";
  if (action === "review_specialized") return { needsCompletion: true };
  if (action === "record_debt_payment") {
    return {
      needsCompletion:
        typeof item.proposed_action.debt_id !== "string",
    };
  }
  if (action === "record_recurring_payment") {
    return {
      needsCompletion:
        typeof item.proposed_action.recurring_rule_id !== "string" ||
        typeof item.proposed_action.recurring_occurrence_id !== "string",
    };
  }
  if (action === "record_transfer") {
    return {
      needsCompletion:
        typeof item.proposed_action.account_origin_id !== "string" ||
        typeof item.proposed_action.account_destination_id !== "string",
    };
  }
  return { needsCompletion: !item.normalized_summary.category_id };
}

function getRiskLabel(risk: PendingItem["risk_level"]): string {
  if (risk === "sensitive") return "Dato sensible";
  if (risk === "high") return "Revisar con cuidado";
  if (risk === "medium") return "Revisión normal";
  return "Bajo riesgo";
}

function defaultSubtitle(item: PendingItem): string {
  if (item.source === "email_pending") {
    return "Vino de una fuente externa y espera tu aprobación.";
  }

  if (item.source === "ambiguous_movement") {
    return "Manzana entendio una parte, pero no quiere asumir.";
  }

  return "Pendiente separado de tus movimientos confirmados.";
}

function cleanText(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}
