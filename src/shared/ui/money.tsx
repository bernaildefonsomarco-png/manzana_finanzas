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
  value: number;
  discrete?: boolean;
  sign?: "auto" | "negative" | "positive" | "none";
  className?: string;
};

export function MoneyText({
  value,
  discrete,
  sign = "auto",
  className,
}: MoneyTextProps) {
  const { discreet } = useDiscreetMode();
  const effectiveDiscrete = discrete ?? discreet;

  if (effectiveDiscrete) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-sm bg-bg-discrete px-2 py-1 text-text-discrete tabular-nums",
          className
        )}
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
  const formatted = PEN_FORMATTER.format(Math.abs(normalized)).replace(
    "PEN",
    "S/"
  );
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
