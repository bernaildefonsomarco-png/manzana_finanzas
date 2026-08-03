import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistantProvider } from "./assistant-context";
import { AssistantPanel } from "./assistant-panel";

const mocks = vi.hoisted(() => ({ pathname: "/inicio" }));

vi.mock("next/navigation", () => ({
  usePathname: () => mocks.pathname,
}));

vi.mock("./assistant-panel-content", () => ({
  AssistantPanelContent: ({ onClose }: { onClose?: () => void }) => (
    <div>
      <p>contenido de la conversacion</p>
      {onClose ? (
        <button type="button" onClick={onClose}>
          cerrar-contenido
        </button>
      ) : null}
    </div>
  ),
}));

describe("AssistantPanel", () => {
  it("RUL-ASI-01: cerrado, muestra solo la pastilla flotante para abrir", () => {
    mocks.pathname = "/inicio";
    render(
      <AssistantProvider>
        <AssistantPanel />
      </AssistantProvider>
    );

    expect(screen.getByRole("button", { name: "Abrir el asistente" })).toBeInTheDocument();
    expect(screen.queryByText("contenido de la conversacion")).not.toBeInTheDocument();
  });

  it("al abrir la pastilla, se ve la conversacion", () => {
    mocks.pathname = "/inicio";
    render(
      <AssistantProvider>
        <AssistantPanel />
      </AssistantProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir el asistente" }));
    expect(screen.getByText("contenido de la conversacion")).toBeInTheDocument();
  });

  it("Escape cierra el panel y devuelve al pastilla flotante", () => {
    mocks.pathname = "/inicio";
    render(
      <AssistantProvider>
        <AssistantPanel />
      </AssistantProvider>
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir el asistente" }));
    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.getByRole("button", { name: "Abrir el asistente" })).toBeInTheDocument();
  });

  it("en /asistente, no se duplica la superficie: el panel flotante no se renderiza", () => {
    mocks.pathname = "/asistente";
    render(
      <AssistantProvider>
        <AssistantPanel />
      </AssistantProvider>
    );

    expect(screen.queryByRole("button", { name: "Abrir el asistente" })).not.toBeInTheDocument();
    expect(screen.queryByText("contenido de la conversacion")).not.toBeInTheDocument();
  });
});
