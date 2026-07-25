import { getGmailReadiness } from "@/adapters/email/config";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";
import {
  listEmailConnectionsForUser,
  listEmailInstitutions,
  listUserEmailSources,
  readEmailAiExtractionConsent,
} from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const readiness = getGmailReadiness();
    const client = createServiceClient();
    const [connections, institutions, sources] = await Promise.all([
      listEmailConnectionsForUser(client, auth.userId),
      listEmailInstitutions(client),
      listUserEmailSources(client, auth.userId),
    ]);
    const serializedConnections = connections.map((connection) => ({
      id: connection.id,
      email_address: connection.email_address,
      status: connection.status,
      watch_status: connection.watch_status,
      watch_expiration: connection.watch_expiration,
      last_watch_renewed_at: connection.last_watch_renewed_at,
      connected: connection.status !== "disconnected",
      ai_extraction_consent: readEmailAiExtractionConsent(connection),
    }));
    return okJson(
      {
        configured: readiness.configured,
        missing: readiness.missing,
        connections: serializedConnections,
        connection: serializedConnections[0] ?? null,
        institutions: institutions.map((institution) => ({
          institution_key: institution.institution_key,
          display_name: institution.display_name,
          aliases: institution.aliases,
          sort_order: institution.sort_order,
        })),
        sources: sources.map((source) => ({
          id: source.id,
          institution_key: source.institution_key,
          email_connection_id: source.email_connection_id,
          notification_sender: source.notification_sender,
          status: source.status,
          verification_status: source.verification_status,
          verified_at: source.verified_at,
        })),
      },
      meta,
    );
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
