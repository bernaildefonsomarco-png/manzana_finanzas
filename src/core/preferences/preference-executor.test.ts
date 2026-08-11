import { describe, expect, it, vi } from "vitest";
import type { PreferenceCommand } from "./preference-request";
import {
  buildPreferenceProposal,
  composePreferenceCancelledText,
  composePreferenceLapsedText,
  executePreferenceProposal,
} from "./preference-executor";
import type { PreferenceProposal } from "./preference-proposal";

const USER = "00000000-0000-4000-8000-000000000001";
const OTHER_USER = "00000000-0000-4000-8000-0000000000ff";
const NOW = "2026-08-11T12:00:00.000Z";

/** Cliente falso que solo registra las RPC y su payload. */
function fakeClient(error: { message: string } | null = null) {
  const calls: Array<{ name: string; args: Record<string, unknown> }> = [];
  const client = {
    rpc: vi.fn((name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      return Promise.resolve({ data: null, error });
    }),
  };
  return { client, calls };
}

function proposalFor(command: PreferenceCommand): PreferenceProposal {
  const built = buildPreferenceProposal({ command, now: NOW });
  if (!built) throw new Error("el borrador no valido");
  return built;
}

describe("buildPreferenceProposal: la tarjeta dice lo que el catalogo exige", () => {
  it("una pausa muestra la fecha de reanudacion (`40` §7.14)", () => {
    const built = proposalFor({
      command: "pausar_recordatorios",
      activar: true,
      dias: 7,
    });
    expect(built.nivel).toBe("tarjeta");
    // 11 de agosto + 7 dias = 18 de agosto, en hora de Lima.
    expect(built.summary).toContain("18 de agosto");
    expect(built.summary).toMatch(/^¿/);
  });

  it("un cambio de horario muestra el horario resultante", () => {
    const built = proposalFor({
      command: "cambiar_horario_silencioso",
      desde: "22:00",
      hasta: "08:00",
    });
    expect(built.summary).toContain("22:00");
    expect(built.summary).toContain("08:00");
  });

  it("el consentimiento del correo dice tipo, frecuencia maxima y como se apaga", () => {
    const built = proposalFor({
      command: "activar_correo_recordatorios",
      activar: true,
      tipo: "cuota_proxima",
    });
    // `40` §3: el nivel sale del catalogo, no de este modulo.
    expect(built.nivel).toBe("consentimiento");
    expect(built.summary).toContain("las cuotas que vienen");
    expect(built.summary).toContain("un correo al día");
    expect(built.summary).toContain("apagarlo cuando quieras");
  });

  it("la accion inversa se propone bajo el mismo comando de catalogo", () => {
    const built = proposalFor({ command: "pausar_recordatorios", activar: false });
    expect(built.command).toBe("pausar_recordatorios");
    expect(built.summary).toContain("Reanudo");
  });
});

