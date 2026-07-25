import { z } from "zod";

/** UUID v4 */
export const UuidSchema = z.string().uuid();
export type Uuid = z.infer<typeof UuidSchema>;

/** Fecha ISO 8601 (YYYY-MM-DD) */
export const DateStringSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (esperado: YYYY-MM-DD)");

export type DateString = z.infer<typeof DateStringSchema>;

/** Timestamp ISO 8601 */
export const TimestampSchema = z.string().datetime({ offset: true });
export type Timestamp = z.infer<typeof TimestampSchema>;

/** Nota de texto libre — máximo 500 caracteres */
export const NoteSchema = z.string().max(500).optional();
export type Note = z.infer<typeof NoteSchema>;

/** Ambiente de la aplicación */
export const AppEnvSchema = z.enum(["local", "preview", "staging", "production"]);
export type AppEnv = z.infer<typeof AppEnvSchema>;

/** Contexto de usuario autenticado — adjunto en requests del backend */
export const AuthContextSchema = z.object({
  userId: UuidSchema,
  email: z.string().email().optional(),
});

export type AuthContext = z.infer<typeof AuthContextSchema>;
