import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { DatePicker } from "./date-picker";

function Harness() {
  const [value, setValue] = useState<string | null>("2026-07-14");
  return <DatePicker aria-label="Fecha" value={value} onValueChange={setValue} />;
}

describe("DatePicker", () => {
  it("16 §4.2: la entrada por texto siempre esta disponible, no solo el calendario", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("AAAA-MM-DD");
    fireEvent.change(input, { target: { value: "2026-08-01" } });
    expect(input).toHaveValue("2026-08-01");
  });

  it("un texto que no es una fecha valida no se acepta", () => {
    render(<Harness />);
    const input = screen.getByPlaceholderText("AAAA-MM-DD");
    fireEvent.change(input, { target: { value: "no es fecha" } });
    expect(input).toHaveValue("2026-07-14");
  });

  it("elegir un dia del calendario actualiza el valor y cierra el popover", () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole("button", { name: /Abrir calendario/ }));
    fireEvent.click(screen.getByRole("button", { name: "20" }));
    expect(screen.getByPlaceholderText("AAAA-MM-DD")).toHaveValue("2026-07-20");
  });
});
