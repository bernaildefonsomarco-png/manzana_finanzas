"use client";

import Link from "next/link";
import { Archive } from "lucide-react";
import { Button } from "@/ui/primitivas/button";
import type { AssistantThread } from "../assistant-types";

function formatThreadDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("es-PE", { dateStyle: "medium" }).format(date);
}

/** `SCR-ASI-04`: fecha y primera linea; cada una se puede archivar (`ACT-ASI-10`). */
export function AssistantThreadRow({
  thread,
  onArchive,
  archiving,
}: {
  thread: AssistantThread;
  onArchive: (threadId: string) => void;
  archiving: boolean;
}) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-border bg-bg-surface-raised px-4 py-3">
      <Link href={`/asistente?hilo=${thread.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text">
          {thread.title?.trim() || "Conversación"}
        </p>
        <p className="text-xs text-text-muted">{formatThreadDate(thread.updated_at)}</p>
      </Link>
      {thread.status === "activo" ? (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          icon={<Archive className="h-4 w-4" />}
          loading={archiving}
          onClick={() => onArchive(thread.id)}
        >
          Archivar conversación
        </Button>
      ) : (
        <span className="shrink-0 text-xs text-text-muted">Archivada</span>
      )}
    </li>
  );
}
