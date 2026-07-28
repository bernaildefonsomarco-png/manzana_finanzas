"use client";

import { createContext, useContext, useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { useDismissableLayer } from "./internal/use-dismissable-layer";

const PopoverContext = createContext<{ open: boolean } | null>(null);

type PopoverProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

/**
 * Contenido contextual no modal (`16` §4.2): `Escape` y el clic fuera
 * cierran, pero a diferencia de `Dialog` no atrapa el foco. El disparador
 * es responsabilidad de quien lo usa (un botón normal con
 * `onClick={() => onOpenChange(!open)}`); `Popover` solo da el
 * posicionamiento relativo y el cierre.
 */
export function Popover({ open, onOpenChange, children, className }: PopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  useDismissableLayer(containerRef, open, () => onOpenChange(false));

  return (
    <PopoverContext.Provider value={{ open }}>
      <div ref={containerRef} className={cn("relative inline-block", className)}>
        {children}
      </div>
    </PopoverContext.Provider>
  );
}

type PopoverContentProps = HTMLAttributes<HTMLDivElement> & {
  align?: "start" | "center" | "end";
};

const ALIGN_CLASSES: Record<NonNullable<PopoverContentProps["align"]>, string> = {
  start: "left-0",
  center: "left-1/2 -translate-x-1/2",
  end: "right-0",
};

export function PopoverContent({
  align = "start",
  className,
  ...props
}: PopoverContentProps) {
  const context = useContext(PopoverContext);
  if (!context) {
    throw new Error("<PopoverContent> debe usarse dentro de <Popover>.");
  }
  if (!context.open) return null;

  return (
    <div
      className={cn(
        "absolute top-full z-popover mt-2 min-w-40 rounded-lg border border-border bg-bg-surface-raised p-3 shadow-md",
        ALIGN_CLASSES[align],
        className
      )}
      {...props}
    />
  );
}
