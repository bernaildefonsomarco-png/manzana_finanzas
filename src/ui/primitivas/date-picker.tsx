"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { cn } from "./cn";
import { Button } from "./button";
import { Popover, PopoverContent } from "./popover";
import {
  MONTH_NAMES_ES,
  WEEKDAY_LABELS_ES,
  daysInMonth,
  firstWeekdayOfMonth,
  parseIsoDate,
  toIsoDate,
  todayInLima,
} from "@/shared/dates/lima";

type DatePickerProps = {
  /** Fecha ISO `YYYY-MM-DD`, o `null` si no hay ninguna. */
  value: string | null;
  onValueChange: (value: string) => void;
  "aria-label": string;
  className?: string;
};

/**
 * Entrada por texto siempre disponible, no solo el calendario (`16` §4.2):
 * el campo de texto acepta `YYYY-MM-DD` directamente; el botón de
 * calendario es un atajo, no el único camino.
 */
export function DatePicker({ value, onValueChange, className, ...props }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = value ? parseIsoDate(value) : null;
  const today = todayInLima();
  const [viewYear, setViewYear] = useState(selected?.year ?? today.year);
  const [viewMonth, setViewMonth] = useState(selected?.month ?? today.month);

  function pick(day: number) {
    onValueChange(toIsoDate(viewYear, viewMonth, day));
    setOpen(false);
  }

  function changeMonth(delta: number) {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  }

  const total = daysInMonth(viewYear, viewMonth);
  const leading = firstWeekdayOfMonth(viewYear, viewMonth);
  const cells: (number | null)[] = [
    ...Array.from({ length: leading }, () => null),
    ...Array.from({ length: total }, (_, i) => i + 1),
  ];

  return (
    <div className={cn("flex gap-2", className)}>
      <input
        type="text"
        inputMode="numeric"
        placeholder="AAAA-MM-DD"
        value={value ?? ""}
        onChange={(event) => {
          const parsed = parseIsoDate(event.target.value);
          if (parsed) onValueChange(event.target.value);
        }}
        className="h-11 w-36 rounded-lg border border-border bg-bg-surface-raised px-3 text-sm text-text shadow-xs focus:border-border-focus focus:outline-none focus:ring-2 focus:ring-brand-subtle"
        {...props}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <Button type="button" variant="secondary" size="icon" onClick={() => setOpen((o) => !o)}>
          <CalendarIcon className="h-4 w-4" aria-hidden="true" />
          Abrir calendario
        </Button>
        <PopoverContent className="w-64 p-3" role="group" aria-label="Calendario">
          <div className="mb-2 flex items-center justify-between">
            <Button type="button" variant="ghost" size="icon" onClick={() => changeMonth(-1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              Mes anterior
            </Button>
            <span className="text-sm font-medium text-text">
              {MONTH_NAMES_ES[viewMonth]} {viewYear}
            </span>
            <Button type="button" variant="ghost" size="icon" onClick={() => changeMonth(1)}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
              Mes siguiente
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-1 text-center text-xs text-text-muted">
            {WEEKDAY_LABELS_ES.map((label, i) => (
              <span key={i}>{label}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((day, index) => {
              if (day === null) return <span key={index} />;
              const isSelected =
                selected?.year === viewYear && selected.month === viewMonth && selected.day === day;
              const isToday =
                today.year === viewYear && today.month === viewMonth && today.day === day;
              return (
                <button
                  key={index}
                  type="button"
                  onClick={() => pick(day)}
                  aria-current={isToday ? "date" : undefined}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-full text-sm text-text hover:bg-bg-surface focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-border-focus",
                    isSelected && "bg-brand text-text-inverse hover:bg-brand-hover",
                    !isSelected && isToday && "font-semibold text-brand"
                  )}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
