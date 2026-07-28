"use client";

import type { ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "./cn";

type SwitchProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onChange" | "role"
> & {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  /** Mientras se guarda: el control queda inerte pero conserva su estado
   * visual y su `aria-checked`, en vez de saltar a un valor no confirmado. */
  loading?: boolean;
};

export function Switch({
  checked,
  onCheckedChange,
  className,
  disabled,
  loading = false,
  ...props
}: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-busy={loading || undefined}
      disabled={disabled || loading}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        checked
          ? "border-brand bg-brand"
          : "border-border-strong bg-bg-surface",
        className
      )}
      onClick={() => onCheckedChange(!checked)}
      {...props}
    >
      {loading ? (
        <Loader2
          aria-hidden="true"
          className={cn(
            "h-4 w-4 animate-spin text-text-inverse transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "block h-4 w-4 rounded-full bg-white shadow-sm transition-transform",
            checked ? "translate-x-6" : "translate-x-1"
          )}
        />
      )}
    </button>
  );
}
