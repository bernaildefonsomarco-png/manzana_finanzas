import { z } from "zod";
import type {
  EmailAdapter,
  GmailHistoryPage,
  GmailMessage,
  GmailMessageListPage,
  GmailMessagePart,
  GmailProfile,
  GmailWatch,
} from "./contracts";
import { GMAIL_READONLY_SCOPE } from "./contracts";
import type { GmailConfiguration } from "./config";
import { getGmailConfiguration } from "./config";

type FetchLike = typeof fetch;

const TokenResponseSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1).optional(),
  expires_in: z.number().int().positive().optional(),
  scope: z.string().optional(),
});

const ProfileSchema = z.object({
  emailAddress: z.string().email(),
  historyId: z.string().regex(/^\d+$/),
});

const WatchSchema = z.object({
  historyId: z.string().regex(/^\d+$/),
  expiration: z.string().regex(/^\d+$/),
});

const HistorySchema = z.object({
  history: z
    .array(
      z.object({
        messagesAdded: z
          .array(
            z.object({
              message: z.object({
                id: z.string().min(1),
                threadId: z.string().min(1).optional(),
              }),
            }),
          )
          .optional(),
      }),
    )
    .optional(),
  historyId: z.string().regex(/^\d+$/),
  nextPageToken: z.string().min(1).optional(),
});

const MessageListSchema = z.object({
  messages: z
    .array(
      z.object({
        id: z.string().min(1),
        threadId: z.string().min(1).optional(),
      }),
    )
    .optional(),
  nextPageToken: z.string().min(1).optional(),
});

export class GmailClientError extends Error {
  constructor(
    readonly code:
      | "GMAIL_CONFIGURATION_MISSING"
      | "GMAIL_OAUTH_FAILED"
      | "GMAIL_API_FAILED"
      | "GMAIL_HISTORY_EXPIRED"
      | "GMAIL_RESPONSE_INVALID",
    message: string,
    readonly status: number | null = null,
  ) {
    super(message);
    this.name = "GmailClientError";
  }
}

export class GmailEmailAdapter implements EmailAdapter {
  constructor(
    private readonly configuration: GmailConfiguration = getGmailConfiguration(),
    private readonly fetcher: FetchLike = fetch,
  ) {}

