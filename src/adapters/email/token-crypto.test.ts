import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  decryptEmailToken,
  EmailTokenCryptoError,
  encryptEmailToken,
} from "./token-crypto";

describe("email token crypto", () => {
  it("cifra y descifra con AES-256-GCM sin exponer el token", () => {
    const key = randomBytes(32).toString("base64");
    const encrypted = encryptEmailToken("refresh-secret", key);

    expect(encrypted).not.toContain("refresh-secret");
    expect(decryptEmailToken(encrypted, key)).toBe("refresh-secret");
  });

  it("rechaza otra clave y formatos alterados", () => {
    const key = randomBytes(32).toString("base64");
    const encrypted = encryptEmailToken("refresh-secret", key);

    expect(() =>
      decryptEmailToken(encrypted, randomBytes(32).toString("base64")),
    ).toThrow(EmailTokenCryptoError);
    expect(() => decryptEmailToken(`${encrypted}.extra`, key)).toThrow(
      EmailTokenCryptoError,
    );
  });

  it("exige una clave real de 32 bytes", () => {
    expect(() => encryptEmailToken("token", "not-base64")).toThrow(
      EmailTokenCryptoError,
    );
  });
});

