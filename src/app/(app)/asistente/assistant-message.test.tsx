import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  describe("propuesta sin pending item correlacionado", () => {
    const proposal = makeMessage({
      role: "asistente",
      content: [
        {
          kind: "propuesta",
          text: "Creo que te refieres a Pan S/5. ¿Lo elimino?",
          commandId: "corr:delete:mov-1",
          options: [
            { id: "corr:delete:mov-1", label: "Sí, eliminar" },
            { id: "corr:cancel", label: "No cambiar" },
          ],
        },
      ],
    });

    it("dibuja las opciones del bloque en vez del esqueleto permanente", () => {
      render(<AssistantMessage message={proposal} threadId="thread-1" />);

      expect(screen.getByRole("button", { name: "Sí, eliminar" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "No cambiar" })).toBeInTheDocument();
    });

    it("al pulsar manda el command_id de la opcion, el mismo payload que el boton de WhatsApp", async () => {
      const onSendMessage = vi.fn(async () => undefined);
      render(
        <AssistantMessage
          message={proposal}
          threadId="thread-1"
          onSendMessage={onSendMessage}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

      await waitFor(() => expect(onSendMessage).toHaveBeenCalledWith("corr:delete:mov-1"));
    });

    it("con un turno en vuelo no acepta un segundo clic: un ok no confirma dos veces", async () => {
      const onSendMessage = vi.fn(async () => undefined);
      render(
        <AssistantMessage
          message={proposal}
          threadId="thread-1"
          onSendMessage={onSendMessage}
          isSending
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

      expect(onSendMessage).not.toHaveBeenCalled();
    });

    it("un fallo de envio no se propaga como promesa sin atender", async () => {
      const onSendMessage = vi.fn(async () => {
        throw new Error("red caida");
      });
      render(
        <AssistantMessage
          message={proposal}
          threadId="thread-1"
          onSendMessage={onSendMessage}
        />
      );

      fireEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));

      await waitFor(() => expect(onSendMessage).toHaveBeenCalledTimes(1));
      expect(screen.getByRole("button", { name: "Sí, eliminar" })).toBeInTheDocument();
    });
  });

  it("una propuesta con pending item correlacionado sigue usando su tarjeta", () => {
    const message = makeMessage({
      role: "asistente",
      proposed_action: { pending_item_ids: ["pending-1"] },
      content: [
        {
          kind: "propuesta",
          text: "¿Registro este gasto?",
          commandId: "cmd-1",
          options: [{ id: "cmd-1", label: "Sí" }],
        },
      ],
    });
    // La tarjeta resuelve el pendiente con `useQuery`, asi que necesita su
    // proveedor; las opciones del bloque no se dibujan porque ese camino
    // sigue siendo el de `AssistantProposalCard`.
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AssistantMessage message={message} threadId="thread-1" />
      </QueryClientProvider>
    );

    expect(screen.queryByRole("button", { name: "Sí" })).not.toBeInTheDocument();
  });
});
