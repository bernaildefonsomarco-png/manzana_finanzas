"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent } from "./dialog";
import { DialogTitle } from "./dialog-parts";
import { cn } from "./cn";

export type CommandItem = { id: string; label: string; onRun: () => void };

type CommandProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: CommandItem[];
  placeholder?: string;
};

/**
 * Paleta de comandos (`16` §4.2, `38`): flechas navegan, `Enter` ejecuta.
 * El atajo global que la abre (`38`) no es responsabilidad de esta
 * primitiva — solo el diálogo, la búsqueda y la ejecución.
 */
export function Command({ open, onOpenChange, items, placeholder = "Escribe un comando…" }: CommandProps) {
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? items.filter((item) => item.label.toLowerCase().includes(needle)) : items;
  }, [items, query]);

  function run(item: CommandItem) {
    item.onRun();
    setQuery("");
    onOpenChange(false);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter" && filtered[highlight]) {
      event.preventDefault();
      run(filtered[highlight]);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setQuery("");
        onOpenChange(next);
      }}
    >
      <DialogContent size="md" className="gap-0 p-0">
        <DialogTitle className="sr-only">Paleta de comandos</DialogTitle>
        <input
          data-autofocus
          className="w-full border-b border-border bg-transparent px-4 py-3 text-sm text-text placeholder:text-text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-subtle"
          placeholder={placeholder}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlight(0);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
          aria-expanded
          aria-controls="command-list"
        />
        <ul id="command-list" role="listbox" className="max-h-80 overflow-auto p-2">
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-text-muted">Sin resultados</li>
          ) : (
            filtered.map((item, index) => (
              <li
                key={item.id}
                role="option"
                aria-selected={index === highlight}
                className={cn(
                  "cursor-pointer rounded-md px-3 py-2 text-sm",
                  index === highlight ? "bg-bg-surface text-text" : "text-text-secondary"
                )}
                onMouseEnter={() => setHighlight(index)}
                onClick={() => run(item)}
              >
                {item.label}
              </li>
            ))
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
