"use client";

import Link from "next/link";
import { History, X } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import { useAssistantConversation } from "./use-assistant-conversation";
import { useAssistantHealth } from "./use-assistant-health";
import { AssistantMessageList } from "./assistant-message-list";
import { AssistantComposer } from "./assistant-composer";
import { AssistantDegradationBanner } from "./assistant-degradation-banner";

/**
 * Cuerpo compartido de la conversacion — lo usa tanto el panel persistente
 * (`SCR-ASI-01`/`SCR-ASI-02`) como `/asistente` (`SCR-ASI-03`), para que no
 * existan dos implementaciones del mismo hilo que puedan divergir.
 */
export function AssistantPanelContent({
  onClose,
  titleId,
  initialThreadId = null,
}: {
  onClose?: () => void;
  titleId?: string;
  initialThreadId?: string | null;
}) {
  const { threadId, messages, isLoadingThread, sendMessage, isSending } =
    useAssistantConversation(initialThreadId);
  const { data: health } = useAssistantHealth();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <p id={titleId} className="font-heading text-sm font-semibold text-brand">
          Manzana
        </p>
        <div className="flex items-center gap-1">
          <Link href="/asistente/hilos">
            <Button type="button" variant="ghost" size="icon" icon={<History className="h-4 w-4" />}>
              Ver conversaciones anteriores
            </Button>
          </Link>
          {onClose ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              icon={<X className="h-4 w-4" />}
              onClick={onClose}
            >
              Cerrar el asistente
            </Button>
          ) : null}
        </div>
      </header>
      <AssistantDegradationBanner grade={health?.grado} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <AssistantMessageList
          messages={messages}
          threadId={threadId}
          isLoading={isLoadingThread}
          isSending={isSending}
        />
      </div>
      <AssistantComposer onSend={async (text) => void (await sendMessage(text))} disabled={isSending} />
    </div>
  );
}
