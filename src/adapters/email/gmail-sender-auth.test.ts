import { describe, expect, it } from "vitest";
import type { GmailMessage } from "./contracts";
import { authenticateGmailSender } from "./gmail-sender-auth";

const sender = "notificaciones@notificacionesbcp.com.pe";

describe("authenticateGmailSender", () => {
  it("acepta DMARC y DKIM pass alineados emitidos por Gmail", () => {
    expect(
      authenticateGmailSender(
        message(
          "mx.google.com; dkim=pass header.d=notificacionesbcp.com.pe; " +
            "spf=pass smtp.mailfrom=em.notificacionesbcp.com.pe; " +
            "dmarc=pass header.from=notificacionesbcp.com.pe",
        ),
        sender,
      ),
    ).toEqual({
      authenticated: true,
      method: "gmail_authentication_results_dkim_dmarc",
      fromDomain: "notificacionesbcp.com.pe",
    });
  });

  it("acepta header.i como identidad DKIM alineada de Gmail", () => {
    expect(
      authenticateGmailSender(
        message(
          "mx.google.com; dkim=pass header.i=@notificacionesbcp.com.pe; " +
            "dmarc=pass header.from=notificacionesbcp.com.pe",
        ),
        sender,
      ),
    ).toEqual({
      authenticated: true,
      method: "gmail_authentication_results_dkim_dmarc",
      fromDomain: "notificacionesbcp.com.pe",
    });
  });

  it("no confia en un Authentication-Results agregado por el remitente", () => {
    expect(
      authenticateGmailSender(
        message(
          "attacker.invalid; dkim=pass header.d=notificacionesbcp.com.pe; " +
            "dmarc=pass header.from=notificacionesbcp.com.pe",
        ),
        sender,
      ),
    ).toEqual({
      authenticated: false,
      reason: "google_authentication_results_missing",
    });
  });

  it("rechaza DMARC o DKIM no alineados con From", () => {
    expect(
      authenticateGmailSender(
        message(
          "mx.google.com; dkim=pass header.d=attacker.invalid; " +
            "dmarc=pass header.from=attacker.invalid",
        ),
        sender,
      ),
    ).toEqual({
      authenticated: false,
      reason: "dmarc_domain_mismatch",
    });
  });

  it("rechaza coincidencias visuales y subdominios atacantes", () => {
    expect(
      authenticateGmailSender(
        message(
          "mx.google.com; dkim=pass header.d=notificacionesbcp.com.pe.attacker.invalid; " +
            "dmarc=pass header.from=notificacionesbcp.com.pe.attacker.invalid",
          "notificaciones@notificacionesbcp.com.pe.attacker.invalid",
        ),
        sender,
      ),
    ).toEqual({ authenticated: false, reason: "from_mismatch" });
  });
});

function message(
  authenticationResults: string,
  from = sender,
): GmailMessage {
  return {
    id: "message-1",
    threadId: "thread-1",
    internalDate: "1784541600000",
    snippet: null,
    payload: {
      mimeType: "text/plain",
      headers: [
        { name: "From", value: `Banco <${from}>` },
        {
          name: "Authentication-Results",
          value: authenticationResults,
        },
      ],
      body: null,
      parts: [],
    },
  };
}
