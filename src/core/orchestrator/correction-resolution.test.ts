import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import type { Database } from "@/data/supabase/types";
import type { CategoryId, Movement } from "@/shared/types/domain";
import {
  CORRECTION_CANCEL_COMMAND_ID,
  maybeResolveCorrection,
  parseCorrectionCommandText,
  resolveAwaitingCorrection,
  resolveAwaitingCorrectionCommandText,
} from "./correction-resolution";

const mocks = vi.hoisted(() => ({
  getMovementById: vi.fn(),
}));

vi.mock("@/data/repositories/movements.repository", () => ({
  SupabaseFinancialCoreRepository: class {
    getMovementById = mocks.getMovementById;
  },
}));

const MOVEMENT_ID = "00000000-0000-4000-8000-000000000010";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000021";
const OTHER_MOVEMENT_ID = "00000000-0000-4000-8000-000000000011";
const THREAD_KEY = "hilo:00000000-0000-4000-8000-0000000000aa";
const OTHER_THREAD_KEY = "hilo:00000000-0000-4000-8000-0000000000bb";
const NOW = "2026-08-06T10:00:30.000-05:00";
/** `23` §5b.1: la propuesta vale 15 minutos desde que se hizo. */
const CONFIRMATION_EXPIRES_AT = "2026-08-06T10:15:00.000-05:00";

function workingSet(
  lastAction: ConversationWorkingSet["last_action"],
): ConversationWorkingSet {
  return {
    version: "v1",
    topic: "movement",
    goal: "correct",
    last_user_message_summary: "elimine al gasto de pan porfa",
    last_assistant_result_summary:
      "Creo que te refieres a Pan S/5.00. ¿Lo elimino?",
    last_action: lastAction,
    unresolved_slots: [],
    movement_referents: [MOVEMENT_ID],
    entity_referents: [],
    active_read_operation: null,
    focus_set: null,
    conversation_style: null,
    updated_at: "2026-08-06T10:00:00.000-05:00",
  };
}

function proposedDeleteAction(
  overrides: Partial<NonNullable<ConversationWorkingSet["last_action"]>> = {},
): ConversationWorkingSet["last_action"] {
  return {
    kind: "correction_proposed",
    status: "awaiting_confirmation",
    source_ref: "event-1",
    movement_ids: [MOVEMENT_ID],
    pending_item_ids: [],
    command_ids: [`corr:delete:${MOVEMENT_ID}`],
    thread_key: THREAD_KEY,
    confirmation_expires_at: CONFIRMATION_EXPIRES_AT,
    ...overrides,
  };
}

/** Llamada por defecto: mismo hilo, dentro de la vigencia. */
function resolve(
  text: string,
  lastAction: ConversationWorkingSet["last_action"],
  overrides: { threadKey?: string; now?: string } = {},
) {
  return resolveAwaitingCorrectionCommandText({
    text,
    workingSet: lastAction === null ? null : workingSet(lastAction),
    threadKey: overrides.threadKey ?? THREAD_KEY,
    now: overrides.now ?? NOW,
  });
}

describe("correction command parser", () => {
  it("parsea correccion de monto", () => {
    expect(parseCorrectionCommandText(`corr:amount:${MOVEMENT_ID}:25_50`)).toEqual({
      kind: "amount",
      command_id: `corr:amount:${MOVEMENT_ID}:25_50`,
      movement_id: MOVEMENT_ID,
      amount: 25.5,
    });
  });

  it("parsea correccion de categoria canonica", () => {
    expect(
      parseCorrectionCommandText(`corr:category:${MOVEMENT_ID}:transporte`)
    ).toEqual({
      kind: "category",
      command_id: `corr:category:${MOVEMENT_ID}:transporte`,
      movement_id: MOVEMENT_ID,
      category_id: "transporte",
    });
  });

  it("parsea correccion de cuenta origen", () => {
    expect(
      parseCorrectionCommandText(`corr:acct_origin:${MOVEMENT_ID}:${ACCOUNT_ID}`)
    ).toEqual({
      kind: "account_origin",
      command_id: `corr:acct_origin:${MOVEMENT_ID}:${ACCOUNT_ID}`,
      movement_id: MOVEMENT_ID,
      account_id: ACCOUNT_ID,
      account_field: "account_origin_id",
    });
  });

  it("parsea eliminacion segura", () => {
    expect(parseCorrectionCommandText(`corr:delete:${MOVEMENT_ID}`)).toEqual({
      kind: "delete",
      command_id: `corr:delete:${MOVEMENT_ID}`,
      movement_id: MOVEMENT_ID,
      delete_mode: "soft_delete",
    });
  });

  it("rechaza categoria no canonica", () => {
    expect(parseCorrectionCommandText(`corr:category:${MOVEMENT_ID}:cafes`)).toBeNull();
  });
});

