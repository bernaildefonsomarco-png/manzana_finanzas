import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
};

export function Card({ className, elevated = false, ...props }: CardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-border bg-bg-surface-raised",
        elevated ? "shadow-sm" : "shadow-xs",
        className
      )}
      {...props}
    />
  );
}

export function SectionHeader({
  title,
  eyebrow,
  action,
  className,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-medium text-text-muted">{eyebrow}</p>
        ) : null}
        <h2 className="font-heading text-lg font-semibold tracking-normal text-text">
          {title}
        </h2>
      </div>
      {action}
    </div>
  );
}
