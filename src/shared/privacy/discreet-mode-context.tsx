"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ExperiencePreferences } from "@/data/repositories/experience-preferences.repository";

const DEFAULT_PREFERENCES: ExperiencePreferences = {
  discreet_mode_enabled: false,
  insights_whatsapp_opt_in: false,
  weekly_summary_enabled: false,
  weekly_summary_channel: "dashboard",
};

type DiscreetModeContextValue = {
  discreet: boolean;
  preferences: ExperiencePreferences;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setDiscreet: (enabled: boolean) => Promise<void>;
  updatePreferences: (
    preferences: ExperiencePreferences,
  ) => Promise<ExperiencePreferences>;
};

const DiscreetModeContext = createContext<DiscreetModeContextValue>({
  discreet: false,
  preferences: DEFAULT_PREFERENCES,
  loading: false,
  saving: false,
  error: null,
  setDiscreet: async () => undefined,
  updatePreferences: async (preferences) => preferences,
});

export function DiscreetModeProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] =
    useState<ExperiencePreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void requestExperiencePreferences()
      .then((nextPreferences) => {
        if (active) setPreferences(nextPreferences);
      })
      .catch(() => {
        if (active) {
          setError(
            "No pude cargar tu modo discreto. Tus datos siguen protegidos y puedes reintentarlo.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const updatePreferences = useCallback(
    async (nextPreferences: ExperiencePreferences) => {
      const previous = preferences;
      setPreferences(nextPreferences);
      setSaving(true);
      setError(null);
      try {
        const saved = await requestExperiencePreferences(nextPreferences);
        setPreferences(saved);
        return saved;
      } catch (requestError) {
        setPreferences(previous);
        setError(
          "No pude guardar esa preferencia. Restauré la configuración anterior.",
        );
        throw requestError;
      } finally {
        setSaving(false);
      }
    },
    [preferences],
  );

  const setDiscreet = useCallback(
    async (enabled: boolean) => {
      await updatePreferences({
        ...preferences,
        discreet_mode_enabled: enabled,
      });
    },
    [preferences, updatePreferences],
  );

  const value = useMemo<DiscreetModeContextValue>(
    () => ({
      discreet: preferences.discreet_mode_enabled,
      preferences,
      loading,
      saving,
      error,
      setDiscreet,
      updatePreferences,
    }),
    [error, loading, preferences, saving, setDiscreet, updatePreferences],
  );

  return (
    <DiscreetModeContext.Provider value={value}>
      {children}
    </DiscreetModeContext.Provider>
  );
}

export function useDiscreetMode(): DiscreetModeContextValue {
  return useContext(DiscreetModeContext);
}

async function requestExperiencePreferences(
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
