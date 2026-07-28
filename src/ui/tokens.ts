/**
 * Acceso tipado a los tokens de `src/app/globals.css` (`16` §3, §10).
 * No declara valores: son la variable CSS, la única fuente. Este módulo
 * solo da autocompletado y evita que un componente escriba un nombre de
 * token que no existe.
 */

export const CHART_PALETTE = [
  "--color-chart-1",
  "--color-chart-2",
  "--color-chart-3",
  "--color-chart-4",
  "--color-chart-5",
  "--color-chart-6",
  "--color-chart-7",
  "--color-chart-8",
] as const;

export type ChartToken = (typeof CHART_PALETTE)[number];

export const BUDGET_STATUS_TOKENS = {
  ok: "--color-budget-ok",
  warning: "--color-budget-warning",
  over: "--color-budget-over",
} as const;

export type BudgetStatus = keyof typeof BUDGET_STATUS_TOKENS;

export const ASSISTANT_SURFACE_TOKENS = {
  user: { bg: "--color-assistant-user-bg", text: "--color-assistant-user-text" },
  response: {
    bg: "--color-assistant-response-bg",
    text: "--color-assistant-response-text",
  },
} as const;

export type AssistantRole = keyof typeof ASSISTANT_SURFACE_TOKENS;

/** Valor CSS `var(--token)` listo para usar en un estilo en línea. */
export function tokenVar(token: string): string {
  return `var(${token})`;
}

export const THEME_PREFERENCES = ["system", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];
