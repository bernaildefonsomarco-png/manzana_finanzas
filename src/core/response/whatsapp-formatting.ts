export function normalizeWhatsAppFormatting(text: string): string {
  return text
    .replace(/\*\*([^*\n]+)\*\*/g, "*$1*")
    .replace(/__([^_\n]+)__/g, "_$1_");
}
