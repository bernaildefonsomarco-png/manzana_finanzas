import { describe, expect, it } from "vitest";
import type {
  AgentRuntime,
  AgentRuntimeRequest,
  AgentRuntimeResponse,
} from "@/agents/runtime";
import {
  EmailExtractionAgent,
  validateEmailExtractionGrounding,
} from "./email-extraction-agent";
import { BCP_SANITIZED_EMAIL_FIXTURES } from "./fixtures/bcp-sanitized";
import { LocalFixtureEmailExtractionAgentRuntime } from "./local-fixture-runtime";
import type { EmailExtractionContextPack } from "./types";

describe("EmailExtractionAgent", () => {
  it("mantiene el corpus BCP sanitizado sin valores reales", () => {
    expect(BCP_SANITIZED_EMAIL_FIXTURES).toHaveLength(4);
    expect(
      BCP_SANITIZED_EMAIL_FIXTURES.map((fixture) => fixture.family),
    ).toEqual([
      "debit_card_purchase",
      "debit_card_purchase",
      "transfer_between_own_accounts",
      "rejected_purchase_negative",
    ]);
    expect(
      JSON.stringify(BCP_SANITIZED_EMAIL_FIXTURES),
    ).toContain("FICTICI");
  });

  it("extrae una compra sin decidir ni escribir", async () => {
    const result = await localAgent().extract(
      context({
        subject: "Realizaste un consumo con tu tarjeta de débito",
        body: [
          "Fecha y hora: 20/07/2026 10:30",
          "Comercio: TIENDA PRUEBA",
          "Monto: S/ 42.70",
          "Tarjeta: ****1234",
          "Número de operación: OP-TEST-01",
        ].join("\n"),
      }),
      "trace-email-1",
    );

    expect(result.output).toMatchObject({
      notice_kind: "purchase",
      operation_status: "completed",
      direction: "out",
      amount: 42.7,
      currency: "PEN",
      merchant: "TIENDA PRUEBA",
      account_hint: "1234",
    });
    expect(result.grounding).toEqual({ grounded: true, errors: [] });
    expect(result.safety.policy_flags).toContain("no_financial_decision");
  });

  it("extrae transferencia con origen y destino separados", async () => {
    const result = await localAgent().extract(
      context({
        subject: "Constancia de transferencia entre mis cuentas",
        body: [
          "Fecha y hora: 20/07/2026 11:45",
          "Cuenta origen: ****1111",
          "Cuenta destino: ****2222",
          "Monto transferido: S/ 150.00",
        ].join("\n"),
      }),
      "trace-email-2",
    );

    expect(result.output).toMatchObject({
      notice_kind: "transfer",
      operation_status: "completed",
      direction: "internal",
      account_origin_hint: "1111",
      account_destination_hint: "2222",
    });
    expect(result.grounding.grounded).toBe(true);
  });

  it("marca un intento rechazado aunque tenga monto y comercio", async () => {
    const result = await localAgent().extract(
      context({
        subject: "Se rechazó tu compra por fondos insuficientes",
        body: [
          "Fecha y hora: 20/07/2026 12:15",
          "Comercio: COMERCIO PRUEBA",
          "Monto: S/ 25.00",
          "Tarjeta: ****9876",
        ].join("\n"),
      }),
      "trace-email-3",
    );

    expect(result.output).toMatchObject({
      notice_kind: "rejected_attempt",
      operation_status: "rejected",
      amount: 25,
    });
    expect(result.grounding.grounded).toBe(true);
  });

  it("bloquea un completed que contradice un rechazo explicito", async () => {
    const rejectedContext = context({
      subject: "Compra rechazada por fondos insuficientes",
      body: [
        "Fecha y hora: 20/07/2026 12:15",
        "Comercio: COMERCIO PRUEBA",
        "Monto: S/ 25.00",
      ].join("\n"),
    });
    const result = await localAgent().extract(
      rejectedContext,
      "trace-email-rejection-contradiction",
    );

    expect(
      validateEmailExtractionGrounding(rejectedContext, {
        ...result.output,
        notice_kind: "purchase",
        operation_status: "completed",
      }).errors,
    ).toContain("status_conflicts_with_rejection_notice");
  });

  it("rechaza como no grounded un valor que no aparece en la evidencia", async () => {
    const runtime: AgentRuntime = {
      async run<TContext, TOutput>(
        request: AgentRuntimeRequest<TContext>,
      ): Promise<AgentRuntimeResponse<TOutput>> {
        void request;
        return {
          output: {
            notice_kind: "purchase",
            operation_status: "completed",
            direction: "out",
            amount: 999,
            currency: "PEN",
            occurred_at: "2026-07-20T10:30:00-05:00",
            merchant: null,
            account_hint: null,
            account_origin_hint: null,
            account_destination_hint: null,
            operation_identifier: null,
            confidence: 0.99,
            missing_fields: [],
            field_evidence: [
              { field: "notice_kind", quote: "Realizaste un consumo" },
              { field: "operation_status", quote: "Realizaste un consumo" },
              { field: "direction", quote: "Realizaste un consumo" },
              { field: "amount", quote: "S/ 10.00" },
              { field: "currency", quote: "S/ 10.00" },
              {
                field: "occurred_at",
                quote: "20/07/2026 10:30",
              },
            ],
            safe_explanation: "Extraccion de prueba.",
          } as TOutput,
          confidence: 0.99,
          tool_calls: [],
          runtime: {
            provider: "api",
            model_name: "model-test",
            latency_ms: 1,
          },
          safety: { policy_flags: [], redaction_applied: false },
        };
      },
    };
    const result = await new EmailExtractionAgent(runtime).extract(
      context({
        subject: "Realizaste un consumo",
        body: [
          "Fecha: 20/07/2026 10:30.",
          "Monto principal: S/ 10.00.",
          "Comision informada: S/ 20.00.",
        ].join("\n"),
      }),
      "trace-email-4",
    );

    expect(result.grounding.grounded).toBe(false);
    expect(result.grounding.errors).toContain("value_not_grounded:amount");
  });

  it("groundea fechas textuales y montos con caracteres invisibles", () => {
    const input = context({
      subject: "Aviso de operacion",
      body: [
        "Fecha de operacion: 20 de julio de 2026 a las 10:30",
        "Monto: S/\u200B 25.00",
      ].join("\n"),
    });
    const output = {
      notice_kind: "purchase" as const,
      operation_status: "completed" as const,
      direction: "out" as const,
      amount: 25,
      currency: "PEN" as const,
      occurred_at: "2026-07-20T10:30:00-05:00",
      merchant: null,
      account_hint: null,
      account_origin_hint: null,
      account_destination_hint: null,
      operation_identifier: null,
      confidence: 0.98,
      missing_fields: [],
      field_evidence: [
        { field: "notice_kind" as const, quote: "Aviso de operacion" },
        { field: "operation_status" as const, quote: "Aviso de operacion" },
        { field: "direction" as const, quote: "Aviso de operacion" },
        { field: "amount" as const, quote: "Monto: S/\u200B 25.00" },
        { field: "currency" as const, quote: "Monto: S/\u200B 25.00" },
        {
          field: "occurred_at" as const,
          quote: "20 de julio de 2026 a las 10:30",
        },
      ],
      safe_explanation: "Extraccion de prueba.",
    };

    expect(validateEmailExtractionGrounding(input, output)).toEqual({
      grounded: true,
      errors: [],
    });
    expect(
      validateEmailExtractionGrounding(input, {
        ...output,
        occurred_at: "2026-07-21T10:30:00-05:00",
      }).errors,
    ).toContain("value_not_grounded:occurred_at");
  });

  it("corrige un monto del agente solo si el correo tiene uno literal unico", async () => {
    const result = await new EmailExtractionAgent(
      runtimeForOutput({
        notice_kind: "purchase",
        operation_status: "completed",
        direction: "out",
        amount: 2500,
        currency: "PEN",
        occurred_at: "2026-07-20T10:30:00-05:00",
        merchant: null,
        account_hint: null,
        account_origin_hint: null,
        account_destination_hint: null,
        operation_identifier: null,
        confidence: 0.9,
        missing_fields: [],
        field_evidence: [
          { field: "notice_kind", quote: "Aviso de operacion" },
          { field: "operation_status", quote: "Aviso de operacion" },
          { field: "direction", quote: "Aviso de operacion" },
          { field: "amount", quote: "Monto de la operacion" },
          { field: "currency", quote: "Monto: S/ 25.00" },
          {
            field: "occurred_at",
            quote: "20 de julio de 2026 a las 10:30",
          },
        ],
        safe_explanation: "Extraccion de prueba.",
      }),
    ).extract(
      context({
        subject: "Aviso de operacion",
        body: [
          "Fecha: 20 de julio de 2026 a las 10:30",
          "Monto: S/ 25.00",
        ].join("\n"),
      }),
      "trace-email-unique-amount-repair",
    );

    expect(result.output.amount).toBe(25);
    expect(result.repairs.normalized_value_fields).toEqual(["amount"]);
    expect(result.repairs.evidence_fields).toContain("amount");
    expect(result.grounding).toEqual({ grounded: true, errors: [] });
  });
});

function localAgent() {
  return new EmailExtractionAgent(
    new LocalFixtureEmailExtractionAgentRuntime(),
  );
}

function context(input: {
  subject: string;
  body: string;
}): EmailExtractionContextPack {
  return {
    context_pack_type: "email_extraction_context",
    version: "v1",
    institution_key: "bcp",
    institution_aliases: ["BCP"],
    verified_sender: "servicio@notificacionesbcp.com.pe",
    subject: input.subject,
    body_text: input.body,
    received_at: "2026-07-20T18:00:00.000Z",
    timezone: "America/Lima",
    template: {
      id: "11111111-1111-4111-8111-111111111111",
      version: "bcp-v1",
      matched_subject_pattern: input.subject,
    },
  };
}

function runtimeForOutput(output: unknown): AgentRuntime {
  return {
    async run<TContext, TOutput>(
      request: AgentRuntimeRequest<TContext>,
    ): Promise<AgentRuntimeResponse<TOutput>> {
      void request;
      return {
        output: output as TOutput,
        confidence: 0.9,
        tool_calls: [],
        runtime: {
          provider: "api",
          model_name: "model-test",
          latency_ms: 1,
        },
        safety: { policy_flags: [], redaction_applied: false },
      };
    },
  };
}
