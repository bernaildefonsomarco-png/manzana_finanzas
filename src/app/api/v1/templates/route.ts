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
  createMovementTemplate,
  listMovementTemplates,
  MovementTemplateRepositoryError,
} from "@/data/repositories/movement-templates.repository";
import { CreateTemplateRequestSchema } from "./schemas";

export const dynamic = "force-dynamic";

// AC-CAP-15: sin excepciones de service-role — el cliente autenticado
// escribe directo, protegido por las politicas RLS de la migracion 055.

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const templates = await listMovementTemplates(auth.client, auth.userId);
    return okJson({ templates }, meta);
  } catch (error) {
    return unexpectedError(error, meta);
  }
}

export async function POST(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }
    const parsed = CreateTemplateRequestSchema.parse(await readJsonBody(request));
    const template = await createMovementTemplate(auth.client, {
      userId: auth.userId,
      name: parsed.name,
      type: parsed.type,
      amount: parsed.amount ?? null,
      merchant: parsed.merchant ?? null,
      description: parsed.description ?? null,
      categoryId: parsed.category_id ?? null,
      subcategoryId: parsed.subcategory_id ?? null,
      accountId: parsed.account_id ?? null,
      boxId: parsed.box_id ?? null,
    });
    return okJson({ template }, meta, { status: 201 });
  } catch (error) {
    if (
      error instanceof MovementTemplateRepositoryError &&
      error.code === "TEMPLATE_ALREADY_EXISTS"
    ) {
      return errorJson("CONFLICT", error.message, meta, 409);
    }
    if (isZodLike(error)) return validationError(error, meta);
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
