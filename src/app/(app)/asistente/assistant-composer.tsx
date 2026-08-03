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
  const inputRef = useRef<HTMLTextAreaElement>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed || disabled) return;
    setText("");
    await onSend(trimmed);
    inputRef.current?.focus();
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="flex items-end gap-2 border-t border-border p-3"
    >
      <textarea
        ref={inputRef}
        value={text}
        onChange={(event) => setText(event.target.value)}
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
    </form>
  );
}
