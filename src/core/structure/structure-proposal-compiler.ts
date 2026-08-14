import { randomUUID } from "node:crypto";
import type { StructureProposalRequest } from "@/agents/conversational-executive-agent/types";
import {
  commandTypeFor,
  CreateAccountPayloadSchema,
  CreateBoxPayloadSchema,
  CreateBudgetPayloadSchema,
  CreateGoalPayloadSchema,
  CreateRecurringPayloadSchema,
  CreateSubcategoryPayloadSchema,
  isDestructiveStructureOperation,
  UpdateAccountPayloadSchema,
  UpdateBoxPayloadSchema,
  UpdateBudgetPayloadSchema,
  UpdateGoalPayloadSchema,
  UpdateRecurringPayloadSchema,
  UpdateSubcategoryPayloadSchema,
  type StructureEntity,
  type StructureOperation,
} from "./structure-commands";
import {
  StructureProposalSchema,
  type StructureProposal,
} from "./structure-proposal";
import {
  composeCategoryIsFixedAnswer,
  composeStructureAmbiguityQuestion,
  readStructureIntent,
  structureProposalConflictsWithIntent,
} from "./structure-intent";
import { describeStructureLoss } from "./structure-consequences";

/**
 * Convierte lo que el ejecutivo entendio en un borrador tipado y confirmable,
 * o en una pregunta.
 *
 * Aqui vive el criterio duro que el modelo no decide solo (`RUL-PRES-01`):
 *
 *  - si el mensaje admite mas de una lectura entre las entidades de
 *    estructura, el turno **pregunta**;
 *  - si la propuesta contradice lo que el usuario dijo —clasico: pide apartar
 *    dinero y el modelo propone un presupuesto, que no aparta nada— tambien
 *    pregunta;
 *  - si falta un dato obligatorio de la entidad, tampoco se propone: sin
 *    cuenta no hay caja, sin monto no hay presupuesto;
 *  - si la operacion no existe para esa entidad —pausar una cuenta— se dice,
 *    no se traduce a otra cosa.
 *
 * Nada de esto escribe: un borrador solo se ejecuta cuando el usuario lo
 * confirma en el turno siguiente.
 */
export type CompiledStructureProposal =
  /** No hay nada de estructura en este turno. */
  | { kind: "none" }
  /** Borrador listo, esperando el "si" del usuario. */
  | { kind: "proposal"; proposal: StructureProposal }
  /** Hay que preguntar antes de escribir. */
  | { kind: "needs_clarification"; question: string };

/** Bajo esta confianza, la propuesta no se presenta como accion. */
const MIN_STRUCTURE_CONFIDENCE = 0.6;

/**
 * `RUL-ESTR-05`: archivar exige mas confianza que crear. Crear de mas se
 * deshace archivando; archivar de mas puede costar dinero movido y un historial
 * que el usuario ya no ve.
 */
const MIN_DESTRUCTIVE_CONFIDENCE = 0.75;

