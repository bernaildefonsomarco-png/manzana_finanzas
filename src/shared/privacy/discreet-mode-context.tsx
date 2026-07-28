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
import {
  DEFAULT_PREFERENCES,
  applyThemePreference,
  requestExperiencePreferences,
} from "./experience-preferences-client";

type DiscreetModeContextValue = {
  discreet: boolean;
  theme: ExperiencePreferences["theme_preference"];
  preferences: ExperiencePreferences;
  loading: boolean;
  saving: boolean;
  error: string | null;
  setDiscreet: (enabled: boolean) => Promise<void>;
  setTheme: (theme: ExperiencePreferences["theme_preference"]) => Promise<void>;
  updatePreferences: (
    preferences: ExperiencePreferences,
  ) => Promise<ExperiencePreferences>;
};

const DiscreetModeContext = createContext<DiscreetModeContextValue>({
  discreet: false,
  theme: "system",
  preferences: DEFAULT_PREFERENCES,
  loading: false,
  saving: false,
  error: null,
  setDiscreet: async () => undefined,
  setTheme: async () => undefined,
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

  useEffect(() => {
    applyThemePreference(preferences.theme_preference);
  }, [preferences.theme_preference]);

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

  const setTheme = useCallback(
    async (theme: ExperiencePreferences["theme_preference"]) => {
      await updatePreferences({
        ...preferences,
        theme_preference: theme,
      });
    },
    [preferences, updatePreferences],
  );

  const value = useMemo<DiscreetModeContextValue>(
    () => ({
      discreet: preferences.discreet_mode_enabled,
      theme: preferences.theme_preference,
      preferences,
      loading,
      saving,
      error,
      setDiscreet,
      setTheme,
      updatePreferences,
    }),
    [error, loading, preferences, saving, setDiscreet, setTheme, updatePreferences],
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
