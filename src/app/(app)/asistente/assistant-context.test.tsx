import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssistantProvider, useAssistantPanel } from "./assistant-context";

function Harness() {
  const { isOpen, open, close, toggle, returnFocusToTrigger } = useAssistantPanel();
  return (
    <div>
      <button type="button" onClick={open}>
        abrir
      </button>
      <button type="button" onClick={close}>
        cerrar
      </button>
      <button type="button" onClick={toggle}>
        alternar
      </button>
      <button type="button" onClick={returnFocusToTrigger}>
        devolver foco
      </button>
      <p>{isOpen ? "abierto" : "cerrado"}</p>
    </div>
  );
}

describe("AssistantProvider / useAssistantPanel", () => {
  it("empieza cerrado y open()/close() cambian el estado", () => {
    render(
      <AssistantProvider>
        <Harness />
      </AssistantProvider>
    );

    expect(screen.getByText("cerrado")).toBeInTheDocument();
    fireEvent.click(screen.getByText("abrir"));
    expect(screen.getByText("abierto")).toBeInTheDocument();
    fireEvent.click(screen.getByText("cerrar"));
    expect(screen.getByText("cerrado")).toBeInTheDocument();
  });

  it("toggle() alterna en ambas direcciones", () => {
    render(
      <AssistantProvider>
        <Harness />
      </AssistantProvider>
    );

    fireEvent.click(screen.getByText("alternar"));
    expect(screen.getByText("abierto")).toBeInTheDocument();
    fireEvent.click(screen.getByText("alternar"));
    expect(screen.getByText("cerrado")).toBeInTheDocument();
  });

  it("RUL-ASI-22: returnFocusToTrigger devuelve el foco a quien abrio el panel", () => {
    render(
      <AssistantProvider>
        <Harness />
      </AssistantProvider>
    );

    const openButton = screen.getByText("abrir");
    openButton.focus();
    expect(openButton).toHaveFocus();

    fireEvent.click(openButton);
    // Simula que el foco se movio dentro del panel mientras estaba abierto.
    screen.getByText("cerrar").focus();
    expect(screen.getByText("cerrar")).toHaveFocus();

    fireEvent.click(screen.getByText("devolver foco"));
    expect(openButton).toHaveFocus();
  });

  it("useAssistantPanel fuera de AssistantProvider lanza un error claro", () => {
    const originalError = console.error;
    console.error = () => undefined;
    expect(() => render(<Harness />)).toThrow(/AssistantProvider/);
    console.error = originalError;
  });
});