export function compileStructureProposal(input: {
  request: StructureProposalRequest | null | undefined;
  /** Texto original del usuario, para el guardarrail deterministico. */
  userText: string;
  now: string;
}): CompiledStructureProposal {
  const request = input.request ?? null;
  const reading = readStructureIntent(input.userText);

  // `ERR-ASI-01`: lo primero que se resuelve es lo que el motor **no** puede
  // hacer. Va antes que todo lo demas porque el peor final posible de este
  // turno no es equivocar la entidad: es callar. Sin esta rama, "crea una
  // categoria Animales" salia por el `kind: "none"` de mas abajo y el turno
  // seguia como si nadie hubiera pedido nada.
  //
  // La unica salida es que el modelo haya entendido lo mismo que el dominio:
  // una categoria nueva "dentro de" otra es una **subcategoria**, y entonces
  // si hay algo que proponer en vez de un "no".
  if (reading.kind === "unsupported") {
    const proponeSubcategoria =
      request?.entity === "subcategoria" &&
      request.intent !== "none" &&
      Boolean(request.category_id);
    if (!proponeSubcategoria) {
      return {
        kind: "needs_clarification",
        question: composeCategoryIsFixedAnswer(),
      };
    }
  }

  if (!request || request.intent === "none" || !request.entity) {
    // El modelo no propuso nada, pero el mensaje si pedia estructura de forma
    // ambigua: preguntar sigue siendo mejor que callar.
    if (reading.kind === "ambiguous") {
      return {
        kind: "needs_clarification",
        question: composeStructureAmbiguityQuestion(reading.candidates),
      };
    }
    return { kind: "none" };
  }

  if (request.ambiguities.length > 0) {
    return {
      kind: "needs_clarification",
      question: composeStructureQuestionFromAmbiguities(request),
    };
  }

  const operation = operationForIntent(request.intent);

  const minConfidence = isDestructiveStructureOperation(operation)
    ? MIN_DESTRUCTIVE_CONFIDENCE
    : MIN_STRUCTURE_CONFIDENCE;
  if (request.confidence < minConfidence) {
    return {
      kind: "needs_clarification",
      question: composeStructureQuestionFromAmbiguities(request),
    };
  }

  if (
    structureProposalConflictsWithIntent({
      proposedEntity: request.entity,
      reading,
    })
  ) {
    return {
      kind: "needs_clarification",
      question:
        reading.kind === "ambiguous"
          ? composeStructureAmbiguityQuestion(reading.candidates)
          : composeStructureAmbiguityQuestion([
              request.entity,
              ...(reading.kind === "unambiguous" ? [reading.entity] : []),
            ]),
    };
  }

  const commandType = commandTypeFor(request.entity, operation);
  if (!commandType) {
    return {
      kind: "needs_clarification",
      question: composeUnsupportedOperationQuestion(request.entity, operation),
    };
  }

  const payload = buildPayload({ request, entity: request.entity, operation });
  if (!payload) {
    return {
      kind: "needs_clarification",
      question: composeMissingDataQuestion(request.entity, operation),
    };
  }

  // El borrador se guarda en el estado del hilo y se **vuelve a validar** con
  // este mismo esquema al confirmarlo. Si no valida aqui, el turno siguiente lo
  // rechazaria como `unknown_proposal` sin que nada explicara por que: mejor
  // preguntar ahora que prometer un boton que no va a funcionar.
  const parsed = StructureProposalSchema.safeParse({
    proposal_id: randomUUID(),
    entity: request.entity,
    operation,
    command_type: commandType,
    payload,
    summary: composeSummary({
      request,
      entity: request.entity,
      operation,
    }),
    confirm_label: composeConfirmLabel({ request, operation }),
    proposed_at: input.now,
  });

  if (!parsed.success) {
    return {
      kind: "needs_clarification",
      question: composeMissingDataQuestion(request.entity, operation),
    };
  }

  return { kind: "proposal", proposal: parsed.data };
}

function operationForIntent(
  intent: StructureProposalRequest["intent"],
): StructureOperation {
  if (intent === "update") return "update";
  if (intent === "archive") return "archive";
  if (intent === "pause") return "pause";
  if (intent === "resume") return "resume";
  return "create";
}

/**
 * `RUL-ESTR-05`: lo que se pierde al archivar no lo redacta el modelo. La
 * frase del modelo dice **que** se va a hacer; el nucleo añade, siempre y con
 * el mismo texto, **que se pierde**. Un turno destructivo sin esa segunda
 * mitad seria una confirmacion a ciegas.
 */
function composeSummary(input: {
  request: StructureProposalRequest;
  entity: StructureEntity;
  operation: StructureOperation;
}): string {
  const base =
    input.request.summary.trim() ||
    defaultSummary(input.entity, input.operation);

  if (!isDestructiveStructureOperation(input.operation)) return base;

  const consecuencia = describeStructureLoss(input.entity);
  const pregunta = base.endsWith("?") ? base : `${base}`;
  return `${consecuencia} ${pregunta}`;
}

