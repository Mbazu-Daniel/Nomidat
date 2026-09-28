import { z } from "zod";

const details = z.object({
  address: z.string().max(240).optional(),
  phone: z.string().max(40).optional(),
  email: z.string().email().max(160).optional(),
  shopNumber: z.string().max(40).optional(),
  registrationNumber: z.string().max(80).optional(),
});

export function invoiceBusinessDetails(metadata: string | null) {
  try {
    const result = details.safeParse(JSON.parse(metadata ?? "{}").businessDetails ?? {});
    return result.success ? result.data : {};
  } catch {
    return {};
  }
}

export function invoiceBusinessLogo(logo: string | null) {
  return logo &&
    logo.length <= 65000 &&
    /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)
    ? logo
    : undefined;
}
