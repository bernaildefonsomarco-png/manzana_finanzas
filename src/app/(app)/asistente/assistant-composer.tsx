"use client";

import { useRef, useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/ui/primitivas/button";

/** `RUL-ASI-22`: tras enviar, el foco se queda en el campo — nunca se mueve el foco tras el envio. */
export function AssistantComposer({
  onSend,
  disabled,
}: {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [text, setText] = useState("");
  const [sendErrorMessage, setSendErrorMessage] = useState<string | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    try {
      await onSend(trimmed);
      setSendErrorMessage(null);
    } catch {
      setText(trimmed);
      setSendErrorMessage("No pude enviar tu mensaje. Intenta de nuevo.");
    }
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex flex-col gap-1 border-t border-border p-3"
    >
      {sendErrorMessage ? (
        <p role="alert" className="px-1 text-sm text-error">
          {sendErrorMessage}
        </p>
      ) : null}
      <div className="flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(event) => {
            setText(event.target.value);
            setSendErrorMessage(null);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              void handleSubmit(event);
            }
          }}
          placeholder="Escribe…"
          aria-label="Escribe un mensaje para Manzana"
          rows={1}
          disabled={disabled}
          className="max-h-32 min-h-11 flex-1 resize-none rounded-lg border border-border bg-bg-surface-raised px-3 py-2 text-sm text-text outline-none placeholder:text-text-muted focus:border-border-focus focus:ring-2 focus:ring-brand-subtle"
        />
        <Button
          type="submit"
          variant="primary"
          size="icon"
          disabled={disabled || text.trim().length === 0}
          icon={<Send className="h-4 w-4" />}
        >
          Enviar
        </Button>
      </div>
    </form>
  );
}
