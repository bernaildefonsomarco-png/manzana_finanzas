import { describe, expect, it } from "vitest";
import type { ConversationWorkingSet } from "@/agents/conversation-agent/types";
import {
  buildPreferenceCommandText,
  isPreferenceCommandText,
  isPreferenceConfirmationText,
  isPreferenceDiscardText,
  parsePreferenceCommandText,
  PREFERENCE_CANCEL_COMMAND_ID,
  readStoredPreferenceProposal,
  resolveAwaitingPreference,
  type PreferenceProposal,
} from "./preference-proposal";

const PROPOSAL_ID = "11111111-1111-4111-8111-111111111111";
const THREAD = "thread-1";
const NOW = "2026-08-11T12:00:00.000Z";

function proposal(
  overrides: Partial<PreferenceProposal> = {},
): PreferenceProposal {
  return {
    proposal_id: PROPOSAL_ID,
    command: "silenciar_tipo_recordatorio",
    nivel: "tarjeta",
    payload: {
      command: "silenciar_tipo_recordatorio",
      activar: true,
      tipo: "presupuesto_umbral",
    },
    summary: "¿Dejo de avisarte sobre los presupuestos cerca del límite?",
    confirm_label: "Sí, deja de avisarme",
    proposed_at: NOW,
    ...overrides,
  };
}

function workingSet(
  overrides: {
    kind?: NonNullable<ConversationWorkingSet["last_action"]>["kind"];
    status?: NonNullable<ConversationWorkingSet["last_action"]>["status"];
    threadKey?: string | null;
    expiresAt?: string | null;
    proposal?: PreferenceProposal | null;
  } = {},
): ConversationWorkingSet {
  return {
    version: "v1",
    topic: "support",
    goal: "confirm",
    last_user_message_summary: "no me avises de los presupuestos",
    last_assistant_result_summary: "¿Dejo de avisarte?",
    last_action: {
      kind: overrides.kind ?? "preference_proposed",
      status: overrides.status ?? "awaiting_confirmation",
      source_ref: "event-1",
      movement_ids: [],
      pending_item_ids: [],
      command_ids: [buildPreferenceCommandText(PROPOSAL_ID)],
      thread_key: overrides.threadKey === undefined ? THREAD : overrides.threadKey,
      confirmation_expires_at:
        overrides.expiresAt === undefined
          ? "2026-08-11T12:15:00.000Z"
          : overrides.expiresAt,
    },
    unresolved_slots: [],
    movement_referents: [],
    entity_referents: [],
    active_read_operation: null,
    preference_proposal:
      overrides.proposal === undefined
        ? (proposal() as unknown as Record<string, unknown>)
        : (overrides.proposal as unknown as Record<string, unknown> | null),
    conversation_style: null,
    updated_at: NOW,
  };
}

describe("texto de comando `pref:`", () => {
  it("reconoce el suyo y no el de otro dominio", () => {
    expect(isPreferenceCommandText(buildPreferenceCommandText(PROPOSAL_ID))).toBe(
      true,
    );
    expect(isPreferenceCommandText(PREFERENCE_CANCEL_COMMAND_ID)).toBe(true);
    expect(isPreferenceCommandText(`estr:${PROPOSAL_ID}`)).toBe(false);
    expect(isPreferenceCommandText(`mem:${PROPOSAL_ID}`)).toBe(false);
  });

  it("un id que no es un UUID no se parsea", () => {
    expect(parsePreferenceCommandText("pref:cualquier-cosa")).toBeNull();
    expect(parsePreferenceCommandText(`pref:${PROPOSAL_ID}:extra`)).toBeNull();
    expect(parsePreferenceCommandText(PREFERENCE_CANCEL_COMMAND_ID)).toEqual({
      kind: "cancel",
      command_id: PREFERENCE_CANCEL_COMMAND_ID,
    });
  });
});

