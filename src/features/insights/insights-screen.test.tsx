import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { InsightDetailScreen, InsightsScreen, actionDestination } from "./insights-screen";
import type { PublicInsight } from "./insights-types";

const mocks = vi.hoisted(() => ({
  getInsightDetail: vi.fn(),
  getInsightEvidence: vi.fn(),
  interactWithInsight: vi.fn(),
  listInsights: vi.fn(),
  setInsightTypeMuted: vi.fn(),
}));

vi.mock("./insights-api", () => mocks);

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  const current = insightFixture();
  mocks.listInsights.mockResolvedValue([current]);
  mocks.getInsightDetail.mockResolvedValue({ insight: current, deliveries: [] });
  mocks.getInsightEvidence.mockResolvedValue({
    insight_id: current.id,
    status: current.status,
    period: { start: current.period_start, end: current.period_end },
    evidence_text: current.evidence_text,
    evidence: { exclusions: ["transferencias", "pendientes"] },
    source_facts: { current_amount: 75, previous_amount: 50 },
    source_entity_ids: current.evidence_refs,
    action: current.action,
    methodology: null,
    related_movements: [{
      id: current.evidence_refs[0],
      type: "gasto",
      amount: 25,
      currency: "PEN",
      occurred_at: "2026-07-18T14:30:00.000Z",
      description: "Taxi al trabajo",
      merchant: null,
      category_id: "transporte",
    }],
  });
  mocks.interactWithInsight.mockResolvedValue(current);
  mocks.setInsightTypeMuted.mockResolvedValue(undefined);
});

describe("Descubrimientos", () => {
  it("SCR-DESC-01: muestra tarjetas como articulos y no taxonomias internas", async () => {
    render(<InsightsScreen />);
    expect(await screen.findByRole("heading", { name: "Tu transporte cambio esta semana" })).toBeTruthy();
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.queryByText(/confidence|score|algoritmo/i)).toBeNull();
  });

  it("AC-DESC-17: anuncia el cambio con texto y no solo con color", async () => {
    mocks.listInsights.mockResolvedValue([
      insightFixture({
        status: "outdated",
        changed_notice: "Este descubrimiento cambio porque corregiste un movimiento.",
      }),
    ]);
    render(<InsightsScreen />);
    expect(await screen.findByText("Este descubrimiento cambio porque corregiste un movimiento.")).toBeTruthy();
  });

  it("ACT-DESC-04/06: registra no util y permite silenciar el tipo", async () => {
    render(<InsightsScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "No me sirve" }));
    await waitFor(() => expect(mocks.interactWithInsight).toHaveBeenCalledWith(
      insightFixture().id,
      "feedback",
      { value: "no_util" },
    ));
    fireEvent.click(screen.getByRole("button", { name: "No mostrar este tipo" }));
    await waitFor(() => expect(mocks.setInsightTypeMuted).toHaveBeenCalledWith("comparative", true));
  });

  it("SCR-DESC-02: detalla que se conto y que se excluyo", async () => {
    render(<InsightDetailScreen id={insightFixture().id} />);
    expect(await screen.findByText("Taxi al trabajo")).toBeTruthy();
    expect(screen.getByText("transferencias, pendientes")).toBeTruthy();
    expect(screen.getByText("Que mire")).toBeTruthy();
    await waitFor(() => expect(mocks.interactWithInsight).toHaveBeenCalledWith(insightFixture().id, "seen"));
  });

  it("WEB-D238: una accion completa usa el prefill compartido de Movimientos", () => {
    expect(actionDestination({
      type: "view_movements",
      target_view: "movements",
      filters: { amount: 300, category_id: "alimentacion", date: "2026-08-02" },
    }, insightFixture())).toEqual({
      href: "/movimientos/nuevo?tipo=gasto&monto=300.00&categoria=alimentacion&fecha=2026-08-02&origen=descubrimiento",
      label: "Registrar gasto",
    });
  });
});

function insightFixture(overrides: Partial<PublicInsight> = {}): PublicInsight {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    type: "comparative",
    class: "B",
    status: "narrated",
    period_start: "2026-07-13",
    period_end: "2026-07-19",
    risk_level: "low",
    title: "Tu transporte cambio esta semana",
    body: "Gastaste S/25 mas que en el periodo anterior.",
    evidence_text: "S/75 frente a S/50.",
    evidence_refs: ["33333333-3333-4333-8333-333333333333"],
    action: { type: "view_movements", target_view: "movements" },
    feedback: null,
    expires_at: "2026-07-27T00:00:00.000Z",
    displayed_at: null,
    changed_notice: null,
    created_at: "2026-07-19T12:00:00.000Z",
    updated_at: "2026-07-19T12:00:00.000Z",
    ...overrides,
  };
}
