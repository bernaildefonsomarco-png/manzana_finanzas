import type {
  AssistantActionStatus,
  AssistantMessage,
  AssistantMessageRole,
  AssistantThread,
  ThreadStatus,
} from "@/data/repositories/assistant.repository";
import type { Block } from "@/core/channel/types";
import type { DegradationGrade } from "@/core/degradation/grade";

export type { AssistantActionStatus, AssistantMessage, AssistantMessageRole, AssistantThread, ThreadStatus };

/** El `content` de un mensaje de asistente es siempre `Block[]` (`21` S5); la fila lo tipa `unknown[]` porque la BD no exige el shape en columnas. */
export type AssistantMessageWithBlocks = Omit<AssistantMessage, "content"> & {
  content: Block[];
};

export type AssistantHealth = {
  grado: DegradationGrade;
  puede_proponer_acciones: boolean;
  debe_ofrecer_via_manual: boolean;
};