describe("confirmacion escrita de una correccion propuesta", () => {
  it("confirma con texto libre la eliminacion que quedo esperando", () => {
    expect(resolve("si te confirmo eliminalo", proposedDeleteAction())).toBe(
      `corr:delete:${MOVEMENT_ID}`,
    );
  });

  it("confirma con un si suelto", () => {
    expect(resolve("si", proposedDeleteAction())).toBe(
      `corr:delete:${MOVEMENT_ID}`,
    );
  });

  it("confirma 'dale eliminalo' en vez de caducar por cambio de tema (bug de produccion)", () => {
    expect(resolve("dale eliminalo", proposedDeleteAction())).toBe(
      `corr:delete:${MOVEMENT_ID}`,
    );
    expect(
      resolveAwaitingCorrection({
        text: "dale eliminalo",
        workingSet: workingSet(proposedDeleteAction()),
        threadKey: THREAD_KEY,
        now: NOW,
      }),
    ).toMatchObject({ kind: "confirmable" });
  });

  it("confirma con una afirmacion suelta nueva ('dale' solo)", () => {
    expect(resolve("dale", proposedDeleteAction())).toBe(
      `corr:delete:${MOVEMENT_ID}`,
    );
  });

  it("cancela la correccion propuesta cuando el usuario la descarta", () => {
    expect(resolve("cancelar", proposedDeleteAction())).toBe(
      CORRECTION_CANCEL_COMMAND_ID,
    );
  });

  it("no resuelve varios candidatos con un si ambiguo (`16` §10.3)", () => {
    expect(
      resolve(
        "si",
        proposedDeleteAction({
          command_ids: [
            `corr:delete:${MOVEMENT_ID}`,
            `corr:delete:${OTHER_MOVEMENT_ID}`,
          ],
        }),
      ),
    ).toBeNull();
  });

  it("no confirma una correccion ya resuelta", () => {
    expect(
      resolve(
        "si",
        proposedDeleteAction({
          kind: "correction_applied",
          status: "completed",
        }),
      ),
    ).toBeNull();
  });

  it("no confirma cuando la ultima accion no fue una correccion", () => {
    expect(
      resolve(
        "si",
        proposedDeleteAction({ kind: "pending_created", command_ids: [] }),
      ),
    ).toBeNull();
  });

  it("no confirma un texto que no es confirmacion ni descarte", () => {
    expect(resolve("cuanto gaste este mes", proposedDeleteAction())).toBeNull();
  });

  it("no confirma sin memoria conversacional activa", () => {
    expect(resolve("si te confirmo eliminalo", null)).toBeNull();
  });
});

