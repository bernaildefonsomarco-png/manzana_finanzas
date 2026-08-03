import type { PendingItem } from "@/shared/types/domain";
import type { ConfirmationCardField, ConfirmationCardLevel } from "@/ui/domain/confirmation-card";

/**
 * `40` §3 define seis niveles por comando, pero `pending_items` no persiste
 * cuál corresponde a cada fila (`WEB-D266`) — se deriva de las señales que
 * sí existen: `risk_level` (calculado por el motor) y `confirmable`
 * (`RUL-PEND-01`, "calculado al crear/completar, nunca en el cliente").
 * Nunca infravalora: `sensitive`/`high` mandan sobre "le faltan datos".
 */
export function resolveConfirmationLevel(item: PendingItem): ConfirmationCardLevel {
  if (item.risk_level === "sensitive") return "consentimiento";
  if (item.risk_level === "high") return "riesgo";
  if (!item.confirmable) return "tarjeta_editable";
  return "tarjeta";
}

export function buildProposalTitle(item: PendingItem): string {
  const level = resolveConfirmationLevel(item);
  if (level === "riesgo") return "Voy a eliminar";
  return item.normalized_summary.title?.trim() || "Voy a registrar";
}

function formatDateForInput(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-PE", { day: "2-digit", month: "short" }).format(date);
}

/**
 * Genérica a propósito: no reimplementa un editor por tipo de acción
 * (`create_movement`, `record_transfer`, …) — muestra los campos que
 * `normalized_summary` ya trae, editables en sitio como texto
 * (`RUL-ASI-06`). Un desplegable real de cuentas/categorías es pulido
 * pendiente, no un requisito de aceptación documentado.
 */
export function buildProposalFields(
  item: PendingItem,
  resolveCategoryLabel: (categoryId: string | null | undefined) => string | null
): ConfirmationCardField[] {
  const summary = item.normalized_summary;
  const fields: ConfirmationCardField[] = [];

  if (typeof summary.amount === "number") {
    fields.push({
      key: "amount",
      label: "Monto",
      value: summary.amount.toFixed(2),
      moneyValue: summary.amount,
    });
  }
  if (summary.subtitle) {
    fields.push({ key: "subtitle", label: "Dónde", value: summary.subtitle });
  }

  const categoryLabel = resolveCategoryLabel(summary.category_id);
  fields.push({
    key: "category",
    label: "Categoría",
    value: categoryLabel ?? "Sin categoría",
    uncertain: !summary.category_id,
  });

  if (summary.account_hint) {
    fields.push({ key: "account_hint", label: "Cuenta", value: summary.account_hint });
  }
  if (summary.occurred_at) {
    fields.push({
      key: "occurred_at",
      label: "Fecha",
      value: formatDateForInput(summary.occurred_at),
    });
  }

  return fields;
}

/** `18`/`RUL-ASI-22`: el aria-label del botón nombra la acción completa, nunca solo "Registrar". */
export function buildConfirmAriaLabel(item: PendingItem): string {
  const level = resolveConfirmationLevel(item);
  const summary = item.normalized_summary;
  const amountPart =
    typeof summary.amount === "number" ? ` de ${summary.amount.toFixed(2)} soles` : "";
  const categoryPart = summary.subtitle ? ` en ${summary.subtitle}` : "";

  if (level === "riesgo") {
    return `Eliminar${amountPart ? ` gasto${amountPart}` : " este gasto"}${categoryPart}`;
  }
  return `Registrar${amountPart}${categoryPart}`;
}
