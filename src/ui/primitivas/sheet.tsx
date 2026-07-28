"use client";

import { useContext, useEffect, useId, useRef, type HTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";
import { useFocusTrap } from "./internal/use-focus-trap";
import { assertHasDialogTitle } from "./internal/assert-dialog-title";
import { DialogContentContext } from "./internal/dialog-context";
import { DialogTitle } from "./dialog-parts";
import { DialogRootContext } from "./dialog";

export { Dialog as Sheet } from "./dialog";
export { DialogHeader as SheetHeader, DialogTitle as SheetTitle, DialogDescription as SheetDescription, DialogFooter as SheetFooter } from "./dialog-parts";

type SheetSide = "right" | "left" | "bottom";

type SheetContentProps = HTMLAttributes<HTMLDivElement> & {
  /** En escritorio, de qué lado entra el panel. En móvil siempre es una
   * hoja inferior (`16` §4.2), igual que `Dialog`. */
  side?: SheetSide;
  dismissible?: boolean;
};

const SIDE_CLASSES: Record<SheetSide, string> = {
  right: "sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:max-w-md sm:rounded-l-2xl sm:rounded-t-none",
  left: "sm:inset-y-0 sm:left-0 sm:right-auto sm:h-full sm:max-w-md sm:rounded-r-2xl sm:rounded-t-none",
  bottom: "sm:inset-x-0 sm:bottom-0 sm:top-auto sm:max-h-[80vh] sm:rounded-t-2xl sm:rounded-b-none sm:m-0",
};

/**
 * Mismo contrato de teclado que `Dialog` (foco atrapado, `Escape`, retorno
 * de foco) — `16` §4.2 solo cambia la posición. Reutiliza el mecanismo de
 * `DialogContent` en vez de duplicarlo.
 */
export function SheetContent({
  className,
  side = "right",
  dismissible = true,
  children,
  ...props
}: SheetContentProps) {
  const rootContext = useContext(DialogRootContext);
  if (!rootContext) {
    throw new Error("<SheetContent> debe usarse dentro de <Sheet>.");
  }
  const onOpenChange = rootContext.onOpenChange;
  assertHasDialogTitle(children, DialogTitle, "SheetContent");
  const containerRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  useFocusTrap(containerRef, true);

  useEffect(() => {
    if (!dismissible) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [dismissible, onOpenChange]);

  const content = (
    <div className="fixed inset-0 z-modal flex items-end justify-center sm:items-stretch">
      <div
        className="absolute inset-0 bg-bg-inverse/40"
        aria-hidden="true"
        onClick={dismissible ? () => onOpenChange(false) : undefined}
      />
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className={cn(
          "relative flex max-h-[90vh] w-full flex-col overflow-auto rounded-t-2xl border border-border bg-bg-surface-raised p-6 shadow-xl sm:max-w-md sm:m-0",
          SIDE_CLASSES[side],
          className
        )}
        {...props}
      >
        {dismissible ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="absolute right-3 top-3"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
            Cerrar
          </Button>
        ) : null}
        <DialogContentContext.Provider value={{ titleId, descriptionId }}>
          {children}
        </DialogContentContext.Provider>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
