import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, AccountType, Box, BoxType } from "@/shared/types/domain";
import type { Database, Json } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

/** Retorna las cuentas activas del usuario. */
export async function getActiveAccounts(
  client: Client,
  userId: string
): Promise<Account[]> {
  const { data, error } = await client
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) {
    logger.error("accounts.get_active_failed", { error, user_id: userId });
    throw error;
  }

  return (data ?? []) as Account[];
}

/** Retorna una cuenta por ID (solo si pertenece al usuario). */
export async function getAccountById(
  client: Client,
  userId: string,
  accountId: string
): Promise<Account | null> {
  const { data, error } = await client
    .from("accounts")
    .select("*")
    .eq("id", accountId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logger.error("accounts.get_by_id_failed", {
      error,
      user_id: userId,
      account_id: accountId,
    });
    throw error;
  }

  return data as Account;
}

/** Crea una nueva cuenta para el usuario. */
export async function createAccount(
  client: Client,
  params: {
    userId: string;
    name: string;
    type: AccountType;
    institution?: string;
    currency?: string;
    initialBalance?: number;
    isDefault?: boolean;
    color?: string;
    icon?: string;
    metadata?: Json;
  }
): Promise<Account> {
  const initialBalance = params.initialBalance ?? 0;

  const { data, error } = await client
    .from("accounts")
    .insert({
      user_id: params.userId,
      name: params.name,
      type: params.type,
      institution: params.institution ?? null,
      currency: params.currency ?? "PEN",
      initial_balance: initialBalance,
      current_balance: initialBalance,
      is_default: params.isDefault ?? false,
      color: params.color ?? null,
      icon: params.icon ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    logger.error("accounts.create_failed", { error, user_id: params.userId });
    throw error;
  }

  return data as Account;
}

/** Actualiza los metadatos editables de una cuenta (no el saldo). */
export async function updateAccountMeta(
  client: Client,
  userId: string,
  accountId: string,
  updates: Partial<Pick<Account, "name" | "institution" | "color" | "icon" | "is_default">>
): Promise<Account> {
  const { data, error } = await client
    .from("accounts")
    .update(updates)
    .eq("id", accountId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    logger.error("accounts.update_meta_failed", {
      error,
      user_id: userId,
      account_id: accountId,
    });
    throw error;
  }

  return data as Account;
}

/**
 * Vincula una pista bancaria enmascarada a una cuenta existente.
 *
 * Esta mutacion no toca saldos y solo debe llamarse despues de una asociacion
 * explicita del usuario. Usa compare-and-swap para no pisar metadata concurrente.
 */
export async function linkEmailAccountHint(
  client: Client,
  params: {
    userId: string;
    accountId: string;
    hint: string;
    traceId: string;
  },
): Promise<{ account: Account; idempotent: boolean }> {
  const hint = cleanEmailAccountHint(params.hint);
  if (!hint || hint.replace(/\D/g, "").length < 4) {
    throw new Error("La pista bancaria debe contener al menos cuatro digitos.");
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const account = await getAccountById(
      client,
      params.userId,
      params.accountId,
    );
    if (!account) {
      throw new Error("La cuenta seleccionada ya no existe.");
    }
    const metadata = toMetadataRecord(account.metadata);
    const existingHints = readMetadataStrings(metadata.email_account_hints);
    const normalizedHint = normalizeComparable(hint);
    if (
      existingHints.some(
        (existing) => normalizeComparable(existing) === normalizedHint,
      )
    ) {
      return { account, idempotent: true };
    }

    const existingAudit = Array.isArray(metadata.email_account_hint_links)
      ? metadata.email_account_hint_links.filter(
          (value): value is Record<string, unknown> =>
            Boolean(value) && typeof value === "object" && !Array.isArray(value),
        )
      : [];
    const nextMetadata = {
      ...metadata,
      email_account_hints: [...existingHints, hint].slice(-20),
      email_account_hint_links: [
        ...existingAudit,
        {
          hint,
          source: "whatsapp_user_explicit",
          linked_at: new Date().toISOString(),
          trace_id: params.traceId,
        },
      ].slice(-20),
    };
    const { data, error } = await client
      .from("accounts")
      .update({ metadata: nextMetadata as Json })
      .eq("id", params.accountId)
      .eq("user_id", params.userId)
      .eq("updated_at", account.updated_at)
      .is("deleted_at", null)
      .select("*")
      .maybeSingle();

    if (error) {
      logger.error("accounts.link_email_hint_failed", {
        error,
        user_id: params.userId,
        account_id: params.accountId,
      });
      throw error;
    }
    if (data) {
      return { account: data as Account, idempotent: false };
    }
  }

  throw new Error(
    "La cuenta cambio mientras se vinculaba la pista bancaria. Intenta otra vez.",
  );
}

/** Soft-delete de una cuenta. El saldo debe ser 0 o transferido antes. */
export async function softDeleteAccount(
  client: Client,
  userId: string,
  accountId: string
): Promise<void> {
  const { error } = await client
    .from("accounts")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", accountId)
    .eq("user_id", userId);

  if (error) {
    logger.error("accounts.soft_delete_failed", {
      error,
      user_id: userId,
      account_id: accountId,
    });
    throw error;
  }
}

// Boxes -----------------------------------------------------------------------

/** Retorna las cajas activas de una cuenta. */
export async function getActiveBoxes(
  client: Client,
  userId: string,
  accountId?: string
): Promise<Box[]> {
  let query = client
    .from("boxes")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });

  if (accountId) {
    query = query.eq("account_id", accountId);
  }

  const { data, error } = await query;

  if (error) {
    logger.error("accounts.get_boxes_failed", { error, user_id: userId });
    throw error;
  }

  return (data ?? []) as Box[];
}

