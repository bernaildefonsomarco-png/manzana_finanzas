import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AssistantComposer } from "./assistant-composer";

describe("AssistantComposer", () => {
  it("ACT-ASI-02: enviar con el boton llama a onSend con el texto recortado y limpia el campo", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<AssistantComposer onSend={onSend} />);

    const textarea = screen.getByLabelText("Escribe un mensaje para Manzana");
    fireEvent.change(textarea, { target: { value: "  gasté 32 en rappi  " } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith("gasté 32 en rappi"));
    expect(textarea).toHaveValue("");
  });

  it("Enter sin Shift envia; Shift+Enter no envia (permite salto de linea)", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<AssistantComposer onSend={onSend} />);
    const textarea = screen.getByLabelText("Escribe un mensaje para Manzana");

    fireEvent.change(textarea, { target: { value: "hola" } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: true });
    expect(onSend).not.toHaveBeenCalled();

    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });
    await vi.waitFor(() => expect(onSend).toHaveBeenCalledWith("hola"));
  });

  it("texto vacio o solo espacios no envia nada (boton deshabilitado)", () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<AssistantComposer onSend={onSend} />);
    const textarea = screen.getByLabelText("Escribe un mensaje para Manzana");

    fireEvent.change(textarea, { target: { value: "   " } });
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
    expect(onSend).not.toHaveBeenCalled();
  });

  it("Enter sobre solo espacios no envia (el guardado interno, no solo el boton)", () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<AssistantComposer onSend={onSend} />);
    const textarea = screen.getByLabelText("Escribe un mensaje para Manzana");

    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter", shiftKey: false });

    expect(onSend).not.toHaveBeenCalled();
  });

  it("RUL-ASI-22: el foco vuelve al campo de entrada tras enviar", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<AssistantComposer onSend={onSend} />);
    const textarea = screen.getByLabelText("Escribe un mensaje para Manzana");

    fireEvent.change(textarea, { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await vi.waitFor(() => expect(textarea).toHaveFocus());
  });

  it("disabled desactiva el envio", () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<AssistantComposer onSend={onSend} disabled />);
    expect(screen.getByRole("button", { name: "Enviar" })).toBeDisabled();
  });

  it("si onSend rechaza, muestra un error visible y no pierde el texto escrito", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("network error"));
    render(<AssistantComposer onSend={onSend} />);
    const textarea = screen.getByLabelText("Escribe un mensaje para Manzana");

    fireEvent.change(textarea, { target: { value: "gaste 32 en rappi" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await vi.waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());
    expect(textarea).toHaveValue("gaste 32 en rappi");
  });

  it("si onSend rechaza y el usuario vuelve a escribir, el error se limpia", async () => {
    const onSend = vi.fn().mockRejectedValue(new Error("network error"));
    render(<AssistantComposer onSend={onSend} />);
    const textarea = screen.getByLabelText("Escribe un mensaje para Manzana");

    fireEvent.change(textarea, { target: { value: "gaste 32 en rappi" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await vi.waitFor(() => expect(screen.getByRole("alert")).toBeInTheDocument());

    fireEvent.change(textarea, { target: { value: "gaste 32 en rappi otra vez" } });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("un envio exitoso sigue limpiando el texto y devolviendo el foco (regresion)", async () => {
    const onSend = vi.fn().mockResolvedValue(undefined);
    render(<AssistantComposer onSend={onSend} />);
    const textarea = screen.getByLabelText("Escribe un mensaje para Manzana");

    fireEvent.change(textarea, { target: { value: "hola" } });
    fireEvent.click(screen.getByRole("button", { name: "Enviar" }));

    await vi.waitFor(() => expect(textarea).toHaveValue(""));
    await vi.waitFor(() => expect(textarea).toHaveFocus());
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
