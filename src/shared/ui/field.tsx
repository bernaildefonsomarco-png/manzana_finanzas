import type { InputHTMLAttributes, LabelHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "./cn";

export function Label({
  className,
  ...props
}: LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn("text-sm font-medium text-text-secondary", className)}
      {...props}
    />
  );
}

type FieldShellProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  children: ReactNode;
};

export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  children,
}: FieldShellProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p className="text-xs text-error">{error}</p>
      ) : hint ? (
        <p className="text-xs text-text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-lg border border-border bg-bg-surface-raised px-3 text-sm text-text shadow-xs transition placeholder:text-text-muted",
        "focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-subtle",
        className
      )}
      {...props}
    />
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full rounded-lg border border-border bg-bg-surface-raised px-3 text-sm text-text shadow-xs transition",
        "focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-subtle",
        className
      )}
      {...props}
    />
  );
}
