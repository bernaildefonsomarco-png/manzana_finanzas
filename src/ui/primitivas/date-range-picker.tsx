"use client";

import { cn } from "./cn";
import { DatePicker } from "./date-picker";

export type DateRange = { from: string | null; to: string | null };

type DateRangePickerProps = {
  value: DateRange;
  onValueChange: (value: DateRange) => void;
  className?: string;
};

/** Dos `DatePicker` con la misma entrada por texto siempre disponible
 * (`16` §4.2). Un `to` anterior a `from` se corrige moviendo `from`, en
 * vez de aceptar un rango invertido en silencio. */
export function DateRangePicker({ value, onValueChange, className }: DateRangePickerProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <DatePicker
        aria-label="Desde"
        value={value.from}
        onValueChange={(from) =>
          onValueChange({
            from,
            to: value.to && value.to < from ? from : value.to,
          })
        }
      />
      <span aria-hidden="true" className="text-text-muted">
        –
      </span>
      <DatePicker
        aria-label="Hasta"
        value={value.to}
        onValueChange={(to) =>
          onValueChange({
            from: value.from && value.from > to ? to : value.from,
            to,
          })
        }
      />
    </div>
  );
}
