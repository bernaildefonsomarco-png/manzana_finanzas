import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { Dialog, DialogContent } from "./dialog";
import { DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "./dialog-parts";

function Trigger({ onOpen }: { onOpen: () => void }) {
  return (
    <button type="button" onClick={onOpen}>
      Abrir
    </button>
  );
}

describe("Dialog", () => {
  it("16 §5: role=dialog, aria-modal y aria-labelledby apuntando al titulo", () => {
    render(
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar movimiento</DialogTitle>
            <DialogDescription>Revisa los datos.</DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );

    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    const labelledBy = dialog.getAttribute("aria-labelledby");
    expect(document.getElementById(labelledBy!)).toHaveTextContent(
      "Confirmar movimiento"
    );
  });

  it("AC-DS-06: sin DialogTitle, falla en desarrollo en vez de renderizar sin nombre", () => {
    const originalError = console.error;
    console.error = () => undefined;
    expect(() =>
      render(
        <Dialog open onOpenChange={() => undefined}>
          <DialogContent>
            <DialogFooter>solo un pie, sin titulo</DialogFooter>
          </DialogContent>
        </Dialog>
      )
    ).toThrow(/DialogTitle/);
    console.error = originalError;
  });

  it("Escape cierra un Dialog dismissible", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar categoria</DialogTitle>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("el foco vuelve al disparador al cerrar", () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Trigger onOpen={() => setOpen(true)} />
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Detalle</DialogTitle>
              </DialogHeader>
            </DialogContent>
          </Dialog>
        </>
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Abrir" });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(document.activeElement).toBe(trigger);
  });

  it("16 §5: Tab desde el ultimo elemento enfocable vuelve al primero", () => {
    render(
      <Dialog open onOpenChange={() => undefined}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Elegir cuenta</DialogTitle>
          </DialogHeader>
          <button type="button">Ultimo</button>
        </DialogContent>
      </Dialog>
    );

    const closeButton = screen.getByRole("button", { name: "Cerrar" });
    const lastButton = screen.getByRole("button", { name: "Ultimo" });

    expect(document.activeElement).toBe(closeButton);
    lastButton.focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(closeButton);

    closeButton.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(lastButton);
  });
});
