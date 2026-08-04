"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppShell, type AppView } from "@/features/app-shell/app-shell";
import { Button } from "@/ui/primitivas/button";
import { Card } from "@/ui/primitivas/card";

type Props = { onSignOut?: () => void; onNavigate?: (view: AppView) => void };

type ContextItem = { key: "route" | "user_agent" | "app_version"; label: string; value: string };

// `48` `SCR-AYUDA-05`/`RUL-AYUDA-09` — el usuario ve exactamente qué se
// adjunta antes de enviar, y puede quitarlo (`ACT-AYUDA-07`). Nunca datos
// financieros: ni montos, ni descripciones, ni conversaciones.
export function ContactScreen(props: Props) {
  const pathname = usePathname();
  const [message, setMessage] = useState("");
  const [removed, setRemoved] = useState<Set<ContextItem["key"]>>(new Set());
  const [state, setState] = useState<"idle" | "loading" | "sent" | "error">("idle");

  const items: ContextItem[] = [
    { key: "route", label: "La pantalla en la que estabas", value: pathname ?? "/ayuda/contacto" },
    {
      key: "user_agent",
      label: "Versión de tu navegador",
      value: typeof navigator !== "undefined" ? navigator.userAgent : "desconocido",
    },
    { key: "app_version", label: "Versión de la aplicación", value: "web" },
  ];
  const kept = items.filter((item) => !removed.has(item.key));

  function toggleItem(key: ContextItem["key"]) {
    setRemoved((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function handleSend() {
    setState("loading");
    try {
      const context: Record<string, string> = {};
      for (const item of kept) context[item.key] = item.value;

      const response = await fetch("/api/v1/support/contact", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({ message, context }),
      });
      const payload = (await response.json()) as { ok: boolean };
      setState(payload.ok ? "sent" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "sent") {
    return (
      <AppShell title="Contacto" activeView="settings" {...props}>
        <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
          <Card elevated className="p-6 text-center">
            <p role="status" className="text-sm text-text">
              Listo. Te respondo a tu correo.
            </p>
          </Card>
        </main>
      </AppShell>
    );
  }

  return (
    <AppShell title="Contacto" activeView="settings" {...props}>
      <main className="mx-auto w-full max-w-2xl px-4 py-6 sm:px-6">
        <Card elevated className="p-6">
          <label className="block text-sm font-medium text-text" htmlFor="contact-message">
            Cuéntame qué pasó
          </label>
          <textarea
            id="contact-message"
            className="mt-2 h-32 w-full rounded-lg border border-border bg-bg-surface-raised p-3 text-sm text-text"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
          />

          <div className="mt-5 rounded-lg border border-border bg-bg-surface p-4">
            <p className="text-sm text-text">Voy a enviar esto con tu mensaje, para poder ayudarte:</p>
            <ul className="mt-2 space-y-2">
              {items.map((item) => {
                const isRemoved = removed.has(item.key);
                return (
                  <li key={item.key} className="flex items-center justify-between gap-2 text-sm">
                    <span className={isRemoved ? "text-text-muted line-through" : "text-text-secondary"}>
                      {item.label}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-medium text-text-brand hover:text-brand-hover"
                      onClick={() => toggleItem(item.key)}
                    >
                      {isRemoved ? "Volver a incluir" : "Quitar"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="mt-3 text-xs text-text-muted">
              No envío tus movimientos, tus montos ni tus conversaciones.
            </p>
          </div>

          {state === "error" ? (
            <p role="alert" className="mt-4 text-sm text-error">
              No pude enviarlo ahora. Tu mensaje sigue aquí; inténtalo de nuevo.
            </p>
          ) : null}

          <Button
            className="mt-5"
            loading={state === "loading"}
            disabled={message.trim().length === 0}
            onClick={() => void handleSend()}
          >
            Enviar
          </Button>
        </Card>
      </main>
    </AppShell>
  );
}
