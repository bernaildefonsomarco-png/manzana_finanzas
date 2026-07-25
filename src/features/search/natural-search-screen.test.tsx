import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NaturalSearchScreen } from "./natural-search-screen";

const mocks = vi.hoisted(() => ({
  runNaturalSearch: vi.fn(),
}));

vi.mock("./natural-search-api", () => ({
  runNaturalSearch: mocks.runNaturalSearch,
}));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.runNaturalSearch.mockResolvedValue({
    query: "gastos de cafeteria",
    scope: "all",
    mode: "answer",
    answer: {
      response_text: "Encontre 1 movimiento: Cafeteria Central.",
      answer_kind: "movement_summary",
      confidence: 0.88,
      cited_facts: [],
      used_tools: ["query_movements"],
      follow_up_question: null,
      safety_flags: ["read_only"],
    },
    query_interpretation: {
      kind: "movement_search",
      date_range: null,
      confidence: 0.75,
    },
    sources: [
      {
        type: "movement",
        id: "movement-1",
        label: "Cafeteria Central",
        amount: 15,
        currency: "PEN",
        occurred_at: "2026-07-15T08:30:00.000Z",
        status: "confirmed",
        source_detail: "whatsapp",
      },
    ],
    tool_results: [
      {
        tool_name: "query_movements",
        status: "called",
        facts: ["movement_count=1"],
        warnings: [],
      },
    ],
    data_limits: ["Solo lectura desde busqueda natural."],
  });
});

describe("natural search screen", () => {
  it("mantiene la busqueda global como entrada y autoejecuta una consulta recibida por URL", async () => {
    render(<NaturalSearchScreen initialQuery="gastos de cafeteria" />);

    expect(
      screen.getAllByLabelText("Pregunta algo sobre tu dinero")[0]
    ).toHaveValue("gastos de cafeteria");

    await waitFor(() => {
      expect(mocks.runNaturalSearch).toHaveBeenCalledWith({
        query: "gastos de cafeteria",
        scope: "all",
      });
    });

    expect(await screen.findByText("Movimientos encontrados")).toBeTruthy();
    expect(screen.getByText("Cafeteria Central")).toBeTruthy();
  });

  it("ofrece abrir Movimientos filtrados cuando la respuesta contiene movimientos", async () => {
    const onOpenMovementsFilter = vi.fn();

    render(
      <NaturalSearchScreen
        initialQuery="gastos de cafeteria"
        onOpenMovementsFilter={onOpenMovementsFilter}
      />
    );

    const button = await screen.findByRole(
      "button",
      { name: "Ver movimientos filtrados" },
      { timeout: 5_000 },
    );
    fireEvent.click(button);

    expect(onOpenMovementsFilter).toHaveBeenCalledWith("gastos de cafeteria");
  });
});
