import { describe, expect, it } from "vitest";
import type { ProfileCandidateRow } from "@/data/repositories/profile-candidates.repository";
import {
  buildProfileCommandText,
  decidirPreguntaDePerfil,
  parseProfileCommandText,
  resolveAwaitingProfileConfirmation,
} from "./profile-confirmation-turn";

const AHORA = "2026-08-11T15:00:00.000Z";
const ESTADO = "11111111-1111-4111-8111-111111111111";
const CANDIDATO_ID = "22222222-2222-4222-8222-222222222222";

function candidato(
  overrides: Partial<ProfileCandidateRow> = {},
): ProfileCandidateRow {
  return {
    id: CANDIDATO_ID,
    subject_key: "vida:cobro",
    statement: "Cobras el 15 y el último día del mes",
    status: "observado",
    ask_count: 0,
    evidence_refs: ["evento:abc"],
    last_asked_at: null,
    metadata: { desbloquea: "poder decirte si llegas a fin de mes" },
    created_at: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("decidirPreguntaDePerfil (`AC-PERF-02`)", () => {
  it("nunca pregunta en el primer turno de la conversación", () => {
    const decision = decidirPreguntaDePerfil({
      candidatos: [candidato()],
      conversationStateId: null,
      now: AHORA,
    });
    expect(decision.preguntar).toBe(false);
  });

  it("pregunta una vez cuando ya hay conversación abierta", () => {
    const decision = decidirPreguntaDePerfil({
      candidatos: [candidato()],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(decision.preguntar).toBe(true);
    if (!decision.preguntar) return;
    expect(decision.candidato.id).toBe(CANDIDATO_ID);
    expect(decision.block).toEqual({
      kind: "pregunta",
      text: "Cobras el 15 y el último día del mes ¿Es así?",
      options: [
        { id: buildProfileCommandText(CANDIDATO_ID, "confirm"), label: "Sí, es así" },
        { id: buildProfileCommandText(CANDIDATO_ID, "reject"), label: "No exactamente" },
        {
          id: buildProfileCommandText(CANDIDATO_ID, "never_ask"),
          label: "No preguntar esto",
        },
      ],
    });
  });

  it("no pregunta dos veces en la misma conversación", () => {
    const yaPreguntado = candidato({
      status: "pending_confirmation",
      ask_count: 1,
      last_asked_at: "2026-08-11T14:55:00.000Z",
      metadata: {
        desbloquea: "poder decirte si llegas a fin de mes",
        asked_conversation_state_id: ESTADO,
      },
    });
    const otro = candidato({
      id: "33333333-3333-4333-8333-333333333333",
      subject_key: "vida:trabajo",
    });
    const decision = decidirPreguntaDePerfil({
      candidatos: [yaPreguntado, otro],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(decision.preguntar).toBe(false);
  });

  it("`20c` §3: dos veces ignorado y no se vuelve a preguntar por ese hecho", () => {
    const decision = decidirPreguntaDePerfil({
      candidatos: [
        candidato({
          ask_count: 2,
          last_asked_at: "2020-01-01T00:00:00.000Z",
          status: "pending_confirmation",
        }),
      ],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(decision.preguntar).toBe(false);
  });

  it("`20c` §3: un candidato que no desbloquea nada no se pregunta", () => {
    const decision = decidirPreguntaDePerfil({
      candidatos: [candidato({ metadata: {} })],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(decision.preguntar).toBe(false);
  });

  it("`20c` §2: la capa vínculo descansa entre preguntas más que la capa vida", () => {
    const haceUnaSemana = "2026-08-04T15:00:00.000Z";
    const vinculo = candidato({
      subject_key: "vinculo:preocupacion",
      status: "pending_confirmation",
      ask_count: 1,
      last_asked_at: haceUnaSemana,
    });
    expect(
      decidirPreguntaDePerfil({
        candidatos: [vinculo],
        conversationStateId: ESTADO,
        now: AHORA,
      }).preguntar,
    ).toBe(false);

    const vida = candidato({
      subject_key: "vida:cobro",
      status: "pending_confirmation",
      ask_count: 1,
      last_asked_at: haceUnaSemana,
    });
    expect(
      decidirPreguntaDePerfil({
        candidatos: [vida],
        conversationStateId: ESTADO,
        now: AHORA,
      }).preguntar,
    ).toBe(true);
  });
});

describe("resolveAwaitingProfileConfirmation", () => {
  const preguntado = candidato({
    status: "pending_confirmation",
    ask_count: 1,
    last_asked_at: "2026-08-11T14:58:00.000Z",
    metadata: {
      desbloquea: "poder decirte si llegas a fin de mes",
      asked_conversation_state_id: ESTADO,
    },
  });

  it("el id del botón resuelve sin depender del texto", () => {
    const resultado = resolveAwaitingProfileConfirmation({
      text: buildProfileCommandText(CANDIDATO_ID, "confirm"),
      candidatos: [preguntado],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(resultado).toEqual({
      kind: "answered",
      candidato: preguntado,
      answer: "confirm",
    });
  });

  it("un 'sí, exacto' escrito confirma el candidato que se preguntó", () => {
    const resultado = resolveAwaitingProfileConfirmation({
      text: "sí, exacto",
      candidatos: [preguntado],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(resultado.kind).toBe("answered");
    if (resultado.kind !== "answered") return;
    expect(resultado.answer).toBe("confirm");
  });

  it("'no exactamente' rechaza, no confirma", () => {
    const resultado = resolveAwaitingProfileConfirmation({
      text: "no exactamente",
      candidatos: [preguntado],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(resultado.kind).toBe("answered");
    if (resultado.kind !== "answered") return;
    expect(resultado.answer).toBe("reject");
  });

  it("'no me preguntes esto' cierra el tema, no lo rechaza sin más", () => {
    const resultado = resolveAwaitingProfileConfirmation({
      text: "no me preguntes esto",
      candidatos: [preguntado],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(resultado.kind).toBe("answered");
    if (resultado.kind !== "answered") return;
    expect(resultado.answer).toBe("never_ask");
  });

  it("un 'sí' fuera de la ventana de 15 minutos no confirma nada", () => {
    const resultado = resolveAwaitingProfileConfirmation({
      text: "sí",
      candidatos: [
        { ...preguntado, last_asked_at: "2026-08-11T14:30:00.000Z" },
      ],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(resultado.kind).toBe("none");
  });

  it("un 'sí' de otra conversación no confirma nada", () => {
    const resultado = resolveAwaitingProfileConfirmation({
      text: "sí",
      candidatos: [preguntado],
      conversationStateId: "44444444-4444-4444-8444-444444444444",
      now: AHORA,
    });
    expect(resultado.kind).toBe("none");
  });

  it("cualquier otra cosa deja el turno seguir su camino", () => {
    const resultado = resolveAwaitingProfileConfirmation({
      text: "cuánto gasté este mes",
      candidatos: [preguntado],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(resultado.kind).toBe("none");
  });

  it("un id de comando que no es de este usuario no resuelve nada", () => {
    const resultado = resolveAwaitingProfileConfirmation({
      text: buildProfileCommandText(
        "55555555-5555-4555-8555-555555555555",
        "confirm",
      ),
      candidatos: [preguntado],
      conversationStateId: ESTADO,
      now: AHORA,
    });
    expect(resultado.kind).toBe("none");
  });
});

describe("parseProfileCommandText", () => {
  it("acepta las tres respuestas y rechaza cualquier otra forma", () => {
    expect(
      parseProfileCommandText(buildProfileCommandText(CANDIDATO_ID, "never_ask")),
    ).toEqual({ candidateId: CANDIDATO_ID, answer: "never_ask" });
    expect(parseProfileCommandText("perfil:no-es-uuid:confirm")).toBeNull();
    expect(parseProfileCommandText(`perfil:${CANDIDATO_ID}:borrar`)).toBeNull();
    expect(parseProfileCommandText("mem:cancel")).toBeNull();
  });
});
