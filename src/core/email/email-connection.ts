import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GmailEmailAdapter,
  type EmailAdapter,
} from "@/adapters/email";
import {
  getGmailConfiguration,
  getGmailReadiness,
  type GmailConfiguration,
} from "@/adapters/email/config";
import {
  decryptEmailToken,
  encryptEmailToken,
} from "@/adapters/email/token-crypto";
import {
  commitGmailConnection,
  disconnectGmailConnection,
  getEmailConnectionById,
  listEmailConnectionsForUser,
  listEmailConnectionsDueForWatchRenewal,
  updateEmailConnectionState,
  type EmailConnection,
} from "@/data/repositories/email.repository";
import type { Database } from "@/data/supabase/types";
import { logger } from "@/shared/telemetry/logger";

type Client = SupabaseClient<Database>;

export class EmailConnectionError extends Error {
  constructor(
    readonly code:
      | "GMAIL_NOT_CONFIGURED"
      | "GMAIL_REFRESH_TOKEN_REQUIRED"
      | "GMAIL_SCOPE_INVALID"
      | "GMAIL_CONNECTION_NOT_FOUND",
    message: string,
  ) {
    super(message);
    this.name = "EmailConnectionError";
  }
}

export async function completeGmailOAuth(input: {
  client: Client;
  userId: string;
  code: string;
  traceId: string;
  adapter?: EmailAdapter;
  configuration?: GmailConfiguration;
}): Promise<EmailConnection> {
  const configuration = input.configuration ?? getGmailConfiguration();
  assertConfigured(configuration);
  const adapter = input.adapter ?? new GmailEmailAdapter(configuration);
  const tokens = await adapter.exchangeAuthorizationCode(input.code);
  if (!tokens.refreshToken) {
    throw new EmailConnectionError(
      "GMAIL_REFRESH_TOKEN_REQUIRED",
      "Google no entrego un refresh token; se requiere consentimiento nuevo",
    );
  }
  if (
    !tokens.scopes.includes("https://www.googleapis.com/auth/gmail.readonly")
  ) {
    throw new EmailConnectionError(
      "GMAIL_SCOPE_INVALID",
      "La autorizacion no contiene el scope Gmail de solo lectura",
    );
  }

  const profile = await adapter.getProfile(tokens.accessToken);
  const watch = await adapter.startWatch(tokens.accessToken);
  const watchExpiration = millisecondsToIso(watch.expiration);
  const encryptedRefreshToken = encryptEmailToken(
    tokens.refreshToken,
    configuration.tokenEncryptionKey,
  );

  return commitGmailConnection(input.client, {
    userId: input.userId,
    emailAddress: profile.emailAddress.toLowerCase(),
    scopes: tokens.scopes,
    encryptedRefreshToken,
    historyId: watch.historyId,
    watchExpiration,
    traceId: input.traceId,
  });
}

export async function disconnectGmail(input: {
  client: Client;
  userId: string;
  traceId: string;
  connectionId?: string | null;
  adapter?: EmailAdapter;
  configuration?: GmailConfiguration;
}) {
  const configuration = input.configuration ?? getGmailConfiguration();
  const connections = input.connectionId
    ? [await getEmailConnectionById(input.client, input.connectionId)].filter(
        (connection): connection is EmailConnection =>
          Boolean(connection && connection.user_id === input.userId),
      )
    : await listEmailConnectionsForUser(input.client, input.userId);
  if (input.connectionId && connections.length === 0) {
    throw new EmailConnectionError(
      "GMAIL_CONNECTION_NOT_FOUND",
      "La conexion Gmail no pertenece al usuario",
    );
  }
  if (getGmailReadiness(configuration).configured) {
    const adapter = input.adapter ?? new GmailEmailAdapter(configuration);
    for (const existing of connections) {
      if (!existing.encrypted_refresh_token) continue;
      try {
        const refreshToken = decryptEmailToken(
          existing.encrypted_refresh_token,
          configuration.tokenEncryptionKey,
        );
        const accessToken = await adapter.refreshAccessToken(refreshToken);
        await adapter.stopWatch(accessToken);
        await adapter.revokeToken(refreshToken);
      } catch (error) {
        logger.warn("email.disconnect_remote_cleanup_failed", {
          error,
          user_id: input.userId,
          connection_id: existing.id,
        });
      }
    }
  }

  return disconnectGmailConnection(
    input.client,
    input.userId,
    input.traceId,
    input.connectionId,
  );
}

export async function renewDueGmailWatches(input: {
  client: Client;
  now?: Date;
  limit?: number;
  adapter?: EmailAdapter;
  configuration?: GmailConfiguration;
}) {
  const configuration = input.configuration ?? getGmailConfiguration();
  assertConfigured(configuration);
  const adapter = input.adapter ?? new GmailEmailAdapter(configuration);
  const now = input.now ?? new Date();
  const renewBefore = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const connections = await listEmailConnectionsDueForWatchRenewal(
    input.client,
    renewBefore.toISOString(),
    input.limit ?? 50,
  );
  const result = { evaluated: connections.length, renewed: 0, failed: 0 };

  for (const connection of connections) {
    try {
      if (!connection.encrypted_refresh_token) {
        throw new EmailConnectionError(
          "GMAIL_CONNECTION_NOT_FOUND",
          "La conexion Gmail no tiene refresh token",
        );
      }
      const refreshToken = decryptEmailToken(
        connection.encrypted_refresh_token,
        configuration.tokenEncryptionKey,
      );
      const accessToken = await adapter.refreshAccessToken(refreshToken);
      const watch = await adapter.startWatch(accessToken);
      await updateEmailConnectionState(input.client, {
        connectionId: connection.id,
        status: "watch_active",
        watchStatus: "active",
        watchExpiration: millisecondsToIso(watch.expiration),
        historyId: watch.historyId,
        renewedAt: now.toISOString(),
        metadata: { watch_last_error: null },
      });
      result.renewed += 1;
    } catch (error) {
      result.failed += 1;
      await updateEmailConnectionState(input.client, {
        connectionId: connection.id,
        status: "needs_reconnect",
        watchStatus: "error",
        metadata: { watch_last_error: safeErrorCode(error) },
      });
      logger.warn("email.watch_renewal_failed", {
        error,
        connection_id: connection.id,
      });
    }
  }
  return result;
}

function assertConfigured(configuration: GmailConfiguration) {
  const readiness = getGmailReadiness(configuration);
  if (!readiness.configured) {
    throw new EmailConnectionError(
      "GMAIL_NOT_CONFIGURED",
      `Gmail no esta configurado: ${readiness.missing.join(", ")}`,
    );
  }
}

function millisecondsToIso(value: string): string {
  const milliseconds = Number(value);
  if (!Number.isFinite(milliseconds) || milliseconds <= Date.now()) {
    throw new EmailConnectionError(
      "GMAIL_CONNECTION_NOT_FOUND",
      "Google devolvio una expiracion de watch invalida",
    );
  }
  return new Date(milliseconds).toISOString();
}

function safeErrorCode(error: unknown): string {
  if (error && typeof error === "object" && "code" in error) {
    return String(error.code).slice(0, 80);
  }
  return "unknown_error";
}
