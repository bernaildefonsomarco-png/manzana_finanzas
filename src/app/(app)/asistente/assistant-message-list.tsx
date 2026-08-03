"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Button } from "@/ui/primitivas/button";
import type { AssistantMessageWithBlocks } from "./assistant-types";
import { AssistantMessage } from "./assistant-message";
import { useAssistantSlowTurn } from "./use-assistant-slow-turn";

/**
 * `RUL-ASI-21`: la region se anuncia una vez por bloque COMPLETO, nunca
 * por fragmento — por eso `aria-live` envuelve la lista entera y no cada
 * palabra (el streaming palabra a palabra de `texto`, cuando llegue en la
 * Fase 6, no debe vivir dentro de esta region).
 */
export function AssistantMessageList({
  messages,
  threadId,
  isLoading,
  isSending,
}: {
  messages: AssistantMessageWithBlocks[];
  threadId: string | null;
  isLoading: boolean;
  isSending: boolean;
}) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const isSlow = useAssistantSlowTurn(isSending);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (isLoading) {
    return (
      <div className="space-y-3 p-4" aria-hidden="true">
        <div className="h-10 w-2/3 animate-pulse rounded-xl bg-bg-surface" />
        <div className="h-10 w-3/4 animate-pulse rounded-xl bg-bg-surface" />
        <div className="h-10 w-1/2 animate-pulse rounded-xl bg-bg-surface" />
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="space-y-2 p-4 text-sm text-text-secondary">
        <p>Puedes pedirme cosas como:</p>
        <p>&ldquo;gasté 32 en Rappi&rdquo;</p>
        <p>&ldquo;¿cuánto llevo en comida este mes?&rdquo;</p>
        <p>&ldquo;muéstrame mis deudas&rdquo;</p>
      </div>
    );
  }

  return (
    <div aria-live="polite" className="space-y-4 overflow-y-auto p-4">
      {messages.map((message) => (
        <AssistantMessage key={message.id} message={message} threadId={threadId} />
      ))}
      {isSending ? (
        <div className="flex items-center gap-2 text-xs text-text-muted" role="status">
          <p>{isSlow ? "Estoy tardando más de lo normal." : "Manzana está respondiendo…"}</p>
          {isSlow ? (
            <Link href="/movimientos/nuevo" className="shrink-0">
              <Button type="button" variant="ghost" size="sm">
                Hacerlo directamente
              </Button>
            </Link>
          ) : null}
        </div>
      ) : null}
      <div ref={bottomRef} />
    </div>
  );
}
