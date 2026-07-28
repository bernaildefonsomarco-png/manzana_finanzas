"use client";

import { createContext, useContext, useEffect, useId, useRef, type HTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";
import { useFocusTrap } from "./internal/use-focus-trap";
import { assertHasDialogTitle } from "./internal/assert-dialog-title";
import { DialogContentContext } from "./internal/dialog-context";
import { DialogTitle } from "./dialog-parts";

export const DialogRootContext = createContext<{
  onOpenChange: (open: boolean) => void;
} | null>(null);

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
};

/** Contenedor lógico: no renderiza nada por sí mismo mientras `open` es
 * falso — el contrato completo (foco, `Escape`, `aria-modal`) vive en
 * `DialogContent` (`16` §5). */
export function Dialog({ open, onOpenChange, children }: DialogProps) {
  if (!open) return null;
  return (
    <DialogRootContext.Provider value={{ onOpenChange }}>
      {children}
    </DialogRootContext.Provider>
  );
}

type DialogContentProps = HTMLAttributes<HTMLDivElement> & {
  size?: "sm" | "md" | "lg";
  /** `Escape` y el clic fuera cierran; el botón de cerrar aparece. Falso
   * en `AlertDialog` (`16` §5): la decisión debe ser explícita. */
  dismissible?: boolean;
};

const SIZE_CLASSES: Record<NonNullable<DialogContentProps["size"]>, string> = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-md",
  lg: "sm:max-w-lg",
};

export function DialogContent({
  className,
  size = "md",
  dismissible = true,
  children,
  ...props
}: DialogContentProps) {
  const rootContext = useContext(DialogRootContext);
  if (!rootContext) {
    throw new Error("<DialogContent> debe usarse dentro de <Dialog>.");
  }
  const onOpenChange = rootContext.onOpenChange;
  assertHasDialogTitle(children, DialogTitle, "DialogContent");
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
    <div className="fixed inset-0 z-modal flex items-end justify-center sm:items-center">
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
          "relative flex max-h-[90vh] w-full flex-col overflow-auto rounded-t-2xl border border-border bg-bg-surface-raised p-6 shadow-xl sm:rounded-2xl sm:m-4",
          SIZE_CLASSES[size],
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
