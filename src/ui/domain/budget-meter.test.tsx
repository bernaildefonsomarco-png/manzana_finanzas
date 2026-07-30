import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { BudgetMeter } from "./budget-meter";

describe("BudgetMeter", () => {
  it("AC-PRES-16: comunica tramo y porcentaje además del color", () => {
    render(
      <BudgetMeter
        label="Alimentación"
        spent={318.5}
        amount={400}
        percentage={80}
        band="atencion"
      />
    );
    expect(screen.getByText("Atención")).toBeInTheDocument();
    expect(screen.getByText("80%")).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAccessibleName(
      /318.5 de 400 soles, 80 por ciento, Atención/
    );
  });
});
