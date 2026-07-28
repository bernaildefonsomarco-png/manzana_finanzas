"use client";

import { createContext, useContext, useId, useRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

const TabsContext = createContext<{ value: string; onValueChange: (value: string) => void; baseId: string } | null>(
  null
);

type TabsProps = {
  value: string;
  onValueChange: (value: string) => void;
  children: ReactNode;
  className?: string;
};

/** Secciones dentro de una pantalla (`16` §4.2): flechas navegan entre
 * pestañas, `Home`/`End` van a los extremos. Cambiar de pestaña con
 * flechas activa el panel de inmediato (patrón "automatic activation"),
 * no exige `Enter` aparte. */
export function Tabs({ value, onValueChange, children, className }: TabsProps) {
  const baseId = useId();
  return (
    <TabsContext.Provider value={{ value, onValueChange, baseId }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabList({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  const ref = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const container = ref.current;
    if (!container) return;
    const tabs = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]'));
    if (tabs.length === 0) return;
    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight" || event.key === "ArrowDown") nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;

    if (nextIndex !== null) {
      event.preventDefault();
      tabs[nextIndex].focus();
      tabs[nextIndex].click();
    }
  }

  return (
    <div
      ref={ref}
      role="tablist"
      className={cn("flex gap-1 border-b border-border", className)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export function Tab({ value, children }: { value: string; children: ReactNode }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("<Tab> debe usarse dentro de <Tabs>.");
  const selected = context.value === value;

  return (
    <button
      type="button"
      role="tab"
      id={`${context.baseId}-tab-${value}`}
      aria-selected={selected}
      aria-controls={`${context.baseId}-panel-${value}`}
      tabIndex={selected ? 0 : -1}
      onClick={() => context.onValueChange(value)}
      className={cn(
        "border-b-2 px-4 py-2 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
        selected ? "border-brand text-text" : "border-transparent text-text-secondary hover:text-text"
      )}
    >
      {children}
    </button>
  );
}

export function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const context = useContext(TabsContext);
  if (!context) throw new Error("<TabPanel> debe usarse dentro de <Tabs>.");
  if (context.value !== value) return null;

  return (
    <div
      role="tabpanel"
      id={`${context.baseId}-panel-${value}`}
      aria-labelledby={`${context.baseId}-tab-${value}`}
      tabIndex={0}
      className="pt-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus"
    >
      {children}
    </div>
  );
}
