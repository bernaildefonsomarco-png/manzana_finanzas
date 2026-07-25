import { z } from "zod";
import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import { assertSystemActionAllowed } from "@/core/risk/system-action-gate";
import {
  deleteUserEmailSource,
  upsertUserEmailSource,
} from "@/data/repositories/email.repository";
import { createServiceClient } from "@/data/supabase/server";

export const dynamic = "force-dynamic";

const UpsertSchema = z
  .object({
    institution_key: z
      .string()
      .trim()
      .min(2)
      .max(80)
      .regex(/^[a-z0-9][a-z0-9_-]+$/),
    email_connection_id: z.string().uuid(),
    notification_sender: z.string().trim().toLowerCase().email().max(320),
  })
  .strict();

const DeleteSchema = z
  .object({ source_id: z.string().uuid() })
  .strict();

export async function PUT(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const input = UpsertSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: true,
    });
    const source = await upsertUserEmailSource(createServiceClient(), {
      userId: auth.userId,
      institutionKey: input.institution_key,
      connectionId: input.email_connection_id,
      notificationSender: input.notification_sender,
      traceId: meta.trace_id,
    });
    return okJson({ source }, meta);
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

export async function DELETE(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const input = DeleteSchema.parse(await readJsonBody(request));
    assertSystemActionAllowed({
      actionKind: "preference_change",
      authenticatedSession: true,
      explicitUserConfirmation: true,
      reversible: false,
    });
    const result = await deleteUserEmailSource(createServiceClient(), {
      userId: auth.userId,
      sourceId: input.source_id,
      traceId: meta.trace_id,
    });
    return okJson(result, meta);
  } catch (error) {
    if (error instanceof z.ZodError) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}
