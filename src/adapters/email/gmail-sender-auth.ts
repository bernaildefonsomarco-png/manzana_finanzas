import type { GmailMessage } from "./contracts";
import { normalizeEmailAddress } from "./gmail-parser";

export type GmailSenderAuthenticationFailureReason =
  | "from_mismatch"
  | "google_authentication_results_missing"
  | "dmarc_pass_missing"
  | "dmarc_domain_mismatch"
  | "dkim_pass_missing"
  | "dkim_domain_mismatch";

export type GmailSenderAuthenticationResult =
  | {
      authenticated: true;
      method: "gmail_authentication_results_dkim_dmarc";
      fromDomain: string;
    }
  | {
      authenticated: false;
      reason: GmailSenderAuthenticationFailureReason;
    };

/**
 * Verifica el resultado agregado por Gmail antes de pedir el cuerpo.
 *
 * No confía en headers Authentication-Results arbitrarios que el remitente
 * pudiera haber incluido: solo acepta el resultado cuyo authserv-id es
 * mx.google.com y exige alineación exacta de DMARC y al menos una firma DKIM.
 */
export function authenticateGmailSender(
  message: GmailMessage,
  expectedSender: string,
): GmailSenderAuthenticationResult {
  const actualSender = normalizeEmailAddress(
    readHeaderValues(message, "From")[0] ?? null,
  );
  const normalizedExpected = expectedSender.trim().toLowerCase();
  if (!actualSender || actualSender !== normalizedExpected) {
    return { authenticated: false, reason: "from_mismatch" };
  }

  const fromDomain = readDomain(actualSender);
  const trustedAuthenticationResult = readHeaderValues(
    message,
    "Authentication-Results",
  ).find((value) => /^\s*mx\.google\.com\s*;/i.test(value));
  if (!trustedAuthenticationResult) {
    return {
      authenticated: false,
      reason: "google_authentication_results_missing",
    };
  }

  const dmarcDomains = readPassingDomains(
    trustedAuthenticationResult,
    "dmarc",
    "header.from",
  );
  if (dmarcDomains.length === 0) {
    return { authenticated: false, reason: "dmarc_pass_missing" };
  }
  if (!dmarcDomains.includes(fromDomain)) {
    return { authenticated: false, reason: "dmarc_domain_mismatch" };
  }

  const dkimDomains = [
    ...readPassingDomains(
      trustedAuthenticationResult,
      "dkim",
      "header.d",
    ),
    ...readPassingDomains(
      trustedAuthenticationResult,
      "dkim",
      "header.i",
    ),
  ];
  if (dkimDomains.length === 0) {
    return { authenticated: false, reason: "dkim_pass_missing" };
  }
  if (!dkimDomains.includes(fromDomain)) {
    return { authenticated: false, reason: "dkim_domain_mismatch" };
  }

  return {
    authenticated: true,
    method: "gmail_authentication_results_dkim_dmarc",
    fromDomain,
  };
}

function readHeaderValues(message: GmailMessage, name: string): string[] {
  return (
    message.payload?.headers
      .filter((header) => header.name.toLowerCase() === name.toLowerCase())
      .map((header) => header.value.trim())
      .filter(Boolean) ?? []
  );
}

function readPassingDomains(
  authenticationResults: string,
  method: "dkim" | "dmarc",
  property: "header.d" | "header.i" | "header.from",
): string[] {
  return authenticationResults
    .split(";")
    .filter((clause) =>
      new RegExp(`^\\s*${method}=pass\\b`, "i").test(clause),
    )
    .flatMap((clause) => {
      const match = new RegExp(
        `\\b${escapeRegExp(property)}=([^\\s;]+)`,
        "i",
      ).exec(clause);
      const domain = normalizeDomain(match?.[1] ?? "");
      return domain ? [domain] : [];
    });
}

function readDomain(address: string): string {
  return normalizeDomain(address.split("@").at(-1) ?? "");
}

function normalizeDomain(value: string): string {
  const normalized =
    value
    .trim()
    .replace(/^["']|["']$/g, "")
    .split("@")
    .at(-1) ?? "";
  return normalized
    .replace(/^@/, "")
    .replace(/\.$/, "")
    .toLowerCase();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