/** Retorna una caja por ID (solo si pertenece al usuario). */
export async function getBoxById(
  client: Client,
  userId: string,
  boxId: string
): Promise<Box | null> {
  const { data, error } = await client
    .from("boxes")
    .select("*")
    .eq("id", boxId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    logger.error("accounts.get_box_by_id_failed", {
      error,
      user_id: userId,
      box_id: boxId,
    });
    throw error;
  }

  return data as Box;
}

/** Crea una caja con saldo 0. Si hay asignacion inicial, debe pasar por Core. */
export async function createBox(
  client: Client,
  params: {
    userId: string;
    accountId: string;
    name: string;
    type: BoxType;
    targetAmount?: number | null;
    targetDate?: string | null;
    metadata?: Json;
  }
): Promise<Box> {
  const { data, error } = await client
    .from("boxes")
    .insert({
      user_id: params.userId,
      account_id: params.accountId,
      name: params.name,
      type: params.type,
      current_balance: 0,
      target_amount: params.targetAmount ?? null,
      target_date: params.targetDate ?? null,
      metadata: params.metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    logger.error("accounts.create_box_failed", { error, user_id: params.userId });
    throw error;
  }

  return data as Box;
}

/** Actualiza los campos editables de una caja (no el saldo). */
export async function updateBoxMeta(
  client: Client,
  userId: string,
  boxId: string,
  updates: Partial<Pick<Box, "name" | "type" | "target_amount" | "target_date">>
): Promise<Box> {
  const { data, error } = await client
    .from("boxes")
    .update(updates)
    .eq("id", boxId)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .select()
    .single();

  if (error) {
    logger.error("accounts.update_box_meta_failed", {
      error,
      user_id: userId,
      box_id: boxId,
    });
    throw error;
  }

  return data as Box;
}

/** Soft-delete de una caja. Se usa tambien como rollback compensatorio controlado. */
export async function softDeleteBox(
  client: Client,
  userId: string,
  boxId: string
): Promise<void> {
  const { error } = await client
    .from("boxes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", boxId)
    .eq("user_id", userId);

  if (error) {
    logger.error("accounts.soft_delete_box_failed", {
      error,
      user_id: userId,
      box_id: boxId,
    });
    throw error;
  }
}

/**
 * Calcula el dinero libre en una cuenta.
 * libre = current_balance - suma de cajas activas.
 */
export async function getFreeBalanceForAccount(
  client: Client,
  userId: string,
  accountId: string
): Promise<number> {
  const [account, boxes] = await Promise.all([
    getAccountById(client, userId, accountId),
    getActiveBoxes(client, userId, accountId),
  ]);

  if (!account) return 0;

  const boxesTotal = boxes.reduce((sum, b) => sum + b.current_balance, 0);
  return account.current_balance - boxesTotal;
}

function cleanEmailAccountHint(value: string): string | null {
  const cleaned = value.replace(/\s+/g, " ").trim().slice(0, 120);
  return cleaned || null;
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function toMetadataRecord(
  value: Record<string, unknown> | undefined,
): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
}

function readMetadataStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [
    ...new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}
