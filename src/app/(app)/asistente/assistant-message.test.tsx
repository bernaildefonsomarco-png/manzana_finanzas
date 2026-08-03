import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistantMessage } from "./assistant-message";
import type { AssistantMessageWithBlocks } from "./assistant-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

function makeMessage(overrides: Partial<AssistantMessageWithBlocks>): AssistantMessageWithBlocks {
  return {
    id: "msg-1",
    user_id: "user-1",
    thread_id: "thread-1",
    role: "usuario",
    content: [],
    evidence_refs: [],
    proposed_action: null,
    action_status: null,
    resulting_movement_id: null,
    trace_id: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

describe("AssistantMessage", () => {
  it("RUL-ASI-21: un mensaje de usuario es un article encabezado por 'Tú'", () => {
    const message = makeMessage({
      role: "usuario",
      content: [{ kind: "texto", text: "gasté 32 en rappi" }],
    });
    render(<AssistantMessage message={message} threadId="thread-1" />);

    const article = screen.getByRole("article");
    expect(article).toHaveAccessibleName("Tú");
    expect(screen.getByText("gasté 32 en rappi")).toBeInTheDocument();
  });

  it("RUL-ASI-21: una respuesta es un article encabezado por 'Manzana'", () => {
    const message = makeMessage({
      role: "asistente",
      content: [{ kind: "texto", text: "Registré tu gasto." }],
    });
    render(<AssistantMessage message={message} threadId="thread-1" />);

    const article = screen.getByRole("article");
    expect(article).toHaveAccessibleName("Manzana");
    expect(screen.getByText("Registré tu gasto.")).toBeInTheDocument();
  });
});
