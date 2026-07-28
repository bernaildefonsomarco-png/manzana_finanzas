import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MoneyText } from "./money";

describe("MoneyText", () => {
  it("AC-A11Y-09: un valor null se muestra como '—', nunca como S/0.00", () => {
    render(<MoneyText value={null} />);
    expect(screen.getByLabelText("Sin dato")).toHaveTextContent("—");
  });

  it("un valor cero real se distingue de 'sin dato': muestra S/0.00", () => {
    render(<MoneyText value={0} />);
    expect(screen.getByText("S/0.00")).toBeInTheDocument();
  });

  it("compact=true quita los decimales cuando son .00", () => {
    render(<MoneyText value={1250} compact />);
    expect(screen.getByText("S/1,250")).toBeInTheDocument();
  });

  it("compact=true conserva los decimales cuando no son .00", () => {
    render(<MoneyText value={1250.5} compact />);
    expect(screen.getByText("S/1,250.50")).toBeInTheDocument();
  });
});
