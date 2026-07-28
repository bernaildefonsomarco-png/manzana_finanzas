import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Command, type CommandItem } from "./command";

function items(onRun: (id: string) => void): CommandItem[] {
  return [
    { id: "nuevo-movimiento", label: "Nuevo movimiento", onRun: () => onRun("nuevo-movimiento") },
    { id: "nueva-deuda", label: "Nueva deuda", onRun: () => onRun("nueva-deuda") },
    { id: "buscar", label: "Buscar", onRun: () => onRun("buscar") },
  ];
}

describe("Command", () => {
  it("16 §4.2 / 38: escribir filtra, flechas navegan y Enter ejecuta", () => {
    const onRun = vi.fn();
    const onOpenChange = vi.fn();
    render(
      <Command open onOpenChange={onOpenChange} items={items(onRun)} />
    );

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "deuda" } });
    expect(screen.getByRole("option", { name: "Nueva deuda" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Buscar" })).not.toBeInTheDocument();

    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRun).toHaveBeenCalledWith("nueva-deuda");
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("ArrowDown mueve el resaltado antes de ejecutar", () => {
    const onRun = vi.fn();
    render(<Command open onOpenChange={() => undefined} items={items(onRun)} />);
    const input = screen.getByRole("combobox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onRun).toHaveBeenCalledWith("nueva-deuda");
  });
});
