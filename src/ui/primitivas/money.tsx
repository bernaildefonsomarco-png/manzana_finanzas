import type { ReactNode } from "react";
import { EyeOff } from "lucide-react";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { cn } from "./cn";

const PEN_FORMATTER = new Intl.NumberFormat("es-PE", {
  style: "currency",
  currency: "PEN",
  minimumFractionDigits: 2,
});

type MoneyTextProps = {
  /** `null` es "no tiene ese dato", distinto de `0` ("tiene cero") — se
   * muestra como "—", nunca como `S/0.00` (`18` §9.1, `AC-A11Y-09`). */
  value: number | null;
  discrete?: boolean;
  sign?: "auto" | "negative" | "positive" | "none";
  /** Sin decimales cuando son `.00` (`16` §4.1). */
  compact?: boolean;
  className?: string;
};

export function MoneyText({
  value,
  discrete,
  sign = "auto",
  compact = false,
  className,
}: MoneyTextProps) {
  const { discreet } = useDiscreetMode();
  const effectiveDiscrete = discrete ?? discreet;

  if (value === null) {
    return (
      <span
        className={cn("tabular-nums text-text-muted", className)}
        aria-label="Sin dato"
      >
        —
      </span>
    );
  }

  if (effectiveDiscrete) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-sm bg-bg-discrete px-2 py-1 text-text-discrete tabular-nums",
          className
        )}
        aria-label="Monto oculto"
      >
        <EyeOff className="h-3.5 w-3.5" />
        ••••
      </span>
    );
  }

  const normalized =
    sign === "negative"
      ? -Math.abs(value)
      : sign === "positive"
      ? Math.abs(value)
      : value;
  // Intl ya usa "S/" como símbolo de PEN en es-PE, pero separa el símbolo
  // de la cifra con un espacio de no separación (U+00A0); `18` §9.1 exige
  // "S/1,250.50" pegado, sin espacio.
  let formatted = PEN_FORMATTER.format(Math.abs(normalized)).replace(
    /^(\D+)\s+/,
    "$1"
  );
  if (compact && formatted.endsWith(".00")) {
    formatted = formatted.slice(0, -3);
  }
  const prefix =
    sign === "none"
      ? ""
      : normalized < 0
      ? "- "
      : normalized > 0 && sign === "positive"
      ? "+ "
      : "";

  return (
    <span className={cn("tabular-nums tracking-normal", className)}>
      {prefix}
      {formatted}
    </span>
  );
}

export function DiscreetValue({
  children,
  discrete,
  className,
}: {
  children: ReactNode;
  discrete?: boolean;
  className?: string;
}) {
  const { discreet } = useDiscreetMode();
  const effectiveDiscrete = discrete ?? discreet;

  if (!effectiveDiscrete) return <span className={className}>{children}</span>;

  return (
    <span
      className={cn(
        "inline-flex min-h-5 min-w-16 rounded-sm bg-bg-discrete px-2 text-text-discrete",
        className
      )}
        aria-label="Información oculta por modo discreto"
    >
      ••••••
    </span>
  );
}
