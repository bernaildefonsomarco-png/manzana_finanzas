import { describe, expect, it } from "vitest";
import {
  buildPhoneLookupCandidates,
  maskPhoneForLog,
  normalizePhoneDigits,
  normalizePhoneE164,
} from "./phone";

describe("phone utils", () => {
  it("normaliza telefonos a E.164 con prefijo + para guardar en perfil", () => {
    expect(normalizePhoneE164("+51 928 377 977")).toBe("+51928377977");
    expect(normalizePhoneE164("51928377977")).toBe("+51928377977");
  });

  it("genera candidatos compatibles para webhooks con o sin +", () => {
    expect(buildPhoneLookupCandidates("51 928 377 977")).toEqual([
      "+51928377977",
      "51928377977",
    ]);
  });

  it("rechaza valores que no parecen telefonos reales", () => {
    expect(normalizePhoneDigits("123")).toBeNull();
    expect(normalizePhoneE164("")).toBeNull();
    expect(buildPhoneLookupCandidates("abc")).toEqual([]);
  });

  it("enmascara el telefono para logs", () => {
    expect(maskPhoneForLog("+51 928 377 977")).toBe("***7977");
  });
});
