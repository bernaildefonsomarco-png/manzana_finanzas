import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/data/supabase/types";
import type { UserSubcategory } from "@/shared/types/domain";
import { getCategoryLabel } from "@/shared/copy/category-copy";
import {
  findSubcategoryByLabel,
  getSubcategoryById,
  insertSubcategory,
  updateSubcategory,
} from "@/data/repositories/classification.repository";
import {
  appendStructureAudit,
  isUniqueViolation,
} from "@/data/repositories/structure.repository";
import type { StructureCommand } from "./structure-commands";
import type { StructureExecutionResult } from "./structure-execution-result";

type Client = SupabaseClient<Database>;

/**
 * Ejecutor conversacional de subcategorias (`RUL-ESTR-01`, `RUL-CAT`).
 *
 * **Por que este ejecutor y no otro.** Una subcategoria no tiene RPC
 * transaccional ni almacen de recibos: se escribe sobre
 * `public.user_subcategories`, exactamente como hacen
 * `POST /api/v1/subcategories` y `DELETE /api/v1/subcategories/[id]`. Es el
 * mismo caso que las cuentas, y por eso sigue su patron: escritura directa
 * sobre la tabla mediante el repositorio que ya normaliza la etiqueta, y
 * auditoria en `movement_audit_log`.
 *
 * **Por que no pasa por `ClassificationCommandDispatcher`.** Ese despachador es
 * el de la pantalla, y su envoltura exige `trace_id` con forma de UUID
 * (`CommandEnvelopeBaseSchema`), mientras que la de estructura admite cualquier
 * traza de hasta 120 caracteres. Enchufarlos habria convertido una traza
 * perfectamente valida del turno en un fallo de validacion **despues** de que
 * el usuario ya pulso el boton, que es el peor momento para descubrirlo.
 *
 * **Idempotencia por estado, no por clave.** A diferencia de una caja, una
 * subcategoria no tiene donde sellar `structure_idempotency_key`: su unicidad
 * dura ya vive en la base como `user_subcategories_unique_label` sobre
 * `(user_id, category_id, normalized_label, deleted_at)`. Buscar por esa misma
 * llave antes de escribir cubre ademas un caso que la clave no cubriria: que la
 * persona ya la hubiera creado desde Configuracion. En los dos casos la
 * respuesta honesta es "eso ya estaba hecho", no un duplicado ni un error.
 */

export async function createSubcategoryFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "CreateSubcategoryCommand" }>,
): Promise<StructureExecutionResult> {
  const payload = command.payload;

  const existente = await findSubcategoryByLabel(client, {
    userId: command.user_id,
    categoryId: payload.category_id,
    label: payload.label,
  });
  if (existente) return applied(existente, "create", true);

  let subcategory: UserSubcategory;
  try {
    subcategory = await insertSubcategory(client, {
      userId: command.user_id,
      categoryId: payload.category_id,
      label: payload.label,
      // La persona confirmo la tarjeta con su propio nombre para la
      // subcategoria: es suya, no una inferencia del motor. `insertSubcategory`
      // guarda esto en `created_by`, que es lo que despues distingue una
      // etiqueta elegida de una aprendida.
      createdBy: "user",
    });
  } catch (error) {
    // La carrera entre la lectura de arriba y este insert es real: dos
    // confirmaciones simultaneas del mismo boton. La red dura de la base la
    // atrapa, y para la persona el resultado sigue siendo "ya estaba hecho".
    if (isUniqueViolation(error)) {
      const ganadora = await findSubcategoryByLabel(client, {
        userId: command.user_id,
        categoryId: payload.category_id,
        label: payload.label,
      });
      if (ganadora) return applied(ganadora, "create", true);
      return {
        kind: "failed",
        entity: "subcategoria",
        operation: "create",
        reason: "conflict",
        error_code: "SUBCATEGORY_LABEL_TAKEN",
        detail: `Ya tienes una subcategoría "${payload.label}" en ${categoryLabel(payload.category_id)}.`,
      };
    }
    throw error;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "user_subcategory",
    entityId: subcategory.id,
    action: "created",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: null,
    newValue: subcategory,
  });

  return applied(subcategory, "create", false);
}

