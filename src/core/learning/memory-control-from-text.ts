import { randomUUID } from "node:crypto";
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
import {
  MemoryControlProposalSchema,
  type MemoryControlProposal,
} from "./memory-control-proposal";

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
    | "clarify"
    // `WEB-D065` / `40` §8.2: el motor no puede borrar toda la memoria. Se dice
    // y se da la via de pantalla; no se intenta a medias.
    | "blocked";
  response_text: string | null;
  affected_memory_ids: string[];
  /**
   * Borrador que espera el "si" del usuario. Solo lo llevan `forget` y
   * `correct`, que el catalogo (`40` §7.13) marca como nivel `tarjeta`.
   */
  proposal: MemoryControlProposal | null;
};

/**
 * Orden de memoria ya interpretada. La produce el ejecutivo conversacional
 * (`RUL-MEM-16`) o, para los codigos que el propio asistente ensena a escribir,
 * `parseMemoryControlFromText`. De aqui en adelante el camino es uno solo.
 */
export type MemoryControlCommand =
  | { action: "list" }
  | { action: "enable" }
  | { action: "disable" }
  | { action: "clarify" }
  | { action: "forget_all" }
  | { action: "forget"; query: string }
  | { action: "correct"; query: string; summary: string };

/**
 * `RUL-MEM-16`: lo que queda del detector de texto **no es** deteccion de
 * intencion.
 *
 * Antes esto era una lista de frases exactas ("que recuerdas de mi", "deja de
 * aprender de mi", …) que decidia si el turno era una orden de memoria. Esa
 * lista se retiro entera: la intencion la determina ahora el juicio del modelo,
 * porque una lista de frases nunca va a cubrir "che, olvidate de eso".
 *
 * Lo que sobrevive es solo el par de **comandos con codigo** que el propio
 * asistente imprime al final de cada lista ("Puedes decir 'Olvida M-CÓDIGO'").
 * Eso no es lenguaje natural: es un identificador que el sistema emitio y que
 * el usuario devuelve, igual que el `id` de un boton. Se conserva porque es
 * gratis, no puede confundirse con otra cosa, y mantiene el control de memoria
 * en pie aunque el runtime del modelo este caido. No compite con el modelo ni
 * hay que mantener las dos listas sincronizadas, porque solo una de las dos
 * interpreta lenguaje.
 */
export function parseMemoryControlFromText(
  text: string,
): MemoryControlCommand | null {
  const normalized = normalize(text);

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

  const codeOnly = normalized.match(/^olvida\s+(m-[a-f0-9]{6,8})$/);
  if (codeOnly) return { action: "forget", query: codeOnly[1] };

  return null;
}

/**
 * Camino deterministico: interpreta el texto como comando con codigo y lo
 * resuelve. Devuelve `handled: false` cuando el texto no es uno de esos
 * comandos, y entonces el turno sigue su curso normal hasta que el ejecutivo
 * decida si habia una orden de memoria.
 */
export async function handleMemoryControlFromText(input: {
  client: Client;
  userId: string;
  text: string;
  traceId: string;
  now?: string;
}): Promise<MemoryControlResult> {
  const command = parseMemoryControlFromText(input.text);
  if (!command) return notHandled();
  return resolveMemoryControl({
    client: input.client,
    userId: input.userId,
    command,
    traceId: input.traceId,
    now: input.now,
  });
}

/**
 * Ejecutor unico del control de memoria. Es el mismo para el comando con codigo
 * y para lo que entendio el modelo: cambiar el detector no puede cambiar lo que
 * se ejecuta ni el consentimiento que se respeta.
 *
 * `enable` y `disable` se ejecutan aqui mismo porque `reactivar_aprendizaje` y
 * `no_preguntar_mas` son nivel `ninguna` en el catalogo. `forget` y `correct`
 * **no se ejecutan**: son nivel `tarjeta`, asi que salen como propuesta y solo
 * se aplican cuando el usuario la confirma (`executeMemoryControlProposal`).
 */
