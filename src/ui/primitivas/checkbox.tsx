"use client";

import { useEffect, useRef, type InputHTMLAttributes } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "./cn";

type CheckboxProps = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked"> & {
  checked: boolean | "indeterminate";
  onCheckedChange: (checked: boolean) => void;
};

/** Estándar, con estado indeterminado (`16` §4.2) — "algunas de las filas
 * seleccionadas", no una tercera opción de valor sino un matiz visual del
 * checkbox nativo. */
export function Checkbox({
  checked,
  onCheckedChange,
  className,
  disabled,
  ...props
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = checked === "indeterminate";
  }, [checked]);

  return (
    <span className="relative inline-flex h-5 w-5 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked === true}
        disabled={disabled}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className={cn(
          "peer h-5 w-5 shrink-0 appearance-none rounded-sm border border-border-strong bg-bg-surface-raised transition-colors checked:border-brand checked:bg-brand indeterminate:border-brand indeterminate:bg-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        {...props}
      />
      {checked === "indeterminate" ? (
        <Minus aria-hidden="true" className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-indeterminate:opacity-100" />
      ) : (
        <Check aria-hidden="true" className="pointer-events-none absolute h-3.5 w-3.5 text-white opacity-0 peer-checked:opacity-100" />
      )}
    </span>
  );
}
