import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type BadgeTone =
  | "neutral"
  | "success"
  | "warning"
  | "error"
  | "info"
  | "debt"
  | "budget-ok"
  | "budget-warning"
  | "budget-over";

// `text-{semántico}` a secas no llega a 4.5:1 contra su propio
// "-subtle" en modo claro (medido: success 2.88, warning 1.85, error
// 3.44, info 2.37 — `tests/lint/contraste.test.ts`, AC-DS-03). El texto
// usa la variante "-on-subtle", pensada para ese contraste exacto.
const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-bg-surface text-text-secondary border-border",
  success: "bg-success-subtle text-success-on-subtle border-success-subtle",
  warning: "bg-warning-subtle text-warning-on-subtle border-warning-subtle",
  error: "bg-error-subtle text-error-on-subtle border-error-subtle",
  info: "bg-info-subtle text-info-on-subtle border-info-subtle",
  debt: "bg-debt-subtle text-debt border-debt-subtle",
  "budget-ok": "bg-success-subtle text-budget-ok border-success-subtle",
  "budget-warning": "bg-warning-subtle text-budget-warning border-warning-subtle",
  "budget-over": "bg-error-subtle text-budget-over border-error-subtle",
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: BadgeTone;
};

export function Badge({ className, tone = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-sm border px-2 py-1 text-xs font-medium tracking-normal",
        toneClasses[tone],
        className
      )}
      {...props}
    />
  );
}
