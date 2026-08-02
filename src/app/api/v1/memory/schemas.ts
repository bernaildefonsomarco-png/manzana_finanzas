import { z } from "zod";

export const MemoryScopeSchema = z.enum([
  "classification",
  "profile",
  "preference",
]);

export const CorrectMemorySchema = z
  .object({
    scope: MemoryScopeSchema,
    statement: z.string().trim().min(3).max(500).optional(),
    value: z.unknown().optional(),
    reason: z.string().trim().min(2).max(300).optional(),
  })
  .strict()
  .superRefine((input, context) => {
    if (input.scope === "preference" && input.value === undefined) {
      context.addIssue({ code: "custom", path: ["value"], message: "Falta el valor corregido." });
    }
    if (input.scope !== "preference" && !input.statement) {
      context.addIssue({ code: "custom", path: ["statement"], message: "Falta la corrección." });
    }
  });

export const ScopedMemorySchema = z.object({ scope: MemoryScopeSchema }).strict();

export const ForgetMemorySchema = z
  .object({
    scope: MemoryScopeSchema,
    reason: z.string().trim().min(2).max(300).optional(),
  })
  .strict();
