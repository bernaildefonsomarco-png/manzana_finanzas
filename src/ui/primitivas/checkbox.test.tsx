import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Checkbox } from "./checkbox";

describe("Checkbox", () => {
  it("16 §4.2: indeterminate se refleja en la propiedad DOM, no solo en checked", () => {
    render(<Checkbox checked="indeterminate" onCheckedChange={() => undefined} />);
    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.indeterminate).toBe(true);
    expect(input.checked).toBe(false);
  });

  it("checked=true marca el input como checked, no indeterminate", () => {
    render(<Checkbox checked onCheckedChange={() => undefined} />);
    const input = screen.getByRole("checkbox") as HTMLInputElement;
    expect(input.checked).toBe(true);
    expect(input.indeterminate).toBe(false);
  });
});
