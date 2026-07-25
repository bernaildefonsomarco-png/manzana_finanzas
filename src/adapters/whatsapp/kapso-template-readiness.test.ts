import { describe, expect, it } from "vitest";
import { checkKapsoTemplateReadiness } from "./kapso-template-readiness";

const config = {
  apiKey: "kapso-key",
  businessAccountId: "waba-1",
  templateName: "manzana_payment_due",
  templateLanguage: "es_PE",
  apiBaseUrl: "https://api.kapso.test/meta/whatsapp/v24.0",
};

describe("Kapso template readiness", () => {
  it("confirma en vivo un template aprobado con nombre e idioma exactos", async () => {
    const calls: string[] = [];
    const readiness = await checkKapsoTemplateReadiness(
      config,
      async (url, init) => {
        calls.push(String(url));
        expect(init?.headers).toMatchObject({ "X-API-Key": "kapso-key" });
        return new Response(
          JSON.stringify({
            data: [
              {
                name: "manzana_payment_due",
                language: "es_PE",
                status: "APPROVED",
                category: "UTILITY",
              },
            ],
          }),
          { status: 200 },
        );
      },
      new Date("2026-07-20T12:00:00.000Z"),
    );

    expect(calls[0]).toContain("waba-1/message_templates");
    expect(calls[0]).toContain("name=manzana_payment_due");
    expect(readiness).toMatchObject({
      checked: true,
      ready: true,
      found: true,
      status: "APPROVED",
      category: "UTILITY",
      reason: "template_approved_live",
    });
  });

  it("no confunde template pendiente con aprobado", async () => {
    const readiness = await checkKapsoTemplateReadiness(config, async () =>
      new Response(
        JSON.stringify({
          data: [
            {
              name: "manzana_payment_due",
              language: "es_PE",
              status: "PENDING",
              category: "UTILITY",
            },
          ],
        }),
        { status: 200 },
      ),
    );

    expect(readiness.ready).toBe(false);
    expect(readiness.reason).toBe("template_status_pending");
  });

  it("no llama al proveedor cuando falta configuracion", async () => {
    let called = false;
    const readiness = await checkKapsoTemplateReadiness(
      { ...config, apiKey: "" },
      async () => {
        called = true;
        return new Response("{}");
      },
    );

    expect(called).toBe(false);
    expect(readiness.checked).toBe(false);
    expect(readiness.reason).toContain("kapso_api_key_missing");
  });
});