export async function resolveMemoryControl(input: {
  client: Client;
  userId: string;
  command: MemoryControlCommand;
  traceId: string;
  now?: string;
}): Promise<MemoryControlResult> {
  const command = input.command;
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
      proposal: null,
    };
  }

  // `WEB-D065` / `40` §8.2: "el motor no puede borrar toda la memoria". No es
  // un limite de implementacion, es una prohibicion del catalogo — asi que se
  // dice claro y se da la via, en vez de intentar un borrado parcial.
  if (command.action === "forget_all") {
    return {
      handled: true,
      action: "blocked",
      response_text:
        "No puedo borrar toda tu memoria desde aquí: esa acción solo se hace desde la pantalla de Memoria, donde ves qué se borra antes de confirmarlo." +
        (settingsUrl ? `\n\nAquí la tienes: ${settingsUrl}` : "") +
        "\n\nSi prefieres, dime un recuerdo concreto y ese sí lo olvido, o pídeme que deje de aprender de ti.",
      affected_memory_ids: [],
      proposal: null,
    };
  }

  const preferences = await getLearningPreferences(input.client, input.userId);
  const memories = await listFinancialMemory(input.client, {
    userId: input.userId,
    statuses: ["confirmed", "suspended"],
    limit: 200,
  });
  // El aprendizaje apagado no oculta lo ya guardado: el usuario tiene derecho a
  // ver y a borrar lo suyo. Solo se dice que ahora mismo no se esta usando.
  const learningNote = preferences.enabled
    ? ""
    : "\n\nAhora mismo el aprendizaje está desactivado, así que no uso nada de esto en nuestras conversaciones. Dime “vuelve a aprender de mí” si quieres reactivarlo.";

  if (command.action === "list") {
    return {
      handled: true,
      action: "list",
      response_text: composeMemoryList(memories, settingsUrl) + learningNote,
      affected_memory_ids: [],
      proposal: null,
    };
  }
  if (command.action === "clarify") {
    return {
      handled: true,
      action: "clarify",
      response_text:
        composeMemoryList(memories, settingsUrl) +
        "\n\nDime el código, por ejemplo: “Corrige M-12AB34: ahora prefiero respuestas detalladas”." +
        learningNote,
      affected_memory_ids: [],
      proposal: null,
    };
  }

  // Corregir sin version nueva no es una correccion: es una pista. Se pregunta
  // antes de proponer nada, para no guardar un reemplazo vacio.
  if (command.action === "correct" && !command.summary.trim()) {
    return {
      handled: true,
      action: "clarify",
      response_text:
        composeMemoryList(memories, settingsUrl) +
        "\n\n¿Cuál es la versión correcta? Dímela con el código, por ejemplo: “Corrige M-12AB34: ahora prefiero respuestas detalladas”." +
        learningNote,
      affected_memory_ids: [],
      proposal: null,
    };
  }

  const matches = findMemoryMatches(memories, command.query);
  if (matches.length !== 1) {
    return {
      handled: true,
      action: "clarify",
      response_text:
        matches.length === 0
          ? "No encontré un recuerdo activo que coincida. Escribe “qué recuerdas de mí” para verlos con su código." +
            learningNote
          : composeMemoryList(matches, settingsUrl) +
            "\n\nEncontré más de uno. Indícame el código exacto." +
            learningNote,
      affected_memory_ids: [],
      proposal: null,
    };
  }

  const memory = matches[0];
  const proposal = buildMemoryProposal({
    memory,
    action: command.action,
    replacement: command.action === "correct" ? command.summary.trim() : null,
    now: input.now ?? new Date().toISOString(),
  });

  // Un borrador que no valida no puede prometerse con un boton: se pregunta.
  if (!proposal) {
    return {
      handled: true,
      action: "clarify",
      response_text:
        composeMemoryList(matches, settingsUrl) +
        "\n\nNo pude preparar ese cambio. Indícame el código exacto y qué quieres que haga con él." +
        learningNote,
      affected_memory_ids: [],
      proposal: null,
    };
  }

  return {
    handled: true,
    action: command.action,
    response_text: proposal.summary,
    affected_memory_ids: [memory.id],
    proposal,
  };
}

export type MemoryControlExecution =
  | {
      kind: "applied";
      action: "forget" | "correct";
      memory_id: string;
      response_text: string;
    }
  | {
      kind: "cancelled";
      action: "forget" | "correct";
      response_text: string;
    }
  | {
      kind: "failed";
      error_code: string;
      response_text: string;
    };

/**
 * Aplica la orden de memoria que el usuario acaba de confirmar.
 *
 * El recuerdo **no** viaja en el texto del comando: sale del borrador guardado
 * en el estado del propio usuario. Un `mem:<uuid>` inventado no encuentra
 * borrador y no toca nada, y un borrador de otro usuario nunca esta en este
 * working set porque el estado conversacional se lee por `user_id`.
 */
export async function executeMemoryControlProposal(input: {
  client: Client;
  userId: string;
  proposal: MemoryControlProposal;
  traceId: string;
}): Promise<MemoryControlExecution> {
  const proposal = input.proposal;
  try {
    await manageFinancialMemory(input.client, {
      userId: input.userId,
      memoryId: proposal.memory_id,
      action: proposal.action,
      summary: proposal.action === "correct" ? proposal.replacement : undefined,
      reason: `explicit_memory_control_${proposal.action}`,
      // La clave sale de la propuesta y no del turno: pulsar el boton dos
      // veces, o pulsarlo y ademas escribir "si", repite la misma clave.
      idempotencyKey: `memory-control:memory:${proposal.proposal_id}`,
    });
  } catch {
    return {
      kind: "failed",
      error_code: "MEMORY_CONTROL_EXECUTION_FAILED",
      response_text:
        "No pude aplicar ese cambio en tu memoria ahora mismo. No toqué nada: ni el recuerdo ni ningún dato financiero. Vuelve a pedírmelo en un momento.",
    };
  }

  return {
    kind: "applied",
    action: proposal.action,
    memory_id: proposal.memory_id,
    response_text:
      proposal.action === "forget"
        ? `Listo. Olvidé ${proposal.memory_code} y ya no lo usaré en conversaciones. ${PRESERVED_ON_FORGET}`
        : `Listo. Reemplacé ${proposal.memory_code} por tu versión confirmada. No cambié movimientos ni saldos.`,
  };
}