  buildAuthorizationUrl(input: {
    state: string;
    loginHint?: string | null;
  }): string {
    this.assertOAuthConfiguration();
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", this.configuration.clientId);
    url.searchParams.set("redirect_uri", this.configuration.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", GMAIL_READONLY_SCOPE);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("include_granted_scopes", "true");
    url.searchParams.set("prompt", "consent select_account");
    url.searchParams.set("state", input.state);
    if (input.loginHint?.trim()) {
      url.searchParams.set("login_hint", input.loginHint.trim());
    }
    return url.toString();
  }

  async exchangeAuthorizationCode(code: string) {
    this.assertOAuthConfiguration();
    const response = await this.fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: this.configuration.clientId,
        client_secret: this.configuration.clientSecret,
        redirect_uri: this.configuration.redirectUri,
        grant_type: "authorization_code",
      }),
      cache: "no-store",
    });
    const payload = await readJson(response, "GMAIL_OAUTH_FAILED");
    const parsed = parseOrThrow(TokenResponseSchema, payload);
    return {
      accessToken: parsed.access_token,
      refreshToken: parsed.refresh_token ?? null,
      expiresIn: parsed.expires_in ?? null,
      scopes: (parsed.scope ?? GMAIL_READONLY_SCOPE).split(/\s+/).filter(Boolean),
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    this.assertOAuthConfiguration();
    const response = await this.fetcher("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.configuration.clientId,
        client_secret: this.configuration.clientSecret,
        grant_type: "refresh_token",
      }),
      cache: "no-store",
    });
    const payload = await readJson(response, "GMAIL_OAUTH_FAILED");
    return parseOrThrow(TokenResponseSchema, payload).access_token;
  }

  async getProfile(accessToken: string): Promise<GmailProfile> {
    const payload = await this.gmailJson(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      accessToken,
    );
    return parseOrThrow(ProfileSchema, payload);
  }

  async startWatch(accessToken: string): Promise<GmailWatch> {
    if (!this.configuration.topicName) {
      throw new GmailClientError(
        "GMAIL_CONFIGURATION_MISSING",
        "GMAIL_PUBSUB_TOPIC no configurado",
      );
    }
    const payload = await this.gmailJson(
      "https://gmail.googleapis.com/gmail/v1/users/me/watch",
      accessToken,
      {
        method: "POST",
        body: JSON.stringify({
          topicName: this.configuration.topicName,
          labelIds: ["INBOX"],
          labelFilterBehavior: "INCLUDE",
        }),
      },
    );
    return parseOrThrow(WatchSchema, payload);
  }

  async stopWatch(accessToken: string): Promise<void> {
    await this.gmailJson(
      "https://gmail.googleapis.com/gmail/v1/users/me/stop",
      accessToken,
      { method: "POST", body: "{}" },
    );
  }

  async revokeToken(token: string): Promise<void> {
    const response = await this.fetcher("https://oauth2.googleapis.com/revoke", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ token }),
      cache: "no-store",
    });
    if (!response.ok) {
      throw new GmailClientError(
        "GMAIL_OAUTH_FAILED",
        "Google no pudo revocar el token",
        response.status,
      );
    }
  }

  async listHistory(input: {
    accessToken: string;
    startHistoryId: string;
    pageToken?: string | null;
  }): Promise<GmailHistoryPage> {
    const url = new URL(
      "https://gmail.googleapis.com/gmail/v1/users/me/history",
    );
    url.searchParams.set("startHistoryId", input.startHistoryId);
    url.searchParams.set("historyTypes", "messageAdded");
    url.searchParams.set("maxResults", "100");
    if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);

    const response = await this.fetcher(url, {
      headers: authorizationHeaders(input.accessToken),
      cache: "no-store",
    });
    if (response.status === 404) {
      throw new GmailClientError(
        "GMAIL_HISTORY_EXPIRED",
        "El checkpoint Gmail ya no esta disponible",
        404,
      );
    }
    const payload = await readJson(response, "GMAIL_API_FAILED");
    const parsed = parseOrThrow(HistorySchema, payload);
    const seen = new Set<string>();
    const messageIds = (parsed.history ?? []).flatMap((entry) =>
      (entry.messagesAdded ?? []).flatMap(({ message }) => {
        if (seen.has(message.id)) return [];
        seen.add(message.id);
        return [{ id: message.id, threadId: message.threadId ?? null }];
      }),
    );

    return {
      messageIds,
      historyId: parsed.historyId,
      nextPageToken: parsed.nextPageToken ?? null,
    };
  }

  async getMessageMetadata(
    accessToken: string,
    messageId: string,
  ): Promise<GmailMessage> {
    const url = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
    );
    url.searchParams.set("format", "metadata");
    for (const header of [
      "From",
      "Subject",
      "Date",
      "Authentication-Results",
    ]) {
      url.searchParams.append("metadataHeaders", header);
    }
    return parseGmailMessage(await this.gmailJson(url, accessToken));
  }

  async listRecentMessages(input: {
    accessToken: string;
    newerThanDays: number;
    pageToken?: string | null;
  }): Promise<GmailMessageListPage> {
    const days = Math.min(Math.max(Math.trunc(input.newerThanDays), 1), 30);
    const url = new URL(
      "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    );
    url.searchParams.set("q", `newer_than:${days}d`);
    url.searchParams.set("labelIds", "INBOX");
    url.searchParams.set("maxResults", "100");
    url.searchParams.set("includeSpamTrash", "false");
    if (input.pageToken) url.searchParams.set("pageToken", input.pageToken);
    const parsed = parseOrThrow(
      MessageListSchema,
      await this.gmailJson(url, input.accessToken),
    );
    return {
      messageIds: (parsed.messages ?? []).map((message) => ({
        id: message.id,
        threadId: message.threadId ?? null,
      })),
      nextPageToken: parsed.nextPageToken ?? null,
    };
  }

  async getMessageContent(
    accessToken: string,
    messageId: string,
  ): Promise<GmailMessage> {
    const url = new URL(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${encodeURIComponent(messageId)}`,
    );
    url.searchParams.set("format", "full");
    return parseGmailMessage(await this.gmailJson(url, accessToken));
  }

  private async gmailJson(
    url: string | URL,
    accessToken: string,
    init: RequestInit = {},
  ): Promise<unknown> {
    const response = await this.fetcher(url, {
      ...init,
      headers: {
        ...authorizationHeaders(accessToken),
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers ?? {}),
      },
      cache: "no-store",
    });
    return readJson(response, "GMAIL_API_FAILED");
  }

  private assertOAuthConfiguration() {
    if (
      !this.configuration.clientId ||
      !this.configuration.clientSecret ||
      !this.configuration.redirectUri
    ) {
      throw new GmailClientError(
        "GMAIL_CONFIGURATION_MISSING",
        "Credenciales OAuth Gmail no configuradas",
      );
    }
  }
}

function authorizationHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}` };
}

async function readJson(
  response: Response,
  code: "GMAIL_OAUTH_FAILED" | "GMAIL_API_FAILED",
): Promise<unknown> {
  let payload: unknown = {};
  try {
    payload = await response.json();
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new GmailClientError(
      code,
      code === "GMAIL_OAUTH_FAILED"
        ? "Google rechazo la autorizacion Gmail"
        : "Gmail API rechazo la operacion",
      response.status,
    );
  }
  return payload;
}

function parseOrThrow<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    throw new GmailClientError(
      "GMAIL_RESPONSE_INVALID",
      "Google devolvio una respuesta Gmail invalida",
    );
  }
  return parsed.data;
}

