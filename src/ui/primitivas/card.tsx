import type { AnchorHTMLAttributes, HTMLAttributes, ReactNode } from "react";
import { cn } from "./cn";

type CardProps = HTMLAttributes<HTMLDivElement> & {
  elevated?: boolean;
};

const CARD_BASE = "rounded-xl border border-border bg-bg-surface-raised";

export function Card({ className, elevated = false, ...props }: CardProps) {
  return (
    <section
      className={cn(CARD_BASE, elevated ? "shadow-sm" : "shadow-xs", className)}
      {...props}
    />
  );
}

type CardLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  elevated?: boolean;
};

/**
 * Variante interactiva: toda la tarjeta es un enlace (16 §4.1). Es un
 * componente aparte, no una prop `href` en `Card`, porque cambia el
 * elemento semántico (`<a>` en vez de `<section>`) — un `href` opcional no
 * puede decidir eso sin romper el tipo de `onClick`/`children` de la otra.
 */
export function CardLink({ className, elevated = false, ...props }: CardLinkProps) {
  return (
    <a
      className={cn(
        CARD_BASE,
        elevated ? "shadow-sm" : "shadow-xs",
        "block transition hover:border-border-strong hover:shadow-md",
        "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
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
