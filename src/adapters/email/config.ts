import { publicIdentity } from "@/shared/public-identity";

export type GmailConfiguration = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  topicName: string;
  tokenEncryptionKey: string;
  pubsubAudience: string;
  pubsubServiceAccount: string;
};

export type GmailReadiness = {
  configured: boolean;
  missing: string[];
};

export function getGmailConfiguration(): GmailConfiguration {
  const values = {
    clientId: process.env.GOOGLE_CLIENT_ID?.trim() ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "",
    redirectUri:
      process.env.GOOGLE_REDIRECT_URI?.trim() ||
      new URL("/api/v1/email/oauth/callback", publicIdentity.websiteUrl).toString(),
    topicName: process.env.GMAIL_PUBSUB_TOPIC?.trim() ?? "",
    tokenEncryptionKey: process.env.GMAIL_TOKEN_ENCRYPTION_KEY?.trim() ?? "",
    pubsubAudience: process.env.GMAIL_PUBSUB_AUDIENCE?.trim() ?? "",
    pubsubServiceAccount:
      process.env.GMAIL_PUBSUB_SERVICE_ACCOUNT?.trim().toLowerCase() ?? "",
  };

  return values;
}

export function getGmailReadiness(
  configuration = getGmailConfiguration(),
): GmailReadiness {
  const missing = Object.entries(configuration)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  return { configured: missing.length === 0, missing };
}