function parseGmailMessage(payload: unknown): GmailMessage {
  if (!isRecord(payload) || typeof payload.id !== "string") {
    throw new GmailClientError(
      "GMAIL_RESPONSE_INVALID",
      "Gmail devolvio un mensaje invalido",
    );
  }
  return {
    id: payload.id,
    threadId: typeof payload.threadId === "string" ? payload.threadId : null,
    internalDate:
      typeof payload.internalDate === "string" ? payload.internalDate : null,
    snippet: typeof payload.snippet === "string" ? payload.snippet : null,
    payload: parseMessagePayload(payload.payload),
  };
}

function parseMessagePayload(value: unknown): GmailMessage["payload"] {
  if (!isRecord(value)) return null;
  return {
    mimeType: typeof value.mimeType === "string" ? value.mimeType : null,
    headers: Array.isArray(value.headers)
      ? value.headers.flatMap((header) =>
          isRecord(header) &&
          typeof header.name === "string" &&
          typeof header.value === "string"
            ? [{ name: header.name, value: header.value }]
            : [],
        )
      : [],
    body: parseBody(value.body),
    parts: Array.isArray(value.parts)
      ? value.parts.flatMap((part) => {
          const parsed = parsePart(part);
          return parsed ? [parsed] : [];
        })
      : [],
  };
}

function parsePart(value: unknown): GmailMessagePart | null {
  if (!isRecord(value)) return null;
  return {
    mimeType: typeof value.mimeType === "string" ? value.mimeType : null,
    body: parseBody(value.body),
    parts: Array.isArray(value.parts)
      ? value.parts.flatMap((part) => {
          const parsed = parsePart(part);
          return parsed ? [parsed] : [];
        })
      : [],
  };
}

function parseBody(value: unknown): { data: string | null } | null {
  if (!isRecord(value)) return null;
  return { data: typeof value.data === "string" ? value.data : null };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}
