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
import {
  archiveMovementTemplate,
  MovementTemplateRepositoryError,
  updateMovementTemplate,
} from "@/data/repositories/movement-templates.repository";
import { UpdateTemplateRequestSchema } from "../schemas";

export const dynamic = "force-dynamic";

const ParamsSchema = z.object({ id: z.string().uuid() });
type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const params = ParamsSchema.parse(await context.params);
    const parsed = UpdateTemplateRequestSchema.parse(await readJsonBody(request));
    const template = await updateMovementTemplate(auth.client, auth.userId, params.id, {
      name: parsed.name,
      type: parsed.type,
      amount: parsed.amount,
      merchant: parsed.merchant,
      description: parsed.description,
      categoryId: parsed.category_id,
      subcategoryId: parsed.subcategory_id,
      accountId: parsed.account_id,
      boxId: parsed.box_id,
    });
    return okJson({ template }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const params = ParamsSchema.parse(await context.params);
    await archiveMovementTemplate(auth.client, auth.userId, params.id);
    return okJson({ archived: true }, meta);
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof MovementTemplateRepositoryError) {
    if (error.code === "TEMPLATE_NOT_FOUND") {
      return errorJson("NOT_FOUND", "No encontre esa plantilla.", meta, 404);
    }
    return errorJson("INTERNAL_ERROR", "No pude actualizar la plantilla.", meta, 500);
  }
  if (isZodLike(error)) return validationError(error, meta);
  return unexpectedError(error, meta);
}

function isZodLike(error: unknown): boolean {
  return Boolean(
    error &&
      typeof error === "object" &&
      "issues" in error &&
      Array.isArray((error as { issues?: unknown }).issues)
  );
}
