import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PendingItem } from "@/shared/types/domain";
import { ApiClientError } from "@/shared/api/http-client";
import { AssistantProposalCard } from "./assistant-proposal-card";

const mocks = vi.hoisted(() => ({
  getAssistantProposal: vi.fn(),
  listAssistantCategories: vi.fn(),
  confirmAssistantProposal: vi.fn(),
  dismissAssistantProposal: vi.fn(),
  editAssistantProposal: vi.fn(),
}));

vi.mock("./assistant-api", () => mocks);

function makeItem(overrides: Partial<PendingItem> = {}): PendingItem {
  return {
    id: "pend-1",
    user_id: "user-1",
    type: "ambiguous_movement",
    status: "pending",
    source: "ambiguous_movement",
    source_ref: "dashboard:ext-1:accion-1",
    proposed_action: { action: "create_movement" },
    normalized_summary: {
      title: "Voy a registrar un gasto",
      subtitle: "Rappi",
      amount: 32,
      currency: "PEN",
      category_id: "alimentacion",
    },
    dedup_status: null,
    risk_level: "low",
    confirmable: true,
    confirm_command: null,
    expires_at: null,
    sent_for_confirmation_at: null,
    resolved_at: null,
    resolved_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    metadata: {},
    ...overrides,
  };
}

function renderCard(pendingItemId = "pend-1") {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <textarea aria-label="Escribe un mensaje para Manzana" />
      <AssistantProposalCard pendingItemId={pendingItemId} threadId="thread-1" />
    </QueryClientProvider>
  );
}

describe("AssistantProposalCard", () => {
  it("mientras carga el pending item, muestra un esqueleto", () => {
    mocks.getAssistantProposal.mockReturnValue(new Promise(() => undefined));
    mocks.listAssistantCategories.mockResolvedValue([]);
    const { container } = renderCard();
    expect(container.querySelector('[aria-busy="true"]')).not.toBeNull();
  });

  it("renderiza una ConfirmationCard cuando el pendiente esta activo", async () => {
    mocks.getAssistantProposal.mockResolvedValue(makeItem());
    mocks.listAssistantCategories.mockResolvedValue([{ id: "alimentacion", name: "Alimentación" }]);
    renderCard();

    await waitFor(() => expect(screen.getByText("Voy a registrar un gasto")).toBeInTheDocument());
    expect(screen.getByText("Alimentación")).toBeInTheDocument();
  });

  it("AC-ASI-08: confirmada, se ve resuelta en el mismo sitio, sin desaparecer", async () => {
    mocks.getAssistantProposal.mockResolvedValue(
      makeItem({ status: "user_confirmed", normalized_summary: { title: "Voy a registrar un gasto" } })
    );
    mocks.listAssistantCategories.mockResolvedValue([]);
    renderCard();

    await waitFor(() => expect(screen.getByText("registrar un gasto")).toBeInTheDocument());
  });

  it("una propuesta caducada se dice explicitamente (RUL-ASI-07)", async () => {
    mocks.getAssistantProposal.mockResolvedValue(makeItem({ status: "expired" }));
    mocks.listAssistantCategories.mockResolvedValue([]);
    renderCard();

    await waitFor(() =>
      expect(
        screen.getByText("La operación que te propuse quedó pendiente. ¿La retomamos?")
      ).toBeInTheDocument()
    );
  });

  it("RUL-ASI-22: al confirmar con exito, el foco vuelve al campo de entrada", async () => {
    mocks.getAssistantProposal.mockResolvedValue(makeItem());
    mocks.listAssistantCategories.mockResolvedValue([]);
    mocks.confirmAssistantProposal.mockResolvedValue({ proposal: makeItem(), idempotent: false });
    renderCard();

    await waitFor(() => expect(screen.getByText("Voy a registrar un gasto")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));

    await waitFor(() =>
      expect(screen.getByLabelText("Escribe un mensaje para Manzana")).toHaveFocus()
    );
  });

  it("ERR-ASI-05: si el Core rechaza, se dice la causa y la tarjeta sigue con lo editado", async () => {
    mocks.getAssistantProposal.mockResolvedValue(makeItem());
    mocks.listAssistantCategories.mockResolvedValue([]);
    mocks.confirmAssistantProposal.mockRejectedValue(
      new ApiClientError("CORE_REJECTED", "Me falta un dato para poder registrarlo.", 422, "trace-1")
    );
    renderCard();

    await waitFor(() => expect(screen.getByText("Voy a registrar un gasto")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Registrar/ }));

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("Me falta un dato para poder registrarlo.")
    );
    // La tarjeta sigue ahi, no se sustituye por un mensaje nuevo.
    expect(screen.getByText("Voy a registrar un gasto")).toBeInTheDocument();
  });
});