function composeConfirmLabel(input: {
  request: StructureProposalRequest;
  operation: StructureOperation;
}): string {
  // El boton de algo destructivo nombra la accion destructiva. "Sí, hazlo" al
  // lado de un archivado no dice que se esta archivando.
  if (isDestructiveStructureOperation(input.operation)) {
    return "Sí, archívalo";
  }
  return input.request.confirm_label.trim() || "Sí, hazlo";
}

function buildPayload(input: {
  request: StructureProposalRequest;
  entity: StructureEntity;
  operation: StructureOperation;
}): Record<string, unknown> | null {
  const { request, entity, operation } = input;

  // Archivar, pausar y reanudar solo necesitan saber sobre que. El resto de lo
  // que el modelo haya rellenado se descarta a proposito: un archivado no
  // cambia campos de paso.
  if (operation !== "create" && operation !== "update") {
    const targetId = request.target_id?.trim();
    if (!targetId) return null;
    return { [targetFieldFor(entity)]: targetId };
  }

  if (entity === "caja") return buildBoxPayload(request, operation);
  if (entity === "meta") return buildGoalPayload(request, operation);
  if (entity === "presupuesto") return buildBudgetPayload(request, operation);
  if (entity === "recurrente") return buildRecurringPayload(request, operation);
  if (entity === "subcategoria") {
    return buildSubcategoryPayload(request, operation);
  }
  return buildAccountPayload(request, operation);
}

/** Nombre del campo con el que cada entidad se identifica en su payload. */
function targetFieldFor(entity: StructureEntity): string {
  if (entity === "caja") return "box_id";
  if (entity === "meta") return "goal_id";
  if (entity === "presupuesto") return "budget_id";
  if (entity === "cuenta") return "account_id";
  if (entity === "subcategoria") return "subcategory_id";
  return "recurring_rule_id";
}

function buildBoxPayload(
  request: StructureProposalRequest,
  operation: StructureOperation,
): Record<string, unknown> | null {
  if (operation === "create") {
    return parsedOrNull(
      CreateBoxPayloadSchema.safeParse({
        name: request.name,
        account_id: request.account_id,
        type: request.box_type ?? "objetivo",
        initial_balance: request.amount ?? 0,
        target_amount: request.target_amount,
        target_date: request.target_date,
      }),
    );
  }

  return parsedOrNull(
    UpdateBoxPayloadSchema.safeParse(
      dropUndefined({
        box_id: request.target_id,
        name: request.name ?? undefined,
        type: request.box_type ?? undefined,
        target_amount: request.target_amount ?? undefined,
        target_date: request.target_date ?? undefined,
      }),
    ),
  );
}

function buildGoalPayload(
  request: StructureProposalRequest,
  operation: StructureOperation,
): Record<string, unknown> | null {
  if (operation === "create") {
    return parsedOrNull(
      CreateGoalPayloadSchema.safeParse({
        name: request.name,
        target_amount: request.target_amount ?? request.amount,
        target_date: request.target_date,
        box_id: request.box_id,
      }),
    );
  }

  return parsedOrNull(
    UpdateGoalPayloadSchema.safeParse(
      dropUndefined({
        goal_id: request.target_id,
        name: request.name ?? undefined,
        target_amount: request.target_amount ?? request.amount ?? undefined,
        target_date: request.target_date ?? undefined,
      }),
    ),
  );
}

function buildBudgetPayload(
  request: StructureProposalRequest,
  operation: StructureOperation,
): Record<string, unknown> | null {
  if (operation === "create") {
    return parsedOrNull(
      CreateBudgetPayloadSchema.safeParse({
        amount: request.amount ?? request.target_amount,
        category_id: request.category_id,
        period_kind: request.period_kind ?? "mensual",
        kind: request.budget_kind ?? "presupuesto",
        rollover: false,
        auto_renew: true,
      }),
    );
  }

  return parsedOrNull(
    UpdateBudgetPayloadSchema.safeParse(
      dropUndefined({
        budget_id: request.target_id,
        amount: request.amount ?? request.target_amount ?? undefined,
        kind: request.budget_kind ?? undefined,
      }),
    ),
  );
}

