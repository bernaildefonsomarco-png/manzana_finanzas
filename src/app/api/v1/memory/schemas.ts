import { z } from "zod";

export const ManageLearningSchema = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("memory"),
    target_id: z.string().uuid(),
    action: z.enum(["forget", "correct", "suspend", "confirm"]),
    summary: z.string().trim().min(3).max(500).optional(),
    reason: z.string().trim().min(2).max(300).optional(),
  }).superRefine((value, context) => {
    if (value.action === "correct" && !value.summary) {
      context.addIssue({
        code: "custom",
        path: ["summary"],
        message: "La correccion necesita un resumen.",
      });
    }
  }),
  z.object({
    target: z.literal("candidate"),
    target_id: z.string().uuid(),
    action: z.enum(["confirm", "reject"]),
    reason: z.string().trim().min(2).max(300).optional(),
  }),
]);

export const LearningPreferencesSchema = z.object({
  enabled: z.boolean(),
  allow_narrative_memory: z.boolean(),
  allow_sensitive_memory: z.boolean(),
});
