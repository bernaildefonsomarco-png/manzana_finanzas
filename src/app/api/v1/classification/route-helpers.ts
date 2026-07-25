import { randomUUID } from "node:crypto";
import type { ClassificationCommand } from "@/core/classification";

type CommandPayload = ClassificationCommand["payload"];

export function classificationCommand<TType extends ClassificationCommand["type"]>(
  input: {
    type: TType;
    userId: string;
    traceId: string;
    source: string;
    payload: Extract<ClassificationCommand, { type: TType }>["payload"];
  },
): Extract<ClassificationCommand, { type: TType }> {
  return {
    type: input.type,
    command_id: randomUUID(),
    user_id: input.userId,
    actor: { type: "user", id: input.userId },
    source: input.source,
    trace_id: input.traceId,
    payload: input.payload as CommandPayload,
  } as Extract<ClassificationCommand, { type: TType }>;
}

export function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues),
  );
}

export function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "23505";
}

export function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: unknown }).code;
  return code === "PGRST116";
}

