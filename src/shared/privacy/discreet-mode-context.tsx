"use client";

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import type { ExperiencePreferences } from "@/data/repositories/experience-preferences.repository";
import { queryKeys } from "@/shared/data/query-keys";
import { useOptimisticMutation } from "@/shared/data/optimistic-mutation";
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

// `AC-PAT-01`: la carga usa la librería de obtención de datos elegida en
// `W-07` (TanStack Query), no un `useEffect` con bandera de cancelación a
// mano — esta era la última infractora fuera de `src/features/**`.
export function DiscreetModeProvider({ children }: { children: ReactNode }) {
  const query = useQuery({
    queryKey: queryKeys.preferences,
    queryFn: () => requestExperiencePreferences(),
  });
  const preferences = query.data ?? DEFAULT_PREFERENCES;

  useEffect(() => {
    applyThemePreference(preferences.theme_preference);
  }, [preferences.theme_preference]);

  const mutation = useOptimisticMutation<ExperiencePreferences, ExperiencePreferences>({
    mutation: "preferences.change",
    mutationFn: (nextPreferences) => requestExperiencePreferences(nextPreferences),
    applyOptimistic: (client, nextPreferences) => {
      const previous = client.getQueryData<ExperiencePreferences>(queryKeys.preferences);
      client.setQueryData(queryKeys.preferences, nextPreferences);
      return () => client.setQueryData(queryKeys.preferences, previous);
    },
  });

  const updatePreferences = useCallback(
    (nextPreferences: ExperiencePreferences) => mutation.mutateAsync(nextPreferences),
    [mutation],
  );

  const setDiscreet = useCallback(
    async (enabled: boolean) => {
      await updatePreferences({ ...preferences, discreet_mode_enabled: enabled });
    },
    [preferences, updatePreferences],
  );

  const setTheme = useCallback(
    async (theme: ExperiencePreferences["theme_preference"]) => {
      await updatePreferences({ ...preferences, theme_preference: theme });
    },
    [preferences, updatePreferences],
  );

  const error = query.isError
    ? "No pude cargar tu modo discreto. Tus datos siguen protegidos y puedes reintentarlo."
    : mutation.isError
    ? "No pude guardar esa preferencia. Restauré la configuración anterior."
    : null;

  const value = useMemo<DiscreetModeContextValue>(
    () => ({
      discreet: preferences.discreet_mode_enabled,
      theme: preferences.theme_preference,
      preferences,
      loading: query.isLoading,
      saving: mutation.isPending,
      error,
      setDiscreet,
      setTheme,
      updatePreferences,
    }),
    [error, preferences, query.isLoading, mutation.isPending, setDiscreet, setTheme, updatePreferences],
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
