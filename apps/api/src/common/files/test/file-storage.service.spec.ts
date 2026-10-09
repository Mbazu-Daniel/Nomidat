import { ServiceUnavailableException } from "@nestjs/common";
import { describe, expect, it } from "vitest";
import type { ApiEnv } from "../../config/env";
import { FileStorageService } from "../file-storage.service";
import { FileLocation } from "../types/file-location.type";

const ORG = "3f1c9a20-6d5e-4a1b-9c33-8f2b7e5d0a11";

/**
 * No R2 credentials are needed to exercise these paths: the failure cases are
 * about refusing to hand out a capability, which happens before any signing.
 * The success case is covered by the endpoint being exercised against a real
 * bucket in development.
 */
function serviceWith(env: Partial<ApiEnv>) {
  return new FileStorageService(env as ApiEnv);
}

const REQUEST = {
  organizationId: ORG,
  location: FileLocation.PRODUCT_IMAGES,
  fileName: "jollof.jpg",
  contentType: "image/jpeg",
  contentLength: 1024,
} as const;

describe("FileStorageService.generateUploadUrl", () => {
  it("refuses when R2 is not configured", async () => {
    await expect(serviceWith({}).generateUploadUrl(REQUEST)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it("refuses when only some R2 values are configured", async () => {
    await expect(
      serviceWith({
        R2_ACCOUNT_ID: "acct",
        R2_BUCKET_NAME: "bucket",
      }).generateUploadUrl(REQUEST),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it("treats a blank value as absent", async () => {
    await expect(
      serviceWith({
        R2_ACCOUNT_ID: "acct",
        R2_ACCESS_KEY_ID: "   ",
        R2_SECRET_ACCESS_KEY: "secret",
        R2_BUCKET_NAME: "bucket",
      }).generateUploadUrl(REQUEST),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