describe("la propuesta pendiente pertenece a un hilo y a un momento (`23` §5b.1)", () => {
  it("un si en otra conversacion no ejecuta la correccion de la primera", () => {
    expect(
      resolve("si", proposedDeleteAction(), { threadKey: OTHER_THREAD_KEY }),
    ).toBeNull();
  });

  it("y esa propuesta ajena no se toca: el hilo dueño la sigue esperando", () => {
    expect(
      resolveAwaitingCorrection({
        text: "si",
        workingSet: workingSet(proposedDeleteAction()),
        threadKey: OTHER_THREAD_KEY,
        now: NOW,
      }),
    ).toEqual({
      kind: "other_thread",
      commandIds: [`corr:delete:${MOVEMENT_ID}`],
    });
  });

  it("un estado sin sello de hilo (anterior al arreglo) no es confirmable", () => {
    expect(
      resolve("si", proposedDeleteAction({ thread_key: null })),
    ).toBeNull();
    expect(
      resolveAwaitingCorrection({
        text: "si",
        workingSet: workingSet(proposedDeleteAction({ thread_key: null })),
        threadKey: THREAD_KEY,
        now: NOW,
      }),
    ).toMatchObject({ kind: "lapsed_confirmation", reason: "thread_unknown" });
  });

  it("pasados los 15 minutos la confirmacion ya no ejecuta nada", () => {
    const tarde = "2026-08-06T10:15:01.000-05:00";
    expect(resolve("si", proposedDeleteAction(), { now: tarde })).toBeNull();
    expect(
      resolveAwaitingCorrection({
        text: "si",
        workingSet: workingSet(proposedDeleteAction()),
        threadKey: THREAD_KEY,
        now: tarde,
      }),
    ).toMatchObject({
      kind: "lapsed_confirmation",
      reason: "confirmation_window_expired",
    });
  });

  it("sin sello de vigencia tampoco se confirma", () => {
    expect(
      resolve("si", proposedDeleteAction({ confirmation_expires_at: null })),
    ).toBeNull();
  });

  it("un turno de otro tema caduca la propuesta en vez de dejarla armada", () => {
    expect(
      resolveAwaitingCorrection({
        text: "hola",
        workingSet: workingSet(proposedDeleteAction()),
        threadKey: THREAD_KEY,
        now: NOW,
      }),
    ).toEqual({
      kind: "lapsed_by_topic_change",
      commandIds: [`corr:delete:${MOVEMENT_ID}`],
    });
  });

  it("una propuesta ya caducada no vuelve a ser confirmable", () => {
    expect(
      resolve("si", proposedDeleteAction({ status: "expired", command_ids: [] })),
    ).toBeNull();
  });
});

const client = {} as SupabaseClient<Database>;
const USER_ID = "00000000-0000-4000-8000-0000000000f1";

function movement(overrides: Partial<Movement> = {}): Movement {
  return {
    id: MOVEMENT_ID,
    user_id: USER_ID,
    type: "gasto",
    status: "confirmed",
    amount: 45,
    currency: "PEN",
    occurred_at: "2026-08-09T15:00:00.000Z",
    description: "comida de los gatos",
    merchant: null,
    category_id: "vivienda_hogar",
    subcategory_id: null,
    source: "dashboard_manual",
    source_ref: null,
    idempotency_key: "mov-1",
    confidence: 1,
    requires_review: false,
    account_origin_id: null,
    account_destination_id: null,
    box_origin_id: null,
    box_destination_id: null,
    debt_id: null,
    recurring_rule_id: null,
    recurring_occurrence_id: null,
    related_person_id: null,
    affects_total_balance: true,
    affects_account_balance: true,
    created_at: "2026-08-09T15:00:00.000Z",
    updated_at: "2026-08-09T15:00:00.000Z",
    deleted_at: null,
    metadata: {},
    ...overrides,
  };
}

/**
 * Confirma una correccion de categoria que el movimiento ya tiene aplicada.
 * Esa rama devuelve el mismo `summary` que la que escribe, y es la que llega
 * al usuario, asi que es donde se comprueba como se nombra la categoria.
 */
async function resolveCategoryCorrection(categoryId: CategoryId) {
  return maybeResolveCorrection({
    client,
    userId: USER_ID,
    text: `corr:category:${MOVEMENT_ID}:${categoryId}`,
    traceId: "00000000-0000-4000-8000-0000000000a1",
  });
}

describe("la categoria se nombra como la nombra el catalogo", () => {
  beforeEach(() => {
    mocks.getMovementById.mockReset();
  });

  it("una categoria con barra y tilde llega entera al resumen, no como su id suavizado", async () => {
    // El resumen viaja al usuario. Suavizar el id a mano —cambiar los guiones
    // bajos por espacios— producia "Vivienda hogar": sin la tilde y sin la
    // barra que si tiene la etiqueta real que siembra la base.
    mocks.getMovementById.mockResolvedValue(
      movement({ category_id: "vivienda_hogar" }),
    );

    const result = await resolveCategoryCorrection("vivienda_hogar");

    expect(result.kind).toBe("applied");
    if (result.kind !== "applied") return;
    expect(result.summary).toBe(
      "Comida de los gatos S/45.00 a categoria Vivienda / Hogar",
    );
  });

  it("una categoria de una sola palabra conserva su acento", async () => {
    mocks.getMovementById.mockResolvedValue(
      movement({ category_id: "alimentacion", description: "menu del dia" }),
    );

    const result = await resolveCategoryCorrection("alimentacion");

    expect(result.kind).toBe("applied");
    if (result.kind !== "applied") return;
    expect(result.summary).toContain("Alimentación");
  });
});
