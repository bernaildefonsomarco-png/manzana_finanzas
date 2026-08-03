import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AssistantMessageList } from "./assistant-message-list";
import type { AssistantMessageWithBlocks } from "./assistant-types";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const userMessage: AssistantMessageWithBlocks = {
  id: "msg-1",
  user_id: "user-1",
  thread_id: "thread-1",
  role: "usuario",
  content: [{ kind: "texto", text: "gasté 32 en rappi" }],
  evidence_refs: [],
  proposed_action: null,
  action_status: null,
  resulting_movement_id: null,
  trace_id: null,
  created_at: new Date().toISOString(),
};

describe("AssistantMessageList", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("RUL-ASI-12: mientras responde, muestra el estado en su idioma sin jerga", () => {
    render(
      <AssistantMessageList
        messages={[userMessage]}
        threadId="thread-1"
        isLoading={false}
        isSending
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Manzana está respondiendo…");
  });

  it("23 S5: pasados 8s en curso, avisa que tarda y ofrece la via manual sin cancelar", () => {
    render(
      <AssistantMessageList
        messages={[userMessage]}
        threadId="thread-1"
        isLoading={false}
        isSending
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Manzana está respondiendo…");

    act(() => {
      vi.advanceTimersByTime(8_000);
    });

    expect(screen.getByRole("status")).toHaveTextContent("Estoy tardando más de lo normal.");
    expect(screen.getByRole("link", { name: "Hacerlo directamente" })).toHaveAttribute(
      "href",
      "/movimientos/nuevo"
    );
  });

  it("antes de los 8s no avisa que tarda", () => {
    render(
      <AssistantMessageList
        messages={[userMessage]}
        threadId="thread-1"
        isLoading={false}
        isSending
      />
    );

    act(() => {
      vi.advanceTimersByTime(7_999);
    });

    expect(screen.getByRole("status")).toHaveTextContent("Manzana está respondiendo…");
  });

  it("un turno nuevo no hereda el aviso de 'tardando' del turno anterior", () => {
    const { rerender } = render(
      <AssistantMessageList
        messages={[userMessage]}
        threadId="thread-1"
        isLoading={false}
        isSending
      />
    );

    act(() => {
      vi.advanceTimersByTime(8_000);
    });
    expect(screen.getByRole("status")).toHaveTextContent("Estoy tardando más de lo normal.");

    rerender(
      <AssistantMessageList
        messages={[userMessage]}
        threadId="thread-1"
        isLoading={false}
        isSending={false}
      />
    );
    rerender(
      <AssistantMessageList
        messages={[userMessage]}
        threadId="thread-1"
        isLoading={false}
        isSending
      />
    );

    expect(screen.getByRole("status")).toHaveTextContent("Manzana está respondiendo…");
  });

  it("al terminar de responder, el estado desaparece", () => {
    const { rerender } = render(
      <AssistantMessageList
        messages={[userMessage]}
        threadId="thread-1"
        isLoading={false}
        isSending
      />
    );

    rerender(
      <AssistantMessageList
        messages={[userMessage]}
        threadId="thread-1"
        isLoading={false}
        isSending={false}
      />
    );

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
