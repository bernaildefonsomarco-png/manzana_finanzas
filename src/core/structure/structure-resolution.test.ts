import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import type { Database } from "@/data/supabase/types";
import {
  maybeResolveStructure,
  readStoredStructureProposal,
  resolveAwaitingStructure,
} from "./structure-resolution";
import type { StructureProposal } from "./structure-proposal";

const executeStructureCommand = vi.hoisted(() => vi.fn());
vi.mock("./structure-executor", () => ({ executeStructureCommand }));

const USER_ID = "00000000-0000-4000-8000-0000000000f1";
const OTHER_USER_ID = "00000000-0000-4000-8000-0000000000f2";
const ACCOUNT_ID = "00000000-0000-4000-8000-000000000001";
const PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c1";
const OTHER_PROPOSAL_ID = "00000000-0000-4000-8000-0000000000c2";
const THREAD_KEY = "hilo:00000000-0000-4000-8000-0000000000aa";
const OTHER_THREAD_KEY = "hilo:00000000-0000-4000-8000-0000000000bb";
const NOW = "2026-08-09T10:00:30.000-05:00";
const EXPIRES_AT = "2026-08-09T10:15:00.000-05:00";

const client = {} as SupabaseClient<Database>;

function proposal(
  overrides: Partial<StructureProposal> = {},
): StructureProposal {
  return {
    proposal_id: PROPOSAL_ID,
    entity: "caja",
    operation: "create",
    command_type: "CreateBoxCommand",
    payload: {
      name: "Viaje",
      account_id: ACCOUNT_ID,
      type: "objetivo",
      initial_balance: 500,
      target_amount: null,
      target_date: null,
    },
    summary: "¿Creo la caja Viaje y aparto S/500?",
    confirm_label: "Sí, crear la caja",
    proposed_at: "2026-08-09T10:00:00.000-05:00",
    ...overrides,
  };
}

function workingSet(
  overrides: {
    lastAction?: ConversationWorkingSet["last_action"];
    structureProposal?: Record<string, unknown> | null;
  } = {},
): ConversationWorkingSet {
  return {
    version: "v1",
    topic: "balance",
    goal: "confirm",
    last_user_message_summary: "apartame 500 para el viaje",
    last_assistant_result_summary: "¿Creo la caja Viaje y aparto S/500?",
    last_action:
      overrides.lastAction === undefined
        ? {
            kind: "structure_proposed",
            status: "awaiting_confirmation",
            source_ref: "event-1",
            movement_ids: [],
            pending_item_ids: [],
            command_ids: [`estr:${PROPOSAL_ID}`],
            thread_key: THREAD_KEY,
            confirmation_expires_at: EXPIRES_AT,
          }
        : overrides.lastAction,
    unresolved_slots: [],
    movement_referents: [],
    entity_referents: [],
    active_read_operation: null,
    focus_set: null,
    structure_proposal:
      overrides.structureProposal === undefined
        ? (proposal() as unknown as Record<string, unknown>)
        : overrides.structureProposal,
    conversation_style: null,
    updated_at: "2026-08-09T10:00:00.000-05:00",
  };
}

function resolve(
  text: string,
  overrides: {
    workingSet?: ConversationWorkingSet | null;
    threadKey?: string;
    now?: string;
  } = {},
) {
  return resolveAwaitingStructure({
    text,
    workingSet:
      overrides.workingSet === undefined ? workingSet() : overrides.workingSet,
    threadKey: overrides.threadKey ?? THREAD_KEY,
    now: overrides.now ?? NOW,
  });
}

beforeEach(() => {
  executeStructureCommand.mockReset();
  executeStructureCommand.mockResolvedValue({
    kind: "applied",
    entity: "caja",
    operation: "create",
    entity_id: "00000000-0000-4000-8000-0000000000b1",
    summary: "la caja Viaje con S/500.00 apartados",
    idempotent: false,
  });
});

