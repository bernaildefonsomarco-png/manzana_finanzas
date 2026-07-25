export const GMAIL_READONLY_SCOPE =
  "https://www.googleapis.com/auth/gmail.readonly";

export type GmailWatch = {
  historyId: string;
  expiration: string;
};

export type GmailProfile = {
  emailAddress: string;
  historyId: string;
};

export type GmailMessageHeader = {
  name: string;
  value: string;
};

export type GmailMessage = {
  id: string;
  threadId: string | null;
  internalDate: string | null;
  snippet: string | null;
  payload: {
    mimeType: string | null;
    headers: GmailMessageHeader[];
    body: { data: string | null } | null;
    parts: GmailMessagePart[];
  } | null;
};

export type GmailMessagePart = {
  mimeType: string | null;
  body: { data: string | null } | null;
  parts: GmailMessagePart[];
};

export type GmailHistoryPage = {
  messageIds: Array<{ id: string; threadId: string | null }>;
  historyId: string;
  nextPageToken: string | null;
};

export type GmailMessageListPage = {
  messageIds: Array<{ id: string; threadId: string | null }>;
  nextPageToken: string | null;
};

export interface EmailAdapter {
  buildAuthorizationUrl(input: { state: string; loginHint?: string | null }): string;
  exchangeAuthorizationCode(code: string): Promise<{
    accessToken: string;
    refreshToken: string | null;
    expiresIn: number | null;
    scopes: string[];
  }>;
  refreshAccessToken(refreshToken: string): Promise<string>;
  getProfile(accessToken: string): Promise<GmailProfile>;
  startWatch(accessToken: string): Promise<GmailWatch>;
  stopWatch(accessToken: string): Promise<void>;
  revokeToken(token: string): Promise<void>;
  listHistory(input: {
    accessToken: string;
    startHistoryId: string;
    pageToken?: string | null;
  }): Promise<GmailHistoryPage>;
  listRecentMessages(input: {
    accessToken: string;
    newerThanDays: number;
    pageToken?: string | null;
  }): Promise<GmailMessageListPage>;
  getMessageMetadata(accessToken: string, messageId: string): Promise<GmailMessage>;
  getMessageContent(accessToken: string, messageId: string): Promise<GmailMessage>;
}