/** Texto de la cancelacion: tiene que negar lo que se iba a hacer. */
export function composeMemoryCancelledText(
  proposal: MemoryControlProposal | null,
): string {
  if (proposal?.action === "correct") {
    return "Listo, no cambié nada. Ese recuerdo sigue como estaba.";
  }
  return "Listo, no olvidé nada. Ese recuerdo sigue como estaba.";
}

/** `AC-RT-13` aplicado a memoria: una confirmacion tardia se responde, no se ejecuta. */
export function composeMemoryLapsedText(): string {
  return "Esa confirmación llegó tarde y no la apliqué, así que no toqué ningún recuerdo. Si todavía quieres hacerlo, dímelo otra vez y te lo vuelvo a preguntar.";
}

/**
 * `40` §7.13: el detalle obligatorio de la tarjeta de `olvidar_aprendizaje` es
 * **qué se conserva**. Lo pone el nucleo con texto fijo, nunca el modelo: una
 * confirmacion destructiva sin esa mitad seria a ciegas.
 */
const PRESERVED_ON_FORGET =
  "No cambia ningún movimiento, saldo ni cuenta: solo dejo de usarlo al conversar, y queda en el historial de Memoria por si lo quieres reactivar.";

function buildMemoryProposal(input: {
  memory: FinancialMemoryItem;
  action: "forget" | "correct";
  replacement: string | null;
  now: string;
}): MemoryControlProposal | null {
  const code = memoryCode(input.memory);
  const visible = visibleSummary(input.memory);
  const summary =
    input.action === "forget"
      ? `¿Olvido ${code} · ${visible}? ${PRESERVED_ON_FORGET}`
      : // `40` §7.13: el detalle de `corregir_aprendizaje` es "lo anterior y lo
        // nuevo". Los dos, siempre, y en este orden.
        `¿Cambio ${code}? Ahora dice “${visible}” y pasaría a decir “${input.replacement ?? ""}”. No cambia ningún movimiento ni saldo.`;

  const parsed = MemoryControlProposalSchema.safeParse({
    proposal_id: randomUUID(),
    action: input.action,
    memory_id: input.memory.id,
    memory_code: code,
    summary,
    confirm_label:
      input.action === "forget" ? "Sí, olvídalo" : "Sí, corrígelo",
    replacement: input.replacement,
    proposed_at: input.now,
  });

  return parsed.success ? parsed.data : null;
}

/**
 * `RUL-MEM-11`: un recuerdo sensible no expone su contenido, ni en la lista ni
 * en la tarjeta de confirmacion. El usuario lo identifica por su codigo.
 */
function visibleSummary(memory: FinancialMemoryItem): string {
  return memory.sensitivity === "sensitive"
    ? "Contexto sensible (contenido oculto aquí)"
    : memory.summary;
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

/**
 * Palabras con las que se senala algo sin nombrarlo. Un "olvidate de eso" no
 * acota nada, asi que "eso" no puede usarse como termino de busqueda: buscarlo
 * no encontraria nada y el turno respondaria "no encontré un recuerdo" cuando
 * lo correcto es mostrar los candidatos y preguntar.
 */
const DEICTIC_TOKENS = new Set([
  "eso",
  "esto",
  "esa",
  "ese",
  "esos",
  "esas",
  "estos",
  "estas",
  "aquello",
  "aquella",
  "aquel",
  "todo",
  "todos",
  "toda",
  "todas",
  "cosa",
  "cosas",
  "recuerdo",
  "recuerdos",
  "mio",
  "mia",
  "mis",
]);

/**
 * Un "olvidate de eso" sin mas no puede borrar el recuerdo que no era: sin
 * consulta que acote, la unica respuesta correcta es devolver todos los
 * candidatos para que el turno pregunte con los codigos.
 */
function findMemoryMatches(
  memories: FinancialMemoryItem[],
  query: string,
): FinancialMemoryItem[] {
  const normalized = normalize(query);
  if (!normalized) return memories;
  const byCode = memories.filter(
    (memory) => normalize(memoryCode(memory)) === normalized,
  );
  if (byCode.length > 0) return byCode;
  const tokens = normalized
    .split(" ")
    .filter((token) => token.length > 2 && !DEICTIC_TOKENS.has(token));
  if (tokens.length === 0) return memories;
  const matched = memories.filter((memory) => {
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
  return matched;
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
    proposal: null,
  };
}
