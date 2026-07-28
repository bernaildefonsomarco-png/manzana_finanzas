"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import { cn } from "./cn";

const RadioGroupContext = createContext<{
  value: string;
  onValueChange: (value: string) => void;
  name: string;
} | null>(null);

type RadioGroupProps = {
  value: string;
  onValueChange: (value: string) => void;
  name: string;
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
};

/** Foco itinerante estándar: `Tab` entra una vez al grupo, las flechas
 * mueven la selección entre opciones (`16` §4.2). */
export function RadioGroup({ value, onValueChange, name, children, className, ...props }: RadioGroupProps) {
  const ref = useRef<HTMLDivElement>(null);

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(event.key)) return;
    const container = ref.current;
    if (!container) return;
    const radios = Array.from(container.querySelectorAll<HTMLInputElement>('[role="radio"]'));
    if (radios.length === 0) return;
    const currentIndex = radios.findIndex((radio) => radio.dataset.value === value);
    const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
    event.preventDefault();
    const next = radios[(currentIndex + delta + radios.length) % radios.length];
    next.focus();
    onValueChange(next.dataset.value!);
  }

  return (
    <RadioGroupContext.Provider value={{ value, onValueChange, name }}>
      <div
        ref={ref}
        role="radiogroup"
        className={cn("flex flex-col gap-2", className)}
        onKeyDown={handleKeyDown}
        {...props}
      >
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

type RadioItemProps = {
  value: string;
  children: ReactNode;
  className?: string;
};

export function RadioGroupItem({ value, children, className }: RadioItemProps) {
  const context = useContext(RadioGroupContext);
  if (!context) {
    throw new Error("<RadioGroupItem> debe usarse dentro de <RadioGroup>.");
  }
  const selected = context.value === value;

  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm text-text", className)}>
      <span
        role="radio"
        aria-checked={selected}
        data-value={value}
        tabIndex={selected ? 0 : -1}
        onClick={() => context.onValueChange(value)}
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            context.onValueChange(value);
          }
        }}
        className={cn(
          "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
          selected ? "border-brand" : "border-border-strong"
        )}
      >
        {selected ? <span className="h-2.5 w-2.5 rounded-full bg-brand" /> : null}
      </span>
      {children}
    </label>
  );
}
