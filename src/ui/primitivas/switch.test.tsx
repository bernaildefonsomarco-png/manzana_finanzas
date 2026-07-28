import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Switch } from "./switch";

describe("Switch", () => {
  it("16 §4.1: loading deshabilita el control y conserva aria-checked", () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked onCheckedChange={onCheckedChange} loading />);

    const control = screen.getByRole("switch");
    expect(control).toBeDisabled();
    expect(control).toHaveAttribute("aria-checked", "true");
    expect(control).toHaveAttribute("aria-busy", "true");
  });

  it("sin loading, el control responde al click normalmente", () => {
    const onCheckedChange = vi.fn();
    render(<Switch checked={false} onCheckedChange={onCheckedChange} />);

    const control = screen.getByRole("switch");
    expect(control).not.toBeDisabled();
    control.click();
    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });
});
