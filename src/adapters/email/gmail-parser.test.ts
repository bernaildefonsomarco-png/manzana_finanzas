import { describe, expect, it } from "vitest";
import type { GmailMessage } from "./contracts";
import {
  extractMessageText,
  GmailParserConfigSchema,
  matchesVerifiedSender,
  normalizeEmailAddress,
  parseGmailMovement,
  parseGmailMovementWithTemplates,
} from "./gmail-parser";

const template = {
  id: "template-1",
  institutionKey: "bank_test",
  templateVersion: "v1",
  sender: "alertas@banco.test",
  parserConfig: {
    schema_version: "gmail_parser_v1",
    subject_patterns: ["Alerta de movimiento"],
    extraction_rules: {
      amount: {
        pattern: "(?:S/|PEN)\\s*([\\d.,]+)",
        type: "number",
      },
      merchant: {
        pattern: "(?:en|comercio)\\s+(.+?)\\s+por\\s+(?:S/|PEN)",
        type: "string",
      },
      occurred_at: {
        pattern: "(20\\d{2}-\\d{2}-\\d{2})",
        type: "datetime",
        format: "YYYY-MM-DD",
      },
      account_hint: {
        pattern: "(?:cuenta|tarjeta)\\s+(?:\\*+|x+)?(\\d{4})",
        type: "string",
      },
      direction: "out",
      currency: "PEN",
    },
    allow_generic_fallback: true,
    confidence: { template: 0.93, fallback: 0.55 },
    institution_aliases: ["Banco Test"],
  },
};

describe("gmail-parser", () => {
  it("normaliza From sin aceptar dominios parecidos", () => {
    expect(normalizeEmailAddress("Banco <ALERTAS@BANCO.TEST>")).toBe(
      "alertas@banco.test",
    );
    expect(matchesVerifiedSender(message("Compra S/ 10"), template.sender)).toBe(
      true,
    );
    expect(
      matchesVerifiedSender(
        message("Compra S/ 10", "alertas@banco.test.attacker.invalid"),
        template.sender,
      ),
    ).toBe(false);
  });

  it("parsea compra allowlisted y solo devuelve hashes, no cuerpo", () => {
    const parsed = parseGmailMovement(
      message("Compra en MERCADO CENTRAL por S/ 45.90 el 2026-07-20"),
      template,
    );

    expect(parsed).toMatchObject({
      movementType: "gasto",
      amount: 45.9,
      currency: "PEN",
      merchant: "MERCADO CENTRAL",
      sender: template.sender,
      occurredAt: "2026-07-20T17:00:00.000Z",
      parseMode: "template",
      institutionKey: "bank_test",
    });
    expect(parsed?.subjectHash).toMatch(/^[0-9a-f]{64}$/);
    expect(parsed).not.toHaveProperty("body");
  });

  it("usa HTML solo en memoria y parsea ingreso USD", () => {
    const input = message("", template.sender, "text/html");
    input.payload!.body = {
      data: Buffer.from(
        "<style>.x{}</style><p>Abono recibido USD 100.00 en Empresa ACME.</p>",
      ).toString("base64url"),
    };
    expect(extractMessageText(input)).not.toContain("<p>");
    expect(
      parseGmailMovement(input, {
        ...template,
        parserConfig: {
          ...template.parserConfig,
          extraction_rules: {
            amount: {
              pattern: "USD\\s*([\\d.,]+)",
              type: "number",
            },
            merchant: {
              pattern: "en\\s+(.+?)(?:\\.|$)",
              type: "string",
            },
            direction: "in",
            currency: "USD",
          },
        },
      }),
    ).toMatchObject({
      movementType: "ingreso",
      amount: 100,
      currency: "USD",
      parseMode: "template",
    });
  });

  it("rechaza remitente no allowlisted o correo incompleto", () => {
    expect(
      parseGmailMovement(message("Compra S/ 10", "phishing@attacker.test"), template),
    ).toBeNull();
    expect(parseGmailMovement(message("Alerta informativa"), template)).toBeNull();
  });

  it("selecciona el template por remitente y asunto entre varias versiones", () => {
    const outcome = parseGmailMovementWithTemplates(
      message("Compra en MERCADO por S/ 45.90 el 2026-07-20"),
      [
        {
          ...template,
          id: "template-other",
          parserConfig: {
            ...template.parserConfig,
            subject_patterns: ["Transferencia recibida"],
            allow_generic_fallback: false,
          },
        },
        template,
      ],
    );

    expect(outcome).toMatchObject({
      status: "parsed",
      movement: {
        templateId: "template-1",
        matchedSubjectPattern: "Alerta de movimiento",
        parseMode: "template",
      },
    });
  });

  it("marca el fallback generico con menor confianza y cuenta inferida", () => {
    const input = message(
      "Compra en FARMACIA por S/ 18.50 con tarjeta ****4321 el 2026-07-20",
    );
    input.payload!.headers = input.payload!.headers.map((header) =>
      header.name === "Subject"
        ? { ...header, value: "Aviso no versionado" }
        : header,
    );

    const outcome = parseGmailMovementWithTemplates(input, [template]);

    expect(outcome).toMatchObject({
      status: "parsed",
      movement: {
        parseMode: "generic_fallback",
        confidence: 0.55,
        accountHint: "4321",
      },
    });
  });

  it("rechaza configuracion invalida sin volver al parser generico", () => {
    const outcome = parseGmailMovementWithTemplates(
      message("Compra en MERCADO por S/ 45.90 el 2026-07-20"),
      [{ ...template, parserConfig: {} }],
    );

    expect(outcome).toMatchObject({
      status: "failed",
      failureCode: "invalid_template_config",
      invalidTemplateIds: ["template-1"],
    });
  });

  it("rechaza patrones con backtracking anidado", () => {
    const validation = GmailParserConfigSchema.safeParse({
      ...template.parserConfig,
      extraction_rules: {
        ...template.parserConfig.extraction_rules,
        amount: {
          pattern: "(a+)+",
          type: "number",
        },
      },
    });

    expect(validation.success).toBe(false);
  });

  it("rechaza una fecha configurada que no existe", () => {
    const parsed = parseGmailMovement(
      message("Compra en MERCADO por S/ 45.90 el 2026-02-31"),
      {
        ...template,
        parserConfig: {
          ...template.parserConfig,
          allow_generic_fallback: false,
        },
      },
    );

    expect(parsed).toBeNull();
  });
});

function message(
  body: string,
  sender = "alertas@banco.test",
  mimeType = "text/plain",
): GmailMessage {
  return {
    id: "gmail-message-1",
    threadId: "thread-1",
    internalDate: String(new Date("2026-07-20T15:00:00Z").getTime()),
    snippet: null,
    payload: {
      mimeType,
      headers: [
        { name: "From", value: `Banco <${sender}>` },
        { name: "Subject", value: "Alerta de movimiento" },
      ],
      body: { data: Buffer.from(body).toString("base64url") },
      parts: [],
    },
  };
}
