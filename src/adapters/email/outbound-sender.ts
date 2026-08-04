// `46` §9 — el trabajador compone el cuerpo en el momento del envío,
// consultando lo mínimo; esta interfaz es el punto de extensión hacia el
// proveedor real (Resend, Postmark, SES…). Ninguna credencial de proveedor
// existe hoy en `.env.local.example` (`AC-MAIL-12`, autenticación de
// dominio, es evidencia `LIVE`: depende de configurar SPF/DKIM/DMARC en un
// dominio real, no de código) — `LoggingEmailSender` es el valor por
// defecto seguro mientras tanto: registra el envío sin credenciales,
// nunca falla en silencio pretendiendo que se entregó.

import { logger } from "@/shared/telemetry/logger";

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

export function createEmailSender(): EmailSender {
  // Punto único donde un futuro `RESEND_API_KEY` (o el proveedor que se
  // elija) se conectaría; hoy siempre cae al remitente de registro.
  return new LoggingEmailSender();
}