describe("RUL-ESTR-03: nada se escribe sin confirmación", () => {
  it("un 'sí' del mismo hilo y dentro de la vigencia es confirmable", () => {
    expect(resolve("si, crea la caja")).toMatchObject({
      kind: "confirmable",
      commandText: `estr:${PROPOSAL_ID}`,
    });
  });

  it("un 'no' del mismo hilo resuelve como cancelación, no como creación", () => {
    expect(resolve("no, mejor no")).toMatchObject({
      kind: "confirmable",
      commandText: "estr:cancel",
    });
  });

  it("sin propuesta viva no hay nada que confirmar", () => {
    expect(resolve("si", { workingSet: null })).toEqual({ kind: "none" });
  });

  it("un turno que no confirma ni descarta caduca la propuesta", () => {
    expect(resolve("cuanto gaste ayer")).toEqual({
      kind: "lapsed_by_topic_change",
    });
  });

  it("un 'sí' fuera de la ventana de 15 minutos no ejecuta nada", () => {
    expect(resolve("si", { now: "2026-08-09T10:20:00.000-05:00" })).toEqual({
      kind: "lapsed_confirmation",
      reason: "confirmation_window_expired",
    });
  });

  it("una propuesta sin sello de hilo no es confirmable por escrito", () => {
    const sinHilo = workingSet({
      lastAction: {
        kind: "structure_proposed",
        status: "awaiting_confirmation",
        source_ref: "event-1",
        movement_ids: [],
        pending_item_ids: [],
        command_ids: [`estr:${PROPOSAL_ID}`],
        thread_key: null,
        confirmation_expires_at: EXPIRES_AT,
      },
    });
    expect(resolve("si", { workingSet: sinHilo })).toEqual({
      kind: "lapsed_confirmation",
      reason: "thread_unknown",
    });
  });

  it("un 'sí' de otra conversación no toca la propuesta ajena", () => {
    expect(resolve("si", { threadKey: OTHER_THREAD_KEY })).toEqual({
      kind: "other_thread",
    });
  });

  it("una última acción que no es propuesta de estructura no confirma nada", () => {
    const otra = workingSet({
      lastAction: {
        kind: "movement_created",
        status: "completed",
        source_ref: "event-1",
        movement_ids: [],
        pending_item_ids: [],
        command_ids: [],
        thread_key: THREAD_KEY,
        confirmation_expires_at: null,
      },
    });
    expect(resolve("si", { workingSet: otra })).toEqual({ kind: "none" });
  });

  it("un borrador corrupto no se convierte en una escritura", () => {
    const corrupto = workingSet({
      structureProposal: { proposal_id: "no-es-un-uuid" },
    });
    expect(resolve("si", { workingSet: corrupto })).toEqual({ kind: "none" });
    expect(readStoredStructureProposal(corrupto)).toBeNull();
  });
});

describe("ejecución de la propuesta confirmada", () => {
  it("un 'sí' confirmado ejecuta el comando tipado del borrador", async () => {
    const resultado = await maybeResolveStructure({
      client,
      userId: USER_ID,
      text: `estr:${PROPOSAL_ID}`,
      proposal: proposal(),
      traceId: "trace-1",
      source: "orchestrator.structure_confirm",
      movementSource: "dashboard_manual",
    });

    expect(resultado).toMatchObject({
      kind: "applied",
      reason: "structure_applied",
      entity: "caja",
      operation: "create",
      idempotent: false,
    });

    const [call] = executeStructureCommand.mock.calls;
    expect(call[0].command).toMatchObject({
      type: "CreateBoxCommand",
      user_id: USER_ID,
      actor: { type: "user", id: USER_ID },
      // Idempotencia derivada del borrador, no del turno.
      idempotency_key: `structure:${PROPOSAL_ID}`,
      payload: { name: "Viaje", account_id: ACCOUNT_ID },
    });
    expect(call[0].movementSource).toBe("dashboard_manual");
  });

  it("un doble envío del mismo botón repite la misma clave de idempotencia", async () => {
    const enviar = () =>
      maybeResolveStructure({
        client,
        userId: USER_ID,
        text: `estr:${PROPOSAL_ID}`,
        proposal: proposal(),
        traceId: "trace-1",
        source: "orchestrator.structure_confirm",
        movementSource: "dashboard_manual",
      });

    await enviar();
    executeStructureCommand.mockResolvedValueOnce({
      kind: "applied",
      entity: "caja",
      operation: "create",
      entity_id: "00000000-0000-4000-8000-0000000000b1",
      summary: "la caja Viaje con S/500.00 apartados",
      idempotent: true,
    });
    const segundo = await enviar();

    const claves = executeStructureCommand.mock.calls.map(
      ([params]) => params.command.idempotency_key,
    );
    expect(claves).toEqual([
      `structure:${PROPOSAL_ID}`,
      `structure:${PROPOSAL_ID}`,
    ]);
    expect(segundo).toMatchObject({
      kind: "applied",
      reason: "already_applied",
      idempotent: true,
    });
  });

  it("cancelar no ejecuta absolutamente nada", async () => {
    const resultado = await maybeResolveStructure({
      client,
      userId: USER_ID,
      text: "estr:cancel",
      proposal: proposal(),
      traceId: "trace-1",
      source: "orchestrator.structure_confirm",
      movementSource: "dashboard_manual",
    });

    expect(resultado).toMatchObject({
      kind: "cancelled",
      reason: "user_cancelled_structure",
    });
    expect(executeStructureCommand).not.toHaveBeenCalled();
  });

  it("un identificador de propuesta que no es el guardado no escribe nada", async () => {
    const resultado = await maybeResolveStructure({
      client,
      userId: USER_ID,
      text: `estr:${OTHER_PROPOSAL_ID}`,
      proposal: proposal(),
      traceId: "trace-1",
      source: "orchestrator.structure_confirm",
      movementSource: "dashboard_manual",
    });

    expect(resultado).toMatchObject({
      kind: "failed",
      reason: "unknown_proposal",
    });
    expect(executeStructureCommand).not.toHaveBeenCalled();
  });

  it("sin borrador guardado, un comando suelto no crea nada", async () => {
    const resultado = await maybeResolveStructure({
      client,
      userId: USER_ID,
      text: `estr:${PROPOSAL_ID}`,
      proposal: null,
      traceId: "trace-1",
      source: "orchestrator.structure_confirm",
      movementSource: "dashboard_manual",
    });

    expect(resultado).toMatchObject({
      kind: "failed",
      reason: "unknown_proposal",
    });
    expect(executeStructureCommand).not.toHaveBeenCalled();
  });

  it("un texto que no es comando de estructura se deja pasar", async () => {
    const resultado = await maybeResolveStructure({
      client,
      userId: USER_ID,
      text: "cuanto gaste ayer",
      proposal: proposal(),
      traceId: "trace-1",
      source: "orchestrator.structure_confirm",
      movementSource: "dashboard_manual",
    });

    expect(resultado.kind).toBe("not_structure_command");
    expect(executeStructureCommand).not.toHaveBeenCalled();
  });
});

