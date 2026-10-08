/**
 * What an invoice looks like to someone holding a share link and no account.
 *
 * This is an allow-list on purpose. It is a different type from the seller-side
 * document rather than a narrowed copy of it, so adding a field to the invoice
 * document (cost price, customer phone, source sale) cannot accidentally widen
 * what the public route returns.
 */
export type PublicInvoiceView = {
  invoiceNumber: string;
  status: string;
  currency: string;
  subtotalMinor: number;
  discountMinor: number;
  taxMinor: number;
  totalMinor: number;
  dueDate: Date | null;
  notes: string | null;
  issuedAt: Date;
  seller: { name: string; logo: string | null };
  customerName: string | null;
  items: {
    description: string | null;
    quantity: number;
    unitPriceMinor: number;
    totalMinor: number;
  }[];
};
