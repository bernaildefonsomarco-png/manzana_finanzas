import type { HTMLAttributes } from "react";
import { cn } from "./cn";

type BadgeTone = "neutral" | "success" | "warning" | "error" | "info" | "debt";

const toneClasses: Record<BadgeTone, string> = {
  neutral: "bg-bg-surface text-text-secondary border-border",
  success: "bg-success-subtle text-success border-success-subtle",
  warning: "bg-warning-subtle text-amber-800 border-warning-subtle",
  error: "bg-error-subtle text-error border-error-subtle",
  info: "bg-info-subtle text-blue-800 border-info-subtle",
  debt: "bg-debt-subtle text-debt border-debt-subtle",
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

