import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("AC-A11Y-05: un boton de solo icono conserva su nombre accesible", () => {
    render(<Button size="icon">Eliminar movimiento</Button>);
    expect(screen.getByRole("button", { name: "Eliminar movimiento" })).toBeInTheDocument();
  });

  it("el texto se oculta visualmente pero sigue en el DOM (sr-only, no display:none)", () => {
    render(<Button size="icon">Cerrar</Button>);
    const label = screen.getByText("Cerrar");
    expect(label).toHaveClass("sr-only");
  });
});
