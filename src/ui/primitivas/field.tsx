import {
  cloneElement,
  isValidElement,
  type InputHTMLAttributes,
  type LabelHTMLAttributes,
  type ReactElement,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
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

type FieldControlProps = {
  "aria-invalid"?: boolean;
  "aria-describedby"?: string;
  required?: boolean;
};

type FieldShellProps = {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: ReactNode;
};

/**
 * `hint` es la descripción del campo; `error`, cuando existe, la reemplaza
 * (nunca se muestran los dos a la vez) y ambos se enlazan al control por
 * `aria-describedby` — sin esto un lector de pantalla anuncia el campo sin
 * su mensaje de error (`18` §4).
 */
export function FieldShell({
  label,
  htmlFor,
  hint,
  error,
  required,
  children,
}: FieldShellProps) {
  const hintId = hint && !error ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(" ") || undefined;

  const control = isValidElement(children)
    ? cloneElement(children as ReactElement<FieldControlProps>, {
        "aria-invalid": error ? true : undefined,
        "aria-describedby": describedBy,
        required,
      })
    : children;

  return (
    <div className="space-y-2">
      <Label htmlFor={htmlFor}>
        {label}
        {required ? (
          <span aria-hidden="true" className="ml-1 text-error">
            *
          </span>
        ) : null}
      </Label>
      {control}
      {error ? (
        <p id={errorId} className="text-xs text-error">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

const CONTROL_CLASSES =
  "h-12 w-full rounded-lg border border-border bg-bg-surface-raised px-3 text-sm text-text shadow-xs transition placeholder:text-text-muted focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-subtle aria-invalid:border-error aria-invalid:focus:ring-error-subtle";

type InputProps = InputHTMLAttributes<HTMLInputElement> & {
  prefix?: ReactNode;
  suffix?: ReactNode;
};

export function Input({ className, prefix, suffix, ...props }: InputProps) {
  if (!prefix && !suffix) {
    return <input className={cn(CONTROL_CLASSES, className)} {...props} />;
  }
  return (
    <div
      className={cn(
        CONTROL_CLASSES,
        "flex items-center gap-2 has-[input:focus]:border-border-focus has-[input:focus]:ring-2 has-[input:focus]:ring-brand-subtle",
        className
      )}
    >
      {prefix ? (
        <span className="shrink-0 text-text-muted">{prefix}</span>
      ) : null}
      <input
        className="h-full w-full bg-transparent focus:outline-none"
        {...props}
      />
      {suffix ? (
        <span className="shrink-0 text-text-muted">{suffix}</span>
      ) : null}
    </div>
  );
}

export function Select({
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(CONTROL_CLASSES, className)} {...props} />;
}