export async function updateSubcategoryFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "UpdateSubcategoryCommand" }>,
): Promise<StructureExecutionResult> {
  const { subcategory_id: subcategoryId, label } = command.payload;
  const previous = await getSubcategoryById(
    client,
    command.user_id,
    subcategoryId,
  );
  if (!previous) return notFound("update");

  // Idempotencia por estado, igual que en cajas y cuentas: si ya se llama asi,
  // el segundo envio no vuelve a escribir ni a anotar auditoria.
  if (previous.label === label.trim()) {
    return applied(previous, "update", true);
  }

  let updated: UserSubcategory;
  try {
    updated = await updateSubcategory(client, {
      userId: command.user_id,
      id: subcategoryId,
      label,
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return {
        kind: "failed",
        entity: "subcategoria",
        operation: "update",
        reason: "conflict",
        error_code: "SUBCATEGORY_LABEL_TAKEN",
        detail: `Ya tienes otra subcategoría "${label}" en ${categoryLabel(previous.category_id)}.`,
      };
    }
    throw error;
  }

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "user_subcategory",
    entityId: updated.id,
    action: "updated",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: previous,
    newValue: updated,
  });

  return applied(updated, "update", false);
}

/**
 * Archiva la subcategoria con la misma semantica que
 * `DELETE /api/v1/subcategories/[id]` (`SCR-CAT-02`): archivar no es borrar.
 * Se marca `deleted_at`, deja de ofrecerse para movimientos nuevos y los
 * movimientos que ya la usan **conservan su referencia**. Por eso no hay nada
 * que reasignar antes ni saldo que devolver: a diferencia de una caja, una
 * subcategoria no guarda dinero.
 */
export async function archiveSubcategoryFromCommand(
  client: Client,
  command: Extract<StructureCommand, { type: "ArchiveSubcategoryCommand" }>,
): Promise<StructureExecutionResult> {
  const subcategoryId = command.payload.subcategory_id;
  const previous = await getSubcategoryById(
    client,
    command.user_id,
    subcategoryId,
  );

  // `getSubcategoryById` filtra por `deleted_at is null`: si ya no aparece, o
  // no es del usuario o ya estaba archivada. Las dos se responden igual desde
  // fuera (`SEG-04`), y para la dueña el segundo caso es "ya estaba hecho".
  if (!previous) return notFound("archive");

  const archived = await updateSubcategory(client, {
    userId: command.user_id,
    id: subcategoryId,
    archive: true,
  });

  await appendStructureAudit(client, {
    userId: command.user_id,
    entityType: "user_subcategory",
    entityId: subcategoryId,
    action: "deleted",
    actorType: command.actor.type,
    actorId: command.actor.id,
    source: command.source,
    traceId: command.trace_id,
    commandId: command.command_id,
    idempotencyKey: command.idempotency_key,
    oldValue: previous,
    newValue: archived,
  });

  return {
    kind: "applied",
    entity: "subcategoria",
    operation: "archive",
    entity_id: subcategoryId,
    summary: `la subcategoría ${previous.label} de ${categoryLabel(previous.category_id)}`,
    idempotent: false,
  };
}

// --- Helpers ---------------------------------------------------------------

function applied(
  subcategory: UserSubcategory,
  operation: "create" | "update",
  idempotent: boolean,
): StructureExecutionResult {
  return {
    kind: "applied",
    entity: "subcategoria",
    operation,
    entity_id: subcategory.id,
    summary: `la subcategoría ${subcategory.label} dentro de ${categoryLabel(subcategory.category_id)}`,
    idempotent,
  };
}

function notFound(operation: "update" | "archive"): StructureExecutionResult {
  return {
    kind: "failed",
    entity: "subcategoria",
    operation,
    reason: "reference_not_found",
    error_code: "SUBCATEGORY_NOT_FOUND",
    detail: "No encontré esa subcategoría.",
  };
}

/**
 * La categoria se nombra siempre con la etiqueta del catalogo —"Vivienda /
 * Hogar"— y nunca con su id. El `??` no es defensivo por gusto: `getCategoryLabel`
 * admite un id desconocido y solo devuelve `null` con la cadena vacia, que el
 * esquema del comando ya impide.
 */
function categoryLabel(categoryId: string): string {
  return getCategoryLabel(categoryId) ?? categoryId;
}
