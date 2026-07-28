import type { ExperiencePreferences } from "@/data/repositories/experience-preferences.repository";

export const DEFAULT_PREFERENCES: ExperiencePreferences = {
  discreet_mode_enabled: false,
  insights_whatsapp_opt_in: false,
  weekly_summary_enabled: false,
  weekly_summary_channel: "dashboard",
  theme_preference: "system",
};

/**
 * Aplica `theme_preference` a `<html data-theme>`. `"system"` no escribe
 * el atributo: deja que `@media (prefers-color-scheme: dark)` decida sola
 * (`globals.css`). Un único efecto para toda la app — ninguna pantalla
 * decide el tema por su cuenta (`AC-DS-09`, mismo principio que el modo
 * discreto).
 */
export function applyThemePreference(theme: ExperiencePreferences["theme_preference"]) {
  if (theme === "system") {
    delete document.documentElement.dataset.theme;
  } else {
    document.documentElement.dataset.theme = theme;
  }
}

export async function requestExperiencePreferences(
  preferences?: ExperiencePreferences,
): Promise<ExperiencePreferences> {
  const response = await fetch("/api/v1/preferences/experience", {
    method: preferences ? "PUT" : "GET",
    credentials: "same-origin",
    headers: preferences ? { "content-type": "application/json" } : undefined,
    body: preferences ? JSON.stringify(preferences) : undefined,
  });
  const payload = (await response.json()) as {
    ok: boolean;
    data?: { preferences?: ExperiencePreferences };
    error?: { message?: string };
  };
  if (!response.ok || !payload.ok || !payload.data?.preferences) {
    throw new Error(
      payload.error?.message ?? "No se pudo actualizar la preferencia.",
    );
  }
  return payload.data.preferences;
}
