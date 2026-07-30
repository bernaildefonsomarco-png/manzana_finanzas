import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;
export type MovementTemplate = Database["public"]["Tables"]["movement_templates"]["Row"];

export class MovementTemplateRepositoryError extends Error {
  constructor(
    readonly code: "TEMPLATE_NOT_FOUND" | "TEMPLATE_ALREADY_EXISTS" | "TEMPLATE_REPOSITORY_ERROR",
    message: string,
  ) {
    super(message);
    this.name = "MovementTemplateRepositoryError";
  }
}

/** 29 S4.2: siempre ordenadas por frecuencia de uso. */
export async function listMovementTemplates(
  client: Client,
  userId: string,
): Promise<MovementTemplate[]> {
  const { data, error } = await client
    .from("movement_templates")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("use_count", { ascending: false })
    .order("last_used_at", { ascending: false, nullsFirst: false });
  if (error) throw repositoryError("leer las plantillas", error);
  return data ?? [];
}

export async function getMovementTemplateById(
  client: Client,
  userId: string,
  templateId: string,
): Promise<MovementTemplate | null> {
  const { data, error } = await client
    .from("movement_templates")
    .select("*")
    .eq("user_id", userId)
    .eq("id", templateId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw repositoryError("leer la plantilla", error);
  return data ?? null;
}

export type CreateMovementTemplateInput = {
  userId: string;
  name: string;
  type: Database["public"]["Enums"]["movement_type"];
  amount: number | null;
  merchant: string | null;
  description: string | null;
  categoryId: string | null;
  subcategoryId: string | null;
  accountId: string | null;
  boxId: string | null;
  origin?: "usuario" | "sugerida";
};

export async function createMovementTemplate(
  client: Client,
  input: CreateMovementTemplateInput,
): Promise<MovementTemplate> {
  const { data, error } = await client
    .from("movement_templates")
    .insert({
      user_id: input.userId,
      name: input.name,
      type: input.type,
      amount: input.amount,
      merchant: input.merchant,
      description: input.description,
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId,
      account_id: input.accountId,
      box_id: input.boxId,
      origin: input.origin ?? "usuario",
    })
    .select("*")
    .single();
  if (error || !data) {
    if (isUniqueViolation(error)) {
      throw new MovementTemplateRepositoryError(
        "TEMPLATE_ALREADY_EXISTS",
        "Ya tienes una plantilla con ese nombre.",
      );
    }
    throw repositoryError("crear la plantilla", error);
  }
  return data;
}

function isUniqueViolation(error: unknown): boolean {
  return Boolean(
    error && typeof error === "object" && "code" in error && (error as { code?: unknown }).code === "23505",
  );
}

export async function updateMovementTemplate(
  client: Client,
  userId: string,
  templateId: string,
  patch: Partial<Omit<CreateMovementTemplateInput, "userId" | "origin">>,
): Promise<MovementTemplate> {
  const { data, error } = await client
    .from("movement_templates")
    .update({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.type !== undefined ? { type: patch.type } : {}),
      ...(patch.amount !== undefined ? { amount: patch.amount } : {}),
      ...(patch.merchant !== undefined ? { merchant: patch.merchant } : {}),
      ...(patch.description !== undefined ? { description: patch.description } : {}),
      ...(patch.categoryId !== undefined ? { category_id: patch.categoryId } : {}),
      ...(patch.subcategoryId !== undefined ? { subcategory_id: patch.subcategoryId } : {}),
      ...(patch.accountId !== undefined ? { account_id: patch.accountId } : {}),
      ...(patch.boxId !== undefined ? { box_id: patch.boxId } : {}),
    })
    .eq("user_id", userId)
    .eq("id", templateId)
    .is("deleted_at", null)
    .select("*")
    .single();
  if (error || !data) {
    throw new MovementTemplateRepositoryError("TEMPLATE_NOT_FOUND", "No encontre esa plantilla.");
  }
  return data;
}

/** ACT-CAP-07: archivar, no borrar (se puede restaurar recreandola). */
export async function archiveMovementTemplate(
  client: Client,
  userId: string,
  templateId: string,
): Promise<void> {
  const { data, error } = await client
    .from("movement_templates")
    .update({ deleted_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("id", templateId)
    .is("deleted_at", null)
    .select("id")
    .maybeSingle();
  if (error) throw repositoryError("archivar la plantilla", error);
  if (!data) {
    throw new MovementTemplateRepositoryError("TEMPLATE_NOT_FOUND", "No encontre esa plantilla.");
  }
}

/** ACT-CAP-05: usar una plantilla bumpea uso, sin escribir el movimiento. */
export async function bumpMovementTemplateUse(
  client: Client,
  userId: string,
  templateId: string,
): Promise<MovementTemplate> {
  const existing = await getMovementTemplateById(client, userId, templateId);
  if (!existing) {
    throw new MovementTemplateRepositoryError("TEMPLATE_NOT_FOUND", "No encontre esa plantilla.");
  }
  const { data, error } = await client
    .from("movement_templates")
    .update({
      use_count: existing.use_count + 1,
      last_used_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", templateId)
    .select("*")
    .single();
  if (error || !data) throw repositoryError("usar la plantilla", error);
  return data;
}

function repositoryError(operation: string, error: unknown): MovementTemplateRepositoryError {
  logger.error("movement_templates.repository_failed", { operation, error });
  return new MovementTemplateRepositoryError(
    "TEMPLATE_REPOSITORY_ERROR",
    `No se pudo ${operation}`,
  );
}
