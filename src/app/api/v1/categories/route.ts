import { getApiAuth } from "@/app/api/_lib/auth";
import {
  errorJson,
  getTraceId,
  okJson,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  clampLimit,
  decodeCursor,
  paginateInMemory,
} from "@/app/api/_lib/pagination";
import { getClassificationCatalog } from "@/data/repositories/classification.repository";
import { ListClassificationQuerySchema } from "../classification/schemas";
import { isZodLike } from "../classification/route-helpers";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const meta = { trace_id: getTraceId(request) };
  try {
    const auth = await getApiAuth(request);
    if (!auth) return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);

    const url = new URL(request.url);
    const query = ListClassificationQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );
    const cursor = decodeCursor(query.cursor);
    if (cursor === "invalid") {
      return errorJson("VALIDATION_ERROR", "Cursor invalido.", meta, 400);
    }
    const limit = clampLimit(query.limit);

    const catalog = await getClassificationCatalog(auth.client, auth.userId);
    const { data: pageRows, page } = paginateInMemory(
      catalog.categories,
      limit,
      cursor
    );

    return okJson({ categories: pageRows }, { ...meta, page });
  } catch (error) {
    if (isZodLike(error)) return validationError(error, meta);
    return unexpectedError(error, meta);
  }
}

