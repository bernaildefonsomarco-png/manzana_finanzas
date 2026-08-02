import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryDetailScreen, MemoryScreen } from "./memory-screen";
import type { MemoryItem } from "./memory-types";

const mocks = vi.hoisted(() => ({
  correctMemory: vi.fn(),
  forgetAllMemory: vi.fn(),
  forgetMemory: vi.fn(),
  getMemoryDetail: vi.fn(),
  listMemory: vi.fn(),
  listProfileCandidates: vi.fn(),
  markMemoryViewed: vi.fn(),
  reactivateMemory: vi.fn(),
  resolveCandidate: vi.fn(),
  undoMemory: vi.fn(),
}));
vi.mock("./memory-api", () => mocks);

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  const item = memoryFixture();
  mocks.listMemory.mockResolvedValue({
    profile: [item], classification: [{ ...item, id: "22222222-2222-4222-8222-222222222222", scope: "classification", statement: "Rappi va en Alimentación" }],
    preference: [{ ...item, id: "33333333-3333-4333-8333-333333333333", scope: "preference", statement: "Prefieres la vista mensual" }],
    inactive: [],
  });
  mocks.listProfileCandidates.mockResolvedValue([{ id: "44444444-4444-4444-8444-444444444444", subject_key: "income_day:15", statement: "Cobras el 15", status: "pending_confirmation", ask_count: 1, evidence_refs: ["movement:1"], created_at: item.created_at }]);
  mocks.resolveCandidate.mockResolvedValue(undefined);
  mocks.getMemoryDetail.mockResolvedValue({
    memory: item,
    events: [{ id: "event-1", scope: "profile", subject_id: item.id, action: "confirmado", actor: "usuario", previous_status: null, next_status: "vigente", created_at: item.updated_at }],
  });
  mocks.markMemoryViewed.mockResolvedValue(undefined);
  mocks.undoMemory.mockResolvedValue(undefined);
});

describe("Memoria", () => {
  it("AC-MEM-01/19 agrupa las tres clases y nunca muestra confianza o peso", async () => {
    render(<MemoryScreen />);
    expect(await screen.findByText("Trabajas de forma independiente")).toBeTruthy();
    expect(screen.getByText("Rappi va en Alimentación")).toBeTruthy();
    expect(screen.getByText("Prefieres la vista mensual")).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/confidence|peso|% seguro/i);
  });

  it("AC-MEM-03 presenta máximo un candidato y exige confirmación explícita", async () => {
    render(<MemoryScreen />);
    fireEvent.click(await screen.findByRole("button", { name: "Sí, es así" }));
    await waitFor(() => expect(mocks.resolveCandidate).toHaveBeenCalledWith(
      expect.objectContaining({ statement: "Cobras el 15" }), "confirm",
    ));
  });

  it("RUL-MEM-06 muestra inactivos y no ofrece reactivar lo olvidado", async () => {
    const forgotten = { ...memoryFixture(), active: false, status: "olvidado", can_reactivate: false };
    mocks.listMemory.mockResolvedValue({ profile: [forgotten], classification: [], preference: [], inactive: [forgotten] });
    render(<MemoryScreen includeInactive />);
    expect(await screen.findByText(/no se reactiva aquí/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reactivar" })).toBeNull();
  });

  it("AC-MEM-14 detalla evidencia e historial auditable", async () => {
    render(<MemoryDetailScreen id={memoryFixture().id} />);
    expect(await screen.findByText("confirmado")).toBeTruthy();
    expect(screen.getByText("1 referencias")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Historial" })).toBeTruthy();
    expect(mocks.markMemoryViewed).toHaveBeenCalledWith(expect.objectContaining({ scope: "profile" }));
  });
});

function memoryFixture(): MemoryItem {
  return {
    id: "11111111-1111-4111-8111-111111111111",
    scope: "profile",
    subject_key: "work:independent",
    statement: "Trabajas de forma independiente",
    status: "vigente",
    active: true,
    positive_evidence_refs: ["conversation:1"],
    negative_evidence_refs: [],
    positive_evidence_count: 1,
    negative_evidence_count: 0,
    created_at: "2026-07-01T12:00:00Z",
    updated_at: "2026-08-01T12:00:00Z",
    last_used_at: null,
    can_reactivate: false,
  };
}
