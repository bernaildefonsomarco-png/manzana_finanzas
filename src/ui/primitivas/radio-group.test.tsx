import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { RadioGroup, RadioGroupItem } from "./radio-group";

function Harness() {
  const [value, setValue] = useState("dashboard");
  return (
    <RadioGroup value={value} onValueChange={setValue} name="canal">
      <RadioGroupItem value="dashboard">Dashboard</RadioGroupItem>
      <RadioGroupItem value="whatsapp">WhatsApp</RadioGroupItem>
    </RadioGroup>
  );
}

describe("RadioGroup", () => {
  it("16 §4.2: ArrowDown mueve la seleccion al siguiente item", () => {
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("aria-checked", "true");

    fireEvent.keyDown(radios[0], { key: "ArrowDown" });

    expect(radios[1]).toHaveAttribute("aria-checked", "true");
    expect(radios[0]).toHaveAttribute("aria-checked", "false");
  });

  it("solo la opcion seleccionada es alcanzable con Tab (tabIndex 0)", () => {
    render(<Harness />);
    const radios = screen.getAllByRole("radio");
    expect(radios[0]).toHaveAttribute("tabindex", "0");
    expect(radios[1]).toHaveAttribute("tabindex", "-1");
  });
});
