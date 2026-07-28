"use client";

import { useEffect, useRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";

type TextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  /** Muestra "N/max" bajo el campo cuando hay límite (`16` §4.2). */
  maxLength?: number;
};

/** Autoajusta su altura al contenido en vez de scrollear dentro de una
 * caja fija (`16` §4.2). */
export function Textarea({ className, maxLength, value, onChange, ...props }: TextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);

  const length = typeof value === "string" ? value.length : 0;

  return (
    <div>
      <textarea
        ref={ref}
        value={value}
        onChange={onChange}
        maxLength={maxLength}
        className={cn(
          "min-h-24 w-full resize-none rounded-lg border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text shadow-xs transition placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-subtle",
          className
        )}
        {...props}
      />
      {maxLength ? (
        <p className="mt-1 text-right text-xs text-text-muted" aria-live="polite">
          {length}/{maxLength}
        </p>
      ) : null}
    </div>
  );
}
