import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";

type PaginationProps = {
  hasPrevious: boolean;
  hasNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  className?: string;
};

/** Botones reales con estado deshabilitado correcto (`16` §4.2) — no un
 * "Ver más" sin manejador. */
export function Pagination({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  className,
}: PaginationProps) {
  return (
    <nav
      aria-label="Paginación"
      className={cn("flex items-center justify-between gap-2", className)}
    >
      <Button
        type="button"
        variant="secondary"
        size="sm"
        onClick={onPrevious}
        disabled={!hasPrevious}
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Anterior
      </Button>
      <Button type="button" variant="secondary" size="sm" onClick={onNext} disabled={!hasNext}>
        Siguiente
        <ChevronRight className="h-4 w-4" aria-hidden="true" />
      </Button>
    </nav>
  );
}
