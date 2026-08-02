"use client";

import { useEffect, useState } from "react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { Button } from "@/ui/primitivas/button";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { getExportLink, listExports, requestExport, type ExportJob } from "./reports-api";

type Props = { onSignOut?: () => void; onNavigate?: (view: AppView) => void };

// SCR-REP-04 (35 §8): dice qué incluye antes de pedirlo. RUL-REP-11: la
// exportación completa es una obligación, no una función.
export function ExportDataScreen(props: Props) {
  const [exports, setExports] = useState<ExportJob[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [requesting, setRequesting] = useState<"movimientos" | "datos_completos" | null>(null);

  function refresh() {
    return listExports()
      .then((rows) => {
        setExports(rows);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  function load() {
    setState("loading");
    return refresh();
  }

  useEffect(() => {
    let active = true;
    listExports()
      .then((rows) => {
        if (!active) return;
        setExports(rows);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    const interval = setInterval(() => {
      if (active) void refresh();
    }, 4000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  async function handleRequest(kind: "movimientos" | "datos_completos") {
    setRequesting(kind);
    try {
      await requestExport(kind);
      await load();
    } finally {
      setRequesting(null);
    }
  }

  async function handleDownload(id: string) {
    const url = await getExportLink(id);
    window.location.assign(url);
  }

  return (
    <AppShell title="Tus datos" activeView="settings" {...props}>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <div className="rounded-xl border border-border bg-bg-surface-raised p-5">
          <p className="text-sm text-text">
            Puedes llevarte todo lo que Manzana sabe de ti, en un formato que otros programas entienden.
          </p>
          <p className="mt-2 text-sm text-text-secondary">
            Incluye tus movimientos, cuentas, presupuestos, deudas, lo que Manzana aprendió sobre ti y tus
            conversaciones.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button loading={requesting === "movimientos"} onClick={() => void handleRequest("movimientos")}>
              Descargar movimientos (CSV)
            </Button>
            <Button
              variant="secondary"
              loading={requesting === "datos_completos"}
              onClick={() => void handleRequest("datos_completos")}
            >
              Preparar mi descarga completa
            </Button>
          </div>
        </div>

        <section className="mt-6" aria-label="Descargas anteriores">
          <h2 className="mb-2 text-sm font-semibold text-text">Descargas anteriores</h2>
          {state === "loading" ? <LoadingBlock label="Cargando descargas" /> : null}
          {state === "error" ? <ErrorState onRetry={() => void load()} /> : null}
          {state === "ready" && exports.length === 0 ? (
            <p className="text-sm text-text-secondary">Todavía no has pedido ninguna descarga.</p>
          ) : null}
          {state === "ready" && exports.length > 0 ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {exports.map((job) => (
                <li key={job.id} className="flex items-center justify-between px-4 py-3 text-sm">
                  <span className="text-text">
                    {new Date(job.requested_at).toLocaleDateString("es-PE")} ·{" "}
                    {job.kind === "datos_completos" ? "Todos mis datos" : "Movimientos"} · {statusLabel(job.status)}
                  </span>
                  {job.status === "listo" ? (
                    <Button variant="ghost" size="sm" onClick={() => void handleDownload(job.id)}>
                      Descargar
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </main>
    </AppShell>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "pendiente":
    case "procesando":
      return "preparando";
    case "listo":
      return "listo";
    case "expirado":
      return "caducó";
    case "fallido":
      return "falló";
    default:
      return status;
  }
}
