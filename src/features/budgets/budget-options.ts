import type { BudgetPeriodKind } from "@/core/budgets";
import type { CategoryId } from "@/shared/types/domain";

export const CATEGORY_OPTIONS: Array<{ id: CategoryId; label: string }> = [
  { id: "alimentacion", label: "Alimentación" },
  { id: "transporte", label: "Transporte" },
  { id: "vivienda_hogar", label: "Vivienda y hogar" },
  { id: "servicios_suscripciones", label: "Servicios y suscripciones" },
  { id: "salud", label: "Salud" },
  { id: "educacion", label: "Educación" },
  { id: "ocio_salidas", label: "Ocio y salidas" },
  { id: "compras_personales", label: "Compras personales" },
  { id: "familia_apoyo", label: "Familia y apoyo" },
  { id: "deudas", label: "Deudas" },
  { id: "trabajo_productividad", label: "Trabajo y productividad" },
  { id: "otros", label: "Otros" },
];

export function categoryLabel(categoryId: CategoryId) {
  return (
    CATEGORY_OPTIONS.find((category) => category.id === categoryId)?.label ??
    categoryId
  );
}

export function parsePeriodKind(value: string | null): BudgetPeriodKind {
  return value === "semanal" ||
    value === "quincenal" ||
    value === "mensual"
    ? value
    : "mensual";
}

export function periodTitle(periodKind: BudgetPeriodKind) {
  if (periodKind === "semanal") return "Semana actual";
  if (periodKind === "quincenal") return "Quincena actual";
  return "Mes actual";
}

export function periodLabel(periodKind: BudgetPeriodKind) {
  if (periodKind === "semanal") return "semanal";
  if (periodKind === "quincenal") return "quincenal";
  return "mensual";
}
