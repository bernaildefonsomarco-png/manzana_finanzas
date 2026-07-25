import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getApiAuth } from "@/app/api/_lib/auth";
import { getTraceId } from "@/app/api/_lib/http";
import { completeGmailOAuth } from "@/core/email/email-connection";
import { createServiceClient } from "@/data/supabase/server";
import { publicIdentity } from "@/shared/public-identity";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const traceId = getTraceId(request);
  const url = new URL(request.url);
  const response = (status: "connected" | "error", reason?: string) => {
    const target = new URL("/", publicIdentity.websiteUrl);
    target.searchParams.set("view", "settings");
    target.searchParams.set("email", status);
    if (reason) target.searchParams.set("email_reason", reason);
    const redirect = NextResponse.redirect(target);
    redirect.cookies.set("manzana_gmail_oauth_state", "", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.APP_ENV !== "local",
      path: "/api/v1/email/oauth/callback",
      expires: new Date(0),
    });
    return redirect;
  };

  const auth = await getApiAuth(request);
  if (!auth) return response("error", "auth_required");
  if (url.searchParams.get("error")) return response("error", "consent_denied");

  const state = url.searchParams.get("state");
  const expectedState = request.cookies.get("manzana_gmail_oauth_state")?.value;
  if (!state || !expectedState || !constantTimeEqual(state, expectedState)) {
    return response("error", "state_invalid");
  }
  const code = url.searchParams.get("code");
  if (!code) return response("error", "code_missing");

  try {
    await completeGmailOAuth({
      client: createServiceClient(),
      userId: auth.userId,
      code,
      traceId,
    });
    return response("connected");
  } catch {
    return response("error", "connection_failed");
  }
}

function constantTimeEqual(value: string, expected: string): boolean {
  const left = Buffer.from(value, "utf8");
  const right = Buffer.from(expected, "utf8");
  return left.length === right.length && timingSafeEqual(left, right);
}
