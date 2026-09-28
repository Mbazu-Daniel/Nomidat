import { describe, expect, it } from "vitest";
import { decryptKey, encryptKey } from "../key-encryption";

const key = "ab".repeat(32);
describe("business payment keys", () => {
  it("encrypts using fresh nonces and decrypts only for the owning organization", () => {
    const encrypted = encryptKey("sk_test_private", key, "business-a");
    expect(encrypted).not.toContain("sk_test_private");
    expect(encryptKey("sk_test_private", key, "business-a")).not.toBe(encrypted);
    expect(decryptKey(encrypted, key, "business-a")).toBe("sk_test_private");
    expect(() => decryptKey(encrypted, key, "business-b")).toThrow();
    expect(() => decryptKey(encrypted, "cd".repeat(32), "business-a")).toThrow();
  });
  it("rejects tampered ciphertext and plaintext legacy keys", () => {
    const encrypted = encryptKey("sk_test_private", key, "business-a");
    const parts = encrypted.split(".");
    parts[3] = Buffer.from("tampered-value").toString("base64");
    expect(() => decryptKey(parts.join("."), key, "business-a")).toThrow();
    expect(() => decryptKey("sk_test_private", key, "business-a")).toThrow();
  });
});