function buildRecurringPayload(
  request: StructureProposalRequest,
  operation: StructureOperation,
): Record<string, unknown> | null {
  if (operation === "create") {
    const amount = request.amount ?? request.target_amount;
    // Sin variabilidad declarada, un monto conocido es un pago fijo y uno
    // desconocido es variable: es la lectura que no inventa un importe.
    const variability =
      request.amount_variability ?? (amount == null ? "variable" : "fixed");
    return parsedOrNull(
      CreateRecurringPayloadSchema.safeParse({
        name: request.name,
        expected_amount: amount,
        amount_variability: variability,
        currency: request.currency ?? "PEN",
        frequency: request.frequency ?? "monthly",
        next_expected_date: request.next_expected_date ?? request.target_date,
        category_id: request.category_id,
        default_account_id: request.account_id,
      }),
    );
  }

  return parsedOrNull(
    UpdateRecurringPayloadSchema.safeParse(
      dropUndefined({
        recurring_rule_id: request.target_id,
        name: request.name ?? undefined,
        expected_amount: request.amount ?? request.target_amount ?? undefined,
        amount_variability: request.amount_variability ?? undefined,
        frequency: request.frequency ?? undefined,
        next_expected_date: request.next_expected_date ?? undefined,
        category_id: request.category_id ?? undefined,
        default_account_id: request.account_id ?? undefined,
      }),
    ),
  );
}

function buildAccountPayload(
  request: StructureProposalRequest,
  operation: StructureOperation,
): Record<string, unknown> | null {
  if (operation === "create") {
    return parsedOrNull(
      CreateAccountPayloadSchema.safeParse({
        name: request.name,
        type: request.account_type ?? "digital",
        institution: request.institution,
        currency: request.currency ?? "PEN",
        initial_balance: request.amount ?? 0,
      }),
    );
  }

  return parsedOrNull(
    UpdateAccountPayloadSchema.safeParse(
      dropUndefined({
        account_id: request.target_id,
        name: request.name ?? undefined,
        type: request.account_type ?? undefined,
        institution: request.institution ?? undefined,
      }),
    ),
  );
}

/**
 * La subcategoria es la unica entidad de estructura que no lleva dinero
 * encima: su payload entero son dos datos, como se llama y de que categoria
 * cuelga. `category_id` viaja como texto libre desde el modelo y aqui lo
 * estrecha `CATEGORY_IDS`, asi que un id inventado —o el nombre de una
 * categoria que no existe— no propone nada y acaba preguntando.
 */
function buildSubcategoryPayload(
  request: StructureProposalRequest,
  operation: StructureOperation,
): Record<string, unknown> | null {
  if (operation === "create") {
    return parsedOrNull(
      CreateSubcategoryPayloadSchema.safeParse({
        category_id: request.category_id,
        label: request.name,
      }),
    );
  }

  return parsedOrNull(
    UpdateSubcategoryPayloadSchema.safeParse({
      subcategory_id: request.target_id,
      label: request.name,
    }),
  );
}

function parsedOrNull(
  result: { success: true; data: unknown } | { success: false },
): Record<string, unknown> | null {
  return result.success ? (result.data as Record<string, unknown>) : null;
}

function composeStructureQuestionFromAmbiguities(
  request: StructureProposalRequest,
): string {
  const primera = request.ambiguities[0];
  if (primera) return primera;
  return request.entity
    ? composeMissingDataQuestion(
        request.entity,
        operationForIntent(request.intent),
      )
    : "¿Me confirmas qué quieres que cree?";
}

