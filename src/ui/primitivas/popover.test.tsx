import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Popover, PopoverContent } from "./popover";

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <button type="button">Abrir</button>
      <PopoverContent>Contenido</PopoverContent>
      <button type="button">Fuera</button>
    </Popover>
  );
}

describe("Popover", () => {
  it("16 §4.2: Escape cierra sin atrapar el foco", () => {
    render(<Harness />);
    expect(screen.getByText("Contenido")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByText("Contenido")).not.toBeInTheDocument();
  });

  it("un clic fuera del contenedor cierra el popover", () => {
    render(
      <>
        <Harness />
        <button type="button">Afuera de verdad</button>
      </>
    );
    fireEvent.mouseDown(screen.getByRole("button", { name: "Afuera de verdad" }));
    expect(screen.queryByText("Contenido")).not.toBeInTheDocument();
  });

  it("un clic dentro del contenedor no cierra el popover", () => {
    render(<Harness />);
    fireEvent.mouseDown(screen.getByRole("button", { name: "Fuera" }));
    expect(screen.getByText("Contenido")).toBeInTheDocument();
  });
});
