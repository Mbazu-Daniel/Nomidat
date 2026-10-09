import { z } from "zod";

const details = z.object({
  address: z.string().max(240).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(160).optional(),
  shopNumber: z.string().max(40).optional(),
  registrationNumber: z.string().max(80).optional(),
});

export function invoiceSellerDetails(metadata: string | null) {
  try {
    const result = details.safeParse(JSON.parse(metadata ?? "{}").businessDetails ?? {});
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

/**
 * Turns a stored logo into something the PDF can draw.
 *
 * Two branches because the column being read is `organization.logo`, Better Auth's
 * own, which predates the bucket and still holds base64 data URLs for anyone who
 * set a logo before. The key branch is tried first; the data URL is what keeps
 * those organizations rendering their logo rather than silently reverting to the
 * drawn vector mark.
 *
 * The size cap on the data URL branch is not a formality. A data URL longer than
 * this is rejected and the caller falls back, which means an organization whose
 * logo grew past the limit lost it from every invoice — quietly, with nothing
 * failing. Logos in the bucket have no such ceiling, which is most of why this
 * moved.
 */
export function invoiceSellerLogo(
  logoKey: string | null | undefined,
  legacyLogo: string | null | undefined,
): { kind: "key"; fileKey: string } | { kind: "data-url"; dataUrl: string } | undefined {
  if (logoKey) return { kind: "key", fileKey: logoKey };

  const logo = legacyLogo;
  return logo &&
    logo.length <= 65000 &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)
    ? { kind: "data-url", dataUrl: logo }
    : undefined;
}
