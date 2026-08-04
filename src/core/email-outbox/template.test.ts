import { describe, expect, it } from "vitest";
import { renderNotificationEmail, renderTransactionalEmail } from "./template";

describe("renderTransactionalEmail — RUL-MAIL-01: sin enlace de baja", () => {
  it("no lleva List-Unsubscribe ni texto de baja", () => {
    const email = renderTransactionalEmail({
      subject: "Confirma tu correo",
      bodyLines: ["Pulsa el enlace para confirmar tu correo."],
      ctaLabel: "Confirmar",
      ctaUrl: "https://manzana.app/verificar?t=abc",
    });
    expect(email.headers["List-Unsubscribe"]).toBeUndefined();
    expect(email.text).not.toContain("Dejar de recibir");
    expect(email.html).not.toContain("Dejar de recibir");
  });

  it("incluye versión en texto plano (AC-MAIL-13)", () => {
    const email = renderTransactionalEmail({ subject: "x", bodyLines: ["Hola."] });
    expect(email.text).toContain("Hola.");
  });
});

describe("renderNotificationEmail — AC-MAIL-05: List-Unsubscribe con One-Click", () => {
  it("lleva la cabecera List-Unsubscribe con List-Unsubscribe-Post: One-Click", () => {
    const email = renderNotificationEmail({
      subject: "Tienes un pago esta semana",
      bodyLines: ["Tu cuota vence el viernes."],
      reasonLine: "Te escribo esto porque activaste los avisos de cuotas.",
      unsubscribeUrl: "https://manzana.app/baja?t=xyz",
    });
    expect(email.headers["List-Unsubscribe"]).toBe("<https://manzana.app/baja?t=xyz>");
    expect(email.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });

  it("46 §6: incluye la línea 'Te escribo esto porque…'", () => {
    const email = renderNotificationEmail({
      subject: "x",
      bodyLines: ["cuerpo"],
      reasonLine: "Te escribo esto porque activaste los avisos de cuotas.",
      unsubscribeUrl: "https://manzana.app/baja?t=xyz",
    });
    expect(email.text).toContain("Te escribo esto porque");
  });

  it("AC-MAIL-06: el asunto nunca se construye con un monto (disciplina de quien llama, verificado aquí como contrato)", () => {
    const email = renderNotificationEmail({
      subject: "Tienes un pago esta semana",
      bodyLines: ["Son S/180.00."],
      reasonLine: "x",
      unsubscribeUrl: "https://manzana.app/baja?t=xyz",
    });
    expect(email.subject).not.toMatch(/S\/\s?\d/);
  });

  it("AC-MAIL-07: sin imágenes remotas — el renderizador nunca emite <img>", () => {
    const email = renderNotificationEmail({
      subject: "x",
      bodyLines: ["cuerpo"],
      reasonLine: "x",
      unsubscribeUrl: "https://manzana.app/baja?t=xyz",
    });
    expect(email.html).not.toContain("<img");
  });

  it("escapa HTML del cuerpo para que no se pueda inyectar marcado", () => {
    const email = renderNotificationEmail({
      subject: "x",
      bodyLines: ['<script>alert("x")</script>'],
      reasonLine: "x",
      unsubscribeUrl: "https://manzana.app/baja?t=xyz",
    });
    expect(email.html).not.toContain("<script>");
  });
});