describe("executePreferenceProposal: escribe lo que se confirmo, y nada mas", () => {
  it("pausar llama a la variante de servicio con el usuario del turno", async () => {
    const { client, calls } = fakeClient();
    const result = await executePreferenceProposal({
      client: client as never,
      userId: USER,
      proposal: proposalFor({
        command: "pausar_recordatorios",
        activar: true,
        dias: 3,
      }),
      traceId: "trace-1",
      now: NOW,
    });

    expect(result.kind).toBe("applied");
    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("pause_reminders_for_user");
    expect(calls[0].args.p_user_id).toBe(USER);
    expect(String(calls[0].args.p_until)).toBe("2026-08-14T12:00:00.000Z");
  });

  it("reanudar es la otra direccion del mismo comando", async () => {
    const { client, calls } = fakeClient();
    const result = await executePreferenceProposal({
      client: client as never,
      userId: USER,
      proposal: proposalFor({ command: "pausar_recordatorios", activar: false }),
      traceId: "trace-1",
      now: NOW,
    });

    expect(result.kind).toBe("applied");
    expect(calls[0].name).toBe("resume_reminders_for_user");
    expect(calls[0].args).toEqual({ p_user_id: USER });
  });

  it("silenciar un tipo escribe el canal de bandeja con `enabled: false`", async () => {
    const { client, calls } = fakeClient();
    await executePreferenceProposal({
      client: client as never,
      userId: USER,
      proposal: proposalFor({
        command: "silenciar_tipo_recordatorio",
        activar: true,
        tipo: "presupuesto_umbral",
      }),
      traceId: "trace-1",
      now: NOW,
    });

    expect(calls[0].name).toBe("set_reminder_preference_for_user");
    expect(calls[0].args).toEqual({
      p_user_id: USER,
      p_nudge_type: "presupuesto_umbral",
      p_channel: "dashboard",
      p_enabled: false,
    });
  });

  it("activar el correo escribe el canal `email` con `enabled: true`", async () => {
    // `AC-NOTIF-03`: el evento de consentimiento lo escribe la RPC delegada, no
    // este modulo. Lo que se comprueba aqui es que se llama a la funcion que lo
    // registra, y no a un atajo que se lo saltaria.
    const { client, calls } = fakeClient();
    await executePreferenceProposal({
      client: client as never,
      userId: USER,
      proposal: proposalFor({
        command: "activar_correo_recordatorios",
        activar: true,
        tipo: "cuota_proxima",
      }),
      traceId: "trace-1",
      now: NOW,
    });

    expect(calls[0].name).toBe("set_reminder_preference_for_user");
    expect(calls[0].args).toEqual({
      p_user_id: USER,
      p_nudge_type: "cuota_proxima",
      p_channel: "email",
      p_enabled: true,
    });
  });

  it("el horario silencioso no toca el consentimiento de ningun canal", async () => {
    const { client, calls } = fakeClient();
    await executePreferenceProposal({
      client: client as never,
      userId: USER,
      proposal: proposalFor({
        command: "cambiar_horario_silencioso",
        desde: "23:00",
        hasta: "07:00",
      }),
      traceId: "trace-1",
      now: NOW,
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe("set_quiet_hours_for_user");
    expect(calls[0].args).toEqual({
      p_user_id: USER,
      p_start: "23:00",
      p_end: "07:00",
    });
  });

  it("el `user_id` sale del turno, nunca del borrador", async () => {
    // El borrador no lleva usuario a proposito. Aunque alguien lo manipulara,
    // la escritura solo puede apuntar al usuario del turno.
    const { client, calls } = fakeClient();
    const manipulado = {
      ...proposalFor({ command: "pausar_recordatorios", activar: false }),
      payload: {
        command: "pausar_recordatorios",
        activar: false,
        user_id: USER,
      },
    };

    await executePreferenceProposal({
      client: client as never,
      userId: OTHER_USER,
      proposal: manipulado,
      traceId: "trace-1",
      now: NOW,
    });

    expect(calls[0].args).toEqual({ p_user_id: OTHER_USER });
    expect(calls[0].args.p_user_id).not.toBe(USER);
  });

  it("un borrador corrupto no se ejecuta a medias y lo dice", async () => {
    const { client, calls } = fakeClient();
    const result = await executePreferenceProposal({
      client: client as never,
      userId: USER,
      proposal: {
        ...proposalFor({ command: "pausar_recordatorios", activar: false }),
        payload: { command: "pausar_recordatorios" },
      },
      traceId: "trace-1",
      now: NOW,
    });

    expect(result.kind).toBe("failed");
    expect(calls).toHaveLength(0);
    expect(result.response_text).toContain("no toqué ninguna de tus preferencias");
  });

  it("un fallo de base no deja el turno mudo y niega el cambio", async () => {
    const { client } = fakeClient({ message: "boom" });
    const result = await executePreferenceProposal({
      client: client as never,
      userId: USER,
      proposal: proposalFor({ command: "pausar_recordatorios", activar: false }),
      traceId: "trace-1",
      now: NOW,
    });

    expect(result.kind).toBe("failed");
    expect(result.response_text.trim().length).toBeGreaterThan(0);
  });
});

describe("textos de desenlace: ningun camino queda mudo (`WEB-D296`)", () => {
  it("la cancelacion niega lo que se iba a hacer", () => {
    expect(
      composePreferenceCancelledText(
        proposalFor({
          command: "activar_correo_recordatorios",
          activar: true,
          tipo: "pago_proximo",
        }),
      ),
    ).toContain("no autorizaste nada");
    expect(
      composePreferenceCancelledText(
        proposalFor({ command: "pausar_recordatorios", activar: true, dias: 7 }),
      ),
    ).toContain("no pausé nada");
    expect(composePreferenceCancelledText(null).trim().length).toBeGreaterThan(0);
  });

  it("la confirmacion tardia dice que no se aplico", () => {
    expect(composePreferenceLapsedText()).toContain("no la apliqué");
  });
});
