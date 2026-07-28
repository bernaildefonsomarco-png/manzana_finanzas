import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "./sheet";

describe("Sheet", () => {
  it("16 §4.2: mismo contrato de teclado que Dialog (role, aria-modal, Escape)", () => {
    const onOpenChange = vi.fn();
    render(
      <Sheet open onOpenChange={onOpenChange}>
        <SheetContent side="right">
          <SheetHeader>
            <SheetTitle>Filtros</SheetTitle>
          </SheetHeader>
        </SheetContent>
      </Sheet>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("AC-DS-06: tambien exige titulo", () => {
    const originalError = console.error;
    console.error = () => undefined;
    expect(() =>
      render(
        <Sheet open onOpenChange={() => undefined}>
          <SheetContent>
            <p>sin titulo</p>
          </SheetContent>
        </Sheet>
      )
    ).toThrow(/Title/);
    console.error = originalError;
  });
});
