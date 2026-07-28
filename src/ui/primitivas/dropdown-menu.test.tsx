import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem } from "./dropdown-menu";

function Harness({ onSelectEditar }: { onSelectEditar: () => void }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Acciones
      </button>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuContent>
          <DropdownMenuItem onSelect={onSelectEditar}>Editar</DropdownMenuItem>
          <DropdownMenuItem>Duplicar</DropdownMenuItem>
          <DropdownMenuItem>Eliminar</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

describe("DropdownMenu", () => {
  it("16 §4.2: al abrir enfoca el primer item, y las flechas navegan", () => {
    render(<Harness onSelectEditar={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Acciones" }));

    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Editar" }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Duplicar" }));
    fireEvent.keyDown(document.activeElement!, { key: "End" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Eliminar" }));
    fireEvent.keyDown(document.activeElement!, { key: "ArrowDown" });
    expect(document.activeElement).toBe(screen.getByRole("menuitem", { name: "Editar" }));
  });

  it("Escape cierra y devuelve el foco al disparador", () => {
    render(<Harness onSelectEditar={() => undefined} />);
    const trigger = screen.getByRole("button", { name: "Acciones" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("menu")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(document.activeElement).toBe(trigger);
  });

  it("seleccionar un item lo activa y cierra el menu", () => {
    const onSelectEditar = vi.fn();
    render(<Harness onSelectEditar={onSelectEditar} />);
    fireEvent.click(screen.getByRole("button", { name: "Acciones" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Editar" }));
    expect(onSelectEditar).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
