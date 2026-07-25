import { randomBytes } from "node:crypto";
import { GmailEmailAdapter } from "@/adapters/email/gmail-client";
import { getGmailReadiness } from "@/adapters/email/config";
import { getApiAuth } from "@/app/api/_lib/auth";
import { errorJson, getTraceId, okJson, unexpectedError } from "@/app/api/_lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const readiness = getGmailReadiness();
    if (!readiness.configured) {
      return errorJson(
        "NOT_CONFIGURED",
        "La conexion Gmail todavia no esta habilitada.",
        meta,
        503,
        { missing: readiness.missing },
      );
    }
    const state = randomBytes(32).toString("base64url");
    const authorization_url = new GmailEmailAdapter().buildAuthorizationUrl({
      state,
    });
    const response = okJson({ authorization_url }, meta);
    response.cookies.set("manzana_gmail_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_ENV !== "local",
      path: "/api/v1/email/oauth/callback",
      maxAge: 10 * 60,
    });
    return response;
  } catch (error) {
    return unexpectedError(error, meta);
  }
}
