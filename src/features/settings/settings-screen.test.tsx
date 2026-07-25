import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SettingsScreen } from "./settings-screen";

const mocks = vi.hoisted(() => ({
  getDashboardNudgePreferences: vi.fn(),
  getGmailHistory: vi.fn(),
  getGmailStatus: vi.fn(),
  getLearningSnapshot: vi.fn(),
  getProfileSettings: vi.fn(),
  getWhatsAppNudgeConsent: vi.fn(),
  disconnectGmail: vi.fn(),
  deleteGmailInstitutionSource: vi.fn(),
  deleteUserAccount: vi.fn(),
  downloadUserDataExport: vi.fn(),
  startGmailOAuth: vi.fn(),
  upsertGmailInstitutionSource: vi.fn(),
  updateDashboardNudgePreference: vi.fn(),
  updateGmailAiExtractionConsent: vi.fn(),
  updateLearningPreferences: vi.fn(),
  updateProfileSettings: vi.fn(),
  updateWhatsAppNudgeConsent: vi.fn(),
  manageLearningCandidate: vi.fn(),
  manageLearningMemory: vi.fn(),
}));

vi.mock("./settings-api", () => mocks);

beforeEach(() => {
  Object.values(mocks).forEach((mock) => mock.mockReset());
  mocks.getProfileSettings.mockResolvedValue({
    id: "11111111-1111-4111-8111-111111111111",
    display_name: "Marco",
    phone_e164: null,
    timezone: "America/Lima",
    locale: "es-PE",
    default_currency: "PEN",
    onboarding_status: "not_started",
    created_at: "2026-07-01T00:00:00.000Z",
    updated_at: "2026-07-01T00:00:00.000Z",
  });
  mocks.getDashboardNudgePreferences.mockResolvedValue(preferences(true));
  mocks.getWhatsAppNudgeConsent.mockResolvedValue(whatsappConsent());
  mocks.getGmailStatus.mockResolvedValue({
    configured: false,
    missing: ["clientId"],
    connections: [],
    connection: null,
    institutions: [],
    sources: [],
  });
  mocks.getGmailHistory.mockResolvedValue([]);
  mocks.getLearningSnapshot.mockResolvedValue(learningSnapshot());
  mocks.downloadUserDataExport.mockResolvedValue(undefined);
  mocks.deleteUserAccount.mockResolvedValue(undefined);
  mocks.manageLearningCandidate.mockResolvedValue(undefined);
  mocks.manageLearningMemory.mockResolvedValue(undefined);
});

