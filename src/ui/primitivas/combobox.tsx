"use client";

import { useId, useRef, useState } from "react";
import { cn } from "./cn";
import { useDismissableLayer } from "./internal/use-dismissable-layer";

export type ComboboxOption = { value: string; label: string };

type ComboboxProps = {
  options: ComboboxOption[];
  value: string | null;
  onValueChange: (value: string) => void;
  placeholder?: string;
  "aria-label": string;
  className?: string;
};

/**
 * Selección con búsqueda (`16` §4.2): se escribe para filtrar, las flechas
 * navegan los resultados, y una región activa anuncia cuántos hay — sin
 * eso, quien usa lector de pantalla no sabe si escribir sirvió de algo.
 */
export function Combobox({
  options,
  value,
  onValueChange,
  placeholder,
  className,
  ...props
}: ComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  useDismissableLayer(containerRef, open, () => setOpen(false));

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.trim().toLowerCase()))
    : options;
  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  function select(option: ComboboxOption) {
    onValueChange(option.value);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      if (open && filtered[highlight]) {
        event.preventDefault();
        select(filtered[highlight]);
      }
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        className="h-12 w-full rounded-lg border border-border bg-bg-surface-raised px-3 text-sm text-text shadow-xs transition placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-subtle"
        value={open ? query : selectedLabel}
        placeholder={placeholder}
        onChange={(event) => {
          setQuery(event.target.value);
          setHighlight(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        {...props}
      />
      {open ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute left-0 top-full z-popover mt-1 max-h-60 w-full overflow-auto rounded-lg border border-border bg-bg-surface-raised py-1 shadow-md"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">Sin resultados</li>
          ) : (
            filtered.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={cn(
                  "cursor-pointer px-3 py-2 text-sm",
                  index === highlight ? "bg-bg-surface text-text" : "text-text-secondary"
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => select(option)}
              >
                {option.label}
              </li>
            ))
          )}
        </ul>
      ) : null}
      <div aria-live="polite" className="sr-only">
        {open ? `${filtered.length} resultados` : ""}
      </div>
    </div>
  );
}