function composeUnsupportedOperationQuestion(
  entity: StructureEntity,
  operation: StructureOperation,
): string {
  // Una subcategoria tiene las tres operaciones que se pueden pedir sobre
  // ella, asi que lo unico que puede faltarle es pausarla o reanudarla, que no
  // significan nada: no genera ocurrencias ni mide un periodo.
  if (entity === "subcategoria") {
    return "Una subcategoría no se pausa: o la dejas como está, o la archivo y deja de aparecer para movimientos nuevos. ¿Qué prefieres?";
  }

  const verbo = operation === "pause" ? "pausar" : "reanudar";
  if (entity === "caja") {
    return `Una caja no se puede ${verbo}: o la dejas como está, o la cierro y te devuelvo el dinero a lo libre. ¿Qué prefieres?`;
  }
  if (entity === "cuenta") {
    return `Una cuenta no se puede ${verbo}: o la dejas como está, o la archivo. ¿Qué prefieres?`;
  }
  return `No puedo ${verbo} eso. ¿Me dices de otra forma qué necesitas?`;
}

function composeMissingDataQuestion(
  entity: StructureEntity,
  operation: StructureOperation,
): string {
  if (operation === "archive") {
    // Una subcategoria no "tiene" nada dentro: los movimientos que la usan
    // siguen apuntando a ella. Preguntarlo con la frase de las demas prometeria
    // una consecuencia que no existe.
    if (entity === "subcategoria") {
      return "¿Cuál subcategoría quieres archivar? Dime cuál y te digo qué pasa con los movimientos que ya la usan.";
    }
    return `¿Cuál ${nombreDe(entity)} quieres cerrar? Dime cuál y te digo qué pasa con lo que tiene antes de tocar nada.`;
  }
  if (operation === "pause" || operation === "resume") {
    const verbo = operation === "pause" ? "pausar" : "reanudar";
    return `¿Cuál ${nombreDe(entity)} quieres ${verbo}?`;
  }

  if (operation === "update") {
    if (entity === "caja") return "¿Cuál caja quieres cambiar, y qué le cambio?";
    if (entity === "meta") return "¿Cuál meta quieres cambiar, y qué le cambio?";
    if (entity === "presupuesto") {
      return "¿Cuál presupuesto quieres cambiar, y a cuánto lo dejo?";
    }
    if (entity === "cuenta") {
      return "¿Cuál cuenta quieres cambiar, y qué le cambio?";
    }
    if (entity === "subcategoria") {
      return "¿Cuál subcategoría quieres renombrar, y cómo la dejo?";
    }
    return "¿Cuál pago recurrente quieres cambiar, y qué le cambio?";
  }

  if (entity === "subcategoria") {
    return "Para crear la subcategoría necesito cómo se llama y dentro de cuál de las 12 categorías va. ¿Me los dices?";
  }
  if (entity === "caja") {
    return "Para crear la caja necesito el nombre y de qué cuenta sale el dinero. ¿Me los dices?";
  }
  if (entity === "meta") {
    return "Para crear la meta necesito el nombre y cuánto quieres juntar. ¿Me los dices?";
  }
  if (entity === "presupuesto") {
    return "Para crear el presupuesto necesito el monto y de qué categoría es. ¿Me los dices?";
  }
  if (entity === "cuenta") {
    return "Para crear la cuenta necesito el nombre y de qué tipo es (banco, digital, efectivo o tarjeta). ¿Me los dices?";
  }
  return "Para anotar ese pago que viene necesito el nombre, cuánto es y cuándo toca la próxima vez. ¿Me los dices?";
}

function nombreDe(entity: StructureEntity): string {
  if (entity === "recurrente") return "pago recurrente";
  if (entity === "subcategoria") return "subcategoría";
  return entity;
}

function defaultSummary(
  entity: StructureEntity,
  operation: StructureOperation,
): string {
  const nombre = nombreDe(entity);
  if (operation === "archive") return `¿Cierro ${articulo(entity)} ${nombre}?`;
  if (operation === "pause") return `¿Pauso ${articulo(entity)} ${nombre}?`;
  if (operation === "resume") return `¿Reanudo ${articulo(entity)} ${nombre}?`;
  const verbo = operation === "create" ? "Creo" : "Cambio";
  return `¿${verbo} ${articulo(entity)} ${nombre}?`;
}

function articulo(entity: StructureEntity): string {
  return entity === "presupuesto" || entity === "recurrente" ? "ese" : "esa";
}

function dropUndefined(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => item !== undefined),
  );
}
