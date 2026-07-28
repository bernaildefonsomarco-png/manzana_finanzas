import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Tooltip } from "./tooltip";

describe("Tooltip", () => {
  it("16 §4.2: aparece con foco de teclado, no solo con raton", () => {
    render(
      <Tooltip content="Elimina el movimiento">
        <button type="button">Eliminar</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "Eliminar" });
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();

    fireEvent.focus(trigger);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Elimina el movimiento");

    fireEvent.blur(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });

  it("tambien aparece con el raton", () => {
    render(
      <Tooltip content="Ayuda">
        <button type="button">?</button>
      </Tooltip>
    );
    const trigger = screen.getByRole("button", { name: "?" });
    fireEvent.mouseEnter(trigger);
    expect(screen.getByRole("tooltip")).toBeInTheDocument();
    fireEvent.mouseLeave(trigger);
    expect(screen.queryByRole("tooltip")).not.toBeInTheDocument();
  });
});
