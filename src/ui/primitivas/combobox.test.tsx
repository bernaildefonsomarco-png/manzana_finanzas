import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Combobox, type ComboboxOption } from "./combobox";

const OPTIONS: ComboboxOption[] = [
  { value: "alimentacion", label: "Alimentación" },
  { value: "transporte", label: "Transporte" },
  { value: "salud", label: "Salud" },
];

function Harness() {
  const [value, setValue] = useState<string | null>(null);
  return (
    <Combobox
      aria-label="Categoría"
      options={OPTIONS}
      value={value}
      onValueChange={setValue}
    />
  );
}

describe("Combobox", () => {
  it("16 §4.2: escribir filtra los resultados y anuncia cuantos hay", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Categoría" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "trans" } });

    expect(screen.getByRole("option", { name: "Transporte" })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: "Salud" })).not.toBeInTheDocument();
    expect(screen.getByText("1 resultados")).toBeInTheDocument();
  });

  it("ArrowDown + Enter selecciona el resultado resaltado", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Categoría" });
    fireEvent.focus(input);
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(input).toHaveValue("Transporte");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("sin resultados muestra el mensaje en vez de una lista vacia", () => {
    render(<Harness />);
    const input = screen.getByRole("combobox", { name: "Categoría" });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: "xyz" } });
    expect(screen.getByText("Sin resultados")).toBeInTheDocument();
  });
});
