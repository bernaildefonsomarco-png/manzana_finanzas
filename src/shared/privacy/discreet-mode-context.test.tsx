import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscreetModeProvider, useDiscreetMode } from "./discreet-mode-context";

function Probe() {
  const { theme, loading } = useDiscreetMode();
  if (loading) return <span>cargando</span>;
  return <span>tema:{theme}</span>;
}

function DiscreetProbe() {
  const { discreet } = useDiscreetMode();
  return <span>discreto:{String(discreet)}</span>;
}

function renderWithQueryClient(children: React.ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}>{children}</QueryClientProvider>);
}

function mockPreferencesResponse(theme_preference: "system" | "light" | "dark") {
  return {
    ok: true,
    json: async () => ({
      ok: true,
      data: {
        preferences: {
          discreet_mode_enabled: false,
          insights_whatsapp_opt_in: false,
          weekly_summary_enabled: false,
          weekly_summary_channel: "dashboard",
          theme_preference,
        },
      },
    }),
  };
}

beforeEach(() => {
  document.documentElement.removeAttribute("data-theme");
});

describe("DiscreetModeProvider — tema manual", () => {
  it("AC-DS-09 / 16 §3.1: theme_preference='dark' escribe data-theme en <html>", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockPreferencesResponse("dark")));

    renderWithQueryClient(
      <DiscreetModeProvider>
        <Probe />
      </DiscreetModeProvider>
    );

    await waitFor(() => expect(screen.getByText("tema:dark")).toBeInTheDocument());
    expect(document.documentElement.dataset.theme).toBe("dark");

    vi.unstubAllGlobals();
  });

  it("theme_preference='system' no escribe el atributo: deja decidir a la media query", async () => {
    document.documentElement.dataset.theme = "dark";
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(mockPreferencesResponse("system")));

    renderWithQueryClient(
      <DiscreetModeProvider>
        <Probe />
      </DiscreetModeProvider>
    );

    await waitFor(() => expect(screen.getByText("tema:system")).toBeInTheDocument());
    expect(document.documentElement.dataset.theme).toBeUndefined();

    vi.unstubAllGlobals();
  });
});

describe("DiscreetModeProvider — AC-CONF-04: sin parpadeo de montos visibles", () => {
  it("con initialPreferences del servidor, el primer render ya es discreto (nunca 'false' antes del fetch)", () => {
    // El fetch nunca resuelve dentro del test: si el primer render dependiera
    // de él, `discreet` seguiría siendo `false` (DEFAULT_PREFERENCES).
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    renderWithQueryClient(
      <DiscreetModeProvider
        initialPreferences={{
          discreet_mode_enabled: true,
          insights_whatsapp_opt_in: false,
          weekly_summary_enabled: false,
          weekly_summary_channel: "dashboard",
          theme_preference: "system",
        }}
      >
        <DiscreetProbe />
      </DiscreetModeProvider>
    );

    // Sin `await`/`waitFor`: se comprueba el primer render síncrono, antes
    // de que el `fetch` (que nunca resuelve) tenga oportunidad de correr.
    expect(screen.getByText("discreto:true")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });

  it("RUL-HECHO-02: sin initialPreferences, el primer render es 'false' hasta que el fetch resuelve (el parpadeo que AC-CONF-04 prohíbe)", () => {
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));

    renderWithQueryClient(
      <DiscreetModeProvider>
        <DiscreetProbe />
      </DiscreetModeProvider>
    );

    expect(screen.getByText("discreto:false")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
