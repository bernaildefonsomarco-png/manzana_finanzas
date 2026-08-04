"use client";

import { useEffect, useId, useRef } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import { ProvenanceRowItem } from "./provenance-row";

// `48` `SCR-AYUDA-01`/`RUL-AYUDA-01`/`RUL-AYUDA-02` — la procedencia de una
// cifra: qué se contó, qué no se contó, y las filas navegables que la
// componen. Panel lateral, **no modal** (mismo criterio que el asistente,
// `RUL-ASI-01`/`WEB-D267`): la explicación de una cifra se lee mirando la
// cifra, no tapándola — por eso es `<section>`, no `Dialog`/`Sheet`
// (`AC-DS-04`: el rol de diálogo es exclusivo de esos dos). `WEB-D138` —
// es un componente reutilizable, no una promesa que cada pantalla cumple
// por su cuenta.

export type ProvenanceRow = {
  id: string;
  label: string;
  detail?: string;
  amount?: number | null;
  href?: string;
};

export type ProvenanceNotCountedItem = {
  text: string;
  actionLabel?: string;
  actionHref?: string;
};

export type ProvenanceData = {
  /** "De dónde sale este S/560.00" */
  title: string;
  countedLines: string[];
  notCounted: ProvenanceNotCountedItem[];
  rowsTitle: string;
  rows: ProvenanceRow[];
};

export function ProvenancePanel({
  data,
  onClose,
  triggerRef,
}: {
  data: ProvenanceData;
  onClose: () => void;
  /** Elemento al que vuelve el foco al cerrar (`48` §11). */
  triggerRef?: React.RefObject<HTMLElement | null>;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => {
    panelRef.current?.focus();
    const elementToRefocus = triggerRef?.current ?? null;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      elementToRefocus?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <section
      ref={panelRef}
      aria-labelledby={titleId}
      tabIndex={-1}
      className="fixed inset-y-0 right-0 z-drawer flex w-full max-w-md flex-col overflow-y-auto border-l border-border bg-bg-primary p-5 shadow-lg focus:ring-2 focus:ring-brand sm:max-w-sm"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={titleId} className="font-heading text-base font-semibold text-text">
          {data.title}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="shrink-0 rounded-md p-1 text-text-muted hover:bg-bg-surface hover:text-text"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {data.countedLines.length > 0 ? (
        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            Qué conté
          </h3>
          <div className="mt-2 space-y-1 text-sm text-text-secondary">
            {data.countedLines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
        </section>
      ) : null}

      {data.notCounted.length > 0 ? (
        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            Qué no conté
          </h3>
          <ul className="mt-2 space-y-2 text-sm text-text-secondary">
            {data.notCounted.map((item, index) => (
              <li key={index}>
                <p>{item.text}</p>
                {item.actionLabel && item.actionHref ? (
                  <Link href={item.actionHref} className="text-sm font-medium text-text-brand hover:text-brand-hover">
                    {item.actionLabel}
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {data.rows.length > 0 ? (
        <section className="mt-5">
          <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-text-muted">
            {data.rowsTitle}
          </h3>
          <ul className="mt-2 divide-y divide-border">
            {data.rows.map((row) => <ProvenanceRowItem key={row.id} row={row} />)}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
