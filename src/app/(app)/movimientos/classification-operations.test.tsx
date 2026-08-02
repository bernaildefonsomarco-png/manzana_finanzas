// @vitest-environment jsdom

import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BulkClassificationPanel } from "./bulk-classification-panel";
import { ClassificationWhyPanel } from "./classification-why-panel";

const mocks = vi.hoisted(() => ({
  classifyBulk: vi.fn(),
  undoClassificationBatch: vi.fn(),
  getClassificationWhy: vi.fn(),
  forgetClassificationMemory: vi.fn(),
}));
vi.mock("@/shared/api/classification-operations", () => mocks);

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.classifyBulk
    .mockResolvedValueOnce({ preview: { preview: true, count: 3, sample: null, movements: [{ id: "m1", merchant: "Rappi" }], excluded_count: 1, idempotent: false } })
    .mockResolvedValueOnce({ batch: { id: "batch-1", movement_count: 3, undo_until: "2026-08-31T00:00:00Z" } });
  mocks.getClassificationWhy.mockResolvedValue({
    movement: { id: "movement-1", category_id: "alimentacion", subcategory_id: null },
    explanation: "Lo puse en Alimentación porque así clasificaste tus movimientos de Rappi.",
    evidence: [{ polarity: "positive", text: "Elegiste esta clasificación 8 veces.", observed_at: "2026-08-01T00:00:00Z" }],
    forget_targets: [{ memory_id: "memory-1", summary: "Rappi va en Alimentación" }],
  });
  mocks.forgetClassificationMemory.mockResolvedValue(undefined);
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("SCR-CAT-04/05", () => {
  it("previsualiza conteo, muestra, exclusiones y confirma el lote", async () => {
    render(<BulkClassificationPanel movementIds={["m1", "m2", "m3", "m4"]} onDone={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("Destino"), { target: { value: "alimentacion" } });
    fireEvent.click(screen.getByRole("button", { name: "Previsualizar" }));
    expect(await screen.findByText(/Cambiarán 3 movimientos; 1 quedan fuera/)).toBeTruthy();
    expect(screen.getByText("Rappi")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar reclasificación masiva" }));
    await waitFor(() => expect(mocks.classifyBulk).toHaveBeenLastCalledWith(expect.objectContaining({ preview: false })));
  });

  it("explica por qué y olvida el aprendizaje desde el mismo panel", async () => {
    render(<ClassificationWhyPanel movementId="movement-1" />);
    fireEvent.click(screen.getByRole("button", { name: "Por qué se clasificó así" }));
    expect(await screen.findByText(/así clasificaste tus movimientos de Rappi/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Olvidar esto que aprendiste" }));
    await waitFor(() => expect(mocks.forgetClassificationMemory).toHaveBeenCalledWith("memory-1"));
  });
});
