"use client";

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "./cn";
import { useDismissableLayer } from "./internal/use-dismissable-layer";

const DropdownMenuContext = createContext<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
} | null>(null);

type DropdownMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
  className?: string;
};

/** Menú de acciones por fila (`16` §4.2): flechas navegan, `Home`/`End` van
 * a los extremos, se escribe para buscar, `Escape` cierra y devuelve el
 * foco al disparador. */
export function DropdownMenu({ open, onOpenChange, children, className }: DropdownMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<Element | null>(null);

  // `useLayoutEffect`, no `useEffect`: todos los layout effects del árbol
  // corren antes que cualquier passive effect, así que esto captura el
  // disparador antes de que `DropdownMenuContent` mueva el foco al primer
  // ítem en su propio `useEffect` — si fuera `useEffect` aquí también, el
  // orden entre padre e hijo no está garantizado y podría capturar el
  // ítem recién enfocado en vez del disparador real.
  useLayoutEffect(() => {
    if (open) triggerRef.current = document.activeElement;
    else (triggerRef.current as HTMLElement | null)?.focus?.();
  }, [open]);

  useDismissableLayer(containerRef, open, () => onOpenChange(false));

  return (
    <DropdownMenuContext.Provider value={{ open, onOpenChange }}>
      <div ref={containerRef} className={cn("relative inline-block", className)}>
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

function menuItems(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[role="menuitem"]'));
}

export function DropdownMenuContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const context = useContext(DropdownMenuContext);
  if (!context) {
    throw new Error("<DropdownMenuContent> debe usarse dentro de <DropdownMenu>.");
  }
  const ref = useRef<HTMLDivElement>(null);
  const typeahead = useRef("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    if (!context.open || !ref.current) return;
    menuItems(ref.current)[0]?.focus();
  }, [context.open]);

  if (!context.open) return null;

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const container = ref.current;
    if (!container) return;
    const items = menuItems(container);
    if (items.length === 0) return;
    const currentIndex = items.indexOf(document.activeElement as HTMLElement);

    if (event.key === "ArrowDown") {
      event.preventDefault();
      items[(currentIndex + 1) % items.length].focus();
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      items[(currentIndex - 1 + items.length) % items.length].focus();
    } else if (event.key === "Home") {
      event.preventDefault();
      items[0].focus();
    } else if (event.key === "End") {
      event.preventDefault();
      items[items.length - 1].focus();
    } else if (event.key.length === 1 && /[a-z0-9]/i.test(event.key)) {
      typeahead.current += event.key.toLowerCase();
      clearTimeout(typeaheadTimer.current);
      typeaheadTimer.current = setTimeout(() => {
        typeahead.current = "";
      }, 500);
      const match = items.find((item) =>
        item.textContent?.trim().toLowerCase().startsWith(typeahead.current)
      );
      match?.focus();
    }
  }

  return (
    <div
      ref={ref}
      role="menu"
      className={cn(
        "absolute left-0 top-full z-popover mt-2 min-w-40 overflow-hidden rounded-lg border border-border bg-bg-surface-raised py-1 shadow-md",
        className
      )}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

type DropdownMenuItemProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  onSelect?: () => void;
};

export function DropdownMenuItem({ className, onSelect, onClick, ...props }: DropdownMenuItemProps) {
  const context = useContext(DropdownMenuContext);
  return (
    <button
      type="button"
      role="menuitem"
      tabIndex={-1}
      className={cn(
        "flex w-full items-center px-3 py-2 text-left text-sm text-text hover:bg-bg-surface focus-visible:bg-bg-surface focus-visible:outline-none",
        className
      )}
      onClick={(event) => {
        onClick?.(event);
        onSelect?.();
        context?.onOpenChange(false);
      }}
      {...props}
    />
  );
}
