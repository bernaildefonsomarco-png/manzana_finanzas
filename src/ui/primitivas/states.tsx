import type { ReactNode } from "react";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "./button";
import { cn } from "./cn";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-80 flex-col items-center justify-center rounded-xl border border-border bg-bg-surface-raised px-6 py-12 text-center shadow-xs",
        className
      )}
    >
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-subtle text-brand shadow-xs">
        {icon}
      </div>
      <h3 className="font-heading text-lg font-semibold tracking-normal text-text">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "No pude cargar esto",
  description = "Intenta de nuevo en un momento.",
  onRetry,
  className,
}: {
  title?: string;
  description?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-80 flex-col items-center justify-center rounded-xl border border-error-subtle bg-error-subtle/30 px-6 py-12 text-center",
        className
      )}
    >
      <AlertCircle className="h-8 w-8 text-error" />
      <h3 className="mt-4 font-heading text-lg font-semibold tracking-normal text-text">
        {title}
      </h3>
      <p className="mt-2 max-w-sm text-sm text-text-secondary">{description}</p>
      {onRetry ? (
        <Button className="mt-5" variant="secondary" onClick={onRetry}>
          Reintentar
        </Button>
      ) : null}
    </div>
  );
}

export function LoadingBlock({
  label = "Cargando",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-h-80 flex-col items-center justify-center rounded-xl border border-border bg-bg-surface-raised px-6 py-12 text-text-secondary shadow-xs",
        className
      )}
    >
      <Loader2 className="h-6 w-6 animate-spin text-brand" />
      <p className="mt-3 text-sm">{label}</p>
    </div>
  );
}

export function SkeletonLine({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "h-4 animate-pulse rounded-sm bg-bg-surface",
        className
      )}
    />
  );
}

/** La forma de una fila de lista: icono + dos líneas + monto — la forma
 * real de `MovementRow`/`PendingRow`, no una barra genérica (`16` §4.1). */
export function SkeletonRow({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex items-center gap-3 py-3", className)}
      aria-hidden="true"
    >
      <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-bg-surface" />
      <div className="flex-1 space-y-2">
        <div className="h-3.5 w-2/5 animate-pulse rounded-sm bg-bg-surface" />
        <div className="h-3 w-1/4 animate-pulse rounded-sm bg-bg-surface" />
      </div>
      <div className="h-4 w-16 shrink-0 animate-pulse rounded-sm bg-bg-surface" />
    </div>
  );
}

/** La forma de una tarjeta de resumen: título + cifra grande + línea. */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-surface-raised p-5",
        className
      )}
      aria-hidden="true"
    >
      <div className="h-3 w-1/3 animate-pulse rounded-sm bg-bg-surface" />
      <div className="mt-3 h-7 w-1/2 animate-pulse rounded-sm bg-bg-surface" />
      <div className="mt-2 h-3 w-2/3 animate-pulse rounded-sm bg-bg-surface" />
    </div>
  );
}
