import { getKapsoSendConfigFromEnv } from "./kapso-sender";

type Fetcher = typeof fetch;

export type KapsoTemplateReadinessConfig = {
  apiKey: string;
  businessAccountId: string;
  templateName: string;
  templateLanguage: string;
  apiBaseUrl?: string;
};

export type KapsoTemplateReadiness = {
  checked: boolean;
  ready: boolean;
  found: boolean;
  template_name: string | null;
  language: string | null;
  status: string | null;
  category: string | null;
  reason: string;
  checked_at: string;
};

type KapsoTemplate = {
  name?: unknown;
  language?: unknown;
  status?: unknown;
  category?: unknown;
};

export function getKapsoTemplateReadinessConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): KapsoTemplateReadinessConfig {
  const sendConfig = getKapsoSendConfigFromEnv(env);
  return {
    apiKey: sendConfig.apiKey,
    businessAccountId:
      env.KAPSO_WHATSAPP_BUSINESS_ACCOUNT_ID ??
      env.WHATSAPP_BUSINESS_ACCOUNT_ID ??
      "",
    templateName: env.WHATSAPP_NUDGE_TEMPLATE_NAME ?? "",
    templateLanguage: env.WHATSAPP_NUDGE_TEMPLATE_LANGUAGE ?? "es_PE",
    apiBaseUrl: sendConfig.apiBaseUrl,
  };
}

export async function checkKapsoTemplateReadiness(
  config: KapsoTemplateReadinessConfig,
  fetcher: Fetcher = fetch,
  now: Date = new Date(),
): Promise<KapsoTemplateReadiness> {
  const checkedAt = now.toISOString();
  const missing = [
    !config.apiKey && "kapso_api_key_missing",
    !config.businessAccountId && "business_account_id_missing",
    !config.templateName && "template_name_missing",
  ].filter((value): value is string => Boolean(value));

  if (missing.length > 0) {
    return result({
      checked: false,
      ready: false,
      found: false,
      templateName: config.templateName || null,
      language: config.templateLanguage || null,
      status: null,
      category: null,
      reason: missing.join(","),
      checkedAt,
    });
  }

  const endpoint = buildTemplateEndpoint(config);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);

  try {
    const response = await fetcher(endpoint, {
      method: "GET",
      headers: { "X-API-Key": config.apiKey },
      signal: controller.signal,
      cache: "no-store",
    });
    const body = await parseJsonResponse(response);

    if (!response.ok) {
      return result({
        checked: true,
        ready: false,
        found: false,
        templateName: config.templateName,
        language: config.templateLanguage,
        status: null,
        category: null,
        reason: `kapso_http_${response.status}`,
        checkedAt,
      });
    }

    const templates = readTemplates(body);
    const namedTemplates = templates.filter(
      (template) => readString(template.name) === config.templateName,
    );
    const match = namedTemplates.find(
      (template) => readString(template.language) === config.templateLanguage,
    );

    if (!match) {
      return result({
        checked: true,
        ready: false,
        found: false,
        templateName: config.templateName,
        language: config.templateLanguage,
        status: null,
        category: null,
        reason:
          namedTemplates.length > 0
            ? "template_language_not_found"
            : "template_not_found",
        checkedAt,
      });
    }

    const status = readString(match.status)?.toUpperCase() ?? "UNKNOWN";
    const category = readString(match.category)?.toUpperCase() ?? null;
    return result({
      checked: true,
      ready: status === "APPROVED",
      found: true,
      templateName: config.templateName,
      language: config.templateLanguage,
      status,
      category,
      reason:
        status === "APPROVED"
          ? "template_approved_live"
          : `template_status_${status.toLowerCase()}`,
      checkedAt,
    });
  } catch (error) {
    return result({
      checked: true,
      ready: false,
      found: false,
      templateName: config.templateName,
      language: config.templateLanguage,
      status: null,
      category: null,
      reason:
        error instanceof Error && error.name === "AbortError"
          ? "kapso_timeout"
          : "kapso_unreachable",
      checkedAt,
    });
  } finally {
    clearTimeout(timeout);
  }
}

function buildTemplateEndpoint(config: KapsoTemplateReadinessConfig): string {
  const baseUrl =
    config.apiBaseUrl ?? "https://api.kapso.ai/meta/whatsapp/v24.0";
  const url = new URL(
    `${baseUrl.replace(/\/$/, "")}/${config.businessAccountId}/message_templates`,
  );
  url.searchParams.set("name", config.templateName);
  url.searchParams.set("language", config.templateLanguage);
  url.searchParams.set("limit", "20");
  return url.toString();
}

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

function readTemplates(value: unknown): KapsoTemplate[] {
  if (!isRecord(value) || !Array.isArray(value.data)) return [];
  return value.data.filter(isRecord);
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function result(input: {
  checked: boolean;
  ready: boolean;
  found: boolean;
  templateName: string | null;
  language: string | null;
  status: string | null;
  category: string | null;
  reason: string;
  checkedAt: string;
}): KapsoTemplateReadiness {
  return {
    checked: input.checked,
    ready: input.ready,
    found: input.found,
    template_name: input.templateName,
    language: input.language,
    status: input.status,
    category: input.category,
    reason: input.reason,
    checked_at: input.checkedAt,
  };
}
