import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateProductDto } from "../dto/product.dto";

/**
 * The image key boundary.
 *
 * `imageKey` names an object in a shared bucket, so a key from another
 * organization's namespace would render one business's picture on another
 * business's product. The pattern in the DTO catches a malformed key; the check
 * in the service catches a well-formed key belonging to someone else, which is
 * why both exist and neither is sufficient alone.
 */
const ORG = "3f1c9a20-6d5e-4a1b-9c33-8f2b7e5d0a11";
const OTHER_ORG = "00000000-0000-4000-8000-000000000000";

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdateProductDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

/** Mirrors the service's ownership check, which the DTO pattern cannot do alone. */
function belongsToOrganization(organizationId: string, imageKey: string | null): boolean {
  if (imageKey === null) return true;
  return imageKey.startsWith(`${organizationId}/`);
}

describe("UpdateProductDto.imageKey", () => {
  it("accepts a key minted for this organization", async () => {
    expect(
      await errorsFor({ imageKey: `${ORG}/product-images/a3f9c2e1b0d4-jollof.jpg` }),
    ).toEqual([]);
  });

  it("accepts null, which clears the picture", async () => {
    expect(await errorsFor({ imageKey: null })).toEqual([]);
  });

  it("accepts an absent key, which leaves the picture alone", async () => {
    expect(await errorsFor({ name: "Jollof" })).toEqual([]);
  });

  it.each([
    ["a key with no organization prefix", "product-images/a3f9-jollof.jpg"],
    ["a key naming an unknown location", `${ORG}/invoices/a3f9-jollof.jpg`],
    ["a bare file name", "jollof.jpg"],
    ["a key whose prefix is not a uuid", `not-a-uuid/product-images/a3f9-jollof.jpg`],
    ["a path traversal attempt", `${ORG}/../other-org/product-images/a.jpg`],
  ])("refuses %s", async (_label, imageKey) => {
    expect(await errorsFor({ imageKey })).toContain("matches");
  });
});

describe("image key ownership", () => {
  it("accepts a key from this organization", () => {
    expect(belongsToOrganization(ORG, `${ORG}/product-images/a3f9-jollof.jpg`)).toBe(true);
  });

  it("refuses a well-formed key from another organization", () => {
    // The case the DTO pattern cannot catch: the shape is perfectly valid, so only
    // comparing against the organization the caller was authorized for stops it.
    expect(belongsToOrganization(ORG, `${OTHER_ORG}/product-images/a3f9-secret.jpg`)).toBe(
      false,
    );
  });

  it("refuses a key that merely starts with the same characters", () => {
    expect(
      belongsToOrganization(ORG, `${ORG}-evil/product-images/a3f9-jollof.jpg`),
    ).toBe(false);
  });

  it("treats clearing the picture as always allowed", () => {
    expect(belongsToOrganization(ORG, null)).toBe(true);
  });
});
