export type DashboardDeepLinkView =
  | "home"
  | "movements"
  | "pending"
  | "money"
  | "debts"
  | "upcoming"
  | "insights"
  | "settings";

export function buildDashboardDeepLink(
  view: DashboardDeepLinkView,
  options: { baseUrl?: string | null } = {}
): string | null {
  const baseUrl = options.baseUrl ?? getAppBaseUrl();
  if (!baseUrl) return null;

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("view", view);
    return url.toString();
  } catch {
    return null;
  }
}

export function getAppBaseUrl(): string | null {
  const configured =
    process.env.MANZANA_APP_URL ?? process.env.NEXT_PUBLIC_MANZANA_APP_URL;

  if (configured?.trim()) return configured.trim();

  if (process.env.APP_ENV === "local") {
    return "http://127.0.0.1:3100";
  }

  return null;
}
