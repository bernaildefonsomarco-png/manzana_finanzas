// Adaptador real de Resend (`https://resend.com`) para `EmailSender`
// (`46` §9). Sin dependencia nueva: la API de Resend es un `POST` con
// `fetch`, y añadir el paquete oficial solo para esto sería una dependencia
// más para una llamada. Se activa solo cuando `RESEND_API_KEY` existe
// (`src/adapters/email/outbound-sender.ts`, `createEmailSender`).

import type { EmailSender, OutboundEmail, SendResult } from "./outbound-sender";

const RESEND_API_URL = "https://api.resend.com/emails";

export class ResendEmailSender implements EmailSender {
  constructor(
    private readonly apiKey: string,
    private readonly fromAddress: string,
  ) {}

  async send(email: OutboundEmail): Promise<SendResult> {
    try {
      const response = await fetch(RESEND_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromAddress,
          to: email.to,
          subject: email.subject,
          html: email.html,
          text: email.text,
          headers: email.headers,
        }),
      });

      const payload = (await response.json().catch(() => null)) as { id?: string; message?: string } | null;

      if (!response.ok) {
        return {
          ok: false,
          error: payload?.message ?? `Resend respondió ${response.status}.`,
        };
      }
      if (!payload?.id) {
        return { ok: false, error: "Resend no devolvió un identificador de mensaje." };
      }
      return { ok: true, providerMessageId: payload.id };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : "Fallo de red al llamar a Resend." };
    }
  }
}
