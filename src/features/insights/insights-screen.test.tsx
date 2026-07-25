import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InsightCandidate } from "@/shared/types/domain";
import { InsightsScreen } from "./insights-screen";

const mocks = vi.hoisted(() => ({
  dismissInsight: vi.fn(),
  getInsightDetail: vi.fn(),
  getInsightEvidence: vi.fn(),
  listInsights: vi.fn(),
  markInsightSeen: vi.fn(),
  recordInsightAction: vi.fn(),
}));

vi.mock("./insights-api", () => mocks);

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  const current = insightFixture();
  const outdated = insightFixture({
    id: "22222222-2222-4222-8222-222222222222",
    status: "outdated",
    body: "La versión anterior ya no está vigente.",
    created_at: "2026-07-10T12:00:00.000Z",
  });
  mocks.listInsights.mockResolvedValue([current, outdated]);
  mocks.getInsightDetail.mockResolvedValue({ insight: current, deliveries: [] });
  mocks.getInsightEvidence.mockResolvedValue({
    insight_id: current.id,
    status: current.status,
    period: { start: current.period_start, end: current.period_end },
    evidence_text: current.evidence_text,
    evidence: {},
    source_facts: { current_amount: 75, previous_amount: 50, change_percent: 50 },
    source_entity_ids: ["33333333-3333-4333-8333-333333333333"],
    confidence: 0.93,
    action: current.action,
    methodology: null,
    related_movements: [
      {
        id: "33333333-3333-4333-8333-333333333333",
        type: "gasto",
        amount: 25,
        currency: "PEN",
        occurred_at: "2026-07-18T14:30:00.000Z",
        description: "Taxi al trabajo",
        merchant: null,
        category_id: "transporte",
      },
    ],
  });
  mocks.markInsightSeen.mockResolvedValue({ ...current, status: "displayed" });
  mocks.dismissInsight.mockResolvedValue({ ...current, status: "dismissed" });
  mocks.recordInsightAction.mockResolvedValue({ ...current, status: "acted" });
});

describe("insights screen", () => {
  it("prioriza el descubrimiento vigente y avisa cuando fue actualizado", async () => {
    render(<InsightsScreen />);

    expect(await screen.findByText("Tu transporte cambió esta semana")).toBeTruthy();
    expect(screen.getAllByText("Actualizado").length).toBeGreaterThan(0);
    expect(screen.queryByText("La versión anterior ya no está vigente.")).toBeNull();
  });

  it("abre evidencia trazable, registra visto y permite navegar sin escribir dinero", async () => {
    const onNavigate = vi.fn();
    render(<InsightsScreen onNavigate={onNavigate} />);

    fireEvent.click(await screen.findByRole("button", { name: "Entender por qué" }));

    expect(await screen.findByText("De dónde sale")).toBeTruthy();
    expect(screen.getByText("Taxi al trabajo")).toBeTruthy();
    expect(screen.getByText("S/ 75")).toBeTruthy();
    await waitFor(() => expect(mocks.markInsightSeen).toHaveBeenCalledOnce());

    fireEvent.click(screen.getByRole("button", { name: "Ver movimientos relacionados" }));
    await waitFor(() => expect(mocks.recordInsightAction).toHaveBeenCalledOnce());
    expect(onNavigate).toHaveBeenCalledWith("movements");
  });

  it("muestra un estado vacio honesto cuando no hay evidencia suficiente", async () => {
    mocks.listInsights.mockResolvedValue([]);
    render(<InsightsScreen />);

    expect(await screen.findByText("Todavía estamos conociendo tu ritmo")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ver movimientos" })).toBeTruthy();
  });
});

function insightFixture(overrides: Partial<InsightCandidate> = {}): InsightCandidate {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    user_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    type: "comparative",
    fingerprint: "transport-weekly-comparison",
    status: "narrated",
    period_start: "2026-07-13T00:00:00.000Z",
    period_end: "2026-07-19T23:59:59.000Z",
    confidence: 0.93,
    quality_score: 91,
    rank_score: 94,
    risk_level: "low",
    title: "Tu transporte cambió esta semana",
    body: "Gastaste S/25 más que en el periodo anterior.",
    evidence_text: "Comparamos movimientos confirmados de transporte de dos periodos equivalentes.",
    evidence: {},
    source_facts: { current_amount: 75, previous_amount: 50, change_percent: 50 },
    source_entity_ids: ["33333333-3333-4333-8333-333333333333"],
    action: { type: "view_movements", target_view: "movements" },
    expires_at: "2026-07-27T00:00:00.000Z",
    narrated_at: "2026-07-19T12:00:00.000Z",
    displayed_at: null,
    outdated_at: null,
    metadata: { action_label: "Ver movimientos relacionados" },
    created_at: "2026-07-19T12:00:00.000Z",
    updated_at: "2026-07-19T12:00:00.000Z",
    ...overrides,
  };
}
