import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { EmailExtractionAgent } from "./email-extraction-agent";
import { BCP_SANITIZED_EMAIL_FIXTURES } from "./fixtures/bcp-sanitized";

const shouldRunSmoke =
  process.env.RUN_OPENAI_EMAIL_EXTRACTION_SMOKE === "true";
const describeIf = shouldRunSmoke ? describe : describe.skip;
const originalEnv = new Map<string, string | undefined>();

describeIf("EmailExtractionAgent OpenAI API smoke", () => {
  beforeAll(() => {
    loadEnvLocalIfNeeded();
    setEnv("AGENT_RUNTIME_EMAIL_EXTRACTION_AGENT_PROVIDER", "api");
    setEnv("AGENT_RUNTIME_DEFAULT_PROVIDER", "local_fixture");
    setEnv("AGENT_RUNTIME_API_KIND", "openai");
    setEnv("AGENT_RUNTIME_FALLBACK_LOCAL", "false");

    if (!process.env.OPENAI_API_KEY && !process.env.AGENT_RUNTIME_API_TOKEN) {
      throw new Error(
        "RUN_OPENAI_EMAIL_EXTRACTION_SMOKE=true requiere una credencial API.",
      );
    }
    if (!process.env.AGENT_RUNTIME_API_MODEL) {
      throw new Error(
        "RUN_OPENAI_EMAIL_EXTRACTION_SMOKE=true requiere AGENT_RUNTIME_API_MODEL.",
      );
    }
  });

  afterAll(() => {
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it(
    "extrae el corpus BCP sintetico sin decidir ni registrar",
    async () => {
      const agent = new EmailExtractionAgent();

      for (const fixture of BCP_SANITIZED_EMAIL_FIXTURES) {
        const result = await agent.extract(
          fixture.context,
          `trace-email-extraction-smoke-${fixture.id}`,
        );

        expect(result.runtime.provider).toBe("api");
        expect(result.grounding).toEqual({ grounded: true, errors: [] });
        expect(result.output.operation_status).toBe(fixture.expectedStatus);
        expect(result.output.amount).not.toBeNull();
        expect(result.output.currency).toBe("PEN");
        expect(result.output.occurred_at).not.toBeNull();
        expect(result.tool_calls).toEqual([]);
      }
    },
    120_000,
  );
});

function loadEnvLocalIfNeeded() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const value = unquote(trimmed.slice(separatorIndex + 1).trim());
    if (!process.env[key]) setEnv(key, value);
  }
}

function setEnv(key: string, value: string) {
  if (!originalEnv.has(key)) originalEnv.set(key, process.env[key]);
  process.env[key] = value;
}

function unquote(value: string): string {
  if (
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}