describe("RUL-PREF-03: matchers propios, no prestados de otro dominio", () => {
  // La razon de existir de estos matchers. Las preguntas de este modulo son
  // negativas ("¿dejo de avisarte?"), y la forma natural de decir que si a una
  // pregunta negativa empieza por "no". Los matchers de estructura y de memoria
  // empiezan su descarte por /^no\b/, asi que reusarlos convertiria cada uno de
  // estos "si" en una cancelacion silenciosa.
  const reformulaciones = [
    "no me avises",
    "no me molestes",
    "no me escribas de noche",
    "no me notifiques mas",
    "no me mandes nada",
    "no quiero mas correos",
    "no quiero recordatorios",
    "no vuelvas a avisarme",
  ];

  it.each(reformulaciones)(
    "«%s» confirma una propuesta que calla algo, y no la descarta",
    (texto) => {
      expect(isPreferenceConfirmationText(texto, true)).toBe(true);
      expect(isPreferenceDiscardText(texto, true)).toBe(false);
    },
  );

  // El mismo fallo por el otro lado. Ante "¿Reanudo tus recordatorios?", "no me
  // avises" significa **no**: el usuario repite que quiere silencio. Leerlo como
  // un si reanudaria justo lo que pidio callar.
  it.each(reformulaciones)(
    "«%s» descarta una propuesta que vuelve a hacer ruido",
    (texto) => {
      expect(isPreferenceDiscardText(texto, false)).toBe(true);
      expect(isPreferenceConfirmationText(texto, false)).toBe(false);
    },
  );

  const confirmaciones = [
    "si",
    "sí",
    "dale",
    "ok",
    "hazlo",
    "sí, pausa los avisos",
    "silencialo",
    "reanuda",
  ];

  it.each(confirmaciones)("«%s» confirma", (texto) => {
    expect(isPreferenceConfirmationText(texto)).toBe(true);
  });

  const descartes = [
    "no",
    "no gracias",
    "no por ahora",
    "mejor no",
    "cancela",
    "déjalo así",
    "así está bien",
  ];

  it.each(descartes)("«%s» descarta", (texto) => {
    expect(isPreferenceDiscardText(texto)).toBe(true);
    expect(isPreferenceConfirmationText(texto)).toBe(false);
  });

  it("un texto cualquiera no es ni una cosa ni la otra", () => {
    for (const silencio of [true, false]) {
      expect(isPreferenceConfirmationText("¿cuánto gasté ayer?", silencio)).toBe(
        false,
      );
      expect(isPreferenceDiscardText("¿cuánto gasté ayer?", silencio)).toBe(
        false,
      );
    }
  });
});

describe("la direccion de la propuesta decide como se lee «no me avises»", () => {
  it("ante «¿dejo de avisarte?», confirma y silencia", () => {
    const awaiting = resolveAwaitingPreference({
      text: "no me avises",
      workingSet: workingSet(),
      threadKey: THREAD,
      now: NOW,
    });
    expect(awaiting.kind).toBe("confirmable");
    if (awaiting.kind === "confirmable") {
      expect(awaiting.commandText).toBe(buildPreferenceCommandText(PROPOSAL_ID));
    }
  });

  it("ante «¿vuelvo a avisarte?», la misma frase cancela", () => {
    const awaiting = resolveAwaitingPreference({
      text: "no me avises",
      workingSet: workingSet({
        proposal: proposal({
          payload: {
            command: "silenciar_tipo_recordatorio",
            activar: false,
            tipo: "presupuesto_umbral",
          },
          summary: "¿Vuelvo a avisarte sobre los presupuestos?",
        }),
      }),
      threadKey: THREAD,
      now: NOW,
    });
    expect(awaiting.kind).toBe("confirmable");
    if (awaiting.kind === "confirmable") {
      expect(awaiting.commandText).toBe(PREFERENCE_CANCEL_COMMAND_ID);
    }
  });

  it("ante «¿te escribo al correo?», «no me escribas» cancela", () => {
    const awaiting = resolveAwaitingPreference({
      text: "no me escribas",
      workingSet: workingSet({
        proposal: proposal({
          command: "activar_correo_recordatorios",
          nivel: "consentimiento",
          payload: {
            command: "activar_correo_recordatorios",
            activar: true,
            tipo: "cuota_proxima",
          },
          summary: "¿Te escribo al correo sobre las cuotas que vienen?",
        }),
      }),
      threadKey: THREAD,
      now: NOW,
    });
    expect(awaiting.kind).toBe("confirmable");
    if (awaiting.kind === "confirmable") {
      expect(awaiting.commandText).toBe(PREFERENCE_CANCEL_COMMAND_ID);
    }
  });
});

