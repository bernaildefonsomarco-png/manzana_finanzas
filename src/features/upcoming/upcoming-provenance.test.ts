import { describe, expect, it } from "vitest";
import type { UpcomingSummary, UpcomingViewItem } from "./upcoming-types";
import { buildUpcomingSummaryProvenance } from "./upcoming-provenance";

function item(overrides: Partial<UpcomingViewItem> = {}): UpcomingViewItem {
  return {
    key: "k1",
    id: "item-1",
    title: "Netflix",
    discreet_title: "Suscripción",
    amount: 45,
    currency: "PEN",
    due_at: "2026-07-15",
    due_label: "15 de julio",
    section: "later",
    status_label: "Próximo",
    status_tone: "neutral",
    alert: false,
    kind: "recurring",
    linked_box_id: null,
    linked_box_label: null,
    recurring_rule_id: "rule-1",
    occurrence_id: "occ-1",
    debt_id: null,
    installment_id: null,
    can_mark_paid: true,
    can_skip: true,
    can_pause: true,
    can_resume: false,
    rule: null,
    ...overrides,
  };
}

function summary(overrides: Partial<UpcomingSummary> = {}): UpcomingSummary {
  return {
    month_totals: { PEN: 45, USD: 0 },
    month_count: 1,
    linked_box_count: 0,
    pending_count: 0,
    month_items: [item()],
    ...overrides,
  };
}

describe("buildUpcomingSummaryProvenance — usa month_items, nunca recalcula el filtro de mes", () => {
  it("cada fila navega a su regla o a su deuda", () => {
    const data = buildUpcomingSummaryProvenance(summary(), false);
    expect(data.title).toBe("De dónde sale este S/45.00");
    expect(data.rows).toEqual([
      { id: "item-1", label: "Netflix", detail: "15 de julio", amount: 45, href: "/pagos-que-vienen/rule-1" },
    ]);
  });

  it("en modo discreto usa el título discreto de cada fila", () => {
    const data = buildUpcomingSummaryProvenance(summary(), true);
    expect(data.rows[0].label).toBe("Suscripción");
  });

  it("una cuota de deuda navega a la deuda, no a una regla", () => {
    const data = buildUpcomingSummaryProvenance(
      summary({ month_items: [item({ id: "d1", kind: "debt", debt_id: "debt-9", recurring_rule_id: null })] }),
      false,
    );
    expect(data.rows[0].href).toBe("/deudas/debt-9");
  });

  it("un compromiso en USD no cuenta en la cifra en soles, y se dice", () => {
    const data = buildUpcomingSummaryProvenance(
      summary({ month_totals: { PEN: 45, USD: 20 } }),
      false,
    );
    expect(data.notCounted).toEqual([
      { text: "$20.00 en dólares no se suman aquí: no convierto monedas." },
    ]);
  });
});
