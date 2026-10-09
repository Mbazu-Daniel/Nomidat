import { describe, expect, it } from "vitest";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { UpdateOrganizationLogoDto } from "../dto/update-organization-logo.dto";

/**
 * The logo key boundary.
 *
 * The bucket is shared across every organization, so a key accepted here decides
 * whose picture gets printed on this business's invoices. The pattern catches a
 * malformed key; the service separately compares the prefix against the
 * organization the caller was authorized for, which is what catches a well-formed
 * key belonging to someone else.
 */
const ORG = "3f1c9a20-6d5e-4a1b-9c33-8f2b7e5d0a11";
const OTHER_ORG = "00000000-0000-4000-8000-000000000000";

async function errorsFor(body: Record<string, unknown>) {
  const dto = plainToInstance(UpdateOrganizationLogoDto, body);
  const errors = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
  return errors.flatMap((error) => Object.keys(error.constraints ?? {}));
}

function belongsToOrganization(organizationId: string, logoKey: string | null): boolean {
  if (logoKey === null) return true;
  return logoKey.startsWith(`${organizationId}/`);
}

describe("UpdateOrganizationLogoDto", () => {
  it("accepts a key minted for this organization", async () => {
    expect(await errorsFor({ logoKey: `${ORG}/organization-logos/a3f9-logo.png` })).toEqual([]);
  });

  it("accepts null, which removes the logo", async () => {
    expect(await errorsFor({ logoKey: null })).toEqual([]);
  });

  it.each([
    ["a product image key", `${ORG}/product-images/a3f9-logo.png`],
    ["an avatar key", `${ORG}/avatars/a3f9-daniel.png`],
    ["a bare file name", "logo.png"],
    ["a key with no organization prefix", "organization-logos/a3f9-logo.png"],
    ["a traversal attempt", `${ORG}/../${OTHER_ORG}/organization-logos/a.png`],
  ])("refuses %s", async (_label, logoKey) => {
    expect(await errorsFor({ logoKey })).toContain("matches");
  });

  it("refuses an unexpected field", async () => {
    expect(await errorsFor({ logoKey: null, bucket: "someone-elses" })).toContain(
      "whitelistValidation",
    );
  });
});

describe("logo key ownership", () => {
  it("accepts a key from this organization", () => {
    expect(belongsToOrganization(ORG, `${ORG}/organization-logos/a3f9-logo.png`)).toBe(true);
  });

  it("refuses a well-formed key from another organization", () => {
    // The case the pattern alone cannot catch: the shape is entirely valid, so
    // only the comparison against the authorized organization stops it.
    expect(
      belongsToOrganization(ORG, `${OTHER_ORG}/organization-logos/a3f9-theirs.png`),
    ).toBe(false);
  });

  it("refuses a key that merely starts with the same characters", () => {
    expect(
      belongsToOrganization(ORG, `${ORG}-evil/organization-logos/a3f9-logo.png`),
    ).toBe(false);
  });

  it("treats removing the logo as always allowed", () => {
    expect(belongsToOrganization(ORG, null)).toBe(true);
  });
});
