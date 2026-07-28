import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import {
  getLearningPreferences,
  listFinancialMemory,
  manageFinancialMemory,
  setLearningPreferences,
  type FinancialMemoryItem,
} from "@/data/repositories/financial-memory.repository";
import { buildDashboardDeepLink } from "@/shared/app-links";

type Client = SupabaseClient<Database>;

export type MemoryControlResult = {
  handled: boolean;
  action:
    | "none"
    | "list"
    | "forget"
    | "correct"
    | "enable"
    | "disable"
    | "clarify";
  response_text: string | null;
  affected_memory_ids: string[];
};

type ParsedMemoryControl =
  | { action: "list" }
  | { action: "enable" }
  | { action: "disable" }
  | { action: "clarify" }
  | { action: "forget"; query: string }
  | { action: "correct"; query: string; summary: string };

export function parseMemoryControlFromText(
  text: string,
): ParsedMemoryControl | null {
  const normalized = normalize(text);
  if (
    /^(que recuerdas de mi|que sabes de mi|muestrame mis recuerdos|mis recuerdos)$/.test(
      normalized,
    )
  ) {
    return { action: "list" };
  }
  if (
    /^(deja de aprender de mi|desactiva (el )?aprendizaje|no uses mis recuerdos)$/.test(
      normalized,
    )
  ) {
    return { action: "disable" };
  }
  if (
    /^(activa (el )?aprendizaje|vuelve a usar mis recuerdos|usa mis recuerdos)$/.test(
      normalized,
    )
  ) {
    return { action: "enable" };
  }
  if (
    /^(ese recuerdo|eso que recuerdas) (ya no es asi|es incorrecto)$/.test(
      normalized,
    )
  ) {
    return { action: "clarify" };
  }

  const correction = normalized.match(
    /^corrige (m-[a-f0-9]{6,8})\s*:\s*(.{3,})$/,
  );
  if (correction) {
    return {
      action: "correct",
      query: correction[1],
      summary: correction[2],
    };
  }

  const forget = normalized.match(
    /^(?:no recuerdes(?: mas)?|olvida (?:el recuerdo|mi preferencia|mi alias|lo que recuerdas)(?: sobre)?)\s+(.+)$/,
  );
  if (forget) return { action: "forget", query: forget[1] };
  const codeOnly = normalized.match(/^olvida\s+(m-[a-f0-9]{6,8})$/);
  if (codeOnly) return { action: "forget", query: codeOnly[1] };
  return null;
}

