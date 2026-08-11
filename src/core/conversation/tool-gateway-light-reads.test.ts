import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationTurnState } from "@/agents/conversation-agent";
import { ToolGateway } from "./tool-gateway";

/**
 * `RUL-LIG-01`: las tres lecturas que nombran el objeto de una accion de nivel
 * `ninguna`. Cada una con su caso feliz, su caso vacio —que no es lo mismo que
 * un fallo— y su aislamiento por usuario.
 */
const repos = vi.hoisted(() => ({
  listReminders: vi.fn(),
  getHomeHiddenBlocks: vi.fn(),
  getEmailConnectionForUser: vi.fn(),
  listUserEmailSources: vi.fn(),
}));

vi.mock("@/data/repositories/reminders.repository", () => ({
  listReminders: repos.listReminders,
}));
vi.mock("@/data/repositories/home.repository", () => ({
  getHomeHiddenBlocks: repos.getHomeHiddenBlocks,
}));
vi.mock("@/data/repositories/email.repository", () => ({
  getEmailConnectionForUser: repos.getEmailConnectionForUser,
  listUserEmailSources: repos.listUserEmailSources,
}));

const CLIENT = {} as never;
const USER = "user-1";
const OTRO_USUARIO = "user-2";

const turnState: ConversationTurnState = {
  act: "financial_question",
  should_use_active_memory: false,
  personalization_cues: [],
  risk_notes: [],
} as unknown as ConversationTurnState;

function call(toolName: Parameters<ToolGateway["executeAuthorizedTool"]>[0]["toolName"], userId = USER) {
  return new ToolGateway(CLIENT).executeAuthorizedTool({
    toolName,
    userId,
    query: null,
    activeMemoryState: null,
    turnState,
  });
}

function reminder(id: string, title: string) {
  return {
    id,
    kind: "confirmar_hecho",
    title,
    body: "Cuerpo",
    action_url: null,
    status: "abierto",
    created_at: "2026-08-01T10:00:00.000Z",
    expires_at: "2026-09-01T10:00:00.000Z",
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  repos.listReminders.mockResolvedValue([]);
  repos.getHomeHiddenBlocks.mockResolvedValue([]);
  repos.getEmailConnectionForUser.mockResolvedValue(null);
  repos.listUserEmailSources.mockResolvedValue([]);
});

describe("get_reminders", () => {
  it("caso feliz: cada recordatorio viaja con su id, y el conteo es afirmable", async () => {
    repos.listReminders.mockResolvedValue([
      reminder("r-1", "Confirma el gasto del martes"),
      reminder("r-2", "Revisa tu presupuesto de comida"),
    ]);

    const result = await call("get_reminders");

    expect(result.status).toBe("called");
    expect(result.facts).toContain("reminder_count=2");
    // El `id` tiene que estar en un `fact`, no solo en `data`: sin el, el
    // ejecutivo no puede citar de donde saco el identificador que va a
    // ejecutar.
    expect(result.facts.some((fact) => fact.includes("reminder:r-1="))).toBe(true);
    expect(result.data.reminder_count).toBe(2);
  });

  it("caso vacio: cero es una cifra afirmable, no un fallo", async () => {
    const result = await call("get_reminders");

    expect(result.status).toBe("called");
    expect(result.facts).toContain("reminder_count=0");
    expect(result.warnings).toEqual([]);
  });

  it("un fallo de lectura no se parece a un cero", async () => {
    repos.listReminders.mockRejectedValue(new Error("boom"));

    const result = await call("get_reminders");

    expect(result.status).toBe("failed");
    // Sin `fact`, el compilador de evidencia no tiene nada que el modelo pueda
    // afirmar: no puede decir "no tienes recordatorios".
    expect(result.facts).toEqual([]);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  it("aislamiento: se consulta con el user_id del turno", async () => {
    await call("get_reminders", OTRO_USUARIO);
    expect(repos.listReminders).toHaveBeenCalledWith(CLIENT, OTRO_USUARIO, {
      estado: "abiertos",
    });
  });
});

describe("get_home_preferences", () => {
  it("caso feliz: devuelve las dos listas, no solo la de ocultos", async () => {
    repos.getHomeHiddenBlocks.mockResolvedValue(["pending", "insight"]);

    const result = await call("get_home_preferences");

    expect(result.status).toBe("called");
    expect(result.facts).toContain("hidden_block_count=2");
    expect(result.facts).toContain("hidden_blocks=pending,insight");
    expect(result.data.hidden_blocks).toEqual(["pending", "insight"]);
    expect(result.data.visible_blocks).not.toContain("pending");
    expect(result.data.visible_blocks).toContain("month");
  });

  it("caso vacio: sin bloques ocultos lo dice con nombre propio", async () => {
    const result = await call("get_home_preferences");

    expect(result.facts).toContain("hidden_block_count=0");
    expect(result.facts).toContain("hidden_blocks=ninguno");
    expect(result.data.hidden_blocks).toEqual([]);
  });

  it("aislamiento: se consulta con el user_id del turno", async () => {
    await call("get_home_preferences", OTRO_USUARIO);
    expect(repos.getHomeHiddenBlocks).toHaveBeenCalledWith(CLIENT, OTRO_USUARIO);
  });
});

describe("get_email_status", () => {
  it("caso feliz: dice que esta conectado y con que cuenta", async () => {
    repos.getEmailConnectionForUser.mockResolvedValue({
      email_address: "yo@ejemplo.com",
      status: "active",
      watch_status: "healthy",
      created_at: "2026-01-05T10:00:00.000Z",
    });
    repos.listUserEmailSources.mockResolvedValue([
      { id: "s-1", notification_sender: "avisos@banco.com", status: "active" },
    ]);

    const result = await call("get_email_status");

    expect(result.status).toBe("called");
    expect(result.facts).toContain("email_connected=true");
    expect(result.facts).toContain("email_source_count=1");
    expect(result.warnings).toEqual([]);
  });

  it("caso vacio: sin buzon conectado no se listan fuentes ni se inventa nada", async () => {
    const result = await call("get_email_status");

    expect(result.facts).toContain("email_connected=false");
    expect(result.facts).toContain("email_source_count=0");
    expect(result.data.connection).toBeNull();
    expect(repos.listUserEmailSources).not.toHaveBeenCalled();
  });

  it("conectado sin remitentes advierte: no llega nada todavia", async () => {
    repos.getEmailConnectionForUser.mockResolvedValue({
      email_address: "yo@ejemplo.com",
      status: "active",
      watch_status: "healthy",
      created_at: "2026-01-05T10:00:00.000Z",
    });

    const result = await call("get_email_status");

    expect(result.facts).toContain("email_source_count=0");
    expect(result.warnings.length).toBe(1);
  });

  it("aislamiento: nada de esta tool sale de una metrica global de la plataforma", async () => {
    repos.getEmailConnectionForUser.mockResolvedValue({
      email_address: "yo@ejemplo.com",
      status: "active",
      watch_status: "healthy",
      created_at: "2026-01-05T10:00:00.000Z",
    });

    await call("get_email_status", OTRO_USUARIO);

    expect(repos.getEmailConnectionForUser).toHaveBeenCalledWith(
      CLIENT,
      OTRO_USUARIO,
    );
    expect(repos.listUserEmailSources).toHaveBeenCalledWith(CLIENT, OTRO_USUARIO);
  });
});
