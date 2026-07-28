import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DiscreetModeProvider, useDiscreetMode } from "./discreet-mode-context";

function Probe() {
  const { theme, loading } = useDiscreetMode();
  if (loading) return <span>cargando</span>;
  return <span>tema:{theme}</span>;
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
