import type { EmailExtractionContextPack } from "../types";

export type SanitizedEmailFixture = {
  id: string;
  institution: "bcp";
  family:
    | "debit_card_purchase"
    | "transfer_between_own_accounts"
    | "rejected_purchase_negative";
  expectedStatus: "completed" | "rejected";
  context: EmailExtractionContextPack;
};

const baseContext = {
  context_pack_type: "email_extraction_context" as const,
  version: "v1" as const,
  institution_key: "bcp",
  institution_aliases: ["BCP", "Banco de Crédito del Perú"],
  verified_sender: "servicio@notificacionesbcp.example",
  received_at: "2026-07-20T18:00:00.000Z",
  timezone: "America/Lima",
};

export const BCP_SANITIZED_EMAIL_FIXTURES: SanitizedEmailFixture[] = [
  {
    id: "bcp_debit_purchase_a",
    institution: "bcp",
    family: "debit_card_purchase",
    expectedStatus: "completed",
    context: {
      ...baseContext,
      subject: "Realizaste un consumo con tu Tarjeta de Débito BCP",
      body_text: [
        "Fecha y hora: 20/07/2026 10:30",
        "Comercio: COMERCIO FICTICIO A",
        "Monto: S/ 42.70",
        "Tarjeta: ****1234",
        "Número de operación: OP-FICTICIA-01",
      ].join("\n"),
      template: {
        id: "fixture-bcp-purchase-v1",
        version: "bcp-purchase-v1",
        matched_subject_pattern:
          "Realizaste un consumo con tu Tarjeta de Débito BCP",
      },
    },
  },
  {
    id: "bcp_debit_purchase_b",
    institution: "bcp",
    family: "debit_card_purchase",
    expectedStatus: "completed",
    context: {
      ...baseContext,
      subject: "Realizaste un consumo con tu Tarjeta de Débito BCP",
      body_text: [
        "Fecha y hora: 21/07/2026 18:45",
        "Comercio: COMERCIO FICTICIO B",
        "Monto: S/ 18.20",
        "Tarjeta: ****5678",
        "Número de operación: OP-FICTICIA-02",
      ].join("\n"),
      template: {
        id: "fixture-bcp-purchase-v1",
        version: "bcp-purchase-v1",
        matched_subject_pattern:
          "Realizaste un consumo con tu Tarjeta de Débito BCP",
      },
    },
  },
  {
    id: "bcp_own_accounts_transfer",
    institution: "bcp",
    family: "transfer_between_own_accounts",
    expectedStatus: "completed",
    context: {
      ...baseContext,
      subject:
        "Constancia de Transferencia Entre mis Cuentas",
      body_text: [
        "Fecha y hora: 20/07/2026 11:45",
        "Cuenta origen: ****1111",
        "Cuenta destino: ****2222",
        "Monto transferido: S/ 150.00",
        "Número de operación: OP-FICTICIA-03",
      ].join("\n"),
      template: {
        id: "fixture-bcp-own-transfer-v1",
        version: "bcp-own-transfer-v1",
        matched_subject_pattern:
          "Constancia de Transferencia Entre mis Cuentas",
      },
    },
  },
  {
    id: "bcp_rejected_purchase",
    institution: "bcp",
    family: "rejected_purchase_negative",
    expectedStatus: "rejected",
    context: {
      ...baseContext,
      subject:
        "Se rechazó tu compra por fondos insuficientes",
      body_text: [
        "Fecha y hora: 20/07/2026 12:15",
        "Comercio: COMERCIO FICTICIO C",
        "Monto: S/ 25.00",
        "Tarjeta: ****9876",
      ].join("\n"),
      template: {
        id: "fixture-bcp-rejected-v1",
        version: "bcp-rejected-v1",
        matched_subject_pattern:
          "Se rechazó tu compra por fondos insuficientes",
      },
    },
  },
];
