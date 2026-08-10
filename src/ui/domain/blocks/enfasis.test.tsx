import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { conEnfasis } from "./enfasis";

describe("conEnfasis", () => {
  it("el markdown del modelo se veia crudo en la web", () => {
    render(<p>{conEnfasis("Una **meta** es un objetivo financiero")}</p>);

    expect(screen.getByText("meta").tagName).toBe("STRONG");
    expect(screen.queryByText(/\*\*/)).not.toBeInTheDocument();
  });

  it("tambien el enfasis de un asterisco, que es el que usa el canal de mensajeria", () => {
    render(<p>{conEnfasis("Listo: creé la caja *Carro*.")}</p>);

    expect(screen.getByText("Carro").tagName).toBe("STRONG");
  });

  it("un texto sin asteriscos se devuelve tal cual", () => {
    expect(conEnfasis("Registré tu gasto.")).toBe("Registré tu gasto.");
  });

  it("un asterisco suelto no rompe ni se come el texto", () => {
    render(<p>{conEnfasis("2 * 3 son 6")}</p>);
    expect(screen.getByText("2 * 3 son 6")).toBeInTheDocument();
  });

  it("no interpreta nada que parezca una etiqueta", () => {
    const { container } = render(<p>{conEnfasis("usa <script>alert(1)</script>")}</p>);
    expect(container.querySelector("script")).toBeNull();
    expect(screen.getByText(/alert\(1\)/)).toBeInTheDocument();
  });
});
