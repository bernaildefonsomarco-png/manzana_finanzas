// `46` `RUL-MAIL-05` — qué puede y qué no puede llevar un correo. El
// envoltorio común impone estructuralmente lo que un template no debería
// poder romper por descuido: sin imágenes remotas, con versión en texto
// plano, con la línea "Te escribo esto porque…", y el pie de baja solo
// cuando el correo es de notificación (los transaccionales no llevan baja,
// `RUL-MAIL-01`).

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  headers: Record<string, string>;
};

export function renderTransactionalEmail(input: {
  subject: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
}): RenderedEmail {
  return render({ ...input, footerLines: [], unsubscribe: null });
}

export function renderNotificationEmail(input: {
  subject: string;
  bodyLines: string[];
  reasonLine: string;
  ctaLabel?: string;
  ctaUrl?: string;
  unsubscribeUrl: string;
}): RenderedEmail {
  return render({
    subject: input.subject,
    bodyLines: input.bodyLines,
    ctaLabel: input.ctaLabel,
    ctaUrl: input.ctaUrl,
    footerLines: [input.reasonLine],
    unsubscribe: input.unsubscribeUrl,
  });
}

function render(input: {
  subject: string;
  bodyLines: string[];
  ctaLabel?: string;
  ctaUrl?: string;
  footerLines: string[];
  unsubscribe: string | null;
}): RenderedEmail {
  const textParts = [...input.bodyLines];
  if (input.ctaLabel && input.ctaUrl) textParts.push("", `${input.ctaLabel}: ${input.ctaUrl}`);
  if (input.footerLines.length) textParts.push("", ...input.footerLines);
  if (input.unsubscribe) {
    textParts.push("", `Dejar de recibir esto: ${input.unsubscribe}`);
  }
  const text = textParts.join("\n");

  const htmlBody = input.bodyLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n");
  const cta =
    input.ctaLabel && input.ctaUrl
      ? `<p><a href="${escapeAttribute(input.ctaUrl)}">${escapeHtml(input.ctaLabel)}</a></p>`
      : "";
  const footer = input.footerLines.map((line) => `<p>${escapeHtml(line)}</p>`).join("\n");
  const unsubscribe = input.unsubscribe
    ? `<p><a href="${escapeAttribute(input.unsubscribe)}">Dejar de recibir esto</a></p>`
    : "";

  const headers: Record<string, string> = {};
  if (input.unsubscribe) {
    // `RUL-MAIL-04`: cabecera `List-Unsubscribe` con `One-Click` — lo que
    // hace que el botón "cancelar suscripción" del cliente de correo
    // funcione de verdad, sin ella marca como spam.
    headers["List-Unsubscribe"] = `<${input.unsubscribe}>`;
    headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
  }

  return {
    subject: input.subject,
    html: `${htmlBody}\n${cta}\n${footer}\n${unsubscribe}`,
    text,
    headers,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/"/g, "&quot;");
}
