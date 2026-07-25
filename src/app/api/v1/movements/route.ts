import { randomUUID } from "node:crypto";
import { CommandDispatcher } from "@/core/finance";
import { evaluateCrossChannelDedup } from "@/core/dedup";
import { CoreError } from "@/core/finance/errors";
import { createServiceClient } from "@/data/supabase/server";
import { SupabaseFinancialCoreRepository } from "@/data/repositories/movements.repository";
import { sortMovementsByRegistrationRecency } from "@/features/movements/movement-sort";
import type { Movement } from "@/shared/types/domain";
import { getApiAuth } from "@/app/api/_lib/auth";
import { ClassificationCommandDispatcher } from "@/core/classification";
import { validateMovementClassificationReferences } from "@/data/repositories/classification.repository";
import { classificationCommand } from "@/app/api/v1/classification/route-helpers";
import {
  coreError,
  errorJson,
  getTraceId,
  okJson,
  readJsonBody,
  unexpectedError,
  validationError,
} from "@/app/api/_lib/http";
import {
  CreateMovementRequestSchema,
  ListMovementsQuerySchema,
  toMovementInput,
} from "./schemas";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const url = new URL(request.url);
    const query = ListMovementsQuerySchema.parse(
      Object.fromEntries(url.searchParams.entries())
    );

    let builder = auth.client
      .from("movements")
      .select("*")
      .eq("user_id", auth.userId)
      .order("created_at", { ascending: false })
      .order("occurred_at", { ascending: false })
      .limit(query.limit);

    if (!query.include_deleted) {
      builder = builder.is("deleted_at", null);
    }

    if (query.type) builder = builder.eq("type", query.type);
    if (query.status) builder = builder.eq("status", query.status);
    if (query.category_id) builder = builder.eq("category_id", query.category_id);
    if (query.from) builder = builder.gte("occurred_at", query.from);
    if (query.to) builder = builder.lte("occurred_at", query.to);
    if (query.account_id) {
      builder = builder.or(
        `account_origin_id.eq.${query.account_id},account_destination_id.eq.${query.account_id}`
      );
    }

    const { data, error } = await builder;

    if (error) {
      return errorJson(
        "INTERNAL_ERROR",
        "No pude leer los movimientos.",
        meta,
        500
      );
    }

    return okJson(
      { movements: sortMovementsByRegistrationRecency((data ?? []) as Movement[]) },
      meta
    );
  } catch (error) {
    if (error instanceof Response) return error;
    return validationOrUnexpected(error, meta);
  }
}

export async function POST(request: Request) {
  const trace_id = getTraceId(request);
  const meta = { trace_id };

  try {
    const auth = await getApiAuth(request);
    if (!auth) {
      return errorJson("AUTH_REQUIRED", "Necesitas iniciar sesion.", meta, 401);
    }

    const idempotencyKey = request.headers.get("idempotency-key");
    if (!idempotencyKey || idempotencyKey.trim().length < 8) {
      return errorJson(
        "VALIDATION_ERROR",
        "Falta Idempotency-Key para guardar el movimiento.",
        meta,
        400
      );
    }

    const body = await readJsonBody(request);
    const parsed = CreateMovementRequestSchema.parse(body);
    const serviceClient = createServiceClient();
    await validateMovementClassificationReferences(serviceClient, {
      userId: auth.userId,
      subcategoryId: parsed.subcategory_id ?? null,
      relatedPersonId: parsed.related_person_id ?? null,
      tagIds: parsed.tag_ids ?? [],
    });
    const repository = new SupabaseFinancialCoreRepository(serviceClient);
    const dispatcher = new CommandDispatcher(repository);
    let movementInput = toMovementInput(parsed);
    const normalizedIdempotencyKey = idempotencyKey.trim();
    const existing = await repository.findMovementByIdempotencyKey(
      auth.userId,
      normalizedIdempotencyKey,
    );

    if (!existing) {
      const dedup = await evaluateCrossChannelDedup({
        client: serviceClient,
        userId: auth.userId,
        traceId: trace_id,
        referenceId: `dashboard:${normalizedIdempotencyKey}`,
        movementInput,
        metadata: { entry_surface: "dashboard_manual" },
      });
      const decision = dedup.decision;

      if (
        decision &&
        decision.status !== "distinct" &&
        !parsed.confirm_duplicate
      ) {
        return errorJson(
          "CONFLICT",
          decision.status === "exact_duplicate"
            ? "Este movimiento ya fue registrado."
            : "Encontré un movimiento parecido. Revísalo antes de guardar otro.",
          meta,
          409,
          {
            reason: "cross_channel_duplicate",
            requires_confirmation: decision.requires_confirmation,
            dedup_status: decision.status,
            matched_movement_id: decision.matched_reference_id,
            score: decision.score,
          },
        );
      }

      if (decision && decision.status !== "distinct") {
        movementInput = {
          ...movementInput,
          metadata: {
            ...movementInput.metadata,
            dedup_override_confirmed: true,
            dedup_status: decision.status,
            dedup_matched_reference_id: decision.matched_reference_id,
            dedup_score: decision.score,
          },
        };
      }
    }

    const result = await dispatcher.dispatch({
      type: "CreateMovementCommand",
      command_id: randomUUID(),
      user_id: auth.userId,
      actor: { type: "user", id: auth.userId },
      source: "api.v1.movements.post",
      trace_id,
      payload: {
        movement: movementInput,
        idempotency_key: normalizedIdempotencyKey,
      },
    });

    if (parsed.tag_ids !== undefined) {
      await new ClassificationCommandDispatcher(serviceClient).dispatch(
        classificationCommand({
          type: "SetMovementTagsCommand",
          userId: auth.userId,
          traceId: trace_id,
          source: "api.v1.movements.post.tags",
          payload: {
            movement_id: result.movement.id,
            tag_ids: parsed.tag_ids,
            assignment_source: "user",
            confirmed_by_user: true,
          },
        }),
      );
    }

    const status =
      result.type === "movement_created" && result.idempotent ? 200 : 201;

    return okJson(result, meta, { status });
  } catch (error) {
    return validationOrUnexpected(error, meta);
  }
}

function validationOrUnexpected(error: unknown, meta: { trace_id: string }) {
  if (error instanceof CoreError) return coreError(error, meta);
  if (error instanceof SyntaxError) {
    return errorJson("VALIDATION_ERROR", "JSON invalido.", meta, 400);
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
