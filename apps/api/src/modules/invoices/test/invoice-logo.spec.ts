import { describe, expect, it } from "vitest";
import { invoiceSellerLogo } from "../invoice-seller";

/**
 * Which logo an invoice prints.
 *
 * The invoice reads `organization.logoKey` and `organization.logo`. `logo` is
 * Better Auth's own column and predates the bucket, so it holds a base64 data URL
 * for anyone who set a logo before. These pin the order the two are tried in,
 * because getting it backwards would print a stale inline logo for an
 * organization that has since uploaded a new one — and nothing would fail.
 */
const ORG = "3f1c9a20-6d5e-4a1b-9c33-8f2b7e5d0a11";
const KEY = `${ORG}/organization-logos/a3f9c2e1b0d4-logo.png`;
const DATA_URL =
  "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJ";

describe("invoiceSellerLogo", () => {
  it("prefers the bucket key when there is one", () => {
    expect(invoiceSellerLogo(KEY, DATA_URL)).toEqual({ kind: "key", fileKey: KEY });
  });

  it("falls back to the legacy data URL when no key is set", () => {
    expect(invoiceSellerLogo(null, DATA_URL)).toEqual({
      kind: "data-url",
      dataUrl: DATA_URL,
    });
  });

  it("returns nothing when the organization has no logo", () => {
    expect(invoiceSellerLogo(null, null)).toBeUndefined();
    expect(invoiceSellerLogo(undefined, undefined)).toBeUndefined();
  });

  // The silent failure this replaces: a logo past the cap was rejected and the
  // invoice quietly drew the vector mark instead, with nothing erroring.
  it("rejects an inline logo past the size cap rather than half-using it", () => {
    const tooLarge = `data:image/jpeg;base64,${"A".repeat(70_000)}`;
    expect(invoiceSellerLogo(null, tooLarge)).toBeUndefined();
  });

  it("accepts an inline logo at the cap", () => {
    const prefix = "data:image/jpeg;base64,";
    const padding = 65_000 - prefix.length;
    const atCap = `${prefix}${"A".repeat(padding)}`;
    expect(atCap.length).toBe(65_000);
    expect(invoiceSellerLogo(null, atCap)).toEqual({ kind: "data-url", dataUrl: atCap });
  });

  it.each([
    ["html", "data:text/html;base64,PHNjcmlwdD4="],
    ["svg", "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4="],
    ["a bare base64 string with no data url prefix", "PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg=="],
  ])("refuses %s, which the old data url guard also rejected", (_label, logo) => {
    expect(invoiceSellerLogo(null, logo)).toBeUndefined();
  });
});