describe("settings reminders", () => {
  it("muestra Gmail bloqueado cuando faltan credenciales", async () => {
    render(<SettingsScreen />);

    expect(await screen.findByText("Correos bancarios")).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Conectar otro Gmail" }),
    ).toBeDisabled();
    expect(screen.getByText(/nunca crea movimientos/i)).toBeTruthy();
    expect(screen.getByText(/agente especializado/i)).toBeTruthy();
    expect(screen.getByText(/no decide ni registra/i)).toBeTruthy();
  });

  it("exige confirmacion antes de desconectar Gmail", async () => {
    mocks.getGmailStatus.mockResolvedValue(connectedGmailStatus());
    mocks.disconnectGmail.mockResolvedValue(undefined);
    render(<SettingsScreen />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Desconectar" }),
    );
    expect(screen.getByText("¿Desconectar marco@gmail.com?")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "Confirmar desconexion" }),
    );
    await waitFor(() =>
      expect(mocks.disconnectGmail).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
      ),
    );
    expect(await screen.findByText(/Gmail desconectado/)).toBeTruthy();
  });

  it("registra consentimiento separado antes de enviar cuerpos al agente", async () => {
    mocks.getGmailStatus.mockResolvedValue(connectedGmailStatus());
    mocks.updateGmailAiExtractionConsent.mockResolvedValue({
      enabled: true,
      version: "email_ai_extraction_v1",
      updated_at: "2026-07-23T08:30:00.000Z",
    });
    render(<SettingsScreen />);

    fireEvent.click(
      await screen.findByRole("switch", {
        name: "Permitir extraccion bancaria con IA en marco@gmail.com",
      }),
    );

    await waitFor(() =>
      expect(
        mocks.updateGmailAiExtractionConsent,
      ).toHaveBeenCalledWith(
        "11111111-1111-4111-8111-111111111111",
        true,
      ),
    );
    expect(
      await screen.findByText(/Extraccion con IA activada/),
    ).toBeTruthy();
  });

  it("muestra historial minimizado sin cuerpo ni remitente", async () => {
    mocks.getGmailHistory.mockResolvedValue([
      {
        id: "email-1",
        received_at: "2026-07-22T15:00:00.000Z",
        institution_key: "bank_test",
        parse_mode: "template",
        parsed_status: "pending_created",
        pending_status: "pending",
      },
    ]);

    render(<SettingsScreen />);

    expect(await screen.findByText("Actividad reciente")).toBeTruthy();
    expect(screen.getByText("Bank Test")).toBeTruthy();
    expect(screen.getByText("En Pendientes")).toBeTruthy();
    expect(screen.queryByText(/alertas@/i)).toBeNull();
  });

  it("permite exportar datos y exige la frase exacta para eliminar", async () => {
    const onSignOut = vi.fn();
    render(<SettingsScreen onSignOut={onSignOut} />);

    fireEvent.click(
      await screen.findByRole("button", { name: "Exportar datos" }),
    );
    await waitFor(() =>
      expect(mocks.downloadUserDataExport).toHaveBeenCalledOnce(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Eliminar cuenta" }),
    );
    const deleteButton = screen.getByRole("button", {
      name: "Eliminar definitivamente",
    });
    expect(deleteButton).toBeDisabled();

    fireEvent.change(
      screen.getByLabelText("Confirmacion"),
      { target: { value: "ELIMINAR MI CUENTA" } },
    );
    expect(deleteButton).toBeEnabled();
    fireEvent.click(deleteButton);

    await waitFor(() =>
      expect(mocks.deleteUserAccount).toHaveBeenCalledWith(
        "ELIMINAR MI CUENTA",
      ),
    );
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("muestra, explica y permite olvidar un recuerdo gobernado", async () => {
    mocks.getLearningSnapshot
      .mockResolvedValueOnce(learningSnapshot())
      .mockResolvedValueOnce(learningSnapshot({ memories: [] }));
    render(<SettingsScreen />);

    expect(await screen.findByText("Aprendizaje y memoria")).toBeTruthy();
    expect(screen.getByText("Prefiero respuestas breves.")).toBeTruthy();
    expect(
      screen.getByText(
        (_, element) =>
          element?.tagName === "P" &&
          Boolean(
            element.textContent?.includes("Por qué") &&
              element.textContent.includes("Confirmado"),
          ),
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Olvidar" }));

    await waitFor(() =>
      expect(mocks.manageLearningMemory).toHaveBeenCalledWith(
        expect.objectContaining({
          target: "memory",
          action: "forget",
        }),
      ),
    );
    expect(
      await screen.findByText(/Recuerdo olvidado/),
    ).toBeTruthy();
  });

  it("muestra las preferencias dashboard y permite apagar cuotas de deuda", async () => {
    mocks.updateDashboardNudgePreference.mockResolvedValue(preferences(false));

    render(<SettingsScreen />);

    const debtSwitch = await screen.findByRole("switch", {
      name: "Desactivar Cuotas de deuda",
    });
    expect(debtSwitch.getAttribute("aria-checked")).toBe("true");

    fireEvent.click(debtSwitch);

    await waitFor(() => {
      expect(mocks.updateDashboardNudgePreference).toHaveBeenCalledWith(
        "debt_due",
        false
      );
    });
    expect(
      await screen.findByRole("switch", {
        name: "Activar Cuotas de deuda",
      })
    ).toBeTruthy();
    expect(screen.getByText("Recordatorio desactivado.")).toBeTruthy();
  });

  it("pide consentimiento explícito antes de activar avisos externos", async () => {
    mocks.getProfileSettings.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      display_name: "Marco",
      phone_e164: "+51999999999",
      timezone: "America/Lima",
      locale: "es-PE",
      default_currency: "PEN",
      onboarding_status: "active",
      created_at: "2026-07-01T00:00:00.000Z",
      updated_at: "2026-07-01T00:00:00.000Z",
    });
    mocks.updateWhatsAppNudgeConsent.mockResolvedValue(
      whatsappConsent({ whatsapp_opt_in: true, payment_due: true }),
    );

    render(<SettingsScreen />);

    fireEvent.click(
      await screen.findByRole("switch", {
        name: "Activar avisos por WhatsApp",
      }),
    );
    fireEvent.click(
      screen.getByRole("switch", { name: "Activar Pagos que vienen" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Guardar autorización" }),
    );

    await waitFor(() => {
      expect(mocks.updateWhatsAppNudgeConsent).toHaveBeenCalledWith({
        whatsapp_opt_in: true,
        payment_due: true,
        debt_due: false,
        quiet_hours_start: "22:00",
        quiet_hours_end: "08:00",
      });
    });
    expect(
      screen.getByText("Avisos por WhatsApp activados con tus preferencias."),
    ).toBeTruthy();
  });
});

function preferences(debtEnabled: boolean) {
  return [
    {
      nudge_type: "payment_due",
      enabled: true,
      configured: false,
      channel: "dashboard",
      paused_until: null,
    },
    {
      nudge_type: "debt_due",
      enabled: debtEnabled,
      configured: true,
      channel: "dashboard",
      paused_until: null,
    },
  ];
}

function whatsappConsent(
  overrides: Partial<{
    whatsapp_opt_in: boolean;
    payment_due: boolean;
    debt_due: boolean;
    quiet_hours_start: string;
    quiet_hours_end: string;
    configured: boolean;
  }> = {},
) {
  return {
    whatsapp_opt_in: false,
    payment_due: false,
    debt_due: false,
    quiet_hours_start: "22:00",
    quiet_hours_end: "08:00",
    configured: false,
    ...overrides,
  };
}

function learningSnapshot(
  overrides: Partial<{
    memories: Array<Record<string, unknown>>;
    candidates: Array<Record<string, unknown>>;
  }> = {},
) {
  return {
    preferences: {
      user_id: "user-1",
      enabled: true,
      allow_narrative_memory: true,
      allow_sensitive_memory: false,
      consent_version: "learning_v1",
      updated_by: "user",
      created_at: "2026-07-24T10:00:00.000Z",
      updated_at: "2026-07-24T10:00:00.000Z",
      metadata: {},
    },
    memories: [
      {
        id: "22222222-2222-4222-8222-222222222222",
        kind: "preference",
        canonical_key: "preference:conversation_style:brief",
        summary: "Prefiero respuestas breves.",
        evidence_source: "explicit_user_statement",
        confidence: 1,
        lifecycle_status: "confirmed",
        sensitivity: "normal",
        positive_evidence_count: 1,
        negative_evidence_count: 0,
        explanation: "Confirmado explÃ­citamente por el usuario.",
        valid_until: null,
        created_at: "2026-07-24T10:00:00.000Z",
        updated_at: "2026-07-24T10:00:00.000Z",
      },
    ],
    candidates: [],
    ...overrides,
  };
}

function connectedGmailStatus() {
  const connection = {
    id: "11111111-1111-4111-8111-111111111111",
    email_address: "marco@gmail.com",
    status: "watch_active",
    watch_status: "active",
    watch_expiration: "2026-07-29T00:00:00.000Z",
    last_watch_renewed_at: "2026-07-22T00:00:00.000Z",
    connected: true,
    ai_extraction_consent: {
      enabled: false,
      version: "email_ai_extraction_v1",
      updated_at: null,
    },
  };
  return {
    configured: true,
    missing: [],
    connections: [connection],
    connection,
    institutions: [],
    sources: [],
  };
}
