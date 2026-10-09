import { describe, expect, it } from "vitest";
import { getR2Config, type ApiEnv } from "../../config/env";

const CREDENTIALS = {
  R2_ACCOUNT_ID: "account",
  R2_ACCESS_KEY_ID: "access",
  R2_SECRET_ACCESS_KEY: "secret",
  R2_BUCKET_NAME: "bucket",
} as const;

function configWith(env: Partial<ApiEnv>) {
  return getR2Config(env as ApiEnv);
}

describe("getR2Config", () => {
  it("is undefined when no R2 values are configured", () => {
    expect(configWith({})).toBeUndefined();
  });

  it("is undefined when only some credentials are configured", () => {
    expect(configWith({ R2_ACCOUNT_ID: "account", R2_BUCKET_NAME: "bucket" })).toBeUndefined();
  });

  it("treats a blank credential as absent", () => {
    expect(configWith({ ...CREDENTIALS, R2_SECRET_ACCESS_KEY: "   " })).toBeUndefined();
  });

  it("returns the credentials when all four are present", () => {
    expect(configWith(CREDENTIALS)).toMatchObject({
      accountId: "account",
      accessKeyId: "access",
      secretAccessKey: "secret",
      bucketName: "bucket",
    });
  });

  // A bucket with no public hostname is a legitimate private setup, so this
  // must be undefined rather than an error.
  it("has no public url when neither hostname is configured", () => {
    expect(configWith(CREDENTIALS)?.publicUrl).toBeUndefined();
  });

  it("prefers the custom domain over the r2.dev fallback", () => {
    expect(
      configWith({
        ...CREDENTIALS,
        R2_CUSTOM_DOMAIN: "files.example.com",
        R2_PUBLIC_ID: "abc123",
      })?.publicUrl,
    ).toBe("https://files.example.com");
  });

  it("keeps a custom domain that already carries a scheme", () => {
    expect(
      configWith({ ...CREDENTIALS, R2_CUSTOM_DOMAIN: "http://localhost:8788" })?.publicUrl,
    ).toBe("http://localhost:8788");
  });

  it("falls back to the r2.dev pattern when only a public id is set", () => {
    expect(configWith({ ...CREDENTIALS, R2_PUBLIC_ID: "abc123" })?.publicUrl).toBe(
      "https://pub-abc123.r2.dev",
    );
  });

  it("ignores a blank public id rather than building a broken url", () => {
    expect(configWith({ ...CREDENTIALS, R2_PUBLIC_ID: "  " })?.publicUrl).toBeUndefined();
  });

  it("trims surrounding whitespace from a custom domain", () => {
    expect(
      configWith({ ...CREDENTIALS, R2_CUSTOM_DOMAIN: "  files.example.com  " })?.publicUrl,
    ).toBe("https://files.example.com");
  });
});
