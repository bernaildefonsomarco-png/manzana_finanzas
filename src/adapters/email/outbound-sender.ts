// `46` §9 — el trabajador compone el cuerpo en el momento del envío,
// consultando lo mínimo; esta interfaz es el punto de extensión hacia el
// proveedor real. `AC-MAIL-12` (SPF/DKIM/DMARC) sigue siendo evidencia
// `LIVE`: depende de un dominio real autenticado ante el proveedor, no de
// código — `createEmailSender` no puede cerrar eso por sí solo, solo dejar
// de ser el bloqueador de código.

import { logger } from "@/shared/telemetry/logger";
import { ResendEmailSender } from "./resend-sender";

export type OutboundEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
};

export type SendResult =
  | { ok: true; providerMessageId: string }
  | { ok: false; error: string };

export interface EmailSender {
  send(email: OutboundEmail): Promise<SendResult>;
}

/**
 * Sin proveedor configurado, se registra la intención de envío (nunca el
 * cuerpo — `19` §4.1) y se reporta éxito local: permite verificar todo el
 * resto del sistema (política, idempotencia, supresión) sin depender de
 * credenciales reales. Sustituirlo por un adaptador real de proveedor es
 * trabajo de despliegue, no de este corte.
 */
export class LoggingEmailSender implements EmailSender {
  async send(email: OutboundEmail): Promise<SendResult> {
    logger.info("email.send_attempted_without_provider", {
      operation: "email_outbox.send",
      subject_length: email.subject.length,
    });
    return { ok: true, providerMessageId: `local-${Date.now()}` };
  }
}

/**
 * Punto único donde se elige el proveedor. Con `RESEND_API_KEY` configurado
 * (Vercel → Production), envía de verdad; sin él, cae al remitente de
 * registro (`LoggingEmailSender`) sin fallar el resto del sistema.
 * `EMAIL_FROM_ADDRESS` es el remitente — Resend exige que su dominio esté
 * verificado ante ellos (`AC-MAIL-12`); sin `EMAIL_FROM_ADDRESS` propio cae
 * a `onboarding@resend.dev`, el remitente de prueba de Resend que solo
 * entrega a la propia cuenta y nunca cierra `AC-MAIL-12`.
 */
export function createEmailSender(): EmailSender {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return new LoggingEmailSender();

  const fromAddress = process.env.EMAIL_FROM_ADDRESS || "Manzana <onboarding@resend.dev>";
  return new ResendEmailSender(apiKey, fromAddress);
}