export async function handleMemoryControlFromText(input: {
  client: Client;
  userId: string;
  text: string;
  traceId: string;
}): Promise<MemoryControlResult> {
  const command = parseMemoryControlFromText(input.text);
  if (!command) return notHandled();
  const settingsUrl = buildDashboardDeepLink("settings");

  if (command.action === "enable" || command.action === "disable") {
    const current = await getLearningPreferences(input.client, input.userId);
    const enabled = command.action === "enable";
    await setLearningPreferences(input.client, {
      userId: input.userId,
      enabled,
      allowNarrativeMemory: current.allow_narrative_memory,
      allowSensitiveMemory: current.allow_sensitive_memory,
      idempotencyKey: `memory-control:${input.traceId}:learning:${command.action}`,
    });
    return {
      handled: true,
      action: command.action,
      response_text: enabled
        ? "Activé el aprendizaje. Solo usaré recuerdos confirmados y nunca los trataré como autorización para mover dinero."
        : "Desactivé el aprendizaje y suspendí el uso de tus recuerdos. Tus movimientos y saldos no cambiaron.",
      affected_memory_ids: [],
    };
  }

  const memories = await listFinancialMemory(input.client, {
    userId: input.userId,
    statuses: ["confirmed", "suspended"],
    limit: 200,
  });

  if (command.action === "list") {
    return {
      handled: true,
      action: "list",
      response_text: composeMemoryList(memories, settingsUrl),
      affected_memory_ids: [],
    };
  }
  if (command.action === "clarify") {
    return {
      handled: true,
      action: "clarify",
      response_text:
        composeMemoryList(memories, settingsUrl) +
        "\n\nDime el código, por ejemplo: “Corrige M-12AB34: ahora prefiero respuestas detalladas”.",
      affected_memory_ids: [],
    };
  }

  const matches = findMemoryMatches(memories, command.query);
  if (matches.length !== 1) {
    return {
      handled: true,
      action: "clarify",
      response_text:
        matches.length === 0
          ? "No encontré un recuerdo activo que coincida. Escribe “qué recuerdas de mí” para verlos con su código."
          : composeMemoryList(matches, settingsUrl) +
            "\n\nEncontré más de uno. Indícame el código exacto.",
      affected_memory_ids: [],
    };
  }

  const memory = matches[0];
  await manageFinancialMemory(input.client, {
    userId: input.userId,
    memoryId: memory.id,
    action: command.action,
    summary: command.action === "correct" ? command.summary : undefined,
    reason: `explicit_memory_control_${command.action}`,
    idempotencyKey:
      `memory-control:${input.traceId}:memory:${memory.id}:${command.action}`,
  });
  return {
    handled: true,
    action: command.action,
    response_text:
      command.action === "forget"
        ? `Listo. Olvidé ${memoryCode(memory)} y ya no lo usaré en conversaciones. Esto no cambió ningún dato financiero.`
        : `Listo. Reemplacé ${memoryCode(memory)} por tu versión confirmada. No cambié movimientos ni saldos.`,
    affected_memory_ids: [memory.id],
  };
}

function composeMemoryList(
  memories: FinancialMemoryItem[],
  settingsUrl: string | null,
): string {
  if (memories.length === 0) {
    return (
      "No tengo recuerdos permanentes activos sobre ti. Una conversación aislada no se convierte en aprendizaje estable." +
      (settingsUrl ? `\n\nPuedes revisar Memoria: ${settingsUrl}` : "")
    );
  }
  const lines = memories.slice(0, 8).map((memory) => {
    const summary =
      memory.sensitivity === "sensitive"
        ? "Contexto sensible (contenido oculto en esta lista)"
        : memory.summary;
    return `• ${memoryCode(memory)} · ${summary} · ${statusLabel(memory.lifecycle_status)}`;
  });
  const extra =
    memories.length > 8
      ? `\n• ${memories.length - 8} recuerdos más en Configuración`
      : "";
  return (
    `Esto es lo que recuerdo con evidencia trazable:\n\n${lines.join("\n")}${extra}` +
    "\n\nPuedes decir “Olvida M-CÓDIGO” o “Corrige M-CÓDIGO: nueva versión”." +
    (settingsUrl ? `\nTambién puedes gestionarlo aquí: ${settingsUrl}` : "")
  );
}

function findMemoryMatches(
  memories: FinancialMemoryItem[],
  query: string,
): FinancialMemoryItem[] {
  const normalized = normalize(query);
  const byCode = memories.filter(
    (memory) => normalize(memoryCode(memory)) === normalized,
  );
  if (byCode.length > 0) return byCode;
  const tokens = normalized.split(" ").filter((token) => token.length > 2);
  if (tokens.length === 0) return [];
  return memories.filter((memory) => {
    const haystack = normalize(
      [
        memory.summary,
        memory.canonical_key,
        memory.kind,
        ...memory.search_terms,
      ].join(" "),
    );
    return tokens.every((token) => haystack.includes(token));
  });
}

function memoryCode(memory: FinancialMemoryItem): string {
  return `M-${memory.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

function statusLabel(status: FinancialMemoryItem["lifecycle_status"]): string {
  return status === "suspended" ? "suspendido" : "confirmado";
}

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[¿?¡!.,;"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function notHandled(): MemoryControlResult {
  return {
    handled: false,
    action: "none",
    response_text: null,
    affected_memory_ids: [],
  };
}
