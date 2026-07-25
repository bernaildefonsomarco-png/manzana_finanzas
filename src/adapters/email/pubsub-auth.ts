import { z } from "zod";
import type { GmailConfiguration } from "./config";
import { getGmailConfiguration } from "./config";

type FetchLike = typeof fetch;

const TokenInfoSchema = z.object({
  aud: z.string().min(1),
  email: z.string().email(),
  email_verified: z.union([z.boolean(), z.enum(["true", "false"])]),
  exp: z.coerce.number().int().positive(),
  iss: z.enum(["accounts.google.com", "https://accounts.google.com"]),
});

export class GmailPubSubAuthError extends Error {
  constructor(
    readonly code:
      | "GMAIL_PUBSUB_CONFIGURATION_MISSING"
      | "GMAIL_PUBSUB_AUTH_REQUIRED"
      | "GMAIL_PUBSUB_TOKEN_INVALID",
    message: string,
  ) {
    super(message);
    this.name = "GmailPubSubAuthError";
  }
}

export async function verifyGmailPubSubRequest(
  request: Request,
  options: {
    configuration?: GmailConfiguration;
    fetcher?: FetchLike;
    now?: Date;
  } = {},
): Promise<{ serviceAccount: string }> {
  const configuration = options.configuration ?? getGmailConfiguration();
  if (!configuration.pubsubAudience || !configuration.pubsubServiceAccount) {
    throw new GmailPubSubAuthError(
      "GMAIL_PUBSUB_CONFIGURATION_MISSING",
      "La autenticacion Pub/Sub no esta configurada",
    );
  }

  const token = readBearerToken(request.headers.get("authorization"));
  if (!token) {
    throw new GmailPubSubAuthError(
      "GMAIL_PUBSUB_AUTH_REQUIRED",
      "Pub/Sub no envio un Bearer token",
    );
  }

  const url = new URL("https://oauth2.googleapis.com/tokeninfo");
  url.searchParams.set("id_token", token);
  const response = await (options.fetcher ?? fetch)(url, {
    cache: "no-store",
  });
  if (!response.ok) {
    throw invalidToken();
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw invalidToken();
  }
  const parsed = TokenInfoSchema.safeParse(payload);
  if (!parsed.success) throw invalidToken();

  const claims = parsed.data;
  const expectedEmail = configuration.pubsubServiceAccount.toLowerCase();
  const isVerified =
    claims.email_verified === true || claims.email_verified === "true";
  const nowSeconds = Math.floor((options.now ?? new Date()).getTime() / 1000);
  if (
    claims.aud !== configuration.pubsubAudience ||
    claims.email.toLowerCase() !== expectedEmail ||
    !isVerified ||
    claims.exp <= nowSeconds
  ) {
    throw invalidToken();
  }

  return { serviceAccount: expectedEmail };
}

function readBearerToken(value: string | null): string | null {
  if (!value) return null;
  const match = /^Bearer\s+([^\s]+)$/i.exec(value.trim());
  return match?.[1] ?? null;
}

function invalidToken() {
  return new GmailPubSubAuthError(
    "GMAIL_PUBSUB_TOKEN_INVALID",
    "La identidad Pub/Sub no es valida",
  );
}
