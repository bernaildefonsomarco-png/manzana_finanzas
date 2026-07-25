import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

const TOKEN_VERSION = "v1";

export class EmailTokenCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "EmailTokenCryptoError";
  }
}

export function encryptEmailToken(token: string, encodedKey: string): string {
  if (!token.trim()) throw new EmailTokenCryptoError("Token Gmail vacio");
  const key = decodeKey(encodedKey);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from("manzana:gmail:refresh-token:v1", "utf8"));
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    TOKEN_VERSION,
    iv.toString("base64url"),
    tag.toString("base64url"),
    ciphertext.toString("base64url"),
  ].join(".");
}

export function decryptEmailToken(encrypted: string, encodedKey: string): string {
  const [version, ivPart, tagPart, ciphertextPart, extra] = encrypted.split(".");
  if (
    version !== TOKEN_VERSION ||
    !ivPart ||
    !tagPart ||
    !ciphertextPart ||
    extra
  ) {
    throw new EmailTokenCryptoError("Formato de token Gmail invalido");
  }

  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      decodeKey(encodedKey),
      Buffer.from(ivPart, "base64url"),
    );
    decipher.setAAD(Buffer.from("manzana:gmail:refresh-token:v1", "utf8"));
    decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertextPart, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch (error) {
    if (error instanceof EmailTokenCryptoError) throw error;
    throw new EmailTokenCryptoError("No se pudo descifrar el token Gmail");
  }
}

function decodeKey(encodedKey: string): Buffer {
  let key: Buffer;
  try {
    key = Buffer.from(encodedKey, "base64");
  } catch {
    throw new EmailTokenCryptoError("Clave Gmail invalida");
  }
  if (key.length !== 32) {
    throw new EmailTokenCryptoError(
      "GMAIL_TOKEN_ENCRYPTION_KEY debe contener 32 bytes en base64",
    );
  }
  return key;
}

