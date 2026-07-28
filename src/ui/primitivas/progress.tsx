import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type ProgressProps = Omit<HTMLAttributes<HTMLDivElement>, "aria-label"> & {
  value: number;
  max?: number;
  "aria-label": string;
  /** Presupuesto/deuda pueden pasar de 100 %; el color cambia pero el
   * relleno visual no se sale del contenedor (`16` §4.2). */
  tone?: "brand" | "low" | "over";
};

const TONE_CLASSES: Record<NonNullable<ProgressProps["tone"]>, string> = {
  brand: "bg-progress-fill",
  low: "bg-progress-low",
  over: "bg-error",
};

export function Progress({
  value,
  max = 100,
  tone = "brand",
  className,
  ...props
}: ProgressProps) {
  const ratio = max > 0 ? Math.min(Math.max(value / max, 0), 1) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-progress-track", className)}
      {...props}
    >
      <div
        className={cn("h-full rounded-full transition-[width]", TONE_CLASSES[tone])}
        style={{ width: `${ratio * 100}%` }}
      />
    </div>
  );
}
