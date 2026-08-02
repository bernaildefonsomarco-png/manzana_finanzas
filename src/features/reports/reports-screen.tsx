"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { currentMonthValue, getReportPeriod, type ReportPeriod } from "./reports-api";

type Props = { onSignOut?: () => void; onNavigate?: (view: AppView) => void };

const CATEGORY_LABELS: Record<string, string> = {
  alimentacion: "Alimentación",
  transporte: "Transporte",
  vivienda_hogar: "Vivienda y hogar",
  servicios_suscripciones: "Servicios y suscripciones",
  salud: "Salud",
  educacion: "Educación",
  ocio_salidas: "Ocio y salidas",
  compras_personales: "Compras personales",
  familia_apoyo: "Familia y apoyo",
  deudas: "Deudas",
  trabajo_productividad: "Trabajo y productividad",
  otros: "Otros",
};

const EXCLUSION_LABELS: Record<string, string> = {
  transferencia: "transferencias entre tus cuentas",
  asignacion_interna: "asignaciones a cajas",
  ajuste: "ajustes de saldo",
  prestamo: "préstamos",
  devolucion: "devoluciones",
  pendiente_sin_confirmar: "pendientes que no has confirmado",
  otra_moneda: "movimientos en otra moneda",
};

// SCR-REP-01 (35 §8): las dos primeras cifras son gasto e ingreso, en ese
// orden. "No conté" arriba, junto al total. RUL-REP-08: no interpreta.
export function ReportsScreen(props: Props) {
  const [month] = useState(currentMonthValue());
  const [period, setPeriod] = useState<ReportPeriod | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  function retry() {
    setState("loading");
    return getReportPeriod("mes", month)
      .then((result) => {
        setPeriod(result);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(() => {
    let active = true;
    getReportPeriod("mes", month)
      .then((result) => {
        if (!active) return;
        setPeriod(result);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [month]);

  const monthLabel = new Date(`${month}-01T12:00:00Z`).toLocaleDateString("es-PE", {
    month: "long",
    year: "numeric",
  });

  return (
    <AppShell title={capitalize(monthLabel)} subtitle="Reportes" activeView="reports" {...props}>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        {state === "loading" ? <LoadingBlock label="Cargando el reporte" /> : null}
        {state === "error" ? <ErrorState onRetry={() => void retry()} /> : null}

        {state === "ready" && period && period.gastoMovementCount === 0 && period.ingresoMovementCount === 0 ? (
          <EmptyState
            title="Cuando registres algo, aquí verás en qué se te va."
            description="Todavía no hay movimientos en este periodo."
            action={
              <Link href="/movimientos/nuevo" className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-text-inverse hover:bg-brand-hover">
                Registrar
              </Link>
            }
          />
        ) : null}

        {state === "ready" && period && (period.gastoMovementCount > 0 || period.ingresoMovementCount > 0) ? (
          <>
            <div className="rounded-xl border border-border bg-bg-surface-raised p-5">
              <p className="text-lg font-semibold text-text">
                Gastaste S/{period.gastoTotal.toFixed(2)} en {period.gastoMovementCount} movimientos
              </p>
              <p className="mt-1 text-sm text-text-secondary">Te entraron S/{period.ingresoTotal.toFixed(2)}</p>
              {period.exclusions.length > 0 ? (
                <p className="mt-3 text-xs text-text-secondary">
                  No conté {period.exclusions.map((e) => `${e.count} ${EXCLUSION_LABELS[e.reason] ?? e.reason}`).join(", ")}.
                </p>
              ) : null}
            </div>

            {period.byCategory.length > 0 ? (
              <table className="mt-5 w-full text-sm">
                <caption className="sr-only">Gasto por categoría de {monthLabel}</caption>
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th scope="col" className="py-2 font-medium">
                      Categoría
                    </th>
                    <th scope="col" className="py-2 text-right font-medium">
                      Total
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {period.byCategory.map((c) => (
                    <tr key={c.category_id ?? "sin_categoria"} className="border-b border-border last:border-0">
                      <td className="py-2 text-text">{c.category_id ? CATEGORY_LABELS[c.category_id] ?? c.category_id : "Sin categoría"}</td>
                      <td className="py-2 text-right font-medium tabular-nums text-text">S/{c.total.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}

            <div className="mt-5">
              <Link href="/configuracion/datos" className="inline-flex h-11 items-center rounded-md border border-border bg-bg-surface-raised px-5 text-sm font-medium text-text hover:bg-bg-surface">
                Descargar CSV
              </Link>
            </div>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