describe("aislamiento por usuario", () => {
  it("el comando ejecutado lleva siempre el usuario del turno, no el del borrador", async () => {
    await maybeResolveStructure({
      client,
      userId: OTHER_USER_ID,
      text: `estr:${PROPOSAL_ID}`,
      // Aunque el borrador viniera manipulado con otro dueño, el comando se
      // arma con el usuario autenticado del turno.
      proposal: proposal({
        payload: {
          name: "Viaje",
          account_id: ACCOUNT_ID,
          type: "objetivo",
          initial_balance: 500,
          target_amount: null,
          target_date: null,
          user_id: USER_ID,
        },
      }),
      traceId: "trace-1",
      source: "orchestrator.structure_confirm",
      movementSource: "dashboard_manual",
    });

    const [call] = executeStructureCommand.mock.calls;
    expect(call[0].command.user_id).toBe(OTHER_USER_ID);
    expect(call[0].command.actor).toEqual({
      type: "user",
      id: OTHER_USER_ID,
    });
    expect(call[0].command.idempotency_key).toBe(`structure:${PROPOSAL_ID}`);
  });
});

describe("RUL-ESTR-05: un cierre no ocurre sin que el usuario lo diga", () => {
  const CIERRE_ID = "00000000-0000-4000-8000-0000000000c9";

  function cierre(): StructureProposal {
    return proposal({
      proposal_id: CIERRE_ID,
      operation: "archive",
      command_type: "ArchiveBoxCommand",
      payload: { box_id: "00000000-0000-4000-8000-000000000002" },
      summary:
        "Ojo con esto: al cerrar la caja, el dinero vuelve a tu saldo libre. ¿Cierro la caja Viaje?",
      confirm_label: "Sí, archívalo",
    });
  }

  it("cambiar de tema con un cierre pendiente lo caduca, no lo ejecuta", () => {
    const awaiting = resolve("cuanto gaste ayer", {
      workingSet: workingSet({
        structureProposal: cierre() as unknown as Record<string, unknown>,
      }),
    });

    expect(awaiting.kind).toBe("lapsed_by_topic_change");
    expect(executeStructureCommand).not.toHaveBeenCalled();
  });

  it("un 'no' descarta el cierre sin tocar nada", async () => {
    const resultado = await maybeResolveStructure({
      client,
      userId: USER_ID,
      text: "estr:cancel",
      proposal: cierre(),
      traceId: "trace-1",
      source: "orchestrator.structure_confirm",
      movementSource: "dashboard_manual",
    });

    expect(resultado).toMatchObject({
      kind: "cancelled",
      entity: "caja",
      operation: "archive",
    });
    expect(executeStructureCommand).not.toHaveBeenCalled();
  });

  it("pulsar dos veces el botón de cerrar repite la misma clave", async () => {
    const enviar = () =>
      maybeResolveStructure({
        client,
        userId: USER_ID,
        text: `estr:${CIERRE_ID}`,
        proposal: cierre(),
        traceId: "trace-1",
        source: "orchestrator.structure_confirm",
        movementSource: "dashboard_manual",
      });

    await enviar();
    await enviar();

    const claves = executeStructureCommand.mock.calls.map(
      ([params]) => params.command.idempotency_key,
    );
    expect(claves).toEqual([
      `structure:${CIERRE_ID}`,
      `structure:${CIERRE_ID}`,
    ]);
    expect(executeStructureCommand.mock.calls[0][0].command.type).toBe(
      "ArchiveBoxCommand",
    );
  });
});
