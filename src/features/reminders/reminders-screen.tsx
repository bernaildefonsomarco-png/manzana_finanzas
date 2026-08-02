"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { BellOff, Settings } from "lucide-react";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { useDiscreetMode } from "@/shared/privacy/discreet-mode-context";
import { Button } from "@/ui/primitivas/button";
import { EmptyState, ErrorState, LoadingBlock } from "@/ui/primitivas/states";
import { dismissReminder, listReminders, markAllRead, snoozeReminder, type Reminder } from "./reminders-api";

type Props = { onSignOut?: () => void; onNavigate?: (view: AppView) => void };

// SCR-NOTIF-01 (37 §8): ningún icono de campana, ningún color de alarma,
// ninguna exclamación. Cada recordatorio es una frase sobre el dinero del
// usuario, no un aviso.
export function RemindersScreen(props: Props) {
  const [rows, setRows] = useState<Reminder[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [revision, setRevision] = useState(0);
  const { discreet } = useDiscreetMode();

  useEffect(() => {
    let active = true;
    void listReminders("abiertos")
      .then((next) => {
        if (!active) return;
        setRows(next);
        setState("ready");
      })
      .catch(() => {
        if (active) setState("error");
      });
    return () => {
      active = false;
    };
  }, [revision]);

  useEffect(() => {
    // ACT-NOTIF-01: abrir la bandeja marca todo como leído (no borra nada).
    void markAllRead();
  }, []);

  const reload = () => setRevision((value) => value + 1);

  return (
    <AppShell title="Lo que te espera" subtitle="Recordatorios" activeView="reminders" {...props}>
      <main className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-5 flex items-center justify-between gap-3">
          <p className="text-sm text-text-secondary">Se resuelven solos cuando ya no hacen falta.</p>
          <div className="flex gap-2">
            <Link
              href="/recordatorios?filtro=cerrados"
              className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-bg-surface"
            >
              Ver resueltos
            </Link>
            <Link
              href="/configuracion/recordatorios"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-medium text-text hover:bg-bg-surface"
            >
              <Settings className="h-4 w-4" />
              Ajustes
            </Link>
          </div>
        </div>

        {state === "loading" ? <LoadingBlock label="Cargando recordatorios" /> : null}
        {state === "error" ? <ErrorState onRetry={reload} /> : null}
        {state === "ready" && rows.length === 0 ? (
          <EmptyState
            icon={<BellOff className="h-5 w-5" />}
            title="Nada pendiente."
            description="Aquí te avisaré de lo que venza. Por ahora no hay nada."
          />
        ) : null}
        {state === "ready" ? (
          <section className="space-y-3" aria-label="Recordatorios abiertos" role="list">
            {rows.map((reminder) => (
              <ReminderRow key={reminder.id} reminder={reminder} discreet={discreet} onChanged={reload} />
            ))}
          </section>
        ) : null}
      </main>
    </AppShell>
  );
}

function ReminderRow({
  reminder,
  discreet,
  onChanged,
}: {
  reminder: Reminder;
  discreet: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);

  async function handleSnooze() {
    setBusy(true);
    const until = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    try {
      await snoozeReminder(reminder.id, until);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function handleDismiss() {
    setBusy(true);
    try {
      await dismissReminder(reminder.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  const body = discreet ? hideMoney(reminder.body) : reminder.body;

  return (
    <article
      role="listitem"
      className="rounded-xl border border-border bg-bg-surface-raised p-4 shadow-xs"
      aria-label={reminder.title}
    >
      <p className="text-sm font-medium text-text">{discreet ? hideMoney(reminder.title) : reminder.title}</p>
      <p className="mt-1 text-sm leading-6 text-text-secondary">{body}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {reminder.action_url ? (
          <Link
            href={reminder.action_url}
            className="inline-flex h-9 items-center rounded-md bg-brand px-3 text-sm font-medium text-text-inverse hover:bg-brand-hover"
          >
            Ir
          </Link>
        ) : null}
        <Button variant="secondary" size="sm" disabled={busy} onClick={() => void handleSnooze()}>
          Más tarde
        </Button>
        <Button variant="ghost" size="sm" disabled={busy} onClick={() => void handleDismiss()}>
          Descartar
        </Button>
      </div>
    </article>
  );
}

function hideMoney(text: string): string {
  return text.replace(/S\/\s?\d[\d,]*\.?\d*/g, "S/•••");
}
