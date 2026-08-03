import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AssistantDegradationBanner } from "./assistant-degradation-banner";

describe("AssistantDegradationBanner", () => {
  it("grado normal: no renderiza nada", () => {
    const { container } = render(<AssistantDegradationBanner grade="normal" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("grado indefinido (aun cargando): no renderiza nada", () => {
    const { container } = render(<AssistantDegradationBanner grade={undefined} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("lento no se anuncia aqui (lo dispara un turno concreto, no el chequeo estatico)", () => {
    const { container } = render(<AssistantDegradationBanner grade="lento" />);
    expect(container).toBeEmptyDOMElement();
  });

  it("RUL-ASI-13: sin_modelo se declara y ofrece la via manual concreta", () => {
    render(<AssistantDegradationBanner grade="sin_modelo" />);
    expect(screen.getByText("No puedo ayudarte con eso ahora mismo.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nuevo movimiento" })).toHaveAttribute(
      "href",
      "/movimientos/nuevo"
    );
  });

  it("solo_lectura se declara sin ofrecer una via manual (no hizo falta)", () => {
    render(<AssistantDegradationBanner grade="solo_lectura" />);
    expect(
      screen.getByText("Ahora mismo respondo y explico, pero no propongo acciones.")
    ).toBeInTheDocument();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
