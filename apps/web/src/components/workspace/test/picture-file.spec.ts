import { describe, expect, it } from "vitest";
import { getPictureFileError } from "../picture-file";

describe("picture attachment validation", () => {
  it.each(["image/png", "image/jpeg", "image/webp"])(
    "accepts supported %s pictures at the size limit",
    (type) => {
      expect(getPictureFileError({ type, size: 10 * 1024 * 1024 })).toBeNull();
    },
  );
  it.each([
    { type: "image/png", size: 0 },
    { type: "image/png", size: 10 * 1024 * 1024 + 1 },
    { type: "image/svg+xml", size: 100 },
    { type: "application/pdf", size: 100 },
    { type: "", size: 100 },
  ])("rejects files that cannot be sent to picture extraction", (file) => {
    expect(getPictureFileError(file)).toBe("Choose a JPEG, PNG or WebP picture of at most 10 MB.");
  });
});
