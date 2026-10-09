import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { describe, expect, it } from "vitest";
import { GenerateUploadUrlDto } from "../dto/generate-upload-url.dto";
import { MAX_UPLOAD_BYTES } from "../files.constants";

/**
 * The upload request is the last place a hostile content type or size can be
 * refused. Everything downstream — the presigned URL, the bucket, the public
 * hostname — trusts whatever passes here, so these are boundary tests rather
 * than tests of the DTO's own plumbing.
 */
async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(GenerateUploadUrlDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

const VALID = {
  location: "product-images",
  fileName: "jollof.jpg",
  contentType: "image/jpeg",
  contentLength: 1024,
};

describe("GenerateUploadUrlDto", () => {
  it("accepts a well-formed image request", async () => {
    expect(await errorsFor(VALID)).toEqual([]);
  });

  it.each(["image/png", "image/webp", "image/jpeg"])("accepts %s", async (contentType) => {
    expect(await errorsFor({ ...VALID, contentType })).toEqual([]);
  });

  // The bucket is served from a public hostname, so a browser-executable type
  // stored there is stored XSS on our own domain.
  it.each(["text/html", "image/svg+xml", "application/javascript", "text/plain"])(
    "refuses %s",
    async (contentType) => {
      expect(await errorsFor({ ...VALID, contentType })).toContain("isIn");
    },
  );

  // Signed into the URL, so R2 rejects it at the edge. An absent size would sign
  // a URL permitting an unbounded upload.
  it("refuses a missing content length", async () => {
    const withoutLength: Record<string, unknown> = { ...VALID };
    delete withoutLength.contentLength;
    expect(await errorsFor(withoutLength)).toContain("isInt");
  });

  it("refuses a size over the cap", async () => {
    expect(await errorsFor({ ...VALID, contentLength: MAX_UPLOAD_BYTES + 1 })).toContain("max");
  });

  it("accepts a size exactly at the cap", async () => {
    expect(await errorsFor({ ...VALID, contentLength: MAX_UPLOAD_BYTES })).toEqual([]);
  });

  it("refuses a zero-byte upload", async () => {
    expect(await errorsFor({ ...VALID, contentLength: 0 })).toContain("min");
  });

  it("refuses a fractional content length", async () => {
    expect(await errorsFor({ ...VALID, contentLength: 1.5 })).toContain("isInt");
  });

  it("refuses an unknown location rather than minting an arbitrary prefix", async () => {
    expect(await errorsFor({ ...VALID, location: "../../secrets" })).toContain("isIn");
  });

  it("refuses an empty file name", async () => {
    expect(await errorsFor({ ...VALID, fileName: "" })).toContain("isNotEmpty");
  });

  // forbidNonWhitelisted: an extra field must be rejected outright, not ignored.
  it("refuses an unexpected field", async () => {
    expect(await errorsFor({ ...VALID, bucketName: "someone-elses" })).toContain(
      "whitelistValidation",
    );
  });
});
