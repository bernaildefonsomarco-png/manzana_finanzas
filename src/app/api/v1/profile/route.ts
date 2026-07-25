import { createServiceClient } from "@/data/supabase/server";
import { getProfile, upsertProfile } from "@/data/repositories/profiles.repository";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { normalizePhoneE164 } from "@/shared/phone";
import type { Profile } from "@/shared/types/domain";
import { UpdateProfileRequestSchema } from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const profile =
      (await getProfile(auth.client, auth.userId)) ??
      (await upsertProfile(createServiceClient(), auth.userId, {}));

    return okJson({ profile }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function PATCH(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const body = await readJsonBody(request);
    const parsed = UpdateProfileRequestSchema.parse(body);
    const updates: Partial<Omit<Profile, "id" | "created_at" | "updated_at">> =
      {};

    if ("display_name" in parsed) {
      updates.display_name = parsed.display_name;
    }

    if ("phone_e164" in parsed) {
      if (parsed.phone_e164 === null || parsed.phone_e164 === "") {
        updates.phone_e164 = null;
      } else {
        const normalizedPhone = normalizePhoneE164(parsed.phone_e164);
        if (!normalizedPhone) {
          return errorJson(
            "VALIDATION_ERROR",
            "Ese numero no parece tener formato valido. Incluye codigo de pais, por ejemplo +51928377977.",
            meta,
            400
          );
        }
        updates.phone_e164 = normalizedPhone;
      }
    }

    if ("timezone" in parsed) {
      updates.timezone = parsed.timezone;
    }

    if ("locale" in parsed) {
      updates.locale = parsed.locale;
    }

    const profile = await upsertProfile(
      createServiceClient(),
      auth.userId,
      updates
    );

    return okJson({ profile }, meta);
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);

    if (isUniqueViolation(error)) {
      return errorJson(
        "CONFLICT",
        "Ese WhatsApp ya esta vinculado a otra cuenta de Manzana.",
        meta,
        409
      );
    }

    return unexpectedError(error, meta);
  }
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { code?: unknown }).code === "23505";
}
