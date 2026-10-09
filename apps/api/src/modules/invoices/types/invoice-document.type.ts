/**
 * A logo the invoice can draw, named by where it is rather than carrying bytes.
 *
 * The `key` form is the current one. `data-url` exists because
 * `organization.logo` is Better Auth's column and holds base64 for anyone who
 * set a logo before the bucket existed; removing that branch now would blank
 * those logos.
 */
export type BusinessLogo =
  | { kind: "key"; fileKey: string }
  | { kind: "data-url"; dataUrl: string };

export type InvoiceDocument = {
  /**
   * Where the logo lives, not its bytes. A PDF has to embed an image rather than
   * link it, so this is resolved to bytes by the delivery service just before
   * rendering, and a missing object falls back to the drawn vector mark.
   */
  businessLogo?: BusinessLogo;
  businessDetails?: {
    address?: string;
    phone?: string;
    email?: string;
    shopNumber?: string;
    registrationNumber?: string;
  };
  invoiceNumber: string;
  createdAt: Date;
  customerEmail?: string | null;
  customer: string | null;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  dueDate: Date | null;
  notes: string | null;
  items: {
    description: string | null;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }[];
};