describe("resolveAwaitingPreference: hilo, vigencia y estado", () => {
  it("un «si» en el mismo hilo y dentro de la ventana es confirmable", () => {
    const awaiting = resolveAwaitingPreference({
      text: "sí",
      workingSet: workingSet(),
      threadKey: THREAD,
      now: NOW,
    });
    expect(awaiting.kind).toBe("confirmable");
    if (awaiting.kind === "confirmable") {
      expect(awaiting.commandText).toBe(buildPreferenceCommandText(PROPOSAL_ID));
    }
  });

  it("un «no» en el mismo hilo cancela por el comando de cancelacion", () => {
    const awaiting = resolveAwaitingPreference({
      text: "no, mejor no",
      workingSet: workingSet(),
      threadKey: THREAD,
      now: NOW,
    });
    expect(awaiting.kind).toBe("confirmable");
    if (awaiting.kind === "confirmable") {
      expect(awaiting.commandText).toBe(PREFERENCE_CANCEL_COMMAND_ID);
    }
  });

  it("una propuesta de otro hilo no la toca este turno", () => {
    expect(
      resolveAwaitingPreference({
        text: "sí",
        workingSet: workingSet(),
        threadKey: "otro-hilo",
        now: NOW,
      }).kind,
    ).toBe("other_thread");
  });

  it("fuera de la ventana, la confirmacion caduca en vez de ejecutarse", () => {
    expect(
      resolveAwaitingPreference({
        text: "sí",
        workingSet: workingSet(),
        threadKey: THREAD,
        now: "2026-08-11T12:30:00.000Z",
      }),
    ).toEqual({
      kind: "lapsed_confirmation",
      reason: "confirmation_window_expired",
    });
  });

  it("sin sello de hilo, la confirmacion escrita no vale", () => {
    expect(
      resolveAwaitingPreference({
        text: "sí",
        workingSet: workingSet({ threadKey: null }),
        threadKey: THREAD,
        now: NOW,
      }),
    ).toEqual({ kind: "lapsed_confirmation", reason: "thread_unknown" });
  });

  it("sin sello de vigencia se considera vencida: el lado seguro", () => {
    expect(
      resolveAwaitingPreference({
        text: "sí",
        workingSet: workingSet({ expiresAt: null }),
        threadKey: THREAD,
        now: NOW,
      }),
    ).toEqual({
      kind: "lapsed_confirmation",
      reason: "confirmation_window_expired",
    });
  });

  it("un turno que habla de otra cosa caduca la propuesta", () => {
    expect(
      resolveAwaitingPreference({
        text: "¿cuánto gasté ayer?",
        workingSet: workingSet(),
        threadKey: THREAD,
        now: NOW,
      }).kind,
    ).toBe("lapsed_by_topic_change");
  });

  it("sin propuesta viva, no hay nada que resolver", () => {
    expect(
      resolveAwaitingPreference({
        text: "sí",
        workingSet: null,
        threadKey: THREAD,
        now: NOW,
      }).kind,
    ).toBe("none");
    expect(
      resolveAwaitingPreference({
        text: "sí",
        workingSet: workingSet({ kind: "memory_proposed" }),
        threadKey: THREAD,
        now: NOW,
      }).kind,
    ).toBe("none");
    expect(
      resolveAwaitingPreference({
        text: "sí",
        workingSet: workingSet({ status: "completed" }),
        threadKey: THREAD,
        now: NOW,
      }).kind,
    ).toBe("none");
  });
});

describe("readStoredPreferenceProposal", () => {
  it("un borrador corrupto devuelve null en vez de romper el turno", () => {
    expect(readStoredPreferenceProposal(null)).toBeNull();
    expect(
      readStoredPreferenceProposal(workingSet({ proposal: null })),
    ).toBeNull();
    expect(
      readStoredPreferenceProposal({
        ...workingSet(),
        preference_proposal: { proposal_id: "no-es-uuid" },
      }),
    ).toBeNull();
  });

  it("un comando que no es de catalogo no sobrevive a la relectura", () => {
    expect(
      readStoredPreferenceProposal({
        ...workingSet(),
        preference_proposal: {
          ...(proposal() as unknown as Record<string, unknown>),
          command: "borrar_toda_la_cuenta",
        },
      }),
    ).toBeNull();
  });
});
