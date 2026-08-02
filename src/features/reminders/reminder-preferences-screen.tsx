"use client";

import { useEffect, useState } from "react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { Button } from "@/ui/primitivas/button";
import { ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { Switch } from "@/ui/primitivas/switch";
import type { NudgeType } from "@/shared/types/domain";
import {
  getReminderPreferences,
  pauseReminders,
  resumeReminders,
  setReminderPreference,
  type ReminderPreference,
} from "./reminders-api";

type Props = { onSignOut?: () => void; onNavigate?: (view: AppView) => void };

// SCR-NOTIF-03 (37 §8): la columna de correo empieza vacía siempre
// (RUL-NOTIF-04). "Cuando no registras nada" empieza apagado en las dos
// columnas: es el tipo de clase U.
const ROWS: { kind: NudgeType; label: string }[] = [
  { kind: "pago_proximo", label: "Pagos que vienen" },
  { kind: "cuota_proxima", label: "Cuotas de deudas" },
  { kind: "presupuesto_umbral", label: "Presupuesto en su límite" },
  { kind: "pendientes_acumulados", label: "Pendientes acumulados" },
  { kind: "correo_desconectado", label: "Cuando algo deja de funcionar" },
  { kind: "sin_registrar", label: "Cuando no registras nada" },
];

export function ReminderPreferencesScreen(props: Props) {
  const [preferences, setPreferences] = useState<ReminderPreference[]>([]);
  const [pausedUntil, setPausedUntil] = useState<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [pending, setPending] = useState<string | null>(null);

  function load() {
    setState("loading");
    return getReminderPreferences()
      .then((result) => {
        setPreferences(result.preferences);
        setPausedUntil(result.paused_until);
        setState("ready");
      })
      .catch(() => setState("error"));
  }

  useEffect(() => {
    let active = true;
    getReminderPreferences()
      .then((result) => {
        if (!active) return;
        setPreferences(result.preferences);
        setPausedUntil(result.paused_until);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, []);

  async function toggle(kind: NudgeType, channel: "dashboard" | "email", enabled: boolean) {
    setPending(`${kind}:${channel}`);
    try {
      await setReminderPreference({ nudge_type: kind, channel, enabled });
      await load();
    } finally {
      setPending(null);
    }
  }

  function preferenceFor(kind: NudgeType, channel: "dashboard" | "email"): boolean {
    return preferences.find((p) => p.nudge_type === kind && p.channel === channel)?.enabled ?? false;
  }

  return (
    <AppShell title="Recordatorios" subtitle="Elige de qué te aviso y por dónde." activeView="settings" {...props}>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        {state === "loading" ? <LoadingBlock label="Cargando preferencias" /> : null}
        {state === "error" ? <ErrorState onRetry={() => void load()} /> : null}
        {state === "ready" ? (
          <>
            <div className="overflow-hidden rounded-xl border border-border bg-bg-surface-raised">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-text-secondary">
                    <th className="px-4 py-3 font-medium">Tipo</th>
                    <th className="px-4 py-3 font-medium">En la app</th>
                    <th className="px-4 py-3 font-medium">Correo</th>
                  </tr>
                </thead>
                <tbody>
                  {ROWS.map((row) => (
                    <tr key={row.kind} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 text-text">{row.label}</td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={preferenceFor(row.kind, "dashboard")}
                          loading={pending === `${row.kind}:dashboard`}
                          onCheckedChange={(checked) => void toggle(row.kind, "dashboard", checked)}
                          aria-label={`${row.label}, en la app`}
                        />
                      </td>
                      <td className="px-4 py-3">
                        <Switch
                          checked={preferenceFor(row.kind, "email")}
                          loading={pending === `${row.kind}:email`}
                          onCheckedChange={(checked) => void toggle(row.kind, "email", checked)}
                          aria-label={`${row.label}, por correo`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 rounded-xl border border-border bg-bg-surface-raised p-4">
              {pausedUntil ? (
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-text-secondary">
                    Pausado hasta el {new Date(pausedUntil).toLocaleDateString("es-PE")}.
                  </p>
                  <Button variant="secondary" size="sm" onClick={() => void resumeReminders().then(load)}>
                    Reanudar ahora
                  </Button>
                </div>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => void pauseReminders().then(load)}>
                  Pausar todo durante una semana
                </Button>
              )}
            </div>
          </>
        ) : null}
      </main>
    </AppShell>
  );
}
