import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

export function encryptKey(secret: string, encryptionKey: string, organizationId: string): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(encryptionKey, "hex"), nonce);
  cipher.setAAD(Buffer.from(organizationId));
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  return [
    "v1",
    nonce.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptKey(
  encrypted: string,
  encryptionKey: string,
  organizationId: string,
): string {
  const [version, nonce, tag, value] = encrypted.split(".");
  if (version !== "v1" || !nonce || !tag || !value)
    throw new Error("Unsupported encrypted key format.");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    Buffer.from(encryptionKey, "hex"),
    Buffer.from(nonce, "base64"),
  );
  decipher.setAAD(Buffer.from(organizationId));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(value, "base64")), decipher.final()]).toString(
    "utf8",
  );
}
