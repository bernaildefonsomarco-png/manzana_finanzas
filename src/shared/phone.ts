const MIN_E164_DIGITS = 8;
const MAX_E164_DIGITS = 15;

export function normalizePhoneDigits(input: string | null | undefined): string | null {
  if (!input) return null;

  const digits = input.replace(/\D/g, "");
  if (digits.length < MIN_E164_DIGITS || digits.length > MAX_E164_DIGITS) {
    return null;
  }

  return digits;
}

export function normalizePhoneE164(input: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(input);
  return digits ? `+${digits}` : null;
}

export function buildPhoneLookupCandidates(input: string | null | undefined): string[] {
  const digits = normalizePhoneDigits(input);
  if (!digits) return [];

  return [`+${digits}`, digits];
}

export function maskPhoneForLog(input: string | null | undefined): string | null {
  const digits = normalizePhoneDigits(input);
  if (!digits) return null;

  return `***${digits.slice(-4)}`;
}
